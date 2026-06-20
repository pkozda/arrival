import type { SystemState } from '../state/system-state-types.js';
import { listProfileMutationEvents, resolveUserContext } from '../state/profile-mutation-state.js';
import { interpretProfileInsights, type ExecutionMetadata } from '@arrival-atlas/profile-intelligence';

export function buildExecutionMetadataFromState(state: SystemState): ExecutionMetadata {
  const executionsByModuleId: ExecutionMetadata['executionsByModuleId'] = {};
  const moduleTitles = Object.fromEntries(state.modules.map((module) => [module.id, module.name]));

  for (const [moduleId, history] of Object.entries(state.executionsByModuleId)) {
    executionsByModuleId[moduleId] = history.map((entry) => ({
      moduleId,
      createdAt: new Date(entry.timestamp).toISOString(),
      moduleTitle: moduleTitles[moduleId] ?? moduleId,
    }));
  }

  return { executionsByModuleId };
}

export function buildProfileInsightsFromState(state: SystemState) {
  return interpretProfileInsights({
    userContext: resolveUserContext(state),
    mutationEvents: listProfileMutationEvents(state),
    executionMeta: buildExecutionMetadataFromState(state),
    generatedAt: state.generatedAt,
  });
}
