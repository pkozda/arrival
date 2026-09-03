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
import { buildBraveQueryText } from './brave-search-adapter.js';

/** Tavily Search API — temporary validation SearchAdapter (E12.3a). */
export const TAVILY_SEARCH_PROVIDER_ID = 'tavily' as const;

const DEFAULT_BASE_URL = 'https://api.tavily.com/search';
const DEFAULT_MAX_RESULTS = 10;
const TAVILY_MAX_RESULTS = 20;

/**
 * Resolved config — composition root loads env; adapter never reads process.env.
 */
export type TavilySearchAdapterConfig = {
  /** Tavily Search API key */
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Capped to Tavily's documented max (20) */
  maxResults?: number;
  rateLimiter?: RateLimiter;
  /** Injectable HTTP — tests supply a mock; production uses fetch */
  transport?: HttpTransport;
};

type TavilyResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
};

type TavilySearchResponse = {
  results?: unknown;
};

/**
 * Temporary validation SearchAdapter (Tavily Search only).
 * Strategy-agnostic: DiscoveryQuery → RawCandidatePayload[].
 * Does not use Tavily answer/crawl/extract/research features.
 */
export function createTavilySearchAdapter(
  config: TavilySearchAdapterConfig
): SearchAdapter {
  const transport = config.transport ?? createFetchHttpTransport();
  const rateLimiter = config.rateLimiter ?? createInMemoryRateLimiter();
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const maxResults = Math.min(
    Math.max(1, config.maxResults ?? DEFAULT_MAX_RESULTS),
    TAVILY_MAX_RESULTS
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
          operation: 'tavily_web_search',
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
          failures.push(
            `query:${query.id}:UNKNOWN:${sanitizeFailureMessage(message)}`
          );
        }
      }

      if (failures.length > 0 && aggregated.length > 0) {
        throw new PartialSearchError(aggregated, failures);
      }
      if (failures.length > 0 && aggregated.length === 0) {
        const first = failures[0] ?? 'UNKNOWN';
        const codeMatch = first.match(/query:[^:]+:([A-Z_]+):/);
        const code = (codeMatch?.[1] ??
          'UNKNOWN') as import('../../adapter-infra/types.js').AdapterFailureCode;
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
          operation: 'tavily_web_search',
          retryable:
            failureCode === 'TIMEOUT' ||
            failureCode === 'RATE_LIMITED' ||
            failureCode === 'UNAVAILABLE' ||
            failureCode === 'NETWORK_ERROR',
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

  await rateLimiter.acquire(`search:${TAVILY_SEARCH_PROVIDER_ID}`, execCtx);

  return executeWithTimeout(
    async (signal) => {
      const body = JSON.stringify(
        buildTavilySearchRequestBody({
          query,
          strategyId: context.run.strategyId,
          maxResults,
        })
      );

      let response;
      try {
        response = await transport.request({
          url: baseUrl,
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body,
          signal,
        });
      } catch (err) {
        if (AdapterFailureError.isAdapterFailure(err)) throw err;
        if (signal.aborted) {
          throw err;
        }
        throw new AdapterFailureError({
          code: 'NETWORK_ERROR',
          message: 'Search transport network failure',
          adapter: 'search',
          operation: 'tavily_web_search',
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
          operation: 'tavily_web_search',
          retryable: false,
        });
      }

      return mapTavilyResponse(parsed, query);
    },
    {
      adapter: 'search',
      operation: 'tavily_web_search',
      timeoutMs,
      signal: context.signal,
      runId: context.run.id,
    }
  );
}

/**
 * E12.20 — German Jobs retrieval uses validated Tavily country + advanced depth.
 * Shared adapter: only Jobs + DE geography get these params (not Giveaways / other strategies).
 */
