import { describe, expect, it } from 'vitest';
import {
  resultIdentityKey,
  type DiscoveryResult,
} from '../index.js';
import {
  CANDIDATE_URL,
  createRuntimeHarness,
  happyPathTransport,
  registerDueSchedule,
  runDueOnce,
  SMOKE_JOB_HTML,
  tempPersistencePaths,
} from './runtime-test-helpers.js';

const PROFILE_ID = 'profile-job';
const IDENTITY_FIELDS = ['title', 'company'] as const;
const SCHEDULE_ID = 'sched-e7-history';

function jobHtmlWithSalary(salary: string): string {
  return SMOKE_JOB_HTML.replace(
    '  <div data-field="employmentType">full-time</div>\n',
    `  <div data-field="employmentType">full-time</div>\n  <div data-field="salary">${salary}</div>\n`
  );
}

function resendCount(transport: { requests: { url: string }[] }): number {
  return transport.requests.filter((r) => r.url.includes('resend')).length;
}

function smokeIdentity(company: string | null = null) {
  return {
    externalIds: { url: CANDIDATE_URL },
    canonicalUrl: CANDIDATE_URL,
    fingerprintMaterial: {
      title: 'Frontend Engineer',
      company,
    },
  };
}

async function findPersistedSmokeResult(
  resultStore: {
    findByIdentity: (
      profileId: string,
      identity: ReturnType<typeof smokeIdentity>,
      fields: readonly string[]
    ) => Promise<DiscoveryResult | null>;
  },
  company: string | null = null
): Promise<DiscoveryResult | null> {
  return resultStore.findByIdentity(PROFILE_ID, smokeIdentity(company), IDENTITY_FIELDS);
}

describe('E7.7 unchanged second run (runtime + SQLite)', () => {
  it('Run 1 notifies; Run 2 UNCHANGED across runtime restart suppresses notification', async () => {
    const persistence = tempPersistencePaths();
    const transport = happyPathTransport();

    let firstSeenAt = '';
    let lastChangedAtRun1 = '';

    const { runtime: runtimeA } = createRuntimeHarness({ transport, persistence });
    try {
      await registerDueSchedule(runtimeA, SCHEDULE_ID);
      const run1 = await runDueOnce(runtimeA);
      expect(run1.workerResult).toMatchObject({
        kind: 'processed',
        pipelineStatus: 'SUCCESS',
      });
      expect(resendCount(transport)).toBe(1);
      expect((runtimeA.resultStore as { count(): number }).count()).toBe(1);

      const afterRun1 = await findPersistedSmokeResult(runtimeA.resultStore);
      expect(afterRun1).not.toBeNull();
      firstSeenAt = afterRun1!.firstSeenAt;
      lastChangedAtRun1 = afterRun1!.lastChangedAt;
    } finally {
      runtimeA.close();
    }

    const { runtime: runtimeB } = createRuntimeHarness({ transport, persistence });
    try {
      const pipelineRun2 = await runtimeB.pipelineExecutor.execute({
        scheduleId: SCHEDULE_ID,
        profileId: PROFILE_ID,
        runId: 'run-e7-unchanged-2',
        trigger: 'manual',
      });
      const cand = pipelineRun2.batch.active[0]!;
      expect(cand.noveltyDecision?.novelty).toBe('UNCHANGED');
      expect(cand.noveltyDecision?.changedFields).toEqual([]);
      expect(cand.persistOutcome).toBe('UNCHANGED');
      expect(pipelineRun2.digest?.entries.length).toBe(0);

      const resendBeforeRun2Worker = resendCount(transport);
      await runtimeB.scheduler.triggerNow(SCHEDULE_ID);
      await runtimeB.worker.processNext();
      expect(resendCount(transport)).toBe(resendBeforeRun2Worker);

      const afterRun2 = await findPersistedSmokeResult(runtimeB.resultStore);
      expect(afterRun2?.firstSeenAt).toBe(firstSeenAt);
      expect(afterRun2?.lastChangedAt).toBe(lastChangedAtRun1);
      expect((runtimeB.resultStore as { count(): number }).count()).toBe(1);
      expect((runtimeB.notificationStore as { count(): number }).count()).toBe(1);
    } finally {
      runtimeB.close();
      persistence.cleanup();
    }
  });
});

