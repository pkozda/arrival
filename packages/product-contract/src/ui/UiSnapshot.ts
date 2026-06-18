import type { ThemePreference } from './index.js';
import type { ExecutionSnapshot, UiSnapshotProjection } from '../snapshot/types.js';

export type UiSnapshotSession = {
  sessionId: string;
  language: string;
  uiPreferences: {
    theme: ThemePreference;
  };
};

export type UiSnapshotProfile = Record<string, unknown>;

export type UiSnapshotFallback = {
  reason: string;
  code: 'PROJECTION_ERROR';
};

export type UiSnapshot = UiSnapshotProjection & {
  schemaVersion: number;
  snapshotVersion: number;
  lastMutationId: string | null;
  generatedAt: string;
  session: UiSnapshotSession;
  profile: UiSnapshotProfile | null;
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
