import type { DiscoveryProfile } from '../types/profile.js';
import type { DiscoveryRun } from '../types/run.js';
import type { StrategyRegistry } from '../registry/strategy-registry.js';
import { StrategyRegistryError } from '../registry/strategy-registry.js';
import { DEFAULT_ENGINE_POLICY, type EnginePolicy } from '../engine-policy.js';
import type { AdapterPorts } from './adapters.js';
import type { ProfileStore } from './profile-store.js';
import { ProfileStoreError } from './profile-store.js';
import {
  CANONICAL_STAGE_ORDER,
  emptyBatch,
  type PipelineBatch,
  type PipelineContext,
  type StageDiagnostic,
  type StageId,
} from './types.js';
import { transitionRun } from './run-lifecycle.js';
import { cloneCriteria } from './candidate-factory.js';
import {
  runAiEvaluateStage,
  runBuildQueriesStage,
  runCollectStage,
  runDeduplicateStage,
  runFilterStage,
  runNormalizeStage,
  runDigestStage,
  runNoveltyStage,
  runParseStage,
  runPersistPromoteStage,
  runScoreStage,
  runSearchStage,
  runVerifyStage,
  type StageExecution,
} from './stages.js';
import type { ResultStore } from './result-store.js';
import type { ResultWriter } from './result-writer.js';
import { stageDiagnostic } from './diagnostics.js';
import type { TelemetryEmitter } from '../telemetry/emitter.js';
import { createInMemoryAiEvaluationCache } from './ai-evaluation-cache.js';

export type PipelineExecuteRequest = {
  profileId: string;
  registry: StrategyRegistry;
  profileStore: ProfileStore;
  adapters?: AdapterPorts;
  enginePolicy?: EnginePolicy;
  now?: () => string;
  runId?: string;
  /** Read-only ResultStore for Novelty / State (E2.6) */
  resultStore?: ResultStore;
  /** ResultWriter for Persist + Promote (E2.7) */
  resultWriter?: ResultWriter;
  /** Optional AbortSignal forwarded to adapters (E3.1) */
  signal?: AbortSignal;
  /** Optional default adapter timeout ms (E3.1) */
  adapterTimeoutMs?: number;
  /** Optional side-channel telemetry (E5.5). */
  telemetry?: TelemetryEmitter;
};

export type PipelineExecuteResult = {
  run: DiscoveryRun;
  batch: PipelineBatch;
  stageOrder: readonly StageId[];
  stageDiagnostics: StageDiagnostic[];
  queries: import('../types/query.js').DiscoveryQuery[];
  /** Presentation-independent Digest (E2.8); always present after successful stage run */
  digest?: import('../types/digest.js').DiscoveryDigest;
};

export class PipelineFatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PipelineFatalError';
  }
}

function createPendingRun(
  profile: DiscoveryProfile,
  criteriaSnapshot: import('../types/criteria.js').DiscoveryCriteria,
  now: string,
  runId: string
): DiscoveryRun {
  return {
    id: runId,
    profileId: profile.id,
    strategyId: profile.strategyId,
    strategyVersion: profile.strategyVersion,
    criteriaSnapshot,
    startedAt: now,
    status: 'PENDING',
    stats: {
      candidatesFound: 0,
      candidatesRejected: 0,
      candidatesVerified: 0,
      resultsCreated: 0,
      resultsUpdated: 0,
    },
    diagnostics: [],
  };
}

/**
 * E2.1 immutable discovery pipeline orchestration.
 * Exact strategy id@version resolution; criteria snapshotted at start.
 */
