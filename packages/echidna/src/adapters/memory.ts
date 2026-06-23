import type { StorageAdapter } from "../types"

export function memoryAdapter(): StorageAdapter {
  const store = new Map<string, Uint8Array>()
  return {
    async get(key: string): Promise<Uint8Array | null> {
      return store.get(key) ?? null
    },
    async set(key: string, value: Uint8Array): Promise<void> {
      store.set(key, value)
    },
    async delete(key: string): Promise<void> {
      store.delete(key)
    },
    async list(prefix = ""): Promise<string[]> {
      return [...store.keys()].filter((k) => k.startsWith(prefix))
    },
  }
}
