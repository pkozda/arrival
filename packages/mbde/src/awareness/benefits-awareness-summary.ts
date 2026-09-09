/**
 * E7 — Derived Benefits awareness summary (presentation composition).
 * Not a ranking engine: deterministic state-band ordering + explainable focus.
 */
import type { BenefitsAwarenessResultV1, BenefitsAwarenessStateV1 } from './types.js';

/** Explicit presentation bands — lower number surfaces earlier. Not legal priority. */
const STATE_BAND: Record<BenefitsAwarenessStateV1, number> = {
  READY_TO_ACT: 0,
  POTENTIALLY_RELEVANT: 1,
  NOT_ENOUGH_INFORMATION: 2,
  NOT_APPLICABLE: 3,
  COMPLETED: 4,
};

export type BenefitsAwarenessFocusModeV1 =
  | 'ACTIONABLE'
  | 'GATHER_INFORMATION'
  | 'REVIEW_COMPLETED'
  | 'NONE';

export type BenefitsAwarenessCountsV1 = {
  readyToAct: number;
  potentiallyRelevant: number;
  notEnoughInformation: number;
  notApplicable: number;
  completed: number;
  total: number;
};

export type BenefitsAwarenessSummaryV1 = {
  /** Cards in deterministic presentation order (individual semantics preserved). */
  items: BenefitsAwarenessResultV1[];
  counts: BenefitsAwarenessCountsV1;
  /** First actionable / information-gathering card for aggregate chrome — not a score winner. */
  primaryFocus: BenefitsAwarenessResultV1 | null;
  focusMode: BenefitsAwarenessFocusModeV1;
  summaryKey: string;
};

function countStates(items: BenefitsAwarenessResultV1[]): BenefitsAwarenessCountsV1 {
  const counts: BenefitsAwarenessCountsV1 = {
    readyToAct: 0,
    potentiallyRelevant: 0,
    notEnoughInformation: 0,
    notApplicable: 0,
    completed: 0,
    total: items.length,
  };

  for (const item of items) {
    switch (item.state) {
      case 'READY_TO_ACT':
        counts.readyToAct += 1;
        break;
      case 'POTENTIALLY_RELEVANT':
        counts.potentiallyRelevant += 1;
        break;
      case 'NOT_ENOUGH_INFORMATION':
        counts.notEnoughInformation += 1;
        break;
      case 'NOT_APPLICABLE':
        counts.notApplicable += 1;
        break;
      case 'COMPLETED':
        counts.completed += 1;
        break;
    }
  }

  return counts;
}

/**
 * Deterministic presentation order:
 * READY_TO_ACT → POTENTIALLY_RELEVANT → NOT_ENOUGH_INFORMATION → NOT_APPLICABLE → COMPLETED
 * Tie-break: original evaluation order (seed order), never monetary/legal ranking.
 */
export function orderBenefitsAwarenessForPresentation(
  results: BenefitsAwarenessResultV1[]
): BenefitsAwarenessResultV1[] {
  return results
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const bandDelta = STATE_BAND[left.item.state] - STATE_BAND[right.item.state];
      if (bandDelta !== 0) return bandDelta;
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

function pickPrimaryFocus(
  ordered: BenefitsAwarenessResultV1[]
): BenefitsAwarenessResultV1 | null {
  const ready = ordered.find((item) => item.state === 'READY_TO_ACT');
  if (ready) return ready;

  const potential = ordered.find((item) => item.state === 'POTENTIALLY_RELEVANT');
  if (potential) return potential;

  const missing = ordered.find((item) => item.state === 'NOT_ENOUGH_INFORMATION');
  if (missing) return missing;

  return null;
}

function resolveFocusMode(
  counts: BenefitsAwarenessCountsV1,
  primary: BenefitsAwarenessResultV1 | null
): BenefitsAwarenessFocusModeV1 {
  if (!primary) {
    if (counts.completed > 0 && counts.completed === counts.total) {
      return 'REVIEW_COMPLETED';
    }
    return 'NONE';
  }
  if (primary.state === 'READY_TO_ACT' || primary.state === 'POTENTIALLY_RELEVANT') {
    return 'ACTIONABLE';
  }
  if (primary.state === 'NOT_ENOUGH_INFORMATION') {
    return 'GATHER_INFORMATION';
  }
  return 'NONE';
}

function resolveSummaryKey(
  focusMode: BenefitsAwarenessFocusModeV1,
  counts: BenefitsAwarenessCountsV1
): string {
  switch (focusMode) {
    case 'ACTIONABLE':
      return counts.readyToAct + counts.potentiallyRelevant > 1
        ? 'benefits.awareness.aggregate.multipleActionable'
        : 'benefits.awareness.aggregate.oneActionable';
    case 'GATHER_INFORMATION':
      return 'benefits.awareness.aggregate.needInformation';
    case 'REVIEW_COMPLETED':
      return 'benefits.awareness.aggregate.allCompleted';
    case 'NONE':
      return 'benefits.awareness.aggregate.noneActionable';
  }
}

/**
 * Derive a presentation summary from independent benefit evaluations.
 * Does not persist; does not score; does not erase per-benefit explanations.
 */
export function summarizeBenefitsAwareness(
  results: BenefitsAwarenessResultV1[]
): BenefitsAwarenessSummaryV1 {
  const items = orderBenefitsAwarenessForPresentation(results);
  const counts = countStates(items);
  const primaryFocus = pickPrimaryFocus(items);
  const focusMode = resolveFocusMode(counts, primaryFocus);
  const summaryKey = resolveSummaryKey(focusMode, counts);

  return {
    items,
    counts,
    primaryFocus,
    focusMode,
    summaryKey,
  };
}
