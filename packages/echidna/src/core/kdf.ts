import { scrypt } from "scrypt-js"
import { EchidnaJsError } from "../types"
import type { KdfAlgo, KdfParams, ScryptParams, Pbkdf2Params } from "../types"

export const DEFAULT_SCRYPT_PARAMS: ScryptParams = {
  algo: "scrypt",
  N: 131072,
  r: 8,
  p: 1,
}

export const DEFAULT_PBKDF2_PARAMS: Pbkdf2Params = {
  algo: "pbkdf2",
  iterations: 600_000,
  hash: "SHA-256",
}

export function defaultKdfParams(algo: KdfAlgo = "scrypt"): KdfParams {
  return algo === "scrypt" ? DEFAULT_SCRYPT_PARAMS : DEFAULT_PBKDF2_PARAMS
}

async function getSubtle(): Promise<SubtleCrypto> {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle
  }
  const { webcrypto } = await import("node:crypto")
  return webcrypto.subtle as SubtleCrypto
}

export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  params: KdfParams,
): Promise<Uint8Array> {
  try {
    if (params.algo === "scrypt") {
      const passwordBytes = new TextEncoder().encode(passphrase)
      return await scrypt(passwordBytes, salt, params.N, params.r, params.p, 32)
    } else {
      const subtle = await getSubtle()
      const keyMaterial = await subtle.importKey(
        "raw",
        new TextEncoder().encode(passphrase) as unknown as BufferSource,
        "PBKDF2",
        false,
        ["deriveBits"],
      )
      const bits = await subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: salt as unknown as BufferSource,
          iterations: params.iterations,
          hash: params.hash,
        },
        keyMaterial,
        256,
      )
      return new Uint8Array(bits)
    }
  } catch (e) {
    if (e instanceof EchidnaJsError) throw e
    throw new EchidnaJsError(`Key derivation failed: ${String(e)}`, "KDF_FAILED")
  }
}
