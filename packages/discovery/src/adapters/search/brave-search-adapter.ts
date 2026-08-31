import type { DiscoveryQuery } from '../../types/query.js';
import type { RawCandidatePayload } from '../../types/candidate.js';
import type { AdapterContext, SearchAdapter } from '../../pipeline/adapters.js';
import { PartialSearchError } from '../../pipeline/adapters.js';
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

/** Brave Search API — first production SearchAdapter (E3.2). */
export const BRAVE_SEARCH_PROVIDER_ID = 'brave' as const;

const DEFAULT_BASE_URL = 'https://api.search.brave.com/res/v1/web/search';
const DEFAULT_MAX_RESULTS = 10;
const BRAVE_MAX_COUNT = 20;

/**
 * Resolved config — composition root loads env; adapter never reads process.env.
 * Provider SDK types are not part of this surface.
 */
export type ProductionSearchAdapterConfig = {
  /** Brave Search API subscription token */
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Capped to Brave's max count (20) */
  maxResults?: number;
  rateLimiter?: RateLimiter;
  /** Injectable HTTP — tests supply a mock; production uses fetch */
  transport?: HttpTransport;
};

/** @internal Brave web result shape — not exported from package public API */
type BraveWebResult = {
  title?: unknown;
  url?: unknown;
  description?: unknown;
};

type BraveSearchResponse = {
  web?: {
    results?: unknown;
  };
};

/**
 * Create the production SearchAdapter (Brave Web Search).
 * Strategy-agnostic: consumes DiscoveryQuery, returns RawCandidatePayload[].
 */
export function createProductionSearchAdapter(
  config: ProductionSearchAdapterConfig
): SearchAdapter {
  return createBraveSearchAdapter(config);
}

export function createBraveSearchAdapter(
  config: ProductionSearchAdapterConfig
): SearchAdapter {
  const transport = config.transport ?? createFetchHttpTransport();
  const rateLimiter =
    config.rateLimiter ?? createInMemoryRateLimiter();
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const maxResults = Math.min(
    Math.max(1, config.maxResults ?? DEFAULT_MAX_RESULTS),
    BRAVE_MAX_COUNT
  );
  const defaultTimeoutMs = config.timeoutMs;

  return {
    async search(
      queries: DiscoveryQuery[],
      context: AdapterContext
    ): Promise<RawCandidatePayload[]> {
      const apiKey = config.apiKey?.trim();
      if (!apiKey) {
        throw new AdapterFailureError({
          code: 'AUTH_REQUIRED',
          message: 'Search adapter missing API key',
          adapter: 'search',
          operation: 'brave_web_search',
          retryable: false,
        });
      }

      const aggregated: RawCandidatePayload[] = [];
      const failures: string[] = [];

      const ordered = [...queries].sort(
        (a, b) => (a.priority ?? 0) - (b.priority ?? 0)
      );

      for (const query of ordered) {
        try {
          const part = await searchOneQuery({
            query,
            context,
            apiKey,
            transport,
            rateLimiter,
            baseUrl,
            maxResults,
            defaultTimeoutMs,
          });
          aggregated.push(...part.results);
          failures.push(...part.mappingFailures);
        } catch (err) {
          if (AdapterFailureError.isAdapterFailure(err)) {
            failures.push(
              `query:${query.id}:${err.failure.code}:${sanitizeFailureMessage(err.message)}`
            );
            continue;
          }
          const message =
            err instanceof Error ? err.message : 'unknown search failure';
          failures.push(`query:${query.id}:UNKNOWN:${sanitizeFailureMessage(message)}`);
        }
      }

      if (failures.length > 0 && aggregated.length > 0) {
        throw new PartialSearchError(aggregated, failures);
      }
      if (failures.length > 0 && aggregated.length === 0) {
        // Prefer the first structured failure code when every query failed
        const first = failures[0] ?? 'UNKNOWN';
        const codeMatch = first.match(/query:[^:]+:([A-Z_]+):/);
        const code = (codeMatch?.[1] ?? 'UNKNOWN') as import('../../adapter-infra/types.js').AdapterFailureCode;
        const known = [
          'TIMEOUT',
          'CANCELLED',
          'UNAVAILABLE',
          'RATE_LIMITED',
          'INVALID_RESPONSE',
          'NETWORK_ERROR',
          'AUTH_REQUIRED',
          'POLICY_BLOCKED',
          'UNKNOWN',
        ] as const;
        const failureCode = (known as readonly string[]).includes(code)
          ? (code as (typeof known)[number])
          : 'UNKNOWN';
        throw new AdapterFailureError({
          code: failureCode,
          message: `Search failed for all queries: ${failures.join('; ')}`,
          adapter: 'search',
          operation: 'brave_web_search',
          retryable: failureCode === 'TIMEOUT' || failureCode === 'RATE_LIMITED' || failureCode === 'UNAVAILABLE' || failureCode === 'NETWORK_ERROR',
        });
      }

      return aggregated;
    },
  };
}

