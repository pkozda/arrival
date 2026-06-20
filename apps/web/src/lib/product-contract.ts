import type { ModuleExecuteProjectionResponse } from '@arrival-atlas/product-contract';

export type {
  ActionCard,
  ExecutionSnapshot,
  ExplanationFactor,
  JsonSchema,
  ModuleCatalogResponse,
  ModuleExecuteMeta,
  ModuleExecuteProjectionResponse,
  ModuleExplanationView,
  ModuleSchemaProjection,
  ModuleSnapshotSummary,
  ModuleUIProjection,
  MutationRequest,
  NormalizedCapabilities,
  PublicModuleContract,
  PublicModuleContractMetadata,
  PublicModuleContractStatus,
  SchemaField,
  SchemaFieldType,
  SnapshotRecommendation,
  SanitizedRecommendation,
  SupportedLanguage,
  ThemePreference,
  UiSnapshot,
  UiSnapshotFallback,
  UiSnapshotProjection,
  UiSnapshotSession,
  UserContextV1,
  UserProfileViewV1,
} from '@arrival-atlas/product-contract';

export {
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  SUPPORTED_LANGUAGES,
  SupportedLanguageSchema,
  ThemePreferenceSchema,
  deriveDefaultValues,
  extractSchemaFields,
  mergeProfileIntoDefaults,
  parseUserContextV1,
} from '@arrival-atlas/product-contract';

export type ModuleExecuteResponse = ModuleExecuteProjectionResponse;
