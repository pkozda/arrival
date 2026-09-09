/**
 * E10 Finance — Tax Administration copy (not banking, not advice).
 */
import type { SupportedLanguage } from '@arrival-atlas/ui-contract';

type Translations = Record<string, string>;

const EN: Translations = {
  'finance.tax.title': 'Tax administration',
  'finance.tax.subtitle': 'Steuerklasse and church tax facts Atlas already stores',
  'finance.tax.disclaimer':
    'This is tax setup from your profile — not financial advice, not a Finanzamt decision, and not a banking product.',
  'finance.tax.bankingDeferred':
    'Bank account and IBAN setup are not available yet — Atlas has no authoritative bank-account facts.',
  'finance.tax.stateLabel': 'Current state',
  'finance.tax.known': 'What is known',
  'finance.tax.missing': 'What is missing',
  'finance.tax.next': 'What you can do next',
  'finance.tax.recalculated': 'Tax administration updated from your latest profile facts.',
  'finance.tax.state.NOT_ADDED': 'Not added yet',
  'finance.tax.state.INCOMPLETE': 'Incomplete',
  'finance.tax.state.READY': 'Ready for next steps',
  'finance.tax.explanation.notAdded':
    'Atlas does not yet have your tax class. Add Steuerklasse so payroll and net-income views can use it.',
  'finance.tax.explanation.incomplete':
    'Some tax facts are present, but Steuerklasse is still missing.',
  'finance.tax.explanation.ready':
    'Steuerklasse and church-tax preference are recorded in your profile.',
  'finance.tax.explanation.readyTaxClassOnly':
    'Steuerklasse is recorded. Church-tax preference is still unknown (not treated as “no”).',
  'finance.tax.fact.taxClass': 'Tax class (Steuerklasse)',
  'finance.tax.fact.churchTax': 'Church tax (Kirchensteuer)',
  'finance.tax.presence.yes': 'Yes',
  'finance.tax.presence.no': 'No',
  'finance.tax.presence.unknown': 'Unknown',
  'finance.tax.missing.taxClass': 'Tax class (Steuerklasse 1–6)',
  'finance.tax.action.updateTax': 'Update tax details',
  'finance.tax.action.reviewTax': 'Review tax details',
};

const DE: Translations = {
  'finance.tax.title': 'Steuerverwaltung',
  'finance.tax.subtitle': 'Steuerklasse und Kirchensteuer, die Atlas bereits speichert',
  'finance.tax.disclaimer':
    'Das ist Steuer-Setup aus Ihrem Profil — keine Finanzberatung, keine Finanzamt-Entscheidung und kein Bankprodukt.',
  'finance.tax.bankingDeferred':
    'Konto- und IBAN-Einrichtung sind noch nicht verfügbar — Atlas hat keine maßgeblichen Bankkontodaten.',
  'finance.tax.stateLabel': 'Aktueller Stand',
  'finance.tax.known': 'Was bekannt ist',
  'finance.tax.missing': 'Was fehlt',
  'finance.tax.next': 'Was Sie als Nächstes tun können',
  'finance.tax.recalculated': 'Steuerverwaltung anhand Ihrer aktuellen Profildaten aktualisiert.',
  'finance.tax.state.NOT_ADDED': 'Noch nicht angegeben',
  'finance.tax.state.INCOMPLETE': 'Unvollständig',
  'finance.tax.state.READY': 'Bereit für nächste Schritte',
  'finance.tax.explanation.notAdded':
    'Atlas hat noch keine Steuerklasse. Ergänzen Sie die Steuerklasse für Lohnsteuer- und Nettolohnansichten.',
  'finance.tax.explanation.incomplete':
    'Einige Steuerangaben sind vorhanden, aber die Steuerklasse fehlt noch.',
  'finance.tax.explanation.ready':
    'Steuerklasse und Kirchensteuer-Angabe sind im Profil erfasst.',
  'finance.tax.explanation.readyTaxClassOnly':
    'Steuerklasse ist erfasst. Die Kirchensteuer-Angabe ist noch unbekannt (wird nicht als „nein“ gewertet).',
  'finance.tax.fact.taxClass': 'Steuerklasse',
  'finance.tax.fact.churchTax': 'Kirchensteuer',
  'finance.tax.presence.yes': 'Ja',
  'finance.tax.presence.no': 'Nein',
  'finance.tax.presence.unknown': 'Unbekannt',
  'finance.tax.missing.taxClass': 'Steuerklasse (1–6)',
  'finance.tax.action.updateTax': 'Steuerangaben aktualisieren',
  'finance.tax.action.reviewTax': 'Steuerangaben prüfen',
};

