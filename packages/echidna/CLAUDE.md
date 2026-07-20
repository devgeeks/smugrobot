# echidna.js — Encrypted Document Store

echidna.js is a TypeScript library for storing arbitrary text documents encrypted end-to-end using TweetNaCl (XSalsa20-Poly1305 via `nacl.secretbox`). Metadata is stored as plaintext JSON so documents can be listed, sorted, and filtered without decrypting every body. The encryption key never touches storage — only encrypted blobs and plaintext metadata do.

---

## Security Model

- Encryption: `nacl.secretbox` (XSalsa20-Poly1305)
- Key derivation: scrypt-js or PBKDF2 from a user passphrase, or a raw 32-byte key
- Salt: 16 random bytes, generated once at vault creation, stored plaintext at `vault/salt`
- Nonce: 24 random bytes, generated fresh per write, prepended to the ciphertext blob
- Document binding: the document id is bound into the authenticated message as additional authenticated data (secretbox has no AAD parameter, so it is prepended, length-framed, inside the MAC-protected plaintext). A blob transplanted to another id decrypts under the vault key but fails the id check — surfaced as a typed `TAMPERED` error. This does not defend against same-document rollback (no trusted version anchor).
- Wrong key signal: `nacl.secretbox.open` returns `null` — surfaced as a typed error, never return garbage
- The salt is not secret — it exists only to prevent precomputation attacks across vaults
- **Metadata is untrusted input by design:** `DocMeta` fields (`title`, `tags`, custom fields) are plaintext and unauthenticated, so `list()`/`getMeta()` can work without decrypting bodies. When a vault syncs through a backend the app doesn't fully trust (Dropbox, CouchDB), that backend can read and rewrite every metadata field arbitrarily. Consuming UIs must treat metadata fields as attacker-controllable, unescaped input — never pass them to `innerHTML` or an equivalent unescaped-HTML sink. See the Dropbox and PouchDB adapter sections below for adapter-specific privacy warnings.

---

## Vault Storage Layout

All keys use forward-slash namespacing within the adapter:

```
vault/salt           →  16 raw bytes (Uint8Array, plaintext)
vault/kdf            →  JSON (plaintext): { algo, ...params }
vault/version        →  JSON (plaintext): on-disk format version (number, currently 2)
docs/{id}/meta       →  JSON (plaintext): DocMeta
docs/{id}/body       →  binary (Uint8Array, encrypted)
```

`{id}` is a single key segment: it must be a non-empty string with no `/` or
control characters and must not be `.` or `..`. Every id-taking `DocStore`
method validates this and throws `EchidnaJsError('INVALID_ID')` otherwise, so
`list()` can read `docs/{id}/meta` records directly without re-parsing ids out
of key paths.

### Encrypted body blob format

```
[ version: 1 byte ][ nonce: 24 bytes ][ ciphertext: N bytes ]
```

- `version` is currently `0x02`. Legacy `0x01` blobs (which omitted the id binding below) are rejected by ordinary reads with `NEEDS_MIGRATION`; only `store.migrate()` can decrypt them (via `decryptLegacyV1`), to re-encrypt as `0x02`
- `nonce` is stored with the blob so each write is independently decryptable
- `ciphertext` is `nacl.secretbox(message, nonce, key)`, where `message` is the authenticated framing `[ uint32BE(idLen) ][ id ][ plaintextBytes ]` — the id (additional authenticated data) is verified on decrypt and must match the id being read

---

## Types (`src/types.ts`)

