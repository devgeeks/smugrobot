import { scrypt } from "scrypt-js";
import { EchidnaJsError } from "../types";
import type { KdfAlgo, KdfParams, ScryptParams, Pbkdf2Params } from "../types";

/** Default scrypt parameters. `N=131072` (2^17) is OWASP's minimum recommendation as of 2023. */
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = {
  algo: "scrypt",
  N: 131072,
  r: 8,
  p: 1,
};

/** Default PBKDF2 parameters. `600_000` iterations matches OWASP's 2023 recommendation for SHA-256. */
export const DEFAULT_PBKDF2_PARAMS: Pbkdf2Params = {
  algo: "pbkdf2",
  iterations: 600_000,
  hash: "SHA-256",
};

/**
 * Returns the default {@link KdfParams} for the given algorithm.
 *
 * @param algo - `"scrypt"` (default) or `"pbkdf2"`.
 */
export function defaultKdfParams(algo: KdfAlgo = "scrypt"): KdfParams {
  return algo === "scrypt" ? DEFAULT_SCRYPT_PARAMS : DEFAULT_PBKDF2_PARAMS;
}

/**
 * Resolves a `SubtleCrypto` instance across environments.
 * Uses `globalThis.crypto.subtle` in browsers and modern Node.js (≥19),
 * and falls back to the `node:crypto` webcrypto shim for older Node versions.
 */
async function getSubtle(): Promise<SubtleCrypto> {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  const { webcrypto } = await import("node:crypto");
  return webcrypto.subtle as SubtleCrypto;
}

/**
 * Derives a 32-byte encryption key from a passphrase and salt using the specified KDF.
 *
 * The same passphrase, salt, and params always produce the same key, which is
 * what allows a vault to be reopened across sessions and devices.
 *
 * @param passphrase - The user-supplied passphrase (UTF-8).
 * @param salt - The vault's 16-byte random salt (stored plaintext at `vault/salt`).
 * @param params - KDF algorithm and parameters (stored plaintext at `vault/kdf`).
 * @returns A 32-byte `Uint8Array` suitable for use directly with `nacl.secretbox`.
 * @throws {EchidnaJsError} `KDF_FAILED` if key derivation throws an unexpected error.
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  params: KdfParams,
): Promise<Uint8Array> {
  try {
    if (params.algo === "scrypt") {
      const passwordBytes = new TextEncoder().encode(passphrase);
      return await scrypt(passwordBytes, salt, params.N, params.r, params.p, 32);
    } else {
      const subtle = await getSubtle();
      const keyMaterial = await subtle.importKey(
        "raw",
        new TextEncoder().encode(passphrase) as unknown as BufferSource,
        "PBKDF2",
        false,
        ["deriveBits"],
      );
      const bits = await subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: salt as unknown as BufferSource,
          iterations: params.iterations,
          hash: params.hash,
        },
        keyMaterial,
        256,
      );
      return new Uint8Array(bits);
    }
  } catch (e) {
    if (e instanceof EchidnaJsError) throw e;
    throw new EchidnaJsError(`Key derivation failed: ${String(e)}`, "KDF_FAILED");
  }
}