export async function executeDiscoveryPipeline(
  request: PipelineExecuteRequest
): Promise<PipelineExecuteResult> {
  const nowFn = request.now ?? (() => new Date().toISOString());
  const startedAt = nowFn();
  const pipelineStartedMs = Date.parse(startedAt);
  const runId = request.runId ?? `run:${request.profileId}:${startedAt}`;
  const stageOrder = [...CANONICAL_STAGE_ORDER];
  const stageDiagnostics: StageDiagnostic[] = [];
  const partialFailures: string[] = [];
  const telemetry = request.telemetry;

  const emitPipelineTerminal = (
    eventName:
      | 'pipeline.completed'
      | 'pipeline.partial_success'
      | 'pipeline.failed',
    run: DiscoveryRun
  ) => {
    telemetry?.emit({
      eventName,
      runId: run.id,
      profileId: run.profileId,
      strategyId: run.strategyId,
      durationMs: Math.max(0, Date.parse(nowFn()) - pipelineStartedMs),
      attributes: {
        status: run.status,
        candidatesFound: run.stats.candidatesFound,
        resultsCreated: run.stats.resultsCreated,
        resultsUpdated: run.stats.resultsUpdated,
      },
    });
  };

  telemetry?.emit({
    eventName: 'pipeline.started',
    runId,
    profileId: request.profileId,
  });

  let profile: DiscoveryProfile;
  try {
    const loaded = await request.profileStore.get(request.profileId);
    if (!loaded) {
      throw new ProfileStoreError(`Profile not found: ${request.profileId}`);
    }
    profile = {
      ...loaded,
      criteria: cloneCriteria(loaded.criteria),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Profile load failed';
    const failedRun = failRunSkeleton(request.profileId, runId, startedAt, message);
    emitPipelineTerminal('pipeline.failed', failedRun);
    return {
      run: failedRun,
      batch: emptyBatch(),
      stageOrder,
      stageDiagnostics: [
        stageDiagnostic({
          runId,
          stage: 'resolve_snapshot',
          outcome: 'error',
          reasonCode: 'PROFILE_LOAD_FAILED',
          message,
          durationMs: 0,
        }),
      ],
      queries: [],
    };
  }

  const resolveStarted = Date.now();
  let strategy;
  try {
    strategy = request.registry.get(profile.strategyId, profile.strategyVersion);
  } catch (err) {
    const message =
      err instanceof StrategyRegistryError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Strategy resolution failed';
    let run = createPendingRun(
      profile,
      cloneCriteria(profile.criteria),
      startedAt,
      runId
    );
    run = transitionRun(run, 'RUNNING', undefined);
    run = transitionRun(run, 'FAILED', nowFn());
    run = {
      ...run,
      diagnostics: [
        ...(run.diagnostics ?? []),
        { code: 'STRATEGY_NOT_FOUND', message, at: nowFn() },
      ],
    };
    emitPipelineTerminal('pipeline.failed', run);
    return {
      run,
      batch: emptyBatch(),
      stageOrder,
      stageDiagnostics: [
        stageDiagnostic({
          runId,
          stage: 'resolve_snapshot',
          startedAtMs: resolveStarted,
          outcome: 'error',
          reasonCode: 'STRATEGY_NOT_FOUND',
          message,
        }),
      ],
      queries: [],
    };
  }

  const criteriaSnapshot = cloneCriteria(profile.criteria);
  const validation = strategy.validateCriteria(criteriaSnapshot);
  let run = createPendingRun(profile, criteriaSnapshot, startedAt, runId);
  run = transitionRun(run, 'RUNNING');

  if (!validation.ok) {
    run = transitionRun(run, 'FAILED', nowFn());
    const message = validation.errors.map((e) => `${e.path}:${e.code}`).join('; ');
    const failed = {
      ...run,
      diagnostics: [
        ...(run.diagnostics ?? []),
        { code: 'CRITERIA_INVALID', message, at: nowFn() },
      ],
    };
    emitPipelineTerminal('pipeline.failed', failed);
    return {
      run: failed,
      batch: emptyBatch(),
      stageOrder,
      stageDiagnostics: [
        stageDiagnostic({
          runId,
          stage: 'resolve_snapshot',
          startedAtMs: resolveStarted,
          outcome: 'error',
          reasonCode: 'CRITERIA_INVALID',
          message,
        }),
      ],
      queries: [],
    };
  }

  stageDiagnostics.push(
    stageDiagnostic({
      runId,
      stage: 'resolve_snapshot',
      startedAtMs: resolveStarted,
      outcome: 'ok',
      message: `Resolved ${strategy.id}@${strategy.version}; criteria snapshotted`,
    })
  );

  let context: PipelineContext = {
    run,
    profile,
    strategy,
    enginePolicy: request.enginePolicy ?? DEFAULT_ENGINE_POLICY,
    adapters: request.adapters ?? {},
    queries: [],
    now: nowFn,
    aiEvaluationsUsed: 0,
    aiEstimatedInputTokensUsed: 0,
    aiEstimatedOutputTokensUsed: 0,
    aiEvaluationCache: createInMemoryAiEvaluationCache(),
    telemetry,
    resultStore: request.resultStore,
    resultWriter: request.resultWriter,
    signal: request.signal,
    adapterTimeoutMs: request.adapterTimeoutMs,
  };
  let batch = emptyBatch();

  const stageFns: Array<(b: PipelineBatch, c: PipelineContext) => Promise<StageExecution>> = [
    // resolve_snapshot already done
    async (b, c) => ({ batch: b, context: c, diagnostics: [], partialFailures: [] }),
    runBuildQueriesStage,
    runSearchStage,
    runCollectStage,
    runParseStage,
    runNormalizeStage,
    runDeduplicateStage,
    runFilterStage,
    runVerifyStage,
    runAiEvaluateStage,
    runScoreStage,
    runNoveltyStage,
    runPersistPromoteStage,
    runDigestStage,
  ];

  // Execute remaining stages in canonical order (skip index 0 resolve — already done)
  for (let i = 1; i < CANONICAL_STAGE_ORDER.length; i += 1) {
    const exec = await stageFns[i]!(batch, context);
    batch = exec.batch;
    context = exec.context;
    stageDiagnostics.push(...exec.diagnostics);
    partialFailures.push(...exec.partialFailures);
  }

  const terminal =
    partialFailures.length > 0 ? ('PARTIAL_SUCCESS' as const) : ('SUCCESS' as const);
  run = transitionRun(context.run, terminal, nowFn());
  run = {
    ...run,
    diagnostics: [
      ...(run.diagnostics ?? []),
      ...partialFailures.map((message) => ({
        code: 'PARTIAL_ADAPTER_FAILURE',
        message,
        at: nowFn(),
        adapter: message.split(':')[0],
      })),
    ],
  };

  emitPipelineTerminal(
    terminal === 'PARTIAL_SUCCESS' ? 'pipeline.partial_success' : 'pipeline.completed',
    run
  );

  return {
    run,
    batch,
    stageOrder,
    stageDiagnostics,
    queries: context.queries,
    digest: context.digest,
  };
}

function failRunSkeleton(
  profileId: string,
  runId: string,
  startedAt: string,
  message: string
): DiscoveryRun {
  let run: DiscoveryRun = {
    id: runId,
    profileId,
    strategyId: 'unknown',
    strategyVersion: 'unknown',
    criteriaSnapshot: {
      required: [],
      preferred: [],
      excluded: [],
      flexible: [],
    },
    startedAt,
    status: 'PENDING',
    stats: {
      candidatesFound: 0,
      candidatesRejected: 0,
      candidatesVerified: 0,
      resultsCreated: 0,
      resultsUpdated: 0,
    },
    diagnostics: [{ code: 'PROFILE_LOAD_FAILED', message, at: startedAt }],
  };
  run = transitionRun(run, 'RUNNING');
  run = transitionRun(run, 'FAILED', startedAt);
  return run;
}
