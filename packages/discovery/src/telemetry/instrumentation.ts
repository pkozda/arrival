import { AdapterFailureError } from '../adapter-infra/errors.js';
import type {
  AdapterPorts,
  AiAdapter,
  ContentExtractor,
  FetchAdapter,
  SearchAdapter,
  VerificationAdapter,
} from '../pipeline/adapters.js';
import type { ResultWriter } from '../pipeline/result-writer.js';
import type { DiscoveryExecutionQueue } from '../queue/execution-queue.js';
import type { Clock } from '../scheduler/clock.js';
import type { TelemetryEmitter } from './emitter.js';
import type { DiscoveryTelemetryEventName } from './types.js';

export type AdapterTelemetryMeta = {
  kind: string;
  provider?: string;
  operation: string;
  runId?: string;
  attempt?: number;
  profileId?: string;
  strategyId?: string;
  runtimeInstanceId?: string;
};

function failureEventName(err: unknown): DiscoveryTelemetryEventName {
  if (AdapterFailureError.isTimeout(err)) return 'adapter.timeout';
  if (AdapterFailureError.isCancelled(err)) return 'adapter.cancelled';
  return 'adapter.failed';
}

function safeFailureCode(err: unknown): string | undefined {
  if (AdapterFailureError.isAdapterFailure(err)) return err.failure.code;
  return undefined;
}

async function instrumentAdapterCall<T>(
  emitter: TelemetryEmitter,
  clock: Clock,
  meta: AdapterTelemetryMeta,
  work: () => Promise<T>
): Promise<T> {
  const startedMs = clock.now().getTime();
  emitter.emit({
    eventName: 'adapter.started',
    runId: meta.runId,
    attempt: meta.attempt,
    profileId: meta.profileId,
    strategyId: meta.strategyId,
    runtimeInstanceId: meta.runtimeInstanceId,
    attributes: {
      adapterKind: meta.kind,
      provider: meta.provider,
      operation: meta.operation,
    },
  });
  try {
    const result = await work();
    emitter.emit({
      eventName: 'adapter.completed',
      runId: meta.runId,
      attempt: meta.attempt,
      profileId: meta.profileId,
      strategyId: meta.strategyId,
      runtimeInstanceId: meta.runtimeInstanceId,
      durationMs: Math.max(0, clock.now().getTime() - startedMs),
      attributes: {
        adapterKind: meta.kind,
        provider: meta.provider,
        operation: meta.operation,
      },
    });
    return result;
  } catch (err) {
    emitter.emit({
      eventName: failureEventName(err),
      runId: meta.runId,
      attempt: meta.attempt,
      profileId: meta.profileId,
      strategyId: meta.strategyId,
      runtimeInstanceId: meta.runtimeInstanceId,
      durationMs: Math.max(0, clock.now().getTime() - startedMs),
      attributes: {
        adapterKind: meta.kind,
        provider: meta.provider,
        operation: meta.operation,
        failureCode: safeFailureCode(err),
      },
    });
    throw err;
  }
}

function emitSoftFailure(
  emitter: TelemetryEmitter,
  clock: Clock,
  meta: AdapterTelemetryMeta,
  startedMs: number,
  failureCode: string
): void {
  emitter.emit({
    eventName: 'adapter.failed',
    runId: meta.runId,
    attempt: meta.attempt,
    profileId: meta.profileId,
    strategyId: meta.strategyId,
    runtimeInstanceId: meta.runtimeInstanceId,
    durationMs: Math.max(0, clock.now().getTime() - startedMs),
    attributes: {
      adapterKind: meta.kind,
      provider: meta.provider,
      operation: meta.operation,
      failureCode,
    },
  });
}

/**
 * Wrap AdapterPorts with best-effort adapter.* telemetry.
 * Does not alter adapter results or throw on telemetry failure.
 */
