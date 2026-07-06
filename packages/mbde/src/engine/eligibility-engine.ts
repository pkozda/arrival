import type { Condition, RuleExpression } from '../types/rules.js';

function resolveField(data: Record<string, unknown>, field: string): unknown {
  if (field in data) {
    return data[field];
  }

  const parts = field.split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function evaluateCondition(data: Record<string, unknown>, condition: Condition): boolean {
  const fieldValue = resolveField(data, condition.field);

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
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    case 'contains':
      if (Array.isArray(fieldValue)) {
        return Array.isArray(condition.value)
          ? condition.value.every((v) => fieldValue.includes(v))
          : fieldValue.includes(condition.value);
      }
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return fieldValue.toLowerCase().includes(condition.value.toLowerCase());
      }
      return false;
    default:
      return false;
  }
}

export type EligibilityEvaluation = {
  eligible: boolean;
  confidence: number;
  missingFields: string[];
  partialMatch: boolean;
};

function collectConditionFields(expression: RuleExpression, acc: Set<string>): void {
  if (expression.type === 'condition') {
    acc.add(expression.condition.field);
    return;
  }
  if (expression.type === 'not') {
    collectConditionFields(expression.rule, acc);
    return;
  }
  expression.rules.forEach((rule) => collectConditionFields(rule, acc));
}

function countConditions(expression: RuleExpression): number {
  if (expression.type === 'condition') {
    return 1;
  }
  if (expression.type === 'not') {
    return countConditions(expression.rule);
  }
  return expression.rules.reduce((sum, rule) => sum + countConditions(rule), 0);
}

function countMatchedConditions(data: Record<string, unknown>, expression: RuleExpression): number {
  if (expression.type === 'condition') {
    return evaluateCondition(data, expression.condition) ? 1 : 0;
  }
  if (expression.type === 'not') {
    return evaluateEligibility(expression.rule, data).eligible ? 0 : 1;
  }
  if (expression.type === 'and') {
    return expression.rules.reduce(
      (sum, rule) => sum + countMatchedConditions(data, rule),
      0
    );
  }
  return expression.rules.reduce(
    (sum, rule) => sum + countMatchedConditions(data, rule),
    0
  );
}

export function evaluateEligibility(
  expression: RuleExpression,
  data: Record<string, unknown>
): EligibilityEvaluation {
  const eligible = evaluateExpression(expression, data);
  const allFields = new Set<string>();
  collectConditionFields(expression, allFields);

  const missingFields = [...allFields].filter((field) => {
    const value = resolveField(data, field);
    return value === undefined || value === null || value === '';
  });

  const total = countConditions(expression);
  const matched = countMatchedConditions(data, expression);
  const coverage = total === 0 ? 1 : matched / total;
  const missingPenalty = missingFields.length > 0 ? Math.min(0.4, missingFields.length * 0.08) : 0;
  const confidence = eligible
    ? Math.max(0.35, coverage - missingPenalty)
    : Math.max(0, coverage * 0.5 - missingPenalty);

  return {
    eligible,
    confidence: Number(confidence.toFixed(3)),
    missingFields,
    partialMatch: !eligible && confidence >= 0.45,
  };
}

function evaluateExpression(expression: RuleExpression, data: Record<string, unknown>): boolean {
  switch (expression.type) {
    case 'condition':
      return evaluateCondition(data, expression.condition);
    case 'and':
      return expression.rules.every((rule) => evaluateExpression(rule, data));
    case 'or':
      return expression.rules.some((rule) => evaluateExpression(rule, data));
    case 'not':
      return !evaluateExpression(expression.rule, data);
    default:
      return false;
  }
}
