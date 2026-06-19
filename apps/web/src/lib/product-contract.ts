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
  NormalizedCapabilities,
  PublicModuleContract,
  PublicModuleContractMetadata,
  PublicModuleContractStatus,
  SchemaField,
  SchemaFieldType,
  SnapshotRecommendation,
  SupportedLanguage,
  ThemePreference,
  UiSnapshot,
  UiSnapshotFallback,
  UiSnapshotProfile,
  UiSnapshotProjection,
  UiSnapshotSession,
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
} from '@arrival-atlas/product-contract';

export type ModuleExecuteResponse = ModuleExecuteProjectionResponse;
