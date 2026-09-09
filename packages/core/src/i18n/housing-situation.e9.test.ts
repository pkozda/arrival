import { describe, expect, it } from 'vitest';
import { HOUSING_SITUATION_I18N, t } from '@arrival-atlas/core';

describe('E9 Housing Situation i18n', () => {
  it('K — EN/DE/RU/UA keys present without raw keys', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      expect(t('housing.situation.title', lang)).not.toMatch(/^housing\.situation\./);
      expect(t('housing.situation.state.NOT_ADDED', lang).length).toBeGreaterThan(2);
      expect(t('housing.situation.action.updateHousing', lang).length).toBeGreaterThan(3);
      expect(t('housing.situation.disclaimer', lang)).toMatch(/not|nicht|keine|не |не /i);
    }
  });

  it('UA does not inherit RU', () => {
    expect(HOUSING_SITUATION_I18N.ua['housing.situation.title']).not.toBe(
      HOUSING_SITUATION_I18N.ru['housing.situation.title']
    );
    expect(t('housing.situation.explanation.notAdded', 'ua')).not.toBe(
      t('housing.situation.explanation.notAdded', 'ru')
    );
  });
});
