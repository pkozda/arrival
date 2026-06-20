/**
 * User-facing label normalization (UX Contract v1 / Phase 3B).
 * Maps internal enums and field names to plain language.
 */

const FIELD_LABELS: Record<string, string> = {
  grossIncome: 'Gross monthly income',
  grossMonthlyIncome: 'Gross monthly income',
  taxClass: 'Tax class',
  churchTax: 'Church tax',
  householdSize: 'Household size',
  monthlyRent: 'Monthly rent',
  monthlyColdRent: 'Monthly rent (cold)',
  employmentStatus: 'Employment status',
  maritalStatus: 'Marital status',
  proposedGrossIncome: 'Proposed gross income',
  bundesland: 'Federal state',
  preferredLanguage: 'Preferred language',
};

const ENUM_VALUE_LABELS: Record<string, string> = {
  employed: 'Employed full-time',
  'self-employed': 'Self-employed',
  unemployed: 'Unemployed',
  'part-time': 'Part-time employed',
  student: 'Student',
  single: 'Single',
  married: 'Married',
  divorced: 'Divorced',
  widowed: 'Widowed',
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Lower priority',
  critical: 'Critical',
  navigate: 'Next step',
  informational: 'Information',
  reminder: 'Reminder',
};

export function humanizeFieldName(name: string): string {
  if (FIELD_LABELS[name]) {
    return FIELD_LABELS[name];
  }

  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

export function humanizeEnumValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const key = String(value);
  return ENUM_VALUE_LABELS[key] ?? humanizeFieldName(key);
}

export function humanizePriority(priority: string): string {
  return ENUM_VALUE_LABELS[priority] ?? humanizeFieldName(priority);
}

export function humanizeConfidence(confidence: string): string {
  switch (confidence) {
    case 'high':
      return 'High confidence';
    case 'medium':
      return 'Moderate confidence';
    case 'low':
      return 'Lower confidence';
    default:
      return humanizeFieldName(confidence);
  }
}

export function humanizeActionKind(kind: string): string {
  return ENUM_VALUE_LABELS[kind] ?? 'Suggested step';
}

export function explanationEntryTitle(
  because: Array<{ label: string }>,
  fallback: string
): string {
  const first = because.find((factor) => factor.label.trim().length > 0);
  return first?.label ?? fallback;
}
