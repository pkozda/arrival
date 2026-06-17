import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../build-app.js';
import { AccountClaimService } from './account-claim.service.js';
import { AccountService } from './account.service.js';
import { FileAccountStore } from './account.store.js';
import { isAccountLinked } from '../state/system-state-account.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../test-state.js';

describe('POST /api/account/claim', () => {
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
      payload: { context: { userProfile: { language: 'en' } } },
    });
    return (res.json() as { sessionId: string }).sessionId;
  }

  it('requires authentication', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Authentication required' });
  });

  it('returns 404 for unknown session', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: { 'x-session-id': 'sess_missing' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('creates account and binds SystemState.accountId', async () => {
    const app = await buildApp();
    const sessionId = await createSession();

    const res = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: { 'x-session-id': sessionId },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      accountId: string;
      sessionId: string;
      linked: boolean;
      token: string;
      authSubject: string;
    };
    expect(body).toEqual({
      accountId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      ),
      sessionId,
      linked: true,
      token: expect.any(String),
      authSubject: expect.stringMatching(/^account:/),
    });

    const state = await systemStateCoordinator.getState(sessionId);
    expect(state?.accountId).toBe(body.accountId);
    expect(isAccountLinked(state!)).toBe(true);

    const accountStore = new FileAccountStore(process.env.ARRIVALOS_ACCOUNTS_DIR!);
    const account = await accountStore.getAccountById(body.accountId);
    expect(account).not.toBeNull();
    expect(account?.status).toBe('active');
  });

  it('emits account.claim event in SystemState', async () => {
    const app = await buildApp();
    const sessionId = await createSession();

    await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: { 'x-session-id': sessionId },
    });

    const state = await systemStateCoordinator.getState(sessionId);
    const claimEvent = state?.events.find((event) => event.type === 'account.claim');
    expect(claimEvent).toBeDefined();
    expect(claimEvent?.sessionId).toBe(sessionId);
    expect(claimEvent?.payload).toEqual({ accountId: state?.accountId });
  });

  it('is idempotent for repeated claims on the same session', async () => {
    const app = await buildApp();
    const sessionId = await createSession();

    const first = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: { 'x-session-id': sessionId },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: { 'x-session-id': sessionId },
    });

    const firstBody = first.json() as { accountId: string };
    const secondBody = second.json() as { accountId: string; linked: boolean };

    expect(second.statusCode).toBe(200);
    expect(secondBody.accountId).toBe(firstBody.accountId);
    expect(secondBody.linked).toBe(true);

    const accountStore = new FileAccountStore(process.env.ARRIVALOS_ACCOUNTS_DIR!);
    const accounts = await accountStore.listAccounts();
    expect(accounts).toHaveLength(1);
  });

  it('does not change POST /api/sessions behavior', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'de' } } },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { sessionId: string; context: unknown };
    expect(body).toHaveProperty('sessionId');
    expect(body).not.toHaveProperty('accountId');

    const state = await systemStateCoordinator.getState(body.sessionId);
    expect(state?.accountId).toBeNull();
  });

  it('does not require claim for existing snapshot access', async () => {
    const app = await buildApp();
    const sessionId = await createSession();

    const snapshotRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });

    expect(snapshotRes.statusCode).toBe(200);
  });
});

describe('AccountClaimService', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('uses coordinator mutation path for binding', async () => {
    const app = await buildApp();
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {},
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    const accountStore = new FileAccountStore(process.env.ARRIVALOS_ACCOUNTS_DIR!);
    const service = new AccountClaimService(systemStateCoordinator, new AccountService(accountStore));

    const result = await service.claimSession(sessionId);
    expect(result.linked).toBe(true);

    const reloaded = await systemStateCoordinator.getState(sessionId);
    expect(reloaded?.accountId).toBe(result.accountId);
  });
});
