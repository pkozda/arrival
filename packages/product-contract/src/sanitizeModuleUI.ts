import type { ActionItem } from '@arrival-atlas/module-runtime';
import type { ModuleExplanation, ExplanationFactor } from '@arrival-atlas/module-runtime';
import type { Recommendation } from '@arrival-atlas/module-runtime';
import type {
  SanitizedAction,
  SanitizedExplanation,
  SanitizedRecommendation,
} from './ModuleUIProjection.js';

const FORBIDDEN_FACTOR_SOURCES = new Set(['trace', 'runtime', 'governance']);

export function sanitizeRecommendation(
  recommendation: Recommendation
): SanitizedRecommendation {
  return {
    title: recommendation.title,
    description: recommendation.description,
    priority: recommendation.priority,
    reason: recommendation.explanation.summary,
  };
}

export function sanitizeAction(action: ActionItem): SanitizedAction {
  return {
    label: action.title,
    description: action.description,
    priority: action.priority,
    kind: action.kind,
  };
}

function formatFactorReason(factor: ExplanationFactor): string {
  return `${factor.label}: ${String(factor.value)}`;
}

export function sanitizeExplanation(explanation: ModuleExplanation): SanitizedExplanation {
  const reasons = explanation.factors
    .filter((factor) => !FORBIDDEN_FACTOR_SOURCES.has(factor.source))
    .map(formatFactorReason);

  return {
    summary: explanation.summary,
    confidence: explanation.confidence,
    reasons,
  };
}

export function sanitizeRecommendations(
  recommendations: readonly Recommendation[] | undefined
): readonly SanitizedRecommendation[] {
  if (!recommendations) {
    return [];
  }

  return recommendations.map(sanitizeRecommendation);
}

export function sanitizeActions(
  actions: readonly ActionItem[] | undefined
): readonly SanitizedAction[] {
  if (!actions) {
    return [];
  }

  return actions.map(sanitizeAction);
}
