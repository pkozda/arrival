---
id: adr-006-addendum-e6-1-production-application-boundary
title: ADR-006 Addendum — PDE E6.1 Production Application Boundary
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-31
updated: 2026-08-31
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e4-7-production-runtime-readiness
  - adr-006-addendum-e5-1-runtime-configuration-boundary
  - adr-006-addendum-e5-6-operational-health
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E6.1 Production Application Boundary

**Status:** Accepted (E6.1)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

E6.1 introduces `createDiscoveryService` / `DiscoveryService` — an **application/service boundary** around the existing `DiscoveryRuntime`.

```text
Host / composition root
        ↓
DiscoveryService  (lifecycle + orchestration)
        ↓
DiscoveryRuntime  (owns SQLite / adapters / scheduler / queue / worker)
```

The service contains **no discovery business logic**. It only orchestrates existing E4/E5 capabilities.

---

## Why it exists

`DiscoveryRuntime` is a composition root for infrastructure. Hosts need a stable, managed lifecycle API (`start` / `stop` / `runNow` / inspect) without HTTP, auth, UI, cron, or new storage.

E6.1 is that boundary. HTTP/admin APIs belong to later E6 work.

---

## Ownership

- Service **creates** the runtime on first successful `start()`.
- Service **owns** `runtime.close()` on `stop()`.
- Service does **not** independently close SQLite/queue/locks — that remains runtime-owned.
- Injected caller-owned resources (transport, rateLimiter, …) remain caller-owned (unchanged E5.1 rules).

---

## Lifecycle

```text
created → starting → ready ⇄ (idempotent start)
ready → stopping → stopped  (idempotent stop)
stopped → start rejected
```

### start()

1. Idempotent when already `ready`.
2. Constructs `createDiscoveryRuntime(config)` once.
3. Calls `recoverQueueClaims()` then `recoverSchedulerLocks()`.
4. Does **not** execute recovered jobs.
5. Construction/recovery failure → `DiscoveryServiceStartupError` (secrets redacted); runtime closed; state returns to `created`.

### stop()

1. Idempotent when already `stopped`.
2. Calls `runtime.close()`.
3. Mutating ops after stop → `DiscoveryServiceStoppedError`.
4. `getHealth()` after stop may return closed-runtime `UNAVAILABLE` (E5.6).

Pull-driven execution is preserved: no background worker/scheduler threads.

---

## API

| Method | Behavior |
|--------|----------|
| `runNow({ scheduleId })` | `scheduler.triggerNow` → enqueue only; does **not** advance `nextRunAt` |
| `triggerDueRuns()` | Scheduled tick; advances `nextRunAt` per E4.2 |
| `processNext()` | `worker.processNext` — queue → worker → pipeline |
| `getRun(runId)` | `runStore.get` (null if missing) |
| `getHealth()` | `runtime.getHealth` (E5.6) |
| `registerSchedule(...)` | Thin schedule registration for hosts |

`runNow` must never call `executeDiscoveryPipeline` directly.

---

## Outside E6.1

Intentionally deferred:

- HTTP / REST / GraphQL
- AuthN / AuthZ
- UI
- Cron daemon
- PostgreSQL / Redis
- OpenTelemetry exporters / Sentry
- Notification retry subsystem

---

## Consequences

### Positive

- Clear managed lifecycle for embedding PDE
- Reuses E5 recovery/health without duplication

### Non-goals

- Changing E1–E5 domain/runtime semantics
- Exactly-once delivery
- CSR / MBDE changes
