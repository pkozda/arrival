import type { Session, TrackedEvent } from '@arrival-atlas/core';
import type { ModuleResult } from '@arrival-atlas/module-runtime';
import type {
  ModuleUIProjection,
  MutationEvent,
  UserContextV1,
  EconomicRealityEventV1,
} from '@arrival-atlas/product-contract';
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
  /** Append-only profile mutation event log — source of truth for situation facts. */
  profileMutationEvents: MutationEvent[];
  profileMutationProfileId: string | null;
  /** Materialized UI projection cache derived from mutation log. */
  userContext: UserContextV1 | null;
  /** Append-only economic reality interaction events — advisory feedback input only. */
  economicRealityEvents: EconomicRealityEventV1[];
  executionsByModuleId: Record<string, StoredModuleExecution[]>;
  executionTracesByModuleId: Record<string, ExecutionTrace[]>;
  events: TrackedEvent[];
  modules: SystemModuleDescriptor[];
  projectionConfig: SystemProjectionConfig;
  generatedAt: string;
  version: SnapshotVersionState;
};
