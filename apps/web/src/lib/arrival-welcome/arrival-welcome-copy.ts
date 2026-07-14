import type { SupportedLanguage } from '@/lib/product-contract';

export type ArrivalWelcomeCopy = {
  title: string;
  subtitle: string;
  trust: string;
  languageHeading: string;
  continue: string;
  suggestedLabel: string;
};

export const ARRIVAL_WELCOME_COPY: Record<SupportedLanguage, ArrivalWelcomeCopy> = {
  en: {
    title: 'Welcome to Arrival Atlas',
    subtitle: 'Choose your language. We will guide you through your first steps in Germany.',
    trust: 'Private guidance for your life here — not a government website.',
    languageHeading: 'Choose your language',
    continue: 'Continue',
    suggestedLabel: 'Suggested for you',
  },
  de: {
    title: 'Willkommen bei Arrival Atlas',
    subtitle:
      'Wählen Sie Ihre Sprache. Wir begleiten Sie durch Ihre ersten Schritte in Deutschland.',
    trust: 'Private Orientierung für Ihr Leben hier — keine Behörden-Website.',
    languageHeading: 'Sprache wählen',
    continue: 'Weiter',
    suggestedLabel: 'Für Sie vorgeschlagen',
  },
  ru: {
    title: 'Добро пожаловать в Arrival Atlas',
    subtitle: 'Выберите язык. Мы поможем вам с первыми шагами в Германии.',
    trust: 'Личная поддержка для вашей жизни здесь — это не сайт государственных органов.',
    languageHeading: 'Выберите язык',
    continue: 'Продолжить',
    suggestedLabel: 'Рекомендуем для вас',
  },
  ua: {
    title: 'Ласкаво просимо до Arrival Atlas',
    subtitle: 'Оберіть мову. Ми проведемо вас через перші кроки в Німеччині.',
    trust: 'Приватна підтримка для вашого життя тут — це не державний сайт.',
    languageHeading: 'Оберіть мову',
    continue: 'Продовжити',
    suggestedLabel: 'Рекомендовано для вас',
  },
};

/** Chrome copy before a language is explicitly selected. */
export const ARRIVAL_WELCOME_NEUTRAL_COPY: ArrivalWelcomeCopy = ARRIVAL_WELCOME_COPY.en;
