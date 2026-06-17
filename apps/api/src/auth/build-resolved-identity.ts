import type { AuthContext } from './auth.types.js';
import type { ResolvedIdentity } from './resolved-identity.js';
import type { SystemState } from '../state/system-state-types.js';

/**
 * Canonical identity resolver for downstream IAM layers.
 *
 * `accountId` is ALWAYS sourced from `SystemState.accountId` — the sole authority.
 * `tokenAccountId` is informational only (snapshot at token issuance) and must
 * never be used for authorization or entitlement decisions.
 */
export async function buildResolvedIdentity(
  authContext: AuthContext,
  state: SystemState | null
): Promise<ResolvedIdentity> {
  const sessionId = authContext.sessionId;
  const source = authContext.authMode === 'token' ? 'token' : 'legacy';
  const stateAccountId = state?.accountId ?? null;
  const tokenAccountId = authContext.tokenPayload?.accountId ?? null;

  return {
    sessionId,
    accountId: stateAccountId,
    authSubject:
      source === 'token' ? (authContext.tokenPayload?.authSubject ?? null) : null,
    source,
    verified: Boolean(state && state.session.id === sessionId),
    tokenAccountId,
    stateAccountId,
  };
}