```ts
export interface StorageAdapter {
  get(key: string): Promise<Uint8Array | null>;
  set(key: string, value: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export interface DocMeta {
  id: string;
  title: string;
  createdAt: number; // Unix ms
  updatedAt: number; // Unix ms
  tags?: string[];
  size?: number; // byte length of plaintext UTF-8, for UI display
  [key: string]: unknown; // allow caller-defined metadata fields
}

export type KdfAlgo = "scrypt" | "pbkdf2";

export interface ScryptParams {
  algo: "scrypt";
  N: number; // default 2^17
  r: number; // default 8
  p: number; // default 1
}

export interface Pbkdf2Params {
  algo: "pbkdf2";
  iterations: number; // default 600_000
  hash: "SHA-256";
}

export type KdfParams = ScryptParams | Pbkdf2Params;

export type KeySource =
  { type: "passphrase"; passphrase: string; kdf?: KdfAlgo } | { type: "raw"; key: Uint8Array };

export interface CreateStoreOptions {
  adapter: StorageAdapter;
  keySource: KeySource;
}

export interface ListOptions {
  tags?: string[];
  since?: number; // createdAt >= since
  until?: number; // createdAt <= until
}

export interface SetMetaOptions {
  title?: string;
  tags?: string[];
  [key: string]: unknown;
}

export class EchidnaJsError extends Error {
  constructor(
    message: string,
    public readonly code: EchidnaJsErrorCode,
  ) {
    super(message);
    this.name = "EchidnaJsError";
  }
}

export type EchidnaJsErrorCode =
  | "WRONG_KEY" // secretbox.open returned null
  | "CORRUPT_BLOB" // blob too short, bad version byte, or malformed authenticated message
  | "TAMPERED" // blob authenticated but is bound to a different document id
  | "NEEDS_MIGRATION" // legacy 0x01 body; run store.migrate() to upgrade
  | "INVALID_KEY" // key passed to encrypt/decrypt is not 32 bytes
  | "INVALID_ID" // doc id is empty, contains "/" or a control char, or is "."/".."
  | "NOT_FOUND" // doc id does not exist
  | "KDF_FAILED" // key derivation threw
  | "VAULT_EXISTS" // tried to init an already-initialised vault
  | "VAULT_NOT_FOUND"; // tried to open a vault with no salt stored
```

---

## Public API (`src/store.ts`, re-exported from `src/index.ts`)

Consumers import as:

```ts
import { createEncryptedStore } from "echidna.js";
import { memoryAdapter } from "echidna.js/adapters/memory";
```

```ts
// Create or open a vault. If vault/salt exists, opens it. If not, creates it.
export async function createEncryptedStore(options: CreateStoreOptions): Promise<DocStore>;

export class DocStore {
  // Write or overwrite a document. Generates new nonce on every write.
  // On overwrite, createdAt is preserved and updatedAt is bumped.
  async set(id: string, body: string, meta?: SetMetaOptions): Promise<DocMeta>;

  // Decrypt and return body text, or null if id does not exist.
  // Throws EchidnaJsError('WRONG_KEY') if decryption fails.
  // Throws EchidnaJsError('NEEDS_MIGRATION') if the body is a legacy 0x01 blob.
  async get(id: string): Promise<string | null>;

  // Return plaintext metadata without decrypting the body.
  async getMeta(id: string): Promise<DocMeta | null>;

  // Update metadata fields only (no re-encryption of body needed).
  // Throws EchidnaJsError('NOT_FOUND') if the id does not exist.
  async updateMeta(id: string, meta: SetMetaOptions): Promise<DocMeta>;

  // Delete both meta and body for a doc id.
  async delete(id: string): Promise<void>;

  // Return all DocMeta records, optionally filtered. Never decrypts any body.
  async list(options?: ListOptions): Promise<DocMeta[]>;

  // Permanently destroy the vault (all docs + vault keys). Use with care.
  async destroy(): Promise<void>;

  // True if the vault predates the current format (missing/old vault/version)
  // and should be upgraded with migrate(). Cheap: one vault/version read.
  async needsMigration(): Promise<boolean>;

  // Re-encrypt legacy 0x01 bodies to 0x02 (id-bound). Idempotent, resumable;
  // rewrites bodies only (meta untouched). Returns { scanned, upgraded }.
  async migrate(): Promise<{ scanned: number; upgraded: number }>;
}
```

Every id-taking method validates `id` and throws `EchidnaJsError('INVALID_ID')`
on failure (empty, contains `/` or a control character, or is `.`/`..`).

---

## Key Derivation (`src/core/kdf.ts`)

- **scrypt**: uses the `scrypt-js` npm package. Default params: `N=131072, r=8, p=1, dkLen=32`.
- **PBKDF2**: uses the Web Crypto API (`crypto.subtle.deriveBits`) where available, falls back to Node's `crypto` module. Default params: `iterations=600_000, hash='SHA-256', dkLen=32`.
- Both return a `Uint8Array(32)` suitable for passing directly to `nacl.secretbox`.
- KDF params used at vault creation are stored at `vault/kdf` so the same params are always used when reopening.
- Exposes `deriveKey(passphrase: string, salt: Uint8Array, params: KdfParams): Promise<Uint8Array>`.

---

## Crypto Primitives (`src/core/crypto.ts`)

