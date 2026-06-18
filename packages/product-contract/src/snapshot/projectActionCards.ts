import type { ModuleUIProjection, SanitizedAction, SanitizedActionPriority } from '../ModuleUIProjection.js';
import type { ActionCard } from './types.js';

const PRIORITY_RANK: Record<SanitizedActionPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function actionIdFor(moduleId: string, action: SanitizedAction, index: number): string {
  return `${moduleId}:${action.kind}:${slugify(action.label)}:${index}`;
}

export function projectActionCards(projections: readonly ModuleUIProjection[]): ActionCard[] {
  const cards: ActionCard[] = [];

  for (const projection of projections) {
    projection.actions.forEach((action, index) => {
      cards.push({
        moduleId: projection.moduleId,
        actionId: actionIdFor(projection.moduleId, action, index),
        label: action.label,
        description: action.description,
        priority: action.priority,
        kind: action.kind,
      });
    });
  }

  return cards.sort((left, right) => {
    const priorityDelta = PRIORITY_RANK[right.priority] - PRIORITY_RANK[left.priority];
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const moduleDelta = left.moduleId.localeCompare(right.moduleId);
    if (moduleDelta !== 0) {
      return moduleDelta;
    }

    return left.actionId.localeCompare(right.actionId);
  });
}
