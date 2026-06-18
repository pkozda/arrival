export type { ActionItem, ActionKind, ActionPriority } from './types/ActionItem.js';
export type { ExplanationFactor, ModuleExplanation } from './types/ModuleExplanation.js';
export type {
  Recommendation,
  RecommendationPriority,
} from './types/Recommendation.js';
export type { ModuleRuntimeContext } from './types/ModuleRuntimeContext.js';
export type {
  ModuleCapability,
  ModuleCapabilities,
} from './types/ModuleCapabilities.js';
export type {
  MrcModuleMetadata,
  MrcModuleMetadata as ModuleMetadata,
  ModuleRuntimeContractVersion,
} from './types/ModuleMetadata.js';
export type {
  ModuleResult,
  ModuleResultMeta,
  ModuleResultStatus,
} from './types/ModuleResult.js';
export {
  toModuleRuntimeContext,
  type ToModuleRuntimeContextParams,
} from './adapters/toModuleRuntimeContext.js';
export {
  wrapLegacyExecutionResult,
  type WrapLegacyExecutionResultParams,
} from './adapters/wrapLegacyExecutionResult.js';
export {
  legacyDomainToModuleResult,
  type LegacyDomainToModuleResultParams,
} from './adapters/legacyDomainToModuleResult.js';
export {
  getLegacyDomainResult,
  resolveExecutionResult,
  type StoredExecutionLike,
} from './adapters/resolveExecutionResult.js';
export { isMrcEnvelopeEnabled } from './config/mrc-envelope.js';
export { isMrcExplanationEnabled } from './config/mrc-explanation.js';
export { isMrcActionsEnabled } from './config/mrc-actions.js';
export { normalizeRecommendations } from './normalizers/normalizeRecommendations.js';
export { generateModuleExplanation } from './normalizers/generateModuleExplanation.js';
export { resolveRecommendations, resolveActions } from './normalizers/normalizer-resolver.js';
export {
  enrichModuleResultSemantics,
  type SemanticEnrichmentContext,
} from './enrichment/enrichModuleResult.js';
export { buildModuleResultEnvelope } from './enrichment/buildModuleResultEnvelope.js';
export {
  enrichModuleResultActions,
  type ActionEnrichmentContext,
} from './enrichment/enrichModuleResultActions.js';
export { sealModuleResult } from './enrichment/sealModuleResult.js';
export { buildActionItems, extractActionSources } from './normalizers/actions/buildActionItems.js';
export { mapActionKind } from './normalizers/actions/action-sources.js';
export {
  bootstrapGovernedRuntime,
  bindNormalizers,
  buildGovernedRegistryFromState,
  freezeGovernanceKernel,
  registerModules,
  type GovernedRuntimeBootstrap,
} from './governance/bootstrapGovernedRuntime.js';
export { executeGovernedModule } from './governance/executeGovernedModule.js';
export { authorizeExecution } from './governance/authorizeExecution.js';
export {
  resolveNormalizers,
  normalizeRecommendationsFromGovernance,
  normalizeActionsFromGovernance,
} from './governance/resolveNormalizers.js';
export {
  buildGovernedRegistry,
  type GovernedModuleRegistry,
  type GovernedModuleRegistrySnapshot,
  type ModuleRuntimeCapabilities,
} from './governance/GovernedModuleRegistry.js';
export { validateContractIntegrity } from './governance/validateContractIntegrity.js';
export type { PolicyDecision, GovernanceExecutionContext } from './governance/types.js';
export { bootstrapMrcContractRegistry } from './registry/bootstrap-mrc-contract-registry.js';
export { validateModuleRegistration } from './registry/validate-module-registration.js';
export {
  validateActionItem,
  validateRecommendation,
} from './registry/validate-contract-shapes.js';
export type {
  GuardResult,
  ModuleContractSpec,
  RegisteredModuleContract,
  ValidationResult,
} from './registry/contract-types.js';
export type { ModuleRegistryCapabilitiesExtension } from './registry/capabilities-extension.js';
export {
  ModuleRuntime,
  type ExecuteModuleParams,
  type ModuleRuntimeDeps,
  type ModuleRuntimeExecuteOutcome,
} from './runtime/ModuleRuntime.js';
