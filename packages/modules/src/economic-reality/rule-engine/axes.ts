import type { UserContextV1 } from '@arrival-atlas/product-contract';
import { computeSituationSignals } from '../../life-event/plan/signals.js';

export const STABLE_INCOME_THRESHOLD_EUR = 1200;

export type EconomicSignalBundle = {
  incomeAxis: 'none' | 'low' | 'stable';
  employmentAxis: 'unemployed' | 'transition' | 'employed';
  institutionAxis: 'none' | 'jobcenter' | 'sozialamt';
  supportSystem: 'jobcenter' | 'sozialamt' | 'none' | 'pending';
  isStudent: boolean;
  survivalCrisis: boolean;
  recentArrivalUnregistered: boolean;
  benefitApplicationIntent: boolean;
};

function domains(context: UserContextV1) {
  return context.profile?.domains ?? {};
}

export function computeEconomicSignals(context: UserContextV1): EconomicSignalBundle {
  const employment = domains(context).employment;
  const income = domains(context).income;
  const benefits = domains(context).benefits;
  const migration = domains(context).migration;
  const lifeSignals = computeSituationSignals(context);

  const gross = income?.grossMonthlyIncome;
  const incomeAxis =
    gross === undefined || gross <= 0 ? 'none' : gross >= STABLE_INCOME_THRESHOLD_EUR ? 'stable' : 'low';

  const employmentStatus = employment?.employmentStatus;
  const isStudent = employmentStatus === 'student';

  let employmentAxis: EconomicSignalBundle['employmentAxis'];
  if (employmentStatus === 'unemployed') {
    employmentAxis = 'transition';
  } else if (
    employmentStatus === 'employed' ||
    employmentStatus === 'self-employed' ||
    employmentStatus === 'part-time'
  ) {
    employmentAxis = 'employed';
  } else if (isStudent) {
    employmentAxis = 'employed';
  } else {
    employmentAxis = 'unemployed';
  }

  const receivingBuergergeld = benefits?.receivingBuergergeld === true;
  const receivingSozialamt = benefits?.receivingSozialamtSupport === true;
  const applicationPending = benefits?.supportApplicationPending;

  let institutionAxis: EconomicSignalBundle['institutionAxis'] = 'none';
  if (receivingBuergergeld) {
    institutionAxis = 'jobcenter';
  } else if (receivingSozialamt || isSozialamtResidencyPath(migration?.residencyStatus)) {
    institutionAxis = 'sozialamt';
  } else if (applicationPending) {
    institutionAxis = applicationPending;
  }

  let supportSystem: EconomicSignalBundle['supportSystem'] = 'none';
  if (receivingBuergergeld) {
    supportSystem = 'jobcenter';
  } else if (receivingSozialamt) {
    supportSystem = 'sozialamt';
  } else if (applicationPending) {
    supportSystem = 'pending';
  }

  const recentArrivalUnregistered =
    !lifeSignals.isMunicipallyRegistered &&
    (lifeSignals.daysInGermany < 14 || migration?.residencyStatus === 'tourist');

  const survivalCrisis =
    !isStudent &&
    incomeAxis === 'none' &&
    supportSystem === 'none' &&
    institutionAxis === 'none' &&
    (benefits?.savingsDepleted === true ||
      recentArrivalUnregistered ||
      (!lifeSignals.hasRegistrableAddress && lifeSignals.isUnemployed));

  return {
    incomeAxis,
    employmentAxis,
    institutionAxis,
    supportSystem,
    isStudent,
    survivalCrisis,
    recentArrivalUnregistered,
    benefitApplicationIntent: benefits?.benefitApplicationIntent === true,
  };
}

function isSozialamtResidencyPath(
  residencyStatus: string | undefined
): residencyStatus is 'asylum-seeker' {
  return residencyStatus === 'asylum-seeker';
}

export function toEconomicAxes(signals: EconomicSignalBundle) {
  return {
    incomeAxis: signals.incomeAxis,
    employmentAxis: signals.employmentAxis,
    institutionAxis: signals.institutionAxis,
  };
}
