---
id: adr-006-addendum-e5-6-operational-health
title: ADR-006 Addendum — PDE E5.6 Operational Health & Runtime Control
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-31
updated: 2026-08-31
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e5-1-runtime-configuration-boundary
  - adr-006-addendum-e5-2-durable-execution-queue
  - adr-006-addendum-e5-3-distributed-scheduling-lock
  - adr-006-addendum-e5-4-durable-retry-policy
  - adr-006-addendum-e5-5-observability
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E5.6 Operational Health & Runtime Control

**Status:** Accepted (E5.6)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

E5.6 adds a **provider-neutral, read-mostly operational health boundary** on the Discovery runtime.

```text
composition root / future API
        ↓
runtime.getHealth()
        ↓
queue / schedule / run / lock / config / observations
        ↓
DiscoveryRuntimeHealth (typed, redacted)
```

Health is **inspection infrastructure**, not discovery domain logic. It must not change eligibility, scoring, novelty, promotion, digest, retry, queue delivery, or scheduler decisions.

Authenticated HTTP admin APIs, force-retry, job deletion, and provider reconfiguration are **deferred**.

---

## Health states

```text
HEALTHY      → runtime open, required persistence available, no severe warnings
DEGRADED     → open and executable, but operational issues (expired claims, backlog, observed provider failures, contention observed)
UNAVAILABLE  → runtime closed or required persistence unavailable/error
```

Aggregation is explicit and deterministic — not a business score.

---

## API

```ts
runtime.getHealth(): Promise<DiscoveryRuntimeHealth>
```

Lifecycle:

- Open runtime → inspect stores with **read-only** queries
- Closed runtime → return `UNAVAILABLE` **without** touching SQLite (no `DiscoveryRuntimeClosedError`)

Existing control primitives remain the only mutators:

- `recoverQueueClaims()`
- `recoverSchedulerLocks()`

No generic `runtime.admin(command)`.

---

## Inspection surfaces

### Queue

`DiscoveryExecutionQueue.getHealthStats(now, { visibilityTimeoutMs? })`:

- queued / running / failed counts
- oldest queued / running timestamps
- `recoverableClaimCount` (expired leases) — **does not recover**

### Scheduler

- `ScheduleStore.listAll()` for enabled/disabled/active-run counts and `nextScheduledRunAt`
- `SchedulerLock.countActive(now)` — read-only; **never acquires** locks for health

### Runs

- `RunStore.listRecent(limit)` — compact status metadata only

### Persistence

- Availability derived from runtime open/closed (and probe errors)
- No arbitrary SQL from the health API

### Providers

Configured enablement from E5.1 ≠ reachability.

```text
configured / enabled + lastObservedStatus: UNKNOWN | HEALTHY | DEGRADED
```

**No network probes** to Brave / OpenAI / Resend / Telegram.

Disabled optional notification providers are not failures.

---

## Telemetry relationship

E5.5 telemetry may feed an observation tracker (adapter/notification outcomes, lock contention).

- Telemetry remains best-effort
- Telemetry sink failure **must not** make the runtime `UNAVAILABLE`/`DEGRADED` by itself
- Health reads do not emit telemetry storms

---

## Side-effect guarantees

`getHealth()` must not:

- advance schedules
- enqueue / claim / ack / fail / retry jobs
- recover expired claims
- acquire scheduler locks
- write Results
- send notifications

---

## Security

Health JSON must never contain API keys, tokens, Authorization headers, prompts, page content, or notification payloads. Reuse E5.1/E5.5 redaction patterns; serialize in tests.

---

## Relationship to E5.1–E5.5

| Epic | Role |
|------|------|
| E5.1 | Config / lifecycle / provider enablement / redaction |
| E5.2 | Queue stats + recoverable claims (inspection only) |
| E5.3 | Lock count without acquire |
| E5.4 | Retry unchanged; health does not retry |
| E5.5 | Optional observation input |
| E5.6 | Health aggregation + `getHealth()` (this addendum) |

---

## Consequences

### Positive

- Composition roots can poll operational readiness cheaply
- Clear separation between inspect vs recover

### Deferred

- HTTP/admin UI, auth, Postgres/Redis health, OpenTelemetry backends

### Non-goals

- Changing discovery semantics
- CSR / MBDE changes
