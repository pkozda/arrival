import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';
import { validateEconomicRealityPlanResponse } from './economic-reality-plan-validation.js';
import { ER_COPY_KEYS } from '@arrival-atlas/product-contract';

async function createSession(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  const sessionRes = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: { context: { userProfile: { language: 'en' } } },
  });
  return (sessionRes.json() as { sessionId: string }).sessionId;
}

function housingCorrection(revision: number, city: string) {
  return {
    id: `req-housing-${revision}`,
    requestId: `req-housing-${revision}`,
    timestamp: new Date().toISOString(),
    type: 'fact.correct' as const,
    intent: 'correction' as const,
    domain: 'housing' as const,
    source: { kind: 'profile_ui' as const, domain: 'housing' as const },
    payload: {
      kind: 'domain_facts' as const,
      domain: 'housing' as const,
      fields: { city },
    },
    confidence: 1,
    userConfirmationRequired: false,
    expectedHeadRevision: revision,
  };
}

function migrationConfirmCorrection(revision: number) {
  return {
    id: `req-migration-${revision}`,
    requestId: `req-migration-${revision}`,
    timestamp: new Date().toISOString(),
    type: 'fact.correct' as const,
    intent: 'correction' as const,
    domain: 'migration' as const,
    source: { kind: 'profile_ui' as const, domain: 'migration' as const },
    payload: {
      kind: 'domain_facts' as const,
      domain: 'migration' as const,
      fields: {
        residencyStatus: 'temporary-resident',
        municipalRegistrationConfirmed: true,
      },
    },
    confidence: 1,
    userConfirmationRequired: false,
    expectedHeadRevision: revision,
  };
}

function registrationActions(body: ReturnType<typeof validateEconomicRealityPlanResponse>) {
  return body.actionSet.actions.filter(
    (action) =>
      action.sourceNodeId === 'g2-registration' ||
      action.sourceNodeId === 'g5-registration' ||
      action.sourceNodeId === 'g6-arrival-proof'
  );
}

describe('PD-002 Action Planner vertical slice (API)', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('housing save removes housing CTA and surfaces confirm; confirm completes registration gate', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    // Seed tourist crisis path so g5-registration is active without address.
    await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload: {
        id: 'req-seed-migration',
        requestId: 'req-seed-migration',
        timestamp: new Date().toISOString(),
        type: 'fact.correct',
        intent: 'correction',
        domain: 'migration',
        source: { kind: 'profile_ui', domain: 'migration' },
        payload: {
          kind: 'domain_facts',
          domain: 'migration',
          fields: { residencyStatus: 'tourist', arrivedAt: new Date().toISOString() },
        },
        confidence: 1,
        userConfirmationRequired: false,
        expectedHeadRevision: 0,
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload: {
        id: 'req-seed-employment',
        requestId: 'req-seed-employment',
        timestamp: new Date().toISOString(),
        type: 'fact.correct',
        intent: 'correction',
        domain: 'employment',
        source: { kind: 'profile_ui', domain: 'employment' },
        payload: {
          kind: 'domain_facts',
          domain: 'employment',
          fields: { employmentStatus: 'unemployed' },
        },
        confidence: 1,
        userConfirmationRequired: false,
        expectedHeadRevision: 1,
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload: {
        id: 'req-seed-benefits',
        requestId: 'req-seed-benefits',
        timestamp: new Date().toISOString(),
        type: 'fact.correct',
        intent: 'correction',
        domain: 'benefits',
        source: { kind: 'profile_ui', domain: 'benefits' },
        payload: {
          kind: 'domain_facts',
          domain: 'benefits',
          fields: { daysInGermany: 5 },
        },
        confidence: 1,
        userConfirmationRequired: false,
        expectedHeadRevision: 2,
      },
    });

    const beforeHousing = validateEconomicRealityPlanResponse(
      (
        await app.inject({
          method: 'GET',
          url: '/api/modules/economic-reality/plan',
          headers: { 'x-session-id': sessionId },
        })
      ).json()
    );

    const beforeReg = registrationActions(beforeHousing);
    expect(beforeReg.some((action) => action.id.endsWith(':profile-housing'))).toBe(true);
    expect(beforeReg.some((action) => action.id.endsWith(':profile-confirm-registration'))).toBe(
      false
    );

    const housingSave = await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload: housingCorrection(3, 'Bremen'),
    });
    expect(housingSave.statusCode).toBe(200);

    const afterHousing = validateEconomicRealityPlanResponse(
      (
        await app.inject({
          method: 'GET',
          url: '/api/modules/economic-reality/plan',
          headers: { 'x-session-id': sessionId },
        })
      ).json()
    );

    expect(afterHousing.meta.deterministicHash).not.toBe(beforeHousing.meta.deterministicHash);
    const afterReg = registrationActions(afterHousing);
    expect(afterReg.some((action) => action.id.endsWith(':profile-housing'))).toBe(false);
    expect(afterReg.some((action) => action.id.endsWith(':profile-confirm-registration'))).toBe(
      true
    );
    expect(
      afterReg.find((action) => action.id.endsWith(':profile-confirm-registration'))?.labelKey
    ).toBe(ER_COPY_KEYS.ACTION_CONFIRM_REGISTRATION);

    const confirmSave = await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload: migrationConfirmCorrection(4),
    });
    expect(confirmSave.statusCode).toBe(200);

    const afterConfirm = validateEconomicRealityPlanResponse(
      (
        await app.inject({
          method: 'GET',
          url: '/api/modules/economic-reality/plan',
          headers: { 'x-session-id': sessionId },
        })
      ).json()
    );

    expect(afterConfirm.meta.deterministicHash).not.toBe(afterHousing.meta.deterministicHash);
    const finalReg = registrationActions(afterConfirm);
    expect(finalReg.some((action) => action.id.endsWith(':profile-housing'))).toBe(false);
    expect(finalReg.some((action) => action.id.endsWith(':profile-confirm-registration'))).toBe(
      false
    );
    expect(afterConfirm.execution.completedNodeIds).toContain('g5-registration');
  });
});
