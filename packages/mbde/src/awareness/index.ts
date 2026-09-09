/**
 * Browser-safe Benefits awareness adapters (E4 Wohngeld, E5 Kindergeld, E7 summary).
 * Import from `@arrival-atlas/mbde/awareness` — not the package root.
 */
export type {
  BenefitsAwarenessStateV1,
  BenefitsAwarenessNextActionKindV1,
  BenefitsAwarenessResultV1,
} from './types.js';

export {
  WOHNGELD_BENEFIT_ID,
  evaluateWohngeldAwareness,
  type WohngeldAwarenessResultV1,
  type BenefitsAwarenessStateAlias,
} from './wohngeld-awareness.js';

export {
  KINDERGELD_BENEFIT_ID,
  evaluateKindergeldAwareness,
  type KindergeldAwarenessResultV1,
} from './kindergeld-awareness.js';

export {
  summarizeBenefitsAwareness,
  orderBenefitsAwarenessForPresentation,
  type BenefitsAwarenessSummaryV1,
  type BenefitsAwarenessCountsV1,
  type BenefitsAwarenessFocusModeV1,
} from './benefits-awareness-summary.js';

import type { UserProfileViewV1 } from '@arrival-atlas/product-contract';
import type { BenefitsAwarenessResultV1 } from './types.js';
import type { BenefitsAwarenessSummaryV1 } from './benefits-awareness-summary.js';
import { summarizeBenefitsAwareness } from './benefits-awareness-summary.js';
import { evaluateWohngeldAwareness } from './wohngeld-awareness.js';
import { evaluateKindergeldAwareness } from './kindergeld-awareness.js';

/** Evaluate the two supported awareness benefits — seed order before presentation sort. */
export function evaluateBenefitsAwareness(
  profile: UserProfileViewV1 | null | undefined
): BenefitsAwarenessResultV1[] {
  return [evaluateWohngeldAwareness(profile), evaluateKindergeldAwareness(profile)];
}

/** Profile → individual evaluations → derived presentation summary. */
export function evaluateBenefitsAwarenessSummary(
  profile: UserProfileViewV1 | null | undefined
): BenefitsAwarenessSummaryV1 {
  return summarizeBenefitsAwareness(evaluateBenefitsAwareness(profile));
}