type SearchOneResult = {
  results: RawCandidatePayload[];
  mappingFailures: string[];
};

async function searchOneQuery(input: {
  query: DiscoveryQuery;
  context: AdapterContext;
  apiKey: string;
  transport: HttpTransport;
  rateLimiter: RateLimiter;
  baseUrl: string;
  maxResults: number;
  defaultTimeoutMs?: number;
}): Promise<SearchOneResult> {
  const {
    query,
    context,
    apiKey,
    transport,
    rateLimiter,
    baseUrl,
    maxResults,
    defaultTimeoutMs,
  } = input;

  const timeoutMs = context.timeoutMs ?? defaultTimeoutMs;
  const execCtx = {
    runId: context.run.id,
    signal: context.signal,
    timeoutMs,
  };

  await rateLimiter.acquire(`search:${BRAVE_SEARCH_PROVIDER_ID}`, execCtx);

  return executeWithTimeout(
    async (signal) => {
      const url = buildBraveSearchUrl(baseUrl, query, maxResults);
      let response;
      try {
        response = await transport.request({
          url,
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Subscription-Token': apiKey,
          },
          signal,
        });
      } catch (err) {
        if (AdapterFailureError.isAdapterFailure(err)) throw err;
        if (signal.aborted) {
          // executeWithTimeout will classify TIMEOUT/CANCELLED
          throw err;
        }
        throw new AdapterFailureError({
          code: 'NETWORK_ERROR',
          message: 'Search transport network failure',
          adapter: 'search',
          operation: 'brave_web_search',
          retryable: true,
        });
      }

      mapHttpStatusToFailure(response.status);

      let parsed: unknown;
      try {
        parsed = JSON.parse(response.bodyText) as unknown;
      } catch {
        throw new AdapterFailureError({
          code: 'INVALID_RESPONSE',
          message: 'Search provider returned non-JSON body',
          adapter: 'search',
          operation: 'brave_web_search',
          retryable: false,
        });
      }

      return mapBraveResponse(parsed, query, context.now());
    },
    {
      adapter: 'search',
      operation: 'brave_web_search',
      timeoutMs,
      signal: context.signal,
      runId: context.run.id,
    }
  );
}

