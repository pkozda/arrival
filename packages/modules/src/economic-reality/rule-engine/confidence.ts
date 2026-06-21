import type { UserContextV1, EconomicBlockerId } from '@arrival-atlas/product-contract';
import { computeSituationSignals } from '../../life-event/plan/signals.js';
import { computeEconomicSignals } from './axes.js';
import { buildEvaluationFromRules } from './rules.js';

const STABLE_INCOME_THRESHOLD_EUR = 1200;

export function detectEconomicBlockers(context: UserContextV1): EconomicBlockerId[] {
  const lifeSignals = computeSituationSignals(context);
  const benefits = context.profile?.domains.benefits;
  const migration = context.profile?.domains.migration;
  const household = context.profile?.domains.household;
  const blockers: EconomicBlockerId[] = [];

  if (!lifeSignals.isMunicipallyRegistered) {
    blockers.push('SC-REG');
  }
  if (!lifeSignals.hasRegistrableAddress) {
    blockers.push('SC-ADDR');
  }
  if (lifeSignals.insuranceGapActive) {
    blockers.push('SC-INS');
  }
  if (
    benefits?.receivingBuergergeld === undefined &&
    benefits?.receivingSozialamtSupport === undefined &&
    benefits?.supportApplicationPending === undefined
  ) {
    blockers.push('SC-DOC');
  }
  if (household?.householdSize === undefined && household?.children !== undefined) {
    blockers.push('SC-HH');
  }
  if (
    migration?.residencyStatus === undefined ||
    migration.residencyStatus === 'unknown' ||
    migration.residencyStatus === 'tourist'
  ) {
    blockers.push('SC-STATUS');
  }
  if (benefits?.benefitReportingOverdue === true) {
    blockers.push('SC-REPORT');
  }

  return blockers;
}

export function computeConfidenceScore(
  context: UserContextV1,
  blockers: EconomicBlockerId[]
): number {
  const employment = context.profile?.domains.employment;
  const income = context.profile?.domains.income;
  const benefits = context.profile?.domains.benefits;

  let score = 1;

  const missingFacts = [
    employment?.employmentStatus === undefined,
    income?.grossMonthlyIncome === undefined &&
      benefits?.receivingBuergergeld === undefined &&
      benefits?.receivingSozialamtSupport === undefined,
    benefits?.receivingBuergergeld === undefined &&
      benefits?.receivingSozialamtSupport === undefined &&
      benefits?.supportApplicationPending === undefined,
  ].filter(Boolean).length;

  if (missingFacts >= 2) {
    score = 0.4;
  } else if (missingFacts === 1) {
    score = 0.7;
  }

  if (blockers.includes('SC-STATUS')) {
    score = Math.min(score, 0.5);
  }

  return score;
}

export function mapPlanConfidence(score: number): 'high' | 'medium' | 'low' | 'none' {
  if (score >= 0.85) {
    return 'high';
  }
  if (score >= 0.6) {
    return 'medium';
  }
  if (score >= 0.3) {
    return 'low';
  }
  return 'none';
}

export { STABLE_INCOME_THRESHOLD_EUR };
