import { encrypt, decrypt, decryptLegacyV1, generateSalt, blobVersion } from "./core/crypto";
import { deriveKey, defaultKdfParams } from "./core/kdf";
import { EchidnaJsError } from "./types";
import type {
  StorageAdapter,
  DocMeta,
  KeySource,
  KdfParams,
  ListOptions,
  SetMetaOptions,
  CreateStoreOptions,
} from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Current vault format version, stored plaintext at `vault/version`. Bumped
 * whenever the on-disk layout changes in a way that needs migration. A vault
 * with no `vault/version` key predates this marker (echidna ≤ 0.1.0) and its
 * bodies are legacy `0x01` blobs — see {@link DocStore.migrate}.
 */
const CURRENT_VAULT_VERSION = 2;

/**
 * Serializes a value to UTF-8 encoded JSON bytes, for plaintext storage keys
 * (`vault/kdf`, `vault/version`, `docs/{id}/meta`).
 *
 * @param value - The value to serialize
 * @returns UTF-8 bytes of the JSON string
 */
function encodeJson(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

/**
 * Decodes and parses UTF-8 JSON bytes previously written by {@link encodeJson}.
 *
 * @param bytes - UTF-8 encoded JSON bytes
 * @returns The parsed value
 * @throws {EchidnaJsError} `CORRUPT_BLOB` if `bytes` is not valid JSON
 */
function decodeJson<T>(bytes: Uint8Array): T {
  try {
    return JSON.parse(decoder.decode(bytes)) as T;
  } catch {
    throw new EchidnaJsError("corrupt plaintext record", "CORRUPT_BLOB");
  }
}

// Control characters (C0 range + DEL) break file-path backends and are never
// meaningful in a document id.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Validates a document id before it is baked into a `docs/{id}/...` storage key.
 *
 * Ids become a path segment in the adapter's forward-slash namespace, so a `/`
 * would split one document across keys `list()` can't recompose (and could
 * collide two ids), and `.`/`..` could traverse the namespace on path-based
 * adapters (e.g. node-fs). Rejecting them keeps behaviour identical across all
 * adapters. Note: no on-disk format changes for valid ids, so existing vaults
 * are unaffected.
 *
 * @throws {EchidnaJsError} `INVALID_ID` if the id is empty, contains `/` or a
 *   control character, or is `.`/`..`.
 */
function assertValidId(id: string): void {
  if (typeof id !== "string" || id.length === 0) {
    throw new EchidnaJsError("Document id must be a non-empty string", "INVALID_ID");
  }
  if (id.includes("/")) {
    throw new EchidnaJsError(
      `Document id must not contain "/": ${JSON.stringify(id)}`,
      "INVALID_ID",
    );
  }
  if (id === "." || id === "..") {
    throw new EchidnaJsError(
      `Document id must not be "." or "..": ${JSON.stringify(id)}`,
      "INVALID_ID",
    );
  }
  if (CONTROL_CHARS.test(id)) {
    throw new EchidnaJsError("Document id must not contain control characters", "INVALID_ID");
  }
}

/**
 * Resolve a `KeySource` to a raw 32-byte secretbox key.
 *
 * @param keySource - Either a raw key or a passphrase to derive from
 * @param salt - Vault salt, used only when deriving from a passphrase
 * @param kdfParams - KDF algorithm/params, used only when deriving from a passphrase
 * @returns The 32-byte key
 */
async function resolveKey(
  keySource: KeySource,
  salt: Uint8Array,
  kdfParams: KdfParams,
): Promise<Uint8Array> {
  if (keySource.type === "raw") return keySource.key;
  return deriveKey(keySource.passphrase, salt, kdfParams);
}

/**
 * Creates or opens an encrypted document vault on the given storage adapter.
 *
 * If `vault/salt` already exists, the existing salt and KDF params are reused
 * so the same key is derived (or the raw key is used as-is); otherwise a
 * fresh vault is initialised with a new salt, default KDF params for the
 * chosen algorithm, and the current vault format version. Idempotent per
 * adapter: safe to call on both a fresh and an existing vault.
 *
 * @param options - Storage adapter and key source (passphrase or raw key)
 * @returns A {@link DocStore} bound to the derived/raw key
 * @throws {EchidnaJsError} `VAULT_NOT_FOUND` if `vault/salt` exists but
 *   `vault/kdf` is missing
 */
