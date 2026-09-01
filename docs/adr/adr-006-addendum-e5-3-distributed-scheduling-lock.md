---
id: adr-006-addendum-e5-3-distributed-scheduling-lock
title: ADR-006 Addendum — PDE E5.3 Distributed-Safe Scheduling & Locking
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
  - adr-006-addendum-e4-3-execution-queue
  - adr-006-addendum-e5-2-durable-execution-queue
  - adr-006-addendum-e5-1-runtime-configuration-boundary
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E5.3 Distributed-Safe Scheduling & Locking

**Status:** Accepted (E5.3)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Context

Process-local overlap protection (`runningRunId` in a single process) is insufficient when multiple runtime instances may call `triggerDueRuns` against the same durable schedule store.

Two concurrency mechanisms must remain distinct:

| Mechanism | Protects | Owner |
|-----------|----------|--------|
| **Scheduler lock** (E5.3) | schedule → run creation / enqueue | `SchedulerLock` |
| **Queue job lease** (E5.2) | job → worker execution | Durable queue claim |

Exactly-once execution is **not** claimed. The model remains:

```text
at-least-once execution
+ idempotent run identity
+ idempotent Result persistence
+ idempotent notification delivery
```

---

## Decision

Introduce a storage-neutral `SchedulerLock` port and a durable SQLite implementation.

```ts
SchedulerLock {
  tryAcquire(key, ownerId, now, leaseMs) → acquired | already_locked | …
  release(key, ownerId) → released | not_owner | …
  recoverExpired(now) → recoveredKeys
  get(key)
}
```

Lock key / owner conventions:

```text
lockKey = schedule:{scheduleId}
ownerId = scheduler:{runtimeInstanceId}
```

Default lease: **30 seconds** (`schedulerLockLeaseMs`) — covers the enqueue critical section only.

### Scheduler integration

```text
triggerDueRuns / triggerNow
      ↓
recoverExpired (opportunistic)
      ↓
tryAcquire(schedule lock)
      ↓
if contended → skip reason: lock_contended
      ↓
re-check schedule / runningRunId / tryClaim
      ↓
insert run + enqueue (+ advance nextRunAt if scheduled)
      ↓
release lock   ← never held across pipeline execution
```

`runningRunId` remains the active-run guard after the scheduler lock is released (worker execution window).

### Manual triggers

`triggerNow` **uses the same schedule lock** (smallest consistent multi-instance model). It still does **not** advance `nextRunAt`.

### SQLite

Table `discovery_scheduler_locks` (stored in the scheduler DB file by default):

```text
lock_key PRIMARY KEY
owner_id
acquired_at
expires_at
```

Acquire uses a transaction + primary key + conditional upsert so two connections cannot both hold an unexpired lock.

### Runtime

`createDiscoveryRuntime` creates a durable lock store when not injected, recovers expired locks on open, exposes `schedulerLock` + `recoverSchedulerLocks()`, and closes runtime-owned lock persistence on `close()`.

---

## SQLite deployment limitation

SQLite locking is **file-local**. Multiple processes on one host sharing the same DB file can contend correctly. Multi-host / networked coordination requires PostgreSQL or Redis (deferred — ports remain storage-neutral).

Do not treat SQLite as a multi-region distributed lock service.

---

## Explicit non-goals (E5.3)

- PostgreSQL / Redis
- Cron / timers / auto-execution loops
- Distributed worker orchestration
- Observability platform
- Notification retries
- Pipeline / strategy / scoring / verification changes
- Exactly-once claims

---

## Consequences

- Multiple scheduler instances may race a due tick; at most one active run is enqueued per schedule slot under durable lock + `runningRunId` + queue idempotency
- Lock contention is non-fatal (`lock_contended`)
- Expired locks recover without permanent deadlock
- Queue leases remain E5.2’s responsibility
