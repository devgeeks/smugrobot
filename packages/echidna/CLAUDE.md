# echidna.js — Encrypted Document Store

echidna.js is a TypeScript library for storing arbitrary text documents encrypted end-to-end using TweetNaCl (XSalsa20-Poly1305 via `nacl.secretbox`). Metadata is stored as plaintext JSON so documents can be listed, sorted, and filtered without decrypting every body. The encryption key never touches storage — only encrypted blobs and plaintext metadata do.

---

## Security Model

- Encryption: `nacl.secretbox` (XSalsa20-Poly1305)
- Key derivation: scrypt-js or PBKDF2 from a user passphrase, or a raw 32-byte key
- Salt: 16 random bytes, generated once at vault creation, stored plaintext at `vault/salt`
- Nonce: 24 random bytes, generated fresh per write, prepended to the ciphertext blob
- Document binding: the document id is bound into the authenticated message as additional authenticated data (secretbox has no AAD parameter, so it is prepended, length-framed, inside the MAC-protected plaintext). A blob transplanted to another id decrypts under the vault key but fails the id check — surface this as a typed `TAMPERED` error. This does not defend against same-document rollback (no trusted version anchor).
- Wrong key signal: `nacl.secretbox.open` returns `null` — surface this as a typed error, never return garbage
- The salt is not secret — it exists only to prevent precomputation attacks across vaults

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

- `version` is currently `0x02`. `0x01` (which omitted the id binding below) is no longer readable and surfaces as `CORRUPT_BLOB`
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
  | "INVALID_ID" // doc id is empty, contains "/" or a control char, or is "."/".."
  | "NOT_FOUND" // doc id does not exist
  | "KDF_FAILED" // key derivation threw
  | "VAULT_EXISTS" // tried to init an already-initialised vault
  | "VAULT_NOT_FOUND"; // tried to open a vault with no salt stored
```

---

## Public API (`src/store.ts`)

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
  async set(id: string, body: string, meta?: SetMetaOptions): Promise<DocMeta>;

  // Decrypt and return body text, or null if id does not exist.
  // Throws EchidnaError('WRONG_KEY') if decryption fails.
  async get(id: string): Promise<string | null>;

  // Return plaintext metadata without decrypting the body.
  async getMeta(id: string): Promise<DocMeta | null>;

  // Update metadata fields only (no re-encryption of body needed).
  async updateMeta(id: string, meta: SetMetaOptions): Promise<DocMeta>;

  // Delete both meta and body for a doc id.
  async delete(id: string): Promise<void>;

  // Return all DocMeta records, optionally filtered.
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

---

## Key Derivation (`src/core/kdf.ts`)

- **scrypt**: use the `scrypt-js` npm package. Default params: `N=131072, r=8, p=1, dkLen=32`.
- **PBKDF2**: use the Web Crypto API (`crypto.subtle.deriveBits`) where available, fall back to Node's `crypto` module. Default params: `iterations=600_000, hash='SHA-256', dkLen=32`.
- Both return a `Uint8Array(32)` suitable for passing directly to `nacl.secretbox`.
- KDF params used at vault creation are stored at `vault/kdf` so the same params are always used when reopening.
- Expose a `deriveKey(passphrase: string, salt: Uint8Array, params: KdfParams): Promise<Uint8Array>` function.

---

## Crypto Primitives (`src/core/crypto.ts`)

```ts
export function encrypt(plaintext: string, key: Uint8Array, aad: string): Uint8Array;
// aad is the document id, bound into the authenticated message.
// Returns: [0x02][nonce(24)][ secretbox( [uint32BE(idLen)][id][plaintext] ) ]

export function decrypt(blob: Uint8Array, key: Uint8Array, aad: string): string;
// Throws EchidnaJsError('CORRUPT_BLOB') if blob/message is malformed
// Throws EchidnaJsError('WRONG_KEY') if secretbox.open returns null
// Throws EchidnaJsError('TAMPERED') if the embedded id !== aad
// Throws EchidnaJsError('NEEDS_MIGRATION') on a legacy 0x01 blob

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
- Guard against `localStorage` being unavailable (SSR)
- On init, calls `navigator.storage.persist()` (same guarded, fire-and-forget pattern as the IndexedDB adapter — see below) since this origin's storage is otherwise subject to the same best-effort eviction

### `src/adapters/node-fs.ts`

- Stores each key as a file under a root directory
- Key `docs/abc/meta` → `{rootDir}/docs/abc/meta` (mkdir -p as needed)
- Uses `node:fs/promises` — no extra dependencies

### `src/adapters/indexeddb.ts`

- Async, binary-native storage via raw `IDBDatabase` — no base64 encoding overhead, much higher quota than `localStorage`
- `indexedDbAdapter(dbName = 'echidna', storeName = 'vault')` opens (or creates) a single object store keyed by the adapter's string keys
- On init, calls `navigator.storage.persist()` (guarded by feature detection, `.catch(() => {})` on rejection) to request exemption from the browser's best-effort storage eviction. Fire-and-forget — never blocks or fails adapter creation if unsupported or denied.

### `src/adapters/async-storage.ts`

- Wraps `@react-native-async-storage/async-storage`
- That package is a **peer dependency** — not installed by echidna
- Encodes `Uint8Array` as base64 strings

### `src/adapters/pouchdb.ts`

