export type {
  PipelineBatch,
  PipelineContext,
  StageDiagnostic,
  StageId,
  StageResult,
} from './types.js';
export {
  CANONICAL_STAGE_ORDER,
  emptyBatch,
  withActive,
  withRejection,
  appendActive,
} from './types.js';

export type {
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
} from './adapters.js';
export { AdapterError, PartialSearchError, toAdapterContext } from './adapters.js';

export type { ProfileStore } from './profile-store.js';
export { ProfileStoreError } from './profile-store.js';

export {
  canTransitionRun,
  transitionRun,
  isTerminalRunStatus,
  RunLifecycleError,
} from './run-lifecycle.js';

export type { PipelineExecuteRequest, PipelineExecuteResult } from './execute.js';
export { executeDiscoveryPipeline, PipelineFatalError } from './execute.js';

export { runVerifyStage, runAiEvaluateStage, runScoreStage, runNoveltyStage, runPersistPromoteStage, runDigestStage } from './stages.js';
export {
  buildDiscoveryDigest,
  isDigestEligible,
} from './digest-builder.js';
export type {
  BuildDiscoveryDigestInput,
  DigestCandidateSource,
} from './digest-builder.js';
export {
  finalizeVerificationResult,
  isVerificationGateOpen,
} from './verification-integrity.js';
export type { AiGateBlockReason, AiGateDecision, AiEvaluationValidationResult } from './ai-gate.js';
export { evaluateAiGate, validateAiEvaluation } from './ai-gate.js';
export type { AiCostPolicy } from './ai-cost.js';
export {
  resolveAiCostPolicy,
  estimateTokensFromStructuredPayload,
  estimateReservedOutputTokens,
  stableJsonStringify,
  DEFAULT_AI_OUTPUT_TOKEN_RESERVE_PER_TASK,
  DEFAULT_AI_OUTPUT_TOKEN_RESERVE_MIN,
} from './ai-cost.js';
export type { AiEvaluationFingerprintInput } from './ai-fingerprint.js';
export {
  computeAiEvaluationFingerprint,
  buildAiAccountingPayload,
} from './ai-fingerprint.js';
export type {
  AiEvaluationCache,
  AiEvaluationCacheEntry,
} from './ai-evaluation-cache.js';
export { createInMemoryAiEvaluationCache } from './ai-evaluation-cache.js';
export type { ResultStore } from './result-store.js';
export { ResultStoreError, resultIdentityKey } from './result-store.js';
export type { ResultWriter } from './result-writer.js';
export { ResultWriterError } from './result-writer.js';
export {
  decideNovelty,
  detectMaterialChange,
  presentationFromCandidate,
} from './novelty-decision.js';
export { buildPersistPlan } from './persist-plan.js';
export type { PersistPromotionBuildInput, PersistPromotionPlan } from './persist-plan.js';
export {
  validateResultStateTransition,
  type ResultStateTransitionInput,
  type ResultStateTransitionResult,
} from './result-state-transition.js';
export {
  createResultStateWriter,
  transitionResultsToNotified,
  ResultStateWriterError,
  type ResultStateWriter,
  type ResultStateTransitionRequest,
  type CreateResultStateWriterDeps,
} from './result-state-writer.js';
export { createInMemoryResultStore } from './fakes/in-memory-result-store.js';
/** Alias — in-memory fake implements ResultStore + ResultWriter */
export { createInMemoryResultStore as createInMemoryResultWriter } from './fakes/in-memory-result-store.js';

export { createFakeSearchAdapter } from './fakes/fake-search-adapter.js';
export type { FakeSearchAdapterOptions } from './fakes/fake-search-adapter.js';
export { createInMemoryProfileStore } from './fakes/in-memory-profile-store.js';
export { createCompositeSearchAdapter } from './fakes/composite-search-adapter.js';
export { createFakeFetchAdapter } from './fakes/fake-fetch-adapter.js';
export type { FakeFetchAdapterOptions } from './fakes/fake-fetch-adapter.js';
export { createFakeContentExtractor } from './fakes/fake-content-extractor.js';
export type { FakeContentExtractorOptions } from './fakes/fake-content-extractor.js';
export { createFakeVerificationAdapter } from './fakes/fake-verification-adapter.js';
export type {
  FakeVerificationAdapterOptions,
  FakeVerificationOutcome,
} from './fakes/fake-verification-adapter.js';
export {
  createFakeAiAdapter,
  purchaseRejectTask,
} from './fakes/fake-ai-adapter.js';
export type { FakeAiAdapterOptions } from './fakes/fake-ai-adapter.js';
export { createInMemoryRawContentStore } from './fakes/raw-content-store.js';
export type { RawContentStore, StoredRawPayload } from './fakes/raw-content-store.js';
export {
  COLLECT_PARSE_FIXTURES,
  FIXTURE_JOB_FULL_HTML,
  FIXTURE_JOB_UNKNOWN_SALARY_HTML,
  FIXTURE_JOB_TEXT,
  FIXTURE_MALFORMED,
} from './fakes/fixtures.js';
export type { CollectParseFixtureId } from './fakes/fixtures.js';
