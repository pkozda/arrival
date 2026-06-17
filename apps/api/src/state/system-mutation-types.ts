import type { AppContext, SupportedLanguage } from '@arrivalos/core';
import type {
  ProfileCreateInput,
  ProfilePatch,
  ProfileRecord,
} from '@arrivalos/profile';
import type { ExecutionTrace } from '@arrivalos/profile';
import type { SystemModuleDescriptor, SystemProjectionConfig } from './system-state-types.js';
import type { SystemState } from './system-state-types.js';

export type SessionCreateMutation = {
  type: 'SESSION_CREATE';
  context: AppContext;
  modules: SystemModuleDescriptor[];
  projectionConfig: SystemProjectionConfig;
};

export type SessionPatchMutation = {
  type: 'SESSION_PATCH';
  sessionId: string;
  context: Partial<AppContext>;
  mutationId: string;
};

export type ProfileCreateMutation = {
  type: 'PROFILE_CREATE';
  sessionId: string;
  input: ProfileCreateInput;
};

export type ProfileUpdateMutation = {
  type: 'PROFILE_UPDATE';
  sessionId: string;
  patch: ProfilePatch;
  expectedRevision: number;
};

export type ModuleExecuteMutation = {
  type: 'MODULE_EXECUTE';
  sessionId: string;
  moduleId: string;
  executionId: string;
  result: unknown;
  executedAt: string;
  trace: ExecutionTrace;
  requestInput: Record<string, unknown>;
  preferredLanguage?: SupportedLanguage;
};

export type SystemMutation =
  | SessionCreateMutation
  | SessionPatchMutation
  | ProfileCreateMutation
  | ProfileUpdateMutation
  | ModuleExecuteMutation;

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

export type SystemMutationResult =
  | SessionCreateResult
  | SessionPatchResult
  | ProfileCreateResult
  | ProfileUpdateResult
  | ModuleExecuteResult;
