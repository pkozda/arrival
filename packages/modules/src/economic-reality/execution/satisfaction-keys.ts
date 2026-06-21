import type { EconomicSatisfactionKey, UserContextV1 } from '@arrival-atlas/product-contract';
import { computeSituationSignals } from '../../life-event/plan/signals.js';
import type { EconomicSatisfactionSnapshot } from './types.js';

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

  return {
    registration_confirmed: signals.isMunicipallyRegistered,
    income_declared: incomeDeclared,
    employment_status_known: employmentStatusKnown,
    benefits_active_jobcenter: benefitsActiveJobcenter,
    benefits_active_sozialamt: benefitsActiveSozialamt,
    jobcenter_case_open: jobcenterCaseOpen,
  };
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
