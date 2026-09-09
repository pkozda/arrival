/**
 * E4 — Wohngeld awareness (conservative, non-authoritative).
 * Maps MBDE heuristic evaluation → product awareness states.
 * Never presents official eligibility or benefit amounts.
 */
import type { UserProfileViewV1 } from '@arrival-atlas/product-contract';
import { GERMANY_SEED_BENEFITS } from '../ingestion/seeds/germany-seed-benefits.js';
import { evaluateEligibility } from '../engine/eligibility-engine.js';
import { adaptUserProfileView } from '../profile/adapt-user-profile.js';
import { flattenMbdeProfile } from '../types/user-profile.js';
import type {
  BenefitsAwarenessResultV1,
  BenefitsAwarenessStateV1,
} from './types.js';

export type {
  BenefitsAwarenessNextActionKindV1,
  BenefitsAwarenessStateV1,
} from './types.js';

export const WOHNGELD_BENEFIT_ID = 'de_federal_wohngeld' as const;

export type WohngeldAwarenessResultV1 = BenefitsAwarenessResultV1 & {
  benefitId: typeof WOHNGELD_BENEFIT_ID;
};

const WOHNGELD_NODE = GERMANY_SEED_BENEFITS.find((b) => b.id === WOHNGELD_BENEFIT_ID);

function mapMissingFieldToKey(field: string): string {
  if (field.startsWith('housing.')) return 'benefits.awareness.missing.housingRent';
  if (field.startsWith('financial.')) return 'benefits.awareness.missing.income';
  return 'benefits.awareness.missing.generic';
}

/**
 * Evaluate Wohngeld awareness from Atlas UserProfileView.
 * Deterministic; no persistence — derived from authoritative profile facts.
 */
export function evaluateWohngeldAwareness(
  profile: UserProfileViewV1 | null | undefined
): WohngeldAwarenessResultV1 {
  const disclaimerKey = 'benefits.awareness.disclaimer';

  const titleKey = 'benefits.awareness.wohngeld.title';

  if (!WOHNGELD_NODE) {
    return {
      benefitId: WOHNGELD_BENEFIT_ID,
      titleKey,
      state: 'NOT_ENOUGH_INFORMATION',
      explanationKey: 'benefits.awareness.wohngeld.unavailable',
      missingFieldKeys: [],
      nextAction: {
        kind: 'none',
        href: null,
        labelKey: 'benefits.awareness.action.none',
      },
      engine: {
        heuristicMatch: false,
        partialMatch: false,
        missingFields: [],
        confidence: 0,
      },
      disclaimerKey,
    };
  }

  if (profile?.domains?.benefits?.receivingWohngeld === true) {
    return {
      benefitId: WOHNGELD_BENEFIT_ID,
      titleKey,
      state: 'COMPLETED',
      explanationKey: 'benefits.awareness.wohngeld.completed',
      missingFieldKeys: [],
      nextAction: {
        kind: 'update_benefits_flags',
        href: '/profile/benefits-support/edit',
        labelKey: 'benefits.awareness.action.reviewBenefits',
      },
      engine: {
        heuristicMatch: false,
        partialMatch: false,
        missingFields: [],
        confidence: 1,
      },
      disclaimerKey,
    };
  }

  const mbdeProfile = adaptUserProfileView(profile);
  const flat = flattenMbdeProfile(mbdeProfile);
  const evaluation = evaluateEligibility(WOHNGELD_NODE.eligibilityRules, flat);

  const missingFieldKeys = [...new Set(evaluation.missingFields.map(mapMissingFieldToKey))];

  if (evaluation.missingFields.length > 0) {
    const needsHousing = evaluation.missingFields.some((f) => f.startsWith('housing.'));
    const needsIncome = evaluation.missingFields.some((f) => f.startsWith('financial.'));
    return {
      benefitId: WOHNGELD_BENEFIT_ID,
      titleKey,
      state: 'NOT_ENOUGH_INFORMATION',
      explanationKey: 'benefits.awareness.wohngeld.notEnoughInformation',
      missingFieldKeys,
      nextAction: {
        kind: needsHousing ? 'update_housing' : needsIncome ? 'update_income' : 'update_housing',
        href: needsHousing
          ? '/profile/where-you-live/edit'
          : '/profile/work-income/edit',
        labelKey: needsHousing
          ? 'benefits.awareness.action.updateHousing'
          : 'benefits.awareness.action.updateIncome',
      },
      engine: {
        heuristicMatch: evaluation.eligible,
        partialMatch: evaluation.partialMatch,
        missingFields: evaluation.missingFields,
        confidence: evaluation.confidence,
      },
      disclaimerKey,
    };
  }

  if (evaluation.eligible) {
    return {
      benefitId: WOHNGELD_BENEFIT_ID,
      titleKey,
      state: 'READY_TO_ACT',
      explanationKey: 'benefits.awareness.wohngeld.readyToAct',
      missingFieldKeys: [],
      nextAction: {
        kind: 'open_official_source',
        href: WOHNGELD_NODE.source.url,
        labelKey: 'benefits.awareness.action.openOfficial',
      },
      engine: {
        heuristicMatch: true,
        partialMatch: false,
        missingFields: [],
        confidence: evaluation.confidence,
      },
      disclaimerKey,
    };
  }

  // Known facts present but heuristic rules do not match (e.g. income above seed threshold).
  return {
    benefitId: WOHNGELD_BENEFIT_ID,
    titleKey,
    state: 'NOT_APPLICABLE',
    explanationKey: 'benefits.awareness.wohngeld.notApplicable',
    missingFieldKeys: [],
    nextAction: {
      kind: 'update_benefits_flags',
      href: '/profile/benefits-support/edit',
      labelKey: 'benefits.awareness.action.reviewBenefits',
    },
    engine: {
      heuristicMatch: false,
      partialMatch: evaluation.partialMatch,
      missingFields: [],
      confidence: evaluation.confidence,
    },
    disclaimerKey,
  };
}

/** Alias kept for documentation/tests naming symmetry with product brief. */
export type BenefitsAwarenessStateAlias = BenefitsAwarenessStateV1;
