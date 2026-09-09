/**
 * E9 Housing Situation copy — current housing context, not search/marketplace.
 */
import type { SupportedLanguage } from '@arrival-atlas/ui-contract';

type Translations = Record<string, string>;

const EN: Translations = {
  'housing.situation.title': 'Housing situation',
  'housing.situation.subtitle': 'Where you live and what Atlas currently knows about housing costs',
  'housing.situation.disclaimer':
    'This is your current housing situation from profile facts — not a housing search and not an official registration decision.',
  'housing.situation.stateLabel': 'Current state',
  'housing.situation.known': 'What is known',
  'housing.situation.missing': 'What is missing',
  'housing.situation.next': 'What you can do next',
  'housing.situation.registrationLabel': 'Registration relationship',
  'housing.situation.recalculated': 'Housing situation updated from your latest profile facts.',
  'housing.situation.state.NOT_ADDED': 'Not added yet',
  'housing.situation.state.INCOMPLETE': 'Incomplete',
  'housing.situation.state.READY': 'Ready for next steps',
  'housing.situation.explanation.notAdded':
    'Atlas does not yet have housing location or rent facts. Add them to unlock registration and economic checks.',
  'housing.situation.explanation.incomplete':
    'Some housing facts are present, but city and/or cold rent are still missing for a usable housing situation.',
  'housing.situation.explanation.readyPendingRegistration':
    'City and cold rent are recorded. Registration with the municipality is still pending — confirm Anmeldung when ready.',
  'housing.situation.explanation.ready':
    'City and cold rent are recorded, and municipal registration is marked confirmed in your profile.',
  'housing.situation.fact.city': 'City',
  'housing.situation.fact.bundesland': 'Federal state',
  'housing.situation.fact.coldRent': 'Monthly cold rent (EUR)',
  'housing.situation.fact.utilities': 'Monthly utilities (EUR)',
  'housing.situation.fact.registration': 'Municipal registration confirmed',
  'housing.situation.presence.known': 'Yes',
  'housing.situation.presence.unknown': 'Unknown',
  'housing.situation.missing.city': 'City (registrable address proxy)',
  'housing.situation.missing.coldRent': 'Monthly cold rent',
  'housing.situation.registration.needsAddress':
    'Needs a city before registration can proceed',
  'housing.situation.registration.pending':
    'Address known — municipal confirmation not yet recorded',
  'housing.situation.registration.confirmed':
    'Municipal registration marked as confirmed in your profile',
  'housing.situation.action.updateHousing': 'Update housing details',
  'housing.situation.action.confirmRegistration': 'Prepare Anmeldung confirmation',
  'housing.situation.action.reviewHousing': 'Review housing details',
};

