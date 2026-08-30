import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.PLAYWRIGHT_WEB_URL ?? 'http://localhost:3000';
const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';
const useManagedServers = process.env.PW_SKIP_WEBSERVER !== '1';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  ...(useManagedServers
    ? {
        webServer: [
          {
            command: 'npm run dev -w @arrival-atlas/api',
            url: `${API_URL}/api/modules`,
            cwd: path.resolve(__dirname, '../..'),
            reuseExistingServer: true,
            timeout: 120_000,
          },
          {
            command: 'npm run dev -w @arrival-atlas/web',
            url: WEB_URL,
            cwd: path.resolve(__dirname, '../..'),
            reuseExistingServer: true,
            timeout: 120_000,
            env: {
              NEXT_PUBLIC_API_URL: API_URL,
            },
          },
        ],
      }
    : {}),
});
