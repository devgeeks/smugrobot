import { readFile, writeFile, unlink, mkdir, readdir } from "node:fs/promises";
import { join, dirname, sep, resolve } from "node:path";
import type { StorageAdapter } from "../types";

function keyToPath(rootDir: string, key: string): string {
  const resolved = resolve(join(rootDir, ...key.split("/")));
  const root = resolve(rootDir);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error(`Key escapes root directory: ${key}`);
  }
  return resolved;
}

export function nodeFsAdapter(rootDir: string): StorageAdapter {
  return {
    async get(key: string): Promise<Uint8Array | null> {
      try {
        const data = await readFile(keyToPath(rootDir, key));
        return new Uint8Array(data);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
    async set(key: string, value: Uint8Array): Promise<void> {
      const path = keyToPath(rootDir, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, value);
    },
    async delete(key: string): Promise<void> {
      try {
        await unlink(keyToPath(rootDir, key));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    },
    async list(prefix = ""): Promise<string[]> {
      const results: string[] = [];

      async function walk(dir: string, relative: string): Promise<void> {
        let entries;
        try {
          entries = await readdir(dir, { withFileTypes: true });
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
          throw e;
        }
        for (const entry of entries) {
          const entryRelative = relative ? `${relative}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            await walk(join(dir, entry.name), entryRelative);
          } else if (entryRelative.startsWith(prefix)) {
            results.push(entryRelative);
          }
        }
      }

      await walk(rootDir, "");
      return results;
    },
  };
}
