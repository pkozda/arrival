import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureSessionRegistered,
  touchSessionLastSeen,
} from './session-lifecycle.service.js';
import { sessionRegistryService } from './registry/session-registry.service.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../test-state.js';

describe('session-lifecycle.service', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('ensureSessionRegistered is idempotent', async () => {
    const first = await ensureSessionRegistered({
      sessionId: 'sess_1',
      accountId: 'acct_1',
    });
    const second = await ensureSessionRegistered({
      sessionId: 'sess_1',
      accountId: 'acct_1',
    });

    expect(second.session.sessionId).toBe(first.session.sessionId);
    expect(second.session.status).toBe('active');
    expect(second.created).toBe(false);

    const records = await sessionRegistryService.listAccountSessions('acct_1');
    expect(records).toHaveLength(1);
  });

  it('touchSessionLastSeen updates lastSeenAt', async () => {
    await ensureSessionRegistered({
      sessionId: 'sess_1',
      accountId: 'acct_1',
    });

    const before = await sessionRegistryService.getSessionRecord('sess_1');
    await touchSessionLastSeen({ sessionId: 'sess_1', accountId: 'acct_1' });
    const after = await sessionRegistryService.getSessionRecord('sess_1');

    expect(after?.lastSeenAt).not.toBe(before?.lastSeenAt);
  });
});