const DE: Translations = {
  'housing.situation.title': 'Wohnsituation',
  'housing.situation.subtitle':
    'Wo Sie wohnen und was Atlas derzeit über Wohnkosten weiß',
  'housing.situation.disclaimer':
    'Das ist Ihre aktuelle Wohnsituation aus Profildaten — keine Wohnungssuche und keine offizielle Anmeldungsentscheidung.',
  'housing.situation.stateLabel': 'Aktueller Stand',
  'housing.situation.known': 'Was bekannt ist',
  'housing.situation.missing': 'Was fehlt',
  'housing.situation.next': 'Was Sie als Nächstes tun können',
  'housing.situation.registrationLabel': 'Bezug zur Anmeldung',
  'housing.situation.recalculated': 'Wohnsituation anhand Ihrer aktuellen Profildaten aktualisiert.',
  'housing.situation.state.NOT_ADDED': 'Noch nicht angegeben',
  'housing.situation.state.INCOMPLETE': 'Unvollständig',
  'housing.situation.state.READY': 'Bereit für nächste Schritte',
  'housing.situation.explanation.notAdded':
    'Atlas hat noch keine Wohnort- oder Mietangaben. Ergänzen Sie diese für Anmeldung und wirtschaftliche Prüfungen.',
  'housing.situation.explanation.incomplete':
    'Einige Wohnangaben sind vorhanden, aber Stadt und/oder Kaltmiete fehlen noch für eine nutzbare Wohnsituation.',
  'housing.situation.explanation.readyPendingRegistration':
    'Stadt und Kaltmiete sind erfasst. Die kommunale Anmeldung steht noch aus — Anmeldung bestätigen, wenn bereit.',
  'housing.situation.explanation.ready':
    'Stadt und Kaltmiete sind erfasst, und die kommunale Anmeldung ist im Profil als bestätigt markiert.',
  'housing.situation.fact.city': 'Stadt',
  'housing.situation.fact.bundesland': 'Bundesland',
  'housing.situation.fact.coldRent': 'Monatliche Kaltmiete (EUR)',
  'housing.situation.fact.utilities': 'Monatliche Nebenkosten (EUR)',
  'housing.situation.fact.registration': 'Kommunale Anmeldung bestätigt',
  'housing.situation.presence.known': 'Ja',
  'housing.situation.presence.unknown': 'Unbekannt',
  'housing.situation.missing.city': 'Stadt (Proxy für anmeldefähige Adresse)',
  'housing.situation.missing.coldRent': 'Monatliche Kaltmiete',
  'housing.situation.registration.needsAddress':
    'Stadt erforderlich, bevor die Anmeldung fortgesetzt werden kann',
  'housing.situation.registration.pending':
    'Adresse bekannt — kommunale Bestätigung noch nicht erfasst',
  'housing.situation.registration.confirmed':
    'Kommunale Anmeldung im Profil als bestätigt markiert',
  'housing.situation.action.updateHousing': 'Wohnangaben aktualisieren',
  'housing.situation.action.confirmRegistration': 'Anmeldung vorbereiten',
  'housing.situation.action.reviewHousing': 'Wohnangaben prüfen',
};

const RU: Translations = {
  'housing.situation.title': 'Жилищная ситуация',
  'housing.situation.subtitle':
    'Где вы живёте и что Atlas сейчас знает о расходах на жильё',
  'housing.situation.disclaimer':
    'Это текущая жилищная ситуация по фактам профиля — не поиск жилья и не официальное решение о регистрации.',
  'housing.situation.stateLabel': 'Текущее состояние',
  'housing.situation.known': 'Что известно',
  'housing.situation.missing': 'Чего не хватает',
  'housing.situation.next': 'Что можно сделать дальше',
  'housing.situation.registrationLabel': 'Связь с регистрацией',
  'housing.situation.recalculated': 'Жилищная ситуация обновлена по последним фактам профиля.',
  'housing.situation.state.NOT_ADDED': 'Ещё не добавлено',
  'housing.situation.state.INCOMPLETE': 'Неполно',
  'housing.situation.state.READY': 'Готово к следующим шагам',
  'housing.situation.explanation.notAdded':
    'У Atlas ещё нет данных о месте проживания или аренде. Добавьте их для регистрации и экономических проверок.',
  'housing.situation.explanation.incomplete':
    'Часть жилищных фактов есть, но город и/или холодная аренда всё ещё нужны для полезной жилищной ситуации.',
  'housing.situation.explanation.readyPendingRegistration':
    'Город и холодная аренда записаны. Муниципальная регистрация ещё не подтверждена — подтвердите Anmeldung, когда будете готовы.',
  'housing.situation.explanation.ready':
    'Город и холодная аренда записаны, а муниципальная регистрация отмечена в профиле как подтверждённая.',
  'housing.situation.fact.city': 'Город',
  'housing.situation.fact.bundesland': 'Федеральная земля',
  'housing.situation.fact.coldRent': 'Ежемесячная холодная аренда (EUR)',
  'housing.situation.fact.utilities': 'Ежемесячные коммунальные платежи (EUR)',
  'housing.situation.fact.registration': 'Муниципальная регистрация подтверждена',
  'housing.situation.presence.known': 'Да',
  'housing.situation.presence.unknown': 'Неизвестно',
  'housing.situation.missing.city': 'Город (прокси регистрируемого адреса)',
  'housing.situation.missing.coldRent': 'Ежемесячная холодная аренда',
  'housing.situation.registration.needsAddress':
    'Нужен город, прежде чем продолжить регистрацию',
  'housing.situation.registration.pending':
    'Адрес известен — муниципальное подтверждение ещё не записано',
  'housing.situation.registration.confirmed':
    'Муниципальная регистрация отмечена в профиле как подтверждённая',
  'housing.situation.action.updateHousing': 'Обновить данные о жилье',
  'housing.situation.action.confirmRegistration': 'Подготовить подтверждение Anmeldung',
  'housing.situation.action.reviewHousing': 'Проверить данные о жилье',
};

