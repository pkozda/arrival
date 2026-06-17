import type { SupportedLanguage } from '@arrivalos/core';
import type { UiSnapshot } from '@/lib/api';
import { getSessionLanguage } from './get-session-language';
import { getThemePreference } from './get-theme';

export function getUiPreferences(snapshot: UiSnapshot | null): {
  theme: ReturnType<typeof getThemePreference>;
  language: SupportedLanguage;
} {
  return {
    theme: getThemePreference(snapshot),
    language: getSessionLanguage(snapshot),
  };
}
