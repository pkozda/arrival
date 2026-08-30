import {
  DOMAIN_EDIT_SECTIONS,
  getDomainEditSection,
} from '@/lib/profile-correction/domain-field-definitions';
import { PROFILE_I18N, PROFILE_I18N_KEYS, getTranslations, t } from '@arrival-atlas/core';
import { describe, expect, it } from 'vitest';

const LOCALES = ['en', 'de', 'ru', 'ua'] as const;

describe('profile intake i18n', () => {
  it('defines the same profile.* keys for every supported language', () => {
    for (const locale of LOCALES) {
      expect(Object.keys(PROFILE_I18N[locale]).sort()).toEqual([...PROFILE_I18N_KEYS].sort());
    }
  });

  it('provides real Ukrainian field and option translations', () => {
    expect(t('profile.fields.residencyStatus', 'ua')).toBe('Статус перебування');
    expect(t('profile.options.residencyStatus.eu-citizen', 'ua')).toBe('Громадянин ЄС');
    expect(t('profile.fields.employmentStatus', 'ua')).toBe('Статус зайнятості');
    expect(t('profile.save', 'ua')).toBe('Зберегти');
    expect(t('profile.fields.residencyStatus', 'ua')).not.toBe(
      t('profile.fields.residencyStatus', 'en')
    );
  });

  it('keeps domain field definitions language-neutral (keys only)', () => {
    for (const section of Object.values(DOMAIN_EDIT_SECTIONS)) {
      expect(section.titleKey.startsWith('profile.sections.')).toBe(true);
      expect(section.summaryKey.startsWith('profile.sections.')).toBe(true);
      for (const field of section.fields) {
        expect(field.labelKey.startsWith('profile.fields.')).toBe(true);
        if (field.placeholderKey) {
          expect(field.placeholderKey.startsWith('profile.placeholders.')).toBe(true);
        }
        for (const option of field.options ?? []) {
          expect(option.labelKey.startsWith('profile.options.')).toBe(true);
          expect(option).not.toHaveProperty('label');
        }
        expect(field).not.toHaveProperty('label');
      }
    }
  });

  it('resolves representative enum labels for every intake enum', () => {
    const section = getDomainEditSection('move-to-germany');
    const residency = section.fields.find((field) => field.formKey === 'residencyStatus');
    expect(residency?.options?.map((o) => o.value)).toEqual(
      expect.arrayContaining(['eu-citizen', 'work-visa', 'unknown'])
    );

    for (const locale of LOCALES) {
      const bundle = getTranslations(locale);
      expect(bundle['profile.options.residencyStatus.eu-citizen']).toBeTruthy();
      expect(bundle['profile.options.employmentStatus.employed']).toBeTruthy();
      expect(bundle['profile.options.maritalStatus.married']).toBeTruthy();
      expect(bundle['profile.options.insuranceType.public']).toBeTruthy();
      expect(bundle['profile.options.taxClass.1']).toBeTruthy();
      expect(bundle['profile.options.preferredLanguage.de']).toBeTruthy();
      expect(bundle['profile.options.theme.system']).toBeTruthy();
    }

    expect(t('profile.options.residencyStatus.eu-citizen', 'de')).toBe('EU-Bürger');
    expect(t('profile.options.employmentStatus.unemployed', 'ru')).toBe('Безработный');
    expect(t('profile.options.maritalStatus.single', 'ua')).toBe('Не одружений / не заміжня');
  });

  it('merges profile keys into getTranslations for all locales', () => {
    for (const locale of LOCALES) {
      const bundle = getTranslations(locale);
      expect(bundle['profile.fields.residencyStatus']).toBe(
        PROFILE_I18N[locale]['profile.fields.residencyStatus']
      );
      expect(bundle['profile.correctInformation']).toBe(
        PROFILE_I18N[locale]['profile.correctInformation']
      );
    }
  });
});
