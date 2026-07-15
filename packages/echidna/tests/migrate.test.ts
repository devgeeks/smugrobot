import { describe, it, expect } from "vitest"
import nacl from "tweetnacl"
import { createEncryptedStore } from "../src/store"
import { memoryAdapter } from "../src/adapters/memory"
import type { StorageAdapter } from "../src/types"
import { makeLegacyV1Blob } from "./helpers"

/**
 * Builds a store over a memory adapter with a known raw key (so tests can forge
 * legacy 0x01 bodies under the same key), then downgrades it to look like a
 * pre-0.2 vault: the given docs' bodies are replaced with legacy 0x01 blobs and
 * the `vault/version` marker is removed.
 */
async function legacyVault(docs: Record<string, string>) {
  const adapter: StorageAdapter = memoryAdapter()
  const key = nacl.randomBytes(32)
  const store = await createEncryptedStore({ adapter, keySource: { type: "raw", key } })

  for (const [id, body] of Object.entries(docs)) {
    // Seed real 0x02 metadata via the normal path, then overwrite just the body
    // with a legacy blob so we can assert metadata survives migration untouched.
    await store.set(id, body, { title: `title:${id}` })
    await adapter.set(`docs/${id}/body`, makeLegacyV1Blob(body, key))
  }
  await adapter.delete("vault/version")

  return { adapter, key, store }
}

describe("migrate", () => {
  it("needsMigration is true for a legacy vault and false after migrate", async () => {
    const { store } = await legacyVault({ doc1: "hello" })
    expect(await store.needsMigration()).toBe(true)
    await store.migrate()
    expect(await store.needsMigration()).toBe(false)
  })

  it("needsMigration is false for a freshly created vault", async () => {
    const store = await createEncryptedStore({
      adapter: memoryAdapter(),
      keySource: { type: "raw", key: nacl.randomBytes(32) },
    })
    expect(await store.needsMigration()).toBe(false)
  })

  it("get() on an un-migrated legacy body throws NEEDS_MIGRATION", async () => {
    const { store } = await legacyVault({ doc1: "hello" })
    await expect(store.get("doc1")).rejects.toThrow(
      expect.objectContaining({ code: "NEEDS_MIGRATION" }),
    )
  })

  it("migrate upgrades legacy bodies to 0x02 and get() returns the original text", async () => {
    const { store, adapter } = await legacyVault({ doc1: "hello world", doc2: "second" })

    const result = await store.migrate()
    expect(result).toEqual({ scanned: 2, upgraded: 2 })

    expect((await adapter.get("docs/doc1/body"))?.[0]).toBe(0x02)
    expect((await adapter.get("docs/doc2/body"))?.[0]).toBe(0x02)
    expect(await store.get("doc1")).toBe("hello world")
    expect(await store.get("doc2")).toBe("second")
  })

  it("migrate leaves metadata (createdAt/updatedAt) untouched", async () => {
    const { store } = await legacyVault({ doc1: "hello" })
    const before = await store.getMeta("doc1")
    await store.migrate()
    const after = await store.getMeta("doc1")
    expect(after).toEqual(before)
  })

  it("migrate is idempotent — a second run upgrades nothing", async () => {
    const { store } = await legacyVault({ doc1: "hello" })
    expect((await store.migrate()).upgraded).toBe(1)
    expect(await store.migrate()).toEqual({ scanned: 1, upgraded: 0 })
    expect(await store.get("doc1")).toBe("hello")
  })

  it("migrate does not rewrite already-0x02 bodies", async () => {
    const adapter = memoryAdapter()
    const store = await createEncryptedStore({
      adapter,
      keySource: { type: "raw", key: nacl.randomBytes(32) },
    })
    await store.set("doc1", "already new")
    const before = await adapter.get("docs/doc1/body")

    const result = await store.migrate()
    expect(result).toEqual({ scanned: 1, upgraded: 0 })
    // Untouched: byte-for-byte identical (no re-encryption, so same nonce).
    expect(await adapter.get("docs/doc1/body")).toEqual(before)
  })

  it("a legacy vault with no docs still gets its version marker set", async () => {
    const adapter = memoryAdapter()
    const store = await createEncryptedStore({
      adapter,
      keySource: { type: "raw", key: nacl.randomBytes(32) },
    })
    await adapter.delete("vault/version")
    expect(await store.needsMigration()).toBe(true)

    expect(await store.migrate()).toEqual({ scanned: 0, upgraded: 0 })
    expect(await store.needsMigration()).toBe(false)
  })
})
