import type { ModuleUIProjection } from '../ModuleUIProjection.js';
import { projectActionCards } from './projectActionCards.js';
import { projectExecutionSnapshot } from './projectExecutionSnapshot.js';
import {
  projectModuleSummaries,
  projectSnapshotRecommendations,
} from './projectModuleSummary.js';
import type { SnapshotExecutionInput, UiSnapshotProjection } from './types.js';

function hasProjection(
  entry: SnapshotExecutionInput
): entry is SnapshotExecutionInput & { projection: ModuleUIProjection } {
  return entry.projection !== undefined;
}

export function buildUiSnapshotProjection(
  storedExecutions: readonly SnapshotExecutionInput[]
): UiSnapshotProjection {
  const withProjection = storedExecutions.filter(hasProjection);

  const executions = withProjection
    .map(projectExecutionSnapshot)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  const projections = withProjection.map((entry) => entry.projection);

  return {
    executions,
    actionCards: projectActionCards(projections),
    recommendations: projectSnapshotRecommendations(projections),
    summaries: projectModuleSummaries(projections),
  };
}