const RU: Translations = {
  'finance.tax.title': 'Налоговое администрирование',
  'finance.tax.subtitle': 'Класс налога и церковный налог, которые Atlas уже хранит',
  'finance.tax.disclaimer':
    'Это налоговая настройка из профиля — не финансовый совет, не решение Finanzamt и не банковский продукт.',
  'finance.tax.bankingDeferred':
    'Открытие счёта и IBAN пока недоступны — у Atlas нет авторитетных данных о банковском счёте.',
  'finance.tax.stateLabel': 'Текущее состояние',
  'finance.tax.known': 'Что известно',
  'finance.tax.missing': 'Чего не хватает',
  'finance.tax.next': 'Что можно сделать дальше',
  'finance.tax.recalculated': 'Налоговое администрирование обновлено по последним фактам профиля.',
  'finance.tax.state.NOT_ADDED': 'Ещё не добавлено',
  'finance.tax.state.INCOMPLETE': 'Неполно',
  'finance.tax.state.READY': 'Готово к следующим шагам',
  'finance.tax.explanation.notAdded':
    'У Atlas ещё нет вашего налогового класса. Добавьте Steuerklasse для расчётов зарплаты и чистого дохода.',
  'finance.tax.explanation.incomplete':
    'Часть налоговых фактов есть, но налоговый класс всё ещё отсутствует.',
  'finance.tax.explanation.ready':
    'Налоговый класс и предпочтение по церковному налогу записаны в профиле.',
  'finance.tax.explanation.readyTaxClassOnly':
    'Налоговый класс записан. Предпочтение по церковному налогу ещё неизвестно (не считается «нет»).',
  'finance.tax.fact.taxClass': 'Налоговый класс (Steuerklasse)',
  'finance.tax.fact.churchTax': 'Церковный налог (Kirchensteuer)',
  'finance.tax.presence.yes': 'Да',
  'finance.tax.presence.no': 'Нет',
  'finance.tax.presence.unknown': 'Неизвестно',
  'finance.tax.missing.taxClass': 'Налоговый класс (Steuerklasse 1–6)',
  'finance.tax.action.updateTax': 'Обновить налоговые данные',
  'finance.tax.action.reviewTax': 'Проверить налоговые данные',
};

const UA: Translations = {
  'finance.tax.title': 'Податкове адміністрування',
  'finance.tax.subtitle': 'Клас податку та церковний податок, які Atlas уже зберігає',
  'finance.tax.disclaimer':
    'Це податкове налаштування з профілю — не фінансова порада, не рішення Finanzamt і не банківський продукт.',
  'finance.tax.bankingDeferred':
    'Відкриття рахунку та IBAN поки недоступні — у Atlas немає авторитетних даних про банківський рахунок.',
  'finance.tax.stateLabel': 'Поточний стан',
  'finance.tax.known': 'Що відомо',
  'finance.tax.missing': 'Чого бракує',
  'finance.tax.next': 'Що можна зробити далі',
  'finance.tax.recalculated': 'Податкове адміністрування оновлено за останніми фактами профілю.',
  'finance.tax.state.NOT_ADDED': 'Ще не додано',
  'finance.tax.state.INCOMPLETE': 'Неповно',
  'finance.tax.state.READY': 'Готово до наступних кроків',
  'finance.tax.explanation.notAdded':
    'У Atlas ще немає вашого податкового класу. Додайте Steuerklasse для розрахунків зарплати та чистого доходу.',
  'finance.tax.explanation.incomplete':
    'Частина податкових фактів є, але податковий клас досі відсутній.',
  'finance.tax.explanation.ready':
    'Податковий клас і вподобання щодо церковного податку записані в профілі.',
  'finance.tax.explanation.readyTaxClassOnly':
    'Податковий клас записано. Вподобання щодо церковного податку ще невідоме (не вважається «ні»).',
  'finance.tax.fact.taxClass': 'Податковий клас (Steuerklasse)',
  'finance.tax.fact.churchTax': 'Церковний податок (Kirchensteuer)',
  'finance.tax.presence.yes': 'Так',
  'finance.tax.presence.no': 'Ні',
  'finance.tax.presence.unknown': 'Невідомо',
  'finance.tax.missing.taxClass': 'Податковий клас (Steuerklasse 1–6)',
  'finance.tax.action.updateTax': 'Оновити податкові дані',
  'finance.tax.action.reviewTax': 'Переглянути податкові дані',
};

export const FINANCE_TAX_I18N: Record<SupportedLanguage, Translations> = {
  en: EN,
  de: DE,
  ru: RU,
  ua: UA,
};

export const FINANCE_TAX_I18N_KEYS = Object.keys(EN);
