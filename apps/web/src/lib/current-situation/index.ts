export { isCurrentSituationEnabled, CURRENT_SITUATION_ENV_KEY } from './current-situation-feature-flag';
export {
  CurrentSituationRegistry,
  getCurrentSituationRegistry,
  resetCurrentSituationRegistry,
} from './registry';
export { resolveCurrentSituation } from './resolver';
export {
  DEFAULT_SURFACE_PRIORITIES,
  getDefaultSurfacePriority,
  isKnownSurfacePriority,
} from './priority';
export {
  isValidCurrentSituationSource,
  validateRegistration,
} from './validation';
export type {
  CurrentSituation,
  CurrentSituationListener,
  CurrentSituationResult,
  CurrentSituationSource,
  RegisterSurfaceInput,
  ResolutionReason,
  SurfacePriority,
  SurfaceRegistration,
  ValidationErrorCode,
  ValidationResult,
} from './types';
