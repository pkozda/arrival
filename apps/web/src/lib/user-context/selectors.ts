import type { SupportedLanguage, UserContextV1 } from '@/lib/product-contract';

/** Authoritative user situation read model — sole source for profile/domain facts in UI. */
export function selectUserContextProfile(
  userContext: UserContextV1 | null | undefined
) {
  return userContext?.profile ?? null;
}

export function hasUserContextProfile(userContext: UserContextV1 | null | undefined): boolean {
  return selectUserContextProfile(userContext) != null;
}

/**
 * Profile preference comes from authoritative userContext only;
 * sessionLanguage is session transport metadata (uiSnapshot.session.language).
 */
export function selectAppDisplayLanguage(
  userContext: UserContextV1 | null | undefined,
  sessionLanguage: SupportedLanguage | undefined
): SupportedLanguage {
  const profileLanguage = selectUserContextProfile(userContext)?.preferences.preferredLanguage;
  return profileLanguage ?? sessionLanguage ?? 'en';
}
