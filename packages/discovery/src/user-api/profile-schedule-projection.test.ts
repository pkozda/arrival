import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildOperationalScheduleRegistration,
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
  nextDailyRunAtUtc,
  NON_AUTOMATIC_NEXT_RUN_AT,
  scheduleIdForProfile,
  smokeRegistry,
  syncProfileOperationalSchedule,
  type DiscoveryProfile,
} from '../index.js';

const USER_A = 'user-a';
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

function discoveryHarness(clock = createFakeClock(NOW)) {
  const db = tempDb('e102-');
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
  const userService = createDiscoveryUserService({
    profileStore,
    resultStore,
    resultStateWriter: createResultStateWriter({
      store: resultStore,
      writer: resultStore,
    }),
    runStore: schedulerPersistence.runStore,
    registry: smokeRegistry(),
    discoveryService,
    clock,
  });
  return {
    db,
    clock,
    profileStore,
    resultStore,
    schedulerPersistence,
    discoveryService,
    userService,
    cleanup() {
      profileStore.close();
      resultStore.close();
      schedulerPersistence.close();
      db.cleanup();
    },
  };
}

describe('E10.2 schedule projection (pure)', () => {
  it('nextDailyRunAtUtc picks same-day hour when still ahead', () => {
    expect(nextDailyRunAtUtc('2026-09-01T08:00:00.000Z', 9)).toBe(
      '2026-09-01T09:00:00.000Z'
    );
  });

  it('nextDailyRunAtUtc rolls to next UTC day after hour passed', () => {
    expect(nextDailyRunAtUtc('2026-09-01T10:00:00.000Z', 9)).toBe(
      '2026-09-02T09:00:00.000Z'
    );
  });

  it('daily registration uses 86400 interval and hourUtc metadata', () => {
    const input = buildOperationalScheduleRegistration(
      jobProfile({ schedule: { cadence: 'daily', hourUtc: 14 } }),
      NOW
    );
    expect(input.intervalSeconds).toBe(86_400);
    expect(input.nextRunAt).toBe('2026-09-01T14:00:00.000Z');
    expect(input.metadata).toMatchObject({ profileCadence: 'daily', hourUtc: '14' });
  });

  it('manual registration uses non-automatic nextRunAt placeholder', () => {
    const input = buildOperationalScheduleRegistration(jobProfile(), NOW);
    expect(input.nextRunAt).toBe(NON_AUTOMATIC_NEXT_RUN_AT);
    expect(input.metadata).toMatchObject({ profileCadence: 'manual' });
  });

  it('weekly registration preserves cadence but defers auto recurrence', () => {
    const input = buildOperationalScheduleRegistration(
      jobProfile({ schedule: { cadence: 'weekly', dayOfWeek: 2, hourUtc: 9 } }),
      NOW
    );
    expect(input.nextRunAt).toBe(NON_AUTOMATIC_NEXT_RUN_AT);
    expect(input.metadata).toMatchObject({
      profileCadence: 'weekly',
      dayOfWeek: '2',
      hourUtc: '9',
      weeklyRecurrence: 'deferred',
    });
  });
});

