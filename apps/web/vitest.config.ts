import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@arrival-atlas/modules/economic-reality': path.resolve(
        __dirname,
        '../../packages/modules/src/economic-reality/index.ts'
      ),
      '@arrival-atlas/modules': path.resolve(
        __dirname,
        '../../packages/modules/src/index.ts'
      ),
      '@arrival-atlas/modules/life-event': path.resolve(
        __dirname,
        '../../packages/modules/src/life-event/index.ts'
      ),
      '@arrival-atlas/product-contract': path.resolve(
        __dirname,
        '../../packages/product-contract/src/index.ts'
      ),
    },
  },
  test: {
    environment: 'node',
  },
});
