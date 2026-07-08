import type { StorageAdapter } from 'echidna.js'
import { memoryAdapter } from 'echidna.js/adapters/memory'
import { indexedDbAdapter } from 'echidna.js/adapters/indexeddb'
import type { AdapterId } from '../state/types.js'

let indexeddbRunCount = 0

export async function buildAdapter(adapterId: AdapterId): Promise<StorageAdapter> {
  switch (adapterId) {
    case 'memory':
      return memoryAdapter()
    case 'indexeddb':
      // Unique db name per run avoids stale vault state (salt/kdf) from a previous run.
      return indexedDbAdapter(`echidna-bench-${Date.now()}-${indexeddbRunCount++}`, 'vault')
  }
}
