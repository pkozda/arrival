export interface RuleCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'exists';
  value?: unknown;
}

export interface Rule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  conclusion: string;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface RuleEvaluationResult {
  matchedRules: Rule[];
  conclusions: string[];
  recommendations: string[];
}

function evaluateCondition(data: Record<string, unknown>, condition: RuleCondition): boolean {
  const fieldValue = data[condition.field];

  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'gt':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue > condition.value;
    case 'gte':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue >= condition.value;
    case 'lt':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue < condition.value;
    case 'lte':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue <= condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;
    default:
      return false;
  }
}

function ruleMatches(data: Record<string, unknown>, rule: Rule): boolean {
  return rule.conditions.every((c) => evaluateCondition(data, c));
}

export class RulesEngine {
  private rules: Rule[] = [];

  addRule(rule: Rule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  addRules(rules: Rule[]): void {
    rules.forEach((r) => this.addRule(r));
  }

  evaluate(data: Record<string, unknown>): RuleEvaluationResult {
    const matchedRules = this.rules.filter((r) => ruleMatches(data, r));
    const conclusions = matchedRules.map((r) => r.conclusion);
    const recommendations = matchedRules
      .filter((r) => r.metadata?.recommendation)
      .map((r) => r.metadata!.recommendation as string);

    return { matchedRules, conclusions, recommendations };
  }

  clear(): void {
    this.rules = [];
  }
}

export const germanAdminRules = new RulesEngine();

germanAdminRules.addRules([
  {
    id: 'anmeldung-required',
    name: 'Registration requirement',
    conditions: [{ field: 'daysInGermany', operator: 'gt', value: 14 }],
    conclusion: 'You must register (Anmeldung) at the Bürgeramt within 14 days of moving',
    priority: 10,
    metadata: {
      recommendation: 'Book an appointment at your local Bürgeramt and bring passport, rental contract, and Wohnungsgeberbestätigung',
    },
  },
  {
    id: 'krankenkasse-mandatory',
    name: 'Health insurance requirement',
    conditions: [{ field: 'hasHealthInsurance', operator: 'eq', value: false }],
    conclusion: 'Health insurance (Krankenversicherung) is mandatory in Germany',
    priority: 9,
    metadata: {
      recommendation: 'Register with a public Krankenkasse (e.g. TK, AOK) or obtain private insurance if eligible',
    },
  },
  {
    id: 'steuerklasse-change',
    name: 'Tax class change after marriage',
    conditions: [
      { field: 'maritalStatus', operator: 'eq', value: 'married' },
      { field: 'taxClass', operator: 'in', value: [1, 4] },
    ],
    conclusion: 'Married couples can optimize taxes by choosing Steuerklasse III/V or IV/IV',
    priority: 5,
    metadata: {
      recommendation: 'Submit Formular "Antrag auf Steuerklassenwechsel" to your Finanzamt',
    },
  },
  {
    id: 'jobcenter-low-income',
    name: 'Jobcenter eligibility',
    conditions: [
      { field: 'netIncome', operator: 'lt', value: 1200 },
      { field: 'employmentStatus', operator: 'in', value: ['unemployed', 'part-time'] },
    ],
    conclusion: 'You may be eligible for Bürgergeld through the Jobcenter',
    priority: 8,
    metadata: {
      recommendation: 'Contact your local Jobcenter to schedule a Beratungsgespräch',
    },
  },
]);