export function wrapAdapterPortsForTelemetry(
  ports: AdapterPorts,
  emitter: TelemetryEmitter,
  clock: Clock,
  providers?: {
    search?: string;
    fetch?: string;
    extract?: string;
    verify?: string;
    ai?: string;
  }
): AdapterPorts {
  const out: AdapterPorts = { ...ports };

  if (ports.search) {
    const inner = ports.search;
    const search: SearchAdapter = {
      async search(queries, context) {
        return instrumentAdapterCall(
          emitter,
          clock,
          {
            kind: 'search',
            provider: providers?.search ?? 'unknown',
            operation: 'search',
            runId: context.run.id,
          },
          () => inner.search(queries, context)
        );
      },
    };
    out.search = search;
  }

  if (ports.fetch) {
    const inner = ports.fetch;
    const fetch: FetchAdapter = {
      async fetch(request, context) {
        const startedMs = clock.now().getTime();
        const meta: AdapterTelemetryMeta = {
          kind: 'fetch',
          provider: providers?.fetch ?? 'http',
          operation: 'fetch',
          runId: context.run.id,
        };
        emitter.emit({
          eventName: 'adapter.started',
          runId: meta.runId,
          attributes: {
            adapterKind: meta.kind,
            provider: meta.provider,
            operation: meta.operation,
          },
        });
        try {
          const result = await inner.fetch(request, context);
          if (!result.ok) {
            emitSoftFailure(
              emitter,
              clock,
              meta,
              startedMs,
              result.failureCode ?? result.reasonCode
            );
          } else {
            emitter.emit({
              eventName: 'adapter.completed',
              runId: meta.runId,
              durationMs: Math.max(0, clock.now().getTime() - startedMs),
              attributes: {
                adapterKind: meta.kind,
                provider: meta.provider,
                operation: meta.operation,
              },
            });
          }
          return result;
        } catch (err) {
          emitter.emit({
            eventName: failureEventName(err),
            runId: meta.runId,
            durationMs: Math.max(0, clock.now().getTime() - startedMs),
            attributes: {
              adapterKind: meta.kind,
              provider: meta.provider,
              operation: meta.operation,
              failureCode: safeFailureCode(err),
            },
          });
          throw err;
        }
      },
    };
    out.fetch = fetch;
  }

  if (ports.extract) {
    const inner = ports.extract;
    const extract: ContentExtractor = {
      async extract(content, context) {
        const startedMs = clock.now().getTime();
        const meta: AdapterTelemetryMeta = {
          kind: 'extract',
          provider: providers?.extract ?? 'html',
          operation: 'extract',
          runId: context.run.id,
        };
        emitter.emit({
          eventName: 'adapter.started',
          runId: meta.runId,
          attributes: {
            adapterKind: meta.kind,
            provider: meta.provider,
            operation: meta.operation,
          },
        });
        try {
          const result = await inner.extract(content, context);
          if (!result.ok) {
            emitSoftFailure(emitter, clock, meta, startedMs, result.reasonCode);
          } else {
            emitter.emit({
              eventName: 'adapter.completed',
              runId: meta.runId,
              durationMs: Math.max(0, clock.now().getTime() - startedMs),
              attributes: {
                adapterKind: meta.kind,
                provider: meta.provider,
                operation: meta.operation,
              },
            });
          }
          return result;
        } catch (err) {
          emitter.emit({
            eventName: failureEventName(err),
            runId: meta.runId,
            durationMs: Math.max(0, clock.now().getTime() - startedMs),
            attributes: {
              adapterKind: meta.kind,
              provider: meta.provider,
              operation: meta.operation,
              failureCode: safeFailureCode(err),
            },
          });
          throw err;
        }
      },
    };
    out.extract = extract;
  }

  if (ports.verify) {
    const inner = ports.verify;
    const verify: VerificationAdapter = {
      async verify(request) {
        const startedMs = clock.now().getTime();
        const meta: AdapterTelemetryMeta = {
          kind: 'verify',
          provider: providers?.verify ?? 'http',
          operation: 'verify',
          runId: request.run.id,
        };
        emitter.emit({
          eventName: 'adapter.started',
          runId: meta.runId,
          attributes: {
            adapterKind: meta.kind,
            provider: meta.provider,
            operation: meta.operation,
          },
        });
        try {
          const result = await inner.verify(request);
          if (!result.ok) {
            emitSoftFailure(emitter, clock, meta, startedMs, result.reasonCode);
          } else {
            emitter.emit({
              eventName: 'adapter.completed',
              runId: meta.runId,
              durationMs: Math.max(0, clock.now().getTime() - startedMs),
              attributes: {
                adapterKind: meta.kind,
                provider: meta.provider,
                operation: meta.operation,
              },
            });
          }
          return result;
        } catch (err) {
          emitter.emit({
            eventName: failureEventName(err),
            runId: meta.runId,
            durationMs: Math.max(0, clock.now().getTime() - startedMs),
            attributes: {
              adapterKind: meta.kind,
              provider: meta.provider,
              operation: meta.operation,
              failureCode: safeFailureCode(err),
            },
          });
          throw err;
        }
      },
    };
    out.verify = verify;
  }

  if (ports.ai) {
    const inner = ports.ai;
    const ai: AiAdapter = {
      async evaluate(request) {
        const startedMs = clock.now().getTime();
        const meta: AdapterTelemetryMeta = {
          kind: 'ai',
          provider: providers?.ai ?? 'openai',
          operation: 'evaluate',
          runId: request.run.id,
        };
        emitter.emit({
          eventName: 'adapter.started',
          runId: meta.runId,
          attributes: {
            adapterKind: meta.kind,
            provider: meta.provider,
            operation: meta.operation,
          },
        });
        try {
          const result = await inner.evaluate(request);
          if (!result.ok) {
            emitSoftFailure(emitter, clock, meta, startedMs, result.reasonCode);
          } else {
            emitter.emit({
              eventName: 'adapter.completed',
              runId: meta.runId,
              durationMs: Math.max(0, clock.now().getTime() - startedMs),
              attributes: {
                adapterKind: meta.kind,
                provider: meta.provider,
                operation: meta.operation,
              },
            });
          }
          return result;
        } catch (err) {
          emitter.emit({
            eventName: failureEventName(err),
            runId: meta.runId,
            durationMs: Math.max(0, clock.now().getTime() - startedMs),
            attributes: {
              adapterKind: meta.kind,
              provider: meta.provider,
              operation: meta.operation,
              failureCode: safeFailureCode(err),
            },
          });
          throw err;
        }
      },
    };
    out.ai = ai;
  }

  return out;
}

