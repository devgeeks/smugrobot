# Notes

A private, encrypted markdown notes app. All notes are encrypted at rest using [echidna.js](../../packages/echidna) with a master passphrase — nothing is stored in plaintext.

## Features

- End-to-end encrypted notes stored in IndexedDB
- Markdown editor powered by Milkdown
- Folder tree for organisation
- Session key caching — unlock once per tab, no re-entry on refresh
- Three-pane desktop layout; single-pane slide navigation on mobile
- PWA — installable on iOS ("Add to Home Screen") and Android

## Development

```bash
npm run dev        # start dev server (http://localhost:5173)
npm run build      # typecheck + production build
npm run preview    # serve the production build locally
npm run typecheck  # type-check only
```

## PWA / Install to Home Screen

PWA support (service worker, manifest, icons) is only active in the **production build** — the service worker is intentionally disabled during `npm run dev` to avoid interfering with HMR.

To test PWA installability:

```bash
npm run build && npm run preview
```

Then open the preview URL in Chrome (DevTools → Application → Manifest / Service Workers) or Safari on iOS (Share → Add to Home Screen).

To regenerate icons after changing `public/icon.svg`:

```bash
npx pwa-assets-generator --preset minimal public/icon.svg
```

## Editor keyboard shortcuts

`Mod` = `Cmd` on macOS, `Ctrl` on Windows/Linux.

### Formatting

| Shortcut | Action |
|---|---|
| `Mod-b` | Bold |
| `Mod-i` | Italic |
| `Mod-e` | Inline code |
| `Mod-k` | Toggle link on selection; edit link at cursor |
| `Mod-Shift-b` | Blockquote |
| `Mod-Alt-c` | Code block |

### Headings and paragraphs

| Shortcut | Action |
|---|---|
| `Mod-Alt-0` | Normal paragraph |
| `Mod-Alt-1` | Heading 1 |
| `Mod-Alt-2` | Heading 2 |
| `Mod-Alt-3` | Heading 3 |
| `Mod-Alt-4` | Heading 4 |
| `Mod-Alt-5` | Heading 5 |
| `Mod-Alt-6` | Heading 6 |

### Lists

| Shortcut | Action |
|---|---|
| `Mod-Alt-7` | Bullet list |
| `Mod-Alt-8` | Ordered list |
| `Tab` / `Mod-]` | Increase indent |
| `Shift-Tab` / `Mod-[` | Decrease indent |

### Other

| Shortcut | Action |
|---|---|
| `Shift-Enter` | Hard line break |

## Architecture

| Layer | Technology |
|---|---|
| Build | Vite 5 + TypeScript |
| UI components | `@smugrobot/ui` (vault-ui Web Components) |
| Encryption | `echidna.js` (AES-GCM, scrypt KDF) |
| Editor | Milkdown (CommonMark) |
| Storage | IndexedDB via echidna.js adapter |
| State | Vanilla pub-sub store (`src/state/store.ts`) |

All data stays on-device. There is no backend, no sync, no account.
