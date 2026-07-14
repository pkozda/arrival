import { describe, expect, it } from 'vitest';
import { detectBrowserLanguage } from '@/lib/arrival-welcome/detect-browser-language';

describe('detectBrowserLanguage', () => {
  it('maps Ukrainian browser locales to ua', () => {
    expect(detectBrowserLanguage('uk-UA')).toBe('ua');
    expect(detectBrowserLanguage('uk')).toBe('ua');
  });

  it('maps German, Russian, and English locales', () => {
    expect(detectBrowserLanguage('de-DE')).toBe('de');
    expect(detectBrowserLanguage('ru-RU')).toBe('ru');
    expect(detectBrowserLanguage('en-US')).toBe('en');
  });

  it('returns null for unsupported locales', () => {
    expect(detectBrowserLanguage('fr-FR')).toBeNull();
    expect(detectBrowserLanguage('')).toBeNull();
    expect(detectBrowserLanguage(undefined)).toBeNull();
  });
});
