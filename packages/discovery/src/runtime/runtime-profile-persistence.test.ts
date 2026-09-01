import { describe, expect, it } from 'vitest';
import {
  createDiscoveryRuntime,
  createInMemoryProfileStore,
  createInMemoryRateLimiter,
  createMockHttpTransport,
  createSqliteProfilePersistence,
} from '../index.js';
import {
  jobProfile,
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

function baseRuntimeConfig(persistence: ReturnType<typeof tempPersistencePaths>) {
  return {
    production: {
      brave: { apiKey: SECRETS.brave },
      openai: { apiKey: SECRETS.openai, model: 'gpt-4o-mini' },
      transport: idleTransport(),
      rateLimiter: createInMemoryRateLimiter(),
    },
    persistence,
    registry: smokeRegistry(),
    transport: idleTransport(),
  };
}

describe('E7.1 runtime ProfileStore wiring', () => {
  it('creates SQLite ProfileStore when profileStore is not injected', async () => {
    const persistence = tempPersistencePaths();
    const runtime = createDiscoveryRuntime(baseRuntimeConfig(persistence));
    try {
      expect(runtime.profileStore).toBeDefined();
      const profile = jobProfile();
      await runtime.profileStore.upsert(profile);
      expect(await runtime.profileStore.get(profile.id)).toEqual(profile);
      expect(
        (runtime.profileStore as { count(): number }).count?.()
      ).toBe(1);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('uses configured profilesDatabasePath for runtime-owned store', async () => {
    const persistence = tempPersistencePaths();
    const profile = jobProfile({ name: 'Durable Profile' });
    const runtime = createDiscoveryRuntime(baseRuntimeConfig(persistence));
    await runtime.profileStore.upsert(profile);
    runtime.close();

    const direct = createSqliteProfilePersistence({
      databasePath: persistence.profilesDatabasePath,
    });
    try {
      expect(await direct.get(profile.id)).toEqual(profile);
      expect(direct.count()).toBe(1);
    } finally {
      direct.close();
      persistence.cleanup();
    }
  });

  it('prefers injected ProfileStore over runtime-owned SQLite', async () => {
    const persistence = tempPersistencePaths();
    const injected = createInMemoryProfileStore([
      jobProfile({ name: 'Injected Profile' }),
    ]);
    const runtime = createDiscoveryRuntime({
      ...baseRuntimeConfig(persistence),
      profileStore: injected,
    });
    try {
      const found = await runtime.profileStore.get('profile-job');
      expect(found?.name).toBe('Injected Profile');
      expect(runtime.profileStore).toBe(injected);

      const sqliteProbe = createSqliteProfilePersistence({
        databasePath: persistence.profilesDatabasePath,
      });
      try {
        expect(sqliteProbe.count()).toBe(0);
      } finally {
        sqliteProbe.close();
      }
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('profile survives runtime restart via shared SQLite path', async () => {
    const persistence = tempPersistencePaths();
    const profile = jobProfile({
      enabled: false,
      updatedAt: '2026-09-01T09:00:00.000Z',
    });

    const first = createDiscoveryRuntime(baseRuntimeConfig(persistence));
    await first.profileStore.upsert(profile);
    first.close();

    const second = createDiscoveryRuntime(baseRuntimeConfig(persistence));
    try {
      const loaded = await second.profileStore.get(profile.id);
      expect(loaded?.enabled).toBe(false);
      expect(loaded?.updatedAt).toBe('2026-09-01T09:00:00.000Z');
      expect(loaded?.strategyId).toBe(profile.strategyId);
      expect(loaded?.criteria).toEqual(profile.criteria);
    } finally {
      second.close();
      persistence.cleanup();
    }
  });
});
