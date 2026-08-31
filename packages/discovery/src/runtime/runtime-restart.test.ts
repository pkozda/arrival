import { describe, expect, it } from 'vitest';
import {
  createRuntimeHarness,
  happyPathTransport,
  registerDueSchedule,
  runDueOnce,
  tempPersistencePaths,
} from './runtime-test-helpers.js';

describe('E4.7 runtime restart persistence', () => {
  it('schedules, Results, and notification idempotency survive restart', async () => {
    const transport = happyPathTransport();
    const persistence = tempPersistencePaths();
    const { runtime: a } = createRuntimeHarness({
      transport,
      persistence,
      channel: 'EMAIL',
    });

    await registerDueSchedule(a, 'sched-restart');
    const { workerResult } = await runDueOnce(a);
    expect(workerResult).toMatchObject({
      kind: 'processed',
      pipelineStatus: 'SUCCESS',
    });

    const resultCount = (a.resultStore as { count(): number }).count();
    expect(resultCount).toBeGreaterThanOrEqual(1);
    expect((a.notificationStore as { count(): number }).count()).toBe(1);

    const nextRunAt = (await a.scheduleStore.get('sched-restart'))?.nextRunAt;
    expect(nextRunAt).toBe('2026-08-31T11:00:00.000Z');

    // Capture digest id via notification store by re-opening after close
    a.close();

    const { runtime: b } = createRuntimeHarness({
      transport,
      persistence,
      channel: 'EMAIL',
    });

    try {
      const schedule = await b.scheduleStore.get('sched-restart');
      expect(schedule?.nextRunAt).toBe(nextRunAt);
      expect((b.resultStore as { count(): number }).count()).toBe(resultCount);
      expect((b.notificationStore as { count(): number }).count()).toBe(1);

      // Same digest delivery again — provider must not be called again
      const before = transport.requests.filter((r) =>
        r.url.includes('resend')
      ).length;

      // Re-deliver using notification service with same digest identity
      // Build digest from a fresh successful run would have different digest id;
      // instead verify store still blocks duplicate id by attempting deliverDigest
      // with the same digest id pattern from the prior run.
      const runs = await b.runStore.listBySchedule('sched-restart');
      expect(runs[0]?.status).toBe('SUCCESS');
      const digestId = `digest:${runs[0]!.runId}`;

      const again = await b.notificationService!.deliverDigest({
        digest: {
          id: digestId,
          runId: runs[0]!.runId,
          profileId: 'profile-job',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          generatedAt: '2026-08-31T10:05:00.000Z',
          period: {
            from: '2026-08-31T10:00:00.000Z',
            to: '2026-08-31T10:05:00.000Z',
          },
          resultIds: ['placeholder'],
          entries: [
            {
              resultId: 'placeholder',
              rank: 1,
              rankValue: 0.9,
              novelty: 'NEW',
              userState: 'NEW',
              lifecycle: 'ACTIVE',
              shouldNotify: true,
            },
          ],
          newResultIds: ['placeholder'],
          updatedResultIds: [],
          summary: {
            totalResults: 1,
            newResults: 1,
            updatedResults: 0,
            unchangedResults: 0,
            notifiedResults: 1,
          },
        },
        recipient: { userId: 'user-1', address: 'user@example.com' },
        channel: 'EMAIL',
      });

      expect(again).toEqual({ kind: 'skipped', reason: 'already_delivered' });
      const after = transport.requests.filter((r) =>
        r.url.includes('resend')
      ).length;
      expect(after).toBe(before);
    } finally {
      b.close();
      persistence.cleanup();
    }
  });

  it('duplicate Result identity does not create duplicate rows after restart', async () => {
    const transport = happyPathTransport();
    const persistence = tempPersistencePaths();
    const { runtime: a } = createRuntimeHarness({ transport, persistence });

    await registerDueSchedule(a, 'sched-result');
    await runDueOnce(a);
    const count = (a.resultStore as { count(): number }).count();
    a.close();

    const { runtime: b } = createRuntimeHarness({ transport, persistence });
    try {
      expect((b.resultStore as { count(): number }).count()).toBe(count);
      expect(count).toBeGreaterThanOrEqual(1);
    } finally {
      b.close();
      persistence.cleanup();
    }
  });

  it('Telegram notification idempotency survives restart', async () => {
    const transport = happyPathTransport();
    const persistence = tempPersistencePaths();
    const { runtime: a } = createRuntimeHarness({
      transport,
      persistence,
      channel: 'TELEGRAM',
      email: false,
      telegram: true,
    });

    await registerDueSchedule(a, 'sched-tg-restart');
    await runDueOnce(a);
    expect((a.notificationStore as { count(): number }).count()).toBe(1);
    const runs = await a.runStore.listBySchedule('sched-tg-restart');
    const digestId = `digest:${runs[0]!.runId}`;
    a.close();

    const { runtime: b } = createRuntimeHarness({
      transport,
      persistence,
      channel: 'TELEGRAM',
      email: false,
      telegram: true,
    });

    try {
      const before = transport.requests.filter((r) =>
        r.url.includes('telegram')
      ).length;
      const again = await b.notificationService!.deliverDigest({
        digest: {
          id: digestId,
          runId: runs[0]!.runId,
          profileId: 'profile-job',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          generatedAt: '2026-08-31T10:05:00.000Z',
          period: {
            from: '2026-08-31T10:00:00.000Z',
            to: '2026-08-31T10:05:00.000Z',
          },
          resultIds: ['r1'],
          entries: [
            {
              resultId: 'r1',
              rank: 1,
              rankValue: 0.9,
              novelty: 'NEW',
              userState: 'NEW',
              lifecycle: 'ACTIVE',
              shouldNotify: true,
            },
          ],
          newResultIds: ['r1'],
          updatedResultIds: [],
          summary: {
            totalResults: 1,
            newResults: 1,
            updatedResults: 0,
            unchangedResults: 0,
            notifiedResults: 1,
          },
        },
        recipient: { userId: 'user-1', address: '12345' },
        channel: 'TELEGRAM',
      });
      expect(again).toEqual({ kind: 'skipped', reason: 'already_delivered' });
      expect(
        transport.requests.filter((r) => r.url.includes('telegram')).length
      ).toBe(before);
    } finally {
      b.close();
      persistence.cleanup();
    }
  });
});
