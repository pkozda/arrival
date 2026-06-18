import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ModuleExecutionResult } from '@arrivalos/core';
import { wrapLegacyExecutionResult } from '@arrivalos/module-runtime';
import { buildApp } from './build-app.js';
import {
  applyModuleExecute,
  createInitialSystemState,
} from './state/system-state-apply.js';
import { buildLegacyUiSnapshot } from './state/snapshot-projection-engine.js';
import { resolveExecutionResult } from '@arrivalos/module-runtime';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';

const legacySuccess: ModuleExecutionResult = {
  moduleId: 'financial-reality',
  version: '2.0.0',
  success: true,
  executedAt: '2026-06-16T12:00:00.000Z',
  data: {
    income: { gross: 2500, net: 1800 },
    meta: { confidence: 'high' },
  },
};

describe('MRC-2 module result envelope integration', () => {
  const previousFlag = process.env.ARRIVALOS_MRC_ENVELOPE;

  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
    if (previousFlag === undefined) {
      delete process.env.ARRIVALOS_MRC_ENVELOPE;
    } else {
      process.env.ARRIVALOS_MRC_ENVELOPE = previousFlag;
    }
  });

  it('stores dual-write execution records when envelope mode is enabled', () => {
    process.env.ARRIVALOS_MRC_ENVELOPE = 'true';
    const envelope = wrapLegacyExecutionResult(legacySuccess, { executionId: 'exec_dpss' });
    const state = createInitialSystemState({
      context: { userProfile: { language: 'en' } },
      modules: [{ id: 'financial-reality', name: 'Financial Reality' }],
      projectionConfig: { uxSnapshotEnabled: true },
      mutationId: 'mut_init',
    });

    const next = applyModuleExecute({
      state,
      moduleId: 'financial-reality',
      executionId: 'exec_dpss',
      result: legacySuccess.data,
      moduleResult: envelope,
      executedAt: legacySuccess.executedAt,
      trace: { sessionId: state.session.id, moduleId: 'financial-reality', steps: [] },
      requestInput: {},
      mutationId: 'exec_dpss',
    });

    const stored = next.executionsByModuleId['financial-reality']?.[0];
    expect(stored?.result).toEqual(legacySuccess.data);
    expect(stored?.legacyResult).toEqual(legacySuccess.data);
    expect(stored?.moduleResult).toEqual(envelope);

    const snapshot = buildLegacyUiSnapshot(next);
    expect(snapshot.executions[0]?.result).toEqual(legacySuccess.data);
    expect(resolveExecutionResult(stored!)).toEqual(envelope);
  });

  it('returns moduleResult with explanation when envelope and explanation modes are enabled', async () => {
    process.env.ARRIVALOS_MRC_ENVELOPE = 'true';
    process.env.ARRIVALOS_MRC_EXPLANATION = 'true';
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

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
          monthlyRent: 1200,
          employmentStatus: 'employed',
          maritalStatus: 'single',
        },
        context: { userProfile: { language: 'en' } },
      },
    });

    const body = executeRes.json() as {
      success: boolean;
      data: unknown;
      moduleResult?: {
        recommendations?: unknown[];
        explanation?: { summary: string; confidence: string };
      };
    };

    expect(body.success).toBe(true);
    expect(Array.isArray(body.moduleResult?.recommendations)).toBe(true);
    expect(body.moduleResult?.explanation?.summary).toBeTruthy();
    expect(body.moduleResult?.explanation?.confidence).toBeTruthy();
    expect(Array.isArray(body.moduleResult?.actions)).toBe(true);
  });

  it('omits actions when envelope is enabled but explanation is disabled', async () => {
    process.env.ARRIVALOS_MRC_ENVELOPE = 'true';
    delete process.env.ARRIVALOS_MRC_EXPLANATION;
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

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
          monthlyRent: 1200,
          employmentStatus: 'employed',
          maritalStatus: 'single',
        },
        context: { userProfile: { language: 'en' } },
      },
    });

    const body = executeRes.json() as {
      moduleResult?: { actions?: unknown[]; recommendations?: unknown[] };
    };

    expect(body.moduleResult?.actions).toBeUndefined();
    expect(body.moduleResult?.recommendations).toBeUndefined();
  });

  it('returns legacy API response with moduleResult when envelope mode is enabled', async () => {
    process.env.ARRIVALOS_MRC_ENVELOPE = 'true';
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

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
        context: { userProfile: { language: 'en' } },
      },
    });

    expect(executeRes.statusCode).toBe(200);
    const body = executeRes.json() as {
      success: boolean;
      data: { income: { gross: number } };
      moduleResult?: {
        status: string;
        payload: { income: { gross: number } };
        meta: { executionId: string };
      };
    };

    expect(body.success).toBe(true);
    expect(body.data.income.gross).toBe(2500);
    expect(body.moduleResult?.status).toBe('success');
    expect(body.moduleResult?.payload.income.gross).toBe(2500);
    expect(body.moduleResult?.meta.executionId).toBeDefined();
  });

  it('returns projection-only response by default when envelope mode is disabled', async () => {
    process.env.ARRIVALOS_MRC_ENVELOPE = 'false';
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {},
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    const executeRes = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {
          grossIncome: 2000,
          taxClass: 1,
          churchTax: false,
          householdSize: 1,
          monthlyRent: 700,
          employmentStatus: 'employed',
          maritalStatus: 'single',
        },
      },
    });

    const body = executeRes.json() as {
      projection?: { status: string; moduleId: string };
      moduleResult?: unknown;
      data?: unknown;
      success?: boolean;
    };
    expect(body.projection?.status).toBe('success');
    expect(body.projection?.moduleId).toBe('financial-reality');
    expect(body.moduleResult).toBeUndefined();
    expect(body.data).toBeUndefined();
    expect(body.success).toBeUndefined();
  });
});
