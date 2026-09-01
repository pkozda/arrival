export type { TriState } from './types/tri-state.js';
export {
  isTriState,
  requiredSatisfied,
  optionalBlocks,
  assertNeverCoerceUnknown,
} from './types/tri-state.js';

export type { Criterion, CriterionValue, DiscoveryCriteria } from './types/criteria.js';
export { emptyCriteria } from './types/criteria.js';

export type {
  DiscoveryProfile,
  DiscoverySchedule,
  NotificationPreferences,
} from './types/profile.js';

export type {
  DiscoveryQuery,
  DiscoveryQueryGeography,
  DiscoveryQueryIntent,
} from './types/query.js';

export type {
  CandidateIdentity,
  DiscoveryCandidate,
  ExtractedFacts,
  NormalizedCandidateData,
  RawCandidatePayload,
  RawContentRef,
  SourceRef,
  SourceTrust,
} from './types/candidate.js';

export type {
  CandidateStage,
  RejectionReasonCode,
  RejectionRecord,
} from './types/rejection.js';

export type { Evidence, EvidenceType } from './types/evidence.js';

export type {
  AiEvaluation,
  AiEvaluationTask,
  AiEvaluationTaskResult,
  AiInterpretationOutcome,
} from './types/ai-evaluation.js';

export type {
  NoveltyDecision,
  NoveltyPolicy,
  NoveltyStatus,
} from './types/novelty.js';

export type {
  FreshnessStatus,
  VerificationCheck,
  VerificationResult,
  VerificationStatus,
} from './types/verification.js';

export type {
  RankContext,
  Score,
  ScoreBreakdown,
  ScoreDimension,
  ScoreComputationInput,
} from './types/score.js';

export type { ScoreValidationResult } from './invariants/score.js';
export {
  validateScore,
  weightedMatchFromDimensions,
  roundScore,
} from './invariants/score.js';

export type {
  ResultLifecycleStatus,
  ResultState,
  ResultStateActor,
  ResultStateTransition,
} from './types/state.js';

export type { DiscoveryResult, ResultPresentation } from './types/result.js';

export type {
  DiscoveryRun,
  DiscoveryRunStatus,
  RunDiagnostic,
} from './types/run.js';

export type { DiscoveryDigest, DigestEntry, DigestSummary, DiscoverySummary } from './types/digest.js';

export type {
  AiEvaluationPolicy,
  DeduplicationPolicy,
  DiscoveryStrategy,
  DiscoveryStrategyDescriptor,
  DiscoveryStrategyModule,
  FilterResult,
  FreshnessPolicy,
  NormalizeContext,
  ScoringPolicy,
  ValidationResult,
  VerificationPolicy,
} from './types/strategy.js';
export { toStrategyDescriptor } from './types/strategy.js';

export type { EnginePolicy } from './engine-policy.js';
export { DEFAULT_ENGINE_POLICY } from './engine-policy.js';

export type {
  AiCostPolicy,
  AiEvaluationFingerprintInput,
  AiEvaluationCache,
  AiEvaluationCacheEntry,
} from './pipeline/index.js';
export {
  resolveAiCostPolicy,
  estimateTokensFromStructuredPayload,
  estimateReservedOutputTokens,
  stableJsonStringify,
  computeAiEvaluationFingerprint,
  buildAiAccountingPayload,
  createInMemoryAiEvaluationCache,
} from './pipeline/index.js';

export {
  deriveVerificationStatus,
  withDerivedStatus,
} from './invariants/verification-status.js';

export type { EvidenceValidationResult } from './invariants/evidence.js';
export {
  assertAttributableEvidence,
  isFabricatedSourceUrl,
  validateEvidenceList,
} from './invariants/evidence.js';

export type {
  PromotionDecision,
  PromotionDenialReason,
  PromotionInput,
} from './invariants/promotion.js';
export { canPromote } from './invariants/promotion.js';

export type { StrategyRegistry } from './registry/strategy-registry.js';
export {
  StrategyRegistryError,
  createStrategyRegistry,
} from './registry/strategy-registry.js';

export { jobDiscoveryStrategyV1 } from './strategies/job-discovery-v1.js';
export { giveawayDiscoveryStrategyV1 } from './strategies/giveaway-discovery-v1.js';

