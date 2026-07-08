const WORDS = [
  'cipher', 'vault', 'nonce', 'salt', 'entropy', 'key', 'scrypt', 'bitwise',
  'blob', 'byte', 'stream', 'token', 'secret', 'digest', 'protocol', 'layer',
  'packet', 'buffer', 'session', 'handshake', 'roundtrip', 'latency', 'archive',
  'index', 'shard', 'replica', 'checksum', 'payload', 'header', 'footer',
]

function randomWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)]!
}

export function makeJsonBlob(targetBytes: number): string {
  const records: Array<{ id: number; label: string; value: number; tags: string[] }> = []
  let id = 0
  // Track the running serialized length incrementally (each record's own stringify
  // plus a comma separator) instead of re-stringifying the whole growing array on
  // every push — that was O(n^2) and took minutes at 10MB (~150k records).
  let approxLength = 2 // '[' + ']'

  while (approxLength < targetBytes) {
    const record = {
      id: id++,
      label: `${randomWord()}-${randomWord()}`,
      value: Math.random(),
      tags: [randomWord(), randomWord()],
    }
    records.push(record)
    approxLength += JSON.stringify(record).length + 1 // +1 for the joining comma
  }

  let json = JSON.stringify(records)
  if (json.length > targetBytes) {
    // Trim the last record's label so the final length is exact.
    const overshoot = json.length - targetBytes
    const last = records[records.length - 1]!
    last.label = last.label.slice(0, Math.max(0, last.label.length - overshoot))
    json = JSON.stringify(records)
  }

  return json
}

export function makeTextDocument(targetBytes: number): string {
  const parts: string[] = []
  let length = 0
  while (length < targetBytes) {
    const sentence = Array.from({ length: 8 + Math.floor(Math.random() * 8) }, randomWord).join(' ') + '. '
    parts.push(sentence)
    length += sentence.length
  }
  return parts.join('').slice(0, targetBytes)
}

// Must be a multiple of 3 — btoa() pads each call independently, so a chunk size
// that isn't a multiple of 3 inserts "=" padding in the middle of the joined
// base64 string, which atob() then rejects as invalid on decode.
const BASE64_CHUNK_BYTES = 3 * 10_922 // ~32 KB, divisible by 3
// crypto.getRandomValues rejects requests over 65536 bytes in browsers.
const RANDOM_FILL_CHUNK_BYTES = 65_536
// String.fromCharCode.apply is bound by the JS engine's max call-argument count;
// 8192 stays well under it while avoiding a per-byte `+=` loop (which is O(n) with
// a very high constant factor — measured minutes-long at 10MB before this fix).
const BINARY_STRING_CHUNK_BYTES = 8_192

function bytesToBinaryString(bytes: Uint8Array): string {
  const parts: string[] = []
  for (let offset = 0; offset < bytes.length; offset += BINARY_STRING_CHUNK_BYTES) {
    const slice = bytes.subarray(offset, offset + BINARY_STRING_CHUNK_BYTES)
    parts.push(String.fromCharCode.apply(null, slice as unknown as number[]))
  }
  return parts.join('')
}

export function makeRawImageBytes(targetBytes: number): Uint8Array {
  const raw = new Uint8Array(targetBytes)
  for (let offset = 0; offset < raw.length; offset += RANDOM_FILL_CHUNK_BYTES) {
    crypto.getRandomValues(raw.subarray(offset, offset + RANDOM_FILL_CHUNK_BYTES))
  }
  return raw
}

export function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = []
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_BYTES)
    chunks.push(btoa(bytesToBinaryString(chunk)))
  }
  return chunks.join('')
}

export function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * A prepared payload separates untimed test-data setup from the conversions a
 * real app actually pays for on every read/write. `encode`/`decode` are timed
 * as part of encrypt/decrypt in the benchmark engine:
 *  - JSON/text bodies are already strings — echidna.js stores them as-is, so
 *    there's no conversion cost to measure.
 *  - Images are raw bytes — any app storing them via echidna.js's string-only
 *    `set`/`get` API must base64-encode before writing and decode after
 *    reading, so that conversion is a real cost and belongs in the timing.
 */
export interface PreparedPayload {
  encode(): string
  decode(body: string): void
}

export function preparePayload(dataType: 'json' | 'text' | 'image', targetBytes: number): PreparedPayload {
  switch (dataType) {
    case 'json': {
      const json = makeJsonBlob(targetBytes)
      return { encode: () => json, decode: () => {} }
    }
    case 'text': {
      const text = makeTextDocument(targetBytes)
      return { encode: () => text, decode: () => {} }
    }
    case 'image': {
      const bytes = makeRawImageBytes(targetBytes)
      return {
        encode: () => encodeBase64(bytes),
        decode: (body: string) => {
          decodeBase64ToBytes(body)
        },
      }
    }
  }
}
