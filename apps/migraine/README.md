# Migraines

A private migraine tracker. All episodes are encrypted at rest using [echidna.js](../../packages/echidna) with a master passphrase — nothing is stored in plaintext.

## Features

- Log an episode: start/end time, pain intensity (1–10), symptoms and triggers, medication, notes
- History list, newest first — edit or delete any episode
- Calendar view, color-coded by pain intensity
- Stats: this month's count, average intensity, most common symptom, and a 12-week trend chart
- Export your data as a JSON file (for a doctor visit)
- Session key caching — unlock once per tab, no re-entry on refresh
- Bottom tab bar, built for one-handed phone use
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

## Architecture

| Layer         | Technology                                   |
| ------------- | -------------------------------------------- |
| Build         | Vite 5 + TypeScript                          |
| UI components | `@smugrobot/ui` (vault-ui Web Components)    |
| Encryption    | `echidna.js` (XSalsa20-Poly1305, scrypt KDF) |
| Storage       | IndexedDB via echidna.js adapter             |
| State         | Vanilla pub-sub store (`src/state/store.ts`) |

All data stays on-device. There is no backend, no sync, no account.

Pain intensity and symptom/trigger tags are stored **encrypted**, inside the
document body — not in echidna's plaintext metadata — since that data is
sensitive even to someone with access to the device's raw IndexedDB storage.
Only the episode's start time is kept as plaintext metadata, so the list can
sort without decrypting every entry.
