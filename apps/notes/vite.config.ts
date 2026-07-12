import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig(({ mode }) => {
  const suffix = mode === 'development' ? '-dev' : mode === 'preview' ? '-preview' : ''

  return {
    base: '/notes/',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version + suffix),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          clientsClaim: true,
          skipWaiting: true,
        },
        manifest: {
          name: 'Notes',
          short_name: 'Notes',
          description: 'Private encrypted notes',
          display: 'standalone',
          background_color: '#0D0F0E',
          theme_color: '#0D0F0E',
          start_url: '/notes/',
          scope: '/notes/',
          icons: [
            { src: 'pwa-64x64.png',            sizes: '64x64',   type: 'image/png' },
            { src: 'pwa-192x192.png',           sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png',           sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }) as any,
    ],
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
  }
})
