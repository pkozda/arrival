import type { SupportedLanguage } from '@/lib/product-contract';

/** Native-language labels for arrival language controls. */
export const ARRIVAL_LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  de: 'Deutsch',
  ua: 'Українська',
  ru: 'Русский',
  en: 'English',
};

/** Flag glyphs for language selector affordance. */
export const ARRIVAL_LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  de: '🇩🇪',
  ua: '🇺🇦',
  ru: '🇷🇺',
  en: '🇬🇧',
};
