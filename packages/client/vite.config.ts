import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const apiTarget = process.env.API_URL ?? 'http://127.0.0.1:3001'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Use the crypto source directly, so dev and tests need no separate build of that package.
      '@onekey-locker/crypto': fileURLToPath(new URL('../crypto/src/index.ts', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
  preview: {
    host: '127.0.0.1',
    port: 3000,
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['./src/testing/setup.ts'],
  },
})
