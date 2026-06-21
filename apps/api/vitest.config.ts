import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@arrival-atlas/modules/economic-reality': path.resolve(
        __dirname,
        '../../packages/modules/src/economic-reality/index.ts'
      ),
      '@arrival-atlas/modules/module-orchestration': path.resolve(
        __dirname,
        '../../packages/modules/src/module-orchestration/index.ts'
      ),
      '@arrival-atlas/product-contract': path.resolve(
        __dirname,
        '../../packages/product-contract/src/index.ts'
      ),
    },
  },
});
