export type {
  ModuleUIProjection,
  ModuleExecuteMeta,
  ModuleExecuteProjectionResponse,
  SanitizedAction,
  SanitizedActionKind,
  SanitizedActionPriority,
  SanitizedExplanation,
  SanitizedRecommendation,
  SanitizedRecommendationPriority,
} from './ModuleUIProjection.js';
export type { JsonSchema } from './JsonSchema.js';
export type { ContractSnapshot } from './ContractSnapshot.js';
export type {
  PublicModuleContract,
  PublicModuleContractMetadata,
  PublicModuleContractStatus,
} from './PublicModuleContract.js';
export type { NormalizedCapabilities } from './NormalizedCapabilities.js';
export { mapModuleStatus, type ModuleStatusInput } from './mapModuleStatus.js';
export { normalizeCapabilities } from './normalizeCapabilities.js';
export { resolveProductMetadata } from './moduleProductMetadata.js';
export {
  sanitizeAction,
  sanitizeActions,
  sanitizeExplanation,
  sanitizeRecommendation,
  sanitizeRecommendations,
} from './sanitizeModuleUI.js';
export { projectModuleUI } from './projectModuleUI.js';
export { buildContractSnapshot } from './buildContractSnapshot.js';
export {
  createContractSnapshotStore,
  type ContractSnapshotStore,
} from './ContractSnapshotStore.js';
export { bootstrapProductContractLayer } from './bootstrapProductContractLayer.js';
export { convertZodToJsonSchema } from './zodToJsonSchema.js';
export {
  projectModuleSchema,
  projectModuleCapabilities,
  type ModuleSchemaProjection,
} from './projectContractSnapshot.js';
export {
  projectPublicContract,
  projectPublicModuleContract,
  type ProjectPublicContractOptions,
} from './projectPublicContract.js';
export type {
  ExplanationFactor,
  ExplanationFactorType,
  ExplanationConfidence,
  ModuleExplanationView,
} from './ModuleExplanationView.js';
export {
  buildExplanationView,
  mapExplanationFactors,
  mapRecommendationReasons,
  mapActionReasons,
  aggregateExplanationConfidence,
} from './reason-mapping/index.js';
export type {
  ExecutionSnapshot,
  ActionCard,
  SnapshotRecommendation,
  ModuleSnapshotSummary,
  UiSnapshotProjection,
  SnapshotExecutionInput,
} from './snapshot/types.js';
export { projectExecutionSnapshot } from './snapshot/projectExecutionSnapshot.js';
export { projectActionCards } from './snapshot/projectActionCards.js';
export {
  projectModuleSummary,
  projectModuleSummaries,
  projectSnapshotRecommendations,
} from './snapshot/projectModuleSummary.js';
export { buildUiSnapshotProjection } from './snapshot/buildUiSnapshotProjection.js';
export {
  SupportedLanguageSchema,
  SUPPORTED_LANGUAGES,
  ThemePreferenceSchema,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  type SupportedLanguage,
  type ThemePreference,
  type UiSnapshot,
  type UiSnapshotSession,
  type UiSnapshotProfile,
  type UiSnapshotFallback,
  type ModuleCatalogResponse,
} from './ui/index.js';
export {
  extractSchemaFields,
  deriveDefaultValues,
  mergeProfileIntoDefaults,
  type SchemaField,
  type SchemaFieldType,
} from './schema/deriveSchemaDefaults.js';
