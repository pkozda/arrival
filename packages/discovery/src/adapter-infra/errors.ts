import type { AdapterFailure, AdapterFailureCode } from './types.js';

/**
 * Adapter-neutral operation failure.
 * Distinguishable from ordinary Error and from successful empty results.
 */
export class AdapterFailureError extends Error {
  readonly failure: AdapterFailure;

  constructor(failure: AdapterFailure, options?: { cause?: unknown }) {
    super(failure.message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AdapterFailureError';
    this.failure = failure;
  }

  get code(): AdapterFailureCode {
    return this.failure.code;
  }

  get adapter(): string {
    return this.failure.adapter;
  }

  get operation(): string {
    return this.failure.operation;
  }

  static isAdapterFailure(err: unknown): err is AdapterFailureError {
    return err instanceof AdapterFailureError;
  }

  static isCancelled(err: unknown): boolean {
    return err instanceof AdapterFailureError && err.failure.code === 'CANCELLED';
  }

  static isTimeout(err: unknown): boolean {
    return err instanceof AdapterFailureError && err.failure.code === 'TIMEOUT';
  }

  static fromUnknown(
    err: unknown,
    base: Pick<AdapterFailure, 'adapter' | 'operation'>
  ): AdapterFailureError {
    if (err instanceof AdapterFailureError) return err;
    const message = err instanceof Error ? err.message : 'Unknown adapter failure';
    return new AdapterFailureError({
      code: 'UNKNOWN',
      message,
      adapter: base.adapter,
      operation: base.operation,
      retryable: false,
    });
  }
}

/** Map failure codes to adapter-neutral diagnostic reason codes. */
export function adapterFailureReasonCode(code: AdapterFailureCode): string {
  switch (code) {
    case 'TIMEOUT':
      return 'ADAPTER_TIMEOUT';
    case 'CANCELLED':
      return 'ADAPTER_CANCELLED';
    case 'UNAVAILABLE':
      return 'ADAPTER_UNAVAILABLE';
    case 'RATE_LIMITED':
      return 'ADAPTER_RATE_LIMITED';
    case 'INVALID_RESPONSE':
      return 'ADAPTER_INVALID_RESPONSE';
    case 'NETWORK_ERROR':
      return 'ADAPTER_NETWORK_ERROR';
    case 'AUTH_REQUIRED':
      return 'ADAPTER_AUTH_REQUIRED';
    case 'POLICY_BLOCKED':
      return 'ADAPTER_POLICY_BLOCKED';
    case 'UNKNOWN':
    default:
      return 'ADAPTER_UNKNOWN';
  }
}
