import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';

async function createSession(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  const sessionRes = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: { context: { userProfile: { language: 'en' } } },
  });
  return (sessionRes.json() as { sessionId: string }).sessionId;
}

describe('PD-003 Healthcare progressive enrichment (API)', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('G — MORE_INFO_REQUIRED when insurance unknown (HTTP 200 with explicit outcome)', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/modules/healthcare-navigation/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {
          situation: 'need-doctor',
          urgency: 'routine',
        },
        context: { userProfile: { language: 'en' } },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      projection: {
        status: string;
        outcome?: string;
        insuranceAssumption?: string;
        recommendations: unknown[];
        missingContext?: Array<{ field: string }>;
      };
    };

    expect(body.projection.status).toBe('success');
    expect(body.projection.outcome).toBe('MORE_INFO_REQUIRED');
    expect(body.projection.insuranceAssumption).toBe('unknown');
    expect(body.projection.recommendations).toEqual([]);
    expect(body.projection.missingContext?.some((item) => item.field === 'insurance')).toBe(true);
  });

  it('A/F — RECOMMENDATIONS when situation + insurance known', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/modules/healthcare-navigation/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {
          situation: 'need-doctor',
          hasInsurance: true,
          insuranceType: 'public',
          urgency: 'routine',
        },
        context: { userProfile: { language: 'en' } },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      projection: {
        status: string;
        outcome?: string;
        recommendations: Array<{ title: string }>;
        summary?: string;
      };
    };

    expect(body.projection.status).toBe('success');
    expect(body.projection.outcome).toBe('RECOMMENDATIONS');
    expect(body.projection.recommendations.length).toBeGreaterThan(0);
    expect(body.projection.summary).toBeTruthy();
  });
});
