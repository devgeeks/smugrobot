import nacl from "tweetnacl";

const LEGACY_VERSION = 0x01;

/**
 * Builds a legacy `0x01` body blob exactly as echidna ≤ 0.1.0 wrote them:
 * `[0x01][nonce(24)][nacl.secretbox(plaintext, nonce, key)]`, with no
 * document-id binding. Used to exercise the migration path without shipping a
 * legacy encrypt in production code.
 */
export function makeLegacyV1Blob(plaintext: string, key: Uint8Array): Uint8Array {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(new TextEncoder().encode(plaintext), nonce, key);
  const blob = new Uint8Array(1 + nonce.length + ciphertext.length);
  blob[0] = LEGACY_VERSION;
  blob.set(nonce, 1);
  blob.set(ciphertext, 1 + nonce.length);
  return blob;
}
