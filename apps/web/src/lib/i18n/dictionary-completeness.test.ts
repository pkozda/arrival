import {
  CERTAINTY_I18N,
  CERTAINTY_I18N_KEYS,
  DISCOVERY_I18N,
  DISCOVERY_I18N_KEYS,
  GUIDE_I18N,
  GUIDE_I18N_KEYS,
  LIFE_EVENT_CONTENT_I18N,
  LIFE_EVENT_CONTENT_I18N_KEYS,
  LIFE_EVENT_I18N,
  LIFE_EVENT_I18N_KEYS,
  PROFILE_I18N,
  PROFILE_I18N_KEYS,
  SHELL_HOME_I18N,
  SHELL_HOME_I18N_KEYS,
  getTranslations,
} from '@arrival-atlas/core';
import { describe, expect, it } from 'vitest';
import {
  LANGUAGE_NEUTRAL_DICTIONARY_KEYS,
  findEnglishAsLocaleDictionaryKeys,
  type SupportedAuditLocale,
} from '../../../tests/e2e/localization/localization-audit';

const LOCALES: SupportedAuditLocale[] = ['en', 'de', 'ru', 'ua'];

function assertKeyParity(
  name: string,
  bundles: Record<SupportedAuditLocale, Record<string, string>>,
  expectedKeys: string[]
) {
  for (const locale of LOCALES) {
    expect(Object.keys(bundles[locale]).sort(), `${name} keys for ${locale}`).toEqual(
      [...expectedKeys].sort()
    );
  }
}

describe('Localization dictionary completeness', () => {
  it('keeps shell/home keys complete across locales', () => {
    assertKeyParity('SHELL_HOME_I18N', SHELL_HOME_I18N, SHELL_HOME_I18N_KEYS);
  });

  it('keeps guide.* keys complete across locales', () => {
    assertKeyParity('GUIDE_I18N', GUIDE_I18N, GUIDE_I18N_KEYS);
  });

  it('keeps certainty.* keys complete across locales', () => {
    assertKeyParity('CERTAINTY_I18N', CERTAINTY_I18N, CERTAINTY_I18N_KEYS);
  });

  it('keeps profile.* keys complete across locales', () => {
    assertKeyParity('PROFILE_I18N', PROFILE_I18N, PROFILE_I18N_KEYS);
  });

  it('keeps discovery.* keys complete across locales', () => {
    assertKeyParity('DISCOVERY_I18N', DISCOVERY_I18N, DISCOVERY_I18N_KEYS);
  });

  it('keeps life-event UI keys complete across locales', () => {
    assertKeyParity('LIFE_EVENT_I18N', LIFE_EVENT_I18N, LIFE_EVENT_I18N_KEYS);
  });

  it('keeps life-event content keys complete across locales', () => {
    assertKeyParity(
      'LIFE_EVENT_CONTENT_I18N',
      LIFE_EVENT_CONTENT_I18N,
      LIFE_EVENT_CONTENT_I18N_KEYS
    );
  });

  it('merges Phase 1–2B namespaces into getTranslations for every locale', () => {
    for (const locale of LOCALES) {
      const bundle = getTranslations(locale);
      for (const key of SHELL_HOME_I18N_KEYS) {
        expect(bundle[key], `${locale}:${key}`).toBe(SHELL_HOME_I18N[locale][key]);
      }
      for (const key of GUIDE_I18N_KEYS) {
        expect(bundle[key], `${locale}:${key}`).toBe(GUIDE_I18N[locale][key]);
      }
      for (const key of CERTAINTY_I18N_KEYS) {
        expect(bundle[key], `${locale}:${key}`).toBe(CERTAINTY_I18N[locale][key]);
      }
      for (const key of PROFILE_I18N_KEYS) {
        expect(bundle[key], `${locale}:${key}`).toBe(PROFILE_I18N[locale][key]);
      }
    }
  });

  it('flags English-as-Ukrainian values in shell/guide/certainty/profile chrome namespaces', () => {
    const dictionaries = {
      en: getTranslations('en'),
      de: getTranslations('de'),
      ru: getTranslations('ru'),
      ua: getTranslations('ua'),
    };

    const findings = findEnglishAsLocaleDictionaryKeys('ua', dictionaries, [
      'home',
      'nav',
      'common',
      'guide',
      'certainty',
      'profile',
    ]).filter((finding) => !LANGUAGE_NEUTRAL_DICTIONARY_KEYS.has(finding.key ?? ''));

    // Report clearly — this is a detector, not a silent pass.
    expect(
      findings,
      findings.map((f) => `${f.key}=${f.text}`).join('\n') || 'none'
    ).toEqual([]);
  });
});
