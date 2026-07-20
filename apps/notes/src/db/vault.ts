import { indexedDbAdapter } from "echidna.js/adapters/indexeddb";
import { createEncryptedStore, EchidnaJsError } from "echidna.js";
import type { StorageAdapter } from "echidna.js";
import { scrypt } from "scrypt-js";

const SENTINEL_ID = "__vault_sentinel__";
const SESSION_KEY = "notes-vault-key";

// ── Session key helpers ──────────────────────────────────────────────────────

export function saveKeyToSession(key: Uint8Array): void {
  sessionStorage.setItem(SESSION_KEY, btoa(String.fromCharCode(...key)));
}

export function loadKeyFromSession(): Uint8Array | null {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try {
    return new Uint8Array(
      atob(stored)
        .split("")
        .map((c) => c.charCodeAt(0)),
    );
  } catch {
    return null;
  }
}

export function clearSessionKey(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// ── Key derivation ───────────────────────────────────────────────────────────

interface ScryptParams {
  algo: "scrypt";
  N: number;
  r: number;
  p: number;
}
interface Pbkdf2Params {
  algo: "pbkdf2";
  iterations: number;
  hash: string;
}
type KdfParams = ScryptParams | Pbkdf2Params;

async function readVaultKdf(
  adapter: StorageAdapter,
): Promise<{ salt: Uint8Array; params: KdfParams } | null> {
  const salt = await adapter.get("vault/salt");
  if (!salt) return null;
  const kdfBytes = await adapter.get("vault/kdf");
  if (!kdfBytes) return null;
  const params = JSON.parse(new TextDecoder().decode(kdfBytes)) as KdfParams;
  return { salt, params };
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  params: KdfParams,
  onProgress?: (p: number) => void,
): Promise<Uint8Array> {
  const passBytes = new TextEncoder().encode(passphrase);
  if (params.algo === "scrypt") {
    // scrypt-js public API calls progressCallback(progress) with one arg
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return scrypt(passBytes, salt, params.N, params.r, params.p, 32, ((progress: number) => {
      onProgress?.(progress);
    }) as any);
  }
  const cryptoKey = await crypto.subtle.importKey("raw", passBytes, "PBKDF2", false, [
    "deriveBits",
  ]);
  // PBKDF2 requires a plain ArrayBuffer-backed Uint8Array; slice() ensures that
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.slice(), iterations: params.iterations, hash: params.hash },
    cryptoKey,
    256,
  );
  return new Uint8Array(bits);
}

// ── Migration ────────────────────────────────────────────────────────────────

/**
 * Upgrade a legacy echidna 0.1.0 vault (0x01 bodies) to the 0.2.0 format in
 * place. No-op on an already-current vault (a single `vault/version` read).
 *
 * `store.migrate()` decrypts legacy bodies with the vault key, so it also
 * surfaces `EchidnaJsError('WRONG_KEY')` for a bad key — letting it double as
 * key verification on a legacy vault, where the sentinel read below would
 * otherwise throw `NEEDS_MIGRATION` regardless of key correctness.
 */
async function ensureMigrated(
  store: Awaited<ReturnType<typeof createEncryptedStore>>,
  onMigrateStart?: () => void,
): Promise<void> {
  if (await store.needsMigration()) {
    onMigrateStart?.();
    await store.migrate();
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function detectVault(): Promise<{ adapter: StorageAdapter; exists: boolean }> {
  const adapter = await indexedDbAdapter("smugrobot-notes", "vault");
  const salt = await adapter.get("vault/salt");
  return { adapter, exists: salt !== null };
}

/**
 * Creates a fresh vault, deriving the key locally (rather than handing the
 * passphrase to echidna's own `keySource: { type: 'passphrase' }` path) so
 * scrypt progress can be reported — mirroring the same manual salt/KDF
 * handling `openVault` below already does for the same reason.
 */
export async function createVault(
  adapter: StorageAdapter,
  passphrase: string,
  onProgress?: (p: number) => void,
) {
  const params: KdfParams = { algo: "scrypt", N: 131072, r: 8, p: 1 };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await adapter.set("vault/salt", salt);
  await adapter.set("vault/kdf", new TextEncoder().encode(JSON.stringify(params)));
  // Fresh vaults are born at the current on-disk format version (matches
  // what echidna's own createEncryptedStore writes for a brand-new vault).
  await adapter.set("vault/version", new TextEncoder().encode(JSON.stringify(2)));

  const key = await deriveKey(passphrase, salt, params, onProgress);

  const store = await createEncryptedStore({
    adapter,
    keySource: { type: "raw", key },
  });
  await store.set(SENTINEL_ID, "ok", { title: "__sentinel__", type: "__sentinel__" });
  return store;
}

/** Derive the key, open the vault, verify sentinel. Returns key bytes for sessionStorage. */
export async function openVault(
  adapter: StorageAdapter,
  passphrase: string,
  onProgress?: (p: number) => void,
  onMigrateStart?: () => void,
): Promise<{ store: Awaited<ReturnType<typeof createEncryptedStore>>; key: Uint8Array }> {
  const kdf = await readVaultKdf(adapter);
  if (!kdf) throw new Error("Vault not found");

  const key = await deriveKey(passphrase, kdf.salt, kdf.params, onProgress);

  const store = await createEncryptedStore({
    adapter,
    keySource: { type: "raw", key },
  });

  // Upgrade a legacy 0.1.0 vault before any body is read. On a legacy vault this
  // also verifies the key (throws WRONG_KEY on a bad passphrase); on a current
  // vault it is a no-op and the sentinel read below does the verification.
  await ensureMigrated(store, onMigrateStart);

  // Verify the key — throws EchidnaJsError('WRONG_KEY') if bad passphrase
  await store.get(SENTINEL_ID);

  return { store, key };
}

/** Resume a session from a cached key — no KDF, instant. */
export async function openVaultFromKey(adapter: StorageAdapter, key: Uint8Array) {
  const store = await createEncryptedStore({
    adapter,
    keySource: { type: "raw", key },
  });
  // Upgrade a legacy vault, then verify the key is still valid (the vault may
  // have been recreated). This resume path has no unlock UI, so migration runs
  // silently. A WRONG_KEY from either step means the cached key is stale.
  try {
    await ensureMigrated(store);
    await store.get(SENTINEL_ID);
  } catch (err) {
    if (err instanceof EchidnaJsError && err.code === "WRONG_KEY") {
      clearSessionKey();
      throw err;
    }
    // SENTINEL_ID not found (null return) — old vault, proceed anyway
  }
  return store;
}
