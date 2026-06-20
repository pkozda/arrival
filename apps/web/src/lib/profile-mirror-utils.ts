import type { PublicModuleContract, UiSnapshot, UserProfileViewV1 } from '@/lib/product-contract';
import type { DomainStatus } from '@/lib/situation-utils';
import { buildSituationSummary } from '@/lib/situation-utils';

export type ProfileMirrorDomainSlug =
  | 'move-to-germany'
  | 'where-you-live'
  | 'household-family'
  | 'work-income'
  | 'health-insurance'
  | 'benefits-support'
  | 'language-display';

export type ProfileFieldRow = {
  label: string;
  value: string;
};

export type ProfileMirrorDomain = {
  slug: ProfileMirrorDomainSlug;
  title: string;
  status: DomainStatus;
  previewLines: string[];
  fields: ProfileFieldRow[];
  provenanceModuleTitle?: string;
  emptyExplanation: string;
  whyItMatters: string;
  ctaModuleId?: string;
};

const RESIDENCY_LABELS: Record<string, string> = {
  'eu-citizen': 'EU citizen',
  'permanent-resident': 'Permanent resident',
  'temporary-resident': 'Temporary resident',
  'asylum-seeker': 'Asylum seeker',
  'student-visa': 'Student visa',
  'work-visa': 'Work visa',
  tourist: 'Tourist / visitor',
  unknown: 'Status not specified',
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  employed: 'Employed full-time',
  'self-employed': 'Self-employed',
  unemployed: 'Unemployed',
  'part-time': 'Part-time employed',
  student: 'Student',
};

const MARITAL_LABELS: Record<string, string> = {
  single: 'Single',
  married: 'Married',
  divorced: 'Divorced',
  widowed: 'Widowed',
};

const INSURANCE_LABELS: Record<string, string> = {
  public: 'Public health insurance (GKV)',
  private: 'Private health insurance (PKV)',
  none: 'No coverage noted',
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  de: 'German',
  ru: 'Russian',
  ua: 'Ukrainian',
};

const DOMAIN_META: Record<
  ProfileMirrorDomainSlug,
  {
    title: string;
    emptyExplanation: string;
    whyItMatters: string;
    ctaModuleId?: string;
    provenanceModuleIds: string[];
  }
> = {
  'move-to-germany': {
    title: 'Your move to Germany',
    emptyExplanation: 'No arrival or residency details yet.',
    whyItMatters:
      'Helps tools tailor guidance to your visa status and time in Germany.',
    ctaModuleId: 'financial-reality',
    provenanceModuleIds: ['financial-reality', 'life-event'],
  },
  'where-you-live': {
    title: 'Where you live',
    emptyExplanation: 'No housing or location information yet.',
    whyItMatters:
      'Helps estimate rent-based support options and regional cost differences.',
    ctaModuleId: 'financial-reality',
    provenanceModuleIds: ['financial-reality', 'benefits-simulator'],
  },
  'household-family': {
    title: 'Household & family',
    emptyExplanation: 'No household details yet.',
    whyItMatters:
      'Household size affects benefits estimates and family-related guidance.',
    ctaModuleId: 'benefits-simulator',
    provenanceModuleIds: ['financial-reality', 'benefits-simulator'],
  },
  'work-income': {
    title: 'Work & income',
    emptyExplanation: 'No employment or income details yet.',
    whyItMatters:
      'Helps Financial Reality and Benefits Simulator give accurate results.',
    ctaModuleId: 'financial-reality',
    provenanceModuleIds: ['financial-reality'],
  },
  'health-insurance': {
    title: 'Health insurance',
    emptyExplanation: 'No health insurance information yet.',
    whyItMatters:
      'Guides you through Krankenkasse options and mandatory coverage rules.',
    ctaModuleId: 'healthcare-navigation',
    provenanceModuleIds: ['healthcare-navigation'],
  },
  'benefits-support': {
    title: 'Benefits & support',
    emptyExplanation: 'No benefits information yet.',
    whyItMatters:
      'Helps estimate Bürgergeld, ALG, and housing support scenarios.',
    ctaModuleId: 'benefits-simulator',
    provenanceModuleIds: ['benefits-simulator', 'financial-reality'],
  },
  'language-display': {
    title: 'Language & display',
    emptyExplanation: 'Language preference not noted yet.',
    whyItMatters: 'Ensures guidance appears in the language you read most comfortably.',
    provenanceModuleIds: [],
  },
};

