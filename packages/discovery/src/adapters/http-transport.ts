/**
 * Minimal HTTP transport for production adapters (E3.2+).
 * No axios/node-fetch — Node 20+ native fetch by default.
 * Injectable for tests (no real network).
 */

export type HttpRequest = {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  /** Optional request body (E3.6 AI / POST adapters) — never log secrets from this */
  body?: string;
  signal?: AbortSignal;
  /** When set, transport should not buffer more than this many UTF-8 bytes */
  maxBytes?: number;
};

export type HttpResponse = {
  status: number;
  bodyText: string;
  /** Lowercase header names */
  headers?: Record<string, string>;
  /** Final URL after bounded redirects */
  finalUrl?: string;
  /** True when body was not fully read due to maxBytes / Content-Length */
  truncated?: boolean;
};

export type HttpTransport = {
  request(req: HttpRequest): Promise<HttpResponse>;
};

export type FetchHttpTransportOptions = {
  /** Max redirect hops (default 5). Never unbounded. */
  maxRedirects?: number;
  defaultUserAgent?: string;
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function headerMap(response: Response): Record<string, string> {
  const out: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

async function readBodyLimited(
  response: Response,
  maxBytes: number | undefined
): Promise<{ bodyText: string; truncated: boolean }> {
  if (maxBytes === undefined || maxBytes <= 0) {
    return { bodyText: await response.text(), truncated: false };
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    return { bodyText: '', truncated: true };
  }

  if (!response.body) {
    return { bodyText: '', truncated: false };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bodyText: new TextDecoder('utf-8').decode(merged), truncated };
}

/** Production default — uses global fetch with bounded redirects. */
export function createFetchHttpTransport(
  options: FetchHttpTransportOptions = {}
): HttpTransport {
  const maxRedirects = options.maxRedirects ?? 5;

  return {
    async request(req: HttpRequest): Promise<HttpResponse> {
      let url = req.url;
      let redirects = 0;
      const headers: Record<string, string> = { ...(req.headers ?? {}) };
      if (options.defaultUserAgent && !headers['User-Agent'] && !headers['user-agent']) {
        headers['User-Agent'] = options.defaultUserAgent;
      }

      while (true) {
        const response = await fetch(url, {
          method: req.method ?? 'GET',
          headers,
          body: redirects === 0 ? req.body : undefined,
          signal: req.signal,
          redirect: 'manual',
        });

        if (REDIRECT_STATUSES.has(response.status)) {
          const location = response.headers.get('location');
          await response.body?.cancel().catch(() => undefined);
          if (!location || redirects >= maxRedirects) {
            return {
              status: response.status,
              bodyText: '',
              headers: headerMap(response),
              finalUrl: url,
            };
          }
          const next = new URL(location, url);
          if (next.protocol !== 'http:' && next.protocol !== 'https:') {
            return {
              status: 400,
              bodyText: '',
              headers: {},
              finalUrl: next.toString(),
            };
          }
          url = next.toString();
          redirects += 1;
          continue;
        }

        const { bodyText, truncated } = await readBodyLimited(response, req.maxBytes);
        return {
          status: response.status,
          bodyText,
          headers: headerMap(response),
          finalUrl: url,
          truncated,
        };
      }
    },
  };
}

export type MockHttpHandler = (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;

/** Test transport — records requests; never touches the network. */
export function createMockHttpTransport(handler: MockHttpHandler): HttpTransport & {
  requests: HttpRequest[];
} {
  const requests: HttpRequest[] = [];
  return {
    requests,
    async request(req: HttpRequest): Promise<HttpResponse> {
      requests.push({
        url: req.url,
        method: req.method,
        headers: req.headers ? { ...req.headers } : undefined,
        body: req.body,
        signal: req.signal,
        maxBytes: req.maxBytes,
      });
      return handler(req);
    },
  };
}
