import type { EnginePolicy } from '../engine-policy.js';
import type { StrategyRegistry } from '../registry/strategy-registry.js';
import type { AdapterPorts } from '../pipeline/adapters.js';
import {
  executeDiscoveryPipeline,
  type PipelineExecuteRequest,
  type PipelineExecuteResult,
} from '../pipeline/execute.js';
import type { ProfileStore } from '../pipeline/profile-store.js';
import type { ResultStore } from '../pipeline/result-store.js';
import type { ResultWriter } from '../pipeline/result-writer.js';
import type { ScheduleRunTrigger } from './types.js';
import type { TelemetryEmitter } from '../telemetry/emitter.js';
import { wrapAdapterPortsForTelemetry } from '../telemetry/instrumentation.js';
import type { Clock } from './clock.js';
import { createSystemClock } from './clock.js';

export type DiscoveryRunExecutorRequest = {
  scheduleId: string;
  profileId: string;
  runId: string;
  trigger: ScheduleRunTrigger;
};

export interface DiscoveryRunExecutor {
  execute(request: DiscoveryRunExecutorRequest): Promise<PipelineExecuteResult>;
}

export type PipelineRunExecutorConfig = {
  registry: StrategyRegistry;
  profileStore: ProfileStore;
  adapters?: AdapterPorts;
  enginePolicy?: EnginePolicy;
  resultStore?: ResultStore;
  resultWriter?: ResultWriter;
  now?: () => string;
  signal?: AbortSignal;
  adapterTimeoutMs?: number;
  /** Optional side-channel telemetry (E5.5). */
  telemetry?: TelemetryEmitter;
  clock?: Clock;
  adapterProviders?: {
    search?: string;
    fetch?: string;
    extract?: string;
    verify?: string;
    ai?: string;
  };
};

/**
 * Thin executor — invokes existing executeDiscoveryPipeline without scheduler logic.
 */
export function createPipelineRunExecutor(
  config: PipelineRunExecutorConfig
): DiscoveryRunExecutor {
  const clock = config.clock ?? createSystemClock();
  const adapters =
    config.telemetry && config.adapters
      ? wrapAdapterPortsForTelemetry(
          config.adapters,
          config.telemetry,
          clock,
          config.adapterProviders
        )
      : config.adapters;

  return {
    async execute(request: DiscoveryRunExecutorRequest): Promise<PipelineExecuteResult> {
      const pipelineRequest: PipelineExecuteRequest = {
        profileId: request.profileId,
        registry: config.registry,
        profileStore: config.profileStore,
        adapters,
        enginePolicy: config.enginePolicy,
        resultStore: config.resultStore,
        resultWriter: config.resultWriter,
        now: config.now,
        runId: request.runId,
        signal: config.signal,
        adapterTimeoutMs: config.adapterTimeoutMs,
        telemetry: config.telemetry,
      };
      return executeDiscoveryPipeline(pipelineRequest);
    },
  };
}
