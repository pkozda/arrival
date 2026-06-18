export type { ModuleError, ModuleErrorCategory } from './types/ModuleError.js';
export type {
  DefineModuleInput,
  SdkModuleDefinition,
  SdkModuleContractSpec,
  SdkModuleCapability,
  SdkRegisteredModuleContract,
  CompiledSdkModule,
  CompiledModuleCatalog,
  SdkModuleFingerprints,
} from './types/SdkModuleDefinition.js';
export type {
  ModuleVersionBaseline,
  ModuleVersionBaselineEntry,
  VersioningViolation,
} from './validateModuleVersioning.js';
export type { IsolationViolation } from './validateIsolation.js';
export type { RegisterModuleFromSdkOptions } from './registerModuleFromSDK.js';

export { defineModule, defineModuleFromRegistration } from './defineModule.js';
export { defineAction, type SdkActionDefinition } from './defineAction.js';
export {
  defineRecommendation,
  type SdkRecommendationDefinition,
} from './defineRecommendation.js';
export { defineModuleVersion, parseSemver, compareSemver } from './defineModuleVersion.js';
export { compileModuleRegistration } from './compileModuleRegistration.js';
export {
  registerModuleFromSDK,
  registerModulesFromSDK,
  mapExecutionFailureToModuleError,
} from './registerModuleFromSDK.js';
export {
  validateModuleVersioning,
  validateModuleVersioningCatalog,
} from './validateModuleVersioning.js';
export { validateModuleIsolation, assertModuleIsolation } from './validateIsolation.js';
export { hashZodSchema, hashStableValue } from './hashZodSchema.js';
