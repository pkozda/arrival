import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SupportedAuditLocale } from './localization-audit';

type Dict = Record<string, string>;
type LocaleDict = Record<SupportedAuditLocale, Dict>;

let cached: {
  shell: LocaleDict;
  guide: LocaleDict;
  certainty: LocaleDict;
  merged: LocaleDict;
} | null = null;

/**
 * Load core i18n dictionaries from the built ESM dist.
 * Playwright cannot resolve the package "exports" map via require(), so we
 * import dist files directly by file URL.
 */
export async function loadCoreI18nDictionaries(): Promise<{
  shell: LocaleDict;
  guide: LocaleDict;
  certainty: LocaleDict;
  merged: LocaleDict;
}> {
  if (cached) {
    return cached;
  }

  // Playwright runs with cwd = apps/web
  const distI18n = path.resolve(process.cwd(), '../../packages/core/dist/i18n');
  const toUrl = (file: string) => pathToFileURL(path.join(distI18n, file)).href;

  const [{ SHELL_HOME_I18N }, { GUIDE_I18N }, { CERTAINTY_I18N }, index] = await Promise.all([
    import(toUrl('shell-home-translations.js')),
    import(toUrl('guide-translations.js')),
    import(toUrl('certainty-translations.js')),
    import(toUrl('index.js')),
  ]);

  const locales: SupportedAuditLocale[] = ['en', 'de', 'ru', 'ua'];
  const merged = {} as LocaleDict;
  for (const locale of locales) {
    merged[locale] = index.getTranslations(locale) as Dict;
  }

  cached = {
    shell: SHELL_HOME_I18N as LocaleDict,
    guide: GUIDE_I18N as LocaleDict,
    certainty: CERTAINTY_I18N as LocaleDict,
    merged,
  };
  return cached;
}