export function wrapResultWriterForTelemetry(
  writer: ResultWriter,
  emitter: TelemetryEmitter
): ResultWriter {
  return {
    async create(result) {
      try {
        const created = await writer.create(result);
        emitter.emit({
          eventName: 'persistence.created',
          runId: result.promotedFromRunId,
          profileId: result.profileId,
          strategyId: result.strategyId,
          attributes: {
            resultId: created.id,
            entity: 'result',
          },
        });
        return created;
      } catch (err) {
        emitter.emit({
          eventName: 'persistence.failed',
          runId: result.promotedFromRunId,
          profileId: result.profileId,
          strategyId: result.strategyId,
          attributes: {
            entity: 'result',
            operation: 'create',
            errorName: err instanceof Error ? err.name : 'Error',
          },
        });
        throw err;
      }
    },
    async update(result) {
      try {
        const updated = await writer.update(result);
        emitter.emit({
          eventName: 'persistence.updated',
          runId: result.promotedFromRunId,
          profileId: result.profileId,
          strategyId: result.strategyId,
          attributes: {
            resultId: updated.id,
            entity: 'result',
          },
        });
        return updated;
      } catch (err) {
        emitter.emit({
          eventName: 'persistence.failed',
          runId: result.promotedFromRunId,
          profileId: result.profileId,
          strategyId: result.strategyId,
          attributes: {
            entity: 'result',
            operation: 'update',
            errorName: err instanceof Error ? err.name : 'Error',
          },
        });
        throw err;
      }
    },
  };
}

export function wrapExecutionQueueForTelemetry(
  queue: DiscoveryExecutionQueue,
  emitter: TelemetryEmitter
): DiscoveryExecutionQueue {
  return {
    async enqueue(input) {
      const result = await queue.enqueue(input);
      if (result.ok) {
        emitter.emit({
          eventName: 'queue.enqueued',
          runId: input.runId,
          jobId: input.jobId,
          scheduleId: input.scheduleId,
          profileId: input.profileId,
          strategyId: input.strategyId,
        });
      }
      return result;
    },
    async dequeue(options) {
      const job = await queue.dequeue(options);
      if (job) {
        emitter.emit({
          eventName: 'queue.claimed',
          runId: job.runId,
          jobId: job.jobId,
          scheduleId: job.scheduleId,
          profileId: job.profileId,
          strategyId: job.strategyId,
          attempt: job.attempt,
          attributes: {
            claimOwner: job.claimOwner,
          },
        });
      }
      return job;
    },
    async ack(jobId, finishedAt, options) {
      await queue.ack(jobId, finishedAt, options);
      const job = await queue.get(jobId);
      emitter.emit({
        eventName: 'queue.acked',
        jobId,
        runId: job?.runId,
        scheduleId: job?.scheduleId,
        profileId: job?.profileId,
        strategyId: job?.strategyId,
        attempt: job?.attempt,
      });
    },
    async fail(jobId, finishedAt, reason, options) {
      await queue.fail(jobId, finishedAt, reason, options);
      const job = await queue.get(jobId);
      emitter.emit({
        eventName: 'queue.failed',
        jobId,
        runId: job?.runId,
        scheduleId: job?.scheduleId,
        profileId: job?.profileId,
        strategyId: job?.strategyId,
        attempt: job?.attempt,
        attributes: {
          reason,
        },
      });
    },
    async retry(jobId, availableAt, reason, options) {
      await queue.retry(jobId, availableAt, reason, options);
      const job = await queue.get(jobId);
      emitter.emit({
        eventName: 'queue.retried',
        jobId,
        runId: job?.runId,
        scheduleId: job?.scheduleId,
        profileId: job?.profileId,
        strategyId: job?.strategyId,
        attempt: job?.attempt,
        attributes: {
          reason,
          availableAt,
        },
      });
    },
    get: (jobId) => queue.get(jobId),
    getByRunId: (runId) => queue.getByRunId(runId),
    getPending: () => queue.getPending(),
    hasActiveRun: (runId) => queue.hasActiveRun(runId),
    async recoverExpiredClaims(now) {
      const result = await queue.recoverExpiredClaims(now);
      for (const jobId of result.recoveredJobIds) {
        const job = await queue.get(jobId);
        emitter.emit({
          eventName: 'queue.recovered',
          jobId,
          runId: job?.runId,
          scheduleId: job?.scheduleId,
          profileId: job?.profileId,
          strategyId: job?.strategyId,
          attempt: job?.attempt,
        });
      }
      return result;
    },
    getHealthStats: (now, options) => queue.getHealthStats(now, options),
  };
}
