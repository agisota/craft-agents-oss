import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// NOTE: Source map upload to Sentry is intentionally disabled.
// To re-enable, uncomment the sentryVitePlugin below and add SENTRY_AUTH_TOKEN,
// SENTRY_ORG, SENTRY_PROJECT to CI secrets. See CLAUDE.md "Sentry Error Tracking" section.
// import { sentryVitePlugin } from '@sentry/vite-plugin'


function nodeBuiltinStubPlugin() {
  const stub = resolve(__dirname, 'src/renderer/shims/node-stub.ts')
  const names = new Set([
    'fs', 'fs/promises', 'path', 'os', 'crypto', 'child_process', 'url', 'util',
    'stream', 'events', 'buffer', 'module', 'assert', 'process', 'worker_threads',
    'http', 'https', 'net', 'tls', 'dns', 'zlib', 'querystring', 'string_decoder',
    'readline', 'tty', 'constants', 'vm', 'perf_hooks', 'async_hooks', 'timers',
    'node:fs', 'node:fs/promises', 'node:path', 'node:os', 'node:crypto',
    'node:child_process', 'node:url', 'node:util', 'node:stream', 'node:events',
    'node:buffer', 'node:module', 'node:assert', 'node:process', 'node:worker_threads',
    'node:http', 'node:https', 'node:net', 'node:tls', 'node:dns', 'node:zlib',
  ])
  return {
    name: 'node-builtin-stub',
    enforce: 'pre' as const,
    resolveId(id: string) {
      const clean = id.split('?')[0] || id
      if (names.has(clean) || names.has(id)) return stub
      if (clean.startsWith('node:')) return stub
      // bare node core sometimes resolved with null bytes / vite prefixes
      const base = clean.replace(/^\0/, '').replace(/^.*node_modules\//, '')
      if (names.has(base)) return stub
      return null
    },
  }
}

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          // Jotai HMR support: caches atom instances in globalThis.jotaiAtomCache
          // so that HMR module re-execution returns stable atom references
          // instead of creating new (empty) atoms that orphan existing data.
          'jotai/babel/plugin-debug-label',
          ['jotai/babel/plugin-react-refresh', { customAtomNames: ['atomFamily'] }],
        ],
      },
    }),
    tailwindcss(),
    nodeBuiltinStubPlugin(),
    // Sentry source map upload — intentionally disabled. See CLAUDE.md for re-enabling instructions.
    // sentryVitePlugin({
    //   org: process.env.SENTRY_ORG,
    //   project: process.env.SENTRY_PROJECT,
    //   authToken: process.env.SENTRY_AUTH_TOKEN,
    //   disable: !process.env.SENTRY_AUTH_TOKEN,
    //   sourcemaps: {
    //     filesToDeleteAfterUpload: ['**/*.map'],
    //   },
    // }),
  ],
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyDirBeforeWrite: true,
    sourcemap: true,  // Source maps generated for debugging. Not uploaded to Sentry (see CLAUDE.md).
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html'),
        playground: resolve(__dirname, 'src/renderer/playground.html'),
        'browser-toolbar': resolve(__dirname, 'src/renderer/browser-toolbar.html'),
        'browser-empty-state': resolve(__dirname, 'src/renderer/browser-empty-state.html'),
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@config': resolve(__dirname, '../../packages/shared/src/config'),
      // Force all React imports to use the root node_modules React
      // Bun hoists deps to root. This prevents "multiple React copies" error from @craft-agent/ui
      'react': resolve(__dirname, '../../node_modules/react'),
      'react-dom': resolve(__dirname, '../../node_modules/react-dom'),
      '@anthropic-ai/claude-agent-sdk': resolve(__dirname, 'src/renderer/shims/claude-agent-sdk-stub.ts'),
    },
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'jotai', 'pdfjs-dist'],
    exclude: ['@craft-agent/ui', '@anthropic-ai/claude-agent-sdk'],
    esbuildOptions: {
      supported: { 'top-level-await': true },
      target: 'esnext'
    }
  },
  server: {
    port: 5173,
    open: false
  }
})
