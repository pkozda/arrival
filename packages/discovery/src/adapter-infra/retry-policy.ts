import type { AdapterFailure, AdapterFailureCode, RetryPolicy } from './types.js';
import { NO_RETRY } from './types.js';

export { NO_RETRY };

/** Codes that are never automatically retried (E5.4). */
export const NON_RETRYABLE_ADAPTER_FAILURE_CODES: ReadonlySet<AdapterFailureCode> =
  new Set([
    'CANCELLED',
    'AUTH_REQUIRED',
    'POLICY_BLOCKED',
    'INVALID_RESPONSE',
    'AI_OUTPUT_INVALID',
  ]);

/** Codes that are retryable by default (E5.4). */
export const RETRYABLE_ADAPTER_FAILURE_CODES: ReadonlySet<AdapterFailureCode> =
  new Set(['TIMEOUT', 'NETWORK_ERROR', 'UNAVAILABLE', 'RATE_LIMITED']);

/**
 * Centralized adapter-failure classification for execution retry.
 * Provider-agnostic — based on AdapterFailureCode (+ explicit retryable flag).
 *
 * UNKNOWN is retryable only when `failure.retryable === true`.
 */
export function isRetryableAdapterFailure(failure: AdapterFailure): boolean {
  if (NON_RETRYABLE_ADAPTER_FAILURE_CODES.has(failure.code)) {
    return false;
  }
  if (failure.retryable === false) {
    return false;
  }
  if (RETRYABLE_ADAPTER_FAILURE_CODES.has(failure.code)) {
    return true;
  }
  if (failure.code === 'UNKNOWN') {
    return failure.retryable === true;
  }
  return false;
}

/**
 * Whether a future retry loop *may* attempt another call.
 * E3.1 compatibility: if `shouldRetry` is omitted → never.
 * When `shouldRetry` is provided, also require maxAttempts / attempt gates.
 */
export function wouldRetry(
  policy: RetryPolicy,
  failure: AdapterFailure,
  attempt: number
): boolean {
  if (policy.maxAttempts <= 1) return false;
  if (attempt >= policy.maxAttempts) return false;
  if (!policy.shouldRetry) return false;
  return policy.shouldRetry(failure);
}

/**
 * Default shouldRetry predicate for engine-wide execution retries (E5.4).
 * Use with RetryPolicy or DiscoveryExecutionRetryPolicy.
 */
export function defaultShouldRetryAdapterFailure(failure: AdapterFailure): boolean {
  return isRetryableAdapterFailure(failure);
}
