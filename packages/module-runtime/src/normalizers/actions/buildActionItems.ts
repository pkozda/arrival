import type { ActionItem } from '../../types/ActionItem.js';
import type { Recommendation } from '../../types/Recommendation.js';
import {
  compareActionPriority,
  extractBenefitsSimulatorActionSources,
  extractFinancialRealityActionSources,
  mapActionKind,
  normalizeActionTitle,
  resolveActionPriority,
  type ActionSource,
} from './action-sources.js';

export type BuildActionItemsParams = {
  moduleId: string;
  payload: unknown;
  recommendations?: readonly Recommendation[];
};

export function extractActionSources(
  moduleId: string,
  payload: unknown
): ActionSource[] {
  switch (moduleId) {
    case 'financial-reality':
      return extractFinancialRealityActionSources(moduleId, payload);
    case 'benefits-simulator':
      return extractBenefitsSimulatorActionSources(moduleId, payload);
    default:
      return [];
  }
}

function toActionItem(
  source: ActionSource,
  recommendations: readonly Recommendation[]
): ActionItem {
  const priority = resolveActionPriority(source.priority);
  const title = source.title ?? normalizeActionTitle(source.rawAction);
  const description = source.description ?? source.rawAction;
  const recommendationId = recommendations.some((entry) => entry.id === source.sourceId)
    ? source.sourceId
    : undefined;

  return {
    id: `${source.sourceModule}:${source.sourceRecord}:${source.sourceId}`,
    kind: mapActionKind(source.rawAction),
    title,
    description,
    priority,
    ...(source.target !== undefined ? { target: source.target } : {}),
    ...(recommendationId !== undefined ? { recommendationId } : {}),
  };
}

function deduplicationKey(action: ActionItem, sourceId: string): string {
  return `${action.kind}:${action.title}:${action.description}:${sourceId}`;
}

export function buildActionItems(params: BuildActionItemsParams): ActionItem[] {
  const sources = extractActionSources(params.moduleId, params.payload);
  const recommendations = params.recommendations ?? [];
  const deduped = new Map<string, { action: ActionItem; sourceId: string }>();

  for (const source of sources) {
    const action = toActionItem(source, recommendations);
    const key = deduplicationKey(action, source.sourceId);
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, { action, sourceId: source.sourceId });
      continue;
    }

    if (compareActionPriority(action.priority, existing.action.priority) > 0) {
      deduped.set(key, { action, sourceId: source.sourceId });
    }
  }

  return [...deduped.values()]
    .map((entry) => entry.action)
    .sort((left, right) => {
      const priorityDelta = compareActionPriority(right.priority, left.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return left.id.localeCompare(right.id);
    });
}
