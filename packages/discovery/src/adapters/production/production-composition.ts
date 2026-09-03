import type { AdapterPorts } from '../../pipeline/adapters.js';
import type { RawContentStore } from '../../pipeline/fakes/raw-content-store.js';
import { createInMemoryRawContentStore } from '../../pipeline/fakes/raw-content-store.js';
import {
  createInMemoryRateLimiter,
  type RateLimiter,
} from '../../adapter-infra/index.js';
import {
  createFetchHttpTransport,
  type HttpTransport,
} from '../http-transport.js';
import { createProductionSearchAdapter } from '../search/brave-search-adapter.js';
import { createTavilySearchAdapter } from '../search/tavily-search-adapter.js';
import {
  resolveDiscoverySearchProvider,
  type DiscoverySearchProviderId,
} from '../search/resolve-discovery-search-provider.js';
import { createProductionFetchAdapter } from '../fetch/http-fetch-adapter.js';
import { createProductionContentExtractor } from '../extract/html-content-extractor.js';
import { createProductionVerificationAdapter } from '../verify/http-verification-adapter.js';
import { createProductionAiAdapter } from '../ai/http-ai-adapter.js';

/**
 * Typed production configuration — resolved outside adapters.
 * Adapters never read process.env.
 */
export type DiscoveryProductionConfig = {
  /**
   * Explicit search provider selection (E12.3a).
   * Default / omitted → brave (production).
   * `tavily` is temporary validation only — never an automatic Brave fallback.
   */
  searchProvider?: DiscoverySearchProviderId;
  brave: {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
    maxResults?: number;
  };
  /** Required when searchProvider === 'tavily' */
  tavily?: {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
    maxResults?: number;
  };
  openai: {
    apiKey: string;
    model?: string;
    baseUrl?: string;
    timeoutMs?: number;
  };
  fetch?: {
    timeoutMs?: number;
    maxResponseBytes?: number;
    maxRedirects?: number;
    userAgent?: string;
  };
  verification?: {
    timeoutMs?: number;
    userAgent?: string;
  };
  extract?: {
    maxRawBytes?: number;
    maxVisibleTextChars?: number;
    maxLinks?: number;
    maxHeadings?: number;
    maxJsonLdBlocks?: number;
  };
  ai?: {
    /** Overrides openai.timeoutMs when both are set */
    timeoutMs?: number;
  };
  /**
   * Optional transactional email (E4.5 Resend).
   * Not required for pipeline AdapterPorts composition.
   */
  email?: {
    apiKey: string;
    from: string;
    baseUrl?: string;
    timeoutMs?: number;
  };
  /**
   * Optional Telegram Bot API notifications (E4.6).
   * Not required for pipeline AdapterPorts composition.
   */
  telegram?: {
    botToken: string;
    baseUrl?: string;
    timeoutMs?: number;
  };
  /**
   * Shared RawContentStore for fetch / extract / verify.
   * When omitted, composition creates a process-local in-memory store (not durable).
   */
  rawContentStore?: RawContentStore;
  /**
   * Shared HttpTransport. When omitted, composition creates one fetch-based transport
   * shared across search / fetch / verify / ai.
   */
  transport?: HttpTransport;
  /**
   * Shared RateLimiter. When omitted, composition creates a process-local in-memory
   * limiter. Keys remain provider-isolated (`search:brave`, `fetch:http`, …).
   * Not durable / not distributed.
   */
  rateLimiter?: RateLimiter;
};

/** All five production ports — never partial. */
export type ProductionDiscoveryAdapters = Required<
  Pick<AdapterPorts, 'search' | 'fetch' | 'extract' | 'verify' | 'ai'>
> & {
  rawContentStore: RawContentStore;
  rateLimiter: RateLimiter;
  transport: HttpTransport;
};

export type DiscoveryProductionConfigValidation =
  | { ok: true }
  | { ok: false; issues: string[] };

export type RedactedDiscoveryProductionConfig = {
  searchProvider: DiscoverySearchProviderId;
  brave: {
    apiKey: '[redacted]';
    baseUrl?: string;
    timeoutMs?: number;
    maxResults?: number;
  };
  tavily?: {
    apiKey: '[redacted]';
    baseUrl?: string;
    timeoutMs?: number;
    maxResults?: number;
  };
  openai: {
    apiKey: '[redacted]';
    model?: string;
    baseUrl?: string;
    timeoutMs?: number;
  };
  fetch?: DiscoveryProductionConfig['fetch'];
  verification?: DiscoveryProductionConfig['verification'];
  extract?: DiscoveryProductionConfig['extract'];
  ai?: DiscoveryProductionConfig['ai'];
  email?: {
    apiKey: '[redacted]';
    from: string;
    baseUrl?: string;
    timeoutMs?: number;
  };
  telegram?: {
    botToken: '[redacted]';
    baseUrl?: string;
    timeoutMs?: number;
  };
  hasRawContentStore: boolean;
  hasTransport: boolean;
  hasRateLimiter: boolean;
};

