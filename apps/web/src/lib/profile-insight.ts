import type { UxActionCard } from './api';

export type ProfileInsight = {
  title: string;
  explanation: string;
  icon: string;
};

type InsightCategory = 'administrative' | 'healthcare' | 'financial';

function actionText(action: UxActionCard): string {
  return `${action.id} ${action.title} ${action.description}`.toLowerCase();
}

function isAdministrativeAction(action: UxActionCard): boolean {
  if (action.id === 'anmeldung') return true;

  const text = actionText(action);
  return (
    text.includes('anmeldung') ||
    text.includes('registration') ||
    text.includes('residence') ||
    text.includes('register your address')
  );
}

function isHealthcareAction(action: UxActionCard): boolean {
  if (action.id === 'choose-insurance' || action.id === 'krankenkasse') return true;

  const text = actionText(action);
  return (
    text.includes('insurance') ||
    text.includes('health coverage') ||
    text.includes('krankenkasse') ||
    text.includes('krankenversicherung')
  );
}

function isFinancialAction(action: UxActionCard): boolean {
  if (action.id === 'buergergeld' || action.id === 'wohngeld') return true;

  const text = actionText(action);
  return (
    text.includes('bürgergeld') ||
    text.includes('buergergeld') ||
    text.includes('wohngeld') ||
    text.includes('benefits') ||
    text.includes('financial support')
  );
}

function detectCategories(actions: UxActionCard[]): Set<InsightCategory> {
  const categories = new Set<InsightCategory>();

  for (const action of actions) {
    if (isAdministrativeAction(action)) categories.add('administrative');
    if (isHealthcareAction(action)) categories.add('healthcare');
    if (isFinancialAction(action)) categories.add('financial');
  }

  return categories;
}

export function deriveProfileInsight(actions: UxActionCard[]): ProfileInsight | null {
  if (!Array.isArray(actions) || actions.length === 0) {
    return null;
  }

  const categories = detectCategories(actions);

  if (categories.size === 0) {
    return {
      title: 'Guidance available for your next steps',
      explanation:
        'Based on your current situation in Germany, Arrive Atlas has identified actions that may help you stay on track.',
      icon: 'ℹ️',
    };
  }

  if (categories.size > 1) {
    return {
      title: 'You have multiple important administrative and financial actions pending',
      explanation:
        'Your current profile suggests pending compliance and support-related actions.',
      icon: '◆',
    };
  }

  const category = [...categories][0];

  if (category === 'administrative') {
    return {
      title: 'Administrative requirements detected',
      explanation:
        'Based on your current situation in Germany, several mandatory administrative steps may apply.',
      icon: '📋',
    };
  }

  if (category === 'healthcare') {
    return {
      title: 'Healthcare coverage requires attention',
      explanation:
        'Based on your current situation in Germany, health insurance and medical access requirements may apply.',
      icon: '🏥',
    };
  }

  return {
    title: 'Financial support eligibility signals detected',
    explanation:
      'Your current situation suggests you may benefit from reviewing financial support and housing assistance options.',
    icon: '€',
  };
}
