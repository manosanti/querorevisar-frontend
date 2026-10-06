import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __CATALOG_VERSION__: '1' },
  resolve: {
    alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/test/pwa-register-stub.ts', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30000,
  },
});
