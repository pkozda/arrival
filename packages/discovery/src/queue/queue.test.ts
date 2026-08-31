import { describe, expect, it } from 'vitest';
import { createInMemoryExecutionQueue } from './fakes/in-memory-execution-queue.js';
import type { EnqueueJobInput } from './types.js';

function baseInput(overrides: Partial<EnqueueJobInput> = {}): EnqueueJobInput {
  return {
    jobId: 'job-1',
    runId: 'run-1',
    scheduleId: 'sched-1',
    profileId: 'profile-1',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    trigger: 'scheduled',
    requestedAt: '2026-08-31T10:00:00.000Z',
    ...overrides,
  };
}

describe('E4.3 in-memory execution queue', () => {
  it('enqueue/dequeue FIFO', async () => {
    const queue = createInMemoryExecutionQueue();
    await queue.enqueue(baseInput({ jobId: 'job-a', runId: 'run-a', requestedAt: '2026-08-31T10:00:00.000Z' }));
    await queue.enqueue(baseInput({ jobId: 'job-b', runId: 'run-b', requestedAt: '2026-08-31T10:01:00.000Z' }));

    const first = await queue.dequeue();
    const second = await queue.dequeue();
    expect(first?.jobId).toBe('job-a');
    expect(second?.jobId).toBe('job-b');
    expect(first?.status).toBe('RUNNING');
    expect(await queue.dequeue()).toBeNull();
  });

  it('duplicate job protection by runId', async () => {
    const queue = createInMemoryExecutionQueue();
    const first = await queue.enqueue(baseInput());
    expect(first.ok).toBe(true);

    const dup = await queue.enqueue(baseInput({ jobId: 'job-2' }));
    expect(dup).toEqual({ ok: false, reason: 'duplicate_run_id' });
    expect(queue.size()).toBe(1);
  });

  it('duplicate job protection by jobId', async () => {
    const queue = createInMemoryExecutionQueue();
    await queue.enqueue(baseInput());
    const dup = await queue.enqueue(baseInput({ runId: 'run-2' }));
    expect(dup).toEqual({ ok: false, reason: 'duplicate_job_id' });
  });

  it('ack completes job', async () => {
    const queue = createInMemoryExecutionQueue();
    await queue.enqueue(baseInput());
    const job = await queue.dequeue();
    await queue.ack(job!.jobId, '2026-08-31T10:05:00.000Z');

    const stored = await queue.get(job!.jobId);
    expect(stored?.status).toBe('COMPLETED');
    expect(stored?.finishedAt).toBe('2026-08-31T10:05:00.000Z');
    expect(await queue.hasActiveRun('run-1')).toBe(false);
  });

  it('fail records failure reason and attempt', async () => {
    const queue = createInMemoryExecutionQueue();
    await queue.enqueue(baseInput());
    const job = await queue.dequeue();
    await queue.fail(job!.jobId, '2026-08-31T10:05:00.000Z', 'pipeline error');

    const stored = await queue.get(job!.jobId);
    expect(stored?.status).toBe('FAILED');
    expect(stored?.failureReason).toBe('pipeline error');
    expect(stored?.attempt).toBe(1);
    expect(await queue.hasActiveRun('run-1')).toBe(false);
  });

  it('getPending returns only queued jobs', async () => {
    const queue = createInMemoryExecutionQueue();
    await queue.enqueue(baseInput({ jobId: 'job-a', runId: 'run-a' }));
    await queue.enqueue(baseInput({ jobId: 'job-b', runId: 'run-b', requestedAt: '2026-08-31T10:01:00.000Z' }));
    await queue.dequeue();

    const pending = await queue.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.jobId).toBe('job-b');
  });

  it('snapshot is inspectable', async () => {
    const queue = createInMemoryExecutionQueue();
    await queue.enqueue(baseInput());
    expect(queue.snapshot()).toHaveLength(1);
    expect(queue.size()).toBe(1);
  });

  it('queued jobs are lost on new queue instance (in-memory durability gap)', () => {
    const queue1 = createInMemoryExecutionQueue();
    void queue1.enqueue(baseInput());
    const queue2 = createInMemoryExecutionQueue();
    expect(queue2.snapshot()).toHaveLength(0);
  });
});
