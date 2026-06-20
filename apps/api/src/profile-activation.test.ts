import { beforeEach, describe, expect, it, afterEach } from 'vitest';
import { buildApp } from './build-app.js';
import { resetTestStateStore, setupTestStateStore, teardownTestStateStore } from './test-state.js';
import { moduleInputToProfilePatch } from './profile-activation.js';

describe('moduleInputToProfilePatch', () => {
  it('maps financial-reality input to profile sections', () => {
    const patch = moduleInputToProfilePatch('financial-reality', {
      grossIncome: 3200,
      employmentStatus: 'employed',
      maritalStatus: 'single',
      monthlyRent: 950,
      householdSize: 2,
    });

    expect(patch).toEqual({
      employment: {
        grossMonthlyIncome: 3200,
        status: 'employed',
      },
      household: {
        maritalStatus: 'single',
        size: 2,
      },
      housing: {
        monthlyColdRent: 950,
      },
    });
  });

  it('maps healthcare-navigation input to insurance section', () => {
    const patch = moduleInputToProfilePatch('healthcare-navigation', {
      hasInsurance: true,
      insuranceType: 'public',
    });

    expect(patch).toEqual({
      insurance: {
        hasCoverage: true,
        type: 'public',
      },
    });
  });
});

describe('profile activation integration', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('scenario 1: financial-reality execution persists profile document', async () => {
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
          grossIncome: 3200,
          taxClass: 1,
          churchTax: false,
          householdSize: 2,
          monthlyRent: 950,
          employmentStatus: 'employed',
          maritalStatus: 'single',
        },
        context: {},
      },
    });

    expect(executeRes.statusCode).toBe(200);

    const profileRes = await app.inject({
      method: 'GET',
      url: '/api/profile',
      headers: { 'x-session-id': sessionId },
    });

    expect(profileRes.statusCode).toBe(200);
    const profile = profileRes.json() as {
      profile: {
        employment?: { grossMonthlyIncome?: number; status?: string };
        housing?: { monthlyColdRent?: number };
        household?: { size?: number; maritalStatus?: string };
      };
    };

    expect(profile.profile.employment?.grossMonthlyIncome).toBe(3200);
    expect(profile.profile.employment?.status).toBe('employed');
    expect(profile.profile.housing?.monthlyColdRent).toBe(950);
    expect(profile.profile.household?.size).toBe(2);
    expect(profile.profile.household?.maritalStatus).toBe('single');
  });

  it('scenario 2: ui-snapshot exposes userContext after execution (not legacy profile field)', async () => {
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute?contractVersion=legacy',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {
          grossIncome: 3200,
          taxClass: 1,
          householdSize: 2,
          monthlyRent: 950,
          employmentStatus: 'employed',
          maritalStatus: 'single',
        },
        context: {},
      },
    });

    const snapshotRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });

    expect(snapshotRes.statusCode).toBe(200);
    const snapshot = snapshotRes.json() as {
      userContext: {
        profile: {
          domains: {
            income?: { grossMonthlyIncome?: number };
            housing?: { monthlyColdRent?: number };
          };
        } | null;
      };
    };

    expect(snapshot).not.toHaveProperty('profile');
    expect(snapshot.userContext.profile?.domains.income?.grossMonthlyIncome).toBe(3200);
    expect(snapshot.userContext.profile?.domains.housing?.monthlyColdRent).toBe(950);
  });

  it('scenario 3: second execution merges profile values when request input is empty', async () => {
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute?contractVersion=legacy',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {
          grossIncome: 3200,
          taxClass: 1,
          churchTax: false,
          householdSize: 2,
          monthlyRent: 950,
          employmentStatus: 'employed',
          maritalStatus: 'single',
        },
        context: {},
      },
    });

    const secondExecuteRes = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute?contractVersion=legacy',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {},
        context: {},
      },
    });

    expect(secondExecuteRes.statusCode).toBe(200);
    const body = secondExecuteRes.json() as {
      success: boolean;
      data: { income: { gross: number } };
    };

    expect(body.success).toBe(true);
    expect(body.data.income.gross).toBe(3200);

    const traceRes = await app.inject({
      method: 'GET',
      url: '/api/modules/financial-reality/trace',
      headers: { 'x-session-id': sessionId },
    });

    expect(traceRes.statusCode).toBe(200);
    const trace = traceRes.json() as {
      steps: Array<{ type: string; field?: string; source?: string }>;
    };

    expect(trace.steps).toEqual(
      expect.arrayContaining([
        { type: 'MERGE_DECISION', field: 'grossIncome', source: 'profile' },
      ])
    );
  });

  it('persists healthcare insurance fields after execution', async () => {
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    await app.inject({
      method: 'POST',
      url: '/api/modules/healthcare-navigation/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {
          situation: 'new-arrival',
          hasInsurance: true,
          insuranceType: 'public',
          urgency: 'routine',
        },
        context: {},
      },
    });

    const profileRes = await app.inject({
      method: 'GET',
      url: '/api/profile',
      headers: { 'x-session-id': sessionId },
    });

    expect(profileRes.statusCode).toBe(200);
    const profile = profileRes.json() as {
      profile: { insurance?: { hasCoverage?: boolean; type?: string } };
    };

    expect(profile.profile.insurance?.hasCoverage).toBe(true);
    expect(profile.profile.insurance?.type).toBe('public');
  });
});
