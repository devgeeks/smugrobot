import { describe, it, expect } from "vitest"
import nacl from "tweetnacl"
import { encrypt, decrypt, generateSalt, generateNonce } from "../src/core/crypto"
import { EchidnaJsError } from "../src/types"

describe("crypto", () => {
  const key = nacl.randomBytes(32)

  it("encrypt + decrypt round-trip returns original string", () => {
    const original = "Hello, echidna! 🦔"
    expect(decrypt(encrypt(original, key), key)).toBe(original)
  })

  it("decrypt with wrong key throws WRONG_KEY", () => {
    const blob = encrypt("secret", key)
    const wrongKey = nacl.randomBytes(32)
    expect(() => decrypt(blob, wrongKey)).toThrow(
      expect.objectContaining({ code: "WRONG_KEY" }),
    )
  })

  it("decrypt with truncated blob throws CORRUPT_BLOB", () => {
    const truncated = new Uint8Array(10)
    expect(() => decrypt(truncated, key)).toThrow(
      expect.objectContaining({ code: "CORRUPT_BLOB" }),
    )
  })

  it("each encrypt call produces a different blob (unique nonces)", () => {
    const text = "same input"
    const b1 = Buffer.from(encrypt(text, key)).toString("hex")
    const b2 = Buffer.from(encrypt(text, key)).toString("hex")
    expect(b1).not.toBe(b2)
  })

  it("version byte is 0x01", () => {
    const blob = encrypt("test", key)
    expect(blob[0]).toBe(0x01)
  })

  it("generateSalt returns 16 bytes", () => {
    expect(generateSalt()).toHaveLength(16)
  })

  it("generateNonce returns 24 bytes", () => {
    expect(generateNonce()).toHaveLength(24)
  })

  it("throws EchidnaJsError (not generic Error) on wrong key", () => {
    const blob = encrypt("secret", key)
    expect(() => decrypt(blob, nacl.randomBytes(32))).toThrow(EchidnaJsError)
  })
})
