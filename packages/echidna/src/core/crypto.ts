import nacl from "tweetnacl"
import { EchidnaJsError } from "../types"

// Blob format version. 0x02 binds the document id into the authenticated
// plaintext (see below). 0x01 omitted that binding; ordinary reads reject it
// (surfaced as NEEDS_MIGRATION), and it is only decryptable via the migration
// path (see decryptLegacyV1).
const VERSION = 0x02
const LEGACY_VERSION = 0x01
const AAD_LENGTH_BYTES = 4
const MIN_BLOB_LENGTH = 1 + nacl.secretbox.nonceLength + nacl.secretbox.overheadLength

/**
 * Returns the format version byte of a blob.
 *
 * @throws {EchidnaJsError} `CORRUPT_BLOB` if the blob is empty.
 */
export function blobVersion(blob: Uint8Array): number {
  if (blob.length === 0) {
    throw new EchidnaJsError("Blob is empty", "CORRUPT_BLOB")
  }
  return blob[0] as number
}

/** Generates a random 16-byte salt for use with KDF at vault creation. */
export function generateSalt(): Uint8Array {
  return nacl.randomBytes(16)
}

/** Generates a random 24-byte nonce for use with a single `nacl.secretbox` call. */
function generateNonce(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.nonceLength)
}

/**
 * Builds the authenticated message `[uint32BE(aadLen)][aad][plaintext]`.
 *
 * `nacl.secretbox` has no associated-data parameter, so the only way to bind
 * extra context (the document id) to a ciphertext is to include it inside the
 * MAC-protected message and verify it on the way out. This is what makes a
 * blob non-transplantable: a body moved to (or relabelled as) another document
 * carries the original id and fails {@link decrypt}'s check.
 */
function frameMessage(aadBytes: Uint8Array, plaintextBytes: Uint8Array): Uint8Array {
  const message = new Uint8Array(AAD_LENGTH_BYTES + aadBytes.length + plaintextBytes.length)
  new DataView(message.buffer).setUint32(0, aadBytes.length, false)
  message.set(aadBytes, AAD_LENGTH_BYTES)
  message.set(plaintextBytes, AAD_LENGTH_BYTES + aadBytes.length)
  return message
}

/**
 * Encrypts a plaintext string using XSalsa20-Poly1305, binding `aad` (the
 * document id) into the authenticated message.
 *
 * @param plaintext - The UTF-8 string to encrypt.
 * @param key - A 32-byte encryption key.
 * @param aad - Additional authenticated data (the document id) bound to this
 *   blob. {@link decrypt} must be given the same value or it throws `TAMPERED`.
 * @returns A blob with the layout: `[0x02][nonce: 24 bytes][ciphertext: N bytes]`,
 *   where the ciphertext authenticates `[uint32BE(aadLen)][aad][plaintext]`.
 * @throws {EchidnaJsError} `INVALID_KEY` if the key is not 32 bytes.
 */
