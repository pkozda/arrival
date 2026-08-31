import { describe, expect, it } from 'vitest';
import {
  createDefaultDiscoveryRegistry,
  createDiscoveryExecutionWorker,
  createDiscoveryScheduler,
  createFakeClock,
  createFakeVerificationAdapter,
  createIncrementingJobIdGenerator,
  createIncrementingRunIdGenerator,
  createInMemoryExecutionQueue,
  createInMemoryProfileStore,
  createInMemoryRunStore,
  createInMemoryScheduleStore,
  createPipelineRunExecutor,
  emptyCriteria,
  type DiscoveryProfile,
} from '../index.js';

function jobProfile(): DiscoveryProfile {
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
  };
}

describe('E4.3 scheduler + pipeline integration', () => {
  it('due schedule enqueues; worker invokes executeDiscoveryPipeline', async () => {
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const scheduleStore = createInMemoryScheduleStore();
    const runStore = createInMemoryRunStore();
    const queue = createInMemoryExecutionQueue();
    const executor = createPipelineRunExecutor({
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: {
          async search() {
            return [
              {
                discoveredUrl: 'https://employer.example/jobs/1',
                title: 'Frontend Engineer',
                source: {
                  trust: 'AGGREGATOR',
                  url: 'https://employer.example/jobs/1',
                },
                data: { company: 'Acme', location: 'Berlin' },
              },
            ];
          },
        },
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => clock.now().toISOString(),
    });

    const scheduler = createDiscoveryScheduler({
      scheduleStore,
      runStore,
      queue,
      clock,
      runIdGenerator: createIncrementingRunIdGenerator('int-run'),
      jobIdGenerator: createIncrementingJobIdGenerator('int-job'),
    });
    const worker = createDiscoveryExecutionWorker({
      queue,
      executor,
      runStore,
      scheduleStore,
      clock,
    });

    await scheduler.registerSchedule({
      scheduleId: 'sched-int',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });

    const tick = await scheduler.triggerDueRuns();
    expect(tick.outcomes[0]?.kind).toBe('enqueued');

    await worker.processNext();

    const runs = await runStore.listBySchedule('sched-int');
    expect(runs).toHaveLength(1);
    expect(['SUCCESS', 'PARTIAL_SUCCESS']).toContain(runs[0]?.status);

    const schedule = await scheduleStore.get('sched-int');
    expect(schedule?.nextRunAt).toBe('2026-08-31T11:00:00.000Z');
    expect(schedule?.runningRunId).toBeNull();
  });
});
