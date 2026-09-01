import type { ResultState, ResultStateActor } from '../types/state.js';

export type ResultStateTransitionInput = {
  from: ResultState;
  to: ResultState;
  actor: ResultStateActor;
};

export type ResultStateTransitionResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Minimal E7 transition matrix — domain model §12.
 * UI-heavy transitions deferred to E9; engine/notification paths only.
 */
export function validateResultStateTransition(
  input: ResultStateTransitionInput
): ResultStateTransitionResult {
  const { from, to, actor } = input;

  if (from === to) {
    return { ok: true };
  }

  if (from === 'EXPIRED' || to === 'EXPIRED') {
    if (actor === 'engine' && to === 'EXPIRED') {
      return { ok: true };
    }
    return { ok: false, reason: 'EXPIRED_STATE_IMMUTABLE' };
  }

  if (from === 'DISMISSED' && to === 'NEW') {
    return { ok: false, reason: 'DISMISSED_CANNOT_REVERT_TO_NEW' };
  }

  switch (actor) {
    case 'notification':
      if (to === 'NOTIFIED' && (from === 'NEW' || from === 'SEEN' || from === 'NOTIFIED')) {
        return { ok: true };
      }
      return { ok: false, reason: `NOTIFICATION_CANNOT_SET_${to}` };

    case 'ui':
    case 'user':
      if (to === 'SEEN' && (from === 'NEW' || from === 'NOTIFIED' || from === 'SEEN')) {
        return { ok: true };
      }
      if (to === 'OPENED') {
        return { ok: true };
      }
      if (to === 'SAVED') {
        return { ok: true };
      }
      if (to === 'DISMISSED') {
        return { ok: true };
      }
      return { ok: false, reason: `USER_CANNOT_SET_${to}_FROM_${from}` };

    case 'engine':
      if (to === 'NEW' && from === 'NEW') {
        return { ok: true };
      }
      return { ok: false, reason: `ENGINE_CANNOT_SET_${to}_FROM_${from}` };

    default:
      return { ok: false, reason: 'UNKNOWN_ACTOR' };
  }
}
