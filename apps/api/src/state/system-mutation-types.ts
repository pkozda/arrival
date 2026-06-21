import type { AppContext, SupportedLanguage } from '@arrival-atlas/core';
import type { ModuleResult } from '@arrival-atlas/module-runtime';
import type { ModuleUIProjection } from '@arrival-atlas/product-contract';
import type {
  ProfileCreateInput,
  ProfilePatch,
  ProfileRecord,
} from '@arrival-atlas/profile';
import type { ExecutionTrace } from '@arrival-atlas/profile';
import type { MutationRequest, UserContextV1, EconomicRealityEventV1 } from '@arrival-atlas/product-contract';
import type { SystemModuleDescriptor, SystemProjectionConfig } from './system-state-types.js';
import type { SystemState } from './system-state-types.js';
import type { MutationActor } from './mutation-actor.js';

export type SessionCreateMutation = {
  type: 'SESSION_CREATE';
  context: AppContext;
  modules: SystemModuleDescriptor[];
  projectionConfig: SystemProjectionConfig;
  actor?: MutationActor;
};

export type SessionPatchMutation = {
  type: 'SESSION_PATCH';
  sessionId: string;
  context: Partial<AppContext>;
  mutationId: string;
  actor?: MutationActor;
};

export type ProfileCreateMutation = {
  type: 'PROFILE_CREATE';
  sessionId: string;
  input: ProfileCreateInput;
  actor?: MutationActor;
};

export type ProfileUpdateMutation = {
  type: 'PROFILE_UPDATE';
  sessionId: string;
  patch: ProfilePatch;
  expectedRevision: number;
  actor?: MutationActor;
};

export type ModuleExecuteMutation = {
  type: 'MODULE_EXECUTE';
  sessionId: string;
  moduleId: string;
  executionId: string;
  result: unknown;
  moduleResult?: ModuleResult;
  projection?: ModuleUIProjection;
  executedAt: string;
  trace: ExecutionTrace;
  requestInput: Record<string, unknown>;
  preferredLanguage?: SupportedLanguage;
  actor?: MutationActor;
};

export type AccountClaimMutation = {
  type: 'ACCOUNT_CLAIM';
  sessionId: string;
  accountId: string;
  mutationId: string;
  actor?: MutationActor;
};

export type AccountLinkMutation = {
  type: 'ACCOUNT_LINK';
  sessionId: string;
  accountId: string;
  mutationId: string;
  actor?: MutationActor;
};

export type ProfileMutationApplyMutation = {
  type: 'PROFILE_MUTATION_APPLY';
  sessionId: string;
  request: MutationRequest;
  actor?: MutationActor;
};

export type EconomicRealityEventAppendMutation = {
  type: 'ECONOMIC_REALITY_EVENT_APPEND';
  sessionId: string;
  event: EconomicRealityEventV1;
  actor?: MutationActor;
};

export type SystemMutation =
  | SessionCreateMutation
  | SessionPatchMutation
  | ProfileCreateMutation
  | ProfileUpdateMutation
  | ProfileMutationApplyMutation
  | ModuleExecuteMutation
  | AccountClaimMutation
  | AccountLinkMutation
  | EconomicRealityEventAppendMutation;

export type SessionCreateResult = {
  type: 'SESSION_CREATE';
  state: SystemState;
};

export type SessionPatchResult = {
  type: 'SESSION_PATCH';
  state: SystemState;
};

export type ProfileCreateResult = {
  type: 'PROFILE_CREATE';
  profile: ProfileRecord;
  state: SystemState;
};

export type ProfileUpdateResult = {
  type: 'PROFILE_UPDATE';
  profile: ProfileRecord;
  state: SystemState;
};

export type ModuleExecuteResult = {
  type: 'MODULE_EXECUTE';
  executionId: string;
  snapshotVersion: number;
  profileActivated: boolean;
  state: SystemState;
};

export type AccountClaimResult = {
  type: 'ACCOUNT_CLAIM';
  accountId: string;
  state: SystemState;
};

export type AccountLinkResult = {
  type: 'ACCOUNT_LINK';
  accountId: string;
  state: SystemState;
};

export type ProfileMutationApplyResult = {
  type: 'PROFILE_MUTATION_APPLY';
  eventId: string;
  revision: number;
  userContext: UserContextV1;
  state: SystemState;
};

export type EconomicRealityEventAppendResult = {
  type: 'ECONOMIC_REALITY_EVENT_APPEND';
  event: EconomicRealityEventV1;
  state: SystemState;
};

export type SystemMutationResult =
  | SessionCreateResult
  | SessionPatchResult
  | ProfileCreateResult
  | ProfileUpdateResult
  | ProfileMutationApplyResult
  | ModuleExecuteResult
  | AccountClaimResult
  | AccountLinkResult
  | EconomicRealityEventAppendResult;
