import { createHash } from 'node:crypto';
import type { RawContentRef } from '../../types/candidate.js';
import type {
  AdapterContext,
  FetchAdapter,
  FetchRequest,
  FetchResult,
} from '../../pipeline/adapters.js';
import type { RawContentStore } from '../../pipeline/fakes/raw-content-store.js';
import {
  AdapterFailureError,
  assertAttributableSourceUrl,
  createInMemoryRateLimiter,
  executeWithTimeout,
  type RateLimiter,
} from '../../adapter-infra/index.js';
import {
  createFetchHttpTransport,
  type HttpTransport,
} from '../http-transport.js';

export const HTTP_FETCH_PROVIDER_ID = 'http' as const;

/** Default ~1.5 MiB — enough for typical HTML, not unbounded. */
export const DEFAULT_MAX_RESPONSE_BYTES = 1_500_000;

export const DEFAULT_ALLOWED_CONTENT_TYPES = [
  'text/html',
  'application/xhtml+xml',
  'text/plain',
] as const;

const DEFAULT_USER_AGENT =
  'ArrivalAtlasDiscovery/0.1 (+https://arrival-atlas.example; fetch-adapter)';

/**
 * Resolved config — composition root injects deps; adapter never reads process.env.
 */
export type ProductionFetchAdapterConfig = {
  rawContentStore: RawContentStore;
  transport?: HttpTransport;
  rateLimiter?: RateLimiter;
  timeoutMs?: number;
  maxResponseBytes?: number;
  allowedContentTypes?: readonly string[];
  userAgent?: string;
  /** Bounded redirect hops for default transport (ignored if custom transport) */
  maxRedirects?: number;
};

export function createProductionFetchAdapter(
  config: ProductionFetchAdapterConfig
): FetchAdapter {
  return createHttpFetchAdapter(config);
}

export function createHttpFetchAdapter(
  config: ProductionFetchAdapterConfig
): FetchAdapter {
  const transport =
    config.transport ??
    createFetchHttpTransport({
      maxRedirects: config.maxRedirects ?? 5,
      defaultUserAgent: config.userAgent ?? DEFAULT_USER_AGENT,
    });
  const rateLimiter = config.rateLimiter ?? createInMemoryRateLimiter();
  const maxResponseBytes = config.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const allowed = new Set(
    (config.allowedContentTypes ?? DEFAULT_ALLOWED_CONTENT_TYPES).map((t) =>
      t.toLowerCase()
    )
  );
  const userAgent = config.userAgent ?? DEFAULT_USER_AGENT;
  const store = config.rawContentStore;

  return {
    async fetch(
      request: FetchRequest,
      context: AdapterContext
    ): Promise<FetchResult> {
      const sourceUrl = request.url?.trim() ?? '';

      try {
        validateFetchUrl(sourceUrl);
      } catch (err) {
        return failureFromError(err, sourceUrl || undefined);
      }

      const timeoutMs = context.timeoutMs ?? config.timeoutMs;
      const execCtx = {
        runId: context.run.id,
        signal: context.signal,
        timeoutMs,
      };

      try {
        await rateLimiter.acquire(`fetch:${HTTP_FETCH_PROVIDER_ID}`, execCtx);

        return await executeWithTimeout(
          async (signal) => {
            let response;
            try {
              response = await transport.request({
                url: sourceUrl,
                method: 'GET',
                headers: {
                  Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
                  'User-Agent': userAgent,
                },
                signal,
                maxBytes: maxResponseBytes,
              });
            } catch (err) {
              if (AdapterFailureError.isAdapterFailure(err)) throw err;
              if (signal.aborted) throw err;
              throw new AdapterFailureError({
                code: 'NETWORK_ERROR',
                message: 'Fetch transport network failure',
                adapter: 'fetch',
                operation: 'http_get',
                retryable: true,
              });
            }

            if (response.truncated) {
              throw new AdapterFailureError({
                code: 'INVALID_RESPONSE',
                message: 'Fetch response exceeded maxResponseBytes',
                adapter: 'fetch',
                operation: 'http_get',
                retryable: false,
              });
            }

            mapHttpStatus(response.status);

            const contentType = normalizeContentType(
              response.headers?.['content-type']
            );
            if (!contentType || !allowed.has(contentType)) {
              throw new AdapterFailureError({
                code: 'INVALID_RESPONSE',
                message: 'Fetch response content-type not allowed',
                adapter: 'fetch',
                operation: 'http_get',
                retryable: false,
              });
            }

            const body = response.bodyText ?? '';
            if (Buffer.byteLength(body, 'utf8') > maxResponseBytes) {
              throw new AdapterFailureError({
                code: 'INVALID_RESPONSE',
                message: 'Fetch response exceeded maxResponseBytes',
                adapter: 'fetch',
                operation: 'http_get',
                retryable: false,
              });
            }

            const contentHash = sha256Hex(body);
            const capturedAt = context.now();
            const ref = `raw:${contentHash}`;
            store.put(ref, { body, contentType });

            const attributedUrl = response.finalUrl ?? sourceUrl;
            assertAttributableSourceUrl(attributedUrl, {
              adapter: 'fetch',
              operation: 'http_get',
            });

            const content: RawContentRef = {
              ref,
              contentType,
              sourceUrl: attributedUrl,
              contentHash,
              capturedAt,
            };

            return {
              ok: true as const,
              content,
              fetchedAt: capturedAt,
              sourceUrl: attributedUrl,
            };
          },
          {
            adapter: 'fetch',
            operation: 'http_get',
            timeoutMs,
            signal: context.signal,
            runId: context.run.id,
          }
        );
      } catch (err) {
        return failureFromError(err, sourceUrl);
      }
    },
  };
}

