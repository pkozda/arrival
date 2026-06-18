import type { ModuleUIProjection } from '../ModuleUIProjection.js';
import type { ModuleSnapshotSummary, SnapshotRecommendation } from './types.js';

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function recommendationIdFor(moduleId: string, title: string, index: number): string {
  return `${moduleId}:${slugify(title)}:${index}`;
}

export function projectModuleSummary(projection: ModuleUIProjection): ModuleSnapshotSummary {
  return {
    moduleId: projection.moduleId,
    status: projection.status,
    ...(projection.summary ? { summary: projection.summary } : {}),
    recommendationCount: projection.recommendations.length,
    actionCount: projection.actions.length,
  };
}

export function projectModuleSummaries(
  projections: readonly ModuleUIProjection[]
): ModuleSnapshotSummary[] {
  return projections
    .map(projectModuleSummary)
    .sort((left, right) => left.moduleId.localeCompare(right.moduleId));
}

export function projectSnapshotRecommendations(
  projections: readonly ModuleUIProjection[]
): SnapshotRecommendation[] {
  const recommendations: SnapshotRecommendation[] = [];

  for (const projection of projections) {
    projection.recommendations.forEach((recommendation, index) => {
      recommendations.push({
        moduleId: projection.moduleId,
        recommendationId: recommendationIdFor(projection.moduleId, recommendation.title, index),
        title: recommendation.title,
        priority: recommendation.priority,
      });
    });
  }

  return recommendations.sort((left, right) => {
    const moduleDelta = left.moduleId.localeCompare(right.moduleId);
    if (moduleDelta !== 0) {
      return moduleDelta;
    }

    return left.recommendationId.localeCompare(right.recommendationId);
  });
}
