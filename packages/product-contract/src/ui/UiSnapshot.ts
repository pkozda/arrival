import type { ThemePreference } from './index.js';
import type { SnapshotUserContextTransport } from './snapshot-user-context-transport.js';
import type { ExecutionSnapshot, UiSnapshotProjection } from '../snapshot/types.js';

export type UiSnapshotSession = {
  sessionId: string;
  language: string;
  uiPreferences: {
    theme: ThemePreference;
  };
};

/**
 * @deprecated Removed from UiSnapshot — use UserContextV1 via userContext.profile.
 * Retained only for legacy snapshot contract consumers.
 */
export type UiSnapshotProfile = Record<string, unknown>;

export type UiSnapshotFallback = {
  reason: string;
  code: 'PROJECTION_ERROR';
};

/**
 * Execution-oriented UI snapshot — NOT an identity or situation read model.
 *
 * Authoritative user situation: UserContextV1 via GET /api/user-context only.
 *
 * Allowed: session display, FTU, module executions, action cards, recommendations.
 * Forbidden: profile/situation business logic, domain fact reads, correction prefill authority.
 */
export type UiSnapshot = UiSnapshotProjection & {
  schemaVersion: number;
  snapshotVersion: number;
  lastMutationId: string | null;
  generatedAt: string;
  session: UiSnapshotSession;
  /**
   * Derived transport copy of UserContextV1 — NOT authoritative.
   * Do not use for business logic; prefer GET /api/user-context.
   */
  userContext: SnapshotUserContextTransport;
  executionsByModuleId: Record<string, ExecutionSnapshot[]>;
  ftu: {
    isFirstTimeUser: boolean;
    step?: number;
  };
  fallback?: UiSnapshotFallback;
};

export type ModuleCatalogResponse = {
  modules: import('../PublicModuleContract.js').PublicModuleContract[];
};
