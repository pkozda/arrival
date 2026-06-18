import type { AppContext, SupportedLanguage } from '@arrivalos/core';
import type { ModuleResult } from '@arrivalos/module-runtime';
import type { ModuleUIProjection } from '@arrivalos/product-contract';
import type {
  ProfileCreateInput,
  ProfilePatch,
  ProfileRecord,
} from '@arrivalos/profile';
import type { ExecutionTrace } from '@arrivalos/profile';
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

export type SystemMutation =
  | SessionCreateMutation
  | SessionPatchMutation
  | ProfileCreateMutation
  | ProfileUpdateMutation
  | ModuleExecuteMutation
  | AccountClaimMutation
  | AccountLinkMutation;

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

export type SystemMutationResult =
  | SessionCreateResult
  | SessionPatchResult
  | ProfileCreateResult
  | ProfileUpdateResult
  | ModuleExecuteResult
  | AccountClaimResult
  | AccountLinkResult;
