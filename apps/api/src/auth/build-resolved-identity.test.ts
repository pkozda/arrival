import { describe, expect, it } from 'vitest';
import { buildResolvedIdentity } from './build-resolved-identity.js';
import type { AuthContext } from './auth.types.js';
import type { SystemState } from '../state/system-state-types.js';

function minimalState(sessionId: string, accountId: string | null = null): SystemState {
  return {
    accountId,
    session: {
      id: sessionId,
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
      lastMutationId: null,
    },
  };
}

describe('buildResolvedIdentity', () => {
  it('resolves accountId from SystemState, not token payload', async () => {
    const authContext: AuthContext = {
      sessionId: 'sess_1',
      accountId: 'acct_token',
      authSubject: 'account:acct_token',
      authMode: 'token',
      tokenPayload: {
        v: 1,
        sessionId: 'sess_1',
        accountId: 'acct_token',
        authSubject: 'account:acct_token',
        iat: 1,
        exp: 9999999999,
      },
    };

    const identity = await buildResolvedIdentity(
      authContext,
      minimalState('sess_1', 'acct_state')
    );

    expect(identity.accountId).toBe('acct_state');
    expect(identity.stateAccountId).toBe('acct_state');
    expect(identity.tokenAccountId).toBe('acct_token');
    expect(identity.source).toBe('token');
    expect(identity.verified).toBe(true);
  });

  it('sets legacy source and null authSubject for session auth mode', async () => {
    const authContext: AuthContext = {
      sessionId: 'sess_1',
      accountId: 'acct_1',
      authSubject: null,
      authMode: 'session',
    };

    const identity = await buildResolvedIdentity(
      authContext,
      minimalState('sess_1', 'acct_1')
    );

    expect(identity.source).toBe('legacy');
    expect(identity.authSubject).toBeNull();
    expect(identity.accountId).toBe('acct_1');
  });

  it('marks unverified when state is missing or session id mismatches', async () => {
    const authContext: AuthContext = {
      sessionId: 'sess_1',
      accountId: null,
      authSubject: null,
      authMode: 'session',
    };

    expect((await buildResolvedIdentity(authContext, null)).verified).toBe(false);
    expect(
      (await buildResolvedIdentity(authContext, minimalState('sess_other'))).verified
    ).toBe(false);
  });
});
