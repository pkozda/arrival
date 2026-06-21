export { fetchEconomicPlan } from './client';
export {
  EMPTY_ECONOMIC_REALITY_CLIENT_STATE,
  type EconomicRealityClientStateV1,
} from './economic-reality-client-state';
export { hydrateEconomicPlan } from './hydrateEconomicPlan';
export { reconcileEconomicPlanState } from './reconcileEconomicPlan';
export {
  buildEconomicPlanCacheKey,
  clearEconomicPlanCache,
  readEconomicPlanCache,
  writeEconomicPlanCache,
} from './cache';
export {
  EconomicRealityPlanFetchError,
  isEconomicRealityPlanErrorCode,
  type EconomicRealityClientErrorCode,
} from './errors';
export {
  adaptPresentationToUi,
  mapSectionTypeToPanel,
  mapUiTypeToCard,
  type EconomicUiCardComponent,
  type EconomicUiCardProjection,
  type EconomicUiPanelComponent,
  type EconomicUiSectionProjection,
} from './ui-adapter';
export { useEconomicRealityPlan, EconomicRealityPlanProvider } from './useEconomicRealityPlan';
export { resolveEconomicCopy } from './copy';
export { useEconomicCopy } from './useEconomicCopy';
export {
  setEconomicActionContext,
  readEconomicActionContext,
  economicActionContextRef,
  bindEconomicActionContext,
  clearEconomicActionContext,
  type EconomicActionExecutionContext,
} from './action-context';
export {
  executeEconomicAction,
  EconomicActionExecutionError,
} from './action-executor';