- Wraps a caller-supplied PouchDB instance (`pouchDbAdapter(db)`) — does not construct its own, so the same `db` can be used for `.sync()` against a remote CouchDB by the consumer
- Stores each value as a CouchDB attachment (base64-transported, binary at rest) rather than an inline JSON field
- `set`/`delete` read the current `_rev` before writing and retry on 409 conflicts; `delete` on a missing key is a no-op
- `pouchdb` is a **peer dependency** — not installed by echidna; only its structural shape is relied on (no `@types/pouchdb-core` needed)
- On init, calls `navigator.storage.persist()` (same guarded, fire-and-forget pattern as the IndexedDB adapter) since browser PouchDB builds are typically IndexedDB-backed

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
      async-storage.ts
    store.ts
    types.ts
    index.ts
  tests/
    crypto.test.ts
    kdf.test.ts
    store.test.ts
    adapters.test.ts
  package.json
  tsconfig.json
  tsup.config.ts
  CLAUDE.md
```

---

## Build Configuration

Use **tsup** for building. Output both ESM and CJS with `.d.ts` declarations.

### `tsup.config.ts`

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/memory": "src/adapters/memory.ts",
    "adapters/localstorage": "src/adapters/localstorage.ts",
    "adapters/node-fs": "src/adapters/node-fs.ts",
    "adapters/async-storage": "src/adapters/async-storage.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

### `package.json` exports

```json
{
  "name": "echidna.js",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./adapters/memory": {
      "import": "./dist/adapters/memory.mjs",
      "require": "./dist/adapters/memory.cjs",
      "types": "./dist/adapters/memory.d.ts"
    },
    "./adapters/localstorage": {
      "import": "./dist/adapters/localstorage.mjs",
      "require": "./dist/adapters/localstorage.cjs",
      "types": "./dist/adapters/localstorage.d.ts"
    },
    "./adapters/node-fs": {
      "import": "./dist/adapters/node-fs.mjs",
      "require": "./dist/adapters/node-fs.cjs",
      "types": "./dist/adapters/node-fs.d.ts"
    },
    "./adapters/async-storage": {
      "import": "./dist/adapters/async-storage.mjs",
      "require": "./dist/adapters/async-storage.cjs",
      "types": "./dist/adapters/async-storage.d.ts"
    }
  },
  "dependencies": {
    "tweetnacl": "^1.0.3",
    "scrypt-js": "^3.0.1"
  },
  "peerDependencies": {
    "@react-native-async-storage/async-storage": ">=1.0.0"
  },
  "peerDependenciesMeta": {
    "@react-native-async-storage/async-storage": {
      "optional": true
    }
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## Tests

Use **vitest**. All tests use the memory adapter. No mocking of crypto — use real nacl operations.

### Required test coverage

**`crypto.test.ts`**

- `encrypt` + `decrypt` round-trip returns original string
- `decrypt` with wrong key throws `EchidnaJsError` with code `WRONG_KEY`
- `decrypt` with truncated blob throws `EchidnaJsError` with code `CORRUPT_BLOB`
- Each call to `encrypt` produces a different nonce (blobs differ even for same input)
- Version byte is `0x01`

**`kdf.test.ts`**

- scrypt derives a 32-byte key deterministically (same passphrase + salt = same key)
- PBKDF2 derives a 32-byte key deterministically
- Different salts produce different keys
- Different passphrases produce different keys

**`store.test.ts`**

- `createEncryptedStore` creates vault/salt and vault/kdf on first call
- `createEncryptedStore` reuses existing salt on second call (same key derived)
- `set` + `get` round-trip returns original text
- `get` on missing id returns `null`
- `getMeta` returns plaintext metadata without decrypting body
- `updateMeta` updates title/tags without re-encrypting body
- `delete` removes both meta and body; subsequent `get` returns `null`
- `list()` returns all DocMeta records
- `list({ tags: ['work'] })` returns only docs with that tag
- `list({ since, until })` filters by createdAt
- Opening the same vault with a wrong passphrase and calling `get` throws `WRONG_KEY` (`EchidnaJsError`)
- `set` updates `updatedAt` but not `createdAt` on overwrite
- `size` in DocMeta reflects the byte length of the UTF-8 plaintext

**`adapters.test.ts`**

- Memory adapter: set/get/delete/list work correctly
- Node-fs adapter: set/get/delete/list work correctly, files created on disk

---

## Implementation Notes

- Use `nacl.randomBytes` for all random generation — do not use `Math.random`
- Use `TextEncoder` / `TextDecoder` for UTF-8 conversion — available in all target environments
- The `list` adapter method should accept an optional prefix string to avoid fetching all keys when only `docs/` keys are needed
- The async-storage adapter should never be imported in Node or browser builds — its import of `@react-native-async-storage/async-storage` will fail outside React Native. This is fine because it's a separate exports entry.
- Do not store any representation of the key or passphrase — not even a hash for verification. Wrong-key detection comes entirely from `secretbox.open` returning `null`, surfaced as `EchidnaJsError` with code `WRONG_KEY`.
- `createEncryptedStore` should be idempotent: calling it on an existing vault opens it; calling it on a fresh adapter initialises it.

---

## What to Build

1. Scaffold the project structure and `package.json`
2. Install dependencies: `npm install`
3. Write `src/types.ts`
4. Write `src/core/crypto.ts`
5. Write `src/core/kdf.ts`
6. Write `src/adapters/memory.ts`
7. Write `src/adapters/localstorage.ts`
8. Write `src/adapters/node-fs.ts`
9. Write `src/adapters/async-storage.ts`
10. Write `src/store.ts`
11. Write `src/index.ts` (re-export everything public)
12. Write all tests
13. Run `npm test` — all tests must pass
14. Run `npm run build` — build must succeed with no type errors
15. Run `npm run typecheck` — must be clean
