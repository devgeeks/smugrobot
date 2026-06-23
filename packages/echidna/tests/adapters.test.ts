import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { IDBFactory } from "fake-indexeddb"
import { memoryAdapter } from "../src/adapters/memory"
import { nodeFsAdapter } from "../src/adapters/node-fs"
import { indexedDbAdapter } from "../src/adapters/indexeddb"
import type { StorageAdapter } from "../src/types"

type AdapterFactory = () => Promise<{ adapter: StorageAdapter; cleanup?: () => Promise<void> }>

function adapterSuite(name: string, factory: AdapterFactory) {
  describe(name, () => {
    let adapter: StorageAdapter
    let cleanup: (() => Promise<void>) | undefined

    beforeEach(async () => {
      const result = await factory()
      adapter = result.adapter
      cleanup = result.cleanup
    })

    afterEach(async () => {
      await cleanup?.()
    })

    it("set and get round-trip", async () => {
      const data = new Uint8Array([1, 2, 3, 4])
      await adapter.set("test/key", data)
      expect(await adapter.get("test/key")).toEqual(data)
    })

    it("get returns null for missing key", async () => {
      expect(await adapter.get("missing/key")).toBeNull()
    })

    it("delete removes a key", async () => {
      await adapter.set("test/key", new Uint8Array([1]))
      await adapter.delete("test/key")
      expect(await adapter.get("test/key")).toBeNull()
    })

    it("delete on missing key does not throw", async () => {
      await expect(adapter.delete("nonexistent/key")).resolves.toBeUndefined()
    })

    it("list returns all keys", async () => {
      await adapter.set("a/b", new Uint8Array([1]))
      await adapter.set("a/c", new Uint8Array([2]))
      await adapter.set("d/e", new Uint8Array([3]))
      const keys = await adapter.list()
      expect(keys).toContain("a/b")
      expect(keys).toContain("a/c")
      expect(keys).toContain("d/e")
    })

    it("list filters by prefix", async () => {
      await adapter.set("docs/1/meta", new Uint8Array([1]))
      await adapter.set("docs/2/meta", new Uint8Array([2]))
      await adapter.set("vault/salt", new Uint8Array([3]))
      const keys = await adapter.list("docs/")
      expect(keys).toContain("docs/1/meta")
      expect(keys).toContain("docs/2/meta")
      expect(keys).not.toContain("vault/salt")
    })
  })
}

adapterSuite("memory adapter", async () => ({ adapter: memoryAdapter() }))

adapterSuite("node-fs adapter", async () => {
  const dir = await mkdtemp(join(tmpdir(), "echidna-test-"))
  return {
    adapter: nodeFsAdapter(dir),
    cleanup: async () => rm(dir, { recursive: true }),
  }
})

adapterSuite("indexeddb adapter", async () => {
  // Each suite run gets a fresh IDBFactory so tests are fully isolated
  const idb = new IDBFactory()
  globalThis.indexedDB = idb
  const dbName = `echidna-test-${Math.random().toString(36).slice(2)}`
  return { adapter: await indexedDbAdapter(dbName) }
})
