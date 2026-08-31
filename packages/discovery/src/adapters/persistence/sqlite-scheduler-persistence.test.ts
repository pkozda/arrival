import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createDiscoveryExecutionWorker,
  createDiscoveryScheduler,
  createFakeClock,
  createIncrementingJobIdGenerator,
  createIncrementingRunIdGenerator,
  createInMemoryExecutionQueue,
  createSqliteSchedulerPersistence,
  DISCOVERY_SCHEDULER_SCHEMA_VERSION,
} from '../../index.js';

function tempDb(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'discovery-e42-'));
  return path.join(dir, 'scheduler.sqlite');
}

function cleanupDb(dbPath: string) {
  try {
    rmSync(path.dirname(dbPath), { recursive: true, force: true });
  } catch {
    // best effort
  }
}

describe('E4.2 SQLite scheduler persistence', () => {
  it('schedule and run metadata survive restart', async () => {
    const dbPath = tempDb();
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const runIds = createIncrementingRunIdGenerator('sqlite-run');

    const first = createSqliteSchedulerPersistence({ databasePath: dbPath });
    const queue = createInMemoryExecutionQueue();
    const scheduler1 = createDiscoveryScheduler({
      scheduleStore: first.scheduleStore,
      runStore: first.runStore,
      queue,
      clock,
      runIdGenerator: runIds,
      jobIdGenerator: createIncrementingJobIdGenerator('sqlite-job'),
    });
    const worker = createDiscoveryExecutionWorker({
      queue,
      executor: {
        async execute(req) {
          return {
            run: {
              id: req.runId,
              profileId: req.profileId,
              strategyId: 'job-discovery',
              strategyVersion: '1',
              criteriaSnapshot: {
                required: [],
                preferred: [],
                excluded: [],
                flexible: [],
              },
              startedAt: clock.now().toISOString(),
              status: 'SUCCESS',
              stats: {
                candidatesFound: 0,
                candidatesRejected: 0,
                candidatesVerified: 0,
                resultsCreated: 0,
                resultsUpdated: 0,
              },
            },
            batch: { active: [], rejected: [] },
            stageOrder: ['resolve_snapshot'],
            stageDiagnostics: [],
            queries: [],
          };
        },
      },
      runStore: first.runStore,
      scheduleStore: first.scheduleStore,
      clock,
    });

    await scheduler1.registerSchedule({
      scheduleId: 'sched-sqlite',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });
    await scheduler1.triggerDueRuns();
    await worker.processNext();
    first.close();

    const second = createSqliteSchedulerPersistence({ databasePath: dbPath });
    const schedule = await second.scheduleStore.get('sched-sqlite');
    expect(schedule?.nextRunAt).toBe('2026-08-31T11:00:00.000Z');
    const runs = await second.runStore.listBySchedule('sched-sqlite');
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe('SUCCESS');
    second.close();
    cleanupDb(dbPath);
  });

  it('exports schema version constant', () => {
    expect(DISCOVERY_SCHEDULER_SCHEMA_VERSION).toBe(1);
  });
});
