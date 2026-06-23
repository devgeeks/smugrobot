import { encrypt, decrypt, generateSalt } from "./core/crypto"
import { deriveKey, defaultKdfParams } from "./core/kdf"
import { EchidnaJsError } from "./types"
import type {
  StorageAdapter,
  DocMeta,
  KeySource,
  KdfParams,
  ListOptions,
  SetMetaOptions,
  CreateStoreOptions,
} from "./types"

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function encodeJson(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value))
}

function decodeJson<T>(bytes: Uint8Array): T {
  return JSON.parse(decoder.decode(bytes)) as T
}

async function resolveKey(
  keySource: KeySource,
  salt: Uint8Array,
  kdfParams: KdfParams,
): Promise<Uint8Array> {
  if (keySource.type === "raw") return keySource.key
  return deriveKey(keySource.passphrase, salt, kdfParams)
}

export async function createEncryptedStore(options: CreateStoreOptions): Promise<DocStore> {
  const { adapter, keySource } = options

  const existingSalt = await adapter.get("vault/salt")

  let salt: Uint8Array
  let kdfParams: KdfParams

  if (existingSalt !== null) {
    const kdfBytes = await adapter.get("vault/kdf")
    if (kdfBytes === null) {
      throw new EchidnaJsError("Vault salt found but KDF params missing", "VAULT_NOT_FOUND")
    }
    salt = existingSalt
    kdfParams = decodeJson<KdfParams>(kdfBytes)
  } else {
    salt = generateSalt()
    const algo = keySource.type === "passphrase" ? (keySource.kdf ?? "scrypt") : "scrypt"
    kdfParams = defaultKdfParams(algo)
    await adapter.set("vault/salt", salt)
    await adapter.set("vault/kdf", encodeJson(kdfParams))
  }

  const key = await resolveKey(keySource, salt, kdfParams)
  return new DocStore(adapter, key)
}

export class DocStore {
  #adapter: StorageAdapter
  #key: Uint8Array

  constructor(adapter: StorageAdapter, key: Uint8Array) {
    this.#adapter = adapter
    this.#key = key
  }

  async set(id: string, body: string, meta?: SetMetaOptions): Promise<DocMeta> {
    const encrypted = encrypt(body, this.#key)
    const now = Date.now()
    const existingMeta = await this.getMeta(id)
    const { title: metaTitle, tags: metaTags, ...extraMeta } = meta ?? {}

    const docMeta: DocMeta = {
      ...extraMeta,
      id,
      title: metaTitle ?? existingMeta?.title ?? id,
      createdAt: existingMeta?.createdAt ?? now,
      updatedAt: now,
      size: encoder.encode(body).length,
    }
    const resolvedTags = metaTags ?? existingMeta?.tags
    if (resolvedTags !== undefined) docMeta["tags"] = resolvedTags

    await this.#adapter.set(`docs/${id}/body`, encrypted)
    await this.#adapter.set(`docs/${id}/meta`, encodeJson(docMeta))
    return docMeta
  }

  async get(id: string): Promise<string | null> {
    const blob = await this.#adapter.get(`docs/${id}/body`)
    if (blob === null) return null
    return decrypt(blob, this.#key)
  }

  async getMeta(id: string): Promise<DocMeta | null> {
    const bytes = await this.#adapter.get(`docs/${id}/meta`)
    if (bytes === null) return null
    return decodeJson<DocMeta>(bytes)
  }

  async updateMeta(id: string, meta: SetMetaOptions): Promise<DocMeta> {
    const existing = await this.getMeta(id)
    if (existing === null) {
      throw new EchidnaJsError(`Document not found: ${id}`, "NOT_FOUND")
    }
    const updated: DocMeta = { ...existing, ...meta, id, updatedAt: Date.now() }
    await this.#adapter.set(`docs/${id}/meta`, encodeJson(updated))
    return updated
  }

  async delete(id: string): Promise<void> {
    await this.#adapter.delete(`docs/${id}/meta`)
    await this.#adapter.delete(`docs/${id}/body`)
  }

  async list(options?: ListOptions): Promise<DocMeta[]> {
    const keys = await this.#adapter.list("docs/")
    const ids = new Set<string>()
    for (const key of keys) {
      const id = key.split("/")[1]
      if (id) ids.add(id)
    }

    const metas: DocMeta[] = []
    for (const id of ids) {
      const meta = await this.getMeta(id)
      if (meta !== null) metas.push(meta)
    }

    return metas.filter((meta) => {
      if (options?.tags && !options.tags.every((t) => (meta.tags as string[] | undefined)?.includes(t)))
        return false
      if (options?.since !== undefined && meta.createdAt < options.since) return false
      if (options?.until !== undefined && meta.createdAt > options.until) return false
      return true
    })
  }

  async destroy(): Promise<void> {
    const keys = await this.#adapter.list()
    await Promise.all(keys.map((k) => this.#adapter.delete(k)))
  }
}
