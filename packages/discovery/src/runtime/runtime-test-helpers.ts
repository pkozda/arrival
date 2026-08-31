import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createFakeClock,
  createInMemoryProfileStore,
  createInMemoryRateLimiter,
  createMockHttpTransport,
  createStrategyRegistry,
  emptyCriteria,
  jobDiscoveryStrategyV1,
  type DiscoveryProfile,
  type DiscoveryRuntime,
  type DiscoveryRuntimePersistencePaths,
  type DiscoveryStrategyModule,
  type HttpRequest,
  type HttpResponse,
  type HttpTransport,
} from '../index.js';
import { createDiscoveryRuntime } from './discovery-runtime.js';

export const CANDIDATE_URL =
  'https://careers.employer.example/jobs/frontend-engineer';

export const RUNTIME_NOW = '2026-08-31T10:00:00.000Z';

export const SMOKE_JOB_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Frontend Engineer</title>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"JobPosting","title":"Frontend Engineer","hiringOrganization":{"name":"Acme GmbH"},"jobLocation":{"address":{"addressLocality":"Berlin"}},"employmentType":"FULL_TIME"}
  </script>
</head>
<body>
  <h1>Frontend Engineer</h1>
  <div data-field="organization">Acme GmbH</div>
  <div data-field="location">Berlin</div>
  <div data-field="employmentType">full-time</div>
  <p>Join Acme GmbH in Berlin. Full-time Frontend Engineer role.</p>
  <a href="${CANDIDATE_URL}">Apply</a>
