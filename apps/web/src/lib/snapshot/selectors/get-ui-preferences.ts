import type { SupportedLanguage } from '@/lib/product-contract';
import type { UiSnapshot } from '@/lib/product-contract';

export function getUiPreferences(snapshot: UiSnapshot | null): {
  language: SupportedLanguage;
  theme: UiSnapshot['session']['uiPreferences']['theme'];
} {
  return {
    language: (snapshot?.session.language ?? 'en') as SupportedLanguage,
    theme: snapshot?.session.uiPreferences.theme ?? 'light',
  };
}
