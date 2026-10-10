import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Test against the crypto source, so the tests do not need a built package.
      '@onekey-locker/crypto': fileURLToPath(new URL('../crypto/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // All test files share one database schema; run them one after another.
    fileParallelism: false,
  },
})
