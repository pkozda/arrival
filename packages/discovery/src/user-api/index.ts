export type {
  DiscoveryUserPrincipal,
  DiscoveryUserAuthenticator,
  UserAuthenticationResult,
  DiscoveryResultUserView,
  DiscoveryResultChangeMetadata,
  ProfileRunSummary,
  ProfileRunNowResult,
  ProfileRunNowStatus,
  DiscoveryExecutionLifecycle,
  CreateDiscoveryProfileInput,
  UpdateDiscoveryProfileInput,
  UpdateResultUserStateInput,
} from './types.js';
export {
  DiscoveryUserNotFoundError,
  DiscoveryUserForbiddenError,
  DiscoveryUserValidationError,
  DiscoveryUserConflictError,
} from './errors.js';
export {
  createDiscoveryUserService,
  parseCreateProfileBody,
  parseUpdateProfileBody,
  type DiscoveryUserService,
  type DiscoveryUserServiceDeps,
} from './discovery-user-service.js';
export {
  createDiscoveryUserHttpHandler,
  type DiscoveryUserHttpHandler,
  type DiscoveryUserHttpHandlerOptions,
} from './router.js';
export {
  createStaticUserTokenAuthenticator,
  createStaticUserTokenRegistryAuthenticator,
  type StaticUserTokenConfig,
} from './auth/static-user-token-authenticator.js';
export { toDiscoveryResultUserView, inferNoveltyFromResult } from './result-view.js';
export {
  executeProfileRunNow,
  ensureProfileSchedule,
  scheduleIdForProfile,
} from './profile-run.js';
export {
  deriveDiscoveryExecutionLifecycle,
  countApplicableResultsForRun,
  buildProfileRunSummaryFields,
  isActiveDiscoveryRunStatus,
  isTerminalDiscoveryRunStatus,
} from './execution-lifecycle.js';
export {
  buildProfileAutomationSummary,
  buildProfileRunSummaryWithAutomation,
  type ProfileAutomationSummary,
  type DiscoveryAutomationCadence,
} from './automation-summary.js';
export {
  buildOperationalScheduleRegistration,
  nextDailyRunAtUtc,
  NON_AUTOMATIC_NEXT_RUN_AT,
  syncProfileOperationalSchedule,
} from './schedule-projection.js';
export {
  transferDiscoveryProfileOwnership,
  type DiscoveryOwnershipTransferResult,
} from './ownership-transfer.js';
export {
  validateProfileId,
  validateResultId,
  validateUserStateBody,
} from './validation.js';