/**
 * Validate infrastructure config only — no network, no credential live-checks,
 * no domain criteria.
 */
export function validateDiscoveryProductionConfig(
  config: DiscoveryProductionConfig
): DiscoveryProductionConfigValidation {
  const issues: string[] = [];

  let searchProvider: DiscoverySearchProviderId = 'brave';
  try {
    searchProvider = resolveDiscoverySearchProvider(config.searchProvider);
  } catch (err) {
    issues.push(err instanceof Error ? err.message : 'Invalid searchProvider');
  }

  if (searchProvider === 'tavily') {
    if (!config.tavily?.apiKey?.trim()) {
      issues.push('tavily.apiKey is required when searchProvider is tavily');
    }
    if (
      config.tavily?.baseUrl !== undefined &&
      !isValidHttpUrl(config.tavily.baseUrl)
    ) {
      issues.push('tavily.baseUrl must be a valid http(s) URL');
    }
    assertPositiveMs(issues, 'tavily.timeoutMs', config.tavily?.timeoutMs);
    if (
      config.tavily?.maxResults !== undefined &&
      (!Number.isFinite(config.tavily.maxResults) || config.tavily.maxResults < 1)
    ) {
      issues.push('tavily.maxResults must be a positive number');
    }
  } else if (!config.brave?.apiKey?.trim()) {
    issues.push('brave.apiKey is required');
  }

  if (!config.openai?.apiKey?.trim()) {
    issues.push('openai.apiKey is required');
  }

  if (config.brave?.baseUrl !== undefined && !isValidHttpUrl(config.brave.baseUrl)) {
    issues.push('brave.baseUrl must be a valid http(s) URL');
  }
  if (
    config.openai?.baseUrl !== undefined &&
    !isValidHttpUrl(config.openai.baseUrl)
  ) {
    issues.push('openai.baseUrl must be a valid http(s) URL');
  }

  if (config.openai?.model !== undefined && !config.openai.model.trim()) {
    issues.push('openai.model must be non-empty when supplied');
  }

  assertPositiveMs(issues, 'brave.timeoutMs', config.brave?.timeoutMs);
  assertPositiveMs(issues, 'openai.timeoutMs', config.openai?.timeoutMs);
  assertPositiveMs(issues, 'fetch.timeoutMs', config.fetch?.timeoutMs);
  assertPositiveMs(issues, 'verification.timeoutMs', config.verification?.timeoutMs);
  assertPositiveMs(issues, 'ai.timeoutMs', config.ai?.timeoutMs);

  if (
    config.brave?.maxResults !== undefined &&
    (!Number.isFinite(config.brave.maxResults) || config.brave.maxResults < 1)
  ) {
    issues.push('brave.maxResults must be a positive number');
  }

  if (
    config.fetch?.maxResponseBytes !== undefined &&
    (!Number.isFinite(config.fetch.maxResponseBytes) ||
      config.fetch.maxResponseBytes < 1)
  ) {
    issues.push('fetch.maxResponseBytes must be a positive number');
  }

  if (
    config.extract?.maxRawBytes !== undefined &&
    (!Number.isFinite(config.extract.maxRawBytes) ||
      config.extract.maxRawBytes < 1)
  ) {
    issues.push('extract.maxRawBytes must be a positive number');
  }

  if (config.email !== undefined) {
    if (!config.email.apiKey?.trim()) {
      issues.push('email.apiKey is required when email config is present');
    }
    if (!config.email.from?.trim()) {
      issues.push('email.from is required when email config is present');
    }
    if (
      config.email.baseUrl !== undefined &&
      !isValidHttpUrl(config.email.baseUrl)
    ) {
      issues.push('email.baseUrl must be a valid http(s) URL');
    }
    assertPositiveMs(issues, 'email.timeoutMs', config.email.timeoutMs);
  }

  if (config.telegram !== undefined) {
    if (!config.telegram.botToken?.trim()) {
      issues.push('telegram.botToken is required when telegram config is present');
    }
    if (
      config.telegram.baseUrl !== undefined &&
      !isValidHttpUrl(config.telegram.baseUrl)
    ) {
      issues.push('telegram.baseUrl must be a valid http(s) URL');
    }
    assertPositiveMs(issues, 'telegram.timeoutMs', config.telegram.timeoutMs);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Redacted view for diagnostics — never includes API keys.
 */
export function redactDiscoveryProductionConfig(
  config: DiscoveryProductionConfig
): RedactedDiscoveryProductionConfig {
  const searchProvider = resolveDiscoverySearchProvider(config.searchProvider);
  return {
    searchProvider,
    brave: {
      apiKey: '[redacted]',
      baseUrl: config.brave.baseUrl,
      timeoutMs: config.brave.timeoutMs,
      maxResults: config.brave.maxResults,
    },
    tavily: config.tavily
      ? {
          apiKey: '[redacted]',
          baseUrl: config.tavily.baseUrl,
          timeoutMs: config.tavily.timeoutMs,
          maxResults: config.tavily.maxResults,
        }
      : undefined,
    openai: {
      apiKey: '[redacted]',
      model: config.openai.model,
      baseUrl: config.openai.baseUrl,
      timeoutMs: config.openai.timeoutMs,
    },
    fetch: config.fetch ? { ...config.fetch } : undefined,
    verification: config.verification ? { ...config.verification } : undefined,
    extract: config.extract ? { ...config.extract } : undefined,
    ai: config.ai ? { ...config.ai } : undefined,
    email: config.email
      ? {
          apiKey: '[redacted]',
          from: config.email.from,
          baseUrl: config.email.baseUrl,
          timeoutMs: config.email.timeoutMs,
        }
      : undefined,
    telegram: config.telegram
      ? {
          botToken: '[redacted]',
          baseUrl: config.telegram.baseUrl,
          timeoutMs: config.telegram.timeoutMs,
        }
      : undefined,
    hasRawContentStore: config.rawContentStore !== undefined,
    hasTransport: config.transport !== undefined,
    hasRateLimiter: config.rateLimiter !== undefined,
  };
}

export type LoadDiscoveryProductionConfigOptions = {
  rawContentStore?: RawContentStore;
  transport?: HttpTransport;
  rateLimiter?: RateLimiter;
  fetch?: DiscoveryProductionConfig['fetch'];
  verification?: DiscoveryProductionConfig['verification'];
  extract?: DiscoveryProductionConfig['extract'];
  ai?: DiscoveryProductionConfig['ai'];
  brave?: Partial<Omit<DiscoveryProductionConfig['brave'], 'apiKey'>>;
  tavily?: Partial<Omit<NonNullable<DiscoveryProductionConfig['tavily']>, 'apiKey'>>;
  openai?: Partial<Omit<DiscoveryProductionConfig['openai'], 'apiKey'>>;
  email?: Partial<Omit<NonNullable<DiscoveryProductionConfig['email']>, 'apiKey'>>;
  telegram?: Partial<
    Omit<NonNullable<DiscoveryProductionConfig['telegram']>, 'botToken'>
  >;
};

/**
 * Resolve production config from an env map at the composition boundary only.
 * Does not call adapters or network. Missing credentials throw.
 */
export function loadDiscoveryProductionConfig(
  env: Record<string, string | undefined>,
  options: LoadDiscoveryProductionConfigOptions = {}
): DiscoveryProductionConfig {
  const searchProvider = resolveDiscoverySearchProvider(
    env.DISCOVERY_SEARCH_PROVIDER
  );
  const braveKey = env.BRAVE_SEARCH_API_KEY?.trim();
  const tavilyKey = env.TAVILY_API_KEY?.trim();
  const openaiKey = env.OPENAI_API_KEY?.trim();

  if (searchProvider === 'brave' && !braveKey) {
    throw new Error(
      'Missing required environment variable: BRAVE_SEARCH_API_KEY'
    );
  }
  if (searchProvider === 'tavily' && !tavilyKey) {
    throw new Error('Missing required environment variable: TAVILY_API_KEY');
  }
  if (!openaiKey) {
    throw new Error('Missing required environment variable: OPENAI_API_KEY');
  }

  const modelFromEnv = env.OPENAI_MODEL?.trim();
  const braveBase = env.BRAVE_SEARCH_BASE_URL?.trim();
  const tavilyBase = env.TAVILY_SEARCH_BASE_URL?.trim();
  const openaiBase = env.OPENAI_BASE_URL?.trim();

  const resendKey = env.RESEND_API_KEY?.trim();
  const emailFrom = env.DISCOVERY_EMAIL_FROM?.trim();
  const emailBase = env.RESEND_BASE_URL?.trim();

  if (resendKey || emailFrom) {
    if (!resendKey) {
      throw new Error('Missing required environment variable: RESEND_API_KEY');
    }
    if (!emailFrom) {
      throw new Error(
        'Missing required environment variable: DISCOVERY_EMAIL_FROM'
      );
    }
  }

  const telegramToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const telegramBase = env.TELEGRAM_BASE_URL?.trim();

  const config: DiscoveryProductionConfig = {
    searchProvider,
    brave: {
      // When Tavily is selected, Brave key may be absent — unused by search adapter.
      apiKey: braveKey ?? '',
      baseUrl: options.brave?.baseUrl ?? (braveBase || undefined),
      timeoutMs: options.brave?.timeoutMs,
      maxResults: options.brave?.maxResults,
    },
    tavily:
      searchProvider === 'tavily'
        ? {
            apiKey: tavilyKey!,
            baseUrl: options.tavily?.baseUrl ?? (tavilyBase || undefined),
            timeoutMs: options.tavily?.timeoutMs,
            maxResults: options.tavily?.maxResults,
          }
        : tavilyKey
          ? {
              apiKey: tavilyKey,
              baseUrl: options.tavily?.baseUrl ?? (tavilyBase || undefined),
              timeoutMs: options.tavily?.timeoutMs,
              maxResults: options.tavily?.maxResults,
            }
          : undefined,
    openai: {
      apiKey: openaiKey,
      model: options.openai?.model ?? (modelFromEnv || undefined),
      baseUrl: options.openai?.baseUrl ?? (openaiBase || undefined),
      timeoutMs: options.openai?.timeoutMs,
    },
    fetch: options.fetch,
    verification: options.verification,
    extract: options.extract,
    ai: options.ai,
    email: resendKey
      ? {
          apiKey: resendKey,
          from: emailFrom!,
          baseUrl: options.email?.baseUrl ?? (emailBase || undefined),
          timeoutMs: options.email?.timeoutMs,
        }
      : undefined,
    telegram: telegramToken
      ? {
          botToken: telegramToken,
          baseUrl: options.telegram?.baseUrl ?? (telegramBase || undefined),
          timeoutMs: options.telegram?.timeoutMs,
        }
      : undefined,
    rawContentStore: options.rawContentStore,
    transport: options.transport,
    rateLimiter: options.rateLimiter,
  };

  const validated = validateDiscoveryProductionConfig(config);
  if (!validated.ok) {
    throw new Error(
      `Invalid discovery production config: ${validated.issues.join('; ')}`
    );
  }

  return config;
}

/**
 * Construct all five production AdapterPorts.
 * Performs no network I/O during construction.
 */
export function createProductionDiscoveryAdapters(
  config: DiscoveryProductionConfig
): ProductionDiscoveryAdapters {
  const validated = validateDiscoveryProductionConfig(config);
  if (!validated.ok) {
    throw new Error(
      `Invalid discovery production config: ${validated.issues.join('; ')}`
    );
  }

  const rawContentStore =
    config.rawContentStore ?? createInMemoryRawContentStore();
  const transport = config.transport ?? createFetchHttpTransport();
  const rateLimiter = config.rateLimiter ?? createInMemoryRateLimiter();

  const aiTimeoutMs = config.ai?.timeoutMs ?? config.openai.timeoutMs;
  const searchProvider = resolveDiscoverySearchProvider(config.searchProvider);

  const search =
    searchProvider === 'tavily'
      ? createTavilySearchAdapter({
          apiKey: config.tavily!.apiKey,
          baseUrl: config.tavily?.baseUrl,
          timeoutMs: config.tavily?.timeoutMs,
          maxResults: config.tavily?.maxResults,
          transport,
          rateLimiter,
        })
      : createProductionSearchAdapter({
          apiKey: config.brave.apiKey,
          baseUrl: config.brave.baseUrl,
          timeoutMs: config.brave.timeoutMs,
          maxResults: config.brave.maxResults,
          transport,
          rateLimiter,
        });

  return {
    search,
    fetch: createProductionFetchAdapter({
      rawContentStore,
      transport,
      rateLimiter,
      timeoutMs: config.fetch?.timeoutMs,
      maxResponseBytes: config.fetch?.maxResponseBytes,
      maxRedirects: config.fetch?.maxRedirects,
      userAgent: config.fetch?.userAgent,
    }),
    extract: createProductionContentExtractor({
      rawContentStore,
      maxRawBytes: config.extract?.maxRawBytes,
      maxVisibleTextChars: config.extract?.maxVisibleTextChars,
      maxLinks: config.extract?.maxLinks,
      maxHeadings: config.extract?.maxHeadings,
      maxJsonLdBlocks: config.extract?.maxJsonLdBlocks,
    }),
    verify: createProductionVerificationAdapter({
      rawContentStore,
      transport,
      rateLimiter,
      timeoutMs: config.verification?.timeoutMs,
      userAgent: config.verification?.userAgent,
    }),
    ai: createProductionAiAdapter({
      apiKey: config.openai.apiKey,
      model: config.openai.model,
      baseUrl: config.openai.baseUrl,
      timeoutMs: aiTimeoutMs,
      transport,
      rateLimiter,
    }),
    rawContentStore,
    rateLimiter,
    transport,
  };
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function assertPositiveMs(
  issues: string[],
  label: string,
  value: number | undefined
): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value <= 0) {
    issues.push(`${label} must be a positive number`);
  }
}
