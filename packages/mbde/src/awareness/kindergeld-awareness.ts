/**
 * E5/E6 — Kindergeld awareness (conservative, non-authoritative).
 * Uses explicit household.children only — never household size.
 * COMPLETED requires authoritative receivingKindergeld === true.
 * Never presents official eligibility or benefit amounts.
 */
import type { UserProfileViewV1 } from '@arrival-atlas/product-contract';
import { GERMANY_SEED_BENEFITS } from '../ingestion/seeds/germany-seed-benefits.js';
import { evaluateEligibility } from '../engine/eligibility-engine.js';
import { adaptUserProfileView } from '../profile/adapt-user-profile.js';
import { flattenMbdeProfile } from '../types/user-profile.js';
import type { BenefitsAwarenessResultV1 } from './types.js';

export const KINDERGELD_BENEFIT_ID = 'de_federal_kindergeld' as const;

export type KindergeldAwarenessResultV1 = BenefitsAwarenessResultV1 & {
  benefitId: typeof KINDERGELD_BENEFIT_ID;
};

const KINDERGELD_NODE = GERMANY_SEED_BENEFITS.find((b) => b.id === KINDERGELD_BENEFIT_ID);

/**
 * Evaluate Kindergeld awareness from Atlas UserProfileView.
 * Deterministic; no persistence — derived from authoritative profile facts.
 *
 * Critical: do not infer children from householdSize.
 * Children must be an explicit domains.household.children array.
 * Undefined children ⇒ unknown; [] ⇒ known empty; length>0 ⇒ known children.
 *
 * receivingKindergeld === true ⇒ COMPLETED (user-confirmed receipt, not verified).
 * undefined / false ⇒ continue normal awareness (undefined ≠ false).
 */
export function evaluateKindergeldAwareness(
  profile: UserProfileViewV1 | null | undefined
): KindergeldAwarenessResultV1 {
  const disclaimerKey = 'benefits.awareness.disclaimer';
  const titleKey = 'benefits.awareness.kindergeld.title';

  if (!KINDERGELD_NODE) {
    return {
      benefitId: KINDERGELD_BENEFIT_ID,
      titleKey,
      state: 'NOT_ENOUGH_INFORMATION',
      explanationKey: 'benefits.awareness.kindergeld.unavailable',
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

  if (profile?.domains?.benefits?.receivingKindergeld === true) {
    return {
      benefitId: KINDERGELD_BENEFIT_ID,
      titleKey,
      state: 'COMPLETED',
      explanationKey: 'benefits.awareness.kindergeld.completed',
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

  const children = profile?.domains?.household?.children;
  const childrenKnown = Array.isArray(children);

  if (!childrenKnown) {
    return {
      benefitId: KINDERGELD_BENEFIT_ID,
      titleKey,
      state: 'NOT_ENOUGH_INFORMATION',
      explanationKey: 'benefits.awareness.kindergeld.notEnoughInformation',
      missingFieldKeys: ['benefits.awareness.missing.children'],
      nextAction: {
        kind: 'update_household',
        href: '/profile/household-family/edit',
        labelKey: 'benefits.awareness.action.updateHousehold',
      },
      engine: {
        heuristicMatch: false,
        partialMatch: false,
        missingFields: ['household.children'],
        confidence: 0,
      },
      disclaimerKey,
    };
  }

  // Explicit empty children array — known "no children" (not inferred from size).
  if (children.length === 0) {
    return {
      benefitId: KINDERGELD_BENEFIT_ID,
      titleKey,
      state: 'NOT_APPLICABLE',
      explanationKey: 'benefits.awareness.kindergeld.notApplicable',
      missingFieldKeys: [],
      nextAction: {
        kind: 'update_household',
        href: '/profile/household-family/edit',
        labelKey: 'benefits.awareness.action.updateHousehold',
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
  const evaluation = evaluateEligibility(KINDERGELD_NODE.eligibilityRules, flat);

  // Seed rule is hasChildren === true; with explicit children this should match.
  if (evaluation.eligible) {
    return {
      benefitId: KINDERGELD_BENEFIT_ID,
      titleKey,
      state: 'READY_TO_ACT',
      explanationKey: 'benefits.awareness.kindergeld.readyToAct',
      missingFieldKeys: [],
      nextAction: {
        kind: 'open_official_source',
        href: KINDERGELD_NODE.source.url,
        labelKey: 'benefits.awareness.action.openOfficialKindergeld',
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

  return {
    benefitId: KINDERGELD_BENEFIT_ID,
    titleKey,
    state: 'NOT_APPLICABLE',
    explanationKey: 'benefits.awareness.kindergeld.notApplicable',
    missingFieldKeys: [],
    nextAction: {
      kind: 'update_household',
      href: '/profile/household-family/edit',
      labelKey: 'benefits.awareness.action.updateHousehold',
    },
    engine: {
      heuristicMatch: false,
      partialMatch: evaluation.partialMatch,
      missingFields: evaluation.missingFields,
      confidence: evaluation.confidence,
    },
    disclaimerKey,
  };
}
