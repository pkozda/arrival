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
};

/**
 * Thin executor — invokes existing executeDiscoveryPipeline without scheduler logic.
 */
export function createPipelineRunExecutor(
  config: PipelineRunExecutorConfig
): DiscoveryRunExecutor {
  return {
    async execute(request: DiscoveryRunExecutorRequest): Promise<PipelineExecuteResult> {
      const pipelineRequest: PipelineExecuteRequest = {
        profileId: request.profileId,
        registry: config.registry,
        profileStore: config.profileStore,
        adapters: config.adapters,
        enginePolicy: config.enginePolicy,
        resultStore: config.resultStore,
        resultWriter: config.resultWriter,
        now: config.now,
        runId: request.runId,
        signal: config.signal,
        adapterTimeoutMs: config.adapterTimeoutMs,
      };
      return executeDiscoveryPipeline(pipelineRequest);
    },
  };
}
