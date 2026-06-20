import type { MutationEvent } from '@arrival-atlas/product-contract';
import { createEmptyProfileState, type ProfileState } from '../profile-state.js';
import { applyMutationEvent } from './apply-event.js';

function sortEventsBySequence(events: readonly MutationEvent[]): MutationEvent[] {
  return [...events].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    return left.committedAt.localeCompare(right.committedAt);
  });
}

/**
 * Deterministic reducer: ProfileState = reduce(MutationEvent[]).
 * Authority is event.sequence + fieldDeltas — no hidden state.
 */
export function reduceProfileEvents(
  profileId: string,
  events: readonly MutationEvent[]
): ProfileState {
  const ordered = sortEventsBySequence(events);
  let state = createEmptyProfileState(profileId);

  for (const event of ordered) {
    state = applyMutationEvent(state, event);
  }

  return state;
}