```ts
export function encrypt(plaintext: string, key: Uint8Array, aad: string): Uint8Array;
// aad is the document id, bound into the authenticated message.
// Returns: [0x02][nonce(24)][ secretbox( [uint32BE(idLen)][id][plaintext] ) ]
// Throws EchidnaJsError('INVALID_KEY') if key is not 32 bytes.

export function decrypt(blob: Uint8Array, key: Uint8Array, aad: string): string;
// Throws EchidnaJsError('INVALID_KEY') if key is not 32 bytes
// Throws EchidnaJsError('NEEDS_MIGRATION') on a legacy 0x01 blob
// Throws EchidnaJsError('CORRUPT_BLOB') if blob/message is malformed
// Throws EchidnaJsError('WRONG_KEY') if secretbox.open returns null
// Throws EchidnaJsError('TAMPERED') if the embedded id !== aad

export function decryptLegacyV1(blob: Uint8Array, key: Uint8Array): string;
// Decrypts a legacy 0x01 blob (no id binding). Used ONLY by store.migrate();
// not re-exported from index.ts. Ordinary reads must go through decrypt().

export function blobVersion(blob: Uint8Array): number; // blob[0], throws CORRUPT_BLOB if empty
export function generateSalt(): Uint8Array; // nacl.randomBytes(16)
// generateNonce is internal to crypto.ts (not exported)
```

---

## Adapters

Each adapter is a separate file and a separate package.json `exports` entry so consumers only bundle what they use. All adapters store and retrieve raw `Uint8Array` — encoding (e.g. base64 for text-only backends) is handled inside the adapter, not in the core.

### `src/adapters/memory.ts`

- In-memory `Map<string, Uint8Array>`
- Works in all environments, no dependencies
- Primary adapter for tests

### `src/adapters/localstorage.ts`

- Uses `window.localStorage`
- Encodes `Uint8Array` as base64 strings for storage
- Guards against `localStorage` being unavailable (SSR)
- On init, calls `navigator.storage.persist()` (same guarded, fire-and-forget pattern as the IndexedDB adapter — see below) since this origin's storage is otherwise subject to the same best-effort eviction

### `src/adapters/node-fs.ts`

- Stores each key as a file under a root directory
- Key `docs/abc/meta` → `{rootDir}/docs/abc/meta` (mkdir -p as needed)
- Uses `node:fs/promises` — no extra dependencies
- `keyToPath()` resolves the joined path and checks it's `root` or starts with `root + sep` before use — an independent path-traversal guard even if a caller bypassed id validation upstream

### `src/adapters/indexeddb.ts`

- Async, binary-native storage via raw `IDBDatabase` — no base64 encoding overhead, much higher quota than `localStorage`
- `indexedDbAdapter(dbName = 'echidna', storeName = 'vault')` opens (or creates) a single object store keyed by the adapter's string keys
- On init, calls `navigator.storage.persist()` (guarded by feature detection, `.catch(() => {})` on rejection) to request exemption from the browser's best-effort storage eviction. Fire-and-forget — never blocks or fails adapter creation if unsupported or denied.

### `src/adapters/async-storage.ts`

- Wraps `@react-native-async-storage/async-storage`
- That package is a **peer dependency** — not installed by echidna
- Encodes `Uint8Array` as base64 strings

### `src/adapters/dropbox.ts`

- Stores the encrypted vault as files in a Dropbox app folder for multi-device sync; the vault is encrypted before it leaves the device, so Dropbox only ever sees opaque blobs and plaintext `DocMeta` JSON
- No SDK dependency — uses `fetch` and `crypto.subtle` directly (PKCE OAuth flow: `generatePkce`, `getDropboxAuthUrl`, `exchangeDropboxCode`, `refreshDropboxToken`)
- Dropbox is case-insensitive — document ids that differ only by case will collide
- `list()` recovers keys by slicing `entry.path_display` against the configured `rootPath` prefix
- **Privacy:** metadata is plaintext and unauthenticated — a compromised Dropbox account can read and rewrite `title`/`tags`/custom fields arbitrarily. See the Security Model section above.

### `src/adapters/pouchdb.ts`

