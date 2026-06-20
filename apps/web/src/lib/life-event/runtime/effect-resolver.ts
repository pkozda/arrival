import type {
  ModuleExecutionResultV1,
  ModuleRuntimeEventV1,
  ModuleStateMutationV1,
  RuntimeActionEffectV1,
} from './types';

function emptyEffect(): RuntimeActionEffectV1 {
  return {
    completedActions: [],
    failedActions: [],
    stateSignals: [],
    moduleMutations: [],
  };
}

function mutationForStatus(
  execution: ModuleExecutionResultV1
): ModuleStateMutationV1 | null {
  switch (execution.status) {
    case 'success':
      return {
        moduleId: execution.moduleId,
        mutationType: 'completed',
        actionId: execution.actionId,
      };
    case 'failed':
      return {
        moduleId: execution.moduleId,
        mutationType: 'failed',
        actionId: execution.actionId,
      };
    case 'partial':
      return {
        moduleId: execution.moduleId,
        mutationType: 'retry_required',
        actionId: execution.actionId,
      };
    default:
      return null;
  }
}

export function resolveExecutionEffect(event: ModuleRuntimeEventV1): RuntimeActionEffectV1 {
  const { execution } = event;
  const effect = emptyEffect();
  const mutation = mutationForStatus(execution);

  if (execution.status === 'success') {
    effect.completedActions.push(execution.actionId);
  } else if (execution.status === 'failed') {
    effect.failedActions.push(execution.actionId);
  } else {
    effect.completedActions.push(execution.actionId);
    effect.failedActions.push(execution.actionId);
  }

  if (mutation) {
    effect.moduleMutations.push(mutation);
  }

  if (execution.status === 'partial' && mutation) {
    effect.moduleMutations.push({
      moduleId: execution.moduleId,
      mutationType: 'partial',
      actionId: execution.actionId,
    });
  }

  return effect;
}

export function mergeRuntimeEffects(
  base: RuntimeActionEffectV1,
  ...overlays: Array<Partial<RuntimeActionEffectV1>>
): RuntimeActionEffectV1 {
  const merged: RuntimeActionEffectV1 = {
    completedActions: [...base.completedActions],
    failedActions: [...base.failedActions],
    stateSignals: [...base.stateSignals],
    moduleMutations: [...base.moduleMutations],
  };

  for (const overlay of overlays) {
    if (overlay.completedActions) {
      for (const actionId of overlay.completedActions) {
        if (!merged.completedActions.includes(actionId)) {
          merged.completedActions.push(actionId);
        }
      }
    }

    if (overlay.failedActions) {
      for (const actionId of overlay.failedActions) {
        if (!merged.failedActions.includes(actionId)) {
          merged.failedActions.push(actionId);
        }
      }
    }

    if (overlay.stateSignals) {
      merged.stateSignals.push(...overlay.stateSignals);
    }

    if (overlay.moduleMutations) {
      merged.moduleMutations.push(...overlay.moduleMutations);
    }
  }

  return merged;
}
