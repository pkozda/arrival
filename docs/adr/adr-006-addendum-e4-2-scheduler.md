---
id: adr-006-addendum-e4-2-scheduler
title: ADR-006 Addendum — PDE E4.2 Scheduler
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-31
updated: 2026-08-31
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e4-1-durable-result-persistence
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E4.2 Scheduler

**Status:** Accepted (E4.2)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

Introduce a **storage-neutral scheduler** that orchestrates recurring discovery runs without modifying pipeline stage order or domain semantics.

```text
ScheduleStore / RunStore (ports)
        ↓
createDiscoveryScheduler(...)
        ↓
createPipelineRunExecutor(...) → executeDiscoveryPipeline(...)
```

The scheduler answers **when** to run. The pipeline answers **how** discovery works.

## Schedule model

`DiscoveryScheduleRecord`:

- `scheduleId`, `profileId`, `strategyId`, `strategyVersion`
- `enabled`, `interval.intervalSeconds`, `timezone`
- `nextRunAt` (ISO)
- `runningRunId` (process-local overlap guard)

Fixed-interval recurrence only — **no cron expressions** in E4.2.

## Recurrence semantics

`nextRunAt` advances from the **previous scheduled slot**, not execution finish time:

```text
nextRunAt = previousScheduledAt + n * interval   (minimal n with result > now)
```

This prevents drift when runs take longer than the interval.

## Missed runs (coalescing)

No catch-up queue. If multiple intervals were missed while offline, **at most one run** executes on resume, then `nextRunAt` jumps to the next future slot.

Example: hourly schedule at 10:00 / 11:00 / 12:00, resume at 12:30 → **one run**, `nextRunAt = 13:00`.

## Overlap protection

Process-local only: `runningRunId` on the schedule record. Concurrent triggers for the same schedule return `already_running` / `claim_failed`. **No distributed locking** in E4.2.

## Manual trigger

`triggerNow(scheduleId)`:

- respects overlap protection
- allocates a new `runId`
- does **not** advance `nextRunAt`

## Disable / re-enable

- Disabled schedules are never due
- Re-enable recalculates `nextRunAt` from `now + interval`

## Run lifecycle

Scheduler stores metadata in `ScheduledRunRecord` (`runId`, `status`, timestamps). Pipeline `DiscoveryRunStatus` is reused — no second SUCCESS/FAILED model.

Scheduler does **not** persist full `PipelineExecuteResult` or Results (those remain in pipeline / ResultStore).

## Persistence

Ports: `ScheduleStore`, `RunStore`.

SQLite implementation: `createSqliteSchedulerPersistence` (tables `discovery_schedules`, `discovery_scheduler_runs`). Same `better-sqlite3` stack as E4.1; scheduler code does not import SQLite types.

`nextRunAt` survives process restart.

## Clock

Injectable `Clock` (`createSystemClock`, `createFakeClock`) — scheduler logic does not call `Date.now()` directly.

## Deferred

- Cron / calendar recurrence
- Distributed scheduler, Redis, queues
- Notification delivery (E4.4+)
- PostgreSQL scheduler adapter (planned alongside platform DB)
- UI schedule management

## Related

- [E4.1 durable persistence](./adr-006-addendum-e4-1-durable-result-persistence.md)
- [Discovery README](../discovery/README.md)
