/**
 * Localization smoke-test audit helpers.
 *
 * Compares visible UI text against English dictionary values to find likely
 * untranslated chrome — without a naive "no Latin characters" rule.
 */

export type SupportedAuditLocale = 'en' | 'de' | 'ru' | 'ua';

export type LocalizationFinding = {
  kind: 'unexpected-english' | 'raw-key' | 'english-as-locale-dictionary';
  surface: string;
  text: string;
  key?: string;
  reason?: string;
};

export type SurfaceAuditResult = {
  surface: string;
  present: boolean;
  findings: LocalizationFinding[];
};

export type LocalizationAuditReport = {
  locale: SupportedAuditLocale;
  documentLang?: string;
  surfaces: SurfaceAuditResult[];
  findings: LocalizationFinding[];
};

/** Intentionally English (or language-neutral) visible strings with documented reasons. */
export const EXPECTED_ENGLISH_UI: ReadonlyArray<{ text: string; reason: string }> = [
  { text: 'Arrival Atlas', reason: 'Product / brand name' },
  { text: 'Atlas', reason: 'Product short name used in logo and CTAs across locales' },
  { text: 'Deutsch', reason: 'Native language selector label' },
  { text: 'English', reason: 'Native language selector label' },
  { text: 'Українська', reason: 'Native language selector label (Cyrillic; listed for completeness)' },
  { text: 'Русский', reason: 'Native language selector label (Cyrillic; listed for completeness)' },
  { text: '→', reason: 'Neutral continue / CTA glyph' },
  { text: '✦', reason: 'Neutral suggested-language glyph before selection' },
];

/** Translation keys whose identical en/ua values are acceptable (brand / technical). */
export const LANGUAGE_NEUTRAL_DICTIONARY_KEYS: ReadonlySet<string> = new Set([
  'app.title',
]);

const RAW_KEY_PATTERN =
  /\b(?:home|guide|certainty|nav|common|profile|app|financial|healthcare|grocery|translation|lifeEvent|life-event)\.[a-zA-Z0-9_.]+\b/g;

const MIN_ENGLISH_PHRASE_LENGTH = 8;

const CHROME_KEY_PREFIXES = [
  'home.',
  'nav.',
  'common.',
  'guide.',
  'certainty.',
  'profile.',
  'arrival.',
  'lifeEvent.',
  'app.',
  'ER.',
] as const;

