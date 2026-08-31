import { describe, expect, it, vi } from 'vitest';
import {
  AdapterFailureError,
  NO_RETRY,
  adapterFailureReasonCode,
  adapterLifecycleDiagnostic,
  assertAttributableSourceUrl,
  assertNotAborted,
  createInMemoryRateLimiter,
  executeWithTimeout,
  sanitizeAdapterDiagnosticMessage,
  wouldRetry,
  type AdapterFailure,
  type RetryPolicy,
} from '../index.js';

describe('E3.1 Adapter infrastructure — cancellation', () => {
  it('signal already aborted → CANCELLED, not success', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => assertNotAborted(controller.signal, 'search', 'search')).toThrow(
      AdapterFailureError
    );
    await expect(
      executeWithTimeout(async () => [], {
        adapter: 'search',
        operation: 'search',
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ failure: { code: 'CANCELLED' } });
  });

  it('cancellation during execution → CANCELLED, not success', async () => {
    const controller = new AbortController();
    const pending = executeWithTimeout(
      async (signal) =>
        new Promise<string>((resolve, reject) => {
          const t = setTimeout(() => resolve('ok'), 500);
          signal.addEventListener('abort', () => {
            clearTimeout(t);
            reject(new Error('aborted'));
          });
        }),
      { adapter: 'fetch', operation: 'fetch', signal: controller.signal }
    );
    queueMicrotask(() => controller.abort());
    await expect(pending).rejects.toSatisfy(
      (err: unknown) => AdapterFailureError.isCancelled(err)
    );
  });
});

describe('E3.1 Adapter infrastructure — timeout', () => {
  it('operation completes before timeout', async () => {
    const value = await executeWithTimeout(async () => 'done', {
      adapter: 'fetch',
      operation: 'fetch',
      timeoutMs: 200,
    });
    expect(value).toBe('done');
  });

  it('operation exceeds timeout → TIMEOUT failure', async () => {
    await expect(
      executeWithTimeout(
        async (signal) =>
          new Promise<string>((resolve, reject) => {
            const t = setTimeout(() => resolve('late'), 200);
            signal.addEventListener('abort', () => {
              clearTimeout(t);
              reject(new Error('aborted'));
            });
          }),
        { adapter: 'fetch', operation: 'fetch', timeoutMs: 30 }
      )
    ).rejects.toSatisfy((err: unknown) => AdapterFailureError.isTimeout(err));
  });

  it('timeout is never a successful empty result', async () => {
    try {
      await executeWithTimeout(
        async () => new Promise((r) => setTimeout(() => r([]), 100)),
        { adapter: 'search', operation: 'search', timeoutMs: 20 }
      );
      expect.fail('should have thrown');
    } catch (err) {
      expect(AdapterFailureError.isTimeout(err)).toBe(true);
      expect(err).not.toEqual([]);
    }
  });
});

describe('E3.1 Adapter infrastructure — diagnostics', () => {
  it('preserves runId, adapter, operation, duration; redacts secrets', () => {
    const started = Date.now() - 12;
    const diag = adapterLifecycleDiagnostic({
      runId: 'run-1',
      stage: 'search',
      adapter: 'search',
      operation: 'searchQueries',
      startedAtMs: started,
      outcome: 'failure',
      failureCode: 'NETWORK_ERROR',
      message: 'upstream failed',
      attempt: 1,
    });
    expect(diag.runId).toBe('run-1');
    expect(diag.adapter).toBe('search');
    expect(diag.operation).toBe('searchQueries');
    expect(diag.attempt).toBe(1);
    expect(diag.durationMs).toBeGreaterThanOrEqual(0);
    expect(diag.reasonCode).toBe(adapterFailureReasonCode('NETWORK_ERROR'));
    expect(diag.message).not.toMatch(/authorization/i);

    expect(
      sanitizeAdapterDiagnosticMessage('Authorization: Bearer secret-token')
    ).toBe('[redacted: sensitive adapter diagnostic content]');
    expect(sanitizeAdapterDiagnosticMessage('ok')).toBe('ok');
  });
});

describe('E3.1 Adapter infrastructure — retry boundary', () => {
  const failure: AdapterFailure = {
    code: 'NETWORK_ERROR',
    message: 'down',
    adapter: 'search',
    operation: 'search',
    retryable: true,
  };

  it('NO_RETRY never retries', () => {
    expect(wouldRetry(NO_RETRY, failure, 1)).toBe(false);
  });

  it('maxAttempts>1 without shouldRetry → no automatic retry', () => {
    const policy: RetryPolicy = { maxAttempts: 3 };
    expect(wouldRetry(policy, failure, 1)).toBe(false);
  });

  it('explicit shouldRetry can allow retry (policy only — no loop)', () => {
    const policy: RetryPolicy = {
      maxAttempts: 3,
      shouldRetry: (f) => f.code === 'NETWORK_ERROR',
    };
    expect(wouldRetry(policy, failure, 1)).toBe(true);
    expect(wouldRetry(policy, failure, 3)).toBe(false);
  });

  it('does not auto-invoke retries', async () => {
    const work = vi.fn(async () => {
      throw new AdapterFailureError(failure);
    });
    await expect(
      executeWithTimeout(work, { adapter: 'search', operation: 'search' })
    ).rejects.toBeInstanceOf(AdapterFailureError);
    expect(work).toHaveBeenCalledTimes(1);
  });
});

describe('E3.1 Adapter infrastructure — rate limiter', () => {
  it('fake limiter is isolated (no global mutable state)', async () => {
    const a = createInMemoryRateLimiter();
    const b = createInMemoryRateLimiter();
    await a.acquire('search:google');
    expect(a.acquireCount('search:google')).toBe(1);
    expect(b.acquireCount('search:google')).toBe(0);
  });

  it('cap produces RATE_LIMITED failure', async () => {
    const limiter = createInMemoryRateLimiter({ maxAcquiresPerKey: 1 });
    await limiter.acquire('k');
    await expect(limiter.acquire('k')).rejects.toMatchObject({
      failure: { code: 'RATE_LIMITED' },
    });
  });
});

describe('E3.1 Adapter infrastructure — source attribution / content trust', () => {
  it('blocks missing and fabricated source URLs', () => {
    expect(() => assertAttributableSourceUrl(undefined)).toThrow(AdapterFailureError);
    expect(() => assertAttributableSourceUrl('ai-generated://fake')).toThrow(
      AdapterFailureError
    );
    expect(() =>
      assertAttributableSourceUrl('https://employer.example/jobs/1')
    ).not.toThrow();
  });
});
