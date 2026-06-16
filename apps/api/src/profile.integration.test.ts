import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from './build-app.js';
import { profileStore } from './profile-runtime.js';
import { clearExecutionTraces } from './execution-trace-store.js';
import { clearModuleExecutions } from './module-execution-store.js';
import { clearSnapshotVersions } from './snapshot-version-store.js';

describe('API profile + financial module integration', () => {
  beforeEach(() => {
    profileStore.clear();
    clearExecutionTraces();
    clearModuleExecutions();
    clearSnapshotVersions();
  });

  it('creates session, profile, updates revision, and executes financial module with merged input', async () => {
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    expect(sessionRes.statusCode).toBe(200);
    const { sessionId } = sessionRes.json() as { sessionId: string };

    const createProfileRes = await app.inject({
      method: 'POST',
      url: '/api/profile',
      headers: { 'x-session-id': sessionId },
      payload: { preferredLanguage: 'de' },
    });
    expect(createProfileRes.statusCode).toBe(201);
    const created = createProfileRes.json() as { version: number };
    expect(created.version).toBe(1);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/profile',
      headers: {
        'x-session-id': sessionId,
        'if-match': '1',
      },
      payload: {
        employment: {
          grossMonthlyIncome: 2500,
          taxClass: 1,
          churchTax: false,
          status: 'employed',
        },
        household: { size: 1, maritalStatus: 'single' },
        housing: { monthlyColdRent: 800 },
        insurance: { hasCoverage: true, type: 'public' },
        benefits: { daysInGermany: 90 },
      },
    });
    expect(patchRes.statusCode).toBe(200);
    const patched = patchRes.json() as { version: number };
    expect(patched.version).toBe(2);

    const revisionsRes = await app.inject({
      method: 'GET',
      url: '/api/profile/revisions',
      headers: { 'x-session-id': sessionId },
    });
    expect(revisionsRes.statusCode).toBe(200);
    const revisionsBody = revisionsRes.json() as { revisions: Array<{ revision: number }> };
    expect(revisionsBody.revisions.length).toBeGreaterThanOrEqual(2);

    const executeFromProfileRes = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {},
        context: {},
      },
    });
    expect(executeFromProfileRes.statusCode).toBe(200);
    const fromProfile = executeFromProfileRes.json() as {
      success: boolean;
      data: { income: { gross: number; net: number } };
    };
    expect(fromProfile.success).toBe(true);
    expect(fromProfile.data.income.gross).toBe(2500);
    expect(fromProfile.data.income.net).toBeGreaterThan(1700);

    const executeOverrideRes = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: { grossIncome: 3000 },
        context: {},
      },
    });
    expect(executeOverrideRes.statusCode).toBe(200);
    const overridden = executeOverrideRes.json() as {
      success: boolean;
      data: { income: { gross: number } };
    };
    expect(overridden.data.income.gross).toBe(3000);

    const traceRes = await app.inject({
      method: 'GET',
      url: '/api/modules/financial-reality/trace',
      headers: { 'x-session-id': sessionId },
    });
    expect(traceRes.statusCode).toBe(200);
    const traceBody = traceRes.json() as {
      sessionId: string;
      moduleId: string;
      steps: Array<{ type: string; field?: string; value?: unknown }>;
    };
    expect(traceBody.sessionId).toBe(sessionId);
    expect(traceBody.moduleId).toBe('financial-reality');
    expect(traceBody.steps).toEqual(
      expect.arrayContaining([
        { type: 'MERGE_DECISION', field: 'grossIncome', source: 'input' },
        { type: 'FINAL_VALUE', field: 'grossIncome', value: 3000 },
      ])
    );
  });
});