const UA: Translations = {
  'housing.situation.title': 'Житлова ситуація',
  'housing.situation.subtitle':
    'Де ви живете і що Atlas зараз знає про витрати на житло',
  'housing.situation.disclaimer':
    'Це ваша поточна житлова ситуація за фактами профілю — не пошук житла і не офіційне рішення про реєстрацію.',
  'housing.situation.stateLabel': 'Поточний стан',
  'housing.situation.known': 'Що відомо',
  'housing.situation.missing': 'Чого бракує',
  'housing.situation.next': 'Що можна зробити далі',
  'housing.situation.registrationLabel': 'Зв’язок із реєстрацією',
  'housing.situation.recalculated': 'Житлову ситуацію оновлено за останніми фактами профілю.',
  'housing.situation.state.NOT_ADDED': 'Ще не додано',
  'housing.situation.state.INCOMPLETE': 'Неповно',
  'housing.situation.state.READY': 'Готово до наступних кроків',
  'housing.situation.explanation.notAdded':
    'У Atlas ще немає даних про місце проживання або оренду. Додайте їх для реєстрації та економічних перевірок.',
  'housing.situation.explanation.incomplete':
    'Частина житлових фактів є, але місто та/або холодна оренда все ще потрібні для корисної житлової ситуації.',
  'housing.situation.explanation.readyPendingRegistration':
    'Місто та холодну оренду записано. Муніципальну реєстрацію ще не підтверджено — підтвердіть Anmeldung, коли будете готові.',
  'housing.situation.explanation.ready':
    'Місто та холодну оренду записано, а муніципальну реєстрацію позначено в профілі як підтверджену.',
  'housing.situation.fact.city': 'Місто',
  'housing.situation.fact.bundesland': 'Федеральна земля',
  'housing.situation.fact.coldRent': 'Щомісячна холодна оренда (EUR)',
  'housing.situation.fact.utilities': 'Щомісячні комунальні платежі (EUR)',
  'housing.situation.fact.registration': 'Муніципальну реєстрацію підтверджено',
  'housing.situation.presence.known': 'Так',
  'housing.situation.presence.unknown': 'Невідомо',
  'housing.situation.missing.city': 'Місто (проксі реєстрованої адреси)',
  'housing.situation.missing.coldRent': 'Щомісячна холодна оренда',
  'housing.situation.registration.needsAddress':
    'Потрібне місто, перш ніж продовжити реєстрацію',
  'housing.situation.registration.pending':
    'Адресу відомо — муніципальне підтвердження ще не записано',
  'housing.situation.registration.confirmed':
    'Муніципальну реєстрацію позначено в профілі як підтверджену',
  'housing.situation.action.updateHousing': 'Оновити дані про житло',
  'housing.situation.action.confirmRegistration': 'Підготувати підтвердження Anmeldung',
  'housing.situation.action.reviewHousing': 'Переглянути дані про житло',
};

export const HOUSING_SITUATION_I18N: Record<SupportedLanguage, Translations> = {
  en: EN,
  de: DE,
  ru: RU,
  ua: UA,
};

export const HOUSING_SITUATION_I18N_KEYS = Object.keys(EN);
