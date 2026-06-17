import { ThemePreferenceSchema, type ThemePreference } from '@arrivalos/core';
import type { UiSnapshot } from '@/lib/api';

export type ResolvedTheme = 'light' | 'dark';

export function getThemePreference(snapshot: UiSnapshot | null): ThemePreference {
  const parsed = ThemePreferenceSchema.safeParse(snapshot?.session?.uiPreferences?.theme);
  return parsed.success ? parsed.data : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  return preference;
}

export function getTheme(snapshot: UiSnapshot | null): ResolvedTheme {
  return resolveTheme(getThemePreference(snapshot));
}
