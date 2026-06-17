import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../build-app.js';
import { accountService } from '../account/account.service.js';
import { FileEntitlementStore } from './entitlement.store.js';
import {
  entitlementService,
  EntitlementService,
} from './entitlement.service.js';
import { createDefaultEntitlements } from './entitlement.types.js';
import { buildUiSnapshot } from '../state/snapshot-projection-engine.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../test-state.js';

describe('EntitlementService', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('defaults new account entitlements to free tier with empty modules', async () => {
    const account = await accountService.createAccount();
    const entitlements = await entitlementService.getEntitlements(account.id);

    expect(entitlements).toEqual(createDefaultEntitlements(account.id));
  });

  it('allows anonymous execution regardless of entitlements', () => {
    const entitlements = createDefaultEntitlements('acct_test');
    const service = new EntitlementService();

    expect(service.canExecuteModule(entitlements, 'financial-reality', null)).toBe(true);
  });

  it('blocks free tier from modules not in entitlements.modules', () => {
    const entitlements = createDefaultEntitlements('acct_test');
    const service = new EntitlementService();

    expect(service.canExecuteModule(entitlements, 'financial-reality', 'acct_test')).toBe(false);
    expect(() =>
      service.assertModuleExecutionAllowed(entitlements, 'financial-reality', 'acct_test')
    ).toThrow(/Module access denied/);
  });

  it('allows free tier when module is explicitly granted', () => {
    const entitlements = {
      ...createDefaultEntitlements('acct_test'),
      modules: ['financial-reality'],
    };
    const service = new EntitlementService();

    expect(service.canExecuteModule(entitlements, 'financial-reality', 'acct_test')).toBe(true);
  });

  it('allows premium tier to execute any module', () => {
    const entitlements = {
      ...createDefaultEntitlements('acct_test'),
      tier: 'premium' as const,
      modules: [],
    };
    const service = new EntitlementService();

    expect(service.canExecuteModule(entitlements, 'financial-reality', 'acct_test')).toBe(true);
  });

  it('marks ungranted modules as premium-required in snapshot projection', () => {
    const entitlements = createDefaultEntitlements('acct_test');
    const snapshot = buildUiSnapshot(
      {
        accountId: 'acct_test',
        session: {
          id: 'sess_test',
          createdAt: '2026-06-01T00:00:00.000Z',
          lastActiveAt: '2026-06-01T00:00:00.000Z',
          context: {},
        },
        profileRecord: null,
        profileRevisions: [],
        executionsByModuleId: {},
        executionTracesByModuleId: {},
        events: [],
        modules: [
          { id: 'financial-reality', name: 'Financial Reality' },
          { id: 'life-event', name: 'Life Event' },
        ],
        projectionConfig: { uxSnapshotEnabled: false },
        generatedAt: '2026-06-01T00:00:00.000Z',
        version: {
          snapshotVersion: 1,
          stateHash: 'hash',
          lastMutationId: 'mut',
        },
      },
      { entitlements }
    );

    expect(snapshot.modules.every((module) => module.access === 'premium-required')).toBe(true);
  });

  it('marks all modules available for premium tier in snapshot projection', () => {
    const entitlements = {
      ...createDefaultEntitlements('acct_test'),
      tier: 'premium' as const,
    };
    const snapshot = buildUiSnapshot(
      {
        accountId: 'acct_test',
        session: {
          id: 'sess_test',
          createdAt: '2026-06-01T00:00:00.000Z',
          lastActiveAt: '2026-06-01T00:00:00.000Z',
          context: {},
        },
        profileRecord: null,
        profileRevisions: [],
        executionsByModuleId: {},
        executionTracesByModuleId: {},
        events: [],
        modules: [{ id: 'financial-reality', name: 'Financial Reality' }],
        projectionConfig: { uxSnapshotEnabled: false },
        generatedAt: '2026-06-01T00:00:00.000Z',
        version: {
          snapshotVersion: 1,
          stateHash: 'hash',
          lastMutationId: 'mut',
        },
      },
      { entitlements }
    );

    expect(snapshot.modules[0]?.access).toBe('available');
  });
});

describe('module execution entitlements', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  async function createSession(): Promise<string> {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {},
    });
    return (res.json() as { sessionId: string }).sessionId;
  }

  async function claimSession(sessionId: string): Promise<string> {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: { 'x-session-id': sessionId },
    });
    return (res.json() as { accountId: string }).accountId;
  }

  it('allows anonymous session to execute modules without entitlement checks', async () => {
    const app = await buildApp();
    const sessionId = await createSession();

    const res = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      headers: { 'x-session-id': sessionId },
      payload: { grossMonthlyIncome: 2000 },
    });

    expect(res.statusCode).toBe(200);
  });

  it('blocks free claimed account from restricted module execution', async () => {
    const app = await buildApp();
    const sessionId = await createSession();
    await claimSession(sessionId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      headers: { 'x-session-id': sessionId },
      payload: { grossMonthlyIncome: 2000 },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'Module access denied' });
  });

  it('allows free claimed account when module is granted', async () => {
    const app = await buildApp();
    const sessionId = await createSession();
    const accountId = await claimSession(sessionId);

    await entitlementService.saveEntitlements({
      accountId,
      tier: 'free',
      modules: ['financial-reality'],
      features: {},
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      headers: { 'x-session-id': sessionId },
      payload: { grossMonthlyIncome: 2000 },
    });

    expect(res.statusCode).toBe(200);
  });

  it('allows premium account to execute all modules', async () => {
    const app = await buildApp();
    const sessionId = await createSession();
    const accountId = await claimSession(sessionId);

    await entitlementService.saveEntitlements({
      accountId,
      tier: 'premium',
      modules: [],
      features: {},
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      headers: { 'x-session-id': sessionId },
      payload: { grossMonthlyIncome: 2000 },
    });

    expect(res.statusCode).toBe(200);
  });

  it('snapshot shows premium-required modules for free claimed account', async () => {
    const app = await buildApp();
    const sessionId = await createSession();
    await claimSession(sessionId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });

    expect(res.statusCode).toBe(200);
    const snapshot = res.json() as { modules: Array<{ id: string; access?: string }> };
    expect(snapshot.modules.length).toBeGreaterThan(0);
    expect(snapshot.modules.every((module) => module.access === 'premium-required')).toBe(true);
  });

  it('anonymous snapshot omits module access metadata', async () => {
    const app = await buildApp();
    const sessionId = await createSession();

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });

    expect(res.statusCode).toBe(200);
    const snapshot = res.json() as { modules: Array<{ access?: string }> };
    expect(snapshot.modules.every((module) => module.access === undefined)).toBe(true);
  });
});

describe('account claim entitlements', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('creates default entitlements when account is claimed', async () => {
    const app = await buildApp();
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {},
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    const claimRes = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: { 'x-session-id': sessionId },
    });
    const { accountId } = claimRes.json() as { accountId: string };

    const store = new FileEntitlementStore(process.env.ARRIVALOS_ENTITLEMENTS_DIR!);
    const entitlements = await store.getByAccountId(accountId);

    expect(entitlements).toEqual(createDefaultEntitlements(accountId));

    const state = await systemStateCoordinator.getState(sessionId);
    expect(state?.accountId).toBe(accountId);
  });
});
