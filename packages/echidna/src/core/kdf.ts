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

// Bounds for KDF params read from untrusted storage (`vault/kdf`). These are
// deliberately generous multiples of the defaults above — not a policy on
// "acceptable" security levels — but they cap worst-case scrypt memory/time
// and PBKDF2 iteration count to a small constant multiple of today's
// defaults instead of leaving them unbounded.
const MIN_SCRYPT_N = 2;
const MAX_SCRYPT_N = 1 << 20; // 1,048,576 — 8x the OWASP-recommended default
const MAX_SCRYPT_R = 16; // 2x the default
const MAX_SCRYPT_P = 16; // 16x the default
const MAX_PBKDF2_ITERATIONS = 2_000_000; // ~3x the OWASP-recommended default

function isPowerOfTwo(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

function isBoundedInt(n: unknown, min: number, max: number): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
}

/**
 * Validates the shape and bounds of {@link KdfParams} before they are used
 * to derive a key.
 *
 * `vault/kdf` is plaintext, unauthenticated storage, so a corrupted or
 * hostile backend can return arbitrary JSON here. Without this check, a
 * huge `N`/`p`/`iterations` would hang or OOM the caller, and a
 * non-power-of-two `N` would crash inside `scrypt-js` — both only after
 * expensive work had already started. This rejects all of that up front.
 *
 * @throws {EchidnaJsError} `INVALID_KDF_PARAMS` if `params` has an unknown
 *   `algo` or any field is missing, malformed, or out of bounds.
 */
function validateKdfParams(params: KdfParams): void {
  if (params === null || typeof params !== "object") {
    throw new EchidnaJsError("KDF params must be an object", "INVALID_KDF_PARAMS");
  }
  if (params.algo === "scrypt") {
    if (!isPowerOfTwo(params.N) || params.N < MIN_SCRYPT_N || params.N > MAX_SCRYPT_N) {
      throw new EchidnaJsError(
        `scrypt N must be a power of two in [${MIN_SCRYPT_N}, ${MAX_SCRYPT_N}], got ${params.N}`,
        "INVALID_KDF_PARAMS",
      );
    }
    if (!isBoundedInt(params.r, 1, MAX_SCRYPT_R)) {
      throw new EchidnaJsError(
        `scrypt r must be an integer in [1, ${MAX_SCRYPT_R}], got ${params.r}`,
        "INVALID_KDF_PARAMS",
      );
    }
    if (!isBoundedInt(params.p, 1, MAX_SCRYPT_P)) {
      throw new EchidnaJsError(
        `scrypt p must be an integer in [1, ${MAX_SCRYPT_P}], got ${params.p}`,
        "INVALID_KDF_PARAMS",
      );
    }
  } else if (params.algo === "pbkdf2") {
    if (!isBoundedInt(params.iterations, 1, MAX_PBKDF2_ITERATIONS)) {
      throw new EchidnaJsError(
        `pbkdf2 iterations must be an integer in [1, ${MAX_PBKDF2_ITERATIONS}], got ${params.iterations}`,
        "INVALID_KDF_PARAMS",
      );
    }
    if (params.hash !== "SHA-256") {
      throw new EchidnaJsError(
        `Unsupported pbkdf2 hash: ${String(params.hash)}`,
        "INVALID_KDF_PARAMS",
      );
    }
  } else {
    throw new EchidnaJsError(
      `Unknown KDF algorithm: ${String((params as { algo?: unknown }).algo)}`,
      "INVALID_KDF_PARAMS",
    );
  }
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
 * @throws {EchidnaJsError} `INVALID_KDF_PARAMS` if `params` is malformed or
 *   out of the allowed bounds (see {@link validateKdfParams}); `KDF_FAILED`
 *   if key derivation throws an unexpected error.
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  params: KdfParams,
): Promise<Uint8Array> {
  validateKdfParams(params);
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
