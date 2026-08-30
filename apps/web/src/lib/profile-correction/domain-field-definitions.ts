import type { ProfileDomain, SupportedLanguage, ThemePreference } from '@/lib/product-contract';
import type { ProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';

export type DomainEditFieldType = 'text' | 'number' | 'select' | 'boolean';

export type DomainEditFieldOption = {
  value: string;
  /** Translation key — never a display string */
  labelKey: string;
};

export type DomainEditFieldDefinition = {
  /** Internal form key — never shown in UI */
  formKey: string;
  /** Translation key for the visible field label */
  labelKey: string;
  type: DomainEditFieldType;
  options?: DomainEditFieldOption[];
  contractDomain: ProfileDomain;
  placeholderKey?: string;
  min?: number;
  max?: number;
};

export type DomainEditSection = {
  slug: ProfileMirrorDomainSlug;
  titleKey: string;
  summaryKey: string;
  fields: DomainEditFieldDefinition[];
};

const RESIDENCY_OPTIONS: DomainEditFieldOption[] = [
  { value: 'eu-citizen', labelKey: 'profile.options.residencyStatus.eu-citizen' },
  { value: 'permanent-resident', labelKey: 'profile.options.residencyStatus.permanent-resident' },
  { value: 'temporary-resident', labelKey: 'profile.options.residencyStatus.temporary-resident' },
  { value: 'asylum-seeker', labelKey: 'profile.options.residencyStatus.asylum-seeker' },
  { value: 'student-visa', labelKey: 'profile.options.residencyStatus.student-visa' },
  { value: 'work-visa', labelKey: 'profile.options.residencyStatus.work-visa' },
  { value: 'tourist', labelKey: 'profile.options.residencyStatus.tourist' },
  { value: 'unknown', labelKey: 'profile.options.residencyStatus.unknown' },
];

const EMPLOYMENT_OPTIONS: DomainEditFieldOption[] = [
  { value: 'employed', labelKey: 'profile.options.employmentStatus.employed' },
  { value: 'self-employed', labelKey: 'profile.options.employmentStatus.self-employed' },
  { value: 'unemployed', labelKey: 'profile.options.employmentStatus.unemployed' },
  { value: 'part-time', labelKey: 'profile.options.employmentStatus.part-time' },
  { value: 'student', labelKey: 'profile.options.employmentStatus.student' },
];

const MARITAL_OPTIONS: DomainEditFieldOption[] = [
  { value: 'single', labelKey: 'profile.options.maritalStatus.single' },
  { value: 'married', labelKey: 'profile.options.maritalStatus.married' },
  { value: 'divorced', labelKey: 'profile.options.maritalStatus.divorced' },
  { value: 'widowed', labelKey: 'profile.options.maritalStatus.widowed' },
];

const INSURANCE_OPTIONS: DomainEditFieldOption[] = [
  { value: 'public', labelKey: 'profile.options.insuranceType.public' },
  { value: 'private', labelKey: 'profile.options.insuranceType.private' },
  { value: 'none', labelKey: 'profile.options.insuranceType.none' },
];

const TAX_CLASS_OPTIONS: DomainEditFieldOption[] = [1, 2, 3, 4, 5, 6].map((value) => ({
  value: String(value),
  labelKey: `profile.options.taxClass.${value}`,
}));

const LANGUAGE_OPTIONS: DomainEditFieldOption[] = [
  { value: 'en', labelKey: 'profile.options.preferredLanguage.en' },
  { value: 'de', labelKey: 'profile.options.preferredLanguage.de' },
  { value: 'ru', labelKey: 'profile.options.preferredLanguage.ru' },
  { value: 'ua', labelKey: 'profile.options.preferredLanguage.ua' },
];

const THEME_OPTIONS: DomainEditFieldOption[] = [
  { value: 'light', labelKey: 'profile.options.theme.light' },
  { value: 'dark', labelKey: 'profile.options.theme.dark' },
  { value: 'system', labelKey: 'profile.options.theme.system' },
];

export const DOMAIN_EDIT_SECTIONS: Record<ProfileMirrorDomainSlug, DomainEditSection> = {
  'move-to-germany': {
    slug: 'move-to-germany',
    titleKey: 'profile.sections.move-to-germany.title',
    summaryKey: 'profile.sections.move-to-germany.summary',
    fields: [
      {
        formKey: 'countryOfOrigin',
        labelKey: 'profile.fields.countryOfOrigin',
        type: 'text',
        contractDomain: 'migration',
        placeholderKey: 'profile.placeholders.countryOfOrigin',
      },
      {
        formKey: 'residencyStatus',
        labelKey: 'profile.fields.residencyStatus',
        type: 'select',
        contractDomain: 'migration',
        options: RESIDENCY_OPTIONS,
      },
      {
        formKey: 'arrivedAt',
        labelKey: 'profile.fields.arrivedAt',
        type: 'text',
        contractDomain: 'migration',
        placeholderKey: 'profile.placeholders.arrivedAt',
      },
    ],
  },
  'where-you-live': {
    slug: 'where-you-live',
    titleKey: 'profile.sections.where-you-live.title',
    summaryKey: 'profile.sections.where-you-live.summary',
    fields: [
      {
        formKey: 'city',
        labelKey: 'profile.fields.city',
        type: 'text',
        contractDomain: 'housing',
      },
      {
        formKey: 'bundesland',
        labelKey: 'profile.fields.bundesland',
        type: 'text',
        contractDomain: 'housing',
        placeholderKey: 'profile.placeholders.bundesland',
      },
      {
        formKey: 'monthlyColdRent',
        labelKey: 'profile.fields.monthlyColdRent',
        type: 'number',
        contractDomain: 'housing',
        min: 0,
      },
      {
        formKey: 'monthlyUtilities',
        labelKey: 'profile.fields.monthlyUtilities',
        type: 'number',
        contractDomain: 'housing',
        min: 0,
      },
    ],
  },
  'household-family': {
    slug: 'household-family',
    titleKey: 'profile.sections.household-family.title',
    summaryKey: 'profile.sections.household-family.summary',
    fields: [
      {
        formKey: 'householdSize',
        labelKey: 'profile.fields.householdSize',
        type: 'number',
        contractDomain: 'household',
        min: 1,
        max: 20,
      },
      {
        formKey: 'maritalStatus',
        labelKey: 'profile.fields.maritalStatus',
        type: 'select',
        contractDomain: 'household',
        options: MARITAL_OPTIONS,
      },
    ],
  },
  'work-income': {
    slug: 'work-income',
    titleKey: 'profile.sections.work-income.title',
    summaryKey: 'profile.sections.work-income.summary',
    fields: [
      {
        formKey: 'employmentStatus',
        labelKey: 'profile.fields.employmentStatus',
        type: 'select',
        contractDomain: 'employment',
        options: EMPLOYMENT_OPTIONS,
      },
      {
        formKey: 'grossMonthlyIncome',
        labelKey: 'profile.fields.grossMonthlyIncome',
        type: 'number',
        contractDomain: 'income',
        min: 0,
      },
      {
        formKey: 'taxClass',
        labelKey: 'profile.fields.taxClass',
        type: 'select',
        contractDomain: 'employment',
        options: TAX_CLASS_OPTIONS,
      },
      {
        formKey: 'churchTax',
        labelKey: 'profile.fields.churchTax',
        type: 'boolean',
        contractDomain: 'employment',
      },
    ],
  },
  'health-insurance': {
    slug: 'health-insurance',
    titleKey: 'profile.sections.health-insurance.title',
    summaryKey: 'profile.sections.health-insurance.summary',
    fields: [
      {
        formKey: 'insuranceType',
        labelKey: 'profile.fields.insuranceType',
        type: 'select',
        contractDomain: 'healthInsurance',
        options: INSURANCE_OPTIONS,
      },
      {
        formKey: 'hasCoverage',
        labelKey: 'profile.fields.hasCoverage',
        type: 'boolean',
        contractDomain: 'healthInsurance',
      },
    ],
  },
  'benefits-support': {
    slug: 'benefits-support',
    titleKey: 'profile.sections.benefits-support.title',
    summaryKey: 'profile.sections.benefits-support.summary',
    fields: [
      {
        formKey: 'receivingBuergergeld',
        labelKey: 'profile.fields.receivingBuergergeld',
        type: 'boolean',
        contractDomain: 'benefits',
      },
      {
        formKey: 'receivingAlg1',
        labelKey: 'profile.fields.receivingAlg1',
        type: 'boolean',
        contractDomain: 'benefits',
      },
      {
        formKey: 'receivingWohngeld',
        labelKey: 'profile.fields.receivingWohngeld',
        type: 'boolean',
        contractDomain: 'benefits',
      },
      {
        formKey: 'daysInGermany',
        labelKey: 'profile.fields.daysInGermany',
        type: 'number',
        contractDomain: 'benefits',
        min: 0,
      },
    ],
  },
  'language-display': {
    slug: 'language-display',
    titleKey: 'profile.sections.language-display.title',
    summaryKey: 'profile.sections.language-display.summary',
    fields: [
      {
        formKey: 'preferredLanguage',
        labelKey: 'profile.fields.preferredLanguage',
        type: 'select',
        contractDomain: 'preferences',
        options: LANGUAGE_OPTIONS,
      },
      {
        formKey: 'theme',
        labelKey: 'profile.fields.theme',
        type: 'select',
        contractDomain: 'preferences',
        options: THEME_OPTIONS,
      },
    ],
  },
};

export function getDomainEditSection(slug: ProfileMirrorDomainSlug): DomainEditSection {
  return DOMAIN_EDIT_SECTIONS[slug];
}

export type DomainDraftValues = Record<string, string | boolean | number | undefined>;

export function readDraftValueFromProfile(
  formKey: string,
  contractDomain: ProfileDomain,
  profile: {
    domains: Record<string, Record<string, unknown> | undefined>;
    preferences: Record<string, unknown>;
  } | null | undefined
): string | boolean | number | undefined {
  if (!profile) {
    return undefined;
  }

  if (contractDomain === 'preferences') {
    const value = profile.preferences[formKey];
    if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
      return value;
    }
    return undefined;
  }

  const domainSlice = profile.domains[contractDomain];
  if (!domainSlice) {
    return undefined;
  }

  const value = domainSlice[formKey];
  if (formKey === 'arrivedAt' && typeof value === 'string') {
    return value.slice(0, 7);
  }
  if (formKey === 'taxClass' && typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  return undefined;
}

export function buildInitialDraft(
  section: DomainEditSection,
  profile: Parameters<typeof readDraftValueFromProfile>[2]
): DomainDraftValues {
  const draft: DomainDraftValues = {};

  for (const field of section.fields) {
    const current = readDraftValueFromProfile(field.formKey, field.contractDomain, profile);
    if (current !== undefined) {
      draft[field.formKey] = current;
    } else if (field.type === 'boolean') {
      draft[field.formKey] = false;
    } else {
      draft[field.formKey] = '';
    }
  }

  return draft;
}

export function normalizeDraftFieldValue(
  field: DomainEditFieldDefinition,
  raw: string | boolean | number | undefined
): string | boolean | number | undefined {
  if (field.type === 'boolean') {
    return Boolean(raw);
  }

  if (field.type === 'number') {
    if (raw === '' || raw === undefined) {
      return undefined;
    }
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (typeof raw !== 'string') {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  if (field.formKey === 'countryOfOrigin' || field.formKey === 'bundesland') {
    return trimmed.toUpperCase();
  }

  if (field.formKey === 'arrivedAt') {
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      return `${trimmed}-01T00:00:00.000Z`;
    }
    return trimmed;
  }

  if (field.formKey === 'taxClass') {
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 6 ? parsed : undefined;
  }

  return trimmed;
}

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return value === 'en' || value === 'de' || value === 'ru' || value === 'ua';
}

export function isThemePreference(value: string): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}
