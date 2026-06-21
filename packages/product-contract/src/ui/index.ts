export {
  SupportedLanguageSchema,
  SUPPORTED_LANGUAGES,
  ThemePreferenceSchema,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  type SupportedLanguage,
  type ThemePreference,
} from '@arrival-atlas/ui-contract';
export type {
  UiSnapshot,
  UiSnapshotSession,
  UiSnapshotProfile,
  UiSnapshotFallback,
  ModuleCatalogResponse,
} from './UiSnapshot.js';
export type {
  LegacySnapshotContract,
  SnapshotUserContextTransport,
} from './snapshot-user-context-transport.js';
export {
  ECONOMIC_REALITY_SURFACE_MODULE_ID,
  ECONOMIC_REALITY_SURFACE_VERSION,
  ECONOMIC_REALITY_SURFACE_V1,
  EconomicRealitySurfaceV1Schema,
  parseEconomicRealitySurfaceV1,
  type EconomicRealitySurfaceV1,
  type EconomicRealitySurfaceDefaultView,
  type EconomicRealitySurfaceEntrypointType,
} from './economic-reality-surface.js';
