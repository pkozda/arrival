---
id: adr-006-addendum-e8-scheduler
title: ADR-006 Addendum — PDE E8 Scheduler
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-09-01
updated: 2026-09-01
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e4-2-scheduler
  - adr-006-addendum-e4-3-execution-queue
  - adr-006-addendum-e5-2-durable-execution-queue
  - adr-006-addendum-e5-3-distributed-scheduling-lock
  - adr-006-addendum-e5-4-durable-retry-policy
  - adr-006-addendum-e7-persistence-and-history
  - discovery-domain-index
  - personal-discovery-engine-roadmap
---

# ADR-006 Addendum — PDE E8 Scheduler

**Status:** Accepted (canonical roadmap E8 functional closure)  
**Date:** 2026-09-01  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Context

Canonical roadmap **E8 — Scheduler** requires time-based discovery runs without domain-specific knowledge, with exit criteria:

- enabled profile runs on schedule
- disabled profile skipped
- overlapping run rejected or coalesced

An audit found the **operational scheduler spine** was already delivered through **E4.2** (scheduler), **E4.3** (queue handoff), and **E5.2–E5.4** (durable queue, locks, retry). The remaining functional gap was **`DiscoveryProfile.enabled` not enforced** at trigger time.

---

## Decision

Accept **canonical E8 functional closure** with the existing operational architecture plus a **profile-level enabled gate**.

### Operational scheduler (already implemented — E4/E5)

```text
Host / DiscoveryService
        ↓
triggerDueRuns() / triggerNow()     (pull-driven — no in-process cron)
        ↓
createDiscoveryScheduler
        ↓
ScheduleStore + RunStore + SchedulerLock
        ↓
DiscoveryExecutionQueue → Worker → executeDiscoveryPipeline
```

Capabilities already in place:

| Capability | Origin |
|------------|--------|
| Fixed-interval `nextRunAt` recurrence, no drift | E4.2 |
| Missed-interval coalescing (one run, jump to next slot) | E4.2 |
| Schedule enable/disable | E4.2 |
| Overlap via `runningRunId` | E4.2 |
| Queue → worker handoff | E4.3 |
| SQLite schedule/run persistence | E4.2 |
| Durable queue + claim recovery | E5.2 |
| Distributed schedule lock | E5.3 |
| Execution retry at worker/queue layer | E5.4 |

### Two schedule models (intentional boundary)

| Model | Role |
|-------|------|
| **`DiscoveryProfile.schedule`** | Declarative **product-level** intent (`daily` / `weekly` / `manual`, `hourUtc`, …) on the profile record (E1/E7). |
| **`DiscoveryScheduleRecord`** | **Operational** scheduler representation (`fixed_interval`, `nextRunAt`, `enabled`, `runningRunId`). |

`DiscoveryProfile.schedule` does **not** directly drive the operational scheduler. Hosts or the service layer may create/update `DiscoveryScheduleRecord` entries from profile intent. Automatic projection (`daily`/`hourUtc`/timezone → `intervalSeconds` + `nextRunAt`) is **deferred**.

Schedule-level `enabled` (on `DiscoveryScheduleRecord`) and profile-level `enabled` (on `DiscoveryProfile`) remain **distinct**:

- `disabled` — operational schedule is off
- `profile_disabled` — profile is off; operational schedule may still be enabled

### Domain-agnostic scheduler

The scheduler knows only `profileId`, `strategyId`, `strategyVersion`, and interval metadata. It does not encode job-, giveaway-, or domain-specific logic (unchanged E4.2 invariant).

### No in-process cron / background daemon

Execution is **pull-driven**: hosts call `triggerDueRuns()` (or HTTP admin equivalents) on their own cadence. This preserves explicit lifecycle control and avoids hidden background threads in the library.

### E8 addition — profile enabled gate

When `profileStore` is wired (production runtime always does), `createDiscoveryScheduler` loads the profile before claim/enqueue:

```text
schedule.enabled?  →  profile.enabled?  →  claim + enqueue
```

If the profile exists and `enabled === false`, trigger returns `skipped` with reason **`profile_disabled`**. Missing profiles are not gated at the scheduler layer (pipeline remains authoritative).

---

## Exit criteria evidence

| Criterion | Evidence |
|-----------|----------|
| Enabled profile + due schedule runs | `scheduler.test.ts` (`E8 profile enabled gate` → `enabled profile + due operational schedule enqueues`) |
| Disabled profile skipped | `scheduler.test.ts` → `disabled profile + due operational schedule is skipped (profile_disabled)` |
| Overlap rejected / coalesced | `scheduler.test.ts` (E4.2/E4.3 blocks); `scheduler-lock.test.ts`; `runtime-integration.test.ts` |
| Schedule disable unchanged | `scheduler.test.ts` → `schedule-level disable still skips before profile gate` |

Prior E4/E5 tests remain authoritative for persistence, queue, locks, and retry.

---

## Explicitly deferred / non-goals for E8

- In-process **cron daemon** or background scheduler timer
- **Redis** or distributed scheduler redesign
- **Timezone-aware daily** slot computation from `profile.schedule.hourUtc`
- **Automatic profile-schedule projection** (`DiscoveryProfile.schedule` → `DiscoveryScheduleRecord`)
- Domain-specific scheduler logic

---

## Consequences

- **E9 (Discovery UI)** can edit `DiscoveryProfile.enabled` and operational schedules independently; disabling a profile stops triggers without deleting schedule records.
- Hosts remain responsible for calling `triggerDueRuns()` on their desired wall-clock cadence.
- Future projection helpers belong in the service/host layer, not the scheduler core.

## Related

- [E4.2 scheduler](./adr-006-addendum-e4-2-scheduler.md)
- [E5.2 durable queue](./adr-006-addendum-e5-2-durable-execution-queue.md)
- [E5.3 scheduling lock](./adr-006-addendum-e5-3-distributed-scheduling-lock.md)
- [E7 persistence & history](./adr-006-addendum-e7-persistence-and-history.md)
