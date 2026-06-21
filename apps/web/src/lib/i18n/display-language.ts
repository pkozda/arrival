import type { SupportedLanguage } from '@/lib/product-contract';
import { SupportedLanguageSchema } from '@/lib/product-contract';

export const DISPLAY_LANGUAGE_STORAGE_KEY = 'arrival_atlas_display_language';

export function readStoredDisplayLanguage(): SupportedLanguage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(DISPLAY_LANGUAGE_STORAGE_KEY);
    const parsed = SupportedLanguageSchema.safeParse(stored);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeStoredDisplayLanguage(language: SupportedLanguage): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(DISPLAY_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // ignore quota / private mode
  }
}
