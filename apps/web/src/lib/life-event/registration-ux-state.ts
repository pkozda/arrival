import type { UserContextV1 } from '@/lib/product-contract';

export type RegistrationUxState = 'blocked' | 'actionable' | 'complete';

export type RegistrationUxSnapshot = {
  state: RegistrationUxState;
  hasRegistrableAddress: boolean;
  hasConfirmation: boolean;
};

export function deriveRegistrationUxState(
  userContext: UserContextV1 | null | undefined
): RegistrationUxSnapshot {
  const housing = userContext?.profile?.domains?.housing;
  const migration = userContext?.profile?.domains?.migration;
  const hasRegistrableAddress = Boolean(housing?.city?.trim());
  const hasConfirmation = migration?.municipalRegistrationConfirmed === true;

  if (!hasRegistrableAddress) {
    return { state: 'blocked', hasRegistrableAddress, hasConfirmation };
  }
  if (hasConfirmation) {
    return { state: 'complete', hasRegistrableAddress, hasConfirmation };
  }
  return { state: 'actionable', hasRegistrableAddress, hasConfirmation };
}

/** Opening external guidance must never imply completion. */
export function doesExternalGuidanceCompleteRegistration(): boolean {
  return false;
}
