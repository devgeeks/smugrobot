import type { StorageAdapter } from "../types"

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number)
  }
  return btoa(binary)
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function getStorage(): Storage {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("localStorage is not available in this environment")
  }
  return window.localStorage
}

export function localStorageAdapter(keyPrefix = "echidna:"): StorageAdapter {
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {})
  }

  return {
    async get(key: string): Promise<Uint8Array | null> {
      const value = getStorage().getItem(keyPrefix + key)
      return value !== null ? fromBase64(value) : null
    },
    async set(key: string, value: Uint8Array): Promise<void> {
      getStorage().setItem(keyPrefix + key, toBase64(value))
    },
    async delete(key: string): Promise<void> {
      getStorage().removeItem(keyPrefix + key)
    },
    async list(prefix = ""): Promise<string[]> {
      const storage = getStorage()
      const results: string[] = []
      for (let i = 0; i < storage.length; i++) {
        const storageKey = storage.key(i)
        if (storageKey?.startsWith(keyPrefix)) {
          const key = storageKey.slice(keyPrefix.length)
          if (key.startsWith(prefix)) results.push(key)
        }
      }
      return results
    },
  }
}
