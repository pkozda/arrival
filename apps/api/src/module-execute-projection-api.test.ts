import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';

describe('Module execute projection API', () => {
  const previousEnvelope = process.env.ARRIVAL_ATLAS_MRC_ENVELOPE;
  const previousExplanation = process.env.ARRIVAL_ATLAS_MRC_EXPLANATION;
  const previousActions = process.env.ARRIVAL_ATLAS_MRC_ACTIONS;

  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
    process.env.ARRIVAL_ATLAS_MRC_ENVELOPE = 'true';
    process.env.ARRIVAL_ATLAS_MRC_EXPLANATION = 'true';
    process.env.ARRIVAL_ATLAS_MRC_ACTIONS = 'true';
  });

  afterEach(() => {
    teardownTestStateStore();
    if (previousEnvelope === undefined) {
      delete process.env.ARRIVAL_ATLAS_MRC_ENVELOPE;
    } else {
      process.env.ARRIVAL_ATLAS_MRC_ENVELOPE = previousEnvelope;
    }
    if (previousExplanation === undefined) {
      delete process.env.ARRIVAL_ATLAS_MRC_EXPLANATION;
    } else {
      process.env.ARRIVAL_ATLAS_MRC_EXPLANATION = previousExplanation;
    }
    if (previousActions === undefined) {
      delete process.env.ARRIVAL_ATLAS_MRC_ACTIONS;
    } else {
      process.env.ARRIVAL_ATLAS_MRC_ACTIONS = previousActions;
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

  it('returns ModuleUIProjection by default without legacy fields', async () => {
    const app = await buildApp();
    const { sessionId } = await createSession(app);

    const executeRes = await app.inject({
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

    expect(executeRes.statusCode).toBe(200);
    const body = executeRes.json() as {
      projection: {
        moduleId: string;
        status: string;
        recommendations: unknown[];
        actions: unknown[];
      };
      meta?: { executionId: string; duration: number };
      data?: unknown;
      moduleResult?: unknown;
      ux?: unknown;
    };

    expect(body.projection.moduleId).toBe('financial-reality');
    expect(body.projection.status).toBe('success');
    expect(body.meta?.executionId).toBeTruthy();
    expect(typeof body.meta?.duration).toBe('number');
    expect(body.data).toBeUndefined();
    expect(body.moduleResult).toBeUndefined();
    expect(body.ux).toBeUndefined();
  });

  it('returns legacy execute response only with contractVersion=legacy', async () => {
    const app = await buildApp();
    const { sessionId } = await createSession(app);

    const executeRes = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute?contractVersion=legacy',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {
          grossIncome: 2500,
          taxClass: 1,
          churchTax: false,
          householdSize: 1,
          monthlyRent: 800,
          employmentStatus: 'employed',
          maritalStatus: 'single',
        },
      },
    });

    expect(executeRes.statusCode).toBe(200);
    const body = executeRes.json() as {
      success: boolean;
      data: { income: { gross: number } };
      moduleResult?: { status: string };
      projection?: unknown;
    };

    expect(body.success).toBe(true);
    expect(body.data.income.gross).toBe(2500);
    expect(body.moduleResult?.status).toBe('success');
    expect(body.projection).toBeUndefined();
  });

  it('persists projection in ui snapshot executions', async () => {
    const app = await buildApp();
    const { sessionId } = await createSession(app);

    await app.inject({
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
      },
    });

    const snapshotRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });

    const snapshot = snapshotRes.json() as {
      executionsByModuleId: Record<string, Array<{ projection: { moduleId: string } }>>;
    };

    expect(snapshot.executionsByModuleId['financial-reality']?.[0]?.projection.moduleId).toBe(
      'financial-reality'
    );
  });
});
