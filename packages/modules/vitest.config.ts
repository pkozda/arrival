import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@arrival-atlas/product-contract': path.resolve(
        __dirname,
        '../product-contract/src/index.ts'
      ),
    },
  },
});