describe('E7.8 salary update (runtime + SQLite)', () => {
  it('€60k → €65k updates same result, digest notifies, timestamps preserved', async () => {
    const persistence = tempPersistencePaths();
    let pageHtml = jobHtmlWithSalary('€60,000');
    const transport = happyPathTransport({
      onPage: () => ({
        status: 200,
        bodyText: pageHtml,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        finalUrl: CANDIDATE_URL,
      }),
    });

    const { runtime: runtimeA } = createRuntimeHarness({ transport, persistence });
    let resultIdRun1 = '';
    let firstSeenAt = '';
    let lastChangedAtRun1 = '';
    try {
      await registerDueSchedule(runtimeA, SCHEDULE_ID);
      const run1 = await runDueOnce(runtimeA);
      expect(run1.workerResult).toMatchObject({
        kind: 'processed',
        pipelineStatus: 'SUCCESS',
      });
      expect(resendCount(transport)).toBe(1);

      const afterRun1 = await findPersistedSmokeResult(runtimeA.resultStore);
      expect(afterRun1).not.toBeNull();
      resultIdRun1 = afterRun1!.id;
      firstSeenAt = afterRun1!.firstSeenAt;
      lastChangedAtRun1 = afterRun1!.lastChangedAt;
      expect(afterRun1!.materialFields?.salary).toBe('€60,000');
      expect(afterRun1!.userState).toBe('NOTIFIED');
    } finally {
      runtimeA.close();
    }

    pageHtml = jobHtmlWithSalary('€65,000');
    const { runtime: runtimeB } = createRuntimeHarness({
      transport,
      persistence,
      start: '2026-09-01T10:00:00.000Z',
    });
    try {
      const pipelineRun2 = await runtimeB.pipelineExecutor.execute({
        scheduleId: SCHEDULE_ID,
        profileId: PROFILE_ID,
        runId: 'run-e7-salary-2',
        trigger: 'manual',
      });
      const cand = pipelineRun2.batch.active[0]!;
      expect(cand.noveltyDecision?.novelty).toBe('UPDATED');
      expect(cand.noveltyDecision?.changedFields).toContain('extracted.salary');
      expect(cand.persistOutcome).toBe('UPDATED');
      expect(pipelineRun2.digest?.entries.length).toBe(1);
      expect(pipelineRun2.digest?.entries[0]?.novelty).toBe('UPDATED');
      expect(pipelineRun2.digest?.entries[0]?.shouldNotify).toBe(true);

      const expectedId = `result:${PROFILE_ID}:${resultIdentityKey(
        smokeIdentity(),
        IDENTITY_FIELDS
      )}`;
      expect(cand.promotedResult?.id).toBe(expectedId);
      expect(cand.promotedResult?.id).toBe(resultIdRun1);

      const deliver = await runtimeB.notificationService!.deliverDigest({
        digest: pipelineRun2.digest!,
        recipient: { userId: 'user-1', address: 'user@example.com' },
        channel: 'EMAIL',
      });
      expect(deliver.kind).toBe('delivered');
      expect(resendCount(transport)).toBe(2);
      expect((runtimeB.notificationStore as { count(): number }).count()).toBe(2);

      const afterRun2 = await findPersistedSmokeResult(runtimeB.resultStore);
      expect(afterRun2?.id).toBe(resultIdRun1);
      expect(afterRun2?.materialFields?.salary).toBe('€65,000');
      expect(afterRun2?.firstSeenAt).toBe(firstSeenAt);
      expect(afterRun2?.lastChangedAt).not.toBe(lastChangedAtRun1);
      expect(afterRun2?.lastVerifiedAt).toBeTruthy();
      expect(afterRun2?.userState).toBe('NOTIFIED');
      expect(afterRun2?.lifecycle).toBe('UPDATED');
      expect((runtimeB.resultStore as { count(): number }).count()).toBe(1);

      const pipelineRun3 = await runtimeB.pipelineExecutor.execute({
        scheduleId: SCHEDULE_ID,
        profileId: PROFILE_ID,
        runId: 'run-e7-salary-3',
        trigger: 'manual',
      });
      expect(pipelineRun3.batch.active[0]?.noveltyDecision?.novelty).toBe('UNCHANGED');
      expect(pipelineRun3.batch.active[0]?.noveltyDecision?.changedFields).toEqual(
        []
      );
      expect(pipelineRun3.digest?.entries.length).toBe(0);

      const resendBefore = resendCount(transport);
      const skipped = await runtimeB.notificationService!.deliverDigest({
        digest: pipelineRun3.digest!,
        recipient: { userId: 'user-1', address: 'user@example.com' },
        channel: 'EMAIL',
      });
      expect(skipped).toEqual({ kind: 'skipped', reason: 'empty_digest' });
      expect(resendCount(transport)).toBe(resendBefore);
    } finally {
      runtimeB.close();
      persistence.cleanup();
    }
  });
});
