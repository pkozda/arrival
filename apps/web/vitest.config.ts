import path from 'node:path';
import { defineConfig } from 'vitest/config';

const sharedResolve = {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@arrival-atlas/modules/economic-reality': path.resolve(
      __dirname,
      '../../packages/modules/src/economic-reality/index.ts'
    ),
    '@arrival-atlas/modules/i18n': path.resolve(
      __dirname,
      '../../packages/modules/src/i18n/index.ts'
    ),
    '@arrival-atlas/modules/life-event': path.resolve(
      __dirname,
      '../../packages/modules/src/life-event/index.ts'
    ),
    '@arrival-atlas/modules/module-orchestration': path.resolve(
      __dirname,
      '../../packages/modules/src/module-orchestration/index.ts'
    ),
    '@arrival-atlas/modules': path.resolve(__dirname, '../../packages/modules/src/index.ts'),
    '@arrival-atlas/product-contract': path.resolve(
      __dirname,
      '../../packages/product-contract/src/index.ts'
    ),
  },
};

export default defineConfig({
  resolve: sharedResolve,
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
          exclude: ['src/__tests__/**'],
          environment: 'node',
        },
      },
      {
        extends: true,
        resolve: sharedResolve,
        esbuild: {
          jsxInject: `import React from 'react'`,
        },
        test: {
          name: 'regression',
          include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
          environment: 'happy-dom',
          setupFiles: ['./src/__tests__/test-setup.ts'],
        },
      },
    ],
  },
});
