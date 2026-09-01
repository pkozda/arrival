---
id: adr-006-addendum-e5-2-durable-execution-queue
title: ADR-006 Addendum — PDE E5.2 Durable Execution Queue & Crash Recovery
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-31
updated: 2026-08-31
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e4-3-execution-queue
  - adr-006-addendum-e4-7-production-runtime-readiness
  - adr-006-addendum-e5-1-runtime-configuration-boundary
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E5.2 Durable Execution Queue & Crash Recovery

**Status:** Accepted (E5.2)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

Replace the process-local in-memory execution queue gap with a **SQLite-backed durable queue** while preserving the existing `DiscoveryExecutionQueue` port and scheduler/worker semantics.

```text
Schedule → Scheduler → Durable Queue → Worker → executeDiscoveryPipeline
                                              → Persist + Digest → Notifications
```

`createInMemoryExecutionQueue()` remains available for unit tests. Production runtime defaults to `createSqliteExecutionQueue(...)`.

Architectural roles:

```text
Strategy  = what
Pipeline  = when (stages)
Adapter   = how (I/O)
Scheduler = when to enqueue
Queue     = durable execution handoff (+ claim recovery)
Worker    = execute
Runtime   = composition / lifecycle
```

---

## Delivery semantics (critical)

```text
Queue delivery:          at-least-once
Result persistence:      idempotent by result identity
Notification delivery:   idempotent by notification identity
```

A crash can occur after pipeline success / Result persist but before queue ACK. After restart and lease recovery, the **same `runId`** may execute again. Exactly-once execution is **not** claimed.

Recovery never invents a new discovery run to replace an abandoned job.

---

## Queue port (additive)

Existing methods preserved: `enqueue`, `dequeue`, `ack`, `fail`, `get`, `getByRunId`, `getPending`, `hasActiveRun`.

Additive:

- Optional `QueueClaimOptions.claimOwner` on `dequeue` / `ack` / `fail`
- `recoverExpiredClaims(now)` — requeues expired RUNNING claims; does **not** execute jobs

In-memory `recoverExpiredClaims` is a no-op.

---

## SQLite schema

Table `discovery_execution_jobs` (fourth runtime SQLite DB by default):

| Column | Role |
|--------|------|
| `job_id` | PK — queue message identity |
| `run_id` | Discovery execution identity |
| schedule/profile/strategy fields | Reconstruct execution request |
| `status` | QUEUED / RUNNING / COMPLETED / FAILED / CANCELLED |
| `attempt` | Incremented on lease recovery |
| `available_at` | When QUEUED becomes claimable |
| `claimed_at` / `claim_owner` | Lease ownership |
| `metadata` | Optional safe string map only |

Partial unique index: at most one active (`QUEUED`|`RUNNING`) row per `run_id`.

Payload never stores API keys, tokens, auth headers, adapters, transports, signals, or functions.

---

## Claim / lease

```text
dequeue → QUEUED → RUNNING (claimed_at, claim_owner)
ack     → COMPLETED (claimant only)
fail    → FAILED (claimant only)

if now > claimed_at + visibilityTimeout
  recoverExpiredClaims → RUNNING → QUEUED (same runId, attempt++)
```

Worker identity (`workerId`) is injected — not derived from hostname/PID.

Default visibility timeout: 5 minutes (overridable).

---

## Startup recovery

`createDiscoveryRuntime` opens a durable queue with `recoverOnOpen: true` (requeues expired claims only; does not run the worker).

Also exposes `runtime.recoverQueueClaims()` for explicit re-invocation. No background timers or cron.

---

## Scheduler lock interaction

`ScheduleStore.clearRunningLock(scheduleId, now, expectedRunId?)` clears only when `runningRunId` matches `expectedRunId` (when provided). Stale recovered workers cannot clear a newer run's lock.

---

## Runtime ownership

| Resource | Owner |
|----------|--------|
| Runtime-created queue SQLite DB | Runtime (`close()`) |
| Injected `queue` | Caller |
| Results / Scheduler / Notifications SQLite | Runtime (unchanged) |

---

## Explicit non-goals (E5.2)

E5.2 does **NOT** introduce:

- PostgreSQL / Redis / distributed queue service
- Distributed locking
- Cron daemon / automatic execution loop
- Exponential retries
- Notification retries
- Observability platform
- Authentication
- UI
- New discovery strategies

---

## Consequences

- Queued work survives process restart
- Abandoned RUNNING jobs become reclaimable after lease expiry
- Host remains pull/trigger driven (`triggerDueRuns` → `processNext`)
- E1–E5.1 discovery semantics unchanged
