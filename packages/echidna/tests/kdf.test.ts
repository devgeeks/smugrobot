import { describe, it, expect } from "vitest";
import { deriveKey } from "../src/core/kdf";
import { generateSalt } from "../src/core/crypto";
import { EchidnaJsError } from "../src/types";

// Low N so tests run fast — not for production use
const FAST_SCRYPT = { algo: "scrypt" as const, N: 1024, r: 8, p: 1 };
const FAST_PBKDF2 = { algo: "pbkdf2" as const, iterations: 1000, hash: "SHA-256" as const };

describe("kdf", () => {
  const passphrase = "test-passphrase";
  const salt = generateSalt();

  it("scrypt derives a 32-byte key deterministically", async () => {
    const key1 = await deriveKey(passphrase, salt, FAST_SCRYPT);
    const key2 = await deriveKey(passphrase, salt, FAST_SCRYPT);
    expect(key1).toHaveLength(32);
    expect(Buffer.from(key1).toString("hex")).toBe(Buffer.from(key2).toString("hex"));
  });

  it("pbkdf2 derives a 32-byte key deterministically", async () => {
    const key1 = await deriveKey(passphrase, salt, FAST_PBKDF2);
    const key2 = await deriveKey(passphrase, salt, FAST_PBKDF2);
    expect(key1).toHaveLength(32);
    expect(Buffer.from(key1).toString("hex")).toBe(Buffer.from(key2).toString("hex"));
  });

  it("different salts produce different keys", async () => {
    const key1 = await deriveKey(passphrase, salt, FAST_SCRYPT);
    const key2 = await deriveKey(passphrase, generateSalt(), FAST_SCRYPT);
    expect(Buffer.from(key1).toString("hex")).not.toBe(Buffer.from(key2).toString("hex"));
  });

  it("different passphrases produce different keys", async () => {
    const key1 = await deriveKey("passphrase-a", salt, FAST_SCRYPT);
    const key2 = await deriveKey("passphrase-b", salt, FAST_SCRYPT);
    expect(Buffer.from(key1).toString("hex")).not.toBe(Buffer.from(key2).toString("hex"));
  });

  describe("param validation (params may come from untrusted storage)", () => {
    async function expectInvalid(params: unknown) {
      expect.assertions(2);
      try {
        await deriveKey(passphrase, salt, params as never);
      } catch (e) {
        expect(e).toBeInstanceOf(EchidnaJsError);
        expect((e as EchidnaJsError).code).toBe("INVALID_KDF_PARAMS");
      }
    }

    it("rejects a non-power-of-two scrypt N", () =>
      expectInvalid({ algo: "scrypt", N: 1000, r: 8, p: 1 }));

    it("rejects a scrypt N above the cap", () =>
      expectInvalid({ algo: "scrypt", N: 1 << 21, r: 8, p: 1 }));

    it("rejects a scrypt r above the cap", () =>
      expectInvalid({ algo: "scrypt", N: 1024, r: 17, p: 1 }));

    it("rejects a scrypt p above the cap", () =>
      expectInvalid({ algo: "scrypt", N: 1024, r: 8, p: 17 }));

    it("rejects a non-integer scrypt r", () =>
      expectInvalid({ algo: "scrypt", N: 1024, r: 8.5, p: 1 }));

    it("rejects pbkdf2 iterations above the cap", () =>
      expectInvalid({ algo: "pbkdf2", iterations: 2_000_001, hash: "SHA-256" }));

    it("rejects zero/negative pbkdf2 iterations", () =>
      expectInvalid({ algo: "pbkdf2", iterations: 0, hash: "SHA-256" }));

    it("rejects an unsupported pbkdf2 hash", () =>
      expectInvalid({ algo: "pbkdf2", iterations: 1000, hash: "MD5" }));

    it("rejects an unknown algo", () => expectInvalid({ algo: "bcrypt" }));

    it("rejects non-object params", () => expectInvalid(null));

    it("still accepts the shipped defaults and the fast test params", async () => {
      await expect(deriveKey(passphrase, salt, FAST_SCRYPT)).resolves.toHaveLength(32);
      await expect(deriveKey(passphrase, salt, FAST_PBKDF2)).resolves.toHaveLength(32);
    });
  });
});
