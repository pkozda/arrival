import type {
  EconomicFeedbackSignalsV1,
  EconomicSatisfactionKey,
  UserContextV1,
} from '@arrival-atlas/product-contract';
import { computeSituationSignals } from '../../life-event/plan/signals.js';
import type { EconomicSatisfactionSnapshot } from './types.js';

const INSTITUTION_ENGAGEMENT_THRESHOLD = 0.5;

function domains(context: UserContextV1) {
  return context.profile?.domains ?? {};
}

export function evaluateEconomicSatisfactionKeys(
  userContext: UserContextV1
): EconomicSatisfactionSnapshot {
  const signals = computeSituationSignals(userContext);
  const profile = domains(userContext);
  const employmentStatus = profile.employment?.employmentStatus;
  const benefits = profile.benefits;

  const incomeDeclared =
    signals.hasIncome || profile.income?.grossMonthlyIncome !== undefined;

  const employmentStatusKnown = employmentStatus !== undefined;

  const benefitsActiveJobcenter = benefits?.receivingBuergergeld === true;

  const benefitsActiveSozialamt = benefits?.receivingSozialamtSupport === true;

  const jobcenterCaseOpen =
    benefitsActiveJobcenter || benefits?.supportApplicationPending === 'jobcenter';

  const sozialamtCaseOpen = benefitsActiveSozialamt;

  return {
    registration_confirmed: signals.isMunicipallyRegistered,
    income_declared: incomeDeclared,
    employment_status_known: employmentStatusKnown,
    benefits_active_jobcenter: benefitsActiveJobcenter,
    benefits_active_sozialamt: benefitsActiveSozialamt,
    jobcenter_case_open: jobcenterCaseOpen,
    sozialamt_case_open: sozialamtCaseOpen,
  };
}

export function enrichSatisfactionSnapshotWithFeedback(
  snapshot: EconomicSatisfactionSnapshot,
  feedback?: EconomicFeedbackSignalsV1
): EconomicSatisfactionSnapshot {
  if (!feedback) {
    return snapshot;
  }

  const enriched = { ...snapshot };

  if (
    feedback.institutionEngagementDelta >= INSTITUTION_ENGAGEMENT_THRESHOLD &&
    feedback.institutionEngagementTarget === 'jobcenter'
  ) {
    enriched.jobcenter_case_open = true;
  }

  if (
    feedback.institutionEngagementDelta >= INSTITUTION_ENGAGEMENT_THRESHOLD &&
    feedback.institutionEngagementTarget === 'sozialamt'
  ) {
    enriched.sozialamt_case_open = true;
  }

  return enriched;
}

export function areSatisfactionKeysMet(
  keys: EconomicSatisfactionKey[],
  snapshot: EconomicSatisfactionSnapshot
): boolean {
  if (keys.length === 0) {
    return false;
  }
  return keys.every((key) => snapshot[key]);
}

export function countMetSatisfactionKeys(
  keys: EconomicSatisfactionKey[],
  snapshot: EconomicSatisfactionSnapshot
): number {
  return keys.filter((key) => snapshot[key]).length;
}