export function buildTavilySearchRequestBody(input: {
  query: DiscoveryQuery;
  strategyId: string;
  maxResults: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    query: buildBraveQueryText(input.query),
    max_results: input.maxResults,
    include_answer: false,
    include_raw_content: false,
    include_images: false,
  };

  if (
    input.strategyId === 'job-discovery' &&
    input.query.geography?.countryCode === 'DE'
  ) {
    body.country = 'germany';
    body.search_depth = 'advanced';
  }

  return body;
}

function mapHttpStatusToFailure(status: number): void {
  if (status >= 200 && status < 300) return;
  if (status === 401) {
    throw new AdapterFailureError({
      code: 'AUTH_REQUIRED',
      message: 'Search provider authentication failed',
      adapter: 'search',
      operation: 'tavily_web_search',
      retryable: false,
    });
  }
  if (status === 403) {
    throw new AdapterFailureError({
      code: 'POLICY_BLOCKED',
      message: 'Search provider denied the request',
      adapter: 'search',
      operation: 'tavily_web_search',
      retryable: false,
    });
  }
  if (status === 429) {
    throw new AdapterFailureError({
      code: 'RATE_LIMITED',
      message: 'Search provider rate limited the request',
      adapter: 'search',
      operation: 'tavily_web_search',
      retryable: true,
    });
  }
  if (status >= 500) {
    throw new AdapterFailureError({
      code: 'UNAVAILABLE',
      message: `Search provider unavailable (HTTP ${status})`,
      adapter: 'search',
      operation: 'tavily_web_search',
      retryable: true,
    });
  }
  throw new AdapterFailureError({
    code: 'INVALID_RESPONSE',
    message: `Search provider unexpected HTTP status ${status}`,
    adapter: 'search',
    operation: 'tavily_web_search',
    retryable: false,
  });
}

function mapTavilyResponse(
  parsed: unknown,
  query: DiscoveryQuery
): SearchOneResult {
  if (!parsed || typeof parsed !== 'object') {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: 'Search provider response is not an object',
      adapter: 'search',
      operation: 'tavily_web_search',
      retryable: false,
    });
  }

  const rawResults = (parsed as TavilySearchResponse).results;
  if (rawResults === undefined) {
    return { results: [], mappingFailures: [] };
  }
  if (!Array.isArray(rawResults)) {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: 'Search provider results field is not an array',
      adapter: 'search',
      operation: 'tavily_web_search',
      retryable: false,
    });
  }

  const results: RawCandidatePayload[] = [];
  const mappingFailures: string[] = [];

  for (let i = 0; i < rawResults.length; i++) {
    const entry = rawResults[i];
    const mapped = mapTavilyEntry(entry, query, i);
    if (mapped.ok) {
      results.push(mapped.payload);
    } else {
      mappingFailures.push(`query:${query.id}:SKIP:${mapped.reason}`);
    }
  }

  return { results, mappingFailures };
}

function mapTavilyEntry(
  entry: unknown,
  query: DiscoveryQuery,
  index: number
): { ok: true; payload: RawCandidatePayload } | { ok: false; reason: string } {
  if (!entry || typeof entry !== 'object') {
    return { ok: false, reason: `entry_${index}_not_object` };
  }
  const r = entry as TavilyResult;
  const url = typeof r.url === 'string' ? r.url.trim() : '';
  try {
    assertAttributableSourceUrl(url, {
      adapter: 'search',
      operation: 'tavily_map_result',
    });
  } catch {
    return { ok: false, reason: `entry_${index}_missing_or_invalid_url` };
  }

  const title = typeof r.title === 'string' ? r.title : undefined;
  const snippet = typeof r.content === 'string' ? r.content : undefined;

  // Search engine ≠ official employer source (same as Brave)
  const payload: RawCandidatePayload = {
    discoveredUrl: url,
    title,
    snippet,
    source: {
      trust: 'AGGREGATOR',
      label: 'tavily-search',
      url,
    },
    data: {
      provider: TAVILY_SEARCH_PROVIDER_ID,
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
