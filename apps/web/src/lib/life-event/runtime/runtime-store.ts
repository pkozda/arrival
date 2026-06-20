import type { RuntimeSessionState } from './types';

export function createRuntimeSessionState(): RuntimeSessionState {
  return {
    lastExecutedActions: [],
    moduleCompletionFlags: {},
    transientEffects: [],
  };
}

let activeSessionState: RuntimeSessionState = createRuntimeSessionState();

export function getRuntimeSessionState(): RuntimeSessionState {
  return activeSessionState;
}

export function resetRuntimeSessionState(): void {
  activeSessionState = createRuntimeSessionState();
}

export function applyRuntimeSessionUpdate(input: {
  actionId: string;
  moduleId: string;
  completed: boolean;
  effect: RuntimeSessionState['transientEffects'][number];
}): void {
  const { actionId, moduleId, completed, effect } = input;

  if (!activeSessionState.lastExecutedActions.includes(actionId)) {
    activeSessionState.lastExecutedActions.push(actionId);
  }

  if (completed) {
    activeSessionState.moduleCompletionFlags[moduleId] = true;
  }

  activeSessionState.transientEffects.push(effect);
}
