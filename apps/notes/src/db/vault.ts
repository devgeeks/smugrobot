import { indexedDbAdapter } from 'echidna.js/adapters/indexeddb'
import { createEncryptedStore, EchidnaJsError } from 'echidna.js'
import type { StorageAdapter } from 'echidna.js'
import { scrypt } from 'scrypt-js'

const SENTINEL_ID = '__vault_sentinel__'
const SESSION_KEY = 'notes-vault-key'

// ── Session key helpers ──────────────────────────────────────────────────────

export function saveKeyToSession(key: Uint8Array): void {
  sessionStorage.setItem(SESSION_KEY, btoa(String.fromCharCode(...key)))
}

export function loadKeyFromSession(): Uint8Array | null {
  const stored = sessionStorage.getItem(SESSION_KEY)
  if (!stored) return null
  try {
    return new Uint8Array(atob(stored).split('').map((c) => c.charCodeAt(0)))
  } catch {
    return null
  }
}

export function clearSessionKey(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

// ── Key derivation ───────────────────────────────────────────────────────────

interface ScryptParams { algo: 'scrypt'; N: number; r: number; p: number }
interface Pbkdf2Params { algo: 'pbkdf2'; iterations: number; hash: string }
type KdfParams = ScryptParams | Pbkdf2Params

async function readVaultKdf(
  adapter: StorageAdapter,
): Promise<{ salt: Uint8Array; params: KdfParams } | null> {
  const salt = await adapter.get('vault/salt')
  if (!salt) return null
  const kdfBytes = await adapter.get('vault/kdf')
  if (!kdfBytes) return null
  const params = JSON.parse(new TextDecoder().decode(kdfBytes)) as KdfParams
  return { salt, params }
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  params: KdfParams,
  onProgress?: (p: number) => void,
): Promise<Uint8Array> {
  const passBytes = new TextEncoder().encode(passphrase)
  if (params.algo === 'scrypt') {
    // scrypt-js public API calls progressCallback(progress) with one arg
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return scrypt(passBytes, salt, params.N, params.r, params.p, 32, ((progress: number) => {
      onProgress?.(progress)
    }) as any)
  }
  const cryptoKey = await crypto.subtle.importKey('raw', passBytes, 'PBKDF2', false, ['deriveBits'])
  // PBKDF2 requires a plain ArrayBuffer-backed Uint8Array; slice() ensures that
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.slice(), iterations: params.iterations, hash: params.hash },
    cryptoKey,
    256,
  )
  return new Uint8Array(bits)
}

// ── Public API ───────────────────────────────────────────────────────────────

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

/** Derive the key, open the vault, verify sentinel. Returns key bytes for sessionStorage. */
export async function openVault(
  adapter: StorageAdapter,
  passphrase: string,
  onProgress?: (p: number) => void,
): Promise<{ store: Awaited<ReturnType<typeof createEncryptedStore>>; key: Uint8Array }> {
  const kdf = await readVaultKdf(adapter)
  if (!kdf) throw new Error('Vault not found')

  const key = await deriveKey(passphrase, kdf.salt, kdf.params, onProgress)

  const store = await createEncryptedStore({
    adapter,
    keySource: { type: 'raw', key },
  })

  // Verify the key — throws EchidnaJsError('WRONG_KEY') if bad passphrase
  await store.get(SENTINEL_ID)

  return { store, key }
}

/** Resume a session from a cached key — no KDF, instant. */
export async function openVaultFromKey(adapter: StorageAdapter, key: Uint8Array) {
  const store = await createEncryptedStore({
    adapter,
    keySource: { type: 'raw', key },
  })
  // Verify the key is still valid (vault may have been recreated)
  try {
    await store.get(SENTINEL_ID)
  } catch (err) {
    if (err instanceof EchidnaJsError && err.code === 'WRONG_KEY') {
      clearSessionKey()
      throw err
    }
    // SENTINEL_ID not found (null return) — old vault, proceed anyway
  }
  return store
}
