import { describe, expect, it } from 'vitest';
import { BENEFITS_AWARENESS_I18N, t } from '@arrival-atlas/core';

describe('E5 Kindergeld awareness i18n', () => {
  it('H — EN/DE/RU/UA Kindergeld keys are present and distinct', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      const title = t('benefits.awareness.kindergeld.title', lang);
      expect(title).toMatch(/Kindergeld/i);
      expect(title).not.toMatch(/^benefits\.awareness\./);
      expect(t('benefits.awareness.kindergeld.notEnoughInformation', lang).length).toBeGreaterThan(20);
      expect(t('benefits.awareness.kindergeld.readyToAct', lang).length).toBeGreaterThan(20);
      expect(t('benefits.awareness.action.openOfficialKindergeld', lang)).not.toMatch(/^benefits\.awareness\./);
      expect(t('benefits.awareness.missing.children', lang)).not.toMatch(/^benefits\.awareness\./);
    }
  });

  it('UA does not inherit RU for Kindergeld chrome', () => {
    expect(BENEFITS_AWARENESS_I18N.ua['benefits.awareness.kindergeld.title']).not.toBe(
      BENEFITS_AWARENESS_I18N.ru['benefits.awareness.kindergeld.title']
    );
    expect(BENEFITS_AWARENESS_I18N.ua['benefits.awareness.kindergeld.notEnoughInformation']).not.toBe(
      BENEFITS_AWARENESS_I18N.ru['benefits.awareness.kindergeld.notEnoughInformation']
    );
    expect(t('benefits.awareness.title', 'ua')).not.toBe(t('benefits.awareness.title', 'ru'));
  });

  it('disclaimer and Kindergeld copy avoid eligibility overclaim wording', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      for (const key of [
        'benefits.awareness.disclaimer',
        'benefits.awareness.kindergeld.readyToAct',
        'benefits.awareness.kindergeld.notEnoughInformation',
      ] as const) {
        const text = t(key, lang).toLowerCase();
        expect(text).not.toMatch(/you are eligible|you qualify|вы имеете право|ви маєте право|sie haben anspruch/);
      }
    }
  });
});

describe('E4 benefits awareness i18n (regression after E5 chrome rename)', () => {
  it('UA does not inherit RU for primary chrome', () => {
    expect(BENEFITS_AWARENESS_I18N.ua['benefits.awareness.title']).not.toBe(
      BENEFITS_AWARENESS_I18N.ru['benefits.awareness.title']
    );
    expect(t('benefits.awareness.state.NOT_ENOUGH_INFORMATION', 'ua')).not.toBe(
      t('benefits.awareness.state.NOT_ENOUGH_INFORMATION', 'ru')
    );
  });

  it('EN/DE primary labels are in-language', () => {
    expect(t('benefits.awareness.title', 'en')).toMatch(/Benefits awareness/i);
    expect(t('benefits.awareness.title', 'de')).toMatch(/Leistungen|Hinweis/i);
    expect(t('benefits.awareness.disclaimer', 'en')).toMatch(/not an official/i);
    expect(t('benefits.awareness.disclaimer', 'de')).toMatch(/keine offizielle/i);
  });
});