function buildBraveSearchUrl(
  baseUrl: string,
  query: DiscoveryQuery,
  maxResults: number
): string {
  const params = new URLSearchParams();
  params.set('q', buildBraveQueryText(query));
  params.set('count', String(maxResults));
  if (query.geography?.countryCode) {
    params.set('country', query.geography.countryCode.toUpperCase());
  }
  if (query.locale) {
    const lang = query.locale.slice(0, 2).toLowerCase();
    if (lang) params.set('search_lang', lang);
  }
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}${params.toString()}`;
}

/** Adapter-owned mapping — no vendor syntax in DiscoveryQuery. */
export function buildBraveQueryText(query: DiscoveryQuery): string {
  let text = query.text.trim();
  if (query.intent === 'site_search') {
    const site = query.constraints?.site;
    if (typeof site === 'string' && site.trim()) {
      text = `${text} site:${site.trim()}`.trim();
    }
  }
  return text;
}

function mapHttpStatusToFailure(status: number): void {
  if (status >= 200 && status < 300) return;
  if (status === 401) {
    throw new AdapterFailureError({
      code: 'AUTH_REQUIRED',
      message: 'Search provider authentication failed',
      adapter: 'search',
      operation: 'brave_web_search',
      retryable: false,
    });
  }
  if (status === 403) {
    throw new AdapterFailureError({
      code: 'POLICY_BLOCKED',
      message: 'Search provider denied the request',
      adapter: 'search',
      operation: 'brave_web_search',
      retryable: false,
    });
  }
  if (status === 429) {
    throw new AdapterFailureError({
      code: 'RATE_LIMITED',
      message: 'Search provider rate limited the request',
      adapter: 'search',
      operation: 'brave_web_search',
      retryable: true,
    });
  }
  if (status >= 500) {
    throw new AdapterFailureError({
      code: 'UNAVAILABLE',
      message: `Search provider unavailable (HTTP ${status})`,
      adapter: 'search',
      operation: 'brave_web_search',
      retryable: true,
    });
  }
  throw new AdapterFailureError({
    code: 'INVALID_RESPONSE',
    message: `Search provider unexpected HTTP status ${status}`,
    adapter: 'search',
    operation: 'brave_web_search',
    retryable: false,
  });
}

function mapBraveResponse(
  parsed: unknown,
  query: DiscoveryQuery,
  discoveredHint: string
): SearchOneResult {
  if (!parsed || typeof parsed !== 'object') {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: 'Search provider response is not an object',
      adapter: 'search',
      operation: 'brave_web_search',
      retryable: false,
    });
  }

  const body = parsed as BraveSearchResponse;
  const rawResults = body.web?.results;

  // Valid empty success
  if (rawResults === undefined || rawResults === null) {
    return { results: [], mappingFailures: [] };
  }
  if (!Array.isArray(rawResults)) {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: 'Search provider web.results is not an array',
      adapter: 'search',
      operation: 'brave_web_search',
      retryable: false,
    });
  }

  const results: RawCandidatePayload[] = [];
  const mappingFailures: string[] = [];

  for (let i = 0; i < rawResults.length; i += 1) {
    const entry = rawResults[i];
    const mapped = mapBraveEntry(entry, query, discoveredHint, i);
    if (mapped.ok) {
      results.push(mapped.payload);
    } else {
      mappingFailures.push(`query:${query.id}:SKIP:${mapped.reason}`);
    }
  }

  return { results, mappingFailures };
}

function mapBraveEntry(
  entry: unknown,
  query: DiscoveryQuery,
  _discoveredHint: string,
  index: number
): { ok: true; payload: RawCandidatePayload } | { ok: false; reason: string } {
  if (!entry || typeof entry !== 'object') {
    return { ok: false, reason: `entry_${index}_not_object` };
  }
  const r = entry as BraveWebResult;
  const url = typeof r.url === 'string' ? r.url.trim() : '';
  try {
    assertAttributableSourceUrl(url, {
      adapter: 'search',
      operation: 'brave_map_result',
    });
  } catch {
    return { ok: false, reason: `entry_${index}_missing_or_invalid_url` };
  }

  const title = typeof r.title === 'string' ? r.title : undefined;
  const snippet =
    typeof r.description === 'string' ? r.description : undefined;

  // Search engine ≠ official employer source
  const payload: RawCandidatePayload = {
    discoveredUrl: url,
    title,
    snippet,
    source: {
      trust: 'AGGREGATOR',
      label: 'brave-search',
      url,
    },
    data: {
      provider: BRAVE_SEARCH_PROVIDER_ID,
      providerResultUrl: url,
      queryId: query.id,
      resultIndex: index,
    },
  };

  return { ok: true, payload };
}

function sanitizeFailureMessage(message: string): string {
  if (/(authorization|api[_-]?key|subscription|token|bearer|cookie)/i.test(message)) {
    return '[redacted]';
  }
  return message.replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]');
}
