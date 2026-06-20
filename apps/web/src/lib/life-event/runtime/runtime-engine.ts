import { generateCrossModuleSignals } from './cross-module-signal-engine';
import { mergeRuntimeEffects, resolveExecutionEffect } from './effect-resolver';
import {
  applyRuntimeSessionUpdate,
  getRuntimeSessionState,
  resetRuntimeSessionState,
} from './runtime-store';
import { invokeRuntimeHandler, resolveRuntimeHandler } from './runtime-registry';
import type { ModuleRuntimeEventV1, RuntimeActionEffectV1 } from './types';

function handlerEventType(
  event: ModuleRuntimeEventV1
): 'onActionExecuted' | 'onModuleCompleted' | 'onModuleFailed' | 'onStateChange' {
  switch (event.type) {
    case 'module_completed':
      return 'onModuleCompleted';
    case 'module_failed':
      return 'onModuleFailed';
    case 'state_change':
      return 'onStateChange';
    case 'action_executed':
    default:
      return 'onActionExecuted';
  }
}

export function processModuleRuntimeEvent(event: ModuleRuntimeEventV1): RuntimeActionEffectV1 {
  const session = getRuntimeSessionState();
  const baseEffect = resolveExecutionEffect(event);
  const crossModuleSignals = generateCrossModuleSignals(event);

  const handler = resolveRuntimeHandler(event.execution.moduleId);
  const handlerOverlay = handler
    ? invokeRuntimeHandler(handler, handlerEventType(event), { event, session })
    : {};

  const effect = mergeRuntimeEffects(baseEffect, handlerOverlay, {
    stateSignals: crossModuleSignals,
  });

  applyRuntimeSessionUpdate({
    actionId: event.execution.actionId,
    moduleId: event.execution.moduleId,
    completed: event.execution.status === 'success',
    effect,
  });

  return effect;
}

export { resetRuntimeSessionState, getRuntimeSessionState };