const DOMAIN_ORDER: ProfileMirrorDomainSlug[] = [
  'move-to-germany',
  'where-you-live',
  'household-family',
  'work-income',
  'health-insurance',
  'benefits-support',
  'language-display',
];

function formatCurrency(amount: unknown): string | undefined {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return undefined;
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatBoolean(value: unknown, yesLabel: string, noLabel: string): string | undefined {
  if (value === true) {
    return yesLabel;
  }
  if (value === false) {
    return noLabel;
  }
  return undefined;
}

function findModuleTitle(
  modules: PublicModuleContract[],
  moduleId: string
): string | undefined {
  return modules.find((module) => module.id === moduleId)?.title;
}

function resolveProvenance(
  snapshot: UiSnapshot,
  moduleIds: string[],
  modules: PublicModuleContract[]
): string | undefined {
  let latestModuleId: string | undefined;
  let latestTimestamp = -1;

  for (const moduleId of moduleIds) {
    const entries = snapshot.executionsByModuleId[moduleId];
    if (!entries?.length) {
      continue;
    }

    for (const entry of entries) {
      const timestamp = Date.parse(entry.createdAt);
      if (!Number.isNaN(timestamp) && timestamp >= latestTimestamp) {
        latestTimestamp = timestamp;
        latestModuleId = moduleId;
      }
    }
  }

  if (!latestModuleId) {
    return undefined;
  }

  return findModuleTitle(modules, latestModuleId);
}

function buildMoveToGermanyDomain(
  profile: UserProfileViewV1 | null | undefined
): Pick<ProfileMirrorDomain, 'status' | 'previewLines' | 'fields'> {
  const migration = profile?.domains.migration;
  const country =
    typeof migration?.countryOfOrigin === 'string'
      ? migration.countryOfOrigin.toUpperCase()
      : undefined;
  const status =
    typeof migration?.residencyStatus === 'string'
      ? RESIDENCY_LABELS[migration.residencyStatus] ?? 'Residency details saved'
      : undefined;
  const arrivedAt =
    typeof migration?.arrivedAt === 'string'
      ? new Date(migration.arrivedAt).toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })
      : undefined;

  const fields: ProfileFieldRow[] = [];
  if (country) {
    fields.push({ label: 'Country of origin', value: country });
  }
  if (status) {
    fields.push({ label: 'Residency status', value: status });
  }
  if (arrivedAt && arrivedAt !== 'Invalid Date') {
    fields.push({ label: 'Arrived in Germany', value: arrivedAt });
  }

  const previewLines = fields.slice(0, 2).map((field) => field.value);
  const hasAny = fields.length > 0;
  const isComplete = Boolean(country && status);

  return {
    status: !hasAny ? 'not_added' : isComplete ? 'complete' : 'needs_attention',
    previewLines,
    fields,
  };
}

function buildWhereYouLiveDomain(
  profile: UserProfileViewV1 | null | undefined
): Pick<ProfileMirrorDomain, 'status' | 'previewLines' | 'fields'> {
  const housing = profile?.domains.housing;
  const fields: ProfileFieldRow[] = [];

  if (typeof housing?.city === 'string' && housing.city.trim()) {
    fields.push({ label: 'City', value: housing.city.trim() });
  }
  if (typeof housing?.bundesland === 'string' && housing.bundesland.trim()) {
    fields.push({ label: 'Federal state', value: housing.bundesland.trim() });
  }

  const rent = formatCurrency(housing?.monthlyColdRent);
  if (rent) {
    fields.push({ label: 'Monthly rent (cold)', value: rent });
  }

  const utilities = formatCurrency(housing?.monthlyUtilities);
  if (utilities) {
    fields.push({ label: 'Monthly utilities', value: utilities });
  }

  const hasCity = Boolean(housing?.city);
  const hasRegionOrRent = Boolean(housing?.bundesland || housing?.monthlyColdRent !== undefined);

  return {
    status: !fields.length
      ? 'not_added'
      : hasCity && hasRegionOrRent
        ? 'complete'
        : 'needs_attention',
    previewLines: fields.slice(0, 2).map((field) => field.value),
    fields,
  };
}

