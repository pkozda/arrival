import type { PublicModuleContract, UiSnapshot, UserProfileViewV1 } from '@/lib/product-contract';

export type ProfileDomainId =
  | 'locationHousing'
  | 'household'
  | 'employment'
  | 'insurance'
  | 'benefits'
  | 'language';

export type DomainStatus = 'complete' | 'needs_attention' | 'not_added';

export type ProfileDomainState = {
  id: ProfileDomainId;
  label: string;
  status: DomainStatus;
};

export type SituationSummary = {
  headlineLines: string[];
  domains: ProfileDomainState[];
  completeCount: number;
  needsAttentionCount: number;
  notAddedCount: number;
  isEmpty: boolean;
};

export type OnboardingStepId =
  | 'language'
  | 'firstTool'
  | 'location'
  | 'insurance'
  | 'reviewSituation';

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  complete: boolean;
};

export type ModuleSuggestion = {
  module: PublicModuleContract;
  reason: string;
  href?: string;
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  employed: 'Employed',
  'self-employed': 'Self-employed',
  unemployed: 'Unemployed',
  'part-time': 'Part-time',
  student: 'Student',
};

const DOMAIN_LABELS: Record<ProfileDomainId, string> = {
  locationHousing: 'Location & housing',
  household: 'Household & family',
  employment: 'Work & income',
  insurance: 'Health insurance',
  benefits: 'Benefits & support',
  language: 'Language & display',
};

const MODULE_SUGGESTION_REASONS: Record<string, string> = {
  'financial-reality': 'Understand take-home pay and compare job options',
  'healthcare-navigation': 'Explore health insurance options in Germany',
  'benefits-simulator': 'Estimate income-based support if your situation changes',
  'system-translation': 'Learn key German terms for everyday admin tasks',
  'life-event': 'Plan next steps when something in your life changes',
  'grocery-optimization': 'Find practical ways to manage everyday costs',
};

export const ONBOARDING_DISMISS_STORAGE_KEY = 'arrival-atlas-onboarding-dismissed';

function domainsOf(profile: UserProfileViewV1 | null | undefined) {
  return profile?.domains ?? {};
}

export function hasEmploymentData(profile: UserProfileViewV1 | null | undefined): boolean {
  const status = domainsOf(profile).employment?.employmentStatus;
  return status !== undefined && status !== null;
}

export function hasInsuranceData(profile: UserProfileViewV1 | null | undefined): boolean {
  const insurance = domainsOf(profile).healthInsurance;
  if (!insurance) {
    return false;
  }
  return insurance.insuranceType !== undefined || insurance.hasCoverage === true;
}

export function hasBenefitsData(profile: UserProfileViewV1 | null | undefined): boolean {
  const benefits = domainsOf(profile).benefits;
  if (!benefits) {
    return false;
  }
  return (
    benefits.receivingBuergergeld !== undefined ||
    benefits.receivingAlg1 !== undefined ||
    benefits.receivingWohngeld !== undefined ||
    benefits.daysInGermany !== undefined
  );
}

export function hasLocationData(profile: UserProfileViewV1 | null | undefined): boolean {
  const housing = domainsOf(profile).housing;
  return Boolean(housing?.city || housing?.bundesland || housing?.monthlyColdRent);
}

export function hasHouseholdData(profile: UserProfileViewV1 | null | undefined): boolean {
  const size = domainsOf(profile).household?.householdSize;
  return size !== undefined && size !== null;
}

function evaluateDomainStatus(
  id: ProfileDomainId,
  profile: UserProfileViewV1 | null | undefined,
  sessionLanguage?: string
): DomainStatus {
  const domains = domainsOf(profile);

  switch (id) {
    case 'locationHousing': {
      const housing = domains.housing;
      const hasCity = Boolean(housing?.city);
      const hasRegion = Boolean(housing?.bundesland);
      const hasRent = housing?.monthlyColdRent !== undefined;
      if (hasCity && (hasRegion || hasRent)) {
        return 'complete';
      }
      if (hasCity || hasRegion || hasRent) {
        return 'needs_attention';
      }
      return 'not_added';
    }
    case 'household':
      return hasHouseholdData(profile) ? 'complete' : 'not_added';
    case 'employment':
      return hasEmploymentData(profile) || domains.income?.grossMonthlyIncome !== undefined
        ? 'complete'
        : 'not_added';
    case 'insurance': {
      const insurance = domains.healthInsurance;
      if (!insurance) {
        return 'not_added';
      }
      if (insurance.insuranceType !== undefined || insurance.hasCoverage === true) {
        return 'complete';
      }
      if (insurance.hasCoverage === false) {
        return 'needs_attention';
      }
      return 'not_added';
    }
    case 'benefits':
      return hasBenefitsData(profile) ? 'complete' : 'not_added';
    case 'language':
      return profile?.preferences.preferredLanguage || sessionLanguage ? 'complete' : 'not_added';
    default:
      return 'not_added';
  }
}

export function analyzeProfileDomains(
  profile: UserProfileViewV1 | null | undefined,
  sessionLanguage?: string
): ProfileDomainState[] {
  const ids: ProfileDomainId[] = [
    'locationHousing',
    'household',
    'employment',
    'insurance',
    'benefits',
    'language',
  ];

  return ids.map((id) => ({
    id,
    label: DOMAIN_LABELS[id],
    status: evaluateDomainStatus(id, profile, sessionLanguage),
  }));
}

