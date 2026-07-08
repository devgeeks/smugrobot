import { createEncryptedStore } from 'echidna.js'
import type { BenchConfig, BenchEvent } from '../state/types.js'
import { buildAdapter } from './adapters.js'
import { generatePayload } from './generators.js'
import { summarize, formatSizeLabel } from './stats.js'

const TEST_PASSPHRASE = 'echidna-bench-passphrase'

// All of `store.set`/`get` on the memory adapter resolve as microtasks with no
// macrotask boundary in between, so the browser never gets a chance to paint —
// the "loading" button state would otherwise never render until the whole run
// finishes. requestAnimationFrame forces a real yield back to the event loop.
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

export async function* runBenchmark(config: BenchConfig): AsyncGenerator<BenchEvent> {
  await yieldToBrowser()

  const adapter = await buildAdapter(config.adapter)

  const keySource =
    config.keySource === 'raw'
      ? { type: 'raw' as const, key: crypto.getRandomValues(new Uint8Array(32)) }
      : { type: 'passphrase' as const, passphrase: TEST_PASSPHRASE }

  const kdfStart = performance.now()
  const store = await createEncryptedStore({ adapter, keySource })
  const kdfDurationMs = performance.now() - kdfStart

  if (config.keySource === 'passphrase') {
    yield { type: 'kdf', result: { keySource: 'passphrase (scrypt)', durationMs: kdfDurationMs } }
  }

  let docCounter = 0

  for (const dataType of config.dataTypes) {
    for (const sizeBytes of config.sizes) {
      const encryptDurations: number[] = []
      const decryptDurations: number[] = []

      for (let i = 0; i < config.iterations; i++) {
        const id = `bench-${docCounter++}`
        const payload = generatePayload(dataType, sizeBytes)

        const setStart = performance.now()
        await store.set(id, payload, { title: id })
        encryptDurations.push(performance.now() - setStart)

        const getStart = performance.now()
        await store.get(id)
        decryptDurations.push(performance.now() - getStart)

        await store.delete(id)
      }

      yield {
        type: 'result',
        result: {
          dataType,
          sizeLabel: formatSizeLabel(sizeBytes),
          sizeBytes,
          encrypt: summarize(encryptDurations, sizeBytes),
          decrypt: summarize(decryptDurations, sizeBytes),
        },
      }

      // Let the browser paint the newly added result row between (dataType, size)
      // pairs — same reasoning as the yield above.
      await yieldToBrowser()
    }
  }
}
