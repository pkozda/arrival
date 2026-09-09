import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createDiscoveryService,
  createDiscoveryUserService,
  createFakeClock,
  createInMemoryRateLimiter,
  createResultStateWriter,
  createSqliteProfilePersistence,
  createSqliteResultPersistence,
  createSqliteSchedulerPersistence,
  emptyCriteria,
  happyPathTransport,
  scheduleIdForProfile,
  smokeRegistry,
  type DiscoveryProfile,
} from '../index.js';

const USER_A = 'user-a';
const USER_B = 'user-b';
const NOW = '2026-09-01T10:00:00.000Z';

function tempDb(prefix: string) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  return {
    path: path.join(dir, 'discovery.sqlite'),
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function jobProfile(overrides: Partial<DiscoveryProfile> = {}): DiscoveryProfile {
  return {
    id: 'profile-job',
    userId: USER_A,
    name: 'Jobs',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteria: {
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
    },
    schedule: { cadence: 'manual' },
    notification: { emailEnabled: true, skipEmptyDigest: true },
    enabled: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function harness() {
  const db = tempDb('pd010-');
  const clock = createFakeClock(NOW);
  const profileStore = createSqliteProfilePersistence({ databasePath: db.path });
  const resultStore = createSqliteResultPersistence({ databasePath: db.path });
  const schedulerPersistence = createSqliteSchedulerPersistence({ databasePath: db.path });
  const discoveryService = createDiscoveryService({
    production: {
      brave: { apiKey: 'smoke-brave-key' },
      openai: { apiKey: 'smoke-openai-key', model: 'gpt-4o-mini' },
      transport: happyPathTransport(),
      rateLimiter: createInMemoryRateLimiter(),
    },
    persistence: {
      resultsDatabasePath: db.path,
      schedulerDatabasePath: db.path,
      notificationsDatabasePath: db.path,
      queueDatabasePath: db.path,
      profilesDatabasePath: db.path,
    },
    registry: smokeRegistry(),
    profileStore,
    clock,
  });
  const runStore = schedulerPersistence.runStore;
  const service = createDiscoveryUserService({
    profileStore,
    resultStore,
    resultStateWriter: createResultStateWriter({ store: resultStore, writer: resultStore }),
    runStore,
    registry: smokeRegistry(),
    clock,
    discoveryService,
  });
  return {
    db,
    service,
    discoveryService,
    profileStore,
    resultStore,
    runStore,
  };
}

describe('PD-010 Discovery automation', () => {
  it('A/B/C/D — enable daily schedule, persist, expose nextRunAt', async () => {
    const h = harness();
    try {
      await h.service.createProfile(USER_A, {
        id: 'profile-job',
        name: 'Jobs',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        criteria: jobProfile().criteria,
        schedule: { cadence: 'manual' },
        notification: { emailEnabled: true, skipEmptyDigest: true },
      });

      let summary = await h.service.getProfileRunSummary(USER_A, 'profile-job');
      expect(summary.automation.automaticExecution).toBe(false);
      expect(summary.automation.nextRunAt).toBeNull();

      await h.service.updateProfile(USER_A, 'profile-job', {
        schedule: { cadence: 'daily', hourUtc: 6 },
      });

      summary = await h.service.getProfileRunSummary(USER_A, 'profile-job');
      expect(summary.automation.cadence).toBe('daily');
      expect(summary.automation.automaticExecution).toBe(true);
      expect(summary.automation.nextRunAt).toBe('2026-09-02T06:00:00.000Z');
      expect(summary.automation.hourUtc).toBe(6);

      const reloaded = await h.service.getProfile(USER_A, 'profile-job');
      expect(reloaded.schedule).toEqual({ cadence: 'daily', hourUtc: 6 });

      await h.service.updateProfile(USER_A, 'profile-job', {
        schedule: { cadence: 'manual' },
      });
      summary = await h.service.getProfileRunSummary(USER_A, 'profile-job');
      expect(summary.automation.automaticExecution).toBe(false);
      expect(summary.automation.nextRunAt).toBeNull();
      expect((await h.service.getProfile(USER_A, 'profile-job')).schedule).toEqual({
        cadence: 'manual',
      });
    } finally {
      h.db.cleanup();
    }
  });

  it('P — delivery preference persists independently of schedule', async () => {
    const h = harness();
    try {
      await h.service.createProfile(USER_A, {
        id: 'profile-job',
        name: 'Jobs',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        criteria: jobProfile().criteria,
        schedule: { cadence: 'daily', hourUtc: 6 },
        notification: { emailEnabled: true, skipEmptyDigest: true },
      });
      await h.service.updateProfile(USER_A, 'profile-job', {
        notification: { emailEnabled: false, skipEmptyDigest: true },
      });
      const summary = await h.service.getProfileRunSummary(USER_A, 'profile-job');
      expect(summary.automation.automaticExecution).toBe(true);
      expect(summary.automation.delivery.emailEnabled).toBe(false);
      expect(summary.automation.delivery.skipEmptyDigest).toBe(true);
    } finally {
      h.db.cleanup();
    }
  });

  it('Q/R — foreign user cannot schedule owned profile', async () => {
    const h = harness();
    try {
      await h.service.createProfile(USER_A, {
        id: 'profile-job',
        name: 'Jobs',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        criteria: jobProfile().criteria,
      });
      await expect(
        h.service.updateProfile(USER_B, 'profile-job', {
          schedule: { cadence: 'daily', hourUtc: 6 },
        })
      ).rejects.toThrow(/not found/i);
      await expect(h.service.getProfileRunSummary(USER_B, 'profile-job')).rejects.toThrow(
        /not found/i
      );
    } finally {
      h.db.cleanup();
    }
  });

  it('F — overlapping trigger is skipped while a run is already active', async () => {
    const h = harness();
    try {
      await h.service.createProfile(USER_A, {
        id: 'profile-job',
        name: 'Jobs',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        criteria: jobProfile().criteria,
        schedule: { cadence: 'daily', hourUtc: 6 },
      });
      await h.discoveryService.start();
      const scheduleId = scheduleIdForProfile('profile-job');
      const first = await h.discoveryService.runNow({ scheduleId });
      expect(first.kind).toBe('enqueued');
      const second = await h.discoveryService.runNow({ scheduleId });
      expect(second).toMatchObject({
        kind: 'skipped',
        reason: 'already_running',
      });
    } finally {
      h.db.cleanup();
    }
  });

  it('L — previously persisted results keep inferred novelty (not falsely re-newed)', async () => {
    const { inferNoveltyFromResult } = await import('../index.js');
    const novelty = inferNoveltyFromResult({
      firstSeenAt: '2026-08-01T00:00:00.000Z',
      lastChangedAt: '2026-08-15T00:00:00.000Z',
    } as never);
    expect(novelty).not.toBe('NEW');
    expect(novelty).toBe('UPDATED');
  });
});
