import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/memory": "src/adapters/memory.ts",
    "adapters/localstorage": "src/adapters/localstorage.ts",
    "adapters/node-fs": "src/adapters/node-fs.ts",
    "adapters/async-storage": "src/adapters/async-storage.ts",
    "adapters/indexeddb": "src/adapters/indexeddb.ts",
    "adapters/dropbox": "src/adapters/dropbox.ts",
    "adapters/pouchdb": "src/adapters/pouchdb.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["@react-native-async-storage/async-storage"],
});
