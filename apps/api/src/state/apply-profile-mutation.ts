import type {
  MutationRequest,
  PersistentFactFieldId,
  SupportedLanguage,
} from '@arrival-atlas/product-contract';
import { type ProfileDocument, type ProfileRecord } from '@arrival-atlas/profile';
import {
  buildMutationRequestsFromModuleExecution,
  projectProfileState,
  reduceProfileEvents,
  submitMutationRequest,
  type ProfileState,
} from '@arrival-atlas/profile-engine';
import { mergeSessionContext } from './system-state-apply.js';
import type { SystemState } from './system-state-types.js';
import {
  listProfileMutationEvents,
  normalizeSystemState,
  withProfileMutationFields,
} from './profile-mutation-state.js';
import { SessionMutationEventLog } from './session-mutation-event-log.js';
import { materializeProfileDocumentFromState } from './materialize-profile-document.js';

export type ProfileMutationCommitErrorCode =
  | 'REVISION_CONFLICT'
  | 'NOT_PERSISTENT'
  | 'UNAUTHORIZED_SOURCE'
  | 'EMPTY_DELTAS'
  | 'INVALID_REQUEST'
  | 'VALIDATION_FAILED';

export type ProfileMutationCommitResult =
  | {
      ok: true;
      eventId: string;
      revision: number;
      profileState: ProfileState;
    }
  | {
      ok: false;
      code: ProfileMutationCommitErrorCode;
      message: string;
      issues?: Array<{ code: string; message: string; fieldId?: string }>;
    };

function generateProfileMutationId(): string {
  return `prof_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function ensureProfileMutationIdentity(state: SystemState): {
  state: SystemState;
  profileId: string;
} {
  const normalized = normalizeSystemState(state);
  if (normalized.profileMutationProfileId) {
    return { state: normalized, profileId: normalized.profileMutationProfileId };
  }

  const profileId =
    normalized.profileRecord?.id ??
    (normalized.session.context as { profileId?: string }).profileId ??
    generateProfileMutationId();

  const sessionProfileId = (normalized.session.context as { profileId?: string }).profileId;
  const withProfileId = withProfileMutationFields(normalized, {
    profileMutationProfileId: profileId,
  });

  return {
    profileId,
    state:
      sessionProfileId === profileId
        ? withProfileId
        : {
            ...withProfileId,
            session: mergeSessionContext(withProfileId.session, { profileId }),
          },
  };
}

function existingFieldIds(state: SystemState): Set<PersistentFactFieldId> {
  const profileId = state.profileMutationProfileId ?? 'unknown';
  const reduced = reduceProfileEvents(profileId, listProfileMutationEvents(state));
  return new Set(Object.keys(reduced.fields) as PersistentFactFieldId[]);
}

function materializeCaches(
  state: SystemState,
  profileId: string,
  profileState: ProfileState
): SystemState {
  const profileView = projectProfileState(profileState);
  const document = materializeProfileDocumentFromState(profileState);
  const record: ProfileRecord = state.profileRecord ?? {
    id: profileId,
    revision: profileState.headRevision,
    document,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return withProfileMutationFields(state, {
    userContext: { profile: profileView },
    profileRecord: {
      ...record,
      revision: profileState.headRevision,
      document,
      updatedAt: new Date().toISOString(),
    },
  });
}

export function commitProfileMutationRequest(
  state: SystemState,
  request: MutationRequest
): { state: SystemState; result: ProfileMutationCommitResult } {
  const identity = ensureProfileMutationIdentity(state);
  let workingState = identity.state;
  const events = [...listProfileMutationEvents(workingState)];
  const log = new SessionMutationEventLog(identity.profileId, events);

  const submitResult = submitMutationRequest(request, log, {
    profileId: identity.profileId,
  });

  if (!submitResult.ok) {
    return {
      state: workingState,
      result: {
        ok: false,
        code: submitResult.code as ProfileMutationCommitErrorCode,
        message: submitResult.message,
        ...(submitResult.issues ? { issues: submitResult.issues } : {}),
      },
    };
  }

  workingState = withProfileMutationFields(workingState, {
    profileMutationEvents: log.getEvents(),
  });

  workingState = materializeCaches(workingState, identity.profileId, submitResult.profileState);

  if (
    request.type === 'pref.update' &&
    request.payload.kind === 'pref' &&
    request.payload.field === 'preferredLanguage'
  ) {
    workingState = {
      ...workingState,
      session: mergeSessionContext(workingState.session, {
        userProfile: { language: request.payload.value },
      }),
    };
  }

  return {
    state: workingState,
    result: {
      ok: true,
      eventId: submitResult.event.eventId,
      revision: submitResult.event.revision,
      profileState: submitResult.profileState,
    },
  };
}

export function applyModuleProfileMutations(
  state: SystemState,
  moduleId: string,
  executionId: string,
  requestInput: Record<string, unknown>,
  preferredLanguage?: SupportedLanguage
): { state: SystemState; appliedCount: number } {
  const normalized = normalizeSystemState(state);
  const identity = ensureProfileMutationIdentity(normalized);
  let workingState = identity.state;

  const requests = buildMutationRequestsFromModuleExecution({
    moduleId,
    executionId,
    input: requestInput,
    existingFieldIds: existingFieldIds(workingState),
    preferredLanguage,
  });

  if (requests.length === 0) {
    return { state: workingState, appliedCount: 0 };
  }

  let appliedCount = 0;

  for (const request of requests) {
    const committed = commitProfileMutationRequest(workingState, request);
    if (committed.result.ok) {
      workingState = committed.state;
      appliedCount += 1;
    }
  }

  return { state: workingState, appliedCount };
}

export function rebuildUserContextFromEvents(state: SystemState): SystemState {
  const normalized = normalizeSystemState(state);
  const profileId = normalized.profileMutationProfileId;
  if (!profileId || normalized.profileMutationEvents.length === 0) {
    return withProfileMutationFields(normalized, { userContext: { profile: null } });
  }

  const profileState = reduceProfileEvents(profileId, normalized.profileMutationEvents);
  return materializeCaches(normalized, profileId, profileState);
}

/** @internal test helper */
export function profileDocumentFromState(state: ProfileState): ProfileDocument {
  return materializeProfileDocumentFromState(state);
}
