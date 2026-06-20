export type { ProfileState, ProfileFieldEntry } from './profile-state.js';
export {
  createEmptyProfileState,
  getFieldValue,
  hasField,
} from './profile-state.js';

export {
  MUTATION_PRECEDENCE,
  getMutationPrecedence,
  incomingMutationSupersedesIncumbent,
} from './precedence.js';

export { reduceProfileEvents, applyMutationEvent } from './reducer/index.js';

export { projectProfileState } from './projection/project-profile-state.js';

export {
  normalizeMutationRequest,
  buildMutationReason,
  isRevisionRequiredType,
} from './normalize/normalize-mutation-request.js';

export {
  resolveMutationConflict,
  type ConflictResolution,
  type ConflictErrorCode,
} from './conflict/resolve-mutation-conflict.js';

export {
  type MutationEventLogPort,
  InMemoryMutationEventLog,
} from './ports/mutation-event-log.js';

export {
  submitMutationRequest,
  type SubmitMutationResult,
  type SubmitMutationErrorCode,
  type SubmitMutationOptions,
} from './coordinator/submit-mutation-request.js';

export {
  buildMutationRequestsFromModuleExecution,
  type BuildModuleMutationRequestsParams,
} from './module/build-mutation-requests-from-module.js';
