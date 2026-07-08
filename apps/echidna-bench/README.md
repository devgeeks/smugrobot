# echidna-bench

A browser-based benchmark tool for measuring [echidna.js](https://github.com/) encrypted-store throughput and latency.

It runs configurable encrypt/decrypt workloads against an `echidna.js` encrypted store and reports timing and throughput per data type and payload size.

## What it measures

For each combination of data type, payload size, and iteration count, the benchmark:

1. Generates a synthetic payload (untimed).
2. Times `encode` + `store.set` as "encrypt".
3. Times `store.get` + `decode` as "decrypt".
4. Deletes the document and repeats.

Results are summarized as mean/median duration and throughput (MB/s) per data type and size, and can be viewed as a table or chart.

Configurable options:

- **Data types**: `json`, `text`, `image`
  - JSON and text payloads are stored as-is (no conversion overhead).
  - Image payloads are raw bytes, so the timed encrypt/decrypt includes the base64 encode/decode a real app would pay for when storing binary data through echidna.js's string-only `set`/`get` API.
- **Sizes**: payload sizes in bytes to sweep over.
- **Adapter**: `memory` or `indexeddb` storage adapter.
- **Key source**: `raw` (random 256-bit key) or `passphrase` (scrypt-derived key — KDF time is reported separately).
- **Iterations**: number of repetitions per (data type, size) pair.

## Development

```sh
npm install
npm run dev
```

This starts a Vite dev server; open the printed local URL in a browser to configure and run benchmarks.

Other scripts:

```sh
npm run build      # typecheck + production build
npm run preview    # preview the production build
npm run typecheck  # typecheck only
```

## Structure

- `src/bench/engine.ts` — the async-generator benchmark loop that runs each config and yields results as it goes.
- `src/bench/adapters.ts` — builds the `echidna.js` storage adapter (`memory` or `indexeddb`) for a run.
- `src/bench/generators.ts` — synthetic payload generation and the base64 encode/decode helpers used for image timing.
- `src/bench/stats.ts` — summarizes raw duration samples into mean/median/throughput.
- `src/state/` — app state types and store.
- `src/screens/`, `src/components/` — UI (config panel, results table, results chart) built with `@smugrobot/ui`.
