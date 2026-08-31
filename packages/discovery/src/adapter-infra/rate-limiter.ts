import type { AdapterExecutionContext, RateLimiter } from './types.js';
import { AdapterFailureError } from './errors.js';

export type InMemoryRateLimiterOptions = {
  /**
   * Optional hard cap per key for tests.
   * When exceeded, acquire fails with RATE_LIMITED (no silent success).
   */
  maxAcquiresPerKey?: number;
};

/**
 * In-memory RateLimiter for tests / local adapters.
 * No Redis, DB, or process-global singleton — each factory call is isolated.
 */
export function createInMemoryRateLimiter(
  options: InMemoryRateLimiterOptions = {}
): RateLimiter & {
  acquireCount(key: string): number;
  reset(): void;
} {
  const counts = new Map<string, number>();
  const max = options.maxAcquiresPerKey;

  return {
    async acquire(key: string, context?: AdapterExecutionContext): Promise<void> {
      if (context?.signal?.aborted) {
        throw new AdapterFailureError({
          code: 'CANCELLED',
          message: `Rate limiter acquire cancelled for key ${key}`,
          adapter: 'rate_limiter',
          operation: 'acquire',
          retryable: false,
        });
      }

      const next = (counts.get(key) ?? 0) + 1;
      if (max !== undefined && next > max) {
        throw new AdapterFailureError({
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded for key ${key}`,
          adapter: 'rate_limiter',
          operation: 'acquire',
          retryable: true,
        });
      }
      counts.set(key, next);
    },

    acquireCount(key: string): number {
      return counts.get(key) ?? 0;
    },

    reset(): void {
      counts.clear();
    },
  };
}
