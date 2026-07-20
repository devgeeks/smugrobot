import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import PouchDB, { type PouchDatabase } from "pouchdb";
import { pouchDbAdapter } from "../src/adapters/pouchdb";

describe("pouchdb adapter (specific behavior)", () => {
  let dir: string;
  let db: PouchDatabase;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "echidna-pouchdb-specific-"));
    db = new PouchDB(join(dir, "db"));
  });

  afterEach(async () => {
    await db.destroy();
    await rm(dir, { recursive: true });
  });

  it("stores the value as a real CouchDB attachment", async () => {
    const adapter = pouchDbAdapter(db);
    const data = new Uint8Array([10, 20, 30, 40]);
    await adapter.set("docs/1/body", data);

    const doc = await db.get("docs/1/body", { attachments: true });
    const attachment = (
      doc as unknown as { _attachments: Record<string, { content_type: string; data: string }> }
    )._attachments["data"];
    if (!attachment) throw new Error("expected attachment to be present");
    expect(attachment.content_type).toBe("application/octet-stream");
    expect(Array.from(Buffer.from(attachment.data, "base64"))).toEqual(Array.from(data));
  });

  it("overwriting a key advances the revision and returns the latest value", async () => {
    const adapter = pouchDbAdapter(db);
    await adapter.set("test/key", new Uint8Array([1]));
    await adapter.set("test/key", new Uint8Array([2]));
    await adapter.set("test/key", new Uint8Array([3]));
    expect(await adapter.get("test/key")).toEqual(new Uint8Array([3]));
  });

  it("delete removes the doc so it drops out of list()", async () => {
    const adapter = pouchDbAdapter(db);
    await adapter.set("test/key", new Uint8Array([1]));
    await adapter.delete("test/key");
    expect(await adapter.list()).not.toContain("test/key");
  });

  it("set retries once and succeeds when the first put hits a 409 conflict", async () => {
    await db.put({ _id: "test/key" });

    let putCalls = 0;
    const flakyDb: typeof db = {
      ...db,
      get: db.get.bind(db),
      remove: db.remove.bind(db),
      allDocs: db.allDocs.bind(db),
      put: (async (doc: Parameters<typeof db.put>[0]) => {
        putCalls++;
        if (putCalls === 1) {
          const conflict = Object.assign(new Error("conflict"), { status: 409 });
          throw conflict;
        }
        return db.put(doc);
      }) as typeof db.put,
    };

    const adapter = pouchDbAdapter(flakyDb);
    await expect(adapter.set("test/key", new Uint8Array([2]))).resolves.toBeUndefined();
    expect(putCalls).toBe(2);
    expect(await adapter.get("test/key")).toEqual(new Uint8Array([2]));
  });

  it("list(prefix) handles keys sharing a common prefix root that diverge later", async () => {
    const adapter = pouchDbAdapter(db);
    await adapter.set("docs/1/meta", new Uint8Array([1]));
    await adapter.set("docs/10/meta", new Uint8Array([2]));
    await adapter.set("docs/2/meta", new Uint8Array([3]));

    const keys = await adapter.list("docs/1/");
    expect(keys).toEqual(["docs/1/meta"]);
  });

  it("list(prefix) includes a key that matches the prefix exactly", async () => {
    const adapter = pouchDbAdapter(db);
    await adapter.set("docs/1", new Uint8Array([1]));
    await adapter.set("docs/1/meta", new Uint8Array([2]));

    const keys = await adapter.list("docs/1");
    expect(keys.sort()).toEqual(["docs/1", "docs/1/meta"]);
  });

  it("get throws for a doc that is missing its attachment instead of returning null", async () => {
    const adapter = pouchDbAdapter(db);
    await db.put({ _id: "corrupt/doc" });

    await expect(adapter.get("corrupt/doc")).rejects.toThrow(/missing its "data" attachment/);
  });
});
