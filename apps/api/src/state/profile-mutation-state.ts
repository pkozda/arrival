import type { MutationEvent, UserContextV1 } from '@arrival-atlas/product-contract';
import { projectProfileState, reduceProfileEvents } from '@arrival-atlas/profile-engine';
import type { ProfileRecord } from '@arrival-atlas/profile';
import type { SystemState } from './system-state-types.js';

export function normalizeSystemState(state: SystemState): SystemState {
  return {
    ...state,
    profileMutationEvents: state.profileMutationEvents ?? [],
    profileMutationProfileId: state.profileMutationProfileId ?? null,
    userContext: state.userContext ?? null,
    economicRealityEvents: state.economicRealityEvents ?? [],
  };
}

export function listProfileMutationEvents(state: SystemState): readonly MutationEvent[] {
  return normalizeSystemState(state).profileMutationEvents;
}

export function resolveUserContext(state: SystemState): UserContextV1 {
  const normalized = normalizeSystemState(state);
  if (normalized.userContext) {
    return normalized.userContext;
  }

  const profileId = normalized.profileMutationProfileId;
  if (!profileId || normalized.profileMutationEvents.length === 0) {
    return { profile: null };
  }

  const profileState = reduceProfileEvents(profileId, normalized.profileMutationEvents);
  return { profile: projectProfileState(profileState) };
}

export function hasMaterializedProfileCache(state: SystemState): boolean {
  return normalizeSystemState(state).profileMutationEvents.length > 0;
}

export function profileMutationHeadRevision(state: SystemState): number {
  const events = listProfileMutationEvents(state);
  if (events.length === 0) {
    return 0;
  }

  return events.reduce((max, event) => Math.max(max, event.revision), 0);
}

/** Detect whether legacy profileRecord matches mutation-derived cache (parity guard). */
export function profileRecordMatchesMutationCache(state: SystemState): boolean {
  const normalized = normalizeSystemState(state);
  if (!normalized.profileRecord || !normalized.userContext?.profile) {
    return normalized.profileRecord === null && normalized.userContext?.profile == null;
  }

  const income = normalized.userContext.profile.domains.income?.grossMonthlyIncome;
  const cachedIncome = normalized.profileRecord.document.employment?.grossMonthlyIncome;
  return income === cachedIncome;
}

export type ProfileMutationStateFields = Pick<
  SystemState,
  'profileMutationEvents' | 'profileMutationProfileId' | 'userContext' | 'profileRecord'
>;

export function emptyProfileMutationFields(): ProfileMutationStateFields {
  return {
    profileMutationEvents: [],
    profileMutationProfileId: null,
    userContext: null,
    profileRecord: null,
  };
}

export function withProfileMutationFields(
  state: SystemState,
  fields: Partial<ProfileMutationStateFields>
): SystemState {
  return normalizeSystemState({
    ...state,
    ...fields,
  });
}

export function touchMaterializedProfileRecord(
  record: ProfileRecord | null,
  revision: number
): ProfileRecord | null {
  if (!record) {
    return null;
  }

  return {
    ...record,
    revision,
    updatedAt: new Date().toISOString(),
  };
}
