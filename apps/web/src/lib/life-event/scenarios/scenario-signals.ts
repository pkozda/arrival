import type { ScenarioContext, ScenarioTrigger } from './scenario-types';

function profileDomains(context: ScenarioContext) {
  return context.userContext.profile?.domains ?? {};
}

export function detectActiveTriggers(context: ScenarioContext): Set<ScenarioTrigger> {
  const triggers = new Set<ScenarioTrigger>();
  const { secondaryConditions } = context;
  const domains = profileDomains(context);
  const employment = domains.employment;
  const income = domains.income;
  const housing = domains.housing;
  const insurance = domains.healthInsurance;
  const benefits = domains.benefits;
  const migration = domains.migration;

  if (employment?.employmentStatus === 'unemployed') {
    triggers.add('employment_unemployed');
  }

  if (secondaryConditions.includes('employment_data_missing')) {
    triggers.add('employment_data_missing');
  }

  if (secondaryConditions.includes('income_data_missing')) {
    triggers.add('income_data_missing');
  }

  if (secondaryConditions.includes('registration_incomplete')) {
    triggers.add('registration_incomplete');
  }

  if (secondaryConditions.includes('housing_search_active')) {
    triggers.add('housing_search_active');
  }

  if (secondaryConditions.includes('re_registration_required')) {
    triggers.add('re_registration_required');
  }

  if (secondaryConditions.includes('insurance_gap')) {
    triggers.add('insurance_gap');
  }

  if (secondaryConditions.includes('housing_data_missing')) {
    triggers.add('housing_data_missing');
  }

  if (secondaryConditions.includes('benefits_data_missing')) {
    triggers.add('benefits_data_missing');
  }

  if (secondaryConditions.includes('economic_setup_pending')) {
    triggers.add('economic_setup_pending');
  }

  if (secondaryConditions.includes('life_transition_pending')) {
    triggers.add('life_transition_pending');
  }

  if (
    migration?.residencyStatus === 'tourist' ||
    migration?.residencyStatus === 'work-visa' ||
    migration?.residencyStatus === 'student-visa' ||
    (benefits?.daysInGermany !== undefined && benefits.daysInGermany < 90)
  ) {
    triggers.add('recent_arrival_signal');
  }

  if (
    insurance?.hasCoverage === true &&
    insurance.insuranceType !== undefined &&
    insurance.insuranceType !== 'none' &&
    employment?.employmentStatus === 'employed' &&
    housing?.city &&
    !secondaryConditions.includes('registration_incomplete') &&
    !secondaryConditions.includes('insurance_gap') &&
    !secondaryConditions.includes('housing_search_active')
  ) {
    triggers.add('stability_signal');
  }

  if (insurance?.hasCoverage === false || insurance?.insuranceType === 'none') {
    triggers.add('insurance_gap');
  }

  if (
    income?.grossMonthlyIncome !== undefined &&
    income.grossMonthlyIncome < 1200 &&
    employment?.employmentStatus !== 'unemployed'
  ) {
    triggers.add('income_data_missing');
  }

  return triggers;
}

export function triggersSatisfy(
  required: readonly ScenarioTrigger[],
  active: ReadonlySet<ScenarioTrigger>
): boolean {
  return required.some((trigger) => active.has(trigger));
}
