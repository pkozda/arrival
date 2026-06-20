import type { SecondaryConditionId } from '@arrival-atlas/product-contract';
import type { ProfileInsightViewV1 } from '@arrival-atlas/product-contract';
import { classifyLifeState } from './classify-life-state.js';
import { computeSituationSignals } from './signals.js';

export function detectSecondaryConditions(
  userContext: Parameters<typeof computeSituationSignals>[0],
  profileInsights?: ProfileInsightViewV1 | null
): SecondaryConditionId[] {
  const signals = computeSituationSignals(userContext);
  const primary = classifyLifeState(userContext);
  const conditions = new Set<SecondaryConditionId>();
  const employment = userContext.profile?.domains.employment;
  const benefits = userContext.profile?.domains.benefits;
  const household = userContext.profile?.domains.household;
  const migration = userContext.profile?.domains.migration;

  if (!signals.isMunicipallyRegistered && primary !== 'arrival_unregistered') {
    conditions.add('registration_incomplete');
  }

  if (signals.reRegistrationPending) {
    conditions.add('re_registration_required');
  }

  if (signals.insuranceGapActive && primary !== 'insurance_gap') {
    conditions.add('insurance_gap');
  }

  if (employment?.employmentStatus === 'student' && !signals.hasIncome && primary === 'economic_setup_pending') {
    conditions.add('insurance_gap');
  }

  if (!signals.housingDataComplete && signals.hasRegistrableAddress) {
    conditions.add('housing_data_missing');
  }

  if (signals.housingSearchActive) {
    conditions.add('housing_search_active');
  }

  if (!signals.hasEmployment && primary !== 'economic_setup_pending') {
    conditions.add('employment_data_missing');
  }

  if (!signals.hasIncome) {
    conditions.add('income_data_missing');
  }

  if (
    primary === 'benefits_exploration' &&
    !signals.hasBenefitsPicture &&
    benefits?.receivingAlg1 === undefined
  ) {
    conditions.add('benefits_data_missing');
  }

  if (household?.children !== undefined && household.householdSize === undefined) {
    conditions.add('household_data_missing');
  }

  if (!signals.bankingEstablished && primary === 'arrival_stabilizing') {
    conditions.add('banking_not_established');
  }

  if (
    primary === 'insurance_gap' &&
    (signals.isUnemployed || (!signals.hasEmployment && !signals.hasIncome))
  ) {
    conditions.add('economic_setup_pending');
  }

  if (hasLifeTransitionPending(signals, primary, employment, household, migration)) {
    conditions.add('life_transition_pending');
  }

  if (profileInsights?.globalConfidence === 'low' || profileInsights?.globalConfidence === 'medium') {
    if (primary === 'situation_stable' && !signals.hasIncome) {
      conditions.add('low_planning_confidence');
    }
  }

  return [...conditions];
}

function hasLifeTransitionPending(
  signals: ReturnType<typeof computeSituationSignals>,
  primary: ReturnType<typeof classifyLifeState>,
  employment: { employmentStatus?: string } | undefined,
  household: { children?: unknown[] } | undefined,
  migration: { residencyStatus?: string } | undefined
): boolean {
  if (primary === 'situation_stable') {
    if (household?.children !== undefined) {
      return true;
    }

    if (migration?.residencyStatus === 'work-visa' || migration?.residencyStatus === 'student-visa') {
      return true;
    }
  }

  if (
    signals.isUnemployed &&
    signals.isMunicipallyRegistered &&
    signals.hasStableHousing &&
    primary === 'economic_setup_pending'
  ) {
    return true;
  }

  if (primary === 'housing_instability' && !signals.hasRegistrableAddress) {
    return true;
  }

  if (primary === 'insurance_gap' && signals.isUnemployed) {
    return true;
  }

  if (employment?.employmentStatus === 'student' && !signals.hasIncome) {
    return true;
  }

  return false;
}
