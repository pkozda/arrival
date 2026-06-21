import type { EconomicActionSetV1, OrderingStrategy } from '@arrival-atlas/product-contract';
import { enrichOpenModulePayload } from './open-module-resolver.js';

export function enrichEconomicOpenModuleActions(
  actionSet: EconomicActionSetV1,
  strategy: OrderingStrategy
): EconomicActionSetV1 {
  return {
    ...actionSet,
    actions: actionSet.actions.map((action) => {
      if (action.type !== 'open_module') {
        return action;
      }

      const payload = enrichOpenModulePayload({
        moduleId: action.payload.moduleId,
        entrypoint: action.payload.entrypoint,
        href: action.payload.href,
        strategy,
      });

      return {
        ...action,
        payload: {
          ...action.payload,
          ...payload,
        },
      };
    }),
  };
}
