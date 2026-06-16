import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from './build-app.js';
import { profileStore } from './profile-runtime.js';
import { clearExecutionTraces } from './execution-trace-store.js';
import {
  attachUxToExecutionResult,
  isAtlasUxEnabled,
} from './ux-integration.js';
import * as uxPackage from '@arrivalos/ux';

const ORIGINAL_UX_FLAG = process.env.ATLAS_UX_ENABLED;

afterEach(() => {
  if (ORIGINAL_UX_FLAG === undefined) {
    delete process.env.ATLAS_UX_ENABLED;
  } else {
    process.env.ATLAS_UX_ENABLED = ORIGINAL_UX_FLAG;
  }
  vi.restoreAllMocks();
});

describe('attachUxToExecutionResult', () => {
  it('returns empty UX plan when module outputs are empty', () => {
    process.env.ATLAS_UX_ENABLED = 'true';

    const enriched = attachUxToExecutionResult({
      moduleId: 'unknown-module',
      version: '1.0.0',
      success: true,
      data: { value: 1 },
      executedAt: new Date().toISOString(),
    });

    expect(enriched.ux).toEqual({
      actions: [],
      summary: 'No urgent actions identified at this time.',
    });
  });

  it('prioritizes mixed module outputs', () => {
    process.env.ATLAS_UX_ENABLED = 'true';

    const enriched = attachUxToExecutionResult(
      {
        moduleId: 'financial-reality',
        version: '2.0.0',
        success: true,
        data: { adminRules: [] },
        executedAt: new Date().toISOString(),
      },
      [
        {
          domain: 'healthcare-navigation',
          result: { status: 'no_insurance' },
        },
        {
          domain: 'financial-reality',
          result: { rule: 'anmeldung_required', daysInGermany: 90 },
        },
      ]
    );

    expect(enriched.ux?.actions.map((action) => action.id)).toEqual([
      'anmeldung',
      'choose-insurance',
    ]);
  });

  it('returns original response when feature flag is disabled', () => {
    process.env.ATLAS_UX_ENABLED = 'false';

    const result = {
      moduleId: 'financial-reality',
      version: '2.0.0',
      success: true as const,
      data: { adminRules: ['Anmeldung'] },
      executedAt: new Date().toISOString(),
    };

    const enriched = attachUxToExecutionResult(result);

    expect(enriched).toEqual(result);
    expect(enriched.ux).toBeUndefined();
  });

  it('falls back to original response when UX transformation fails', () => {
    process.env.ATLAS_UX_ENABLED = 'true';

    vi.spyOn(uxPackage, 'buildUXActionPlan').mockImplementation(() => {
      throw new Error('UX transformation failed');
    });

    const result = {
      moduleId: 'financial-reality',
      version: '2.0.0',
      success: true as const,
      data: { adminRules: ['Anmeldung'] },
      executedAt: new Date().toISOString(),
    };

    const enriched = attachUxToExecutionResult(result);

    expect(enriched).toEqual(result);
    expect(enriched.ux).toBeUndefined();
  });
});

describe('API UX integration', () => {
  beforeEach(() => {
    profileStore.clear();
    clearExecutionTraces();
    process.env.ATLAS_UX_ENABLED = 'true';
  });

  it('includes UX actions and summary for financial-reality execution', async () => {
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    await app.inject({
      method: 'POST',
      url: '/api/profile',
      headers: { 'x-session-id': sessionId },
      payload: { preferredLanguage: 'en' },
    });

    await app.inject({
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

    const executeRes = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {},
        context: {},
      },
    });

    expect(executeRes.statusCode).toBe(200);

    const body = executeRes.json() as {
      success: boolean;
      data: { income: { gross: number } };
      ux?: {
        actions: Array<{ id: string; priority: string }>;
        summary: string;
      };
    };

    expect(body.success).toBe(true);
    expect(body.data.income.gross).toBe(2500);
    expect(body.ux).toBeDefined();
    expect(body.ux?.actions.some((action) => action.id === 'anmeldung')).toBe(true);
    expect(body.ux?.actions[0]?.priority).toBe('high');
    expect(body.ux?.summary).toContain('register your address');
  });

  it('omits ux field when feature flag is disabled', async () => {
    process.env.ATLAS_UX_ENABLED = 'false';

    const app = await buildApp();

    const executeRes = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      payload: {
        input: {
          grossIncome: 2500,
          taxClass: 1,
          churchTax: false,
        },
        context: {},
      },
    });

    expect(executeRes.statusCode).toBe(200);

    const body = executeRes.json() as {
      success: boolean;
      ux?: unknown;
    };

    expect(body.success).toBe(true);
    expect(body.ux).toBeUndefined();
    expect(isAtlasUxEnabled()).toBe(false);
  });

  it('still returns module result when UX transformation fails', async () => {
    process.env.ATLAS_UX_ENABLED = 'true';

    vi.spyOn(uxPackage, 'buildUXActionPlan').mockImplementation(() => {
      throw new Error('UX transformation failed');
    });

    const app = await buildApp();

    const executeRes = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      payload: {
        input: {
          grossIncome: 2500,
          taxClass: 1,
          churchTax: false,
        },
        context: {},
      },
    });

    expect(executeRes.statusCode).toBe(200);

    const body = executeRes.json() as {
      success: boolean;
      data: { income: { gross: number } };
      ux?: unknown;
    };

    expect(body.success).toBe(true);
    expect(body.data.income.gross).toBe(2500);
    expect(body.ux).toBeUndefined();
  });
});
