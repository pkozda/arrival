import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UI_PROFILE_FORBIDDEN_RESPONSE_KEYS } from '@arrival-atlas/profile';
import { buildApp } from './build-app.js';
import { resetTestStateStore, setupTestStateStore, teardownTestStateStore } from './test-state.js';

function assertNoEngineLeakage(body: Record<string, unknown>): void {
  for (const key of UI_PROFILE_FORBIDDEN_RESPONSE_KEYS) {
    expect(body).not.toHaveProperty(key);
  }
  expect(Object.keys(body).sort()).toEqual(['profile', 'schemaVersion', 'version']);
}

describe('Profile UI contract boundary', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('GET /api/profile returns only UI contract fields after create and update', async () => {
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    expect(sessionRes.statusCode).toBe(200);
    const { sessionId } = sessionRes.json() as { sessionId: string };

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/profile',
      headers: { 'x-session-id': sessionId },
      payload: { preferredLanguage: 'de' },
    });
    expect(createRes.statusCode).toBe(201);
    assertNoEngineLeakage(createRes.json() as Record<string, unknown>);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/profile',
      headers: {
        'x-session-id': sessionId,
        'if-match': '1',
      },
      payload: {
        employment: {
          grossMonthlyIncome: 3200,
          taxClass: 1,
          churchTax: false,
          status: 'employed',
        },
        housing: { monthlyColdRent: 900 },
      },
    });
    expect(patchRes.statusCode).toBe(200);
    const patched = patchRes.json() as {
      profile: { employment?: { grossMonthlyIncome?: number } };
      version: number;
      schemaVersion: string;
    };
    assertNoEngineLeakage(patched as unknown as Record<string, unknown>);
    expect(patched.version).toBe(2);
    expect(patched.profile.employment?.grossMonthlyIncome).toBe(3200);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/profile',
      headers: { 'x-session-id': sessionId },
    });
    expect(getRes.statusCode).toBe(200);
    const profileBody = getRes.json() as {
      profile: { employment?: { grossMonthlyIncome?: number }; housing?: { monthlyColdRent?: number } };
      version: number;
      schemaVersion: string;
    };

    assertNoEngineLeakage(profileBody as unknown as Record<string, unknown>);
    expect(profileBody.version).toBe(2);
    expect(profileBody.schemaVersion).toBe('1.0.0');
    expect(profileBody.profile.employment?.grossMonthlyIncome).toBe(3200);
    expect(profileBody.profile.housing?.monthlyColdRent).toBe(900);

    expect(profileBody.profile).not.toHaveProperty('trace');
    expect(profileBody.profile).not.toHaveProperty('profileSlice');
    expect(profileBody.profile).not.toHaveProperty('mergedInput');
    expect(profileBody.profile).not.toHaveProperty('policyDocument');
  });

  it('PATCH requires optimistic concurrency via If-Match or X-Profile-Revision', async () => {
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {},
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    await app.inject({
      method: 'POST',
      url: '/api/profile',
      headers: { 'x-session-id': sessionId },
      payload: { preferredLanguage: 'de' },
    });

    const missingRevisionRes = await app.inject({
      method: 'PATCH',
      url: '/api/profile',
      headers: { 'x-session-id': sessionId },
      payload: { household: { size: 2 } },
    });
    expect(missingRevisionRes.statusCode).toBe(428);
  });
});
