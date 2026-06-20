import type { UserContextV1 } from '@arrival-atlas/product-contract';

export type SituationSignals = {
  hasRegistrableAddress: boolean;
  isMunicipallyRegistered: boolean;
  reRegistrationPending: boolean;
  hasInsurance: boolean;
  insuranceGapActive: boolean;
  insuranceLapseRisk: boolean;
  hasStableHousing: boolean;
  housingDataComplete: boolean;
  housingSearchActive: boolean;
  needsRentForBenefitsPlanning: boolean;
  hasEmployment: boolean;
  hasIncome: boolean;
  isUnemployed: boolean;
  hasBenefitsPicture: boolean;
  benefitsExplorationRelevant: boolean;
  benefitsAssessmentComplete: boolean;
  bankingEstablished: boolean;
  survivalFoundationComplete: boolean;
  daysInGermany: number;
  establishedResident: boolean;
  openSurvivalGapCount: number;
};

function domains(userContext: UserContextV1) {
  return userContext.profile?.domains ?? {};
}

export function computeSituationSignals(userContext: UserContextV1): SituationSignals {
  const migration = domains(userContext).migration;
  const housing = domains(userContext).housing;
  const employment = domains(userContext).employment;
  const income = domains(userContext).income;
  const healthInsurance = domains(userContext).healthInsurance;
  const benefits = domains(userContext).benefits;
  const household = domains(userContext).household;

  const hasRegistrableAddress = Boolean(housing?.city?.trim());
  const residencyStatus = migration?.residencyStatus;
  const hasResidencyStatus =
    residencyStatus !== undefined &&
    residencyStatus !== 'unknown' &&
    residencyStatus !== 'tourist';

  const daysInGermany = benefits?.daysInGermany ?? 0;
  const establishedResident = daysInGermany > 90;
  const recentArrival =
    (daysInGermany > 0 && daysInGermany < 14) ||
    (migration?.arrivedAt !== undefined && daysSince(migration.arrivedAt) < 14);

  const reRegistrationPending =
    establishedResident &&
    hasRegistrableAddress &&
    Boolean(migration?.arrivedAt) &&
    daysSince(migration!.arrivedAt!) <= 60;

  const isMunicipallyRegistered =
    hasRegistrableAddress &&
    hasResidencyStatus &&
    !reRegistrationPending &&
    !recentArrival;

  const hasInsurance =
    healthInsurance?.insuranceType === 'public' ||
    healthInsurance?.insuranceType === 'private' ||
    healthInsurance?.hasCoverage === true;

  const insuranceGapActive =
    !hasInsurance ||
    healthInsurance?.hasCoverage === false ||
    healthInsurance?.insuranceType === 'none';

  const insuranceLapseRisk =
    insuranceGapActive &&
    (healthInsurance?.hasCoverage === false || healthInsurance?.insuranceType === 'none');

  const hasStableHousing = hasRegistrableAddress && !housingSearchActive(housing, establishedResident);
  const housingDataComplete =
    hasRegistrableAddress &&
    housing?.monthlyColdRent !== undefined &&
    housing.monthlyColdRent >= 0;

  const housingSearchActiveFlag = housingSearchActive(housing, establishedResident);

  const hasEmployment =
    employment?.employmentStatus !== undefined &&
    employment.employmentStatus !== 'unemployed' &&
    employment.employmentStatus !== 'student';

  const isStudent = employment?.employmentStatus === 'student';

  const hasIncome = income?.grossMonthlyIncome !== undefined && income.grossMonthlyIncome >= 0;

  const isUnemployed = employment?.employmentStatus === 'unemployed';

  const hasBenefitsPicture =
    benefits?.receivingBuergergeld !== undefined ||
    benefits?.receivingAlg1 !== undefined ||
    benefits?.receivingWohngeld !== undefined;

  const receivingSupport =
    benefits?.receivingBuergergeld === true ||
    benefits?.receivingAlg1 === true ||
    benefits?.receivingWohngeld === true;

  const needsRentForBenefitsPlanning =
    hasEmployment &&
    hasIncome &&
    hasRegistrableAddress &&
    !housingDataComplete &&
    !receivingSupport;

  const benefitsAssessmentComplete =
    receivingSupport ||
    (benefits?.receivingBuergergeld === false &&
      benefits?.receivingAlg1 === false &&
      benefits?.receivingWohngeld === false);

  const benefitsExplorationRelevant =
    (hasEmployment || hasIncome) &&
    !receivingSupport &&
    (needsRentForBenefitsPlanning ||
      isUnemployed ||
      household?.householdSize !== undefined ||
      benefits?.receivingWohngeld === false);

  const bankingEstablished = hasEmployment && hasRegistrableAddress && isMunicipallyRegistered;

  const survivalFoundationComplete =
    isMunicipallyRegistered &&
    hasInsurance &&
    hasStableHousing &&
    (hasEmployment || hasIncome || (isStudent && hasIncome)) &&
    !insuranceGapActive;

  const openSurvivalGapCount = [
    !isMunicipallyRegistered,
    insuranceGapActive,
    !hasStableHousing,
    !hasEmployment && !hasIncome,
    !bankingEstablished,
  ].filter(Boolean).length;

  return {
    hasRegistrableAddress,
    isMunicipallyRegistered,
    reRegistrationPending,
    hasInsurance,
    insuranceGapActive,
    insuranceLapseRisk,
    hasStableHousing,
    housingDataComplete,
    housingSearchActive: housingSearchActiveFlag,
    needsRentForBenefitsPlanning,
    hasEmployment,
    hasIncome,
    isUnemployed,
    hasBenefitsPicture,
    benefitsExplorationRelevant,
    benefitsAssessmentComplete,
    bankingEstablished,
    survivalFoundationComplete,
    daysInGermany,
    establishedResident,
    openSurvivalGapCount,
  };
}

function housingSearchActive(
  housing: { city?: string; monthlyColdRent?: number } | undefined,
  establishedResident: boolean
): boolean {
  if (!housing?.city) {
    return establishedResident;
  }
  return false;
}

function daysSince(isoDate: string): number {
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
}

export type SatisfactionKey =
  | 'registrable_address'
  | 'municipal_registration'
  | 'insurance_coverage'
  | 'stable_housing'
  | 'housing_rent_recorded'
  | 'employment_basis'
  | 'income_recorded'
  | 'benefits_assessed'
  | 'banking_ready'
  | 'foundation_reviewed'
  | 'transition_explored';

export function isSatisfactionMet(key: SatisfactionKey, signals: SituationSignals): boolean {
  switch (key) {
    case 'registrable_address':
      return signals.hasRegistrableAddress;
    case 'municipal_registration':
      return signals.isMunicipallyRegistered;
    case 'insurance_coverage':
      return signals.hasInsurance && !signals.insuranceGapActive;
    case 'stable_housing':
      return signals.hasStableHousing;
    case 'housing_rent_recorded':
      return signals.housingDataComplete;
    case 'employment_basis':
      return signals.hasEmployment || (!signals.isUnemployed && signals.hasIncome);
    case 'income_recorded':
      return signals.hasIncome;
    case 'benefits_assessed':
      return signals.benefitsAssessmentComplete;
    case 'banking_ready':
      return signals.bankingEstablished;
    case 'foundation_reviewed':
    case 'transition_explored':
      return false;
    default:
      return false;
  }
}
