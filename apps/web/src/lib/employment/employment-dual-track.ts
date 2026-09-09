import type { UserContextV1 } from '@/lib/product-contract';

/** Existing Discovery Jobs entry — PD-004 hands off here without running search. */
export const EMPLOYMENT_JOB_SEARCH_HREF = '/modules/discovery' as const;

export const EMPLOYMENT_LANDING_HREF = '/modules/employment' as const;

export const WORK_INCOME_PROFILE_HREF = '/profile/work-income' as const;
export const WORK_INCOME_EDIT_HREF = '/profile/work-income/edit' as const;
export const MOVE_TO_GERMANY_EDIT_HREF = '/profile/move-to-germany/edit' as const;

export type EmploymentSituationKind = 'known' | 'not_provided';
export type WorkIncomeAccess = 'available' | 'locked';

export type EmploymentDualTrackSnapshot = {
  situationKind: EmploymentSituationKind;
  /** Raw employmentStatus when known; never invents "unemployed". */
  employmentStatus: string | null;
  hasIncomeInfo: boolean;
  workIncomeAccess: WorkIncomeAccess;
  /** Primary CTA for the Work & Income track. */
  workIncomeHref: string;
  unlockHref: string | null;
  jobSearchHref: typeof EMPLOYMENT_JOB_SEARCH_HREF;
  /** Employment state never implies job-search intent in this slice. */
  impliesJobSearchIntent: false;
  /** This slice never claims Discovery has run or has results. */
  claimsDiscoveryRun: false;
  claimsDiscoveryResults: false;
};

function isMoveToGermanyComplete(userContext: UserContextV1 | null | undefined): boolean {
  const migration = userContext?.profile?.domains?.migration;
  const country =
    typeof migration?.countryOfOrigin === 'string' && migration.countryOfOrigin.trim().length > 0;
  const residency = typeof migration?.residencyStatus === 'string';
  return country && residency;
}

/**
 * Derives Employment dual-track presentation from profile.
 * Does not invent employment facts or job-search intent.
 */
export function deriveEmploymentDualTrack(
  userContext: UserContextV1 | null | undefined
): EmploymentDualTrackSnapshot {
  const employment = userContext?.profile?.domains?.employment;
  const income = userContext?.profile?.domains?.income;
  const rawStatus =
    typeof employment?.employmentStatus === 'string' ? employment.employmentStatus : null;

  const situationKind: EmploymentSituationKind = rawStatus ? 'known' : 'not_provided';
  const hasIncomeInfo =
    typeof income?.grossMonthlyIncome === 'number' && Number.isFinite(income.grossMonthlyIncome);

  const moveComplete = isMoveToGermanyComplete(userContext);
  const workIncomeAccess: WorkIncomeAccess = moveComplete ? 'available' : 'locked';

  const workIncomeHref =
    workIncomeAccess === 'locked'
      ? MOVE_TO_GERMANY_EDIT_HREF
      : situationKind === 'known'
        ? WORK_INCOME_PROFILE_HREF
        : WORK_INCOME_EDIT_HREF;

  return {
    situationKind,
    employmentStatus: rawStatus,
    hasIncomeInfo,
    workIncomeAccess,
    workIncomeHref,
    unlockHref: workIncomeAccess === 'locked' ? MOVE_TO_GERMANY_EDIT_HREF : null,
    jobSearchHref: EMPLOYMENT_JOB_SEARCH_HREF,
    impliesJobSearchIntent: false,
    claimsDiscoveryRun: false,
    claimsDiscoveryResults: false,
  };
}

export function employmentStatusLabelKey(status: string): string {
  return `profile.options.employmentStatus.${status}`;
}
