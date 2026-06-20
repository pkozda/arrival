import type { LifeStateId } from '@arrival-atlas/product-contract';
import { computeSituationSignals, type SituationSignals } from './signals.js';

export function classifyLifeState(userContext: Parameters<typeof computeSituationSignals>[0]): LifeStateId {
  const signals = computeSituationSignals(userContext);

  if (isArrivalUnregistered(signals)) {
    return 'arrival_unregistered';
  }

  if (isHousingDominantOverInsurance(signals)) {
    return 'housing_instability';
  }

  if (isInsuranceGapPrimary(signals)) {
    return 'insurance_gap';
  }

  if (isHousingInstability(signals)) {
    return 'housing_instability';
  }

  if (isEconomicSetupPending(signals, userContext)) {
    return 'economic_setup_pending';
  }

  if (isBenefitsExploration(signals, userContext)) {
    return 'benefits_exploration';
  }

  if (isArrivalStabilizing(signals)) {
    return 'arrival_stabilizing';
  }

  return 'situation_stable';
}

function isArrivalUnregistered(signals: SituationSignals): boolean {
  if (signals.reRegistrationPending) {
    return true;
  }

  if (signals.isMunicipallyRegistered) {
    return false;
  }

  if (
    signals.establishedResident &&
    signals.housingSearchActive &&
    !signals.hasRegistrableAddress
  ) {
    return false;
  }

  return true;
}

function isHousingDominantOverInsurance(signals: SituationSignals): boolean {
  return (
    !signals.hasRegistrableAddress &&
    signals.establishedResident &&
    (signals.housingSearchActive || !signals.hasStableHousing)
  );
}

function isInsuranceGapPrimary(signals: SituationSignals): boolean {
  if (!signals.insuranceGapActive) {
    return false;
  }

  if (isHousingDominantOverInsurance(signals)) {
    return false;
  }

  if (signals.insuranceLapseRisk) {
    return true;
  }

  if (signals.hasEmployment && signals.insuranceGapActive) {
    return true;
  }

  if (signals.hasIncome && signals.insuranceGapActive && !signals.isUnemployed) {
    return true;
  }

  if (
    signals.isMunicipallyRegistered &&
    signals.openSurvivalGapCount >= 2 &&
    signals.hasStableHousing &&
    !signals.insuranceLapseRisk
  ) {
    return false;
  }

  return false;
}

function isEconomicDominant(signals: SituationSignals): boolean {
  if (
    signals.isMunicipallyRegistered &&
    signals.openSurvivalGapCount >= 2 &&
    !signals.insuranceLapseRisk &&
    signals.insuranceGapActive &&
    signals.hasStableHousing
  ) {
    return false;
  }

  return true;
}

function isHousingInstability(signals: SituationSignals): boolean {
  if (!signals.hasRegistrableAddress && signals.establishedResident) {
    return true;
  }

  if (signals.housingSearchActive && !signals.hasStableHousing) {
    return true;
  }

  if (signals.needsRentForBenefitsPlanning) {
    return true;
  }

  return false;
}

function isEconomicSetupPending(
  signals: SituationSignals,
  userContext: Parameters<typeof computeSituationSignals>[0]
): boolean {
  const employment = userContext.profile?.domains.employment;
  const benefits = userContext.profile?.domains.benefits;

  if (employment?.employmentStatus === 'student' && !signals.hasIncome) {
    return true;
  }

  if (signals.survivalFoundationComplete) {
    return false;
  }

  if (signals.isUnemployed && benefits?.receivingAlg1 === true) {
    return false;
  }

  if (signals.isUnemployed && benefits?.receivingBuergergeld === true) {
    return false;
  }

  if (!isEconomicDominant(signals)) {
    return false;
  }

  if (signals.isUnemployed && !signals.benefitsExplorationRelevant) {
    return true;
  }

  if (!signals.hasEmployment && !signals.hasIncome) {
    return true;
  }

  if (signals.isUnemployed && signals.hasBenefitsPicture === false) {
    return true;
  }

  return false;
}

function isBenefitsExploration(
  signals: SituationSignals,
  userContext: Parameters<typeof computeSituationSignals>[0]
): boolean {
  const benefits = userContext.profile?.domains.benefits;
  const household = userContext.profile?.domains.household;

  if (
    signals.survivalFoundationComplete &&
    household?.children !== undefined &&
    benefits?.receivingWohngeld !== false
  ) {
    return false;
  }

  if (signals.isUnemployed && signals.hasInsurance && benefits?.receivingAlg1 === true) {
    return true;
  }

  if (signals.needsRentForBenefitsPlanning) {
    return true;
  }

  if (
    (signals.hasEmployment || signals.hasIncome) &&
    household?.children !== undefined &&
    household.householdSize === undefined
  ) {
    return true;
  }

  if (
    signals.hasEmployment &&
    signals.hasIncome &&
    signals.housingDataComplete &&
    benefits?.receivingWohngeld === false
  ) {
    return true;
  }

  if (signals.benefitsExplorationRelevant && signals.hasIncome && !signals.isUnemployed) {
    const receiving =
      benefits?.receivingBuergergeld === true ||
      benefits?.receivingAlg1 === true ||
      benefits?.receivingWohngeld === true;
    if (!receiving && benefits?.receivingWohngeld === false) {
      return true;
    }
  }

  return false;
}

function isArrivalStabilizing(signals: SituationSignals): boolean {
  if (!signals.isMunicipallyRegistered) {
    return false;
  }

  if (signals.survivalFoundationComplete) {
    return false;
  }

  return signals.openSurvivalGapCount >= 2;
}
