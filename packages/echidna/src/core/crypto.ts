import nacl from "tweetnacl"
import { EchidnaJsError } from "../types"

const VERSION = 0x01
const MIN_BLOB_LENGTH = 1 + nacl.secretbox.nonceLength + nacl.secretbox.overheadLength

export function generateSalt(): Uint8Array {
  return nacl.randomBytes(16)
}

export function generateNonce(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.nonceLength)
}

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
