import type { SystemState } from '../state/system-state-types.js';

export type MutationActor = {
  sessionId: string;
  accountId: string | null;
  authSubject: string | null;
};

export function attachMutationActor(
  state: SystemState,
  actor?: MutationActor | null
): SystemState {
  const resolved: MutationActor = actor ?? {
    sessionId: state.session.id,
    accountId: state.accountId,
    authSubject: null,
  };

  return {
    ...state,
    version: {
      ...state.version,
      lastActor: {
        sessionId: resolved.sessionId,
        accountId: resolved.accountId,
        authSubject: resolved.authSubject,
      },
    },
  };
}
