import type { ExecutionSurfaceV1, ExecutionState } from './types';

export function buildExecutionStateLookup(
  execution: ExecutionSurfaceV1
): Map<string, ExecutionState> {
  const lookup = new Map<string, ExecutionState>();

  if (execution.primary) {
    lookup.set(execution.primary.id, execution.primary.executionState);
  }

  for (const action of execution.secondary) {
    lookup.set(action.id, action.executionState);
  }

  for (const action of execution.contextual) {
    lookup.set(action.id, action.executionState);
  }

  for (const action of execution.blocked) {
    lookup.set(action.id, action.executionState);
  }

  return lookup;
}

export function isExecutionDisabled(
  lookup: Map<string, ExecutionState>,
  nodeId: string
): boolean {
  return lookup.get(nodeId) === 'disabled';
}
