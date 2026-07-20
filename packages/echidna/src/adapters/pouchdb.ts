import type { StorageAdapter } from "../types";

const ATTACHMENT_NAME = "data";
const DEFAULT_MAX_RETRIES = 3;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface PouchAttachment {
  content_type: string;
  data: string;
}

interface PouchDoc {
  _id: string;
  _rev?: string;
  _attachments?: Record<string, PouchAttachment>;
}

interface PouchError {
  status?: number;
}

function isNotFound(e: unknown): boolean {
  return (e as PouchError | undefined)?.status === 404;
}

function isConflict(e: unknown): boolean {
  return (e as PouchError | undefined)?.status === 409;
}

export interface PouchDbLike {
  get(id: string, options?: { attachments?: boolean }): Promise<PouchDoc>;
  put(doc: PouchDoc): Promise<{ ok: boolean; rev: string }>;
  remove(id: string, rev: string): Promise<{ ok: boolean }>;
  allDocs(options?: { startkey?: string; endkey?: string }): Promise<{ rows: { id: string }[] }>;
}

export interface PouchDbAdapterOptions {
  maxRetries?: number;
}

async function currentRev(db: PouchDbLike, id: string): Promise<string | undefined> {
  try {
    const doc = await db.get(id);
    return doc._rev;
  } catch (e) {
    if (isNotFound(e)) return undefined;
    throw e;
  }
}

export function pouchDbAdapter(
  db: PouchDbLike,
  options: PouchDbAdapterOptions = {},
): StorageAdapter {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }

  return {
    async get(key: string): Promise<Uint8Array | null> {
      try {
        const doc = await db.get(key, { attachments: true });
        const attachment = doc._attachments?.[ATTACHMENT_NAME];
        if (!attachment || typeof attachment.data !== "string") {
          throw new Error(
            `pouchDbAdapter: doc "${key}" is missing its "${ATTACHMENT_NAME}" attachment`,
          );
        }
        return fromBase64(attachment.data);
      } catch (e) {
        if (isNotFound(e)) return null;
        throw e;
      }
    },

    async set(key: string, value: Uint8Array): Promise<void> {
      for (let attempt = 0; ; attempt++) {
        const rev = await currentRev(db, key);
        try {
          await db.put({
            _id: key,
            ...(rev ? { _rev: rev } : {}),
            _attachments: {
              [ATTACHMENT_NAME]: {
                content_type: "application/octet-stream",
                data: toBase64(value),
              },
            },
          });
          return;
        } catch (e) {
          if (isConflict(e) && attempt < maxRetries) continue;
          throw e;
        }
      }
    },

    async delete(key: string): Promise<void> {
      const rev = await currentRev(db, key);
      if (rev === undefined) return;
      try {
        await db.remove(key, rev);
      } catch (e) {
        if (!isConflict(e)) throw e;
        const retryRev = await currentRev(db, key);
        if (retryRev === undefined) return;
        await db.remove(key, retryRev);
      }
    },

    async list(prefix = ""): Promise<string[]> {
      const opts = prefix ? { startkey: prefix, endkey: prefix + "￰" } : {};
      const result = await db.allDocs(opts);
      return result.rows.map((row) => row.id);
    },
  };
}