function buildHouseholdDomain(
  profile: UserProfileViewV1 | null | undefined
): Pick<ProfileMirrorDomain, 'status' | 'previewLines' | 'fields'> {
  const household = profile?.domains.household;
  const fields: ProfileFieldRow[] = [];

  if (typeof household?.householdSize === 'number') {
    fields.push({ label: 'Household size', value: String(household.householdSize) });
  }
  if (typeof household?.maritalStatus === 'string') {
    fields.push({
      label: 'Marital status',
      value: MARITAL_LABELS[household.maritalStatus] ?? household.maritalStatus,
    });
  }

  const children = Array.isArray(household?.children) ? household.children : [];
  if (children.length > 0) {
    fields.push({ label: 'Children in household', value: String(children.length) });
  }

  return {
    status: fields.length ? 'complete' : 'not_added',
    previewLines: fields.slice(0, 2).map((field) => field.value),
    fields,
  };
}

function buildWorkIncomeDomain(
  profile: UserProfileViewV1 | null | undefined
): Pick<ProfileMirrorDomain, 'status' | 'previewLines' | 'fields'> {
  const employment = profile?.domains.employment;
  const income = profile?.domains.income;
  const fields: ProfileFieldRow[] = [];

  if (typeof employment?.employmentStatus === 'string') {
    fields.push({
      label: 'Employment',
      value: EMPLOYMENT_LABELS[employment.employmentStatus] ?? employment.employmentStatus,
    });
  }

  const grossIncome = formatCurrency(income?.grossMonthlyIncome);
  if (grossIncome) {
    fields.push({ label: 'Gross monthly income', value: grossIncome });
  }

  if (typeof employment?.taxClass === 'number') {
    fields.push({ label: 'Tax class', value: String(employment.taxClass) });
  }

  const churchTax = formatBoolean(employment?.churchTax, 'Yes', 'No');
  if (churchTax) {
    fields.push({ label: 'Church tax', value: churchTax });
  }

  return {
    status: employment?.employmentStatus ? 'complete' : fields.length ? 'needs_attention' : 'not_added',
    previewLines: fields.slice(0, 2).map((field) => field.value),
    fields,
  };
}

function buildInsuranceDomain(
  profile: UserProfileViewV1 | null | undefined
): Pick<ProfileMirrorDomain, 'status' | 'previewLines' | 'fields'> {
  const insurance = profile?.domains.healthInsurance;
  const fields: ProfileFieldRow[] = [];

  if (typeof insurance?.insuranceType === 'string') {
    fields.push({
      label: 'Coverage type',
      value: INSURANCE_LABELS[insurance.insuranceType] ?? insurance.insuranceType,
    });
  }

  const coverage = formatBoolean(insurance?.hasCoverage, 'Enrolled', 'Not enrolled');
  if (coverage) {
    fields.push({ label: 'Coverage status', value: coverage });
  }

  let status: DomainStatus = 'not_added';
  if (insurance?.insuranceType || insurance?.hasCoverage === true) {
    status = 'complete';
  } else if (insurance?.hasCoverage === false) {
    status = 'needs_attention';
  }

  return {
    status,
    previewLines: fields.map((field) => field.value).slice(0, 2),
    fields,
  };
}

function buildBenefitsDomain(
  profile: UserProfileViewV1 | null | undefined
): Pick<ProfileMirrorDomain, 'status' | 'previewLines' | 'fields'> {
  const benefits = profile?.domains.benefits;
  const fields: ProfileFieldRow[] = [];

  const buergergeld = formatBoolean(
    benefits?.receivingBuergergeld,
    'Receiving Bürgergeld',
    'Not receiving Bürgergeld'
  );
  if (buergergeld) {
    fields.push({ label: 'Bürgergeld', value: buergergeld });
  }

  const alg1 = formatBoolean(benefits?.receivingAlg1, 'Receiving ALG I', 'Not receiving ALG I');
  if (alg1) {
    fields.push({ label: 'ALG I', value: alg1 });
  }

  const wohngeld = formatBoolean(
    benefits?.receivingWohngeld,
    'Receiving Wohngeld',
    'Not receiving Wohngeld'
  );
  if (wohngeld) {
    fields.push({ label: 'Wohngeld', value: wohngeld });
  }

  if (typeof benefits?.daysInGermany === 'number') {
    fields.push({ label: 'Days in Germany', value: String(benefits.daysInGermany) });
  }

  return {
    status: fields.length ? 'complete' : 'not_added',
    previewLines: fields.slice(0, 2).map((field) => field.value),
    fields,
  };
}

