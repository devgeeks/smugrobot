# echidna.js

Encrypted document store for TypeScript. Documents are encrypted end-to-end using XSalsa20-Poly1305 ([TweetNaCl](https://tweetnacl.js.org/)). Metadata is stored as plaintext so you can list, sort, and filter without decrypting every document. The encryption key never touches storage — only encrypted blobs and plaintext metadata do.

Works in Node.js, browsers, and React Native via swappable storage adapters.

**Repository:** [github.com/devgeeks/smugrobot](https://github.com/devgeeks/smugrobot/tree/main/packages/echidna) · [Issues](https://github.com/devgeeks/smugrobot/issues)

---

## Install

```sh
npm install echidna.js
```

---

## Quick start

```ts
import { createEncryptedStore } from 'echidna.js'
import { memoryAdapter } from 'echidna.js/adapters/memory'

const store = await createEncryptedStore({
  adapter: memoryAdapter(),
  keySource: { type: 'passphrase', passphrase: 'my secret passphrase' },
})

// Write
await store.set('note-1', 'This is stored encrypted.', {
  title: 'My first note',
  tags: ['personal'],
})

// Read
const body = await store.get('note-1')         // decrypted string
const meta = await store.getMeta('note-1')     // plaintext metadata, no decryption

// List without decrypting
const all = await store.list()
const work = await store.list({ tags: ['work'] })
```

---

## Storage adapters

Import only the adapter you need — each is a separate bundle entry so unused adapters are never included.

### Memory

No dependencies. Works everywhere. Primarily useful for testing.

```ts
import { memoryAdapter } from 'echidna.js/adapters/memory'

const adapter = memoryAdapter()
```

### Node.js filesystem

Stores each key as a file under a root directory. No extra dependencies.

```ts
import { nodeFsAdapter } from 'echidna.js/adapters/node-fs'

const adapter = nodeFsAdapter('./my-vault')
```

### Browser (`localStorage`)

```ts
import { localStorageAdapter } from 'echidna.js/adapters/localstorage'

const adapter = localStorageAdapter()               // prefix defaults to 'echidna:'
const adapter = localStorageAdapter('myapp:vault:') // custom prefix
```

Like the IndexedDB adapter below, this requests [persistent storage](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist) on init — see that section for details.

### Browser (IndexedDB)

Async, binary-native storage with much higher quotas than `localStorage` (typically up to ~60% of available disk). Requires no encoding overhead — `Uint8Array` values are stored directly.

```ts
import { indexedDbAdapter } from 'echidna.js/adapters/indexeddb'

const adapter = await indexedDbAdapter()                        // db 'echidna', store 'vault'
const adapter = await indexedDbAdapter('myapp', 'documents')   // custom db and store names
```

On init, the adapter calls [`navigator.storage.persist()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist) to request exemption from the browser's automatic "best-effort" storage eviction (which can otherwise clear IndexedDB data under disk pressure — Safari is particularly aggressive here). This is best-effort: the call is skipped where unsupported (e.g. Safari doesn't implement the API) and never throws if the browser declines the request. It does **not** protect against a user explicitly clearing site data or uninstalling the app.

### React Native (expo-file-system)

Binary-native filesystem storage for Expo apps. No size constraints beyond device storage, and no base64 overhead — `Uint8Array` values are written directly to disk. Requires `expo-file-system` v17+ as a peer dependency.

```ts
import { expoFileSystemAdapter } from 'echidna.js/adapters/expo-file-system'
import * as FileSystem from 'expo-file-system'

const adapter = expoFileSystemAdapter(FileSystem.documentDirectory + 'vault/')
```

### Dropbox (PWA / cross-device sync)

Stores the encrypted vault as files in a Dropbox app folder, enabling multi-device access without exposing plaintext to Dropbox. The vault is encrypted before it leaves the device — Dropbox only ever sees opaque blobs.

Requires a [Dropbox app](https://www.dropbox.com/developers/apps) configured with the `files.content.write` and `files.content.read` permissions and a redirect URI for your app.

> **Note:** Dropbox is case-insensitive. Document IDs that differ only by case will collide.

```ts
import {
  dropboxAdapter,
  generatePkce,
  getDropboxAuthUrl,
  exchangeDropboxCode,
  refreshDropboxToken,
} from 'echidna.js/adapters/dropbox'
import { createEncryptedStore } from 'echidna.js'

// Step 1 — redirect the user to Dropbox for authorization (run once)
const { verifier, challenge } = await generatePkce()
sessionStorage.setItem('pkce_verifier', verifier)

const authUrl = getDropboxAuthUrl({
  clientId: 'YOUR_APP_KEY',
  redirectUri: 'https://yourapp.example.com/callback',
  codeChallenge: challenge,
  state: crypto.randomUUID(), // optional CSRF token
})
window.location.href = authUrl

// Step 2 — handle the redirect callback
const params = new URLSearchParams(window.location.search)
const tokens = await exchangeDropboxCode({
  clientId: 'YOUR_APP_KEY',
  redirectUri: 'https://yourapp.example.com/callback',
  code: params.get('code')!,
  codeVerifier: sessionStorage.getItem('pkce_verifier')!,
})
// Persist tokens.accessToken and tokens.refreshToken in your app

// Step 3 — open the vault
const store = await createEncryptedStore({
  adapter: dropboxAdapter({
    accessToken: tokens.accessToken,
    rootPath: '/MyApp',        // created inside the Dropbox app folder
  }),
  keySource: { type: 'passphrase', passphrase: userPassphrase },
})
```

To refresh an expired access token:

```ts
const fresh = await refreshDropboxToken({
  clientId: 'YOUR_APP_KEY',
  refreshToken: tokens.refreshToken!,
})
```

No SDK dependency — the adapter uses `fetch` and `crypto.subtle` directly.

### CouchDB / PouchDB (self-hosted or cloud sync)

Wraps a PouchDB instance you construct and own, so it can double as the local half of a `.sync()` against a remote CouchDB server. Values are stored as real CouchDB attachments (not inline base64 fields), so they replicate efficiently and stay interoperable with other CouchDB tooling inspecting the database.

`pouchdb` is a **peer dependency** — install it separately (`pouchdb`, `pouchdb-browser`, `pouchdb-node`, or a React Native build, whichever matches your environment).

In browsers, `pouchdb-browser` is typically backed by IndexedDB, so this adapter also requests [persistent storage](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist) on init — see the IndexedDB section above for what that does and doesn't protect against.

> **Note:** echidna.js only implements local storage through this adapter. Remote sync — the CouchDB URL, auth, live replication, retry policy — is your app's responsibility, driven directly against the same PouchDB instance you pass in.

> **Privacy warning:** syncing does not make document metadata private. `docs/{id}/meta` (title, tags, timestamps, size, and any custom fields) is always stored as plaintext JSON — by design, so lists can be filtered without decrypting bodies — and it is unauthenticated, so a malicious or compromised CouchDB server can read *and silently rewrite* it. Only `docs/{id}/body` is encrypted and MAC-protected; tampering with a body fails loudly (`WRONG_KEY`), and moving one document's body onto another id is caught by the id binding (`TAMPERED`). What is **not** protected: a hostile server operator can see attachment sizes and write timing, can withhold documents, and can roll a body (and its metadata) back to an *earlier version of the same document* undetectably — there is no vault-level integrity check or version anchor across the whole sync. Don't put anything sensitive in `title`, `tags`, or custom metadata fields if you don't trust the CouchDB server operator.

```ts
import PouchDB from 'pouchdb'
import { pouchDbAdapter } from 'echidna.js/adapters/pouchdb'
import { createEncryptedStore } from 'echidna.js'

const db = new PouchDB('my-vault')

const store = await createEncryptedStore({
  adapter: pouchDbAdapter(db),
  keySource: { type: 'passphrase', passphrase: userPassphrase },
})

// Not part of echidna.js — wire up sync yourself against the same `db`.
const remote = new PouchDB('https://couchdb.example.com/my-vault', {
  auth: { username: 'user', password: 'pass' },
})
db.sync(remote, { live: true, retry: true })
```

### React Native (`@react-native-async-storage/async-storage`)

`@react-native-async-storage/async-storage` is a **peer dependency** — install it separately in your app.

```ts
import { asyncStorageAdapter } from 'echidna.js/adapters/async-storage'

const adapter = asyncStorageAdapter()
```

---

## Key sources

### Passphrase (recommended)

A passphrase is derived into a key using scrypt (default) or PBKDF2. KDF parameters are stored in the vault so the same parameters are always used when reopening.

```ts
// scrypt (default, recommended)
{ type: 'passphrase', passphrase: 'my secret' }

// PBKDF2
{ type: 'passphrase', passphrase: 'my secret', kdf: 'pbkdf2' }
```

### Raw key

Supply a 32-byte `Uint8Array` directly. You are responsible for key management.

```ts
import nacl from 'tweetnacl'

{ type: 'raw', key: nacl.randomBytes(32) }
```

---

## API

### `createEncryptedStore(options)`

Creates or opens a vault. If the adapter already contains a vault, it is opened with the provided key source. If not, a new vault is initialised.

```ts
const store = await createEncryptedStore({
  adapter: nodeFsAdapter('./vault'),
  keySource: { type: 'passphrase', passphrase: 'hunter2' },
})
```

### `store.set(id, body, meta?)`

Encrypts and writes a document. Generates a fresh nonce on every write. Returns the updated `DocMeta`.

On overwrite, `createdAt` is preserved and `updatedAt` is bumped.

```ts
const meta = await store.set('doc-id', 'plaintext body', {
  title: 'My document',
  tags: ['work', 'draft'],
  // any extra fields are stored in metadata
  priority: 'high',
})
```

### `store.get(id)`

Decrypts and returns the document body, or `null` if the id does not exist.

Throws `EchidnaJsError` with code `WRONG_KEY` if decryption fails.

```ts
const body = await store.get('doc-id') // string | null
```

### `store.getMeta(id)`

Returns plaintext metadata without decrypting the body, or `null` if the id does not exist.

```ts
const meta = await store.getMeta('doc-id') // DocMeta | null
```

### `store.updateMeta(id, fields)`

Updates metadata fields without re-encrypting the body. The body blob is untouched.

```ts
await store.updateMeta('doc-id', { title: 'New title', tags: ['archived'] })
```

### `store.delete(id)`

Deletes both the encrypted body and the plaintext metadata.

```ts
await store.delete('doc-id')
```

### `store.list(options?)`

Returns all `DocMeta` records, optionally filtered. Never decrypts any body.

```ts
const all   = await store.list()
const work  = await store.list({ tags: ['work'] })
const today = await store.list({ since: Date.now() - 86_400_000 })
const range = await store.list({ since: startMs, until: endMs })
```

### `store.destroy()`

Permanently deletes all documents and vault keys from the adapter. Irreversible.

```ts
await store.destroy()
```

### `store.needsMigration()`

Returns `true` if the vault predates the current on-disk format and should be
upgraded with `migrate()`. Cheap — a single `vault/version` read.

```ts
if (await store.needsMigration()) await store.migrate()
```

### `store.migrate()`

Upgrades legacy `0x01` document bodies to the current `0x02` format (see
[Upgrading from 0.1.0](#upgrading-from-010)). Idempotent and resumable; returns
counts of bodies `scanned` and `upgraded`.

```ts
const { scanned, upgraded } = await store.migrate()
```

---

## Upgrading from 0.1.0

echidna 0.1.0 wrote body blobs in the `0x01` format, which did **not** bind the
document id into the ciphertext. The current format (`0x02`) does, so ordinary
reads reject `0x01` blobs with `EchidnaJsError('NEEDS_MIGRATION')` until they are
upgraded. The vault key is unchanged between the two formats, so migration is a
one-time re-encryption — no passphrase re-entry or key derivation.

Run it once, right after opening the vault:

```ts
const store = await createEncryptedStore({ adapter, keySource })
if (await store.needsMigration()) {
  const { upgraded } = await store.migrate()
  console.log(`Upgraded ${upgraded} document(s) to the 0x02 format`)
}
```

`migrate()` rewrites only body blobs (metadata, including `createdAt` /
`updatedAt`, is untouched), skips already-`0x02` bodies, and is safe to re-run if
interrupted — the `vault/version` marker is only advanced after a full pass.

> **Run migration on trusted storage.** Migration binds the id going forward but
> cannot audit the past: it re-binds whatever plaintext currently sits at
> `docs/{id}/body`. If a `0x01` vault was tampered with while its bodies were
> still unbound (e.g. two were swapped), that is laundered into an authenticated
> `0x02` blob. Migrate while the vault is local/trusted, before syncing to an
> untrusted backend, and run it single-flight before other writers touch the vault.

---

## Types

```ts
interface DocMeta {
  id: string
  title: string
  createdAt: number        // Unix ms
  updatedAt: number        // Unix ms
  tags?: string[]
  size?: number            // byte length of plaintext UTF-8
  [key: string]: unknown   // caller-defined fields
}

interface ListOptions {
  tags?: string[]
  since?: number           // createdAt >= since
  until?: number           // createdAt <= until
}
```

---

## Error handling

All errors thrown by echidna.js are instances of `EchidnaJsError`:

```ts
import { EchidnaJsError } from 'echidna.js'

try {
  await store.get('doc-id')
} catch (e) {
  if (e instanceof EchidnaJsError) {
    console.error(e.code) // 'WRONG_KEY' | 'CORRUPT_BLOB' | 'NOT_FOUND' | ...
  }
}
```

| Code | When |
|---|---|
| `WRONG_KEY` | Decryption failed — wrong key or corrupted ciphertext |
| `CORRUPT_BLOB` | Encrypted blob is malformed or has an unknown version byte |
| `TAMPERED` | Blob decrypted cleanly but is bound to a different document id (body substituted from another document) |
| `NEEDS_MIGRATION` | Body is a legacy `0x01` blob — call `store.migrate()` to upgrade the vault |
| `NOT_FOUND` | Document id does not exist (only from `updateMeta`) |
| `KDF_FAILED` | Key derivation threw an unexpected error |
| `VAULT_NOT_FOUND` | Adapter has no vault initialised |

---

## Security model

- **Cipher:** XSalsa20-Poly1305 via `nacl.secretbox`
- **Key derivation:** scrypt (`N=131072, r=8, p=1`) or PBKDF2 (`600,000 iterations, SHA-256`)
- **Salt:** 16 random bytes, generated once at vault creation, stored plaintext
- **Nonce:** 24 random bytes, generated fresh on every write, prepended to the ciphertext blob
- **Document binding:** each body is encrypted with its document id as additional authenticated data (see blob format). A body moved or relabelled to another document — e.g. by a compromised storage backend swapping two blobs — decrypts under the vault key but fails its id check, surfaced as `EchidnaJsError('TAMPERED')`. This does **not** prevent rolling a body back to an *earlier version of the same document* (there is no trusted version anchor).
- **Wrong key detection:** `nacl.secretbox.open` returns `null` — surfaced as `EchidnaJsError('WRONG_KEY')`. Garbage is never returned.
- **What is never stored:** the key, the passphrase, or any derivative that would allow offline verification

### Encrypted blob format

```
[ 0x02 ][ nonce: 24 bytes ][ ciphertext: N bytes ]
```

The ciphertext is `nacl.secretbox` over the authenticated message
`[ uint32BE(idLen) ][ id ][ plaintext ]`, so the document id is bound into the
MAC. The version byte distinguishes format revisions; `0x02` blobs are **not**
backward compatible with the original `0x01` format (which omitted the id
binding), and `0x01` blobs now surface as `CORRUPT_BLOB`.

### Vault storage layout

```
vault/salt         →  16 raw bytes (plaintext)
vault/kdf          →  JSON (plaintext): KDF algorithm and parameters
vault/version      →  JSON (plaintext): on-disk format version (for migration)
docs/{id}/meta     →  JSON (plaintext): title, tags, timestamps, size
docs/{id}/body     →  binary (encrypted blob)
```

---

## Custom adapters

Implement the `StorageAdapter` interface to use any backend:

```ts
import type { StorageAdapter } from 'echidna.js'

const myAdapter: StorageAdapter = {
  async get(key: string): Promise<Uint8Array | null> { ... },
  async set(key: string, value: Uint8Array): Promise<void> { ... },
  async delete(key: string): Promise<void> { ... },
  async list(prefix?: string): Promise<string[]> { ... },
}
```

Keys use forward-slash namespacing (`vault/salt`, `docs/abc/meta`). The `list` method must return all keys that start with the given prefix, or all keys when prefix is omitted or empty.

Adapters that use text-only backends (like `localStorage` or `AsyncStorage`) should encode `Uint8Array` values as base64 internally.

---

## License

MIT
