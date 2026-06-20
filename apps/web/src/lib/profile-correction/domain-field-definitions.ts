import type { ProfileDomain, SupportedLanguage, ThemePreference } from '@/lib/product-contract';
import type { ProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';

export type DomainEditFieldType = 'text' | 'number' | 'select' | 'boolean';

export type DomainEditFieldOption = {
  value: string;
  label: string;
};

export type DomainEditFieldDefinition = {
  /** Internal form key — never shown in UI */
  formKey: string;
  label: string;
  type: DomainEditFieldType;
  options?: DomainEditFieldOption[];
  contractDomain: ProfileDomain;
  placeholder?: string;
  min?: number;
  max?: number;
};

export type DomainEditSection = {
  slug: ProfileMirrorDomainSlug;
  title: string;
  summary: string;
  fields: DomainEditFieldDefinition[];
};

const RESIDENCY_OPTIONS: DomainEditFieldOption[] = [
  { value: 'eu-citizen', label: 'EU citizen' },
  { value: 'permanent-resident', label: 'Permanent resident' },
  { value: 'temporary-resident', label: 'Temporary resident' },
  { value: 'asylum-seeker', label: 'Asylum seeker' },
  { value: 'student-visa', label: 'Student visa' },
  { value: 'work-visa', label: 'Work visa' },
  { value: 'tourist', label: 'Tourist / visitor' },
  { value: 'unknown', label: 'Status not specified' },
];

const EMPLOYMENT_OPTIONS: DomainEditFieldOption[] = [
  { value: 'employed', label: 'Employed full-time' },
  { value: 'self-employed', label: 'Self-employed' },
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'part-time', label: 'Part-time employed' },
  { value: 'student', label: 'Student' },
];

const MARITAL_OPTIONS: DomainEditFieldOption[] = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
];

const INSURANCE_OPTIONS: DomainEditFieldOption[] = [
  { value: 'public', label: 'Public health insurance (GKV)' },
  { value: 'private', label: 'Private health insurance (PKV)' },
  { value: 'none', label: 'No coverage noted' },
];

const TAX_CLASS_OPTIONS: DomainEditFieldOption[] = [1, 2, 3, 4, 5, 6].map((value) => ({
  value: String(value),
  label: `Tax class ${value}`,
}));

const LANGUAGE_OPTIONS: DomainEditFieldOption[] = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'German' },
  { value: 'ru', label: 'Russian' },
  { value: 'ua', label: 'Ukrainian' },
];

const THEME_OPTIONS: DomainEditFieldOption[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match system' },
];

export const DOMAIN_EDIT_SECTIONS: Record<ProfileMirrorDomainSlug, DomainEditSection> = {
  'move-to-germany': {
    slug: 'move-to-germany',
    title: 'Your move to Germany',
    summary: 'Update arrival and residency details.',
    fields: [
      {
        formKey: 'countryOfOrigin',
        label: 'Country of origin',
        type: 'text',
        contractDomain: 'migration',
        placeholder: 'e.g. UA',
      },
      {
        formKey: 'residencyStatus',
        label: 'Residency status',
        type: 'select',
        contractDomain: 'migration',
        options: RESIDENCY_OPTIONS,
      },
      {
        formKey: 'arrivedAt',
        label: 'When did you arrive in Germany?',
        type: 'text',
        contractDomain: 'migration',
        placeholder: 'YYYY-MM (e.g. 2024-03)',
      },
    ],
  },
  'where-you-live': {
    slug: 'where-you-live',
    title: 'Where you live',
    summary: 'Update housing and location details.',
    fields: [
      {
        formKey: 'city',
        label: 'City',
        type: 'text',
        contractDomain: 'housing',
      },
      {
        formKey: 'bundesland',
        label: 'Federal state (code)',
        type: 'text',
        contractDomain: 'housing',
        placeholder: 'e.g. BE',
      },
      {
        formKey: 'monthlyColdRent',
        label: 'Monthly rent (cold)',
        type: 'number',
        contractDomain: 'housing',
        min: 0,
      },
      {
        formKey: 'monthlyUtilities',
        label: 'Monthly utilities',
        type: 'number',
        contractDomain: 'housing',
        min: 0,
      },
    ],
  },
  'household-family': {
    slug: 'household-family',
    title: 'Household & family',
    summary: 'Update household composition.',
    fields: [
      {
        formKey: 'householdSize',
        label: 'Household size',
        type: 'number',
        contractDomain: 'household',
        min: 1,
        max: 20,
      },
      {
        formKey: 'maritalStatus',
        label: 'Marital status',
        type: 'select',
        contractDomain: 'household',
        options: MARITAL_OPTIONS,
      },
    ],
  },
  'work-income': {
    slug: 'work-income',
    title: 'Work & income',
    summary: 'Update employment and income details.',
    fields: [
      {
        formKey: 'employmentStatus',
        label: 'Employment status',
        type: 'select',
        contractDomain: 'employment',
        options: EMPLOYMENT_OPTIONS,
      },
      {
        formKey: 'grossMonthlyIncome',
        label: 'Gross monthly income (EUR)',
        type: 'number',
        contractDomain: 'income',
        min: 0,
      },
      {
        formKey: 'taxClass',
        label: 'Tax class',
        type: 'select',
        contractDomain: 'employment',
        options: TAX_CLASS_OPTIONS,
      },
      {
        formKey: 'churchTax',
        label: 'Pay church tax',
        type: 'boolean',
        contractDomain: 'employment',
      },
    ],
  },
  'health-insurance': {
    slug: 'health-insurance',
    title: 'Health insurance',
    summary: 'Update coverage information.',
    fields: [
      {
        formKey: 'insuranceType',
        label: 'Coverage type',
        type: 'select',
        contractDomain: 'healthInsurance',
        options: INSURANCE_OPTIONS,
      },
      {
        formKey: 'hasCoverage',
        label: 'Currently enrolled in health insurance',
        type: 'boolean',
        contractDomain: 'healthInsurance',
      },
    ],
  },
  'benefits-support': {
    slug: 'benefits-support',
    title: 'Benefits & support',
    summary: 'Update benefits information.',
    fields: [
      {
        formKey: 'receivingBuergergeld',
        label: 'Receiving Bürgergeld',
        type: 'boolean',
        contractDomain: 'benefits',
      },
      {
        formKey: 'receivingAlg1',
        label: 'Receiving ALG I',
        type: 'boolean',
        contractDomain: 'benefits',
      },
      {
        formKey: 'receivingWohngeld',
        label: 'Receiving Wohngeld',
        type: 'boolean',
        contractDomain: 'benefits',
      },
      {
        formKey: 'daysInGermany',
        label: 'Days in Germany',
        type: 'number',
        contractDomain: 'benefits',
        min: 0,
      },
    ],
  },
  'language-display': {
    slug: 'language-display',
    title: 'Language & display',
    summary: 'Update language and display preferences.',
    fields: [
      {
        formKey: 'preferredLanguage',
        label: 'Preferred language',
        type: 'select',
        contractDomain: 'preferences',
        options: LANGUAGE_OPTIONS,
      },
      {
        formKey: 'theme',
        label: 'Display theme',
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
