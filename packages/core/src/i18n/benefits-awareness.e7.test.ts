import { describe, expect, it } from 'vitest';
import { BENEFITS_AWARENESS_I18N, t } from '@arrival-atlas/core';

describe('E7 Benefits aggregation i18n', () => {
  it('I — EN/DE/RU/UA aggregate keys present without raw keys', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      for (const key of [
        'benefits.awareness.aggregate.oneActionable',
        'benefits.awareness.aggregate.multipleActionable',
        'benefits.awareness.aggregate.needInformation',
        'benefits.awareness.aggregate.allCompleted',
        'benefits.awareness.aggregate.noneActionable',
        'benefits.awareness.aggregate.primaryNext',
        'benefits.awareness.aggregate.completedMarker',
      ] as const) {
        const text = t(key, lang);
        expect(text.length).toBeGreaterThan(3);
        expect(text).not.toMatch(/^benefits\.awareness\./);
      }
    }
  });

  it('UA does not inherit RU for aggregate chrome', () => {
    expect(BENEFITS_AWARENESS_I18N.ua['benefits.awareness.aggregate.multipleActionable']).not.toBe(
      BENEFITS_AWARENESS_I18N.ru['benefits.awareness.aggregate.multipleActionable']
    );
    expect(t('benefits.awareness.aggregate.allCompleted', 'ua')).not.toBe(
      t('benefits.awareness.aggregate.allCompleted', 'ru')
    );
  });

  it('aggregate copy avoids legal priority / monetary ranking claims', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      const text = t('benefits.awareness.aggregate.multipleActionable', lang).toLowerCase();
      expect(text).not.toMatch(/best benefit|highest amount|ml rank|лучший|найкращ/);
      expect(text).toMatch(/not|nicht|не |не /i);
    }
  });
});
