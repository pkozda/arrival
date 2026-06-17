export * from './api/index.js';
export * from './types/profile-document.js';
export * from './types/profile-record.js';
export * from './types/profile-slice.js';
export * from './errors/profile-revision-conflict.js';
export * from './ports/profile-store.js';
export * from './adapters/in-memory-store.js';
export * from './engine/profile-engine.js';
export * from './engine/resolve-execution-context.js';
export * from './merge/index.js';
export * from './policy/index.js';
export * from './trace/index.js';
export * from './migrations/index.js';
export {
  collectChangedFields,
  createEmptyProfileDocument,
  deepMergeProfile,
} from './utils/merge-profile.js';