/** E3.1 — production adapter infrastructure (no real providers) */
export type {
  AdapterExecutionContext,
  AdapterFailure,
  AdapterFailureCode,
  RateLimiter,
  RetryPolicy,
  AdapterLifecycleInput,
  AdapterLifecycleOutcome,
  TimeoutExecutionOptions,
  InMemoryRateLimiterOptions,
} from './adapter-infra/index.js';
export {
  NO_RETRY,
  AdapterFailureError,
  adapterFailureReasonCode,
  assertNotAborted,
  executeWithTimeout,
  executionContextFromOptions,
  wouldRetry,
  isRetryableAdapterFailure,
  defaultShouldRetryAdapterFailure,
  RETRYABLE_ADAPTER_FAILURE_CODES,
  NON_RETRYABLE_ADAPTER_FAILURE_CODES,
  createInMemoryRateLimiter,
  adapterLifecycleDiagnostic,
  adapterFailureDiagnostic,
  sanitizeAdapterDiagnosticMessage,
  EXTERNAL_CONTENT_UNTRUSTED,
  assertAttributableSourceUrl,
} from './adapter-infra/index.js';

/** E3.2–E3.4 — production adapters (provider types stay private) */
export type {
  ProductionSearchAdapterConfig,
  ProductionFetchAdapterConfig,
  ProductionContentExtractorConfig,
  ProductionVerificationAdapterConfig,
  ProductionAiAdapterConfig,
  ProductionEmailNotificationConfig,
  EmailNotificationConfig,
  RenderedDiscoveryEmail,
  ProductionTelegramNotificationConfig,
  TelegramNotificationConfig,
  RenderedDiscoveryTelegram,
  DiscoveryProductionConfig,
  DiscoveryProductionConfigValidation,
  LoadDiscoveryProductionConfigOptions,
  ProductionDiscoveryAdapters,
  RedactedDiscoveryProductionConfig,
  SqliteResultPersistenceConfig,
  SqliteResultPersistence,
  SqliteSchedulerPersistenceConfig,
  SqliteSchedulerPersistence,
  SqliteNotificationPersistenceConfig,
  SqliteNotificationPersistence,
  DiscoveryResultRecordV1,
  HttpRequest,
  HttpResponse,
  HttpTransport,
} from './adapters/index.js';
export {
  BRAVE_SEARCH_PROVIDER_ID,
  buildBraveQueryText,
  createBraveSearchAdapter,
  createProductionSearchAdapter,
  HTTP_FETCH_PROVIDER_ID,
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_ALLOWED_CONTENT_TYPES,
  createHttpFetchAdapter,
  createProductionFetchAdapter,
  DEFAULT_EXTRACT_ALLOWED_CONTENT_TYPES,
  DEFAULT_EXTRACT_MAX_RAW_BYTES,
  DEFAULT_MAX_VISIBLE_TEXT_CHARS,
  DEFAULT_MAX_LINKS,
  DEFAULT_MAX_HEADINGS,
  DEFAULT_MAX_JSON_LD_BLOCKS,
  createHtmlContentExtractor,
  createProductionContentExtractor,
  VERIFY_HTTP_PROVIDER_ID,
  createHttpVerificationAdapter,
  createProductionVerificationAdapter,
  OPENAI_AI_PROVIDER_ID,
  createOpenAiAdapter,
  createProductionAiAdapter,
  createProductionEmailNotificationAdapter,
  createResendEmailNotificationAdapter,
  createProductionEmailNotificationAdapterFromConfig,
  RESEND_EMAIL_PROVIDER_ID,
  RESEND_EMAIL_RATE_LIMIT_KEY,
  renderDiscoveryEmail,
  escapeHtml,
  safeHttpUrl,
  createProductionTelegramNotificationAdapter,
  createTelegramNotificationAdapter,
  createProductionTelegramNotificationAdapterFromConfig,
  TELEGRAM_PROVIDER_ID,
  TELEGRAM_RATE_LIMIT_KEY,
  TELEGRAM_MAX_MESSAGE_LENGTH,
  renderDiscoveryTelegram,
  isValidTelegramChatId,
  createProductionDiscoveryAdapters,
  loadDiscoveryProductionConfig,
  redactDiscoveryProductionConfig,
  validateDiscoveryProductionConfig,
  DISCOVERY_RESULT_RECORD_SCHEMA_VERSION,
  serializeDiscoveryResult,
  deserializeDiscoveryResult,
  createSqliteResultPersistence,
  DISCOVERY_PROFILE_RECORD_SCHEMA_VERSION,
  serializeDiscoveryProfile,
  deserializeDiscoveryProfile,
  createSqliteProfilePersistence,
  DISCOVERY_SCHEDULER_SCHEMA_VERSION,
  createSqliteSchedulerPersistence,
  DISCOVERY_NOTIFICATION_SCHEMA_VERSION,
  createSqliteNotificationPersistence,
  DISCOVERY_EXECUTION_QUEUE_SCHEMA_VERSION,
  DEFAULT_QUEUE_VISIBILITY_TIMEOUT_MS,
  createSqliteExecutionQueue,
  DISCOVERY_SCHEDULER_LOCK_SCHEMA_VERSION,
  createSqliteSchedulerLock,
  createFetchHttpTransport,
  createMockHttpTransport,
} from './adapters/index.js';

