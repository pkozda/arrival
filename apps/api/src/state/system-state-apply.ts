import type { AppContext, Session, TrackedEvent } from '@arrivalos/core';
import type { ModuleResult } from '@arrivalos/module-runtime';
import {
  ProfileCreateInputSchema,
  ProfileDocumentSchema,
  ProfileRevisionConflictError,
  collectChangedFields,
  createEmptyProfileDocument,
  deepMergeProfile,
  type ExecutionTrace,
  type ProfileCreateInput,
  type ProfilePatch,
  type ProfileRecord,
  type ProfileRevision,
} from '@arrivalos/profile';
import { moduleInputToProfilePatch } from '../profile-activation.js';
import { finalizeSystemState } from './system-state-hash.js';
import type {
  StoredModuleExecution,
  SystemModuleDescriptor,
  SystemProjectionConfig,
  SystemState,
} from './system-state-types.js';

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function generateProfileId(): string {
  return `prof_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function generateRevisionId(): string {
  return `prev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function mergeSessionContext(session: Session, context: Partial<AppContext>): Session {
  return {
    ...session,
    lastActiveAt: nowIso(),
    context: {
      ...session.context,
      ...context,
      userProfile: context.userProfile
        ? { ...session.context.userProfile, ...context.userProfile }
        : session.context.userProfile,
      systemState: context.systemState
        ? { ...session.context.systemState, ...context.systemState }
        : session.context.systemState,
    },
  };
}

function toRevision(
  record: ProfileRecord,
  changedFields: string[],
  changedBy: ProfileRevision['changedBy'],
  moduleId?: string
): ProfileRevision {
  return {
    id: generateRevisionId(),
    profileId: record.id,
    revision: record.revision,
    schemaVersion: record.document.schemaVersion,
    document: record.document,
    changedFields,
    changedBy,
    moduleId,
    createdAt: record.updatedAt,
  };
}

function createProfileRecord(
  input: ProfileCreateInput,
  changedBy: ProfileRevision['changedBy']
): { record: ProfileRecord; revisions: ProfileRevision[] } {
  const parsed = ProfileCreateInputSchema.parse(input);
  const document = ProfileDocumentSchema.parse(createEmptyProfileDocument(parsed));
  const timestamp = nowIso();
  const record: ProfileRecord = {
    id: generateProfileId(),
    revision: 1,
    document,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    record,
    revisions: [toRevision(record, ['*'], changedBy)],
  };
}

function updateProfileRecord(
  existing: ProfileRecord,
  patch: ProfilePatch,
  expectedRevision: number,
  changedBy: ProfileRevision['changedBy'],
  moduleId?: string
): { record: ProfileRecord; revisions: ProfileRevision[] } {
  if (existing.revision !== expectedRevision) {
    throw new ProfileRevisionConflictError(expectedRevision, existing.revision);
  }

  const mergedDocument = deepMergeProfile(existing.document, patch);
  const changedFields = collectChangedFields(existing.document, mergedDocument);
  const timestamp = nowIso();
  const record: ProfileRecord = {
    ...existing,
    revision: existing.revision + 1,
    document: mergedDocument,
    updatedAt: timestamp,
  };

  return {
    record,
    revisions: [toRevision(record, changedFields, changedBy, moduleId)],
  };
}

function applyProfileActivation(
  state: SystemState,
  moduleId: string,
  requestInput: Record<string, unknown>,
  preferredLanguage?: string
): {
  session: Session;
  profileRecord: ProfileRecord | null;
  profileRevisions: ProfileRevision[];
  activated: boolean;
} {
  const patch = moduleInputToProfilePatch(moduleId, requestInput);
  if (!patch) {
    return {
      session: state.session,
      profileRecord: state.profileRecord,
      profileRevisions: state.profileRevisions,
      activated: false,
    };
  }

  if (preferredLanguage) {
    patch.preferredLanguage = preferredLanguage as ProfilePatch['preferredLanguage'];
  }

  if (!state.profileRecord) {
    const createInput = ProfileCreateInputSchema.parse({
      preferredLanguage: preferredLanguage ?? 'en',
      ...patch,
    });
    const created = createProfileRecord(createInput, 'module');
    return {
      session: mergeSessionContext(state.session, { profileId: created.record.id }),
      profileRecord: created.record,
      profileRevisions: created.revisions,
      activated: true,
    };
  }

  const updated = updateProfileRecord(
    state.profileRecord,
    patch,
    state.profileRecord.revision,
    'module',
    moduleId
  );

  return {
    session: state.session,
    profileRecord: updated.record,
    profileRevisions: [...state.profileRevisions, ...updated.revisions],
    activated: true,
  };
}

export function createInitialSystemState(params: {
  context: AppContext;
  modules: SystemModuleDescriptor[];
  projectionConfig: SystemProjectionConfig;
  mutationId: string;
}): SystemState {
  const timestamp = nowIso();
  const session: Session = {
    id: generateSessionId(),
    createdAt: timestamp,
    lastActiveAt: timestamp,
    context: { ...params.context },
  };

  return finalizeSystemState(
    {
      accountId: null,
      session,
      profileRecord: null,
      profileRevisions: [],
      executionsByModuleId: {},
      executionTracesByModuleId: {},
      events: [],
      modules: params.modules,
      projectionConfig: params.projectionConfig,
      generatedAt: timestamp,
    },
    params.mutationId
  );
}

export function applySessionPatch(
  state: SystemState,
  context: Partial<AppContext>,
  mutationId: string
): SystemState {
  return finalizeSystemState(
    {
      ...state,
      session: mergeSessionContext(state.session, context),
      generatedAt: nowIso(),
    },
    mutationId
  );
}

export class SessionAlreadyClaimedError extends Error {
  constructor(public readonly existingAccountId: string) {
    super(`Session already claimed by account: ${existingAccountId}`);
    this.name = 'SessionAlreadyClaimedError';
  }
}

export function applyAccountClaim(
  state: SystemState,
  accountId: string,
  mutationId: string
): SystemState {
  if (state.accountId !== null) {
    if (state.accountId === accountId) {
      return state;
    }
    throw new SessionAlreadyClaimedError(state.accountId);
  }

  const timestamp = nowIso();
  const events: TrackedEvent[] = [
    ...state.events,
    {
      id: `evt_${mutationId}`,
      type: 'account.claim',
      sessionId: state.session.id,
      timestamp,
      payload: { accountId },
    },
  ];

  return finalizeSystemState(
    {
      ...state,
      accountId,
      events,
      session: mergeSessionContext(state.session, {}),
      generatedAt: timestamp,
    },
    mutationId
  );
}

export function applyAccountLink(
  state: SystemState,
  accountId: string,
  mutationId: string
): SystemState {
  if (state.accountId !== null) {
    if (state.accountId === accountId) {
      return state;
    }
    throw new SessionAlreadyClaimedError(state.accountId);
  }

  const timestamp = nowIso();
  const events: TrackedEvent[] = [
    ...state.events,
    {
      id: `evt_${mutationId}`,
      type: 'account.link',
      sessionId: state.session.id,
      timestamp,
      payload: { accountId },
    },
  ];

  return finalizeSystemState(
    {
      ...state,
      accountId,
      events,
      session: mergeSessionContext(state.session, {}),
      generatedAt: timestamp,
    },
    mutationId
  );
}

export function applyProfileCreate(
  state: SystemState,
  input: ProfileCreateInput,
  mutationId: string
): SystemState {
  const created = createProfileRecord(input, 'user');
  return finalizeSystemState(
    {
      ...state,
      session: mergeSessionContext(state.session, { profileId: created.record.id }),
      profileRecord: created.record,
      profileRevisions: created.revisions,
      generatedAt: nowIso(),
    },
    mutationId
  );
}

export function applyProfileUpdate(
  state: SystemState,
  patch: ProfilePatch,
  expectedRevision: number,
  mutationId: string
): SystemState {
  if (!state.profileRecord) {
    throw new Error('No profile bound to session');
  }

  const updated = updateProfileRecord(
    state.profileRecord,
    patch,
    expectedRevision,
    'user'
  );

  return finalizeSystemState(
    {
      ...state,
      profileRecord: updated.record,
      profileRevisions: [...state.profileRevisions, ...updated.revisions],
      generatedAt: nowIso(),
    },
    mutationId
  );
}

export function applyModuleExecute(params: {
  state: SystemState;
  moduleId: string;
  executionId: string;
  result: unknown;
  moduleResult?: ModuleResult;
  executedAt: string;
  trace: ExecutionTrace;
  requestInput: Record<string, unknown>;
  preferredLanguage?: string;
  mutationId: string;
}): SystemState {
  const timestamp = Date.parse(params.executedAt);
  const execution: StoredModuleExecution = {
    moduleId: params.moduleId,
    result: params.result,
    timestamp: Number.isNaN(timestamp) ? Date.now() : timestamp,
    executionId: params.executionId,
    snapshotVersion: 0,
    ...(params.moduleResult !== undefined
      ? {
          legacyResult: params.result,
          moduleResult: params.moduleResult,
        }
      : {}),
  };

  const executionsByModuleId = {
    ...params.state.executionsByModuleId,
    [params.moduleId]: [...(params.state.executionsByModuleId[params.moduleId] ?? []), execution],
  };

  const executionTracesByModuleId = {
    ...params.state.executionTracesByModuleId,
    [params.moduleId]: [
      ...(params.state.executionTracesByModuleId[params.moduleId] ?? []),
      params.trace,
    ],
  };

  const events: TrackedEvent[] = [
    ...params.state.events,
    {
      id: `evt_${params.executionId}`,
      type: 'module.execute.success',
      moduleId: params.moduleId,
      sessionId: params.state.session.id,
      timestamp: params.executedAt,
    },
  ];

  let nextContent = {
    ...params.state,
    executionsByModuleId,
    executionTracesByModuleId,
    events,
    generatedAt: params.executedAt,
  };

  const activation = applyProfileActivation(
    nextContent,
    params.moduleId,
    params.requestInput,
    params.preferredLanguage
  );

  nextContent = {
    ...nextContent,
    session: activation.session,
    profileRecord: activation.profileRecord,
    profileRevisions: activation.profileRevisions,
  };

  const finalized = finalizeSystemState(nextContent, params.mutationId);
  const history = finalized.executionsByModuleId[params.moduleId] ?? [];
  const lastIndex = history.length - 1;
  if (lastIndex < 0) {
    return finalized;
  }

  const updatedHistory = [...history];
  updatedHistory[lastIndex] = {
    ...updatedHistory[lastIndex]!,
    snapshotVersion: finalized.version.snapshotVersion,
  };

  return {
    ...finalized,
    executionsByModuleId: {
      ...finalized.executionsByModuleId,
      [params.moduleId]: updatedHistory,
    },
  };
}

export function getLatestExecutionTrace(
  state: SystemState,
  moduleId: string
): ExecutionTrace | null {
  const history = state.executionTracesByModuleId[moduleId];
  if (!history || history.length === 0) {
    return null;
  }
  return history[history.length - 1] ?? null;
}