export function encrypt(plaintext: string, key: Uint8Array, aad: string): Uint8Array {
  if (key.length !== nacl.secretbox.keyLength) {
    throw new EchidnaJsError(
      `Key must be ${nacl.secretbox.keyLength} bytes, got ${key.length}`,
      "INVALID_KEY",
    )
  }
  const nonce = generateNonce()
  const encoder = new TextEncoder()
  const message = frameMessage(encoder.encode(aad), encoder.encode(plaintext))
  const ciphertext = nacl.secretbox(message, nonce, key)
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
 * @param aad - The additional authenticated data (document id) the caller
 *   expects this blob to be bound to.
 * @returns The original plaintext string.
 * @throws {EchidnaJsError} `INVALID_KEY` if the key is not 32 bytes.
 * @throws {EchidnaJsError} `NEEDS_MIGRATION` if the blob is a legacy `0x01`
 *   blob — run `store.migrate()` to upgrade it (see {@link decryptLegacyV1}).
 * @throws {EchidnaJsError} `CORRUPT_BLOB` if the blob is too short, has an
 *   unknown version byte, or has a malformed authenticated message.
 * @throws {EchidnaJsError} `WRONG_KEY` if decryption fails (wrong key or corrupted ciphertext).
 * @throws {EchidnaJsError} `TAMPERED` if the blob authenticates cleanly but is
 *   bound to a different `aad` — i.e. it was substituted from another document.
 */
export function decrypt(blob: Uint8Array, key: Uint8Array, aad: string): string {
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
  if (versionByte === LEGACY_VERSION) {
    throw new EchidnaJsError(
      "Legacy 0x01 blob predates document-id binding; run store.migrate() to upgrade it",
      "NEEDS_MIGRATION",
    )
  }
  if (versionByte !== VERSION) {
    throw new EchidnaJsError(`Unknown version byte: ${versionByte}`, "CORRUPT_BLOB")
  }
  const nonce = blob.slice(1, 1 + nacl.secretbox.nonceLength)
  const ciphertext = blob.slice(1 + nacl.secretbox.nonceLength)
  const message = nacl.secretbox.open(ciphertext, nonce, key)
  if (message === null) {
    throw new EchidnaJsError("Decryption failed: wrong key or corrupted data", "WRONG_KEY")
  }
  if (message.byteLength < AAD_LENGTH_BYTES) {
    throw new EchidnaJsError("Authenticated message is truncated", "CORRUPT_BLOB")
  }
  const aadLength = new DataView(
    message.buffer,
    message.byteOffset,
    message.byteLength,
  ).getUint32(0, false)
  if (AAD_LENGTH_BYTES + aadLength > message.byteLength) {
    throw new EchidnaJsError("Authenticated message has an invalid aad length", "CORRUPT_BLOB")
  }
  const decoder = new TextDecoder()
  const embeddedAad = decoder.decode(message.subarray(AAD_LENGTH_BYTES, AAD_LENGTH_BYTES + aadLength))
  if (embeddedAad !== aad) {
    throw new EchidnaJsError(
      `Body is bound to a different document (expected "${aad}", found "${embeddedAad}")`,
      "TAMPERED",
    )
  }
  return decoder.decode(message.subarray(AAD_LENGTH_BYTES + aadLength))
}

/**
 * Decrypts a legacy `0x01` blob, whose ciphertext is `nacl.secretbox` over the
 * bare plaintext with no document-id binding.
 *
 * This exists solely so `store.migrate()` can read pre-`0x02` bodies and
 * re-encrypt them with the id binding. Ordinary reads must go through
 * {@link decrypt}, which rejects `0x01`; do not use this to serve reads, or the
 * integrity guarantee the `0x02` format provides is lost.
 *
 * @param blob - A legacy blob: `[0x01][nonce: 24 bytes][ciphertext]`.
 * @param key - The 32-byte vault key (unchanged across format versions).
 * @returns The original plaintext string.
 * @throws {EchidnaJsError} `INVALID_KEY` if the key is not 32 bytes.
 * @throws {EchidnaJsError} `CORRUPT_BLOB` if the blob is too short or is not `0x01`.
 * @throws {EchidnaJsError} `WRONG_KEY` if decryption fails (wrong key or corrupted ciphertext).
 */
export function decryptLegacyV1(blob: Uint8Array, key: Uint8Array): string {
  if (key.length !== nacl.secretbox.keyLength) {
    throw new EchidnaJsError(
      `Key must be ${nacl.secretbox.keyLength} bytes, got ${key.length}`,
      "INVALID_KEY",
    )
  }
  if (blob.length < MIN_BLOB_LENGTH) {
    throw new EchidnaJsError("Blob too short to be valid", "CORRUPT_BLOB")
  }
  if (blob[0] !== LEGACY_VERSION) {
    throw new EchidnaJsError(`Not a legacy 0x01 blob: version ${blob[0]}`, "CORRUPT_BLOB")
  }
  const nonce = blob.slice(1, 1 + nacl.secretbox.nonceLength)
  const ciphertext = blob.slice(1 + nacl.secretbox.nonceLength)
  const plaintext = nacl.secretbox.open(ciphertext, nonce, key)
  if (plaintext === null) {
    throw new EchidnaJsError("Decryption failed: wrong key or corrupted data", "WRONG_KEY")
  }
  return new TextDecoder().decode(plaintext)
}
