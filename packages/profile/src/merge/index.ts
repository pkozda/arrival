export type {
  MergeModuleInputParams,
  MergeModuleInputResult,
  ModuleMergeStrategy,
} from './types.js';
export {
  registerModuleMergeStrategy,
  getModuleMergeStrategy,
  unregisterModuleMergeStrategy,
  clearModuleMergeStrategies,
} from './registry.js';
