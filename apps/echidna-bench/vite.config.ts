import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/echidna-bench/",
  resolve: {
    alias: [
      {
        find: /^@smugrobot\/echidna\/adapters\/(.+)$/,
        replacement: path.resolve(__dirname, "../../packages/echidna/src/adapters/$1.ts"),
      },
      {
        find: "@smugrobot/echidna",
        replacement: path.resolve(__dirname, "../../packages/echidna/src/index.ts"),
      },
    ],
  },
  optimizeDeps: {
    exclude: ["@smugrobot/echidna", "@smugrobot/ui"],
  },
});
