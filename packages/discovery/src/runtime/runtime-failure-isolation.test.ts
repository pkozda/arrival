import { describe, expect, it } from 'vitest';
import {
  createRuntimeHarness,
  happyPathTransport,
  registerDueSchedule,
  runDueOnce,
  SECRETS,
} from './runtime-test-helpers.js';

describe('E4.7 runtime failure isolation', () => {
  it('search failure → no fabricated Result; terminal run; lock cleared', async () => {
    const transport = happyPathTransport({
      onSearch: () => ({ status: 503, bodyText: 'unavailable' }),
    });
    const { runtime, persistence } = createRuntimeHarness({ transport });

    try {
      await registerDueSchedule(runtime, 'sched-search-fail');
      const { workerResult } = await runDueOnce(runtime);
      expect(workerResult.kind).toBe('processed');
      expect(
        (runtime.resultStore as { count(): number }).count()
      ).toBe(0);
      expect(
        (await runtime.scheduleStore.get('sched-search-fail'))?.runningRunId
      ).toBeNull();
      const run = (await runtime.runStore.listBySchedule('sched-search-fail'))[0];
      expect(run?.status).toMatch(/FAILED|PARTIAL_SUCCESS/);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('fetch failure → no fake collected promotion path for that URL', async () => {
    const transport = happyPathTransport({
      onPage: () => ({ status: 500, bodyText: 'boom' }),
    });
    const { runtime, persistence } = createRuntimeHarness({ transport });

    try {
      await registerDueSchedule(runtime, 'sched-fetch-fail');
      const { workerResult } = await runDueOnce(runtime);
      expect(workerResult.kind).toBe('processed');
      // No promoted Result when fetch fails for the only candidate
      expect(
        (runtime.resultStore as { count(): number }).count()
      ).toBe(0);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('verification gate: default job strategy does not promote AGGREGATOR as OFFICIAL', async () => {
    const { createDiscoveryRuntime, createFakeClock, createInMemoryProfileStore, createStrategyRegistry, jobDiscoveryStrategyV1 } =
      await import('../index.js');
    const { jobProfile, happyPathTransport: hp, tempPersistencePaths, RUNTIME_NOW, SECRETS: S } =
      await import('./runtime-test-helpers.js');

    const transport = hp();
    const persistence = tempPersistencePaths();
    const runtime = createDiscoveryRuntime({
      production: {
        brave: { apiKey: S.brave },
        openai: { apiKey: S.openai },
        email: { apiKey: S.resend, from: 'a@b.com' },
        transport,
      },
      persistence,
      registry: createStrategyRegistry([jobDiscoveryStrategyV1]),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      transport,
      clock: createFakeClock(RUNTIME_NOW),
      resolveNotificationTarget: () => ({
        channel: 'EMAIL',
        recipient: { userId: 'user-1', address: 'user@example.com' },
      }),
    });

    try {
      await runtime.scheduler.registerSchedule({
        scheduleId: 'sched-verify',
        profileId: 'profile-job',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        intervalSeconds: 3600,
        nextRunAt: RUNTIME_NOW,
      });
      await runtime.scheduler.triggerDueRuns();
      await runtime.worker.processNext();
      expect(
        (runtime.resultStore as { count(): number }).count()
      ).toBe(0);
      expect(
        (runtime.notificationStore as { count(): number }).count()
      ).toBe(0);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('AI failure → PARTIAL_SUCCESS possible; no fake AI evaluation; run not FAILED solely for AI', async () => {
    const transport = happyPathTransport({
      onAi: () => ({
        status: 503,
        bodyText: `unavailable ${SECRETS.openai}`,
      }),
    });
    const { runtime, persistence } = createRuntimeHarness({ transport });

    try {
      await registerDueSchedule(runtime, 'sched-ai-fail');
      const { workerResult } = await runDueOnce(runtime);
      expect(workerResult).toMatchObject({ kind: 'processed' });
      if (workerResult.kind === 'processed') {
        expect(['PARTIAL_SUCCESS', 'SUCCESS']).toContain(
          workerResult.pipelineStatus
        );
      }
      const run = (await runtime.runStore.listBySchedule('sched-ai-fail'))[0];
      expect(run?.status).not.toBe('FAILED');
      const blob = JSON.stringify(run);
      expect(blob).not.toContain(SECRETS.openai);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('notification failure → FAILED notification; discovery SUCCESS; queue ACKed', async () => {
    const transport = happyPathTransport({
      onResend: () => ({ status: 503, bodyText: 'down' }),
    });
    const { runtime, persistence } = createRuntimeHarness({
      transport,
      channel: 'EMAIL',
    });

    try {
      await registerDueSchedule(runtime, 'sched-notify-fail');
      const { workerResult } = await runDueOnce(runtime);
      expect(workerResult).toMatchObject({
        kind: 'processed',
        pipelineStatus: 'SUCCESS',
      });
      const run = (await runtime.runStore.listBySchedule('sched-notify-fail'))[0];
      expect(run?.status).toBe('SUCCESS');
      expect(
        (runtime.notificationStore as { count(): number }).count()
      ).toBe(1);
      // Notification record is FAILED but discovery succeeded
      // Re-deliver same digest via service would be already_delivered or FAILED record exists
      expect(
        (await runtime.scheduleStore.get('sched-notify-fail'))?.runningRunId
      ).toBeNull();
      const runs = await runtime.runStore.listBySchedule('sched-notify-fail');
      const job = await runtime.queue.getByRunId(runs[0]!.runId);
      expect(job?.status).toBe('COMPLETED');
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('worker continues after one failed job', async () => {
    let searchCalls = 0;
    const transport = happyPathTransport({
      onSearch: () => {
        searchCalls += 1;
        // Jobs issues job-q1 then job-q2 per run (2 HTTP searches).
        // Fail both queries of the first job; succeed both for the second.
        if (searchCalls <= 2) {
          return { status: 503, bodyText: 'fail' };
        }
        return {
          status: 200,
          bodyText: JSON.stringify({
            web: {
              results: [
                {
                  title: 'Frontend Engineer',
                  url: 'https://careers.employer.example/jobs/frontend-engineer',
                  description: 'Acme',
                },
              ],
            },
          }),
        };
      },
    });
    const { runtime, persistence } = createRuntimeHarness({ transport });

    try {
      await runtime.scheduler.registerSchedule({
        scheduleId: 'sched-a',
        profileId: 'profile-job',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        intervalSeconds: 3600,
        nextRunAt: '2026-08-31T10:00:00.000Z',
      });
      await runtime.scheduler.registerSchedule({
        scheduleId: 'sched-b',
        profileId: 'profile-job',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        intervalSeconds: 3600,
        nextRunAt: '2026-08-31T10:00:00.000Z',
      });

      await runtime.scheduler.triggerDueRuns();
      expect((await runtime.queue.getPending()).length).toBe(2);

      await runtime.worker.processNext();
      await runtime.worker.processNext();

      // 2 jobs × 2 Jobs queries = 4 search HTTP calls (no retry storm)
      expect(searchCalls).toBe(4);
      expect(
        (await runtime.scheduleStore.get('sched-a'))?.runningRunId
      ).toBeNull();
      expect(
        (await runtime.scheduleStore.get('sched-b'))?.runningRunId
      ).toBeNull();
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('cancellation → no fabricated Result; lock cleared', async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({
      transport,
      signal: controller.signal,
    });

    try {
      await registerDueSchedule(runtime, 'sched-cancel');
      const { workerResult } = await runDueOnce(runtime);
      expect(workerResult.kind).toBe('processed');
      expect(
        (runtime.resultStore as { count(): number }).count()
      ).toBe(0);
      expect(
        (await runtime.scheduleStore.get('sched-cancel'))?.runningRunId
      ).toBeNull();
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('adapter timeout → no fake Result; lock cleared', async () => {
    const transport = happyPathTransport({
      onSearch: () =>
        new Promise(() => {
          /* hang */
        }),
    });
    const { runtime, persistence } = createRuntimeHarness({
      transport,
      adapterTimeoutMs: 25,
    });

    try {
      await registerDueSchedule(runtime, 'sched-timeout');
      const { workerResult } = await runDueOnce(runtime);
      expect(workerResult.kind).toBe('processed');
      expect(
        (runtime.resultStore as { count(): number }).count()
      ).toBe(0);
      expect(
        (await runtime.scheduleStore.get('sched-timeout'))?.runningRunId
      ).toBeNull();
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });
});