export async function createEncryptedStore(options: CreateStoreOptions): Promise<DocStore> {
  const { adapter, keySource } = options;

  const existingSalt = await adapter.get("vault/salt");

  let salt: Uint8Array;
  let kdfParams: KdfParams;

  if (existingSalt !== null) {
    const kdfBytes = await adapter.get("vault/kdf");
    if (kdfBytes === null) {
      throw new EchidnaJsError("Vault salt found but KDF params missing", "VAULT_NOT_FOUND");
    }
    salt = existingSalt;
    kdfParams = decodeJson<KdfParams>(kdfBytes);
  } else {
    salt = generateSalt();
    const algo = keySource.type === "passphrase" ? (keySource.kdf ?? "scrypt") : "scrypt";
    kdfParams = defaultKdfParams(algo);
    await adapter.set("vault/salt", salt);
    await adapter.set("vault/kdf", encodeJson(kdfParams));
    // Fresh vaults are born at the current format version. Existing vaults are
    // left untouched so a missing marker reliably signals a legacy vault.
    await adapter.set("vault/version", encodeJson(CURRENT_VAULT_VERSION));
  }

  const key = await resolveKey(keySource, salt, kdfParams);
  return new DocStore(adapter, key);
}

/**
 * An open encrypted document vault, bound to a resolved key and storage
 * adapter. Obtain an instance via {@link createEncryptedStore}.
 */
export class DocStore {
  #adapter: StorageAdapter;
  #key: Uint8Array;

  /**
   * @param adapter - Storage backend the vault reads/writes through
   * @param key - Resolved 32-byte secretbox key
   */
  constructor(adapter: StorageAdapter, key: Uint8Array) {
    this.#adapter = adapter;
    this.#key = key;
  }

