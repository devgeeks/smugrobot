import type { StorageAdapter } from "../types"

function openDB(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(storeName)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode)
    const req = fn(t.objectStore(storeName))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function indexedDbAdapter(
  dbName = "echidna",
  storeName = "vault",
): Promise<StorageAdapter> {
  const db = await openDB(dbName, storeName)

  return {
    async get(key: string): Promise<Uint8Array | null> {
      const result = await tx<Uint8Array | undefined>(db, storeName, "readonly", (s) =>
        s.get(key),
      )
      return result ?? null
    },

    async set(key: string, value: Uint8Array): Promise<void> {
      await tx(db, storeName, "readwrite", (s) => s.put(value, key))
    },

    async delete(key: string): Promise<void> {
      await tx(db, storeName, "readwrite", (s) => s.delete(key))
    },

    async list(prefix = ""): Promise<string[]> {
      const keys = await tx<IDBValidKey[]>(db, storeName, "readonly", (s) => s.getAllKeys())
      return (keys as string[]).filter((k) => k.startsWith(prefix))
    },
  }
}
