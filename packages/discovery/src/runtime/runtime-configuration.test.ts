import { describe, expect, it, vi } from 'vitest';
import {
  DiscoveryConfigurationError,
  DiscoveryRuntimeClosedError,
  assertDiscoveryRuntimeConfig,
  createDiscoveryRuntime,
  createInMemoryProfileStore,
  createInMemoryRateLimiter,
  createMockHttpTransport,
  getDiscoveryProviderEnablement,
  loadDiscoveryProductionConfig,
  redactDiscoveryRuntimeConfig,
  sanitizeRuntimeErrorMessage,
  validateDiscoveryProductionConfig,
  validateDiscoveryRuntimeConfig,
  type DiscoveryProductionConfig,
  type HttpTransport,
} from '../index.js';
import {
  createRuntimeHarness,
  registerDueSchedule,
  SECRETS,
  smokeRegistry,
  tempPersistencePaths,
} from './runtime-test-helpers.js';

const idleTransport = () =>
  createMockHttpTransport(async () => ({
    status: 200,
    headers: {},
    bodyText: '',
  }));

function baseProduction(
  overrides: Partial<DiscoveryProductionConfig> = {}
): DiscoveryProductionConfig {
  return {
    brave: { apiKey: SECRETS.brave },
    openai: { apiKey: SECRETS.openai, model: 'gpt-4o-mini' },
    ...overrides,
  };
}

