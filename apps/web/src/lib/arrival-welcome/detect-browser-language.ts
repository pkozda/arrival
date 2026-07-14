import type { SupportedLanguage } from '@/lib/product-contract';
import { SUPPORTED_LANGUAGES } from '@/lib/product-contract';

const BROWSER_LOCALE_MAP: Record<string, SupportedLanguage> = {
  de: 'de',
  en: 'en',
  ru: 'ru',
  uk: 'ua',
  ua: 'ua',
};

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Maps `navigator.language` to a supported language for first-visit suggestion.
 * Returns null when locale is unknown or unsupported.
 */
export function detectBrowserLanguage(
  navigatorLanguage: string | null | undefined
): SupportedLanguage | null {
  if (!navigatorLanguage) {
    return null;
  }

  const normalized = navigatorLanguage.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const [languageCode] = normalized.split('-');
  const mapped = BROWSER_LOCALE_MAP[languageCode];
  if (mapped) {
    return mapped;
  }

  if (isSupportedLanguage(languageCode)) {
    return languageCode;
  }

  return null;
}
