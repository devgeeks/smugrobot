import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^echidna\.js\/adapters\/(.+)$/,
        replacement: path.resolve(__dirname, '../../packages/echidna/src/adapters/$1.ts'),
      },
      {
        find: 'echidna.js',
        replacement: path.resolve(__dirname, '../../packages/echidna/src/index.ts'),
      },
    ],
  },
  optimizeDeps: {
    include: [
      '@milkdown/core',
      '@milkdown/ctx',
      '@milkdown/preset-commonmark',
      '@milkdown/plugin-listener',
      '@milkdown/utils',
      '@milkdown/transformer',
    ],
    exclude: ['echidna.js', '@smugrobot/ui'],
  },
})
