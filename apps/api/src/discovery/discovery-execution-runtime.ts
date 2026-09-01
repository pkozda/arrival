import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createDiscoveryService,
  createInMemoryRateLimiter,
  happyPathTransport,
  smokeRegistry,
  type DiscoveryService,
} from '@arrival-atlas/discovery';
import { isDevToolsEnabled } from '../dev/is-dev-tools-enabled.js';

const DEFAULT_STATE_DIR =
  process.env.ARRIVAL_ATLAS_STATE_DIR ?? path.join(process.cwd(), '.arrival-atlas-state');

let discoveryService: DiscoveryService | null = null;

function discoveryDbPath(): string {
  return path.join(DEFAULT_STATE_DIR, 'discovery.sqlite');
}

/**
 * Pull-driven discovery execution for user-facing Run now (E9.3).
 * Uses deterministic smoke HTTP transport in dev/test; production hosts may
 * wire real provider credentials via env without changing this module.
 */
export function getDiscoveryExecutionService(): DiscoveryService {
  if (discoveryService) {
    return discoveryService;
  }

  const dbPath = discoveryDbPath();
  const useSmokeTransport = isDevToolsEnabled() || process.env.DISCOVERY_USE_SMOKE_TRANSPORT === 'true';

  discoveryService = createDiscoveryService({
    production: {
      brave: { apiKey: process.env.BRAVE_SEARCH_API_KEY ?? 'smoke-brave-key' },
      openai: {
        apiKey: process.env.OPENAI_API_KEY ?? 'smoke-openai-key',
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      },
      email: {
        apiKey: process.env.RESEND_API_KEY ?? 'smoke-resend-key',
        from: process.env.DISCOVERY_EMAIL_FROM ?? 'Arrival Atlas <noreply@example.com>',
      },
      transport: useSmokeTransport ? happyPathTransport() : undefined,
      rateLimiter: createInMemoryRateLimiter(),
    },
    persistence: {
      resultsDatabasePath: dbPath,
      schedulerDatabasePath: dbPath,
      notificationsDatabasePath: dbPath,
      queueDatabasePath: dbPath,
      profilesDatabasePath: dbPath,
    },
    registry: smokeRegistry(),
    resolveNotificationTarget: () => null,
    runIdGenerator: () => `run-${randomUUID()}`,
    jobIdGenerator: () => `job-${randomUUID()}`,
  });

  return discoveryService;
}

/** Test-only: clear singleton so ARRIVAL_ATLAS_STATE_DIR can vary per test. */
export function resetDiscoveryExecutionForTests(): void {
  discoveryService = null;
}
