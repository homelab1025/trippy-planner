import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

export default defineConfig({
  plugins: [react()],
  // fast-xml-parser is only reachable via the gpxWorker module graph, which Vite's
  // dependency scanner doesn't crawl (it skips dynamically-created Web Workers). Without
  // this, the first GPX upload against a cold dev server triggers a mid-session
  // re-optimization + full page reload, wiping React state.
  optimizeDeps: {
    include: ['fast-xml-parser'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  test: {
    environment: 'node',
    exclude: ['node_modules', 'dist', 'tests'],
    setupFiles: ['./src/vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
    },
  },
})
