import { describe, expect, it } from 'vitest';
import { FINANCE_TAX_I18N, t } from '@arrival-atlas/core';

describe('E10 Finance Tax Administration i18n', () => {
  it('F — EN/DE/RU/UA keys present without raw keys', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      expect(t('finance.tax.title', lang)).not.toMatch(/^finance\.tax\./);
      expect(t('finance.tax.state.NOT_ADDED', lang).length).toBeGreaterThan(2);
      expect(t('finance.tax.action.updateTax', lang).length).toBeGreaterThan(3);
      expect(t('finance.tax.disclaimer', lang)).toMatch(/not|keine|не |не /i);
      expect(t('finance.tax.bankingDeferred', lang).length).toBeGreaterThan(10);
    }
  });

  it('UA does not inherit RU', () => {
    expect(FINANCE_TAX_I18N.ua['finance.tax.title']).not.toBe(FINANCE_TAX_I18N.ru['finance.tax.title']);
    expect(t('finance.tax.explanation.notAdded', 'ua')).not.toBe(
      t('finance.tax.explanation.notAdded', 'ru')
    );
  });
});
