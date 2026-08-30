import type { SupportedLanguage } from '@/lib/product-contract';

export type ArrivalWelcomeCopy = {
  /** Short arrival statement — not a product slogan. */
  title: string;
  /** Single language-oriented instruction (no duplicate heading). */
  languagePrompt: string;
  /** Quiet trust / purpose line after the language list. */
  trust: string;
  continue: string;
  suggestedLabel: string;
};

export const ARRIVAL_WELCOME_COPY: Record<SupportedLanguage, ArrivalWelcomeCopy> = {
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

/**
 * Pre-selection chrome: no English paragraph wall.
 * Native language button labels carry the primary action.
 */
export const ARRIVAL_WELCOME_NEUTRAL_COPY: ArrivalWelcomeCopy = {
  title: 'Arrival Atlas',
  languagePrompt: '',
  trust: '',
  continue: '→',
  suggestedLabel: '',
};
