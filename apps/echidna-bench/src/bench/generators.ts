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

const BASE64_CHUNK_BYTES = 32 * 1024
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

export function makeImageBase64(targetBytes: number): string {
  const raw = new Uint8Array(targetBytes)
  for (let offset = 0; offset < raw.length; offset += RANDOM_FILL_CHUNK_BYTES) {
    crypto.getRandomValues(raw.subarray(offset, offset + RANDOM_FILL_CHUNK_BYTES))
  }

  const chunks: string[] = []
  for (let offset = 0; offset < raw.length; offset += BASE64_CHUNK_BYTES) {
    const chunk = raw.subarray(offset, offset + BASE64_CHUNK_BYTES)
    chunks.push(btoa(bytesToBinaryString(chunk)))
  }
  return chunks.join('')
}

export function generatePayload(dataType: 'json' | 'text' | 'image', targetBytes: number): string {
  switch (dataType) {
    case 'json':
      return makeJsonBlob(targetBytes)
    case 'text':
      return makeTextDocument(targetBytes)
    case 'image':
      return makeImageBase64(targetBytes)
  }
}
