export {
  resolveCrossModuleLink,
  resolveSystemIntentModuleOpenAction,
  suggestModulesForLifeContext,
  listCatalogBackedModuleRoutes,
  type CrossModuleLinkSource,
  type CrossModuleLinkTarget,
} from './catalog-routing.js';
export { mapEventsToFeedbackSignals } from './feedback-mapper.js';
export {
  deriveLifeEventFeedbackHints,
  type LifeEventFeedbackHintV1,
  type LifeEventFeedbackHintType,
} from './cross-module-feedback.js';
