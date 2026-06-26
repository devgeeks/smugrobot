import { indexedDbAdapter } from 'echidna.js/adapters/indexeddb'
import { createEncryptedStore } from 'echidna.js'
import type { StorageAdapter } from 'echidna.js'

// Sentinel doc written on vault creation; reading it verifies the key on unlock
const SENTINEL_ID = '__vault_sentinel__'

export async function detectVault(): Promise<{ adapter: StorageAdapter; exists: boolean }> {
  const adapter = await indexedDbAdapter('smugrobot-notes', 'vault')
  const salt = await adapter.get('vault/salt')
  return { adapter, exists: salt !== null }
}

export async function createVault(adapter: StorageAdapter, passphrase: string) {
  const store = await createEncryptedStore({
    adapter,
    keySource: { type: 'passphrase', passphrase },
  })
  await store.set(SENTINEL_ID, 'ok', { title: '__sentinel__', type: '__sentinel__' })
  return store
}

export async function openVault(adapter: StorageAdapter, passphrase: string) {
  const store = await createEncryptedStore({
    adapter,
    keySource: { type: 'passphrase', passphrase },
  })
  // Attempt decryption of sentinel to verify the key.
  // Returns null if sentinel not present (old vault); throws WRONG_KEY if bad passphrase.
  await store.get(SENTINEL_ID)
  return store
}