  /**
   * Writes or overwrites a document's encrypted body and plaintext metadata.
   * Generates a fresh nonce on every write. Preserves `createdAt` and any
   * existing `title`/`tags` not overridden by `meta` on an overwrite.
   *
   * @param id - Document id
   * @param body - Plaintext document body
   * @param meta - Optional metadata overrides (title, tags, custom fields)
   * @returns The resulting `DocMeta`
   * @throws {EchidnaJsError} `INVALID_ID` if `id` is invalid
   */
  async set(id: string, body: string, meta?: SetMetaOptions): Promise<DocMeta> {
    assertValidId(id);
    const encrypted = encrypt(body, this.#key, id);
    const now = Date.now();
    const existingMeta = await this.getMeta(id);
    const { title: metaTitle, tags: metaTags, ...extraMeta } = meta ?? {};

    const docMeta: DocMeta = {
      ...extraMeta,
      id,
      title: metaTitle ?? existingMeta?.title ?? id,
      createdAt: existingMeta?.createdAt ?? now,
      updatedAt: now,
      size: encoder.encode(body).length,
    };
    const resolvedTags = metaTags ?? existingMeta?.tags;
    if (resolvedTags !== undefined) docMeta["tags"] = resolvedTags;

    await this.#adapter.set(`docs/${id}/body`, encrypted);
    await this.#adapter.set(`docs/${id}/meta`, encodeJson(docMeta));
    return docMeta;
  }

  /**
   * Decrypts and returns a document's body text.
   *
   * @param id - Document id
   * @returns The plaintext body, or `null` if `id` does not exist
   * @throws {EchidnaJsError} `INVALID_ID` if `id` is invalid; `WRONG_KEY` if
   *   the vault key cannot decrypt the blob; `CORRUPT_BLOB` if the blob is
   *   malformed; `TAMPERED` if the blob is bound to a different id;
   *   `NEEDS_MIGRATION` if the blob is a legacy `0x01` body
   */
  async get(id: string): Promise<string | null> {
    assertValidId(id);
    const blob = await this.#adapter.get(`docs/${id}/body`);
    if (blob === null) return null;
    return decrypt(blob, this.#key, id);
  }

  /**
   * Returns a document's plaintext metadata without decrypting its body.
   *
   * @param id - Document id
   * @returns The `DocMeta`, or `null` if `id` does not exist
   * @throws {EchidnaJsError} `INVALID_ID` if `id` is invalid; `CORRUPT_BLOB`
   *   if the stored metadata is not valid JSON
   */
  async getMeta(id: string): Promise<DocMeta | null> {
    assertValidId(id);
    const bytes = await this.#adapter.get(`docs/${id}/meta`);
    if (bytes === null) return null;
    return decodeJson<DocMeta>(bytes);
  }

  /**
   * Updates metadata fields for an existing document without touching or
   * re-encrypting its body. Always refreshes `updatedAt`.
   *
   * @param id - Document id
   * @param meta - Metadata fields to merge into the existing record
   * @returns The updated `DocMeta`
   * @throws {EchidnaJsError} `INVALID_ID` if `id` is invalid; `NOT_FOUND` if
   *   the document does not exist
   */
  async updateMeta(id: string, meta: SetMetaOptions): Promise<DocMeta> {
    assertValidId(id);
    const existing = await this.getMeta(id);
    if (existing === null) {
      throw new EchidnaJsError(`Document not found: ${id}`, "NOT_FOUND");
    }
    const updated: DocMeta = { ...existing, ...meta, id, updatedAt: Date.now() };
    await this.#adapter.set(`docs/${id}/meta`, encodeJson(updated));
    return updated;
  }

  /**
   * Deletes both the metadata and body for a document id. A no-op key layout
   * (no existence check) — deleting a nonexistent id is not an error.
   *
   * @param id - Document id
   * @throws {EchidnaJsError} `INVALID_ID` if `id` is invalid
   */
  async delete(id: string): Promise<void> {
    assertValidId(id);
    await this.#adapter.delete(`docs/${id}/meta`);
    await this.#adapter.delete(`docs/${id}/body`);
  }

  /**
   * Returns all document metadata records, optionally filtered by tags or
   * creation date range. Reads only `docs/{id}/meta` keys — bodies are never
   * decrypted.
   *
   * @param options - Optional tag/date filters
   * @returns Matching `DocMeta` records
   * @throws {EchidnaJsError} `CORRUPT_BLOB` if any stored metadata is not
   *   valid JSON
   */
  async list(options?: ListOptions): Promise<DocMeta[]> {
    // Read each doc's plaintext meta record directly from its `docs/{id}/meta`
    // key. The id lives inside the meta JSON, so there is no need to recompose
    // it from the key path — which is what previously mis-parsed ids.
    const keys = await this.#adapter.list("docs/");
    const metas: DocMeta[] = [];
    for (const key of keys) {
      if (!key.endsWith("/meta")) continue;
      const bytes = await this.#adapter.get(key);
      if (bytes !== null) metas.push(decodeJson<DocMeta>(bytes));
    }

    return metas.filter((meta) => {
      if (
        options?.tags &&
        !options.tags.every((t) => (meta.tags as string[] | undefined)?.includes(t))
      )
        return false;
      if (options?.since !== undefined && meta.createdAt < options.since) return false;
      if (options?.until !== undefined && meta.createdAt > options.until) return false;
      return true;
    });
  }

  /**
   * Permanently destroys the vault: deletes every key the adapter holds
   * (all document bodies/metadata plus `vault/salt`, `vault/kdf`,
   * `vault/version`). Irreversible — use with care.
   */
  async destroy(): Promise<void> {
    const keys = await this.#adapter.list();
    await Promise.all(keys.map((k) => this.#adapter.delete(k)));
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
    const bytes = await this.#adapter.get("vault/version");
    if (bytes === null) return true;
    const version = decodeJson<number>(bytes);
    return typeof version !== "number" || version < CURRENT_VAULT_VERSION;
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
    const bodyKeys = (await this.#adapter.list("docs/")).filter((k) => k.endsWith("/body"));
    let upgraded = 0;

    for (const bodyKey of bodyKeys) {
      const blob = await this.#adapter.get(bodyKey);
      // Leave already-migrated (0x02) or unknown blobs untouched.
      if (blob === null || blob.length === 0 || blobVersion(blob) !== 0x01) continue;

      // Recover the id from `docs/{id}/body` without splitting on "/", so ids
      // that themselves contain slashes bind to the same id get() will pass.
      const id = bodyKey.slice("docs/".length, bodyKey.length - "/body".length);
      const plaintext = decryptLegacyV1(blob, this.#key);
      await this.#adapter.set(bodyKey, encrypt(plaintext, this.#key, id));
      upgraded++;
    }

    await this.#adapter.set("vault/version", encodeJson(CURRENT_VAULT_VERSION));
    return { scanned: bodyKeys.length, upgraded };
  }
}