export type {
  Clock,
  ScheduleInterval,
  DiscoveryScheduleRecord,
  ScheduleRunTrigger,
  ScheduledRunRecord,
  RegisterScheduleInput,
  TriggerSkipReason,
  TriggerRunOutcome,
  SchedulerTickResult,
  RunIdGenerator,
  JobIdGenerator,
  ScheduleStore,
  RunStore,
  DiscoveryRunExecutor,
  DiscoveryRunExecutorRequest,
  PipelineRunExecutorConfig,
  DiscoveryScheduler,
  DiscoverySchedulerConfig,
  SchedulerLock,
  SchedulerLockRecord,
  SchedulerLockAcquireResult,
  SchedulerLockReleaseResult,
  SchedulerLockRecoverResult,
} from './scheduler/index.js';
export {
  createSystemClock,
  createFakeClock,
  clockIso,
  SchedulerError,
  ScheduleStoreError,
  RunStoreError,
  calculateNextRunAt,
  initialNextRunAt,
  createPipelineRunExecutor,
  createDiscoveryScheduler,
  createIncrementingRunIdGenerator,
  createIncrementingJobIdGenerator,
  createInMemoryScheduleStore,
  createInMemoryRunStore,
  createInMemorySchedulerLock,
  DEFAULT_SCHEDULER_LOCK_LEASE_MS,
  scheduleLockKey,
  schedulerOwnerId,
  expiresAtIso,
} from './scheduler/index.js';
export type {
  DiscoveryExecutionJob,
  DiscoveryExecutionJobStatus,
  EnqueueJobInput,
  EnqueueResult,
  EnqueueDuplicateReason,
  DiscoveryExecutionQueue,
  QueueClaimOptions,
  QueueRetryOptions,
  RecoverExpiredClaimsResult,
  DiscoveryExecutionWorker,
  DiscoveryExecutionWorkerConfig,
  NotificationTarget,
  WorkerProcessResult,
  DiscoveryExecutionRetryPolicy,
  ExecutionRetryConfig,
  RetryDecision,
  RetryDecisionInput,
} from './queue/index.js';
export {
  QueueError,
  createDiscoveryExecutionWorker,
  createInMemoryExecutionQueue,
  DEFAULT_EXECUTION_RETRY_CONFIG,
  computeBackoffDelayMs,
  createDefaultExecutionRetryPolicy,
  toExecutionAdapterFailure,
} from './queue/index.js';
export type {
  DiscoveryRuntime,
  DiscoveryRuntimeConfig,
  DiscoveryRuntimePersistencePaths,
  DiscoveryRuntimeApplicationConfig,
  DiscoveryProviderEnablement,
  DiscoveryRuntimeConfigValidation,
  RedactedDiscoveryRuntimeConfig,
  DiscoveryRuntimeInfrastructureSlice,
  ChannelNotificationAdapters,
  DiscoveryRuntimeHealth,
  DiscoveryHealthStatus,
  DiscoveryHealthWarningCode,
  DiscoveryHealthWarning,
  PersistenceAvailability,
  PersistenceHealth,
  QueueHealth,
  SchedulerHealth,
  RunHealthSummary,
  ProviderObservedStatus,
  ProviderHealthEntry,
  ObservabilityHealth,
  QueueHealthStats,
  AggregateHealthInput,
  BuildRuntimeHealthInput,
} from './runtime/index.js';
export {
  createDiscoveryRuntime,
  createChannelRoutingNotificationAdapter,
  assertDiscoveryRuntimeConfig,
  collectConfigSecrets,
  getDiscoveryProviderEnablement,
  redactDiscoveryRuntimeConfig,
  sanitizeRuntimeErrorMessage,
  validateDiscoveryRuntimeConfig,
  DiscoveryConfigurationError,
  DiscoveryRuntimeClosedError,
  DiscoveryRuntimeConstructionError,
  aggregateDiscoveryHealth,
  DEFAULT_QUEUE_BACKLOG_THRESHOLD,
  buildDiscoveryRuntimeHealth,
  buildProviderHealthEntries,
  toRunHealthSummary,
} from './runtime/index.js';
export type {
  DiscoveryService,
  DiscoveryServiceConfig,
  DiscoveryServiceLifecycle,
  RunNowInput,
} from './service/index.js';
export {
  createDiscoveryService,
  DiscoveryServiceStoppedError,
  DiscoveryServiceNotStartedError,
  DiscoveryServiceStartupError,
} from './service/index.js';
export type {
  DiscoveryHttpHeaders,
  DiscoveryHttpRequest,
  DiscoveryHttpResponse,
  DiscoveryHttpErrorCode,
  DiscoveryHttpErrorBody,
  DiscoveryHttpHandler,
  DiscoveryHttpHandlerOptions,
  CreateDiscoveryHttpServerOptions,
} from './http/index.js';
export {
  DISCOVERY_REQUEST_ID_HEADER,
  MAX_ADMIN_BODY_BYTES,
  resolveRequestId,
  headerValue,
  validateRegisterScheduleBody,
  validateScheduleId,
  validateRunId,
  isSafeId,
  DiscoveryHttpError,
  jsonResponse,
  errorResponse,
  mapApplicationError,
  createDiscoveryHttpHandler,
  createDiscoveryHttpServer,
  ALL_DISCOVERY_ADMIN_PERMISSIONS,
  createStaticTokenAuthenticator,
  createPermissionAuthorizer,
  resolveAdminRoutePolicy,
  loadDiscoveryAdminAuthConfig,
  validateDiscoveryAdminAuthConfig,
  redactDiscoveryAdminAuthConfig,
  createAuthenticatorFromAdminAuthConfig,
  unauthenticatedResponse,
  forbiddenResponse,
} from './http/index.js';
export type {
  DiscoveryPermission,
  DiscoveryPrincipal,
  AuthenticationResult,
  DiscoveryAuthenticator,
  DiscoveryAuthorizer,
  StaticTokenAuthenticatorConfig,
  AdminRoutePolicy,
  DiscoveryAdminAuthConfig,
  RedactedDiscoveryAdminAuthConfig,
} from './http/index.js';
export type {
  DiscoveryTelemetry,
  DiscoveryTelemetryEvent,
  DiscoveryTelemetryEventName,
  DiscoveryTelemetryCategory,
  DiscoveryTelemetryAttributes,
  DiscoveryTelemetryEnvelope,
  TelemetryEventIdGenerator,
  EmitTelemetryInput,
  TelemetryEmitter,
  CreateTelemetryEmitterOptions,
  InMemoryDiscoveryTelemetry,
  AdapterTelemetryMeta,
  OperationalObservationTracker,
  OperationalObservations,
  ProviderObservationKey,
} from './telemetry/index.js';
export {
  categoryForEventName,
  createNoopDiscoveryTelemetry,
  createTelemetryEmitter,
  createIncrementingTelemetryEventIdGenerator,
  safeEmit,
  measureTelemetryOperation,
  sanitizeTelemetryAttributes,
  assertTelemetryEventHasNoSecrets,
  createInMemoryDiscoveryTelemetry,
  wrapAdapterPortsForTelemetry,
  wrapResultWriterForTelemetry,
  wrapExecutionQueueForTelemetry,
  createOperationalObservationTracker,
  wrapTelemetryWithObservations,
} from './telemetry/index.js';
export type {
  NotificationChannel,
  NotificationRecipient,
  NotificationPriority,
  NotificationItem,
  NotificationPayload,
  NotificationDeliveryStatus,
  NotificationFailureCode,
  NotificationFailure,
  NotificationRecord,
  NotificationPlan,
  NotificationDeliveryResult,
  NotificationSendRequest,
  DeliverDigestInput,
  DeliverDigestOutcome,
  NotificationIdempotencyKey,
  NotificationStore,
  NotificationAdapter,
  BuildNotificationPlanInput,
  DiscoveryNotificationService,
  DiscoveryNotificationServiceConfig,
  FakeNotificationSendRecord,
  FakeNotificationAdapterOptions,
} from './notifications/index.js';
export {
  NotificationError,
  NotificationStoreError,
  notificationFailureReasonCode,
  notificationIdentityKey,
  parseNotificationIdentityKey,
  buildNotificationPlan,
  buildNotificationPayload,
  createDiscoveryNotificationService,
  createInMemoryNotificationStore,
  createFakeNotificationAdapter,
} from './notifications/index.js';
export type {
  PipelineBatch,
  PipelineContext,
  StageDiagnostic,
  StageId,
  StageResult,
  AdapterPorts,
  AdapterContext,
  SearchAdapter,
  FetchAdapter,
  FetchRequest,
  FetchResult,
  FetchSuccess,
  FetchFailure,
  ContentExtractor,
  ExtractionContext,
  ExtractionResult,
  ExtractionSuccess,
  ExtractionFailure,
  VerificationAdapter,
  VerificationRequest,
  VerificationSuccess,
  VerificationFailure,
  VerificationAdapterResult,
  AiAdapter,
  AiEvaluationRequest,
  AiEvaluationSuccess,
  AiEvaluationFailure,
  AiAdapterResult,
  ProfileStore,
  PipelineExecuteRequest,
  PipelineExecuteResult,
  FakeSearchAdapterOptions,
  FakeFetchAdapterOptions,
  FakeContentExtractorOptions,
  FakeVerificationAdapterOptions,
  FakeVerificationOutcome,
  FakeAiAdapterOptions,
  AiGateBlockReason,
  AiGateDecision,
  AiEvaluationValidationResult,
  ResultStore,
  ResultWriter,
  PersistPromotionBuildInput,
  PersistPromotionPlan,
  BuildDiscoveryDigestInput,
  DigestCandidateSource,
  RawContentStore,
  StoredRawPayload,
  CollectParseFixtureId,
} from './pipeline/index.js';
export {
  CANONICAL_STAGE_ORDER,
  emptyBatch,
  withActive,
  withRejection,
  appendActive,
  AdapterError,
  PartialSearchError,
  ProfileStoreError,
  canTransitionRun,
  transitionRun,
  isTerminalRunStatus,
  RunLifecycleError,
  executeDiscoveryPipeline,
  PipelineFatalError,
  runVerifyStage,
  runAiEvaluateStage,
  runScoreStage,
  runNoveltyStage,
  runPersistPromoteStage,
  runDigestStage,
  finalizeVerificationResult,
  isVerificationGateOpen,
  evaluateAiGate,
  validateAiEvaluation,
  ResultStoreError,
  ResultWriterError,
  resultIdentityKey,
  decideNovelty,
  detectMaterialChange,
  presentationFromCandidate,
  buildPersistPlan,
  buildDiscoveryDigest,
  isDigestEligible,
  toAdapterContext,
  createResultStateWriter,
  transitionResultsToNotified,
  ResultStateWriterError,
  validateResultStateTransition,
  createFakeSearchAdapter,
  createInMemoryProfileStore,
  createCompositeSearchAdapter,
  createFakeFetchAdapter,
  createFakeContentExtractor,
  createFakeVerificationAdapter,
  createFakeAiAdapter,
  purchaseRejectTask,
  createInMemoryRawContentStore,
  createInMemoryResultStore,
  createInMemoryResultWriter,
  COLLECT_PARSE_FIXTURES,
  FIXTURE_JOB_FULL_HTML,
  FIXTURE_JOB_UNKNOWN_SALARY_HTML,
  FIXTURE_JOB_TEXT,
  FIXTURE_MALFORMED,
} from './pipeline/index.js';

import { createStrategyRegistry } from './registry/strategy-registry.js';
import { jobDiscoveryStrategyV1 } from './strategies/job-discovery-v1.js';
import { giveawayDiscoveryStrategyV1 } from './strategies/giveaway-discovery-v1.js';

/** Default registry with E1 stub strategies registered. */
export function createDefaultDiscoveryRegistry() {
  return createStrategyRegistry([jobDiscoveryStrategyV1, giveawayDiscoveryStrategyV1]);
}
