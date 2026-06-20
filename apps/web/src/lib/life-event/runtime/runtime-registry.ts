import type { ModuleId, ModuleRuntimeHandler, PartialRuntimeEffect } from './types';

export const runtimeHandlers: Record<ModuleId, ModuleRuntimeHandler> = {
  'financial-reality': {
    onModuleCompleted: () => ({
      stateSignals: [],
    }),
    onActionExecuted: ({ event }) => {
      if (event.execution.metadata?.domain === 'housing' && event.execution.status === 'success') {
        return {
          moduleMutations: [
            {
              moduleId: 'financial-reality',
              mutationType: 'completed',
              actionId: event.execution.actionId,
            },
          ],
        };
      }
      return {};
    },
  },
  'healthcare-navigation': {
    onModuleFailed: () => ({
      failedActions: [],
    }),
  },
  'benefits-simulator': {
    onModuleCompleted: () => ({}),
  },
  'life-event': {
    onActionExecuted: ({ event }) => {
      if (event.execution.status === 'success') {
        return {
          completedActions: [event.execution.actionId],
        };
      }
      return {};
    },
  },
};

export function resolveRuntimeHandler(moduleId: ModuleId): ModuleRuntimeHandler | undefined {
  return runtimeHandlers[moduleId];
}

export function invokeRuntimeHandler(
  handler: ModuleRuntimeHandler,
  eventType: keyof ModuleRuntimeHandler,
  context: Parameters<NonNullable<ModuleRuntimeHandler['onActionExecuted']>>[0]
): PartialRuntimeEffect {
  const callback = handler[eventType];
  return callback ? callback(context) : {};
}