describe('E5.1 configuration validation', () => {
  it('accepts valid minimal configuration', () => {
    const persistence = tempPersistencePaths();
    const config = {
      production: baseProduction(),
      persistence,
      adapterTimeoutMs: 5_000,
    };
    const result = validateDiscoveryRuntimeConfig(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.providers).toEqual({
        search: 'brave',
        ai: 'openai',
        email: false,
        telegram: false,
      });
    }
    persistence.cleanup();
  });

  it('rejects missing Brave key', () => {
    const persistence = tempPersistencePaths();
    const result = validateDiscoveryRuntimeConfig({
      production: baseProduction({ brave: { apiKey: '' } }),
      persistence,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => /brave\.apiKey/.test(i))).toBe(true);
    }
    persistence.cleanup();
  });

  it('rejects missing OpenAI key when AI is required', () => {
    const persistence = tempPersistencePaths();
    const result = validateDiscoveryRuntimeConfig({
      production: baseProduction({ openai: { apiKey: '   ' } }),
      persistence,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => /openai\.apiKey/.test(i))).toBe(true);
    }
    persistence.cleanup();
  });

  it('rejects missing Resend key when Email enabled', () => {
    expect(
      validateDiscoveryProductionConfig(
        baseProduction({
          email: { apiKey: '', from: 'a@b.com' },
        })
      ).ok
    ).toBe(false);
  });

  it('rejects missing Telegram token when Telegram enabled', () => {
    expect(
      validateDiscoveryProductionConfig(
        baseProduction({
          telegram: { botToken: '' },
        })
      ).ok
    ).toBe(false);
  });

  it('rejects invalid URL', () => {
    const persistence = tempPersistencePaths();
    const result = validateDiscoveryRuntimeConfig({
      production: baseProduction({
        openai: { apiKey: SECRETS.openai, baseUrl: 'not-a-url' },
      }),
      persistence,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => /baseUrl/.test(i))).toBe(true);
    }
    persistence.cleanup();
  });

  it('rejects invalid timeout / adapterTimeoutMs', () => {
    const persistence = tempPersistencePaths();
    expect(
      validateDiscoveryRuntimeConfig({
        production: baseProduction({
          brave: { apiKey: SECRETS.brave, timeoutMs: 0 },
        }),
        persistence,
      }).ok
    ).toBe(false);
    expect(
      validateDiscoveryRuntimeConfig({
        production: baseProduction(),
        persistence,
        adapterTimeoutMs: -1,
      }).ok
    ).toBe(false);
    persistence.cleanup();
  });

  it('optional providers disabled successfully', () => {
    const enablement = getDiscoveryProviderEnablement(baseProduction());
    expect(enablement.email).toBe(false);
    expect(enablement.telegram).toBe(false);
  });

  it('email-only configuration', () => {
    const enablement = getDiscoveryProviderEnablement(
      baseProduction({
        email: { apiKey: SECRETS.resend, from: 'a@b.com' },
      })
    );
    expect(enablement).toEqual({
      search: 'brave',
      ai: 'openai',
      email: true,
      telegram: false,
    });
  });

  it('telegram-only configuration', () => {
    const enablement = getDiscoveryProviderEnablement(
      baseProduction({
        telegram: { botToken: SECRETS.telegram },
      })
    );
    expect(enablement.email).toBe(false);
    expect(enablement.telegram).toBe(true);
  });

  it('both notification providers', () => {
    const enablement = getDiscoveryProviderEnablement(
      baseProduction({
        email: { apiKey: SECRETS.resend, from: 'a@b.com' },
        telegram: { botToken: SECRETS.telegram },
      })
    );
    expect(enablement.email).toBe(true);
    expect(enablement.telegram).toBe(true);
  });

  it('neither notification provider', () => {
    const persistence = tempPersistencePaths();
    const runtime = createDiscoveryRuntime({
      production: baseProduction(),
      persistence,
      registry: smokeRegistry(),
      profileStore: createInMemoryProfileStore([]),
      transport: idleTransport(),
    });
    expect(runtime.providers.email).toBe(false);
    expect(runtime.providers.telegram).toBe(false);
    expect(runtime.notificationService).toBeNull();
    runtime.close();
    persistence.cleanup();
  });

  it('assertDiscoveryRuntimeConfig throws DiscoveryConfigurationError', () => {
    const persistence = tempPersistencePaths();
    expect(() =>
      assertDiscoveryRuntimeConfig({
        production: baseProduction({ brave: { apiKey: '' } }),
        persistence,
      })
    ).toThrow(DiscoveryConfigurationError);
    persistence.cleanup();
  });

  it('loadDiscoveryProductionConfig fails before network on missing secrets', () => {
    expect(() =>
      loadDiscoveryProductionConfig({ OPENAI_API_KEY: 'k' })
    ).toThrow(/BRAVE_SEARCH_API_KEY/);
    expect(() =>
      loadDiscoveryProductionConfig({ BRAVE_SEARCH_API_KEY: 'k' })
    ).toThrow(/OPENAI_API_KEY/);
  });

  it('rejects empty SQLite paths', () => {
    const result = validateDiscoveryRuntimeConfig({
      production: baseProduction(),
      persistence: {
        resultsDatabasePath: '',
        schedulerDatabasePath: '/tmp/s.db',
        notificationsDatabasePath: '/tmp/n.db',
        queueDatabasePath: '/tmp/q.db',
        profilesDatabasePath: '/tmp/p.db',
      },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects invalid schedulerLockLeaseMs', () => {
    const persistence = tempPersistencePaths();
    expect(
      validateDiscoveryRuntimeConfig({
        production: baseProduction(),
        persistence,
        schedulerLockLeaseMs: 0,
      }).ok
    ).toBe(false);
    expect(
      validateDiscoveryRuntimeConfig({
        production: baseProduction(),
        persistence,
        schedulerLockLeaseMs: 1.5,
      }).ok
    ).toBe(false);
    persistence.cleanup();
  });

  it('rejects invalid retry configuration', () => {
    const persistence = tempPersistencePaths();
    expect(
      validateDiscoveryRuntimeConfig({
        production: baseProduction(),
        persistence,
        retry: { maxAttempts: 0 },
      }).ok
    ).toBe(false);
    expect(
      validateDiscoveryRuntimeConfig({
        production: baseProduction(),
        persistence,
        retry: { baseDelayMs: 1000, maxDelayMs: 500 },
      }).ok
    ).toBe(false);
    expect(
      validateDiscoveryRuntimeConfig({
        production: baseProduction(),
        persistence,
        retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 60_000 },
      }).ok
    ).toBe(true);
    persistence.cleanup();
  });
});

