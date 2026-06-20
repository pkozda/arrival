import { beforeEach, describe, expect, it, afterEach } from 'vitest';
import { buildApp } from './build-app.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';
import { FilePersistedSystemStateStore } from './state/persisted-system-state-store.js';
import { systemStateCoordinator } from './state/system-state-coordinator.js';
import { SessionMutationEventLog } from './state/session-mutation-event-log.js';
import { rebuildUserContextFromEvents } from './state/apply-profile-mutation.js';
import { buildUiSnapshot } from './state/snapshot-projection-engine.js';
import type { MutationEvent } from '@arrival-atlas/product-contract';

function correctionRequest(
  requestId: string,
  revision: number,
  income = 2500
) {
  return {
    id: requestId,
    requestId,
    timestamp: new Date().toISOString(),
    type: 'fact.correct' as const,
    intent: 'correction' as const,
    domain: 'income' as const,
    source: { kind: 'profile_ui' as const, domain: 'income' as const },
    payload: {
      kind: 'domain_facts' as const,
      domain: 'income' as const,
      fields: { grossMonthlyIncome: income },
    },
    confidence: 1,
    userConfirmationRequired: false,
    expectedHeadRevision: revision,
  };
}

async function createSession(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  const sessionRes = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: { context: { userProfile: { language: 'en' } } },
  });
  return (sessionRes.json() as { sessionId: string }).sessionId;
}

describe('POST /api/mutations', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('accepts a valid correction mutation and returns UserContextV1', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload: correctionRequest('req-valid-1', 0),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      success: boolean;
      revision: number;
      appliedEventId: string;
      userContext: { profile: { domains: { income?: { grossMonthlyIncome?: number } } } | null };
    };

    expect(body.success).toBe(true);
    expect(body.revision).toBe(1);
    expect(body.appliedEventId).toMatch(/^evt_/);
    expect(body.userContext.profile?.domains.income?.grossMonthlyIncome).toBe(2500);
  });

  it('returns 409 on revision conflict', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload: correctionRequest('req-conflict-a', 0),
    });

    const conflict = await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload: correctionRequest('req-conflict-b', 0, 3000),
    });

    expect(conflict.statusCode).toBe(409);
    expect((conflict.json() as { code: string }).code).toBe('REVISION_CONFLICT');
  });

  it('returns 400 for invalid payload', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload: { requestId: 'broken' },
    });

    expect(response.statusCode).toBe(400);
    expect((response.json() as { code: string }).code).toBe('INVALID_MUTATION');
  });

  it('rejects scenario-only field keys at schema validation', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload: {
        ...correctionRequest('req-scenario', 0),
        payload: {
          kind: 'domain_facts',
          domain: 'income',
          fields: { proposedGrossIncome: 9999 },
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect((response.json() as { code: string }).code).toBe('INVALID_MUTATION');
  });

  it('is idempotent for duplicate requestId', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);
    const payload = correctionRequest('req-idempotent', 0);

    const first = await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload,
    });

    const second = await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);

    const firstBody = first.json() as { revision: number; appliedEventId: string };
    const secondBody = second.json() as { revision: number; appliedEventId: string };
    expect(secondBody.revision).toBe(firstBody.revision);
    expect(secondBody.appliedEventId).toBe(firstBody.appliedEventId);
  });
});

describe('GET /api/user-context', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('returns snapshot-first user context without exposing event log', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload: correctionRequest('req-read-ctx', 0),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/user-context',
      headers: { 'x-session-id': sessionId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-user-context-authority']).toBe('authoritative');
    expect(response.headers['x-read-model']).toBe('UserContextV1');
    const body = response.json() as Record<string, unknown>;
    expect(body.profile).toBeTruthy();
    expect(body.events).toBeUndefined();
    expect(body.profileMutationEvents).toBeUndefined();
  });
});

