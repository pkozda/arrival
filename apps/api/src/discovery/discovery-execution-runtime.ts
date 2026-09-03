import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createDiscoveryService,
  createDefaultDiscoveryRegistry,
  createInMemoryRateLimiter,
  createSqliteProfilePersistence,
  happyPathTransport,
  resolveDiscoverySearchProvider,
  smokeRegistry,
  type DiscoveryService,
  type StrategyRegistry,
} from '@arrival-atlas/discovery';
import { isDevToolsEnabled } from '../dev/is-dev-tools-enabled.js';
import { clearDiscoveryNotificationEmailOverrides } from './resolve-discovery-notification-email.js';
import { createResolveDiscoveryNotificationTarget } from './resolve-discovery-notification-target.js';
import { resetDiscoveryUserNotificationEmailStoreForTests } from './user-notification-email-runtime.js';

function resolveStateDir(): string {
  return process.env.ARRIVAL_ATLAS_STATE_DIR ?? path.join(process.cwd(), '.arrival-atlas-state');
}

function discoveryDbPath(): string {
  return path.join(resolveStateDir(), 'discovery.sqlite');
}

let discoveryService: DiscoveryService | null = null;
let notificationProfileStore: ReturnType<typeof createSqliteProfilePersistence> | null = null;

function getNotificationProfileStore(): ReturnType<typeof createSqliteProfilePersistence> {
  if (!notificationProfileStore) {
    notificationProfileStore = createSqliteProfilePersistence({
      databasePath: discoveryDbPath(),
    });
  }
  return notificationProfileStore;
}

/**
 * Production registry (Jobs + Giveaways) — shared semantics with User API (E12.1).
 * Smoke registry is used only when DISCOVERY_USE_SMOKE_TRANSPORT is set (deterministic tests).
 */
export function resolveDiscoveryExecutionRegistry(): StrategyRegistry {
  return process.env.DISCOVERY_USE_SMOKE_TRANSPORT === 'true'
    ? smokeRegistry()
    : createDefaultDiscoveryRegistry();
}

/**
 * Pull-driven discovery execution for user-facing Run now (E9.3).
 * Production hosts use createDefaultDiscoveryRegistry(); tests set DISCOVERY_USE_SMOKE_TRANSPORT
 * for smokeRegistry() and happyPathTransport() (deterministic adapters only).
 */
export function getDiscoveryExecutionService(): DiscoveryService {
  if (discoveryService) {
    return discoveryService;
  }

  const dbPath = discoveryDbPath();
  const useSmokeTransport = isDevToolsEnabled() || process.env.DISCOVERY_USE_SMOKE_TRANSPORT === 'true';
  const searchProvider = resolveDiscoverySearchProvider(
    process.env.DISCOVERY_SEARCH_PROVIDER
  );

  discoveryService = createDiscoveryService({
    production: {
      searchProvider,
      brave: { apiKey: process.env.BRAVE_SEARCH_API_KEY ?? 'smoke-brave-key' },
      tavily: process.env.TAVILY_API_KEY
        ? { apiKey: process.env.TAVILY_API_KEY }
        : undefined,
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
    registry: resolveDiscoveryExecutionRegistry(),
    resolveNotificationTarget: createResolveDiscoveryNotificationTarget({
      profileStore: getNotificationProfileStore(),
    }),
    runIdGenerator: () => `run-${randomUUID()}`,
    jobIdGenerator: () => `job-${randomUUID()}`,
  });

  return discoveryService;
}

/** Test-only: clear singleton so ARRIVAL_ATLAS_STATE_DIR can vary per test. */
export function resetDiscoveryExecutionForTests(): void {
  discoveryService = null;
  notificationProfileStore?.close();
  notificationProfileStore = null;
  clearDiscoveryNotificationEmailOverrides();
  resetDiscoveryUserNotificationEmailStoreForTests();
}
