import {
  MutationRequestSchema,
  validatePersistentPayloadFields,
  type MutationEvent,
  type MutationRequest,
  type UserProfileViewV1,
} from '@arrival-atlas/product-contract';
import { resolveMutationConflict, type ConflictErrorCode } from '../conflict/resolve-mutation-conflict.js';
import { projectProfileState } from '../projection/project-profile-state.js';
import type { MutationEventLogPort } from '../ports/mutation-event-log.js';
import { reduceProfileEvents } from '../reducer/reduce-profile-events.js';
import type { ProfileState } from '../profile-state.js';

export type SubmitMutationErrorCode =
  | ConflictErrorCode
  | 'INVALID_REQUEST'
  | 'VALIDATION_FAILED';

export type SubmitMutationResult =
  | {
      ok: true;
      event: MutationEvent;
      profileState: ProfileState;
      profileView: UserProfileViewV1;
    }
  | {
      ok: false;
      code: SubmitMutationErrorCode;
      message: string;
      issues?: Array<{ code: string; message: string; fieldId?: string }>;
    };

export type SubmitMutationOptions = {
  profileId: string;
  now?: () => string;
  createEventId?: (sequence: number, mutationId: string) => string;
};

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultCreateEventId(sequence: number, mutationId: string): string {
  return `evt_${sequence}_${mutationId}`;
}

/**
 * Mutation coordinator — sole entry point for committing profile mutations.
 * validate → normalize → conflict resolve → append → reduce → project
 */
export function submitMutationRequest(
  requestInput: MutationRequest,
  log: MutationEventLogPort,
  options: SubmitMutationOptions
): SubmitMutationResult {
  const parsed = MutationRequestSchema.safeParse(requestInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'INVALID_REQUEST',
      message: parsed.error.message,
    };
  }

  const request = parsed.data;
  const profileId = options.profileId;
  const now = options.now ?? defaultNow;
  const createEventId = options.createEventId ?? defaultCreateEventId;

  const existing = log.findByMutationId(request.requestId);
  if (existing) {
    const events = log.list(profileId);
    const profileState = reduceProfileEvents(profileId, events);
    const profileView = projectProfileState(profileState);
    return { ok: true, event: existing, profileState, profileView };
  }

  const validation = validatePersistentPayloadFields(
    request.payload,
    request.domain ?? undefined
  );
  if (!validation.ok) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: 'Payload validation failed',
      issues: validation.issues,
    };
  }

  const events = log.list(profileId);
  const currentState = reduceProfileEvents(profileId, events);
  const headRevision = currentState.headRevision;

  const conflict = resolveMutationConflict(request, currentState, headRevision);
  if (!conflict.ok) {
    return {
      ok: false,
      code: conflict.code,
      message: conflict.message,
    };
  }

  const nextSequence = log.getLastSequence(profileId) + 1;
  const nextRevision = headRevision + 1;
  const timestamp = now();

  const event: MutationEvent = {
    eventId: createEventId(nextSequence, request.requestId),
    mutationId: request.requestId,
    profileId,
    sequence: nextSequence,
    revision: nextRevision,
    timestamp: request.timestamp,
    committedAt: timestamp,
    type: request.type,
    intent: request.intent,
    domain: request.domain,
    payload: request.payload,
    fieldDeltas: conflict.fieldDeltas,
    source: request.source,
    confidence: request.confidence,
    reason: conflict.reason,
  };

  log.append(event);

  const allEvents = log.list(profileId);
  const profileState = reduceProfileEvents(profileId, allEvents);
  const profileView = projectProfileState(profileState);

  return { ok: true, event, profileState, profileView };
}
