import type {
  MutationSource,
  MutationType,
  PersistentFactFieldId,
  ProfileDomain,
} from '@arrival-atlas/product-contract';

/** Single active field value in reduced profile state. */
export type ProfileFieldEntry = {
  value: unknown;
  domain: ProfileDomain;
  setBySequence: number;
  setByEventId: string;
  committedAt: string;
  source: MutationSource;
  mutationType: MutationType;
};

/**
 * Deterministic reduced state derived from MutationEvent[].
 * Field-keyed — no schema paths, no UI labels, no event log.
 */
export type ProfileState = {
  profileId: string;
  headRevision: number;
  lastSequence: number;
  fields: Partial<Record<PersistentFactFieldId, ProfileFieldEntry>>;
};

export function createEmptyProfileState(profileId: string): ProfileState {
  return {
    profileId,
    headRevision: 0,
    lastSequence: 0,
    fields: {},
  };
}

export function getFieldValue(
  state: ProfileState,
  fieldId: PersistentFactFieldId
): unknown | undefined {
  return state.fields[fieldId]?.value;
}

export function hasField(state: ProfileState, fieldId: PersistentFactFieldId): boolean {
  return state.fields[fieldId] !== undefined;
}
