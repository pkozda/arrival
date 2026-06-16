import type { UxActionCard } from './api';

export type DerivedUserState = {
  registration: 'required' | 'completed' | 'unknown';
  insurance: 'missing' | 'active' | 'unknown';
  benefits: 'eligible' | 'not-eligible' | 'unknown';
};

function actionText(action: UxActionCard): string {
  return `${action.id} ${action.title} ${action.description}`.toLowerCase();
}

function isRegistrationRequiredAction(action: UxActionCard): boolean {
  if (action.id.includes('anmeldung')) return true;

  const text = actionText(action);
  return (
    action.source === 'financial-reality' &&
    (text.includes('anmeldung') ||
      text.includes('register your address') ||
      text.includes('registration') ||
      text.includes('bürgeramt'))
  );
}

function isRegistrationCompletedAction(action: UxActionCard): boolean {
  const text = actionText(action);
  return (
    action.id.includes('registration_confirmed') ||
    action.id.includes('anmeldung_confirmed') ||
    text.includes('registration confirmed') ||
    text.includes('anmeldung confirmed') ||
    text.includes('address registered')
  );
}

function isInsuranceMissingAction(action: UxActionCard): boolean {
  if (action.id === 'choose-insurance' || action.id === 'krankenkasse') return true;

  const text = actionText(action);
  return (
    text.includes('choose health insurance') ||
    text.includes('krankenkasse_required') ||
    text.includes('set up health insurance') ||
    text.includes('no active insurance')
  );
}

function isInsuranceActiveAction(action: UxActionCard): boolean {
  const text = actionText(action);
  return (
    action.id.includes('insurance_confirmed') ||
    text.includes('insurance confirmed') ||
    text.includes('active coverage') ||
    text.includes('health insurance active')
  );
}

function isBenefitsEligibleAction(action: UxActionCard): boolean {
  if (action.id === 'buergergeld' || action.id === 'wohngeld') return true;

  const text = actionText(action);
  return (
    text.includes('bürgergeld') ||
    text.includes('buergergeld') ||
    text.includes('wohngeld') ||
    text.includes('benefits eligible') ||
    text.includes('financial support eligibility')
  );
}

function isBenefitsNotEligibleAction(action: UxActionCard): boolean {
  const text = actionText(action);
  return (
    action.id.includes('not_eligible') ||
    text.includes('not eligible') ||
    text.includes('likely not eligible') ||
    text.includes('no eligibility')
  );
}

function deriveRegistrationState(actions: UxActionCard[]): DerivedUserState['registration'] {
  if (actions.some(isRegistrationCompletedAction)) return 'completed';
  if (actions.some(isRegistrationRequiredAction)) return 'required';
  return 'unknown';
}

function deriveInsuranceState(actions: UxActionCard[]): DerivedUserState['insurance'] {
  if (actions.some(isInsuranceActiveAction)) return 'active';
  if (actions.some(isInsuranceMissingAction)) return 'missing';
  return 'unknown';
}

function deriveBenefitsState(actions: UxActionCard[]): DerivedUserState['benefits'] {
  if (actions.some(isBenefitsNotEligibleAction)) return 'not-eligible';
  if (actions.some(isBenefitsEligibleAction)) return 'eligible';
  return 'unknown';
}

export function deriveUserState(actions: UxActionCard[]): DerivedUserState {
  if (!Array.isArray(actions) || actions.length === 0) {
    return {
      registration: 'unknown',
      insurance: 'unknown',
      benefits: 'unknown',
    };
  }

  return {
    registration: deriveRegistrationState(actions),
    insurance: deriveInsuranceState(actions),
    benefits: deriveBenefitsState(actions),
  };
}
