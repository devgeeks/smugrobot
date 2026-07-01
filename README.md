# smugrobot

Privacy-focused tools for local-first computing.

## What is smugrobot?

smugrobot is a monorepo of tools built around one principle: your data is encrypted on your device before it goes anywhere. There is no backend, no account, and no sync service that can read your content. If you use Dropbox to sync across devices, Dropbox only ever receives opaque ciphertext — the encryption key never leaves the device that holds it.

## Packages

### [`echidna.js`](packages/echidna/README.md) — encrypted document store

A portable TypeScript library for storing text documents encrypted end-to-end. Document bodies are encrypted with XSalsa20-Poly1305 (TweetNaCl) before being written to any adapter. Metadata (title, tags, timestamps) is stored as plaintext so you can list, sort, and filter without decrypting every document.

Storage adapters: memory · localStorage · IndexedDB · Node.js filesystem · Dropbox · AsyncStorage (React Native) · expo-file-system

```sh
npm install echidna.js
```

### [`apps/notes`](apps/notes) — private notes

A Progressive Web App for writing Markdown notes that are encrypted at rest in IndexedDB. Three-pane layout with folder organisation, GitHub-Flavored Markdown editor (task lists, tables, strikethrough), passphrase-based vault, and a lock button that clears the session key immediately. No network requests after first load.

### [`@smugrobot/ui`](packages/ui) — vault-ui design system

Web Components for building privacy-focused interfaces. Works in any framework or plain HTML. Components: `vault-button`, `vault-card`, `vault-input`, `vault-textarea`, `vault-badge`, `vault-alert`, `vault-toggle`, `vault-select`, `vault-spinner`, `vault-avatar`, `vault-listbox`, `vault-popover`.

### [`@smugrobot/utils`](packages/utils) — shared utilities

Shared TypeScript utilities used across the monorepo.

## Privacy model

- **Cipher:** XSalsa20-Poly1305 via `nacl.secretbox`
- **Key derivation:** scrypt (`N=131072, r=8, p=1`) or PBKDF2 (`600,000 iterations, SHA-256`)
- **Nonce:** 24 random bytes generated fresh on every write — same plaintext never produces the same ciphertext
- **What is never stored:** the passphrase, the derived key, or any hash that would allow offline verification
- **Wrong-key detection:** comes entirely from the AEAD tag failing; garbage is never returned
- **Sync:** the Dropbox adapter encrypts locally before upload — the provider only ever sees opaque blobs
- **Session key:** stored in `sessionStorage` for the lifetime of the tab, cleared on lock or close

## Development

**Prerequisites:** Node.js 20+, npm 10+

```sh
npm install
```

**Workspace scripts** (run from the root):

```sh
npm run build       # build all packages
npm run test        # test all packages
npm run lint        # lint all packages
npm run typecheck   # type-check all packages
```

**Run the notes app:**

```sh
cd apps/notes
npm run dev
```

## License

MIT
