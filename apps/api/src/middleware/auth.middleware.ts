import type { AuthContext } from '../auth/auth.types.js';

export function toMutationActor(auth: AuthContext) {
  return {
    sessionId: auth.sessionId,
    accountId: auth.accountId,
    authSubject: auth.authSubject,
  };
}
