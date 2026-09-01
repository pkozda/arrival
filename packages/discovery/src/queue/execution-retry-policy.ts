import type { AdapterFailure, AdapterFailureCode } from '../adapter-infra/types.js';
import {
  defaultShouldRetryAdapterFailure,
  isRetryableAdapterFailure,
} from '../adapter-infra/retry-policy.js';
import { AdapterFailureError } from '../adapter-infra/errors.js';

/**
 * Engine-wide durable execution retry policy (E5.4).
 *
 * Distinct from E3.1 adapter-level RetryPolicy / wouldRetry:
 * - E3.1 classifies whether an adapter *may* be retried
 * - E5.4 decides whether the *execution job* is re-queued with backoff
 *
 * Adapters remain single-attempt; the worker applies this policy.
 */
export type ExecutionRetryConfig = {
  /** Max execution attempts including the first (default 3). */
  maxAttempts: number;
  /** Base backoff delay in ms (default 1000). */
  baseDelayMs: number;
  /** Cap on backoff delay in ms (default 60000). */
  maxDelayMs: number;
};

export const DEFAULT_EXECUTION_RETRY_CONFIG: ExecutionRetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
};

export type RetryDecisionInput = {
  failure: AdapterFailure;
  /** 1-based attempt that just completed (failed). */
  attempt: number;
  now: string;
};

export type RetryDecision =
  | {
      kind: 'retry';
      /** Next attempt number after re-queue. */
      nextAttempt: number;
      delayMs: number;
      availableAt: string;
      reason: 'retryable_failure';
      failureCode: AdapterFailureCode;
      diagnostic: 'RETRY_SCHEDULED';
    }
  | {
      kind: 'no_retry';
      reason: 'not_retryable' | 'retry_exhausted' | 'cancelled';
      failureCode: AdapterFailureCode;
      diagnostic: 'RETRY_NOT_ALLOWED' | 'RETRY_EXHAUSTED';
    };

export type DiscoveryExecutionRetryPolicy = {
  decide(input: RetryDecisionInput): RetryDecision;
};

export function computeBackoffDelayMs(
  completedAttempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exp = Math.max(0, completedAttempt - 1);
  const raw = baseDelayMs * 2 ** exp;
  return Math.min(maxDelayMs, raw);
}

export function createDefaultExecutionRetryPolicy(
  config: Partial<ExecutionRetryConfig> = {}
): DiscoveryExecutionRetryPolicy {
  const resolved: ExecutionRetryConfig = {
    maxAttempts: config.maxAttempts ?? DEFAULT_EXECUTION_RETRY_CONFIG.maxAttempts,
    baseDelayMs: config.baseDelayMs ?? DEFAULT_EXECUTION_RETRY_CONFIG.baseDelayMs,
    maxDelayMs: config.maxDelayMs ?? DEFAULT_EXECUTION_RETRY_CONFIG.maxDelayMs,
  };

  return {
    decide(input: RetryDecisionInput): RetryDecision {
      const { failure, attempt, now } = input;

      if (failure.code === 'CANCELLED') {
        return {
          kind: 'no_retry',
          reason: 'cancelled',
          failureCode: failure.code,
          diagnostic: 'RETRY_NOT_ALLOWED',
        };
      }

      if (!isRetryableAdapterFailure(failure)) {
        return {
          kind: 'no_retry',
          reason: 'not_retryable',
          failureCode: failure.code,
          diagnostic: 'RETRY_NOT_ALLOWED',
        };
      }

      if (attempt >= resolved.maxAttempts) {
        return {
          kind: 'no_retry',
          reason: 'retry_exhausted',
          failureCode: failure.code,
          diagnostic: 'RETRY_EXHAUSTED',
        };
      }

      const delayMs = computeBackoffDelayMs(
        attempt,
        resolved.baseDelayMs,
        resolved.maxDelayMs
      );
      const availableAt = new Date(Date.parse(now) + delayMs).toISOString();

      return {
        kind: 'retry',
        nextAttempt: attempt + 1,
        delayMs,
        availableAt,
        reason: 'retryable_failure',
        failureCode: failure.code,
        diagnostic: 'RETRY_SCHEDULED',
      };
    },
  };
}

/**
 * Normalize thrown errors into AdapterFailure for policy decisions.
 * Non-adapter errors become non-retryable UNKNOWN.
 */
export function toExecutionAdapterFailure(err: unknown): AdapterFailure {
  if (AdapterFailureError.isAdapterFailure(err)) {
    return err.failure;
  }
  return {
    code: 'UNKNOWN',
    message: err instanceof Error ? err.message : 'Executor failed',
    adapter: 'execution',
    operation: 'execute',
    retryable: false,
  };
}

export {
  defaultShouldRetryAdapterFailure,
  isRetryableAdapterFailure,
};
