import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';

describe('ModuleError API boundary', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('returns ModuleError shape for failed module execution without stack traces', async () => {
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    const executeRes = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {
          grossIncome: 2500,
          taxClass: 99,
          churchTax: false,
          householdSize: 1,
          monthlyRent: 1200,
          employmentStatus: 'employed',
          maritalStatus: 'single',
        },
      },
    });

    expect(executeRes.statusCode).toBe(422);
    const body = executeRes.json() as {
      projection?: { status: string };
      error?: { code: string; category: string; retryable: boolean; message: string };
    };

    expect(body.projection?.status).toBe('error');
    expect(body.error?.code).toBeTruthy();
    expect(body.error?.category).toMatch(/validation|domain|policy|internal/);
    expect(body.error?.retryable).toBe(false);
    expect(body.error?.message).not.toContain(' at ');
  });
});
