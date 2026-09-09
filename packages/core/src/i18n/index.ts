import { PRODUCT_NAME, PRODUCT_TAGLINE } from '@arrival-atlas/ui-contract';
import type { SupportedLanguage } from '@arrival-atlas/ui-contract';
import { LIFE_EVENT_I18N } from './life-event-translations.js';
import { LIFE_EVENT_CONTENT_I18N } from './life-event-content-translations.js';
import { ECONOMIC_REALITY_I18N } from './economic-reality-translations.js';
import { SHELL_HOME_I18N } from './shell-home-translations.js';
import { ATLAS_HOME_I18N } from './atlas-home-translations.js';
import { GUIDE_I18N } from './guide-translations.js';
import { CERTAINTY_I18N } from './certainty-translations.js';
import { PROFILE_I18N } from './profile-translations.js';
import { DISCOVERY_I18N } from './discovery-translations.js';
import { EMPLOYMENT_I18N } from './employment-translations.js';
import { BENEFITS_AWARENESS_I18N } from './benefits-awareness-translations.js';
import { HOUSING_SITUATION_I18N } from './housing-situation-translations.js';
import { FINANCE_TAX_I18N } from './finance-tax-translations.js';

export { LIFE_EVENT_I18N, LIFE_EVENT_I18N_KEYS } from './life-event-translations.js';
export { LIFE_EVENT_CONTENT_I18N, LIFE_EVENT_CONTENT_I18N_KEYS } from './life-event-content-translations.js';
export {
  ECONOMIC_REALITY_I18N,
  ECONOMIC_REALITY_I18N_KEYS,
} from './economic-reality-translations.js';
export {
  ER_COPY_KEYS,
  ECONOMIC_REALITY_COPY_KEY_LIST,
  SYSTEM_INTENT_COPY_KEYS,
  SECTION_TYPE_COPY_KEYS,
  EconomicRealityCopyKeyV1Schema,
  EconomicRealityCopySemanticTypeSchema,
  type EconomicRealityCopyKey,
  type EconomicRealityCopyKeyV1,
  type EconomicRealityCopySemanticType,
} from './economic-reality-copy.js';
export { ECONOMIC_REALITY_COPY_EN, type EconomicRealityCopyEnKey } from './economic-reality-strings.en.js';
export { ECONOMIC_REALITY_COPY_DE } from './economic-reality-strings.de.js';
export { ECONOMIC_REALITY_COPY_RU } from './economic-reality-strings.ru.js';
export { ECONOMIC_REALITY_COPY_UA } from './economic-reality-strings.ua.js';
export { SHELL_HOME_I18N, SHELL_HOME_I18N_KEYS } from './shell-home-translations.js';
export { ATLAS_HOME_I18N, ATLAS_HOME_I18N_KEYS } from './atlas-home-translations.js';
export { GUIDE_I18N, GUIDE_I18N_KEYS } from './guide-translations.js';
export { CERTAINTY_I18N, CERTAINTY_I18N_KEYS } from './certainty-translations.js';
export { PROFILE_I18N, PROFILE_I18N_KEYS } from './profile-translations.js';
export { DISCOVERY_I18N, DISCOVERY_I18N_KEYS } from './discovery-translations.js';
export { EMPLOYMENT_I18N, EMPLOYMENT_I18N_KEYS } from './employment-translations.js';
export {
  BENEFITS_AWARENESS_I18N,
  BENEFITS_AWARENESS_I18N_KEYS,
} from './benefits-awareness-translations.js';
export {
  HOUSING_SITUATION_I18N,
  HOUSING_SITUATION_I18N_KEYS,
} from './housing-situation-translations.js';
export {
  FINANCE_TAX_I18N,
  FINANCE_TAX_I18N_KEYS,
} from './finance-tax-translations.js';

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
    'common.retry': 'Retry',
    'common.language': 'Language',
    'app.bootstrap.errorTitle': 'Unable to start session',
    'app.sessionRecreated.title': 'A new Atlas session has started',
    'app.sessionRecreated.message':
      'Your previous local session is no longer available. Atlas has started a new session for you. Information you entered earlier may no longer be available.',
    'app.sessionRecreated.continue': 'Continue',
    'app.profileLoad.errorTitle': 'Unable to load your profile',
    'financial.title': 'Financial Reality',
    'financial.description': 'Understand your net income, taxes, and benefit eligibility',
    'healthcare.title': 'Healthcare Navigation',
    'healthcare.description': 'Navigate Krankenkasse, appointments, and medical access',
    'healthcare.outcome.recommendations': 'Guidance based on your current situation',
    'healthcare.outcome.moreInfo': 'More information is required',
    'healthcare.outcome.noApplicable': 'No applicable guidance for this evaluation',
    'healthcare.outcome.technicalError': 'Healthcare guidance could not be completed',
    'healthcare.insurance.insured': 'Insurance assumption: insured',
    'healthcare.insurance.uninsured': 'Insurance assumption: not insured',
    'healthcare.insurance.unknown': 'Insurance assumption: not provided',
    'healthcare.missing.insurance':
      'Atlas needs a clear insurance status before it can give healthcare guidance for this situation.',
    'healthcare.missing.provideInsurance': 'Update health insurance details',
    'healthcare.missing.why': 'Why this is needed',
    'healthcare.missing.how': 'How to provide it',
    'healthcare.noApplicable.body':
      'Based on what Atlas currently knows about this situation, no applicable healthcare guidance was produced. This does not mean you have no options in Germany.',
    'healthcare.form.notProvided': 'Not provided',
    'grocery.title': 'Grocery Optimization',
    'grocery.description': 'Optimize your food budget with smart shopping guidance',
    'translation.title': 'System Translation',
    'translation.description': 'Translate German administrative terms into plain language',
    'lifeEvent.title': 'Life Events',
    'lifeEvent.description': 'Scenario-based guidance for major life changes',
    ...SHELL_HOME_I18N.en,
    ...ATLAS_HOME_I18N.en,
    ...GUIDE_I18N.en,
    ...CERTAINTY_I18N.en,
    ...PROFILE_I18N.en,
    ...LIFE_EVENT_I18N.en,
    ...LIFE_EVENT_CONTENT_I18N.en,
    ...ECONOMIC_REALITY_I18N.en,
    ...DISCOVERY_I18N.en,
    ...EMPLOYMENT_I18N.en,
    ...BENEFITS_AWARENESS_I18N.en,
    ...HOUSING_SITUATION_I18N.en,
    ...FINANCE_TAX_I18N.en,
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
    'common.retry': 'Erneut versuchen',
    'common.language': 'Sprache',
    'app.bootstrap.errorTitle': 'Sitzung konnte nicht gestartet werden',
    'app.sessionRecreated.title': 'Eine neue Atlas-Sitzung wurde gestartet',
    'app.sessionRecreated.message':
      'Ihre vorherige lokale Sitzung ist nicht mehr verfügbar. Atlas hat eine neue Sitzung für Sie gestartet. Zuvor eingegebene Informationen sind möglicherweise nicht mehr verfügbar.',
    'app.sessionRecreated.continue': 'Weiter',
    'app.profileLoad.errorTitle': 'Profil konnte nicht geladen werden',
    'financial.title': 'Finanzielle Realität',
    'financial.description': 'Verstehen Sie Ihr Nettoeinkommen, Steuern und Leistungsansprüche',
    'healthcare.title': 'Gesundheitsnavigation',
    'healthcare.description': 'Krankenkasse, Termine und medizinischer Zugang',
    'healthcare.outcome.recommendations': 'Orientierung anhand Ihrer aktuellen Situation',
    'healthcare.outcome.moreInfo': 'Weitere Angaben erforderlich',
    'healthcare.outcome.noApplicable': 'Keine passende Orientierung für diese Auswertung',
    'healthcare.outcome.technicalError': 'Gesundheitsorientierung konnte nicht abgeschlossen werden',
    'healthcare.insurance.insured': 'Versicherungsannahme: versichert',
    'healthcare.insurance.uninsured': 'Versicherungsannahme: nicht versichert',
    'healthcare.insurance.unknown': 'Versicherungsannahme: nicht angegeben',
    'healthcare.missing.insurance':
      'Atlas benötigt einen klaren Versicherungsstatus, bevor für diese Situation eine Orientierung möglich ist.',
    'healthcare.missing.provideInsurance': 'Krankenversicherungsdaten aktualisieren',
    'healthcare.missing.why': 'Warum das nötig ist',
    'healthcare.missing.how': 'So können Sie es angeben',
    'healthcare.noApplicable.body':
      'Auf Basis dessen, was Atlas derzeit über diese Situation weiß, wurde keine passende Orientierung erzeugt. Das bedeutet nicht, dass Sie in Deutschland keine Optionen haben.',
    'healthcare.form.notProvided': 'Nicht angegeben',
    'grocery.title': 'Lebensmittel-Optimierung',
    'grocery.description': 'Optimieren Sie Ihr Lebensmittelbudget',
    'translation.title': 'Systemübersetzung',
    'translation.description': 'Deutsche Verwaltungsbegriffe in einfache Sprache übersetzen',
    'lifeEvent.title': 'Lebensereignisse',
    'lifeEvent.description': 'Szenariobasierte Beratung bei wichtigen Lebensveränderungen',
    ...SHELL_HOME_I18N.de,
    ...ATLAS_HOME_I18N.de,
    ...GUIDE_I18N.de,
    ...CERTAINTY_I18N.de,
    ...PROFILE_I18N.de,
    ...LIFE_EVENT_I18N.de,
    ...LIFE_EVENT_CONTENT_I18N.de,
    ...ECONOMIC_REALITY_I18N.de,
    ...DISCOVERY_I18N.de,
    ...EMPLOYMENT_I18N.de,
    ...BENEFITS_AWARENESS_I18N.de,
    ...HOUSING_SITUATION_I18N.de,
    ...FINANCE_TAX_I18N.de,
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
    'common.retry': 'Повторить',
    'common.language': 'Язык',
    'app.bootstrap.errorTitle': 'Не удалось начать сессию',
    'app.sessionRecreated.title': 'Начата новая сессия Atlas',
    'app.sessionRecreated.message':
      'Ваша предыдущая локальная сессия больше недоступна. Atlas начал для вас новую сессию. Ранее введённая информация может быть недоступна.',
    'app.sessionRecreated.continue': 'Продолжить',
    'app.profileLoad.errorTitle': 'Не удалось загрузить профиль',
    'financial.title': 'Финансовая реальность',
    'financial.description': 'Понимание чистого дохода, налогов и права на пособия',
    'healthcare.title': 'Навигация по здравоохранению',
    'healthcare.description': 'Krankenkasse, записи к врачу и медицинский доступ',
    'healthcare.outcome.recommendations': 'Рекомендации на основе вашей текущей ситуации',
    'healthcare.outcome.moreInfo': 'Требуется дополнительная информация',
    'healthcare.outcome.noApplicable': 'Нет применимых рекомендаций для этой оценки',
    'healthcare.outcome.technicalError': 'Не удалось завершить навигацию по здравоохранению',
    'healthcare.insurance.insured': 'Допущение о страховке: застрахован(а)',
    'healthcare.insurance.uninsured': 'Допущение о страховке: не застрахован(а)',
    'healthcare.insurance.unknown': 'Допущение о страховке: не указано',
    'healthcare.missing.insurance':
      'Atlas нужен ясный статус страховки, прежде чем давать рекомендации для этой ситуации.',
    'healthcare.missing.provideInsurance': 'Обновить данные о медстраховке',
    'healthcare.missing.why': 'Почему это нужно',
    'healthcare.missing.how': 'Как указать',
    'healthcare.noApplicable.body':
      'На основе того, что Atlas сейчас знает об этой ситуации, применимых рекомендаций не сформировано. Это не значит, что у вас нет вариантов в Германии.',
    'healthcare.form.notProvided': 'Не указано',
    'grocery.title': 'Оптимизация продуктов',
    'grocery.description': 'Оптимизация бюджета на продукты',
    'translation.title': 'Перевод системы',
    'translation.description': 'Перевод немецких административных терминов',
    'lifeEvent.title': 'Жизненные события',
    'lifeEvent.description': 'Сценарная помощь при важных жизненных изменениях',
    ...SHELL_HOME_I18N.ru,
    ...ATLAS_HOME_I18N.ru,
    ...GUIDE_I18N.ru,
    ...CERTAINTY_I18N.ru,
    ...PROFILE_I18N.ru,
    ...LIFE_EVENT_I18N.ru,
    ...LIFE_EVENT_CONTENT_I18N.ru,
    ...ECONOMIC_REALITY_I18N.ru,
    ...DISCOVERY_I18N.ru,
    ...EMPLOYMENT_I18N.ru,
    ...BENEFITS_AWARENESS_I18N.ru,
    ...HOUSING_SITUATION_I18N.ru,
    ...FINANCE_TAX_I18N.ru,
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
    'common.retry': 'Повторити',
    'common.language': 'Мова',
    'app.bootstrap.errorTitle': 'Не вдалося розпочати сесію',
    'app.sessionRecreated.title': 'Розпочато нову сесію Atlas',
    'app.sessionRecreated.message':
      'Ваша попередня локальна сесія більше недоступна. Atlas розпочав для вас нову сесію. Раніше введена інформація може бути недоступною.',
    'app.sessionRecreated.continue': 'Продовжити',
    'app.profileLoad.errorTitle': 'Не вдалося завантажити профіль',
    'financial.title': 'Фінансова реальність',
    'financial.description': 'Розуміння чистого доходу, податків та права на допомогу',
    'healthcare.title': 'Навігація охорони здоров\'я',
    'healthcare.description': 'Krankenkasse, записи до лікаря та медичний доступ',
    'healthcare.outcome.recommendations': 'Рекомендації на основі вашої поточної ситуації',
    'healthcare.outcome.moreInfo': 'Потрібна додаткова інформація',
    'healthcare.outcome.noApplicable': 'Немає застосовних рекомендацій для цієї оцінки',
    'healthcare.outcome.technicalError': 'Не вдалося завершити навігацію охорони здоров\'я',
    'healthcare.insurance.insured': 'Припущення щодо страховки: застрахований(а)',
    'healthcare.insurance.uninsured': 'Припущення щодо страховки: не застрахований(а)',
    'healthcare.insurance.unknown': 'Припущення щодо страховки: не вказано',
    'healthcare.missing.insurance':
      'Atlas потребує чіткого статусу страховки, перш ніж давати рекомендації для цієї ситуації.',
    'healthcare.missing.provideInsurance': 'Оновити дані про медстраховку',
    'healthcare.missing.why': 'Чому це потрібно',
    'healthcare.missing.how': 'Як вказати',
    'healthcare.noApplicable.body':
      'На основі того, що Atlas зараз знає про цю ситуацію, застосовних рекомендацій не сформовано. Це не означає, що у вас немає варіантів у Німеччині.',
    'healthcare.form.notProvided': 'Не вказано',
    'grocery.title': 'Оптимізація продуктів',
    'grocery.description': 'Оптимізація бюджету на продукти',
    'translation.title': 'Переклад системи',
    'translation.description': 'Переклад німецьких адміністративних термінів',
    'lifeEvent.title': 'Життєві події',
    'lifeEvent.description': 'Сценарна допомога при важливих життєвих змінах',
    ...SHELL_HOME_I18N.ua,
    ...ATLAS_HOME_I18N.ua,
    ...GUIDE_I18N.ua,
    ...CERTAINTY_I18N.ua,
    ...PROFILE_I18N.ua,
    ...LIFE_EVENT_I18N.ua,
    ...LIFE_EVENT_CONTENT_I18N.ua,
    ...ECONOMIC_REALITY_I18N.ua,
    ...DISCOVERY_I18N.ua,
    ...EMPLOYMENT_I18N.ua,
    ...BENEFITS_AWARENESS_I18N.ua,
    ...HOUSING_SITUATION_I18N.ua,
    ...FINANCE_TAX_I18N.ua,
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
