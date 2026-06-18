import type { DataProvenanceEntry, SupportedLanguage, ThemePreference } from '@arrivalos/core';
import type { ProfileSlice } from '@arrivalos/profile';

/**
 * Read-only execution context exposed at the module runtime boundary.
 * Modules must not mutate this object.
 */
export type ModuleRuntimeContext = {
  sessionId: string;
  accountId: string | null;
  locale: SupportedLanguage;
  uiPreferences: {
    theme: ThemePreference;
  };
  profileSlice: ProfileSlice | null;
  profileId: string | null;
  profileVersion: number | null;
  dataProvenance: readonly DataProvenanceEntry[];
  location?: string;
  runtime: {
    moduleId: string;
    executedAt: string;
    traceId: string;
  };
};
