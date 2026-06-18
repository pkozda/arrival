import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';

describe('Module explain API', () => {
  const previousEnvelope = process.env.ARRIVALOS_MRC_ENVELOPE;
  const previousExplanation = process.env.ARRIVALOS_MRC_EXPLANATION;
  const previousActions = process.env.ARRIVALOS_MRC_ACTIONS;

  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
    process.env.ARRIVALOS_MRC_ENVELOPE = 'true';
    process.env.ARRIVALOS_MRC_EXPLANATION = 'true';
    process.env.ARRIVALOS_MRC_ACTIONS = 'true';
  });

  afterEach(() => {
    teardownTestStateStore();
    if (previousEnvelope === undefined) {
      delete process.env.ARRIVALOS_MRC_ENVELOPE;
    } else {
      process.env.ARRIVALOS_MRC_ENVELOPE = previousEnvelope;
    }
    if (previousExplanation === undefined) {
      delete process.env.ARRIVALOS_MRC_EXPLANATION;
    } else {
      process.env.ARRIVALOS_MRC_EXPLANATION = previousExplanation;
    }
    if (previousActions === undefined) {
      delete process.env.ARRIVALOS_MRC_ACTIONS;
    } else {
      process.env.ARRIVALOS_MRC_ACTIONS = previousActions;
    }
  });

  async function createSession(app: Awaited<ReturnType<typeof buildApp>>) {
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });

    return sessionRes.json() as { sessionId: string };
  }

  async function executeFinancialReality(
    app: Awaited<ReturnType<typeof buildApp>>,
    sessionId: string
  ) {
    return app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {
          grossIncome: 2500,
          taxClass: 1,
          churchTax: false,
          householdSize: 1,
          monthlyRent: 1200,
          employmentStatus: 'employed',
          maritalStatus: 'single',
        },
        context: { userProfile: { language: 'en' } },
      },
    });
  }

  it('returns ModuleExplanationView for a stored execution', async () => {
    const app = await buildApp();
    const { sessionId } = await createSession(app);

    const executeRes = await executeFinancialReality(app, sessionId);
    expect(executeRes.statusCode).toBe(200);

    const executeBody = executeRes.json() as {
      meta?: { executionId: string };
    };
    const executionId = executeBody.meta?.executionId;
    expect(executionId).toBeTruthy();

    const explainRes = await app.inject({
      method: 'GET',
      url: `/api/modules/financial-reality/explain?executionId=${executionId}`,
      headers: { 'x-session-id': sessionId },
    });

    expect(explainRes.statusCode).toBe(200);
    const view = explainRes.json() as {
      moduleId: string;
      executionId: string;
      confidence: string;
      triggeredBecause: Array<{ id: string; label: string; type: string }>;
      recommendations: unknown[];
      actions: unknown[];
      trace?: unknown;
      moduleResult?: unknown;
    };

    expect(view.moduleId).toBe('financial-reality');
    expect(view.executionId).toBe(executionId);
    expect(view.confidence).toMatch(/high|medium|low/);
    expect(Array.isArray(view.triggeredBecause)).toBe(true);
    expect(view.trace).toBeUndefined();
    expect(view.moduleResult).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain('ENGINE_STEP');
  });

  it('returns stable explanation output across repeated calls', async () => {
    const app = await buildApp();
    const { sessionId } = await createSession(app);

    const executeRes = await executeFinancialReality(app, sessionId);
    const executionId = (executeRes.json() as { meta: { executionId: string } }).meta.executionId;

    const firstRes = await app.inject({
      method: 'GET',
      url: `/api/modules/financial-reality/explain?executionId=${executionId}`,
      headers: { 'x-session-id': sessionId },
    });
    const secondRes = await app.inject({
      method: 'GET',
      url: `/api/modules/financial-reality/explain?executionId=${executionId}`,
      headers: { 'x-session-id': sessionId },
    });

    expect(firstRes.json()).toEqual(secondRes.json());
  });

  it('requires executionId query parameter', async () => {
    const app = await buildApp();
    const { sessionId } = await createSession(app);

    const explainRes = await app.inject({
      method: 'GET',
      url: '/api/modules/financial-reality/explain',
      headers: { 'x-session-id': sessionId },
    });

    expect(explainRes.statusCode).toBe(400);
  });

  it('returns 404 when execution is not found', async () => {
    const app = await buildApp();
    const { sessionId } = await createSession(app);

    const explainRes = await app.inject({
      method: 'GET',
      url: '/api/modules/financial-reality/explain?executionId=missing-exec',
      headers: { 'x-session-id': sessionId },
    });

    expect(explainRes.statusCode).toBe(404);
  });
});
