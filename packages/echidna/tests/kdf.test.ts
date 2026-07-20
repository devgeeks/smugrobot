import { describe, it, expect } from "vitest";
import { deriveKey } from "../src/core/kdf";
import { generateSalt } from "../src/core/crypto";

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
});
