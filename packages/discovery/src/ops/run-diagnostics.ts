import { DEFAULT_ENGINE_POLICY, type EnginePolicy } from '../engine-policy.js';
import type { NotificationStore } from '../notifications/notification-store.js';
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationFailureCode,
} from '../notifications/types.js';
import type { ResultStore } from '../pipeline/result-store.js';
import { sanitizeRuntimeErrorMessage } from '../runtime/runtime-config.js';
import type { ScheduledRunRecord } from '../scheduler/types.js';
import type { DiscoveryRunStatus } from '../types/run.js';
import type { DiscoveryRunFunnelDiagnostics } from './run-funnel-diagnostics.js';

export type RunPromotionSummary = {
  newResults?: number;
  updatedResults?: number;
};

export type RunDiagnosticsNotification = {
  status: NotificationDeliveryStatus;
  channel?: NotificationChannel;
  failureCode?: NotificationFailureCode;
};

export type RunDiagnosticsError = {
  message?: string;
};

export type RunDiagnosticsAi = {
  /** Configured engine budget — not per-run usage (not durably persisted today). */
  maxEvaluations?: number;
};

/**
 * Operator-safe run diagnostic projection (E11.2).
 * Built from durable run, result, and notification stores only.
 */
export type DiscoveryRunDiagnostics = {
  runId: string;
  profileId: string;
  scheduleId: string;
  status: DiscoveryRunStatus;
  trigger?: ScheduledRunRecord['trigger'];
  startedAt: string;
  finishedAt?: string;
  skipReason?: string;
  summary?: RunPromotionSummary;
  ai?: RunDiagnosticsAi;
  notification?: RunDiagnosticsNotification;
  error?: RunDiagnosticsError;
  /** E12.8 — compact pipeline funnel from execution-job metadata when available. */
  funnel?: DiscoveryRunFunnelDiagnostics;
};

export function summarizeRunPromotions(
  results: readonly {
    promotedFromRunId?: string;
    firstSeenAt: string;
    lastChangedAt: string;
  }[],
  run: Pick<ScheduledRunRecord, 'runId' | 'startedAt'>
): RunPromotionSummary | undefined {
  const startedMs = Date.parse(run.startedAt);
  if (Number.isNaN(startedMs)) {
    return undefined;
  }

  let newResults = 0;
  let updatedResults = 0;
  let matched = false;

  for (const result of results) {
    if (result.promotedFromRunId !== run.runId) {
      continue;
    }
    matched = true;
    const firstSeenMs = Date.parse(result.firstSeenAt);
    const lastChangedMs = Date.parse(result.lastChangedAt);
    if (!Number.isNaN(firstSeenMs) && firstSeenMs >= startedMs) {
      newResults += 1;
    } else if (!Number.isNaN(lastChangedMs) && lastChangedMs >= startedMs) {
      updatedResults += 1;
    }
  }

  if (!matched) {
    return undefined;
  }

  return {
    ...(newResults > 0 ? { newResults } : {}),
    ...(updatedResults > 0 ? { updatedResults } : {}),
    ...(newResults === 0 && updatedResults === 0 ? { newResults: 0, updatedResults: 0 } : {}),
  };
}

export async function buildDiscoveryRunDiagnostics(input: {
  run: ScheduledRunRecord;
  resultStore: ResultStore;
  notificationStore: NotificationStore;
  enginePolicy?: EnginePolicy;
  errorSecrets?: readonly string[];
  funnel?: DiscoveryRunFunnelDiagnostics;
}): Promise<DiscoveryRunDiagnostics> {
  const results = await input.resultStore.listByProfile(input.run.profileId);
  const summary = summarizeRunPromotions(results, input.run);
  const notification = await input.notificationStore.findByRunId(input.run.runId);
  const policy = input.enginePolicy ?? DEFAULT_ENGINE_POLICY;

  const diagnostics: DiscoveryRunDiagnostics = {
    runId: input.run.runId,
    profileId: input.run.profileId,
    scheduleId: input.run.scheduleId,
    status: input.run.status,
    trigger: input.run.trigger,
    startedAt: input.run.startedAt,
    finishedAt: input.run.finishedAt,
    skipReason: input.run.skipReason,
  };

  if (summary) {
    diagnostics.summary = summary;
  }

  if (policy.maxAiEvaluationsPerRun > 0) {
    diagnostics.ai = { maxEvaluations: policy.maxAiEvaluationsPerRun };
  }

  if (notification) {
    diagnostics.notification = {
      status: notification.status,
      channel: notification.channel,
      ...(notification.failure?.code
        ? { failureCode: notification.failure.code }
        : {}),
    };
  }

  if (input.run.errorMessage) {
    diagnostics.error = {
      message: sanitizeRuntimeErrorMessage(
        input.run.errorMessage,
        input.errorSecrets ?? []
      ),
    };
  }

  if (input.funnel) {
    diagnostics.funnel = input.funnel;
  }

  return diagnostics;
}
