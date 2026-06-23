import { describe, it, expect } from "vitest"
import nacl from "tweetnacl"
import { createEncryptedStore } from "../src/store"
import { memoryAdapter } from "../src/adapters/memory"

function rawKey() {
  return { type: "raw" as const, key: nacl.randomBytes(32) }
}

describe("store", () => {
  it("createEncryptedStore creates vault/salt and vault/kdf on first call", async () => {
    const adapter = memoryAdapter()
    await createEncryptedStore({ adapter, keySource: rawKey() })
    expect(await adapter.get("vault/salt")).not.toBeNull()
    expect(await adapter.get("vault/kdf")).not.toBeNull()
  })

  it("createEncryptedStore reuses existing salt on second call", async () => {
    const adapter = memoryAdapter()
    const ks = rawKey()
    await createEncryptedStore({ adapter, keySource: ks })
    const salt1 = await adapter.get("vault/salt")
    await createEncryptedStore({ adapter, keySource: ks })
    const salt2 = await adapter.get("vault/salt")
    expect(Buffer.from(salt1!).toString("hex")).toBe(Buffer.from(salt2!).toString("hex"))
  })

  it("set + get round-trip returns original text", async () => {
    const store = await createEncryptedStore({ adapter: memoryAdapter(), keySource: rawKey() })
    await store.set("doc1", "Hello World")
    expect(await store.get("doc1")).toBe("Hello World")
  })

  it("get on missing id returns null", async () => {
    const store = await createEncryptedStore({ adapter: memoryAdapter(), keySource: rawKey() })
    expect(await store.get("nonexistent")).toBeNull()
  })

  it("getMeta returns plaintext metadata without decrypting body", async () => {
    const store = await createEncryptedStore({ adapter: memoryAdapter(), keySource: rawKey() })
    await store.set("doc1", "body text", { title: "My Doc", tags: ["a", "b"] })
    const meta = await store.getMeta("doc1")
    expect(meta?.title).toBe("My Doc")
    expect(meta?.tags).toEqual(["a", "b"])
    expect(meta?.id).toBe("doc1")
  })

  it("updateMeta updates title without re-encrypting body", async () => {
    const adapter = memoryAdapter()
    const store = await createEncryptedStore({ adapter, keySource: rawKey() })
    await store.set("doc1", "body text", { title: "Original" })
    const bodyBefore = Buffer.from(await adapter.get("docs/doc1/body") as Uint8Array).toString("hex")
    await store.updateMeta("doc1", { title: "Updated" })
    const bodyAfter = Buffer.from(await adapter.get("docs/doc1/body") as Uint8Array).toString("hex")
    expect(await store.getMeta("doc1").then((m) => m?.title)).toBe("Updated")
    expect(bodyBefore).toBe(bodyAfter)
  })

  it("delete removes both meta and body; subsequent get returns null", async () => {
    const adapter = memoryAdapter()
    const store = await createEncryptedStore({ adapter, keySource: rawKey() })
    await store.set("doc1", "body text")
    await store.delete("doc1")
    expect(await store.get("doc1")).toBeNull()
    expect(await adapter.get("docs/doc1/meta")).toBeNull()
    expect(await adapter.get("docs/doc1/body")).toBeNull()
  })

  it("list returns all DocMeta records", async () => {
    const store = await createEncryptedStore({ adapter: memoryAdapter(), keySource: rawKey() })
    await store.set("doc1", "text 1", { title: "Doc 1" })
    await store.set("doc2", "text 2", { title: "Doc 2" })
    expect(await store.list()).toHaveLength(2)
  })

  it("list filters by tags", async () => {
    const store = await createEncryptedStore({ adapter: memoryAdapter(), keySource: rawKey() })
    await store.set("doc1", "text 1", { tags: ["work"] })
    await store.set("doc2", "text 2", { tags: ["personal"] })
    const results = await store.list({ tags: ["work"] })
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe("doc1")
  })

  it("list filters by since/until", async () => {
    const store = await createEncryptedStore({ adapter: memoryAdapter(), keySource: rawKey() })
    await store.set("doc1", "text 1")
    await new Promise((r) => setTimeout(r, 10))
    const mid = Date.now()
    await store.set("doc2", "text 2")
    const recent = await store.list({ since: mid })
    expect(recent).toHaveLength(1)
    expect(recent[0]?.id).toBe("doc2")
  })

  it("wrong key causes WRONG_KEY on get", async () => {
    const adapter = memoryAdapter()
    const store1 = await createEncryptedStore({ adapter, keySource: rawKey() })
    await store1.set("doc1", "secret text")
    const store2 = await createEncryptedStore({ adapter, keySource: rawKey() })
    await expect(store2.get("doc1")).rejects.toThrow(
      expect.objectContaining({ code: "WRONG_KEY" }),
    )
  })

  it("set updates updatedAt but not createdAt on overwrite", async () => {
    const store = await createEncryptedStore({ adapter: memoryAdapter(), keySource: rawKey() })
    const meta1 = await store.set("doc1", "v1")
    await new Promise((r) => setTimeout(r, 10))
    const meta2 = await store.set("doc1", "v2")
    expect(meta2.createdAt).toBe(meta1.createdAt)
    expect(meta2.updatedAt).toBeGreaterThan(meta1.updatedAt)
  })

  it("size in DocMeta reflects byte length of UTF-8 plaintext", async () => {
    const store = await createEncryptedStore({ adapter: memoryAdapter(), keySource: rawKey() })
    const text = "héllo"
    const meta = await store.set("doc1", text)
    expect(meta.size).toBe(new TextEncoder().encode(text).length)
  })
})
