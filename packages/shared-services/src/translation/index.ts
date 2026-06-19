import type { SupportedLanguage } from '@arrival-atlas/core';

export interface TranslationEntry {
  term: string;
  category: 'administrative' | 'financial' | 'healthcare' | 'employment' | 'housing' | 'general';
  translations: Partial<Record<SupportedLanguage, string>>;
  explanation: Partial<Record<SupportedLanguage, string>>;
  relatedTerms?: string[];
}

const glossary: TranslationEntry[] = [
  {
    term: 'Anmeldung',
    category: 'administrative',
    translations: { de: 'Anmeldung', en: 'Registration', ru: 'Регистрация', ua: 'Реєстрація' },
    explanation: {
      de: 'Pflichtige Meldung beim Einwohnermeldeamt innerhalb von 14 Tagen nach Einzug',
      en: 'Mandatory registration at the residents\' office within 14 days of moving in',
      ru: 'Обязательная регистрация в ведомстве по делам населения в течение 14 дней после переезда',
      ua: 'Обов\'язкова реєстрація у відомстві з питань населення протягом 14 днів після переїзду',
    },
    relatedTerms: ['Bürgeramt', 'Meldebescheinigung'],
  },
  {
    term: 'Bürgergeld',
    category: 'financial',
    translations: { de: 'Bürgergeld', en: 'Citizens\' Benefit', ru: 'Гражданское пособие', ua: 'Громадянська допомога' },
    explanation: {
      de: 'Grundsicherung für Arbeitsuchende, ersetzt Hartz IV seit 2023',
      en: 'Basic income support for job seekers, replaced Hartz IV in 2023',
      ru: 'Базовая поддержка для ищущих работу, заменила Hartz IV с 2023 года',
      ua: 'Базова підтримка для тих, хто шукає роботу, замінила Hartz IV з 2023 року',
    },
    relatedTerms: ['Jobcenter', 'Regelsatz'],
  },
  {
    term: 'Krankenkasse',
    category: 'healthcare',
    translations: { de: 'Krankenkasse', en: 'Health Insurance Fund', ru: 'Больничная касса', ua: 'Каса медичного страхування' },
    explanation: {
      de: 'Gesetzliche Krankenversicherung — Pflicht für alle Einwohner',
      en: 'Public health insurance — mandatory for all residents',
      ru: 'Государственное медицинское страхование — обязательно для всех жителей',
      ua: 'Державне медичне страхування — обов\'язкове для всіх мешканців',
    },
    relatedTerms: ['Krankenversicherung', 'Gesundheitskarte'],
  },
  {
    term: 'Steuerklasse',
    category: 'financial',
    translations: { de: 'Steuerklasse', en: 'Tax Class', ru: 'Налоговый класс', ua: 'Податковий клас' },
    explanation: {
      de: 'Bestimmt die Lohnsteuerabzüge (I–VI), abhängig von Familienstand und Einkommen',
      en: 'Determines payroll tax deductions (I–VI), based on marital status and income',
      ru: 'Определяет удержание подоходного налога (I–VI), зависит от семейного положения и дохода',
      ua: 'Визначає утримання податку на доходи (I–VI), залежить від сімейного стану та доходу',
    },
    relatedTerms: ['Finanzamt', 'Lohnsteuer'],
  },
  {
    term: 'Jobcenter',
    category: 'employment',
    translations: { de: 'Jobcenter', en: 'Job Center', ru: 'Центр занятости', ua: 'Центр зайнятості' },
    explanation: {
      de: 'Zuständig für Arbeitsvermittlung und Bürgergeld-Auszahlung',
      en: 'Responsible for job placement and Bürgergeld payments',
      ru: 'Отвечает за трудоустройство и выплату Bürgergeld',
      ua: 'Відповідає за працевлаштування та виплату Bürgergeld',
    },
    relatedTerms: ['Bürgergeld', 'Arbeitsagentur'],
  },
  {
    term: 'Finanzamt',
    category: 'financial',
    translations: { de: 'Finanzamt', en: 'Tax Office', ru: 'Налоговая инспекция', ua: 'Податкова інспекція' },
    explanation: {
      de: 'Zuständig für Einkommensteuer, Steuererklärung und Steuerklassen',
      en: 'Responsible for income tax, tax returns, and tax classes',
      ru: 'Отвечает за подоходный налог, налоговые декларации и налоговые классы',
      ua: 'Відповідає за податок на доходи, податкові декларації та податкові класи',
    },
    relatedTerms: ['Steuerklasse', 'Steuererklärung'],
  },
  {
    term: 'Krankenversicherung',
    category: 'healthcare',
    translations: { de: 'Krankenversicherung', en: 'Health Insurance', ru: 'Медицинское страхование', ua: 'Медичне страхування' },
    explanation: {
      de: 'Pflichtversicherung — gesetzlich (GKV) oder privat (PKV)',
      en: 'Mandatory insurance — public (GKV) or private (PKV)',
      ru: 'Обязательное страхование — государственное (GKV) или частное (PKV)',
      ua: 'Обов\'язкове страхування — державне (GKV) або приватне (PKV)',
    },
    relatedTerms: ['Krankenkasse', 'Gesundheitskarte'],
  },
  {
    term: 'Wohnungsgeberbestätigung',
    category: 'housing',
    translations: { de: 'Wohnungsgeberbestätigung', en: 'Landlord Confirmation', ru: 'Подтверждение арендодателя', ua: 'Підтвердження орендодавця' },
    explanation: {
      de: 'Bestätigung des Vermieters für die Anmeldung — Pflichtdokument',
      en: 'Landlord confirmation required for registration — mandatory document',
      ru: 'Подтверждение арендодателя для регистрации — обязательный документ',
      ua: 'Підтвердження орендодавця для реєстрації — обов\'язковий документ',
    },
    relatedTerms: ['Anmeldung'],
  },
];

export function translateTerm(
  term: string,
  _targetLanguage: SupportedLanguage
): TranslationEntry | null {
  const entry = glossary.find(
    (e) => e.term.toLowerCase() === term.toLowerCase()
  );
  if (!entry) return null;
  return entry;
}

export function searchTerms(
  query: string,
  language: SupportedLanguage = 'en'
): TranslationEntry[] {
  const q = query.toLowerCase();
  return glossary.filter(
    (e) =>
      e.term.toLowerCase().includes(q) ||
      Object.values(e.translations).some((t) => t?.toLowerCase().includes(q)) ||
      e.explanation[language]?.toLowerCase().includes(q)
  );
}

export function getTermsByCategory(
  category: TranslationEntry['category']
): TranslationEntry[] {
  return glossary.filter((e) => e.category === category);
}

export function getAllTerms(): TranslationEntry[] {
  return [...glossary];
}

export function formatTranslation(
  entry: TranslationEntry,
  language: SupportedLanguage
): {
  term: string;
  translation: string;
  explanation: string;
  category: string;
  relatedTerms: string[];
} {
  return {
    term: entry.term,
    translation: entry.translations[language] ?? entry.translations.en ?? entry.term,
    explanation: entry.explanation[language] ?? entry.explanation.en ?? '',
    category: entry.category,
    relatedTerms: entry.relatedTerms ?? [],
  };
}
