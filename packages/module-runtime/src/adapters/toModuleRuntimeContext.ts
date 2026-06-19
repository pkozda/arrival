import type { AppContext, SupportedLanguage, ThemePreference } from '@arrival-atlas/core';
import type { ProfileSlice } from '@arrival-atlas/profile';
import type { ModuleRuntimeContext } from '../types/ModuleRuntimeContext.js';

export type ToModuleRuntimeContextParams = {
  moduleId: string;
  traceId: string;
  executedAt: string;
  accountId?: string | null;
};

function asProfileSlice(value: unknown): ProfileSlice | null {
  if (value === undefined || value === null) {
    return null;
  }

  return value as ProfileSlice;
}

function readAccountId(
  appContext: AppContext,
  params: ToModuleRuntimeContextParams
): string | null {
  const extended = appContext as AppContext & { accountId?: string | null };
  if (extended.accountId !== undefined) {
    return extended.accountId;
  }

  if (params.accountId !== undefined) {
    return params.accountId;
  }

  return null;
}

/**
 * Structural mapping from AppContext to ModuleRuntimeContext.
 * No filtering or business logic — field passthrough only.
 */
export function toModuleRuntimeContext(
  appContext: AppContext,
  params: ToModuleRuntimeContextParams
): ModuleRuntimeContext {
  const locale: SupportedLanguage = appContext.userProfile?.language ?? 'en';
  const theme: ThemePreference = appContext.userProfile?.uiPreferences?.theme ?? 'light';

  return {
    sessionId: appContext.sessionId ?? '',
    accountId: readAccountId(appContext, params),
    locale,
    uiPreferences: { theme },
    profileSlice: asProfileSlice(appContext.profileSlice),
    profileId: appContext.profileId ?? null,
    profileVersion: appContext.profileVersion ?? null,
    dataProvenance: [...(appContext.dataProvenance ?? [])],
    ...(appContext.location !== undefined ? { location: appContext.location } : {}),
    runtime: {
      moduleId: params.moduleId,
      executedAt: params.executedAt,
      traceId: params.traceId,
    },
  };
}
