import type { FieldDelta, MutationEvent } from '@arrival-atlas/product-contract';
import { getFieldDefinition } from '@arrival-atlas/product-contract';
import type { ProfileFieldEntry, ProfileState } from '../profile-state.js';

function applyFieldDelta(
  fields: ProfileState['fields'],
  delta: FieldDelta,
  event: MutationEvent
): ProfileState['fields'] {
  const next = { ...fields };
  const domain = getFieldDefinition(delta.fieldId).domain;

  if (delta.operation === 'clear') {
    delete next[delta.fieldId];
    return next;
  }

  const entry: ProfileFieldEntry = {
    value: delta.after,
    domain,
    setBySequence: event.sequence,
    setByEventId: event.eventId,
    committedAt: event.committedAt,
    source: event.source,
    mutationType: event.type,
  };

  next[delta.fieldId] = entry;
  return next;
}

/** Apply a single committed MutationEvent to profile state. */
export function applyMutationEvent(state: ProfileState, event: MutationEvent): ProfileState {
  if (event.profileId !== state.profileId) {
    throw new Error(
      `Event profileId ${event.profileId} does not match state profileId ${state.profileId}`
    );
  }

  let fields = state.fields;

  for (const delta of event.fieldDeltas) {
    fields = applyFieldDelta(fields, delta, event);
  }

  return {
    profileId: state.profileId,
    headRevision: event.revision,
    lastSequence: event.sequence,
    fields,
  };
}
