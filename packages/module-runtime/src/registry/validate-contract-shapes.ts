import type { ActionItem, ActionKind, ActionPriority } from '../types/ActionItem.js';
import type { ModuleExplanation } from '../types/ModuleExplanation.js';
import type { Recommendation, RecommendationPriority } from '../types/Recommendation.js';

const ACTION_KINDS = new Set<ActionKind>([
  'apply',
  'contact',
  'collect-documents',
  'schedule',
  'custom',
]);

const ACTION_PRIORITIES = new Set<ActionPriority>(['high', 'medium', 'low']);
const RECOMMENDATION_PRIORITIES = new Set<RecommendationPriority>([
  'critical',
  'high',
  'medium',
  'low',
]);
const CONFIDENCE_LEVELS = new Set<ModuleExplanation['confidence']>([
  'high',
  'medium',
  'low',
]);

const DETERMINISTIC_ACTION_ID =
  /^[a-z0-9-]+:[a-zA-Z][a-zA-Z0-9]*:[a-zA-Z0-9._-]+$/;

export function validateActionItem(value: unknown): string[] {
  const errors: string[] = [];

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return ['ActionItem must be an object'];
  }

  const item = value as Record<string, unknown>;

  if (typeof item.id !== 'string' || item.id.length === 0) {
    errors.push('ActionItem.id must be a non-empty string');
  } else if (!DETERMINISTIC_ACTION_ID.test(item.id)) {
    errors.push('ActionItem.id must use deterministic module:record:sourceId format');
  }

  if (typeof item.kind !== 'string' || !ACTION_KINDS.has(item.kind as ActionKind)) {
    errors.push('ActionItem.kind must be a supported ActionKind');
  }

  if (typeof item.title !== 'string' || item.title.length === 0) {
    errors.push('ActionItem.title must be a non-empty string');
  }

  if (typeof item.description !== 'string' || item.description.length === 0) {
    errors.push('ActionItem.description must be a non-empty string');
  }

  if (
    typeof item.priority !== 'string' ||
    !ACTION_PRIORITIES.has(item.priority as ActionPriority)
  ) {
    errors.push('ActionItem.priority must be high, medium, or low');
  }

  if (item.target !== undefined && typeof item.target !== 'string') {
    errors.push('ActionItem.target must be a string when present');
  }

  if (item.recommendationId !== undefined && typeof item.recommendationId !== 'string') {
    errors.push('ActionItem.recommendationId must be a string when present');
  }

  return errors;
}

function validateExplanation(value: unknown): string[] {
  const errors: string[] = [];

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return ['ModuleExplanation must be an object'];
  }

  const explanation = value as Record<string, unknown>;

  if (typeof explanation.summary !== 'string' || explanation.summary.length === 0) {
    errors.push('ModuleExplanation.summary must be a non-empty string');
  }

  if (
    typeof explanation.confidence !== 'string' ||
    !CONFIDENCE_LEVELS.has(explanation.confidence as ModuleExplanation['confidence'])
  ) {
    errors.push('ModuleExplanation.confidence must be high, medium, or low');
  }

  if (!Array.isArray(explanation.factors)) {
    errors.push('ModuleExplanation.factors must be an array');
  }

  return errors;
}

export function validateRecommendation(value: unknown): string[] {
  const errors: string[] = [];

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return ['Recommendation must be an object'];
  }

  const recommendation = value as Record<string, unknown>;

  if (typeof recommendation.id !== 'string' || recommendation.id.length === 0) {
    errors.push('Recommendation.id must be a non-empty string');
  }

  if (typeof recommendation.title !== 'string' || recommendation.title.length === 0) {
    errors.push('Recommendation.title must be a non-empty string');
  }

  if (
    typeof recommendation.description !== 'string' ||
    recommendation.description.length === 0
  ) {
    errors.push('Recommendation.description must be a non-empty string');
  }

  if (
    typeof recommendation.priority !== 'string' ||
    !RECOMMENDATION_PRIORITIES.has(recommendation.priority as RecommendationPriority)
  ) {
    errors.push('Recommendation.priority must be critical, high, medium, or low');
  }

  errors.push(...validateExplanation(recommendation.explanation));

  if (recommendation.scopeRef !== undefined && typeof recommendation.scopeRef !== 'string') {
    errors.push('Recommendation.scopeRef must be a string when present');
  }

  return errors;
}

export function validateActionItemArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return ['Action normalizer must return an array'];
  }

  const errors: string[] = [];
  value.forEach((entry, index) => {
    const itemErrors = validateActionItem(entry);
    itemErrors.forEach((error) => {
      errors.push(`actions[${index}]: ${error}`);
    });
  });

  return errors;
}

export function validateRecommendationArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return ['Recommendation normalizer must return an array'];
  }

  const errors: string[] = [];
  value.forEach((entry, index) => {
    const itemErrors = validateRecommendation(entry);
    itemErrors.forEach((error) => {
      errors.push(`recommendations[${index}]: ${error}`);
    });
  });

  return errors;
}

export function isValidActionItem(value: unknown): value is ActionItem {
  return validateActionItem(value).length === 0;
}

export function isValidRecommendation(value: unknown): value is Recommendation {
  return validateRecommendation(value).length === 0;
}
