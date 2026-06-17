import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { AccountService } from './account.service.js';
import { FileAccountStore } from './account.store.js';
import type { Account } from './account.types.js';
import { buildApp } from '../build-app.js';
import { FilePersistedSystemStateStore } from '../state/persisted-system-state-store.js';
import { isAccountLinked, normalizeSystemStateAccountId } from '../state/system-state-account.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../test-state.js';

describe('Account store', () => {
  let store: FileAccountStore;

  beforeEach(() => {
    setupTestStateStore();
    store = new FileAccountStore(process.env.ARRIVALOS_ACCOUNTS_DIR!);
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('creates and retrieves an account', async () => {
    const account: Account = {
      id: 'acct_test_1',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      authProvider: null,
      authSubject: null,
      status: 'active',
    };

    await store.createAccount(account);
    const loaded = await store.getAccountById('acct_test_1');

    expect(loaded).toEqual(account);
  });

  it('rejects duplicate account creation', async () => {
    const account: Account = {
      id: 'acct_dup',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      authProvider: null,
      authSubject: null,
      status: 'active',
    };

    await store.createAccount(account);
    await expect(store.createAccount(account)).rejects.toThrow(/already exists/);
  });

  it('updates an account', async () => {
    const account: Account = {
      id: 'acct_update',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      authProvider: null,
      authSubject: null,
      status: 'active',
    };

    await store.createAccount(account);
    const updated = { ...account, authProvider: 'google', updatedAt: '2026-06-02T00:00:00.000Z' };
    await store.updateAccount(updated);

    expect(await store.getAccountById('acct_update')).toEqual(updated);
  });

  it('lists accounts', async () => {
    const a: Account = {
      id: 'acct_a',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      authProvider: null,
      authSubject: null,
      status: 'active',
    };
    const b: Account = {
      id: 'acct_b',
      createdAt: '2026-06-02T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
      authProvider: null,
      authSubject: null,
      status: 'active',
    };

    await store.createAccount(b);
    await store.createAccount(a);

    const listed = await store.listAccounts();
    expect(listed.map((entry) => entry.id)).toEqual(['acct_a', 'acct_b']);
  });
});

describe('Account service', () => {
  let service: AccountService;

  beforeEach(() => {
    setupTestStateStore();
    service = new AccountService(new FileAccountStore(process.env.ARRIVALOS_ACCOUNTS_DIR!));
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('createAccount generates id and timestamps', async () => {
    const account = await service.createAccount();

    expect(account.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(account.authProvider).toBeNull();
    expect(account.authSubject).toBeNull();
    expect(account.status).toBe('active');
    expect(account.createdAt).toBe(account.updatedAt);

    const loaded = await service.getAccount(account.id);
    expect(loaded).toEqual(account);
  });

  it('updateAccount refreshes updatedAt', async () => {
    const created = await service.createAccount();
    const updated = await service.updateAccount({
      ...created,
      authProvider: 'github',
    });

    expect(updated.authProvider).toBe('github');
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });
});

describe('SystemState accountId (Phase 1)', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('new sessions persist with accountId null', async () => {
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });

    const { sessionId } = sessionRes.json() as { sessionId: string };
    const state = await systemStateCoordinator.getState(sessionId);

    expect(state?.accountId).toBeNull();
    expect(isAccountLinked(state!)).toBe(false);
  });

  it('legacy SystemState files without accountId load as null', async () => {
    const stateDir = process.env.ARRIVALOS_STATE_DIR!;
    const legacySessionId = 'sess_legacy_no_account';
    const legacyState = {
      session: {
        id: legacySessionId,
        createdAt: '2026-06-01T00:00:00.000Z',
        lastActiveAt: '2026-06-01T00:00:00.000Z',
        context: {},
      },
      profileRecord: null,
      profileRevisions: [],
      executionsByModuleId: {},
      executionTracesByModuleId: {},
      events: [],
      modules: [],
      projectionConfig: { uxSnapshotEnabled: false },
      generatedAt: '2026-06-01T00:00:00.000Z',
      version: {
        snapshotVersion: 1,
        stateHash: 'abc',
        lastMutationId: 'legacy',
      },
    };

    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, `${legacySessionId}.json`), JSON.stringify(legacyState));

    const store = new FilePersistedSystemStateStore(stateDir);
    const loaded = await store.load(legacySessionId);

    expect(loaded?.accountId).toBeNull();
    expect(normalizeSystemStateAccountId(legacyState as never).accountId).toBeNull();
  });

  it('POST /api/sessions response shape is unchanged', async () => {
    const app = await buildApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'de' } } },
    });

    expect(sessionRes.statusCode).toBe(200);
    const body = sessionRes.json() as { sessionId: string; context: unknown };
    expect(body).toHaveProperty('sessionId');
    expect(body).toHaveProperty('context');
    expect(body).not.toHaveProperty('accountId');
  });
});
