/** E2E-local mirrors of Arrival Welcome copy (avoid importing app src into Playwright). */

export type WelcomeLocale = 'en' | 'de' | 'ru' | 'ua';

export const ARRIVAL_LANGUAGE_LABELS: Record<WelcomeLocale, string> = {
  de: 'Deutsch',
  ua: 'Українська',
  ru: 'Русский',
  en: 'English',
};

export const ARRIVAL_WELCOME_COPY: Record<
  WelcomeLocale,
  {
    title: string;
    languagePrompt: string;
    trust: string;
    continue: string;
    suggestedLabel: string;
  }
> = {
  en: {
    title: 'You’ve arrived.',
    languagePrompt: 'Start in the language you’re most comfortable with.',
    trust: 'Private guidance for life in Germany — not a government website.',
    continue: 'Continue',
    suggestedLabel: 'Suggested for you',
  },
  de: {
    title: 'Sie sind angekommen.',
    languagePrompt: 'Beginnen Sie in der Sprache, in der Sie sich am wohlsten fühlen.',
    trust: 'Private Orientierung für Ihr Leben in Deutschland — keine Behörden-Website.',
    continue: 'Weiter',
    suggestedLabel: 'Für Sie vorgeschlagen',
  },
  ru: {
    title: 'Вы на месте.',
    languagePrompt: 'Начните на языке, на котором вам удобнее всего.',
    trust: 'Личная поддержка для жизни в Германии — это не сайт госорганов.',
    continue: 'Продолжить',
    suggestedLabel: 'Подходит вам',
  },
  ua: {
    title: 'Ви на місці.',
    languagePrompt: 'Почніть мовою, якою вам найзручніше.',
    trust: 'Приватна підтримка для життя в Німеччині — це не державний сайт.',
    continue: 'Продовжити',
    suggestedLabel: 'Підходить вам',
  },
};

export function toDocumentLanguageTag(language: WelcomeLocale): string {
  return language === 'ua' ? 'uk' : language;
}
