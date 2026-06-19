import type { Session, TrackedEvent } from '@arrival-atlas/core';
import type { ModuleResult } from '@arrival-atlas/module-runtime';
import type { ModuleUIProjection } from '@arrival-atlas/product-contract';
import type { ExecutionTrace } from '@arrival-atlas/profile';
import type { ProfileRecord, ProfileRevision } from '@arrival-atlas/profile';

export type StoredModuleExecution = {
  moduleId: string;
  /** Legacy domain output — authoritative for UX projection in MRC-2. */
  result: unknown;
  timestamp: number;
  executionId: string;
  snapshotVersion: number;
  /** Explicit legacy copy when dual-write envelope is enabled. */
  legacyResult?: unknown;
  /** Canonical MRC envelope when dual-write is enabled. */
  moduleResult?: ModuleResult;
  /** UI-safe execution projection for product layer consumers. */
  projection?: ModuleUIProjection;
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