- Wraps a caller-supplied PouchDB instance (`pouchDbAdapter(db)`) — does not construct its own, so the same `db` can be used for `.sync()` against a remote CouchDB by the consumer
- Stores each value as a CouchDB attachment (base64-transported, binary at rest) rather than an inline JSON field
- `set`/`delete` read the current `_rev` before writing and retry on 409 conflicts; `delete` on a missing key is a no-op
- `pouchdb` is a **peer dependency** — not installed by echidna; only its structural shape is relied on
- On init, calls `navigator.storage.persist()` (same guarded, fire-and-forget pattern as the IndexedDB adapter) since browser PouchDB builds are typically IndexedDB-backed
- **Privacy:** syncing does not make metadata private — `docs/{id}/meta` is always plaintext and unauthenticated, so a malicious or compromised CouchDB server can read and silently rewrite it (and roll a document back to an earlier version undetectably — there is no vault-level integrity check across the whole sync). Only `docs/{id}/body` is encrypted and MAC-protected. See the Security Model section above.

---

## Project Structure

```
echidna.js/
  src/
    core/
      crypto.ts
      kdf.ts
    adapters/
      memory.ts
      localstorage.ts
      node-fs.ts
      indexeddb.ts
      async-storage.ts
      dropbox.ts
      pouchdb.ts
    store.ts
    types.ts
    index.ts
  tests/
    crypto.test.ts
    kdf.test.ts
    store.test.ts
    migrate.test.ts
    adapters.test.ts
    dropbox.test.ts
    pouchdb.test.ts
    helpers.ts
  package.json
  tsconfig.json
  tsup.config.ts
  README.md
  CLAUDE.md
```

---

## Build Configuration

Built with **tsup**, one entry per public module (core + each adapter) so consumers only bundle what they import. Output both ESM and CJS with `.d.ts`/`.d.cts` declarations. `@react-native-async-storage/async-storage` is marked `external` since it's a peer dependency that must not be bundled.

Dependencies: `tweetnacl`, `scrypt-js`. Peer dependencies (both optional): `@react-native-async-storage/async-storage`, `pouchdb`.

See `tsup.config.ts` and `package.json` `exports` for the exact entry/module map — keep both in sync whenever an adapter is added or removed.

---

## Tests

Uses **vitest**. Most tests use the memory adapter. No mocking of crypto — use real nacl operations.

- **`crypto.test.ts`** — encrypt/decrypt round-trip, wrong-key/truncated-blob/tampered-id error codes, nonce uniqueness, legacy `0x01` handling
- **`kdf.test.ts`** — scrypt/PBKDF2 determinism, salt/passphrase sensitivity
- **`store.test.ts`** — vault creation/reopen, set/get/getMeta/updateMeta/delete round-trips, `list()` filtering (`tags`, `since`/`until`), wrong-passphrase handling, `createdAt`/`updatedAt`/`size` semantics
- **`migrate.test.ts`** — `needsMigration()`/`migrate()` behavior on legacy `0x01` vaults: idempotency, resumability, meta preservation
- **`adapters.test.ts`** — memory, node-fs (including path-traversal guard), localstorage, indexeddb adapters: set/get/delete/list correctness
- **`dropbox.test.ts`** — PKCE flow, token exchange/refresh, adapter get/set/delete/list against a mocked Dropbox API
- **`pouchdb.test.ts`** — adapter get/set/delete/list against PouchDB, including `_rev`/409-conflict handling

---

## Implementation Notes

- Use `nacl.randomBytes` for all random generation — never `Math.random`
- Use `TextEncoder`/`TextDecoder` for UTF-8 conversion — available in all target environments
- The `list` adapter method accepts an optional prefix string to avoid fetching all keys when only `docs/` keys are needed
- The async-storage adapter must never be imported in Node or browser builds — its import of `@react-native-async-storage/async-storage` fails outside React Native. This is fine because it's a separate exports entry.
- Do not store any representation of the key or passphrase — not even a hash for verification. Wrong-key detection comes entirely from `secretbox.open` returning `null`, surfaced as `EchidnaJsError` with code `WRONG_KEY`.
- `createEncryptedStore` is idempotent: calling it on an existing vault opens it; calling it on a fresh adapter initialises it.
- `DocMeta`/`SetMetaOptions` have an open `[key: string]: unknown` index signature — metadata merges use object spread (`{...existing, ...meta, id}`), which is safe against prototype pollution since spread uses `CreateDataProperty` semantics. If metadata merging is ever refactored to a recursive/deep-merge utility, re-audit for prototype pollution since `meta` is directly caller-controlled and unvalidated for key names.