function buildLanguageDomain(
  profile: UserProfileViewV1 | null | undefined,
  sessionLanguage?: string,
  sessionTheme?: string
): Pick<ProfileMirrorDomain, 'status' | 'previewLines' | 'fields'> {
  const languageCode = profile?.preferences.preferredLanguage || sessionLanguage;
  const fields: ProfileFieldRow[] = [];

  if (languageCode) {
    fields.push({
      label: 'Preferred language',
      value: LANGUAGE_LABELS[languageCode] ?? languageCode.toUpperCase(),
    });
  }

  const theme = profile?.preferences.theme ?? sessionTheme;
  if (typeof theme === 'string') {
    fields.push({
      label: 'Display theme',
      value: theme === 'system' ? 'Match system' : theme.charAt(0).toUpperCase() + theme.slice(1),
    });
  }

  return {
    status: languageCode ? 'complete' : 'not_added',
    previewLines: fields.map((field) => field.value).slice(0, 2),
    fields,
  };
}

function buildDomainContent(
  slug: ProfileMirrorDomainSlug,
  profile: UserProfileViewV1 | null | undefined,
  sessionLanguage?: string,
  sessionTheme?: string
): Pick<ProfileMirrorDomain, 'status' | 'previewLines' | 'fields'> {
  switch (slug) {
    case 'move-to-germany':
      return buildMoveToGermanyDomain(profile);
    case 'where-you-live':
      return buildWhereYouLiveDomain(profile);
    case 'household-family':
      return buildHouseholdDomain(profile);
    case 'work-income':
      return buildWorkIncomeDomain(profile);
    case 'health-insurance':
      return buildInsuranceDomain(profile);
    case 'benefits-support':
      return buildBenefitsDomain(profile);
    case 'language-display':
      return buildLanguageDomain(profile, sessionLanguage, sessionTheme);
    default:
      return { status: 'not_added', previewLines: [], fields: [] };
  }
}

export function buildProfileMirrorDomains(
  snapshot: UiSnapshot,
  modules: PublicModuleContract[],
  profile: UserProfileViewV1 | null | undefined
): ProfileMirrorDomain[] {
  const { session } = snapshot;

  return DOMAIN_ORDER.map((slug) => {
    const meta = DOMAIN_META[slug];
    const content = buildDomainContent(
      slug,
      profile,
      session.language,
      session.uiPreferences.theme
    );
    const provenanceModuleTitle =
      content.fields.length > 0
        ? resolveProvenance(snapshot, meta.provenanceModuleIds, modules)
        : undefined;

    return {
      slug,
      title: meta.title,
      ...content,
      provenanceModuleTitle,
      emptyExplanation: meta.emptyExplanation,
      whyItMatters: meta.whyItMatters,
      ctaModuleId: meta.ctaModuleId,
    };
  });
}

export function findProfileMirrorDomain(
  snapshot: UiSnapshot,
  modules: PublicModuleContract[],
  slug: string,
  profile: UserProfileViewV1 | null | undefined
): ProfileMirrorDomain | undefined {
  return buildProfileMirrorDomains(snapshot, modules, profile).find((domain) => domain.slug === slug);
}

export function isProfileMirrorDomainSlug(slug: string): slug is ProfileMirrorDomainSlug {
  return DOMAIN_ORDER.includes(slug as ProfileMirrorDomainSlug);
}

export function buildProfileMirrorHeadline(
  profile: UserProfileViewV1 | null | undefined,
  sessionLanguage?: string
): string {
  const summary = buildSituationSummary(profile, sessionLanguage);
  if (summary.isEmpty || summary.headlineLines.length === 0) {
    return 'Nothing saved yet. Use tools to build your situation.';
  }
  return summary.headlineLines.join(' · ');
}

export function formatDomainStatus(status: DomainStatus): string {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'needs_attention':
      return 'Needs attention';
    case 'not_added':
      return 'Not added yet';
    default:
      return status;
  }
}

export function resolveDomainCtaTitle(
  domain: ProfileMirrorDomain,
  modules: PublicModuleContract[]
): string | undefined {
  if (!domain.ctaModuleId) {
    return undefined;
  }
  return findModuleTitle(modules, domain.ctaModuleId);
}
