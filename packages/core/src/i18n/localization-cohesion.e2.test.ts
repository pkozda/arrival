import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DISCOVERY_I18N } from './discovery-translations.js';
import { ATLAS_HOME_I18N } from './atlas-home-translations.js';
import { GUIDE_I18N } from './guide-translations.js';
import { SHELL_HOME_I18N } from './shell-home-translations.js';
import { getTranslations, t } from './index.js';

const discoverySourcePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'discovery-translations.ts'
);

describe('E2 localization cohesion — inheritance & integrity', () => {
  it('A: Discovery UA source does not whole-language inherit RU', () => {
    const source = readFileSync(discoverySourcePath, 'utf8');
    expect(source).not.toMatch(/const UA[\s\S]{0,80}\.\.\.RU\b/);
    expect(source).toMatch(/const UA[\s\S]{0,80}\.\.\.EN\b/);
  });

  it('A2: UA Discovery primary chrome differs from RU (no silent inheritance)', () => {
    const ua = DISCOVERY_I18N.ua;
    const ru = DISCOVERY_I18N.ru;
    for (const key of [
      'nav.discovery',
      'discovery.module.title',
      'discovery.profiles.create',
      'discovery.runNow.button',
      'discovery.results.title',
    ]) {
      expect(ua[key], key).toBeTruthy();
      expect(ua[key], key).not.toBe(ru[key]);
    }
  });

  it('B: UA Discovery HUD chrome is Ukrainian', () => {
    expect(t('nav.discovery', 'ua')).toBe('Пошук');
    expect(t('discovery.module.title', 'ua')).toBe('Пошук');
    expect(t('nav.discovery', 'ua')).not.toBe(t('nav.discovery', 'ru'));
  });

  it('C: UA Atlas Home primary navigation and slide chrome are Ukrainian', () => {
    expect(t('nav.exploreAtlas', 'ua')).toBe('Досліджувати Atlas');
    expect(t('nav.lifeEvents', 'ua')).toBe('Життєві події');
    expect(t('nav.economicReality', 'ua')).toBe('Економічна реальність');
    expect(t('nav.profile', 'ua')).toBe('Профіль');
    expect(t('home.atlas.slide.eyebrow', 'ua')).toMatch(/навігац/i);
    expect(t('home.atlas.slide.orientation.cta', 'ua')).not.toBe(
      t('home.atlas.slide.orientation.cta', 'en')
    );
    expect(t('home.atlas.node.registration', 'ua')).toBe('Реєстрація');
  });

  it('D: UA Journey Guide primary chrome is Ukrainian', () => {
    expect(t('guide.fabLabel', 'ua')).toBe('Провідник');
    expect(t('guide.recommendedNextStep', 'ua')).toMatch(/Рекомендован/);
    expect(t('guide.takeMeThere', 'ua')).toBe('Провести туди');
    expect(t('guide.fabLabel', 'ua')).not.toBe(t('guide.fabLabel', 'ru'));
  });

  it('I–K: EN / DE / RU primary chrome remain in-language', () => {
    expect(t('nav.discovery', 'en')).toBe('Discovery');
    expect(t('nav.discovery', 'de')).toBe('Entdeckung');
    expect(t('nav.discovery', 'ru')).toBe('Поиск');
    expect(t('guide.fabLabel', 'de')).toBe('Reisebegleiter');
    expect(t('home.atlas.slide.eyebrow', 'de')).toMatch(/Lebensnavigation/i);
    expect(t('home.atlas.slide.eyebrow', 'ru')).toMatch(/навигац/i);
  });

  it('L: missing translation falls back to EN deterministically, then key', () => {
    const missing = '__e2.missing.key.never.defined__';
    expect(t(missing, 'ua')).toBe(missing);
    expect(getTranslations('ua')[missing]).toBeUndefined();
    // Per-key EN base: a key present only in EN appears for UA via compose
    expect(getTranslations('ua')['app.title']).toBeTruthy();
  });

  it('M: product name Arrival Atlas remains intentionally untranslated', () => {
    expect(t('app.title', 'ua')).toBe('Arrival Atlas');
    expect(t('app.title', 'de')).toBe('Arrival Atlas');
    expect(t('app.title', 'ru')).toBe('Arrival Atlas');
  });

  it('Atlas Home / Guide / Shell UA dictionaries do not equal RU wholesale', () => {
    expect(ATLAS_HOME_I18N.ua['home.atlas.slide.eyebrow']).not.toBe(
      ATLAS_HOME_I18N.ru['home.atlas.slide.eyebrow']
    );
    expect(GUIDE_I18N.ua['guide.fabLabel']).not.toBe(GUIDE_I18N.ru['guide.fabLabel']);
    expect(SHELL_HOME_I18N.ua['nav.exploreAtlas']).not.toBe(
      SHELL_HOME_I18N.ru['nav.exploreAtlas']
    );
  });
});
