import type { Session, TrackedEvent } from '@arrivalos/core';
import type { ExecutionTrace } from '@arrivalos/profile';
import type { ProfileRecord, ProfileRevision } from '@arrivalos/profile';

export type StoredModuleExecution = {
  moduleId: string;
  result: unknown;
  timestamp: number;
  executionId: string;
  snapshotVersion: number;
};

export type SystemModuleDescriptor = {
  id: string;
  name: string;
  description?: string;
};

export type SystemProjectionConfig = {
  uxSnapshotEnabled: boolean;
};

export type SnapshotVersionState = {
  snapshotVersion: number;
  stateHash: string;
  lastMutationId: string | null;
  lastActor?: {
    sessionId: string;
    accountId: string | null;
    authSubject: string | null;
  } | null;
};

export type SystemState = {
  accountId: string | null;
  session: Session;
  profileRecord: ProfileRecord | null;
  profileRevisions: ProfileRevision[];
  executionsByModuleId: Record<string, StoredModuleExecution[]>;
  executionTracesByModuleId: Record<string, ExecutionTrace[]>;
  events: TrackedEvent[];
  modules: SystemModuleDescriptor[];
  projectionConfig: SystemProjectionConfig;
  generatedAt: string;
  version: SnapshotVersionState;
};
