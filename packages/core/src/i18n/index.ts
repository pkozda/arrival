import { PRODUCT_NAME, PRODUCT_TAGLINE } from '@arrivalos/ui-contract';
import type { SupportedLanguage } from '@arrivalos/ui-contract';

type TranslationKey = string;
type Translations = Record<TranslationKey, string>;

const translations: Record<SupportedLanguage, Translations> = {
  en: {
    'app.title': PRODUCT_NAME,
    'app.subtitle': PRODUCT_TAGLINE,
    'nav.financial': 'Financial Reality',
    'nav.healthcare': 'Healthcare Navigation',
    'nav.grocery': 'Grocery Optimization',
    'nav.translation': 'System Translation',
    'nav.lifeEvents': 'Life Events',
    'common.submit': 'Get guidance',
    'common.loading': 'Analyzing...',
    'common.error': 'Something went wrong',
    'common.language': 'Language',
    'financial.title': 'Financial Reality',
    'financial.description': 'Understand your net income, taxes, and benefit eligibility',
    'healthcare.title': 'Healthcare Navigation',
    'healthcare.description': 'Navigate Krankenkasse, appointments, and medical access',
    'grocery.title': 'Grocery Optimization',
    'grocery.description': 'Optimize your food budget with smart shopping guidance',
    'translation.title': 'System Translation',
    'translation.description': 'Translate German administrative terms into plain language',
    'lifeEvent.title': 'Life Events',
    'lifeEvent.description': 'Scenario-based guidance for major life changes',
  },
  de: {
    'app.title': PRODUCT_NAME,
    'app.subtitle': 'Ihr Entscheidungsunterstützung in Deutschland',
    'nav.financial': 'Finanzielle Realität',
    'nav.healthcare': 'Gesundheitsnavigation',
    'nav.grocery': 'Lebensmittel-Optimierung',
    'nav.translation': 'Systemübersetzung',
    'nav.lifeEvents': 'Lebensereignisse',
    'common.submit': 'Beratung erhalten',
    'common.loading': 'Analysiere...',
    'common.error': 'Etwas ist schiefgelaufen',
    'common.language': 'Sprache',
    'financial.title': 'Finanzielle Realität',
    'financial.description': 'Verstehen Sie Ihr Nettoeinkommen, Steuern und Leistungsansprüche',
    'healthcare.title': 'Gesundheitsnavigation',
    'healthcare.description': 'Krankenkasse, Termine und medizinischer Zugang',
    'grocery.title': 'Lebensmittel-Optimierung',
    'grocery.description': 'Optimieren Sie Ihr Lebensmittelbudget',
    'translation.title': 'Systemübersetzung',
    'translation.description': 'Deutsche Verwaltungsbegriffe in einfache Sprache übersetzen',
    'lifeEvent.title': 'Lebensereignisse',
    'lifeEvent.description': 'Szenariobasierte Beratung bei wichtigen Lebensveränderungen',
  },
  ru: {
    'app.title': PRODUCT_NAME,
    'app.subtitle': 'Ваш помощник в принятии решений в Германии',
    'nav.financial': 'Финансовая реальность',
    'nav.healthcare': 'Навигация по здравоохранению',
    'nav.grocery': 'Оптимизация продуктов',
    'nav.translation': 'Перевод системы',
    'nav.lifeEvents': 'Жизненные события',
    'common.submit': 'Получить рекомендации',
    'common.loading': 'Анализ...',
    'common.error': 'Что-то пошло не так',
    'common.language': 'Язык',
    'financial.title': 'Финансовая реальность',
    'financial.description': 'Понимание чистого дохода, налогов и права на пособия',
    'healthcare.title': 'Навигация по здравоохранению',
    'healthcare.description': 'Krankenkasse, записи к врачу и медицинский доступ',
    'grocery.title': 'Оптимизация продуктов',
    'grocery.description': 'Оптимизация бюджета на продукты',
    'translation.title': 'Перевод системы',
    'translation.description': 'Перевод немецких административных терминов',
    'lifeEvent.title': 'Жизненные события',
    'lifeEvent.description': 'Сценарная помощь при важных жизненных изменениях',
  },
  ua: {
    'app.title': PRODUCT_NAME,
    'app.subtitle': 'Ваш помічник у прийнятті рішень у Німеччині',
    'nav.financial': 'Фінансова реальність',
    'nav.healthcare': 'Навігація охорони здоров\'я',
    'nav.grocery': 'Оптимізація продуктів',
    'nav.translation': 'Переклад системи',
    'nav.lifeEvents': 'Життєві події',
    'common.submit': 'Отримати рекомендації',
    'common.loading': 'Аналіз...',
    'common.error': 'Щось пішло не так',
    'common.language': 'Мова',
    'financial.title': 'Фінансова реальність',
    'financial.description': 'Розуміння чистого доходу, податків та права на допомогу',
    'healthcare.title': 'Навігація охорони здоров\'я',
    'healthcare.description': 'Krankenkasse, записи до лікаря та медичний доступ',
    'grocery.title': 'Оптимізація продуктів',
    'grocery.description': 'Оптимізація бюджету на продукти',
    'translation.title': 'Переклад системи',
    'translation.description': 'Переклад німецьких адміністративних термінів',
    'lifeEvent.title': 'Життєві події',
    'lifeEvent.description': 'Сценарна допомога при важливих життєвих змінах',
  },
};

export function t(key: TranslationKey, language: SupportedLanguage = 'en'): string {
  return translations[language]?.[key] ?? translations.en[key] ?? key;
}

export function getTranslations(language: SupportedLanguage): Translations {
  return { ...translations.en, ...translations[language] };
}

export function getSupportedLanguages(): SupportedLanguage[] {
  return ['en', 'de', 'ru', 'ua'];
}

export function addTranslations(
  language: SupportedLanguage,
  entries: Translations
): void {
  translations[language] = { ...translations[language], ...entries };
}
