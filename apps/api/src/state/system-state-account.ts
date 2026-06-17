import type { SystemState } from './system-state-types.js';

export function normalizeSystemStateAccountId(
  state: SystemState | Omit<SystemState, 'accountId'> & { accountId?: string | null }
): SystemState {
  return {
    ...state,
    accountId: state.accountId ?? null,
  } as SystemState;
}

export function isAccountLinked(state: SystemState): boolean {
  return state.accountId !== null;
}
