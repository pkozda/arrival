import { describe, expect, it } from 'vitest';
import {
  auditSurfaceText,
  buildDifferingEnglishProbes,
  detectRawTranslationKeys,
  findUnexpectedEnglishInText,
  formatLocalizationReport,
  type SupportedAuditLocale,
} from '../../../tests/e2e/localization/localization-audit';

const dictionaries: Record<SupportedAuditLocale, Record<string, string>> = {
  en: {
    'home.guest.headline': 'Your new life.',
    'home.guest.headlineAccent': 'Mapped here.',
    'guide.destinationLocked': 'Destination locked',
    'nav.enterAtlas': 'Enter Atlas',
    'app.title': 'Arrival Atlas',
    'lifeEvent.title': 'Life Events',
  },
  de: {
    'home.guest.headline': 'Ihr neues Leben.',
    'home.guest.headlineAccent': 'Kartiert hier.',
    'guide.destinationLocked': 'Ziel noch gesperrt',
    'nav.enterAtlas': 'Atlas betreten',
    'app.title': 'Arrival Atlas',
    'lifeEvent.title': 'Lebensereignisse',
  },
  ru: {
    'home.guest.headline': 'Ваша новая жизнь.',
    'home.guest.headlineAccent': 'На карте тут.',
    'guide.destinationLocked': 'Цель пока недоступна',
    'nav.enterAtlas': 'Войти в Atlas',
    'app.title': 'Arrival Atlas',
    'lifeEvent.title': 'Жизненные события',
  },
  ua: {
    'home.guest.headline': 'Ваше нове життя.',
    'home.guest.headlineAccent': 'На карті тут.',
    'guide.destinationLocked': 'Ціль поки недоступна',
    'nav.enterAtlas': 'Увійти в Atlas',
    'app.title': 'Arrival Atlas',
    'lifeEvent.title': 'Життєві події',
  },
};

describe('localization-audit helper', () => {
  it('detects English dictionary values leaked into a Ukrainian surface', () => {
    const probes = buildDifferingEnglishProbes('ua', dictionaries);
    const findings = findUnexpectedEnglishInText(
      'Ваше нове життя.\nYour new life.\nMapped here.',
      'Guest Home',
      probes
    );
    expect(findings.map((f) => f.key).sort()).toEqual([
      'home.guest.headline',
      'home.guest.headlineAccent',
    ]);
  });

  it('detects raw translation keys', () => {
    expect(detectRawTranslationKeys('Oops guide.destinationLocked happened')).toEqual([
      'guide.destinationLocked',
    ]);
  });

  it('does not flag English probes for the English control locale', () => {
    const probes = buildDifferingEnglishProbes('en', dictionaries);
    expect(probes).toEqual([]);
    const result = auditSurfaceText('Guest Home', 'Your new life. Mapped here.', {
      locale: 'en',
      probes,
    });
    expect(result.findings).toEqual([]);
  });

  it('ignores English brand substrings inside allowlisted phrases', () => {
    const probes = buildDifferingEnglishProbes('ua', dictionaries);
    const findings = findUnexpectedEnglishInText(
      'Arrival Atlas\nВаше нове життя.',
      'Guest Home',
      probes
    );
    expect(findings.some((f) => f.text === 'Arrival Atlas')).toBe(false);
    expect(findings.some((f) => f.key === 'home.guest.headline')).toBe(false);
  });

  it('formats a structured multi-surface report', () => {
    const report = {
      locale: 'ua' as const,
      documentLang: 'uk',
      surfaces: [
        { surface: 'Guest Home', present: true, findings: [] },
        {
          surface: 'Profile',
          present: true,
          findings: [
            {
              kind: 'unexpected-english' as const,
              surface: 'Profile',
              text: 'Residency status',
              key: 'profile.residencyStatus',
            },
          ],
        },
      ],
      findings: [
        {
          kind: 'unexpected-english' as const,
          surface: 'Profile',
          text: 'Residency status',
          key: 'profile.residencyStatus',
        },
      ],
    };

    const formatted = formatLocalizationReport(report);
    expect(formatted).toContain('UA');
    expect(formatted).toContain('✓ Guest Home');
    expect(formatted).toContain('✗ Profile');
    expect(formatted).toContain('Residency status');
  });
});
