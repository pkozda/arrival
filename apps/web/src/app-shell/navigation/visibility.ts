import type {
  EconomicActionSetV1,
  EconomicEvaluationV1,
  EconomicPresentationV1,
  EconomicStateId,
} from '@/lib/product-contract';
import {
  ECONOMIC_STATE_TRIGGER_CODE,
  matchesModuleTriggers,
  ECONOMIC_REALITY_MODULE_CATALOG_ENTRY,
  type ModuleTriggerContextV1,
} from '@/lib/product-contract';

export function buildEconomicRealityTriggerContext(input: {
  evaluation?: EconomicEvaluationV1;
  presentation?: EconomicPresentationV1;
  actionSet?: EconomicActionSetV1;
  lifeStateId?: string;
  lifeEventType?: string;
}): ModuleTriggerContextV1 {
  const economicStateCode = input.evaluation
    ? ECONOMIC_STATE_TRIGGER_CODE[input.evaluation.economicState as EconomicStateId]
    : undefined;

  const systemIntents = input.actionSet?.actions
    .map((action) => action.payload.systemIntent)
    .filter((intent): intent is NonNullable<typeof intent> => intent !== undefined);

  return {
    economicStateCode,
    lifeStateId: input.lifeStateId,
    lifeEventType: input.lifeEventType,
    systemIntents,
  };
}

export function shouldShowEconomicRealitySurface(input: {
  evaluation?: EconomicEvaluationV1;
  presentation?: EconomicPresentationV1;
  actionSet?: EconomicActionSetV1;
  lifeStateId?: string;
  lifeEventType?: string;
}): boolean {
  const context = buildEconomicRealityTriggerContext(input);
  return matchesModuleTriggers(ECONOMIC_REALITY_MODULE_CATALOG_ENTRY, context);
}
