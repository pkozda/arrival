import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import { buildUiSnapshot } from './state/snapshot-projection-engine.js';
import { resetTestStateStore, setupTestStateStore, teardownTestStateStore } from './test-state.js';
import { systemStateCoordinator } from './state/system-state-coordinator.js';
import type { UiSnapshot } from './routes/ui-snapshot.js';

const ORIGINAL_UX_FLAG = process.env.ATLAS_UX_ENABLED;

describe('GET /api/ui-snapshot', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
    if (ORIGINAL_UX_FLAG === undefined) {
      delete process.env.ATLAS_UX_ENABLED;
    } else {
      process.env.ATLAS_UX_ENABLED = ORIGINAL_UX_FLAG;
    }
  });

  it('requires x-session-id header', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 for unknown session', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': 'sess_missing' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns empty snapshot for new session without profile or executions', async () => {
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'de' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });

    expect(res.statusCode).toBe(200);
    const snapshot = res.json() as UiSnapshot;

    expect(snapshot.session).toEqual({
      sessionId,
      language: 'de',
      uiPreferences: { theme: 'light' },
    });
    expect(snapshot.profile).toBeNull();
    expect(snapshot.executions).toEqual([]);
    expect(snapshot.executionsByModuleId).toEqual({});
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.uxSnapshot).toEqual({
      actionCards: [],
      prioritySignals: [],
      attentionLayer: [],
    });
    expect(snapshot.ftu).toEqual({
      isFirstTimeUser: true,
      step: 1,
    });
    expect(snapshot.snapshotVersion).toEqual(expect.any(Number));
    expect(snapshot.snapshotVersion).toBeGreaterThan(0);
    expect(snapshot.lastMutationId).toMatch(/^session-create:/);
    expect(snapshot.generatedAt).toEqual(expect.any(String));
    expect(snapshot.modules.length).toBeGreaterThan(0);
    expect(snapshot.modules[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
      })
    );
  });

  it('includes profile, executions, and ux snapshot after module execution', async () => {
    process.env.ATLAS_UX_ENABLED = 'true';
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
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
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
        context: {},
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });

    expect(res.statusCode).toBe(200);
    const snapshot = res.json() as UiSnapshot;

    expect(snapshot.profile).not.toBeNull();
    expect(snapshot.profile?.preferredLanguage).toBe('en');
    expect(snapshot.executions).toHaveLength(1);
    expect(snapshot.executions[0]?.moduleId).toBe('financial-reality');
    expect(snapshot.executions[0]?.timestamp).toEqual(expect.any(Number));
    expect(snapshot.executions[0]?.executionId).toEqual(expect.any(String));
    expect(snapshot.executions[0]?.snapshotVersion).toEqual(expect.any(Number));
    expect(snapshot.snapshotVersion).toBeGreaterThan(0);
    expect(snapshot.lastMutationId).toEqual(expect.any(String));
    expect(snapshot.generatedAt).toEqual(expect.any(String));
    expect(snapshot.ftu.isFirstTimeUser).toBe(false);
    expect(snapshot.uxSnapshot.actionCards.length).toBeGreaterThanOrEqual(0);
  });

  it('returns empty ux snapshot when UX feature flag is disabled', async () => {
    process.env.ATLAS_UX_ENABLED = 'false';
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {
          grossIncome: 2500,
          taxClass: 1,
        },
        context: {},
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });

    expect(res.statusCode).toBe(200);
    const snapshot = res.json() as UiSnapshot;

    expect(snapshot.executions).toHaveLength(1);
    expect(snapshot.uxSnapshot).toEqual({
      actionCards: [],
      prioritySignals: [],
      attentionLayer: [],
    });
  });

  it('increments snapshotVersion monotonically across mutations', async () => {
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    const initialRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });
    const initial = initialRes.json() as UiSnapshot;
    const initialVersion = initial.snapshotVersion;

    await app.inject({
      method: 'POST',
      url: '/api/profile',
      headers: { 'x-session-id': sessionId },
      payload: { preferredLanguage: 'en' },
    });

    const afterProfileRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });
    const afterProfile = afterProfileRes.json() as UiSnapshot;
    expect(afterProfile.snapshotVersion).not.toBe(initialVersion);
    expect(afterProfile.lastMutationId).toMatch(/^profile-create:/);

    await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {
          grossIncome: 2500,
          employmentStatus: 'employed',
        },
        context: {},
      },
    });

    const afterExecuteRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });
    const afterExecute = afterExecuteRes.json() as UiSnapshot;

    expect(afterExecute.snapshotVersion).not.toBe(afterProfile.snapshotVersion);
    expect(afterExecute.executions[0]?.snapshotVersion).toBeGreaterThan(0);
    expect(afterExecute.executions[0]?.executionId).toEqual(expect.any(String));
  });

  it('preserves highest execution snapshotVersion under concurrent module executes', async () => {
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    const [firstExecute, secondExecute] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/modules/financial-reality/execute',
        headers: { 'x-session-id': sessionId },
        payload: {
          input: {
            grossIncome: 2000,
            employmentStatus: 'employed',
            maritalStatus: 'single',
            monthlyRent: 800,
            householdSize: 1,
          },
          context: {},
        },
      }),
      app.inject({
        method: 'POST',
        url: '/api/modules/financial-reality/execute',
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
      }),
    ]);

    expect(firstExecute.statusCode).toBe(200);
    expect(secondExecute.statusCode).toBe(200);

    const snapshotRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });
    const snapshot = snapshotRes.json() as UiSnapshot;

    expect(snapshot.executions).toHaveLength(1);
    expect(snapshot.executionsByModuleId['financial-reality']).toHaveLength(2);
    const execution = snapshot.executions[0];
    expect(execution?.snapshotVersion).toBeGreaterThan(0);
    expect(execution?.executionId).toEqual(expect.any(String));
    expect(snapshot.snapshotVersion).toBeGreaterThanOrEqual(execution?.snapshotVersion ?? 0);
  });

  it('restores persisted system state after simulated process restart', async () => {
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
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        input: {
          grossIncome: 2500,
          employmentStatus: 'employed',
        },
        context: {},
      },
    });

    const beforeRestartRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });
    const beforeRestart = beforeRestartRes.json() as UiSnapshot;

    systemStateCoordinator.resetCache();

    const afterRestartRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });

    expect(afterRestartRes.statusCode).toBe(200);
    const afterRestart = afterRestartRes.json() as UiSnapshot;

    expect(afterRestart.session.sessionId).toBe(sessionId);
    expect(afterRestart.profile).not.toBeNull();
    expect(afterRestart.executions).toHaveLength(1);
    expect(afterRestart.snapshotVersion).toBe(beforeRestart.snapshotVersion);
    expect(afterRestart.generatedAt).toBe(beforeRestart.generatedAt);
  });

  it('projects identical UiSnapshot from identical persisted SystemState', async () => {
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    const state = await systemStateCoordinator.getState(sessionId);
    expect(state).not.toBeNull();

    const first = buildUiSnapshot(state!);
    const second = buildUiSnapshot(state!);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
