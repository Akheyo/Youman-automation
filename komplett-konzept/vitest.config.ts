import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // Next.js liefert "server-only" aus; im Test gibt es kein Next. Die
      // Attrappe erlaubt, die reine Logik aus Dateien zu prüfen, die im
      // Betrieb ausdrücklich nur auf dem Server laufen dürfen.
      'server-only': fileURLToPath(new URL('./tests/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**'],
    environment: 'node',
  },
})
