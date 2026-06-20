import type {
  FieldDelta,
  MutationEvent,
  MutationIntent,
  MutationRequest,
  MutationSource,
  MutationType,
  ProfileDomain,
} from '@arrival-atlas/product-contract';
import {
  InMemoryMutationEventLog,
  reduceProfileEvents,
  submitMutationRequest,
  type ProfileState,
} from '../src/index.js';

export const TEST_PROFILE_ID = 'prof_test';

export function moduleSource(moduleId = 'financial-reality'): MutationSource {
  return { kind: 'module', moduleId, executionId: 'exec_1' };
}

export function profileUiSource(domain: ProfileDomain): MutationSource {
  return { kind: 'profile_ui', domain };
}

export function buildMutationRequest(params: {
  requestId: string;
  type: MutationType;
  intent: MutationIntent;
  domain: ProfileDomain | null;
  source: MutationSource;
  fields?: Record<string, unknown>;
  expectedHeadRevision?: number;
  pref?: { field: 'preferredLanguage' | 'theme' | 'uiDensity'; value: unknown };
}): MutationRequest {
  const payload =
    params.pref !== undefined
      ? { kind: 'pref' as const, field: params.pref.field, value: params.pref.value }
      : {
          kind: 'domain_facts' as const,
          domain: params.domain as ProfileDomain,
          fields: params.fields ?? {},
        };

  return {
    id: params.requestId,
    requestId: params.requestId,
    timestamp: '2026-06-19T12:00:00.000Z',
    type: params.type,
    intent: params.intent,
    domain: params.domain,
    source: params.source,
    payload,
    confidence: 1,
    userConfirmationRequired: params.type === 'fact.correct' || params.type === 'fact.invalidate',
    expectedHeadRevision: params.expectedHeadRevision,
  };
}

export function buildEvent(params: {
  sequence: number;
  revision: number;
  type: MutationType;
  intent: MutationIntent;
  domain: ProfileDomain | null;
  source: MutationSource;
  fieldDeltas: FieldDelta[];
  mutationId?: string;
}): MutationEvent {
  const mutationId = params.mutationId ?? `req_${params.sequence}`;

  return {
    eventId: `evt_${params.sequence}`,
    mutationId,
    profileId: TEST_PROFILE_ID,
    sequence: params.sequence,
    revision: params.revision,
    timestamp: '2026-06-19T12:00:00.000Z',
    committedAt: `2026-06-19T12:00:0${params.sequence}.000Z`,
    type: params.type,
    intent: params.intent,
    domain: params.domain,
    payload: {
      kind: 'domain_facts',
      domain: params.domain ?? 'income',
      fields: {},
    },
    fieldDeltas: params.fieldDeltas,
    source: params.source,
    confidence: 1,
    reason: 'test event',
  };
}

export function submit(
  log: InMemoryMutationEventLog,
  request: MutationRequest,
  headRevision?: number
) {
  const withRevision =
    headRevision !== undefined && request.expectedHeadRevision === undefined
      ? { ...request, expectedHeadRevision: headRevision }
      : request;

  return submitMutationRequest(withRevision, log, { profileId: TEST_PROFILE_ID });
}

export function stateFromEvents(events: MutationEvent[]): ProfileState {
  return reduceProfileEvents(TEST_PROFILE_ID, events);
}

export function createLog(): InMemoryMutationEventLog {
  return new InMemoryMutationEventLog();
}