export function buildSituationSummary(
  profile: UserProfileViewV1 | null | undefined,
  sessionLanguage?: string
): SituationSummary {
  const domains = analyzeProfileDomains(profile, sessionLanguage);
  const completeCount = domains.filter((domain) => domain.status === 'complete').length;
  const needsAttentionCount = domains.filter((domain) => domain.status === 'needs_attention').length;
  const notAddedCount = domains.filter((domain) => domain.status === 'not_added').length;

  const headlineLines: string[] = [];
  const domainViews = domainsOf(profile);
  const housing = domainViews.housing;
  const employment = domainViews.employment;
  const household = domainViews.household;

  if (typeof housing?.city === 'string' && housing.city.trim()) {
    headlineLines.push(housing.city.trim());
  } else if (typeof housing?.bundesland === 'string' && housing.bundesland.trim()) {
    headlineLines.push(housing.bundesland.trim());
  }

  if (typeof employment?.employmentStatus === 'string') {
    headlineLines.push(
      EMPLOYMENT_LABELS[employment.employmentStatus] ?? 'Work details saved'
    );
  }

  if (typeof household?.householdSize === 'number' && household.householdSize > 0) {
    headlineLines.push(`Household of ${household.householdSize}`);
  }

  const hasSituationData =
    hasLocationData(profile) ||
    hasEmploymentData(profile) ||
    hasHouseholdData(profile) ||
    hasInsuranceData(profile) ||
    hasBenefitsData(profile);

  return {
    headlineLines,
    domains,
    completeCount,
    needsAttentionCount,
    notAddedCount,
    isEmpty: !hasSituationData,
  };
}

export function countExecutions(snapshot: UiSnapshot): number {
  return Object.values(snapshot.executionsByModuleId).reduce(
    (total, entries) => total + entries.length,
    0
  );
}

export function hasExecutedModule(snapshot: UiSnapshot, moduleId: string): boolean {
  return (snapshot.executionsByModuleId[moduleId]?.length ?? 0) > 0;
}

export function deriveOnboardingSteps(
  snapshot: UiSnapshot,
  profile: UserProfileViewV1 | null | undefined
): OnboardingStep[] {
  const executionCount = countExecutions(snapshot);
  const domains = analyzeProfileDomains(profile, snapshot.session.language);
  const completeDomains = domains.filter((domain) => domain.status === 'complete').length;

  return [
    {
      id: 'language',
      label: 'Choose your language',
      complete: Boolean(snapshot.session.language),
    },
    {
      id: 'firstTool',
      label: 'Try your first tool',
      complete: executionCount > 0,
    },
    {
      id: 'location',
      label: 'Add where you live',
      complete: hasLocationData(profile),
    },
    {
      id: 'insurance',
      label: 'Explore insurance guidance',
      complete: hasInsuranceData(profile) || hasExecutedModule(snapshot, 'healthcare-navigation'),
    },
    {
      id: 'reviewSituation',
      label: 'Review your situation',
      complete: completeDomains >= 2 || (!snapshot.ftu.isFirstTimeUser && executionCount > 0),
    },
  ];
}

export function shouldShowOnboardingChecklist(
  snapshot: UiSnapshot,
  profile: UserProfileViewV1 | null | undefined,
  dismissed: boolean
): boolean {
  if (dismissed) {
    return false;
  }

  const steps = deriveOnboardingSteps(snapshot, profile);
  const allComplete = steps.every((step) => step.complete);
  return snapshot.ftu.isFirstTimeUser || !allComplete;
}

function findModule(
  modules: PublicModuleContract[],
  moduleId: string
): PublicModuleContract | undefined {
  return modules.find((module) => module.id === moduleId);
}

function reasonForModule(moduleId: string, fallbackDescription?: string): string {
  return (
    MODULE_SUGGESTION_REASONS[moduleId] ??
    fallbackDescription ??
    'Recommended based on what is missing from your situation'
  );
}

export function suggestModules(
  snapshot: UiSnapshot,
  modules: PublicModuleContract[],
  profile: UserProfileViewV1 | null | undefined
): ModuleSuggestion[] {
  const suggestions: ModuleSuggestion[] = [];
  const seen = new Set<string>();

  function push(moduleId: string) {
    if (seen.has(moduleId) || suggestions.length >= 3) {
      return;
    }
    const module = findModule(modules, moduleId);
    if (!module) {
      return;
    }
    seen.add(moduleId);
    suggestions.push({
      module,
      reason: reasonForModule(moduleId, module.description),
    });
  }

  if (!hasEmploymentData(profile)) {
    push('financial-reality');
  }

  if (!hasInsuranceData(profile) && !hasExecutedModule(snapshot, 'healthcare-navigation')) {
    push('healthcare-navigation');
  }

  if (
    (hasEmploymentData(profile) || hasExecutedModule(snapshot, 'financial-reality')) &&
    !hasBenefitsData(profile)
  ) {
    push('benefits-simulator');
  }

  if (!hasLocationData(profile)) {
    push('financial-reality');
  }

  const fallbackOrder = [
    'financial-reality',
    'healthcare-navigation',
    'system-translation',
    'life-event',
    'grocery-optimization',
    'benefits-simulator',
  ];

  const hasFinanceContext =
    hasEmploymentData(profile) || hasExecutedModule(snapshot, 'financial-reality');

  for (const moduleId of fallbackOrder) {
    if (moduleId === 'benefits-simulator' && !hasFinanceContext) {
      continue;
    }
    push(moduleId);
  }

  return suggestions.slice(0, 3);
}

export function profilePrefillApplied(
  schemaDefaults: Record<string, unknown>,
  mergedDefaults: Record<string, unknown>
): boolean {
  return JSON.stringify(schemaDefaults) !== JSON.stringify(mergedDefaults);
}

export function formatExecutionDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
