import { describe, expect, it } from 'vitest';
import { DISCOVERY_I18N } from './discovery-translations.js';
import { t } from './index.js';

describe('E1 cross-module localization — Discovery UA vs RU', () => {
  it('UA Discovery nav/module chrome is Ukrainian, not Russian', () => {
    expect(t('nav.discovery', 'ua')).toBe('Пошук');
    expect(t('nav.discovery', 'ua')).not.toBe(t('nav.discovery', 'ru'));
    expect(t('discovery.module.title', 'ua')).toBe('Пошук');
    expect(t('discovery.module.title', 'ua')).not.toBe(DISCOVERY_I18N.ru['discovery.module.title']);
    expect(t('discovery.profiles.create', 'ua')).toBe('Новий профіль');
    expect(t('discovery.profiles.create', 'ua')).not.toBe(
      DISCOVERY_I18N.ru['discovery.profiles.create']
    );
  });
});
