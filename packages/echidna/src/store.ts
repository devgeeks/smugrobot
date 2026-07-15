import { encrypt, decrypt, decryptLegacyV1, generateSalt } from "./core/crypto"
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

/**
 * Current vault format version, stored plaintext at `vault/version`. Bumped
 * whenever the on-disk layout changes in a way that needs migration. A vault
 * with no `vault/version` key predates this marker (echidna ≤ 0.1.0) and its
 * bodies are legacy `0x01` blobs — see {@link DocStore.migrate}.
 */
const CURRENT_VAULT_VERSION = 2

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
    // Fresh vaults are born at the current format version. Existing vaults are
    // left untouched so a missing marker reliably signals a legacy vault.
    await adapter.set("vault/version", encodeJson(CURRENT_VAULT_VERSION))
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
    const encrypted = encrypt(body, this.#key, id)
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
    return decrypt(blob, this.#key, id)
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

  /**
   * Reports whether this vault predates the current on-disk format and should
   * be upgraded with {@link migrate}. Cheap (a single `vault/version` read).
   *
   * A vault with no `vault/version` marker, or one older than the current
   * version, holds legacy `0x01` bodies that {@link get} will reject with
   * `NEEDS_MIGRATION` until migrated.
   */
  async needsMigration(): Promise<boolean> {
    const bytes = await this.#adapter.get("vault/version")
    if (bytes === null) return true
    const version = decodeJson<number>(bytes)
    return typeof version !== "number" || version < CURRENT_VAULT_VERSION
  }

  /**
   * Upgrades legacy `0x01` document bodies to the current `0x02` format,
   * re-encrypting each body bound to its document id. The vault key is
   * unchanged across format versions, so this is pure re-encryption — no
   * passphrase or key derivation is involved.
   *
   * Idempotent and resumable: already-`0x02` bodies are skipped, and a run
   * interrupted before completion leaves the `vault/version` marker unwritten,
   * so {@link needsMigration} stays `true` and a re-run finishes the rest.
   * Only body blobs are rewritten; metadata (including `createdAt` /
   * `updatedAt`) is left untouched.
   *
   * Security note: migration establishes the id binding going forward but
   * cannot audit the past — it re-binds whatever plaintext currently sits at
   * `docs/{id}/body` to `id`. If storage was tampered while bodies were still
   * unbound `0x01` (e.g. two were swapped), that is laundered into an
   * authenticated `0x02` blob. Run migration while the vault is on trusted
   * storage, before syncing to an untrusted backend. It is also read-then-write
   * per body, so run it single-flight before other writers touch the vault.
   *
   * @returns Counts of body blobs `scanned` and `upgraded`.
   */
  async migrate(): Promise<{ scanned: number; upgraded: number }> {
    const bodyKeys = (await this.#adapter.list("docs/")).filter((k) => k.endsWith("/body"))
    let upgraded = 0

    for (const bodyKey of bodyKeys) {
      const blob = await this.#adapter.get(bodyKey)
      // Leave already-migrated (0x02) or unknown blobs untouched.
      if (blob === null || blob.length === 0 || blob[0] !== 0x01) continue

      // Recover the id from `docs/{id}/body` without splitting on "/", so ids
      // that themselves contain slashes bind to the same id get() will pass.
      const id = bodyKey.slice("docs/".length, bodyKey.length - "/body".length)
      const plaintext = decryptLegacyV1(blob, this.#key)
      await this.#adapter.set(bodyKey, encrypt(plaintext, this.#key, id))
      upgraded++
    }

    await this.#adapter.set("vault/version", encodeJson(CURRENT_VAULT_VERSION))
    return { scanned: bodyKeys.length, upgraded }
  }
}
