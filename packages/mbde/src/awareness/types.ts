/**
 * Shared Benefits awareness types (E4/E5).
 * Small typed surface — not a generic benefits plugin platform.
 */

export type BenefitsAwarenessStateV1 =
  | 'NOT_ENOUGH_INFORMATION'
  | 'POTENTIALLY_RELEVANT'
  | 'NOT_APPLICABLE'
  | 'READY_TO_ACT'
  | 'COMPLETED';

export type BenefitsAwarenessNextActionKindV1 =
  | 'update_housing'
  | 'update_income'
  | 'update_household'
  | 'update_benefits_flags'
  | 'open_official_source'
  | 'none';

export type BenefitsAwarenessResultV1 = {
  benefitId: string;
  titleKey: string;
  state: BenefitsAwarenessStateV1;
  /** Copy keys resolved by the presentation layer — never raw "eligible". */
  explanationKey: string;
  missingFieldKeys: string[];
  nextAction: {
    kind: BenefitsAwarenessNextActionKindV1;
    href: string | null;
    labelKey: string;
  };
  /** Heuristic engine signals for tests — not shown as eligibility claims. */
  engine: {
    heuristicMatch: boolean;
    partialMatch: boolean;
    missingFields: string[];
    confidence: number;
  };
  disclaimerKey: string;
};