function validateFetchUrl(url: string): void {
  if (!url) {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: 'Fetch URL is missing',
      adapter: 'fetch',
      operation: 'http_get',
      retryable: false,
    });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: 'Fetch URL is invalid',
      adapter: 'fetch',
      operation: 'http_get',
      retryable: false,
    });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AdapterFailureError({
      code: 'POLICY_BLOCKED',
      message: 'Fetch URL scheme not allowed',
      adapter: 'fetch',
      operation: 'http_get',
      retryable: false,
    });
  }
  assertAttributableSourceUrl(url, {
    adapter: 'fetch',
    operation: 'http_get',
  });
}

function mapHttpStatus(status: number): void {
  if (status >= 200 && status < 300) return;
  if (status === 401) {
    throw new AdapterFailureError({
      code: 'AUTH_REQUIRED',
      message: 'Fetch authentication required',
      adapter: 'fetch',
      operation: 'http_get',
      retryable: false,
    });
  }
  if (status === 403) {
    throw new AdapterFailureError({
      code: 'POLICY_BLOCKED',
      message: 'Fetch forbidden by remote host',
      adapter: 'fetch',
      operation: 'http_get',
      retryable: false,
    });
  }
  if (status === 408) {
    throw new AdapterFailureError({
      code: 'TIMEOUT',
      message: 'Fetch timed out (HTTP 408)',
      adapter: 'fetch',
      operation: 'http_get',
      retryable: true,
    });
  }
  if (status === 429) {
    throw new AdapterFailureError({
      code: 'RATE_LIMITED',
      message: 'Fetch rate limited by remote host',
      adapter: 'fetch',
      operation: 'http_get',
      retryable: true,
    });
  }
  if (status >= 500) {
    throw new AdapterFailureError({
      code: 'UNAVAILABLE',
      message: `Fetch remote unavailable (HTTP ${status})`,
      adapter: 'fetch',
      operation: 'http_get',
      retryable: true,
    });
  }
  if (status >= 400) {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: `Fetch HTTP client error (HTTP ${status})`,
      adapter: 'fetch',
      operation: 'http_get',
      retryable: false,
    });
  }
  throw new AdapterFailureError({
    code: 'INVALID_RESPONSE',
    message: `Fetch unexpected HTTP status ${status}`,
    adapter: 'fetch',
    operation: 'http_get',
    retryable: false,
  });
}

function normalizeContentType(header: string | undefined): string {
  if (!header) return '';
  return header.split(';')[0]!.trim().toLowerCase();
}

function sha256Hex(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

function failureFromError(err: unknown, sourceUrl?: string): FetchResult {
  if (AdapterFailureError.isTimeout(err)) {
    return {
      ok: false,
      reasonCode: 'FETCH_TIMEOUT',
      failureCode: 'TIMEOUT',
      message: sanitizeMessage('Fetch timed out'),
      sourceUrl,
    };
  }
  if (AdapterFailureError.isCancelled(err)) {
    return {
      ok: false,
      reasonCode: 'FETCH_CANCELLED',
      failureCode: 'CANCELLED',
      message: sanitizeMessage('Fetch cancelled'),
      sourceUrl,
    };
  }
  if (AdapterFailureError.isAdapterFailure(err)) {
    return {
      ok: false,
      reasonCode: 'FETCH_FAILED',
      failureCode: err.failure.code,
      message: sanitizeMessage(err.message),
      sourceUrl,
    };
  }
  return {
    ok: false,
    reasonCode: 'FETCH_FAILED',
    failureCode: 'UNKNOWN',
    message: 'Fetch failed',
    sourceUrl,
  };
}

function sanitizeMessage(message: string): string {
  if (/(authorization|api[_-]?key|cookie|bearer|set-cookie)/i.test(message)) {
    return '[redacted]';
  }
  return message.replace(/[A-Za-z0-9_\-]{32,}/g, '[redacted]');
}
