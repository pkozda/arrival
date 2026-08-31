---
id: adr-006-addendum-e4-7-production-runtime-readiness
title: ADR-006 Addendum — PDE E4.7 Production Runtime Readiness
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-31
updated: 2026-08-31
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e3-8-production-smoke-hardening
  - adr-006-addendum-e4-1-durable-result-persistence
  - adr-006-addendum-e4-2-scheduler
  - adr-006-addendum-e4-3-execution-queue
  - adr-006-addendum-e4-4-notifications
  - adr-006-addendum-e4-5-production-email-notifications
  - adr-006-addendum-e4-6-telegram-notification
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E4.7 Production Runtime Readiness

**Status:** Accepted (E4.7)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

E4.7 is the **final E4 runtime integration/readiness gate**. It adds an explicit typed composition root and deterministic end-to-end integration coverage. It does **not** add new domain stages, providers, durable queues, or product features.

```text
createDiscoveryRuntime(config)
        ↓
SQLite Results + Scheduler + Notifications
        ↓
createProductionDiscoveryAdapters
        ↓
createPipelineRunExecutor → executeDiscoveryPipeline
        ↓
createDiscoveryNotificationService
        ↓  (channel router → EMAIL Resend / TELEGRAM Bot API)
createInMemoryExecutionQueue
        ↓
createDiscoveryScheduler  (enqueue only)
        ↓
createDiscoveryExecutionWorker  (dequeue + execute)
```

Lifecycle is **pull/trigger driven** — no background timers, cron, or daemon loops.

## Runtime API

```ts
createDiscoveryRuntime({
  production,           // DiscoveryProductionConfig (validated first)
  persistence: {
    resultsDatabasePath,
    schedulerDatabasePath,
    notificationsDatabasePath,
  },
  registry,
  profileStore,
  clock?,
  resolveNotificationTarget?,
  notificationAdapters?,  // optional override
  transport?,             // inject for tests
  …
}): DiscoveryRuntime

DiscoveryRuntime = {
  scheduler,
  worker,
  queue,
  pipelineExecutor,
  adapters,
  scheduleStore,
  runStore,
  resultStore,
  notificationStore,
  notificationService,  // null when no providers configured
  clock,
  close(),              // idempotent SQLite cleanup
}
```

## Resource ownership

Runtime-owned (closed by `close()`):

- SQLite Result persistence
- SQLite scheduler persistence
- SQLite notification persistence

Shared / injected (not closed by runtime unless created internally as defaults):

- `HttpTransport` (caller-owned when injected)
- `RateLimiter`
- `RawContentStore`

In-memory queue is process-local and discarded on close/restart.

## Persistence / restart

| State | Durable across restart? |
|-------|-------------------------|
| Schedules / `nextRunAt` / run metadata | Yes (SQLite) |
| Results | Yes (SQLite) |
| Notification records / idempotency | Yes (SQLite) |
| Queue jobs | **No** (in-memory — E4.3) |

After restart with an outstanding `runningRunId` and an empty queue, the process-local recovery gap from E4.3 remains **intentional**. E4.7 documents it; it does not implement a durable queue.

## Notification routing

`createChannelRoutingNotificationAdapter` routes by `NotificationChannel`.

Default wiring from production config:

- `email` → Resend adapter
- `telegram` → Telegram adapter

Either or both may be omitted. Pipeline remains provider-agnostic.

## Guarantees verified in E4.7

- Happy path: schedule → enqueue → worker → production adapters → Result → Digest → SENT → ACK
- Email and Telegram paths
- Pipeline without notification providers
- Scheduled vs manual `nextRunAt` semantics
- Missed-interval coalescing
- Duplicate enqueue / overlap protection
- Search / fetch / AI / notification failure isolation
- Worker continues after a failed job
- Cancel / timeout leave no fabricated Results and clear running locks
- Restart: schedules, Results, notification idempotency survive
- Secrets redacted; unexpected HTTP fails with `UNEXPECTED_NETWORK_REQUEST`
- Config validation fails fast without network

## Idempotency

Unchanged ownership:

- Queue: one active job per `runId`
- Notifications: `(profileId, digestId, channel, recipient)` via E4.4 service
- Results: identity key uniqueness via E4.1

## E4 completeness

**E4 is complete** when E4.1–E4.7 are accepted.

E4 does **not** include:

- PostgreSQL
- durable / distributed queue
- distributed locking
- cron / background scheduler daemon
- notification retries
- push notifications
- UI
- observability platform
- authentication
- new strategies / scoring / novelty models

Those belong to later epics (E5+).

## Related

- [E3.8 production smoke](./adr-006-addendum-e3-8-production-smoke-hardening.md)
- [E4.3 execution queue](./adr-006-addendum-e4-3-execution-queue.md)
- [E4.4 notifications](./adr-006-addendum-e4-4-notifications.md)
- [Discovery README](../discovery/README.md)
