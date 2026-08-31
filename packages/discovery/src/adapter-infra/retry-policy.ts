import type { AdapterFailure, RetryPolicy } from './types.js';
import { NO_RETRY } from './types.js';

export { NO_RETRY };

/**
 * Whether a future retry loop *may* attempt another call.
 * E3.1 does not run retries — this is the policy boundary only.
 *
 * Rules:
 * - maxAttempts <= 1 → never
 * - attempt is 1-based count of completed tries
 * - if shouldRetry is omitted → never (no automatic retry without explicit config)
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
