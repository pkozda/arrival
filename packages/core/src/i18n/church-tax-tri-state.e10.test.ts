import { describe, expect, it } from 'vitest';
import { PROFILE_I18N, t } from '@arrival-atlas/core';

describe('churchTax tri-state i18n', () => {
  it('EN/DE/RU/UA labels present without raw keys', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      for (const key of [
        'profile.options.churchTax.unspecified',
        'profile.options.churchTax.yes',
        'profile.options.churchTax.no',
      ] as const) {
        expect(t(key, lang)).not.toMatch(/^profile\.options\.churchTax\./);
        expect(t(key, lang).length).toBeGreaterThan(1);
      }
    }
  });

  it('UA does not inherit RU', () => {
    expect(PROFILE_I18N.ua['profile.options.churchTax.unspecified']).not.toBe(
      PROFILE_I18N.ru['profile.options.churchTax.unspecified']
    );
    expect(PROFILE_I18N.ua['profile.options.churchTax.yes']).not.toBe(
      PROFILE_I18N.ru['profile.options.churchTax.yes']
    );
  });
});
