/**
 * Adapter-neutral infrastructure types (E3.1).
 * No vendor SDKs, HTTP response objects, LLM clients, or DB clients.
 */

/** Slim execution context for infrastructure helpers (timeout, rate limit, diagnostics). */
export type AdapterExecutionContext = {
  runId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Non-sensitive string metadata only — never secrets, cookies, or auth headers */
  metadata?: Record<string, string>;
};

/**
 * Adapter-neutral failure vocabulary.
 * Adapter failure ≠ candidate rejection — pipeline decides staging consequences.
 */
export type AdapterFailureCode =
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'INVALID_RESPONSE'
  | 'NETWORK_ERROR'
  | 'AUTH_REQUIRED'
  | 'POLICY_BLOCKED'
  | 'UNKNOWN';

export type AdapterFailure = {
  code: AdapterFailureCode;
  message: string;
  adapter: string;
  operation: string;
  /** Hint for future retry loops — E3.1 does not auto-retry */
  retryable?: boolean;
};

/**
 * Retry boundary only — no automatic retry loop in E3.1.
 * Strategy must not own retries; adapters/infrastructure may.
 */
export type RetryPolicy = {
  /** 1 = no retry. Higher values are advisory until a retry loop is implemented. */
  maxAttempts: number;
  shouldRetry?: (failure: AdapterFailure) => boolean;
};

/** Explicit no-retry policy. */
export const NO_RETRY: RetryPolicy = { maxAttempts: 1 };

/**
 * Rate-limit boundary. Provider quotas must not leak into domain types.
 * Strategy must not know about rate limits.
 */
export interface RateLimiter {
  acquire(key: string, context?: AdapterExecutionContext): Promise<void>;
}
