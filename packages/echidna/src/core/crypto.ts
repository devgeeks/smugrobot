import nacl from "tweetnacl"
import { EchidnaJsError } from "../types"

const VERSION = 0x01
const MIN_BLOB_LENGTH = 1 + nacl.secretbox.nonceLength + nacl.secretbox.overheadLength

/** Generates a random 16-byte salt for use with KDF at vault creation. */
export function generateSalt(): Uint8Array {
  return nacl.randomBytes(16)
}

/** Generates a random 24-byte nonce for use with a single `nacl.secretbox` call. */
export function generateNonce(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.nonceLength)
}

/**
 * Encrypts a plaintext string using XSalsa20-Poly1305.
 *
 * @param plaintext - The UTF-8 string to encrypt.
 * @param key - A 32-byte encryption key.
 * @returns A blob with the layout: `[0x01][nonce: 24 bytes][ciphertext: N bytes]`.
 * @throws {EchidnaJsError} `INVALID_KEY` if the key is not 32 bytes.
 */
export function encrypt(plaintext: string, key: Uint8Array): Uint8Array {
  if (key.length !== nacl.secretbox.keyLength) {
    throw new EchidnaJsError(
      `Key must be ${nacl.secretbox.keyLength} bytes, got ${key.length}`,
      "INVALID_KEY",
    )
  }
  const nonce = generateNonce()
  const plaintextBytes = new TextEncoder().encode(plaintext)
  const ciphertext = nacl.secretbox(plaintextBytes, nonce, key)
  const blob = new Uint8Array(1 + nonce.length + ciphertext.length)
  blob[0] = VERSION
  blob.set(nonce, 1)
  blob.set(ciphertext, 1 + nonce.length)
  return blob
}

/**
 * Decrypts a blob produced by {@link encrypt}.
 *
 * @param blob - The encrypted blob: `[version][nonce: 24 bytes][ciphertext]`.
 * @param key - The 32-byte key used during encryption.
 * @returns The original plaintext string.
 * @throws {EchidnaJsError} `INVALID_KEY` if the key is not 32 bytes.
 * @throws {EchidnaJsError} `CORRUPT_BLOB` if the blob is too short or has an unknown version byte.
 * @throws {EchidnaJsError} `WRONG_KEY` if decryption fails (wrong key or corrupted ciphertext).
 */
export function decrypt(blob: Uint8Array, key: Uint8Array): string {
  if (key.length !== nacl.secretbox.keyLength) {
    throw new EchidnaJsError(
      `Key must be ${nacl.secretbox.keyLength} bytes, got ${key.length}`,
      "INVALID_KEY",
    )
  }
  if (blob.length < MIN_BLOB_LENGTH) {
    throw new EchidnaJsError("Blob too short to be valid", "CORRUPT_BLOB")
  }
  const versionByte = blob[0]
  if (versionByte !== VERSION) {
    throw new EchidnaJsError(`Unknown version byte: ${versionByte}`, "CORRUPT_BLOB")
  }
  const nonce = blob.slice(1, 1 + nacl.secretbox.nonceLength)
  const ciphertext = blob.slice(1 + nacl.secretbox.nonceLength)
  const plaintext = nacl.secretbox.open(ciphertext, nonce, key)
  if (plaintext === null) {
    throw new EchidnaJsError("Decryption failed: wrong key or corrupted data", "WRONG_KEY")
  }
  return new TextDecoder().decode(plaintext)
}