</body>
</html>`;

export function smokeJobStrategy(): DiscoveryStrategyModule {
  return {
    ...jobDiscoveryStrategyV1,
    verificationPolicy: {
      requireVerificationPass: true,
      requiredChecks: [{ id: 'current_page', allowUnknown: false }],
      requireOfficialSource: false,
      acceptedSourceTrustForDiscovery: [
        'OFFICIAL',
        'ESTABLISHED_THIRD_PARTY',
        'AGGREGATOR',
      ],
    },
  };
}

export function smokeRegistry() {
  return createStrategyRegistry([smokeJobStrategy()]);
}

export function jobProfile(
  overrides: Partial<DiscoveryProfile> = {}
): DiscoveryProfile {
  return {
    id: 'profile-job',
    userId: 'user-1',
    name: 'Jobs',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteria: {
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: 'Frontend Engineer' }],
    },
    schedule: { cadence: 'manual' },
    notification: { emailEnabled: true, skipEmptyDigest: true },
    enabled: true,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
    ...overrides,
  };
}

export function braveSearchBody(url = CANDIDATE_URL) {
  return JSON.stringify({
    web: {
      results: [
        {
          title: 'Frontend Engineer',
          url,
          description: 'Acme GmbH — Berlin — full-time',
        },
      ],
    },
  });
}

export function openAiBody(tasks: unknown[]) {
  return JSON.stringify({
    choices: [
      {
        message: {
          role: 'assistant',
          content: JSON.stringify({ tasks }),
        },
      },
    ],
  });
}

export const DEFAULT_AI_TASKS = [
  {
    task: 'RELEVANCE',
    outcome: 'INTERPRETED',
    interpretationConfidence: 0.85,
    details: { label: 'strong_fit' },
  },
  {
    task: 'SENIORITY',
    outcome: 'INTERPRETED',
    interpretationConfidence: 0.7,
    details: { seniority: 'mid' },
  },
  {
    task: 'CLASSIFY',
    outcome: 'INTERPRETED',
    interpretationConfidence: 0.65,
    details: { category: 'engineering' },
  },
];

export const SECRETS = {
  brave: 'brave-runtime-secret-key',
  openai: 'sk-openai-runtime-secret',
  resend: 're_runtime_secret_key_do_not_leak',
  telegram: '123456789:AAHRuntimeTelegramTokenSecretXX',
};

/**
 * Strict transport — throws UNEXPECTED_NETWORK_REQUEST for unregistered calls.
 */
export function createRuntimeHttpTransport(options: {
  onSearch?: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;
  onPage?: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;
  onAi?: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;
  onResend?: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;
  onTelegram?: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;
}): HttpTransport & { requests: HttpRequest[] } {
  return createMockHttpTransport(async (req) => {
    const url = req.url;
    const method = (req.method ?? 'GET').toUpperCase();

    if (url.includes('api.resend.com') || url.includes('/emails')) {
      if (!options.onResend) {
        throw new Error(`UNEXPECTED_NETWORK_REQUEST: resend ${method} ${url}`);
      }
      return options.onResend(req);
    }

    if (url.includes('api.telegram.org') || url.includes('/sendMessage')) {
      if (!options.onTelegram) {
        throw new Error(`UNEXPECTED_NETWORK_REQUEST: telegram ${method} ${url}`);
      }
      return options.onTelegram(req);
    }

    if (method === 'POST' || url.includes('/chat/completions')) {
      if (!options.onAi) {
        throw new Error(`UNEXPECTED_NETWORK_REQUEST: AI ${method} ${url}`);
      }
      return options.onAi(req);
    }

    if (
      url.includes('api.search.brave.com') ||
      url.includes('/web/search') ||
      (options.onSearch && url.includes('search'))
    ) {
      if (!options.onSearch) {
        throw new Error(`UNEXPECTED_NETWORK_REQUEST: search ${method} ${url}`);
      }
      return options.onSearch(req);
    }

    if (method === 'GET') {
      if (!options.onPage) {
        throw new Error(`UNEXPECTED_NETWORK_REQUEST: page ${method} ${url}`);
      }
      return options.onPage(req);
    }

    throw new Error(`UNEXPECTED_NETWORK_REQUEST: ${method} ${url}`);
  });
}

export function happyPathTransport(overrides: {
  onSearch?: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;
  onPage?: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;
  onAi?: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;
  onResend?: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;
  onTelegram?: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;
} = {}) {
  return createRuntimeHttpTransport({
    onSearch:
      overrides.onSearch ??
      (() => ({ status: 200, bodyText: braveSearchBody() })),
    onPage:
      overrides.onPage ??
      ((req) => ({
        status: 200,
        bodyText: SMOKE_JOB_HTML,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        finalUrl: req.url,
      })),
    onAi:
      overrides.onAi ??
      (() => ({ status: 200, bodyText: openAiBody(DEFAULT_AI_TASKS) })),
    onResend:
      overrides.onResend ??
      (() => ({
        status: 200,
        bodyText: JSON.stringify({ id: 'email_runtime_1' }),
      })),
    onTelegram:
      overrides.onTelegram ??
      (() => ({
        status: 200,
        bodyText: JSON.stringify({
          ok: true,
          result: { message_id: 1, chat: { id: 12345 } },
        }),
      })),
  });
}

export function tempPersistencePaths(): DiscoveryRuntimePersistencePaths & {
  dir: string;
  cleanup(): void;
} {
  const dir = mkdtempSync(path.join(tmpdir(), 'discovery-e47-'));
  return {
    dir,
    resultsDatabasePath: path.join(dir, 'results.sqlite'),
    schedulerDatabasePath: path.join(dir, 'scheduler.sqlite'),
    notificationsDatabasePath: path.join(dir, 'notifications.sqlite'),
    cleanup() {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // best effort
      }
    },
  };
}

export type RuntimeHarnessOptions = {
  transport: HttpTransport;
  start?: string;
  email?: boolean;
  telegram?: boolean;
  channel?: 'EMAIL' | 'TELEGRAM';
  recipientAddress?: string;
  signal?: AbortSignal;
  adapterTimeoutMs?: number;
  persistence?: DiscoveryRuntimePersistencePaths;
};

export function createRuntimeHarness(
  opts: RuntimeHarnessOptions
): {
  runtime: DiscoveryRuntime;
  clock: ReturnType<typeof createFakeClock>;
  persistence: DiscoveryRuntimePersistencePaths & {
    dir?: string;
    cleanup(): void;
  };
} {
  const clock = createFakeClock(opts.start ?? RUNTIME_NOW);
  const persistence = opts.persistence
    ? { ...opts.persistence, cleanup() {} }
    : tempPersistencePaths();

  const emailEnabled = opts.email !== false && opts.channel !== 'TELEGRAM';
  const telegramEnabled = opts.telegram === true || opts.channel === 'TELEGRAM';

  const channel = opts.channel ?? (telegramEnabled && !emailEnabled ? 'TELEGRAM' : 'EMAIL');
  const address =
    opts.recipientAddress ??
    (channel === 'TELEGRAM' ? '12345' : 'user@example.com');

  const runtime = createDiscoveryRuntime({
    production: {
      brave: { apiKey: SECRETS.brave },
      openai: { apiKey: SECRETS.openai, model: 'gpt-4o-mini' },
      email: emailEnabled
        ? {
            apiKey: SECRETS.resend,
            from: 'Arrival Atlas <noreply@example.com>',
          }
        : undefined,
      telegram: telegramEnabled ? { botToken: SECRETS.telegram } : undefined,
      transport: opts.transport,
      rateLimiter: createInMemoryRateLimiter(),
    },
    persistence,
    registry: smokeRegistry(),
    profileStore: createInMemoryProfileStore([jobProfile()]),
    clock,
    transport: opts.transport,
    signal: opts.signal,
    adapterTimeoutMs: opts.adapterTimeoutMs,
    resolveNotificationTarget: () => ({
      channel,
      recipient: { userId: 'user-1', address },
    }),
  });

  return { runtime, clock, persistence };
}

export async function registerDueSchedule(
  runtime: DiscoveryRuntime,
  scheduleId = 'sched-runtime',
  nextRunAt = RUNTIME_NOW
) {
  return runtime.scheduler.registerSchedule({
    scheduleId,
    profileId: 'profile-job',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    intervalSeconds: 3600,
    nextRunAt,
  });
}

export async function runDueOnce(runtime: DiscoveryRuntime) {
  const tick = await runtime.scheduler.triggerDueRuns();
  const workerResult = await runtime.worker.processNext();
  return { tick, workerResult };
}