describe('E5.1 secret redaction', () => {
  it('redacted runtime config JSON contains no API keys', () => {
    const persistence = tempPersistencePaths();
    const config = {
      production: baseProduction({
        email: { apiKey: SECRETS.resend, from: 'a@b.com' },
        telegram: { botToken: SECRETS.telegram },
      }),
      persistence,
      transport: idleTransport(),
    };
    const redacted = redactDiscoveryRuntimeConfig(config);
    const json = JSON.stringify(redacted);
    expect(json).not.toContain(SECRETS.brave);
    expect(json).not.toContain(SECRETS.openai);
    expect(json).not.toContain(SECRETS.resend);
    expect(json).not.toContain(SECRETS.telegram);
    expect(json).toContain('[redacted]');
    expect(redacted.persistence.resultsDatabasePath).toBe(
      persistence.resultsDatabasePath
    );
    expect(redacted.providers.email).toBe(true);
    persistence.cleanup();
  });

  it('sanitizeRuntimeErrorMessage strips secrets and bearer tokens', () => {
    const msg = sanitizeRuntimeErrorMessage(
      `auth failed Bearer ${SECRETS.openai} key=${SECRETS.brave}`,
      [SECRETS.brave, SECRETS.openai]
    );
    expect(msg).not.toContain(SECRETS.brave);
    expect(msg).not.toContain(SECRETS.openai);
    expect(msg).toContain('[redacted]');
  });

  it('runtime construction errors do not expose secrets', () => {
    const persistence = tempPersistencePaths();
    try {
      createDiscoveryRuntime({
        production: baseProduction({ brave: { apiKey: '' } }),
        persistence,
        registry: smokeRegistry(),
        profileStore: createInMemoryProfileStore([]),
      });
      expect.unreachable('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(DiscoveryConfigurationError);
      const text = JSON.stringify(err, Object.getOwnPropertyNames(err));
      expect(text).not.toContain(SECRETS.brave);
      expect(text).not.toContain(SECRETS.openai);
    }
    persistence.cleanup();
  });
});

describe('E5.1 runtime lifecycle', () => {
  it('runtime creates successfully and exposes providers', () => {
    const { runtime, persistence } = createRuntimeHarness({
      transport: idleTransport(),
      email: true,
      telegram: true,
    });
    expect(runtime.isClosed()).toBe(false);
    expect(runtime.providers.email).toBe(true);
    expect(runtime.providers.telegram).toBe(true);
    const redacted = runtime.redactedConfig();
    expect(JSON.stringify(redacted)).not.toContain(SECRETS.brave);
    runtime.close();
    expect(runtime.isClosed()).toBe(true);
    persistence.cleanup();
  });

  it('close() twice is safe', () => {
    const { runtime, persistence } = createRuntimeHarness({
      transport: idleTransport(),
    });
    runtime.close();
    runtime.close();
    expect(runtime.isClosed()).toBe(true);
    persistence.cleanup();
  });

  it('operations after close fail deterministically', async () => {
    const { runtime, persistence } = createRuntimeHarness({
      transport: idleTransport(),
    });
    await registerDueSchedule(runtime);
    runtime.close();

    await expect(runtime.scheduler.triggerDueRuns()).rejects.toBeInstanceOf(
      DiscoveryRuntimeClosedError
    );
    await expect(runtime.worker.processNext()).rejects.toBeInstanceOf(
      DiscoveryRuntimeClosedError
    );
    await expect(
      runtime.pipelineExecutor.execute({
        scheduleId: 'sched-runtime',
        profileId: 'profile-job',
        runId: 'run-x',
        trigger: 'manual',
      })
    ).rejects.toBeInstanceOf(DiscoveryRuntimeClosedError);

    persistence.cleanup();
  });

  it('caller-owned injected transport is not closed by runtime', async () => {
    const base = idleTransport();
    const transport: HttpTransport & { close?: () => void } = {
      request: (req) => base.request(req),
      close() {
        /* would mark closed if runtime called it */
      },
    };
    const closeSpy = vi.spyOn(transport, 'close');

    const { runtime, persistence } = createRuntimeHarness({ transport });
    runtime.close();
    expect(closeSpy).not.toHaveBeenCalled();
    await expect(
      transport.request({
        url: 'https://example.com',
        method: 'GET',
        headers: {},
      })
    ).resolves.toMatchObject({ status: 200 });
    persistence.cleanup();
  });

  it('runtime-owned SQLite resources are closed (subsequent store use fails)', async () => {
    const { runtime, persistence } = createRuntimeHarness({
      transport: idleTransport(),
    });
    await registerDueSchedule(runtime);
    const before = await runtime.scheduleStore.get('sched-runtime');
    expect(before).not.toBeNull();
    runtime.close();
    await expect(runtime.scheduleStore.get('sched-runtime')).rejects.toThrow();
    persistence.cleanup();
  });

  it('injected rateLimiter is not disposed by runtime close', async () => {
    const rateLimiter = createInMemoryRateLimiter();
    const persistence = tempPersistencePaths();
    const runtime = createDiscoveryRuntime({
      production: baseProduction(),
      persistence,
      registry: smokeRegistry(),
      profileStore: createInMemoryProfileStore([]),
      transport: idleTransport(),
      rateLimiter,
    });
    runtime.close();
    await expect(rateLimiter.acquire('search:brave')).resolves.toBeUndefined();
    persistence.cleanup();
  });
});
