export { buildLifeEventPlan, LIFE_EVENT_MODULE_VERSION } from './build-life-event-plan.js';
export type { BuildLifeEventPlanInput } from './build-life-event-plan.js';
export { classifyLifeState } from './classify-life-state.js';
export { detectSecondaryConditions } from './detect-secondary-conditions.js';
export { computeSituationSignals, isSatisfactionMet } from './signals.js';
export type { SituationSignals, SatisfactionKey } from './signals.js';
export { getGraphForState, getAllGraphs, GRAPH_CATALOG_V1 } from './graph/catalog.js';
export { resolveGraph, comparePlanNodes } from './graph/resolve.js';
