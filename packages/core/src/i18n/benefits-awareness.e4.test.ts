import { describe, expect, it } from 'vitest';
import { BENEFITS_AWARENESS_I18N, t } from '@arrival-atlas/core';

describe('E4 benefits awareness i18n', () => {
  it('UA does not inherit RU for primary chrome', () => {
    expect(BENEFITS_AWARENESS_I18N.ua['benefits.awareness.title']).not.toBe(
      BENEFITS_AWARENESS_I18N.ru['benefits.awareness.title']
    );
    expect(t('benefits.awareness.state.NOT_ENOUGH_INFORMATION', 'ua')).not.toBe(
      t('benefits.awareness.state.NOT_ENOUGH_INFORMATION', 'ru')
    );
  });

  it('EN/DE/RU primary labels are in-language', () => {
    expect(t('benefits.awareness.title', 'en')).toMatch(/Benefits awareness/i);
    expect(t('benefits.awareness.title', 'de')).toMatch(/Leistungen|Hinweis/i);
    expect(t('benefits.awareness.disclaimer', 'en')).toMatch(/not an official/i);
    expect(t('benefits.awareness.disclaimer', 'de')).toMatch(/keine offizielle/i);
  });

  it('disclaimer avoids eligibility overclaim wording', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      const text = t('benefits.awareness.disclaimer', lang);
      expect(text.toLowerCase()).not.toMatch(/you are eligible|you qualify|вы имеете право|ви маєте право/);
    }
  });
});
