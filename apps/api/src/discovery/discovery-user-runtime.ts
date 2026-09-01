import path from 'node:path';
import {
  createDefaultDiscoveryRegistry,
  createDiscoveryUserService,
  createResultStateWriter,
  createSqliteProfilePersistence,
  createSqliteResultPersistence,
  createSqliteSchedulerPersistence,
  type DiscoveryUserService,
  type ProfileStore,
  type RunStore,
  type SqliteResultPersistence,
  type StrategyRegistry,
} from '@arrival-atlas/discovery';
import { getDiscoveryExecutionService } from './discovery-execution-runtime.js';

const DEFAULT_STATE_DIR =
  process.env.ARRIVAL_ATLAS_STATE_DIR ?? path.join(process.cwd(), '.arrival-atlas-state');

type DiscoveryRuntime = {
  service: DiscoveryUserService;
  registry: StrategyRegistry;
  profileStore: ProfileStore;
  resultStore: SqliteResultPersistence;
  runStore: RunStore;
};

let runtime: DiscoveryRuntime | null = null;

function ensureRuntime(): DiscoveryRuntime {
  if (runtime) {
    return runtime;
  }

  const dbPath = path.join(DEFAULT_STATE_DIR, 'discovery.sqlite');
  const profileStore = createSqliteProfilePersistence({ databasePath: dbPath });
  const resultStore = createSqliteResultPersistence({ databasePath: dbPath });
  const schedulerPersistence = createSqliteSchedulerPersistence({ databasePath: dbPath });
  const runStore = schedulerPersistence.runStore;
  const registry = createDefaultDiscoveryRegistry();
  const resultStateWriter = createResultStateWriter({
    store: resultStore,
    writer: resultStore,
  });
  const service = createDiscoveryUserService({
    profileStore,
    resultStore,
    resultStateWriter,
    runStore,
    registry,
    discoveryService: getDiscoveryExecutionService(),
  });

  runtime = {
    service,
    registry,
    profileStore,
    resultStore,
    runStore,
  };
  return runtime;
}

export function getDiscoveryUserService(): DiscoveryUserService {
  return ensureRuntime().service;
}

export function getDiscoveryStrategyRegistry(): StrategyRegistry {
  return ensureRuntime().registry;
}

export function getDiscoveryPersistence(): {
  profileStore: ProfileStore;
  resultStore: SqliteResultPersistence;
  runStore: RunStore;
} {
  const rt = ensureRuntime();
  return {
    profileStore: rt.profileStore,
    resultStore: rt.resultStore,
    runStore: rt.runStore,
  };
}

/** Session-scoped discovery ownership key (E9.2). */
export function resolveDiscoveryUserId(identity: {
  sessionId: string;
  accountId: string | null;
}): string {
  return identity.accountId ?? identity.sessionId;
}

/** Test-only: clear singleton so ARRIVAL_ATLAS_STATE_DIR can vary per test. */
export function resetDiscoveryRuntimeForTests(): void {
  runtime = null;
}
