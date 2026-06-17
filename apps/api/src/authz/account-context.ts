import { systemStateCoordinator } from '../state/system-state-coordinator.js';

export type AccountContext = {
  sessionId: string;
  accountId: string | null;
};

export class AccountSessionMismatchError extends Error {
  constructor() {
    super('Session identifier does not match persisted session');
    this.name = 'AccountSessionMismatchError';
  }
}

export async function resolveAccountFromSession(
  sessionId: string
): Promise<AccountContext | null> {
  const state = await systemStateCoordinator.getState(sessionId);
  if (!state) {
    return null;
  }

  if (state.session.id !== sessionId) {
    throw new AccountSessionMismatchError();
  }

  return {
    sessionId,
    accountId: state.accountId ?? null,
  };
}
