---
id: adr-006-addendum-e4-4-notifications
title: ADR-006 Addendum — PDE E4.4 Notifications
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
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E4.4 Notifications

**Status:** Accepted (E4.4)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

Introduce a **provider-neutral notification boundary** that consumes a completed `DiscoveryDigest` and delivers notifications without coupling to scheduler, queue, pipeline stages, or vendor SDKs.

```text
Worker
  ↓
executeDiscoveryPipeline
  ↓
Persist + Digest (E2.8 — authoritative)
  ↓
createDiscoveryNotificationService(...)
  ↓
NotificationAdapter.send(...)
```

## Digest is authoritative

E2.8 already determines notification eligibility (`shouldNotify`, verification PASS, score present, novelty consumed, DISMISSED/EXPIRED excluded).

E4.4 **must not** recompute novelty, scoring, verification, promotion, or filtering.

- Digest entry present → eligible per E2.8 semantics
- Empty digest → no notification

## Provider-neutral model

Domain types (`NotificationPayload`, `NotificationItem`, `NotificationPlan`) describe **what** to communicate:

- title, summary, result IDs, rank ordering, minimal metadata
- no HTML email, Telegram Markdown, Slack blocks, etc.

`NotificationAdapter` port:

```text
send(request) → { ok: true } | { ok: false; code; message }
```

No vendor SDK types in the discovery domain. Adapters never read `process.env`.

## Idempotency

E4.3 does not claim exactly-once execution. Notification delivery therefore requires an explicit idempotency boundary.

**Idempotency key:**

```text
notification:{profileId}:{digestId}:{channel}:{recipient.userId}:{recipient.address}
```

Repeated processing of the same digest for the same channel/recipient:

- creates at most one notification record
- invokes the adapter at most once
- subsequent attempts return `already_delivered`

Failed deliveries are recorded as `FAILED`; automatic retry is deferred.

## Lifecycle

```text
PENDING → SENT
        → FAILED
```

No automatic retry loops in E4.4.

## Failure semantics

Notification failures are **separate from discovery success**:

- `SUCCESS` / `PARTIAL_SUCCESS` pipeline runs remain successful even if notification delivery fails
- failures are explicit (`DELIVERY_FAILED`, `TIMEOUT`, `CANCELLED`, etc.)
- success is never fabricated

Worker invokes notification service after run metadata is updated; notification errors are caught and do not mutate `DiscoveryRunStatus`.

## Persistence

`NotificationStore` port with:

- `findById`, `create`, `update`

Implementations:

- `createInMemoryNotificationStore` (tests)
- `createSqliteNotificationPersistence` (durable idempotency, consistent with E4.1/E4.2)

## Relationship to scheduler / queue

- Scheduler: no notification logic
- Queue: no notification logic
- Worker: optional post-pipeline hook via `notificationService` + `resolveNotificationTarget`
- Pipeline stages: unchanged; digest stage remains the sole eligibility gate

## Deferred

- Real email / Telegram / push providers
- Notification UI and user preference UI
- Automatic retries
- AI-generated copy
- Notification-specific scoring
- Distributed delivery infrastructure

## Consequences

- Clean extension point for E4.5+ provider implementations
- Idempotent delivery safe under at-least-once worker semantics
- Operators must wire `resolveNotificationTarget` at composition root with recipient routing
