import type { SupportedLanguage } from '@arrival-atlas/ui-contract';

type Translations = Record<string, string>;

/**
 * PD-004 Employment dual-track presentation copy.
 * Merged into platform dictionaries via packages/core/src/i18n/index.ts.
 */
export const EMPLOYMENT_I18N: Record<SupportedLanguage, Translations> = {
  en: {
    'employment.eyebrow': 'Work & Growth',
    'employment.title': 'Employment',
    'employment.subtitle':
      'Separate your current work situation from actively looking for a job.',
    'employment.backToAtlas': 'Back to Atlas',
    'employment.track.situation': 'Current situation',
    'employment.track.capability': 'Active capability',
    'employment.workIncome.title': 'Work & Income',
    'employment.workIncome.description':
      'Your current employment and income information in Atlas — not a job search.',
    'employment.workIncome.currentLabel': 'Current status:',
    'employment.workIncome.status.notProvided': 'Not provided yet',
    'employment.workIncome.incomeNoted': 'Income details are already on file.',
    'employment.workIncome.locked':
      'Work & Income unlocks after you complete Move to Germany (origin and residency).',
    'employment.workIncome.unlockCta': 'Complete Move to Germany',
    'employment.workIncome.provideCta': 'Add work & income details',
    'employment.workIncome.reviewCta': 'Review work & income',
    'employment.jobSearch.title': 'Job Search',
    'employment.jobSearch.description':
      'Start looking for opportunities through Discovery Jobs. This is separate from your current employment status.',
    'employment.jobSearch.honesty':
      'Opening Job Search takes you to Discovery. It does not run a search or invent results by itself.',
    'employment.jobSearch.cta': 'Open Discovery Jobs',
  },
  de: {
    'employment.eyebrow': 'Arbeit & Wachstum',
    'employment.title': 'Beschäftigung',
    'employment.subtitle':
      'Trennen Sie Ihre aktuelle Arbeitssituation von der aktiven Jobsuche.',
    'employment.backToAtlas': 'Zurück zu Atlas',
    'employment.track.situation': 'Aktuelle Situation',
    'employment.track.capability': 'Aktive Fähigkeit',
    'employment.workIncome.title': 'Arbeit & Einkommen',
    'employment.workIncome.description':
      'Ihre aktuellen Beschäftigungs- und Einkommensangaben in Atlas — keine Jobsuche.',
    'employment.workIncome.currentLabel': 'Aktueller Status:',
    'employment.workIncome.status.notProvided': 'Noch nicht angegeben',
    'employment.workIncome.incomeNoted': 'Einkommensangaben sind bereits hinterlegt.',
    'employment.workIncome.locked':
      'Arbeit & Einkommen wird freigeschaltet, nachdem Sie „Umzug nach Deutschland“ (Herkunft und Aufenthalt) abgeschlossen haben.',
    'employment.workIncome.unlockCta': 'Umzug nach Deutschland abschließen',
    'employment.workIncome.provideCta': 'Arbeit & Einkommen ergänzen',
    'employment.workIncome.reviewCta': 'Arbeit & Einkommen ansehen',
    'employment.jobSearch.title': 'Jobsuche',
    'employment.jobSearch.description':
      'Suchen Sie Chancen über Discovery Jobs. Das ist unabhängig von Ihrem aktuellen Beschäftigungsstatus.',
    'employment.jobSearch.honesty':
      'Jobsuche öffnet Discovery. Es startet keine Suche und erzeugt keine Ergebnisse von allein.',
    'employment.jobSearch.cta': 'Discovery Jobs öffnen',
  },
  ru: {
    'employment.eyebrow': 'Работа и рост',
    'employment.title': 'Занятость',
    'employment.subtitle':
      'Отделите текущую рабочую ситуацию от активного поиска работы.',
    'employment.backToAtlas': 'Назад в Atlas',
    'employment.track.situation': 'Текущая ситуация',
    'employment.track.capability': 'Активная возможность',
    'employment.workIncome.title': 'Работа и доход',
    'employment.workIncome.description':
      'Ваши текущие данные о занятости и доходе в Atlas — это не поиск работы.',
    'employment.workIncome.currentLabel': 'Текущий статус:',
    'employment.workIncome.status.notProvided': 'Пока не указано',
    'employment.workIncome.incomeNoted': 'Сведения о доходе уже сохранены.',
    'employment.workIncome.locked':
      'Раздел «Работа и доход» открывается после заполнения «Переезд в Германию» (страна происхождения и статус проживания).',
    'employment.workIncome.unlockCta': 'Заполнить «Переезд в Германию»',
    'employment.workIncome.provideCta': 'Добавить работу и доход',
    'employment.workIncome.reviewCta': 'Просмотреть работу и доход',
    'employment.jobSearch.title': 'Поиск работы',
    'employment.jobSearch.description':
      'Ищите возможности через Discovery Jobs. Это отдельно от вашего текущего статуса занятости.',
    'employment.jobSearch.honesty':
      '«Поиск работы» открывает Discovery. Он сам по себе не запускает поиск и не создаёт результаты.',
    'employment.jobSearch.cta': 'Открыть Discovery Jobs',
  },
  ua: {
    'employment.eyebrow': 'Робота і зростання',
    'employment.title': 'Зайнятість',
    'employment.subtitle':
      'Відокремте поточну робочу ситуацію від активного пошуку роботи.',
    'employment.backToAtlas': 'Назад до Atlas',
    'employment.track.situation': 'Поточна ситуація',
    'employment.track.capability': 'Активна можливість',
    'employment.workIncome.title': 'Робота і дохід',
    'employment.workIncome.description':
      'Ваші поточні дані про зайнятість і дохід в Atlas — це не пошук роботи.',
    'employment.workIncome.currentLabel': 'Поточний статус:',
    'employment.workIncome.status.notProvided': 'Ще не вказано',
    'employment.workIncome.incomeNoted': 'Відомості про дохід уже збережено.',
    'employment.workIncome.locked':
      'Розділ «Робота і дохід» відкривається після заповнення «Переїзд до Німеччини» (країна походження та статус проживання).',
    'employment.workIncome.unlockCta': 'Заповнити «Переїзд до Німеччини»',
    'employment.workIncome.provideCta': 'Додати роботу і дохід',
    'employment.workIncome.reviewCta': 'Переглянути роботу і дохід',
    'employment.jobSearch.title': 'Пошук роботи',
    'employment.jobSearch.description':
      'Шукайте можливості через Discovery Jobs. Це окремо від вашого поточного статусу зайнятості.',
    'employment.jobSearch.honesty':
      '«Пошук роботи» відкриває Discovery. Він сам по собі не запускає пошук і не створює результати.',
    'employment.jobSearch.cta': 'Відкрити Discovery Jobs',
  },
};

export const EMPLOYMENT_I18N_KEYS = Object.keys(EMPLOYMENT_I18N.en);