describe('E10.2 schedule projection (integration)', () => {
  it('daily profile create projects operational schedule at hourUtc', async () => {
    const h = discoveryHarness();
    const profile = await h.userService.createProfile(USER_A, {
      id: 'profile-daily',
      name: 'Daily Jobs',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: jobProfile().criteria,
      schedule: { cadence: 'daily', hourUtc: 9 },
    });
    expect(profile.schedule).toEqual({ cadence: 'daily', hourUtc: 9 });

    const schedule = await h.discoveryService.getSchedule(
      scheduleIdForProfile('profile-daily')
    );
    expect(schedule).toMatchObject({
      profileId: 'profile-daily',
      enabled: true,
      interval: { kind: 'fixed_interval', intervalSeconds: 86_400 },
      nextRunAt: '2026-09-02T09:00:00.000Z',
      metadata: { profileCadence: 'daily', hourUtc: '9' },
    });
    h.cleanup();
  });

  it('daily schedule becomes due at the projected UTC time', async () => {
    const h = discoveryHarness(createFakeClock('2026-09-01T08:30:00.000Z'));
    await h.userService.createProfile(USER_A, {
      id: 'profile-due',
      name: 'Due Daily',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: jobProfile().criteria,
      schedule: { cadence: 'daily', hourUtc: 9 },
    });

    let tick = await h.discoveryService.triggerDueRuns();
    expect(tick.outcomes).toHaveLength(0);

    h.clock.set('2026-09-01T09:00:00.000Z');
    tick = await h.discoveryService.triggerDueRuns();
    expect(tick.outcomes).toHaveLength(1);
    expect(tick.outcomes[0]).toMatchObject({
      kind: 'enqueued',
      scheduleId: scheduleIdForProfile('profile-due'),
    });

    h.cleanup();
  });

  it('profile schedule update re-projects nextRunAt', async () => {
    const h = discoveryHarness();
    await h.userService.createProfile(USER_A, {
      id: 'profile-update',
      name: 'Updatable',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: jobProfile().criteria,
      schedule: { cadence: 'daily', hourUtc: 9 },
    });

    await h.userService.updateProfile(USER_A, 'profile-update', {
      schedule: { cadence: 'daily', hourUtc: 15 },
    });

    const schedule = await h.discoveryService.getSchedule(
      scheduleIdForProfile('profile-update')
    );
    expect(schedule?.nextRunAt).toBe('2026-09-01T15:00:00.000Z');
    expect(schedule?.metadata?.hourUtc).toBe('15');
    h.cleanup();
  });

  it('manual profile does not auto-run on triggerDueRuns', async () => {
    const h = discoveryHarness();
    await h.userService.createProfile(USER_A, {
      id: 'profile-manual',
      name: 'Manual',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: jobProfile().criteria,
      schedule: { cadence: 'manual' },
    });

    const tick = await h.discoveryService.triggerDueRuns();
    expect(
      tick.outcomes.some(
        (o) => o.scheduleId === scheduleIdForProfile('profile-manual')
      )
    ).toBe(false);

    const outcome = await h.userService.runProfileNow(USER_A, 'profile-manual');
    expect(['success', 'partial_success']).toContain(outcome.status);
    h.cleanup();
  });

  it('disabled daily profile is skipped by profile_enabled gate', async () => {
    const h = discoveryHarness(createFakeClock('2026-09-01T09:00:00.000Z'));
    await h.userService.createProfile(USER_A, {
      id: 'profile-disabled',
      name: 'Disabled Daily',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: jobProfile().criteria,
      schedule: { cadence: 'daily', hourUtc: 9 },
      enabled: false,
    });

    const schedule = await h.discoveryService.getSchedule(
      scheduleIdForProfile('profile-disabled')
    );
    expect(schedule?.enabled).toBe(false);

    const tick = await h.discoveryService.triggerDueRuns();
    expect(tick.outcomes).toHaveLength(0);
    h.cleanup();
  });

  it('repeated projection upserts a single operational schedule', async () => {
    const h = discoveryHarness();
    const profile = jobProfile({
      id: 'profile-once',
      schedule: { cadence: 'daily', hourUtc: 12 },
    });
    await h.profileStore.upsert(profile);

    await syncProfileOperationalSchedule({
      profile,
      discoveryService: h.discoveryService,
      now: NOW,
    });
    await syncProfileOperationalSchedule({
      profile,
      discoveryService: h.discoveryService,
      now: NOW,
    });

    const schedules = await h.discoveryService.listSchedules();
    expect(
      schedules.filter((s) => s.profileId === 'profile-once')
    ).toHaveLength(1);
    h.cleanup();
  });
});