describe('profile mutation persistence', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('keeps append-only ordering stable after reload', async () => {
    const store = setupTestStateStore();
    const app = await buildApp();
    const sessionId = await createSession(app);

    await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload: correctionRequest('persist-req-1', 0, 2000),
    });

    await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload: correctionRequest('persist-req-2', 1, 2200),
    });

    systemStateCoordinator.resetCache();
    const reloaded = await store.load(sessionId);
    expect(reloaded?.profileMutationEvents).toHaveLength(2);
    expect(reloaded?.profileMutationEvents[0]!.sequence).toBeLessThan(
      reloaded?.profileMutationEvents[1]!.sequence ?? 0
    );
  });

  it('SessionMutationEventLog rejects duplicate mutationId on append', () => {
    const events: MutationEvent[] = [];
    const log = new SessionMutationEventLog('prof_test', events);
    const event = {
      eventId: 'evt_1_a',
      mutationId: 'mut_a',
      profileId: 'prof_test',
      sequence: 1,
      revision: 1,
      timestamp: new Date().toISOString(),
      committedAt: new Date().toISOString(),
      type: 'fact.create' as const,
      intent: 'capture' as const,
      domain: 'income' as const,
      payload: {
        kind: 'domain_facts' as const,
        domain: 'income' as const,
        fields: { grossMonthlyIncome: 1000 },
      },
      fieldDeltas: [],
      source: { kind: 'module' as const, moduleId: 'financial-reality' },
      confidence: 1,
      reason: 'test',
    };

    log.append(event);
    log.append({ ...event, eventId: 'evt_1_b' });

    expect(events).toHaveLength(1);
  });
});

describe('profile mutation snapshot bridge', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('updates ui snapshot userContext after event append', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { 'x-session-id': sessionId },
      payload: correctionRequest('snap-req-1', 0, 1800),
    });

    const state = await systemStateCoordinator.getState(sessionId);
    expect(state).toBeTruthy();

    const snapshot = buildUiSnapshot(state!);
    expect(snapshot).not.toHaveProperty('profile');
    expect(snapshot.userContext.profile?.domains.income?.grossMonthlyIncome).toBe(1800);

    const rebuilt = rebuildUserContextFromEvents({
      ...state!,
      userContext: null,
    });
    expect(rebuilt.userContext?.profile?.domains.income?.grossMonthlyIncome).toBe(1800);
  });
});

describe('module execution → mutation → user-context integration', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('persists module capture through mutation log and exposes user-context', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    const executeRes = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute?contractVersion=legacy',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {
          grossIncome: 3200,
          employmentStatus: 'employed',
          maritalStatus: 'single',
          monthlyRent: 950,
          householdSize: 2,
        },
        context: {},
      },
    });

    expect(executeRes.statusCode).toBe(200);

    const state = await systemStateCoordinator.getState(sessionId);
    expect(state?.profileMutationEvents.length).toBeGreaterThan(0);

    const userContextRes = await app.inject({
      method: 'GET',
      url: '/api/user-context',
      headers: { 'x-session-id': sessionId },
    });

    expect(userContextRes.statusCode).toBe(200);
    const userContext = userContextRes.json() as {
      profile: {
        domains: {
          income?: { grossMonthlyIncome?: number };
          housing?: { monthlyColdRent?: number };
        };
      } | null;
    };

    expect(userContext.profile?.domains.income?.grossMonthlyIncome).toBe(3200);
    expect(userContext.profile?.domains.housing?.monthlyColdRent).toBe(950);
  });

  it('survives coordinator cache reset via persisted store', async () => {
    const store = setupTestStateStore() as FilePersistedSystemStateStore;
    const app = await buildApp();
    const sessionId = await createSession(app);

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

    systemStateCoordinator.resetCache();
    const reloaded = await store.load(sessionId);
    expect(reloaded?.profileMutationEvents.length).toBeGreaterThan(0);

    const userContextRes = await app.inject({
      method: 'GET',
      url: '/api/user-context',
      headers: { 'x-session-id': sessionId },
    });

    expect(userContextRes.statusCode).toBe(200);
    const userContext = userContextRes.json() as {
      profile: { domains: { healthInsurance?: { hasCoverage?: boolean; insuranceType?: string } } } | null;
    };
    expect(userContext.profile?.domains.healthInsurance?.hasCoverage).toBe(true);
    expect(userContext.profile?.domains.healthInsurance?.insuranceType).toBe('public');
  });
});
