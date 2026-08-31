import type { AdapterExecutionContext } from './types.js';
import { AdapterFailureError } from './errors.js';

export type TimeoutExecutionOptions = {
  adapter: string;
  operation: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  runId?: string;
};

/**
 * Throw CANCELLED if the signal is already aborted.
 * Cancellation is never a successful result.
 */
export function assertNotAborted(
  signal: AbortSignal | undefined,
  adapter: string,
  operation: string
): void {
  if (signal?.aborted) {
    throw new AdapterFailureError({
      code: 'CANCELLED',
      message: `Adapter operation cancelled: ${adapter}.${operation}`,
      adapter,
      operation,
      retryable: false,
    });
  }
}

function cancelledError(adapter: string, operation: string): AdapterFailureError {
  return new AdapterFailureError({
    code: 'CANCELLED',
    message: `Adapter operation cancelled: ${adapter}.${operation}`,
    adapter,
    operation,
    retryable: false,
  });
}

function timeoutError(
  adapter: string,
  operation: string,
  timeoutMs: number
): AdapterFailureError {
  return new AdapterFailureError({
    code: 'TIMEOUT',
    message: `Adapter operation timed out after ${timeoutMs}ms: ${adapter}.${operation}`,
    adapter,
    operation,
    retryable: true,
  });
}

/**
 * Run an async adapter work function with optional timeout + AbortSignal.
 * Timeout / cancel → AdapterFailureError; never treated as success.
 *
 * Does not implement retries.
 */
export async function executeWithTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  options: TimeoutExecutionOptions
): Promise<T> {
  const { adapter, operation, timeoutMs, signal: outer } = options;
  assertNotAborted(outer, adapter, operation);

  const controller = new AbortController();
  const onOuterAbort = () => {
    controller.abort();
  };
  if (outer) {
    outer.addEventListener('abort', onOuterAbort, { once: true });
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const races: Promise<T>[] = [];

  if (outer) {
    races.push(
      new Promise<T>((_, reject) => {
        if (outer.aborted) {
          reject(cancelledError(adapter, operation));
          return;
        }
        outer.addEventListener(
          'abort',
          () => reject(cancelledError(adapter, operation)),
          { once: true }
        );
      })
    );
  }

  if (timeoutMs !== undefined && timeoutMs > 0) {
    races.push(
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(timeoutError(adapter, operation, timeoutMs));
        }, timeoutMs);
      })
    );
  }

  try {
    const workPromise = work(controller.signal).then(
      (value) => value,
      (err: unknown) => {
        if (outer?.aborted) {
          throw cancelledError(adapter, operation);
        }
        if (controller.signal.aborted && timeoutMs !== undefined && timeoutMs > 0) {
          // May race with timeout promise; prefer TIMEOUT classification
          throw timeoutError(adapter, operation, timeoutMs);
        }
        throw err;
      }
    );

    if (races.length === 0) {
      return await workPromise;
    }
    return await Promise.race([workPromise, ...races]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (outer) outer.removeEventListener('abort', onOuterAbort);
  }
}

export function executionContextFromOptions(
  runId: string,
  options: Pick<TimeoutExecutionOptions, 'signal' | 'timeoutMs'> & {
    metadata?: Record<string, string>;
  }
): AdapterExecutionContext {
  return {
    runId,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    metadata: options.metadata,
  };
}
