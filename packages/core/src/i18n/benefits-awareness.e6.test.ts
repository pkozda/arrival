import { describe, expect, it } from 'vitest';
import { BENEFITS_AWARENESS_I18N, t } from '@arrival-atlas/core';

describe('E6 Kindergeld completion i18n', () => {
  it('H — EN/DE/RU/UA completion + record CTA keys', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      const completed = t('benefits.awareness.kindergeld.completed', lang);
      expect(completed).toMatch(/Kindergeld/i);
      expect(completed).not.toMatch(/^benefits\.awareness\./);
      expect(completed.toLowerCase()).toMatch(/confirm|bestätigt|подтверж|підтвердж|profile|profil|профил|профіл/i);
      expect(t('benefits.awareness.action.recordReceivingKindergeld', lang)).toMatch(/Kindergeld/i);
      expect(t('profile.fields.receivingKindergeld', lang)).toMatch(/Kindergeld/i);
    }
  });

  it('UA does not inherit RU for completion copy', () => {
    expect(BENEFITS_AWARENESS_I18N.ua['benefits.awareness.kindergeld.completed']).not.toBe(
      BENEFITS_AWARENESS_I18N.ru['benefits.awareness.kindergeld.completed']
    );
    expect(t('benefits.awareness.action.recordReceivingKindergeld', 'ua')).not.toBe(
      t('benefits.awareness.action.recordReceivingKindergeld', 'ru')
    );
  });

  it('completion copy avoids eligibility / authority-verified overclaim', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      const text = t('benefits.awareness.kindergeld.completed', lang).toLowerCase();
      expect(text).not.toMatch(
        /you are eligible|you qualify|authority confirmed|вы имеете право|ви маєте право|behörte bestätigt/
      );
    }
  });
});