export function isChromeTranslationKey(key: string): boolean {
  return CHROME_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Remove allowlisted brand / neutral phrases so substring probes cannot match inside them. */
export function stripAllowlistedPhrases(visibleText: string): string {
  let stripped = normalizeVisibleText(visibleText);
  for (const entry of EXPECTED_ENGLISH_UI) {
    const allowed = normalizeVisibleText(entry.text);
    if (!allowed) continue;
    stripped = stripped.split(allowed).join(' ');
  }
  return normalizeVisibleText(stripped);
}

export function normalizeVisibleText(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitVisibleFragments(input: string): string[] {
  return input
    .split(/\n+/)
    .map((line) => normalizeVisibleText(line))
    .filter((line) => line.length > 0);
}

export function isAllowlistedEnglish(text: string): boolean {
  const normalized = normalizeVisibleText(text);
  if (!normalized) {
    return true;
  }
  return EXPECTED_ENGLISH_UI.some((entry) => normalizeVisibleText(entry.text) === normalized);
}

export function detectRawTranslationKeys(visibleText: string): string[] {
  const matches = visibleText.match(RAW_KEY_PATTERN) ?? [];
  return [...new Set(matches)].sort();
}

export type EnglishPhraseProbe = {
  key: string;
  english: string;
  localized: string;
};

/**
 * Build English phrases that should NOT appear when `locale` is active,
 * because the dictionary provides a different localized string.
 */
export function buildDifferingEnglishProbes(
  locale: SupportedAuditLocale,
  dictionaries: Record<SupportedAuditLocale, Record<string, string>>
): EnglishPhraseProbe[] {
  if (locale === 'en') {
    return [];
  }

  const en = dictionaries.en ?? {};
  const localized = dictionaries[locale] ?? {};
  const probes: EnglishPhraseProbe[] = [];

  for (const [key, englishRaw] of Object.entries(en)) {
    if (!isChromeTranslationKey(key)) {
      continue;
    }
    if (LANGUAGE_NEUTRAL_DICTIONARY_KEYS.has(key)) {
      continue;
    }
    if (!englishRaw || englishRaw.includes('{')) {
      continue;
    }
    const english = normalizeVisibleText(englishRaw);
    if (english.length < MIN_ENGLISH_PHRASE_LENGTH) {
      continue;
    }
    if (isAllowlistedEnglish(english)) {
      continue;
    }

    const localizedValue = normalizeVisibleText(localized[key] ?? '');
    if (!localizedValue || localizedValue === english) {
      continue;
    }

    probes.push({ key, english, localized: localizedValue });
  }

  probes.sort((a, b) => b.english.length - a.english.length);
  return probes;
}

/**
 * Keys where the locale dictionary still equals English (possible en-as-ua style regression).
 * Skips language-neutral keys and short/template values.
 */
export function findEnglishAsLocaleDictionaryKeys(
  locale: SupportedAuditLocale,
  dictionaries: Record<SupportedAuditLocale, Record<string, string>>,
  namespaces: string[]
): LocalizationFinding[] {
  if (locale === 'en') {
    return [];
  }

  const en = dictionaries.en ?? {};
  const localized = dictionaries[locale] ?? {};
  const findings: LocalizationFinding[] = [];

  for (const [key, englishRaw] of Object.entries(en)) {
    if (!namespaces.some((ns) => key === ns || key.startsWith(`${ns}.`))) {
      continue;
    }
    if (LANGUAGE_NEUTRAL_DICTIONARY_KEYS.has(key)) {
      continue;
    }
    if (!englishRaw || englishRaw.includes('{')) {
      continue;
    }
    const english = normalizeVisibleText(englishRaw);
    if (english.length < MIN_ENGLISH_PHRASE_LENGTH || isAllowlistedEnglish(english)) {
      continue;
    }
    const localizedValue = normalizeVisibleText(localized[key] ?? '');
    if (localizedValue === english) {
      findings.push({
        kind: 'english-as-locale-dictionary',
        surface: 'dictionary',
        text: english,
        key,
        reason: `${locale} dictionary value equals English`,
      });
    }
  }

  return findings;
}

export function findUnexpectedEnglishInText(
  visibleText: string,
  surface: string,
  probes: EnglishPhraseProbe[]
): LocalizationFinding[] {
  const normalizedHaystack = stripAllowlistedPhrases(visibleText);
  if (!normalizedHaystack) {
    return [];
  }

  const findings: LocalizationFinding[] = [];
  const seen = new Set<string>();

  for (const probe of probes) {
    if (!normalizedHaystack.includes(probe.english)) {
      continue;
    }
    if (isAllowlistedEnglish(probe.english)) {
      continue;
    }
    const dedupe = `${probe.key}::${probe.english}`;
    if (seen.has(dedupe)) {
      continue;
    }
    seen.add(dedupe);
    findings.push({
      kind: 'unexpected-english',
      surface,
      text: probe.english,
      key: probe.key,
      reason: `Expected localized “${probe.localized}”`,
    });
  }

  return findings;
}

export function findRawKeysInText(visibleText: string, surface: string): LocalizationFinding[] {
  return detectRawTranslationKeys(visibleText).map((key) => ({
    kind: 'raw-key' as const,
    surface,
    text: key,
    key,
    reason: 'Visible raw translation key (missing dictionary entry or unresolved t())',
  }));
}

export function auditSurfaceText(
  surface: string,
  visibleText: string,
  options: {
    locale: SupportedAuditLocale;
    probes: EnglishPhraseProbe[];
    present?: boolean;
  }
): SurfaceAuditResult {
  const present = options.present ?? normalizeVisibleText(visibleText).length > 0;
  const findings: LocalizationFinding[] = [];

  if (!present) {
    return { surface, present: false, findings };
  }

  findings.push(...findRawKeysInText(visibleText, surface));

  if (options.locale !== 'en') {
    findings.push(...findUnexpectedEnglishInText(visibleText, surface, options.probes));
  }

  return { surface, present: true, findings };
}

export function formatLocalizationReport(report: LocalizationAuditReport): string {
  const lines: string[] = [];
  lines.push(`Localization Smoke Test`);
  lines.push('');
  lines.push(report.locale.toUpperCase());
  if (report.documentLang) {
    lines.push(`document.documentElement.lang = ${report.documentLang}`);
  }
  lines.push('────────────────────────────');

  for (const surface of report.surfaces) {
    if (!surface.present) {
      lines.push(`○ ${surface.surface} (not present)`);
      continue;
    }
    const mark = surface.findings.length === 0 ? '✓' : '✗';
    lines.push(`${mark} ${surface.surface}`);
  }

  const unexpected = report.findings.filter((f) => f.kind === 'unexpected-english');
  const rawKeys = report.findings.filter((f) => f.kind === 'raw-key');
  const dictDupes = report.findings.filter((f) => f.kind === 'english-as-locale-dictionary');

  lines.push('');
  lines.push('Unexpected English:');
  if (unexpected.length === 0) {
    lines.push('  none');
  } else {
    const bySurface = groupBySurface(unexpected);
    for (const [surface, items] of bySurface) {
      lines.push(`  ${surface}`);
      for (const item of items) {
        lines.push(`    "${item.text}"${item.key ? `  [${item.key}]` : ''}`);
      }
    }
  }

  lines.push('');
  lines.push('Raw keys:');
  if (rawKeys.length === 0) {
    lines.push('  none');
  } else {
    for (const item of rawKeys) {
      lines.push(`  ${item.surface}: ${item.text}`);
    }
  }

  if (dictDupes.length > 0) {
    lines.push('');
    lines.push('English-as-locale dictionary values:');
    for (const item of dictDupes) {
      lines.push(`  ${item.key}: "${item.text}"`);
    }
  }

  return lines.join('\n');
}

function groupBySurface(findings: LocalizationFinding[]): Array<[string, LocalizationFinding[]]> {
  const map = new Map<string, LocalizationFinding[]>();
  for (const finding of findings) {
    const list = map.get(finding.surface) ?? [];
    list.push(finding);
    map.set(finding.surface, list);
  }
  return [...map.entries()];
}

export function mergeReportFindings(report: LocalizationAuditReport): LocalizationFinding[] {
  return report.surfaces.flatMap((surface) => surface.findings);
}
