---
id: adr-006-addendum-e4-3-execution-queue
title: ADR-006 Addendum — PDE E4.3 Execution Queue
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-31
updated: 2026-08-31
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e4-2-scheduler
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E4.3 Execution Queue

**Status:** Accepted (E4.3)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

Introduce a **storage-neutral execution queue** between the scheduler and pipeline executor.

```text
ScheduleStore / RunStore (durable, E4.2)
        ↓
createDiscoveryScheduler(...)  →  enqueue only
        ↓
DiscoveryExecutionQueue (in-memory, E4.3)
        ↓
createDiscoveryExecutionWorker(...)
        ↓
createPipelineRunExecutor(...) → executeDiscoveryPipeline(...)
```

The scheduler answers **when** to run and **hands off** work.  
The queue answers **how runs are queued for execution**.  
The worker answers **who dequeues and invokes** the pipeline.  
The pipeline answers **how** discovery works.

## Queue contract

`DiscoveryExecutionQueue` port:

- `enqueue`, `dequeue`, `ack`, `fail`, `get`, `getByRunId`, `getPending`, `hasActiveRun`

`DiscoveryExecutionJob` fields include `jobId`, `runId`, `scheduleId`, `profileId`, `strategyId`, `strategyVersion`, `trigger`, `requestedAt`, `attempt`, `status`.

No broker/SQLite/Redis types leak into the port.

## Job vs run identity

| Field | Meaning |
|-------|---------|
| `jobId` | Queue message identity (delivery infrastructure) |
| `runId` | Discovery execution identity (pipeline / ResultStore) |

They are **not interchangeable**. `JobIdGenerator` and `RunIdGenerator` are injected for deterministic tests.

## Queue job lifecycle

Distinct from pipeline `DiscoveryRunStatus`:

```text
QUEUED → RUNNING → COMPLETED
                 → FAILED
QUEUED → CANCELLED (optional, minimal in E4.3)
```

`attempt` is tracked; **no automatic retry policy** in E4.3. Failed jobs record `failureReason` and timestamps.

## Idempotency

- One `runId` → at most one active (`QUEUED` or `RUNNING`) job.
- Duplicate enqueue returns `{ ok: false, reason: 'duplicate_run_id' | 'duplicate_job_id' }`.
- Worker skips re-execution when run metadata is already terminal (`SUCCESS`, `PARTIAL_SUCCESS`, `FAILED`, `CANCELLED`).

## Scheduler integration (E4.2 semantics preserved)

On due or manual trigger:

1. Claim schedule (`runningRunId`)
2. Create run metadata with `status: PENDING`
3. Enqueue execution job
4. For **scheduled** triggers: advance `nextRunAt` from scheduled slot (not finish time)
5. **Manual** `triggerNow` does **not** advance `nextRunAt`

Scheduler **never** calls `executeDiscoveryPipeline`.

`TriggerRunOutcome` is now `kind: 'enqueued'` (not `'executed'`).

## Overlap protection

`runningRunId` remains set from claim until worker `clearRunningLock`.  
Both **QUEUED** and **RUNNING** jobs count as active — duplicate ticks/manual triggers skip with `already_running`.

Process-local only (same as E4.2).

## Worker behavior

`createDiscoveryExecutionWorker({ queue, executor, runStore, scheduleStore, clock })`:

1. Dequeue job (FIFO)
2. Transition run metadata to `RUNNING`
3. Invoke `DiscoveryRunExecutor`
4. Update run metadata with pipeline terminal status
5. `ack` or `fail` job; `clearRunningLock` on schedule
6. Failure of job A does not block job B

No discovery business logic in the worker.

## Durability gap (intentional)

| Component | Durability |
|-----------|------------|
| Schedule / run metadata (SQLite) | Survives restart (E4.2) |
| Execution queue (in-memory) | **Lost on process restart** |

Known recovery gap: after restart, a `PENDING` run with `runningRunId` set may exist without a corresponding queued job. Full recovery belongs to a future **durable queue** stage.

## Crash semantics (E4.3, process-local)

| Crash point | Observable state |
|-------------|------------------|
| A. Run metadata created, before enqueue | `runningRunId` set; no job — lock may block schedule |
| B. Enqueued, before `nextRunAt` advance | Job in queue; schedule may be inconsistent until tick retries |
| C. Worker dequeued, before ack | Job `RUNNING`; may re-execute on restart (at-least-once design) |
| D. Pipeline complete, before ack | Same as C; Result persistence idempotency helps |

**Exactly-once execution is NOT claimed.** Queue delivery is designed for future **at-least-once** with idempotent pipeline invocation via `runId` and Result identity.

## Deferred

- Redis / BullMQ / SQS / Kafka / durable PostgreSQL queue
- Distributed workers and locks
- Automatic retry policy
- Notifications (E4.4)
- Horizontal autoscaling

## Consequences

- Clean boundary before choosing production queue infrastructure
- Scheduler tests no longer require synchronous pipeline execution
- Operators must run a worker loop alongside the scheduler in production wiring
- E4.4 (notifications) can build on completed runs without coupling to scheduler timing
