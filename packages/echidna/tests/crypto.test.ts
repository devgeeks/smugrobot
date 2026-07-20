import { describe, it, expect } from "vitest";
import nacl from "tweetnacl";
import { encrypt, decrypt, decryptLegacyV1, generateSalt } from "../src/core/crypto";
import { EchidnaJsError } from "../src/types";
import { makeLegacyV1Blob } from "./helpers";

describe("crypto", () => {
  const key = nacl.randomBytes(32);
  const id = "doc-1";

  it("encrypt + decrypt round-trip returns original string", () => {
    const original = "Hello, echidna! 🦔";
    expect(decrypt(encrypt(original, key, id), key, id)).toBe(original);
  });

  it("decrypt with wrong key throws WRONG_KEY", () => {
    const blob = encrypt("secret", key, id);
    const wrongKey = nacl.randomBytes(32);
    expect(() => decrypt(blob, wrongKey, id)).toThrow(
      expect.objectContaining({ code: "WRONG_KEY" }),
    );
  });

  it("decrypt with truncated blob throws CORRUPT_BLOB", () => {
    const truncated = new Uint8Array(10);
    expect(() => decrypt(truncated, key, id)).toThrow(
      expect.objectContaining({ code: "CORRUPT_BLOB" }),
    );
  });

  it("each encrypt call produces a different blob (unique nonces)", () => {
    const text = "same input";
    const b1 = Buffer.from(encrypt(text, key, id)).toString("hex");
    const b2 = Buffer.from(encrypt(text, key, id)).toString("hex");
    expect(b1).not.toBe(b2);
  });

  it("version byte is 0x02", () => {
    const blob = encrypt("test", key, id);
    expect(blob[0]).toBe(0x02);
  });

  it("decrypt with a different aad throws TAMPERED (blob transplanted to another doc)", () => {
    // A blob authenticates cleanly under the key but was bound to "doc-1";
    // reading it as "doc-2" (e.g. a storage backend swapped the two bodies)
    // must fail loudly rather than return doc-1's plaintext.
    const blob = encrypt("secret body", key, "doc-1");
    expect(() => decrypt(blob, key, "doc-2")).toThrow(
      expect.objectContaining({ code: "TAMPERED" }),
    );
  });

  it("round-trips an empty aad and an empty plaintext", () => {
    expect(decrypt(encrypt("", key, ""), key, "")).toBe("");
  });

  it("round-trips a multibyte / unicode aad", () => {
    const weirdId = "文档/🦔/id";
    expect(decrypt(encrypt("body", key, weirdId), key, weirdId)).toBe("body");
  });

  it("decryptLegacyV1 round-trips a legacy 0x01 blob (no id binding)", () => {
    const blob = makeLegacyV1Blob("legacy body", key);
    expect(blob[0]).toBe(0x01);
    expect(decryptLegacyV1(blob, key)).toBe("legacy body");
  });

  it("main decrypt rejects a legacy 0x01 blob with NEEDS_MIGRATION", () => {
    const blob = makeLegacyV1Blob("legacy body", key);
    expect(() => decrypt(blob, key, id)).toThrow(
      expect.objectContaining({ code: "NEEDS_MIGRATION" }),
    );
  });

  it("decryptLegacyV1 throws WRONG_KEY under a different key", () => {
    const blob = makeLegacyV1Blob("legacy body", key);
    expect(() => decryptLegacyV1(blob, nacl.randomBytes(32))).toThrow(
      expect.objectContaining({ code: "WRONG_KEY" }),
    );
  });

  it("generateSalt returns 16 bytes", () => {
    expect(generateSalt()).toHaveLength(16);
  });

  it("throws EchidnaJsError (not generic Error) on wrong key", () => {
    const blob = encrypt("secret", key, id);
    expect(() => decrypt(blob, nacl.randomBytes(32), id)).toThrow(EchidnaJsError);
  });

  it("encrypt with wrong-length key throws INVALID_KEY", () => {
    expect(() => encrypt("test", nacl.randomBytes(16), id)).toThrow(
      expect.objectContaining({ code: "INVALID_KEY" }),
    );
  });

  it("decrypt with wrong-length key throws INVALID_KEY", () => {
    const blob = encrypt("test", key, id);
    expect(() => decrypt(blob, nacl.randomBytes(16), id)).toThrow(
      expect.objectContaining({ code: "INVALID_KEY" }),
    );
  });
});
