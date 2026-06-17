import type { ResolvedIdentity } from '../auth/resolved-identity.js';

export function toMutationActor(identity: ResolvedIdentity) {
  return {
    sessionId: identity.sessionId,
    accountId: identity.accountId,
    authSubject: identity.authSubject,
  };
}
