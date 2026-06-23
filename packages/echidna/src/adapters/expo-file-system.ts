import { File, Directory } from "expo-file-system"
import type { StorageAdapter } from "../types"

function keyToUri(rootUri: string, key: string): string {
  const base = rootUri.replace(/\/+$/, "")
  const resolved = `${base}/${key}`
  if (!resolved.startsWith(base + "/")) {
    throw new Error(`Key escapes root directory: ${key}`)
  }
  return resolved
}

function walkDir(dir: Directory, rootUri: string, prefix: string, results: string[]): void {
  if (!dir.exists) return
  const base = rootUri.replace(/\/+$/, "")
  for (const entry of dir.list()) {
    const key = entry.uri.replace(/\/+$/, "").slice(base.length + 1)
    if (entry instanceof Directory) {
      walkDir(entry, rootUri, prefix, results)
    } else {
      results.push(key)
    }
  }
}

export function expoFileSystemAdapter(rootUri: string): StorageAdapter {
  return {
    async get(key: string): Promise<Uint8Array | null> {
      const file = new File(keyToUri(rootUri, key))
      if (!file.exists) return null
      return file.bytes()
    },

    async set(key: string, value: Uint8Array): Promise<void> {
      const file = new File(keyToUri(rootUri, key))
      file.create({ intermediates: true, overwrite: true })
      file.write(value)
    },

    async delete(key: string): Promise<void> {
      const file = new File(keyToUri(rootUri, key))
      if (file.exists) file.delete()
    },

    async list(prefix = ""): Promise<string[]> {
      const results: string[] = []
      walkDir(new Directory(rootUri), rootUri, prefix, results)
      return prefix ? results.filter((k) => k.startsWith(prefix)) : results
    },
  }
}
