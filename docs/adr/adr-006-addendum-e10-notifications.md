---
id: adr-006-addendum-e10-notifications
title: ADR-006 Addendum — PDE E10 Notifications & Automated Delivery
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-09-02
updated: 2026-09-02
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e4-4-notifications
  - adr-006-addendum-e4-5-production-email-notifications
  - adr-006-addendum-e7-persistence-and-history
  - adr-006-addendum-e8-scheduler
  - adr-006-addendum-e9-discovery-ui
  - discovery-domain-index
  - personal-discovery-engine-roadmap
---

# ADR-006 Addendum — PDE E10 Notifications & Automated Delivery

**Status:** Accepted (canonical roadmap E10 functional closure)  
**Date:** 2026-09-02  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Packages:** `@arrival-atlas/discovery`, `@arrival-atlas/api`, `@arrival-atlas/web`, `@arrival-atlas/core`

---

## Context

Canonical roadmap **E10 — Daily Digest / Email** requires the first automated Discovery delivery channel: attention-first email from NEW / UPDATED results, default empty-email suppression, user notification control, and host-triggered daily execution — without redesigning the E4 notification boundary, E8 scheduler, or E7 novelty semantics.

The digest builder (E2.8), `NotificationService` (E4.4), and Resend email adapter (E4.5) already existed in `@arrival-atlas/discovery`. E10 closes the product loop by wiring Atlas composition, schedule projection, host tick, and user-facing preferences.

Implementation was delivered in four slices:

| Slice | Scope |
|-------|--------|
| **E10.1** | Atlas notification wiring — recipient resolution, worker → `NotificationService`, NOTIFIED write-back |
| **E10.2** | Profile schedule projection — declarative `DiscoveryProfile.schedule` → operational `DiscoveryScheduleRecord` |
| **E10.3** | Atlas host daily tick — `executeDiscoveryHostTick()` + ops HTTP entry point |
| **E10.4** | Notification preferences — `emailEnabled` / `skipEmptyDigest` via profile API + Discovery UI |

---

## Decision

Accept **canonical E10 functional closure** with the architecture below.

### E10 scope — end-to-end delivery path

```text
Discovery Profile (notification prefs + schedule intent)
        ↓
E8 operational schedule (DiscoveryScheduleRecord)
        ↓
Atlas host tick (E10.3)
        ↓
triggerDueRuns()
        ↓
DiscoveryExecutionQueue
        ↓
DiscoveryExecutionWorker
        ↓
executeDiscoveryPipeline
        ↓
E7 novelty (NEW / UPDATED / UNCHANGED)
        ↓
DiscoveryDigest (authoritative eligibility)
        ↓
NotificationService.deliverDigest (E4.4)
        ↓
Email NotificationAdapter (E4.5 Resend / smoke)
        ↓
SENT (NotificationStore)
        ↓
NOTIFIED (ResultStateWriter — eligible result IDs only)
```

**No second scheduler.** **No second notification path.** **No DigestStore.**

---

### E10.1 — Notification wiring

Location: `apps/api/src/discovery/` + existing `packages/discovery` worker/notification stack.

| Concern | Decision |
|---------|----------|
| **Recipient resolution** | Composition-root `createResolveDiscoveryNotificationTarget` loads profile from `ProfileStore`, checks `emailEnabled`, resolves address via `resolveDiscoveryNotificationEmail` (test override → user-persisted → `DISCOVERY_NOTIFICATION_EMAIL` when not multi-user). Returns `null` when disabled or no address. Shared env fallback is disabled under `ARRIVAL_ATLAS_MULTI_USER=true` (H3). |
| **Delivery** | Reuses existing `createDiscoveryNotificationService` and Resend/smoke email adapter — no redesign. |
| **Worker hook** | `createDiscoveryExecutionWorker` calls `resolveNotificationTarget` after SUCCESS / PARTIAL_SUCCESS, then `deliverDigest`. Notification failures do **not** corrupt run status. |
| **NOTIFIED** | `transitionResultsToNotified` runs only after adapter success and only when `plan.payload.resultIds.length > 0`. |
| **Missing recipient** | Run completes successfully; no notification attempt; results remain in correct non-NOTIFIED state. |
| **Idempotency** | E4.4 key `(profileId, digestId, channel, recipient)` — repeated delivery attempts return `already_delivered`. |

Tests: `apps/api/src/discovery-notification-wiring.test.ts`, `packages/discovery/src/notifications/notifications.test.ts`.

---

### E10.2 — Schedule projection

Location: `packages/discovery/src/user-api/schedule-projection.ts`

| Concern | Decision |
|---------|----------|
| **Declarative vs operational** | `DiscoveryProfile.schedule` remains **product intent** (`manual` / `daily` / `weekly`). Operational execution uses **`DiscoveryScheduleRecord`** (E4.2/E8) — unchanged scheduler core. |
| **Daily profiles** | Projected to `intervalSeconds: 86400` and `nextRunAt` via `nextDailyRunAtUtc(hourUtc)` (UTC-only; no DST). |
| **Manual profiles** | Projected with `nextRunAt: NON_AUTOMATIC_NEXT_RUN_AT` (`2099-01-01`) — not due under normal host ticks. |
| **Weekly profiles** | Stored on profile; operational schedule uses non-automatic placeholder — **weekly recurrence intentionally deferred**. |
| **Projection triggers** | Profile create/update/enable/disable via `DiscoveryUserService` (`ensureProfileSchedule` creates if missing; Run now does not reset `nextRunAt`). |
| **Scheduler redesign** | None — projection is a host/service-layer helper only. |

Tests: `packages/discovery/src/user-api/profile-schedule-projection.test.ts`.

---

### E10.3 — Atlas host tick

Location: `apps/api/src/discovery/discovery-host-tick.ts`, `apps/api/src/routes/discovery-ops.ts`

```text
POST /api/ops/discovery/trigger-due-runs  (ops-token-required; ARRIVAL_ATLAS_OPS_TOKEN)
        ↓
executeDiscoveryHostTick()
        ├─ discoveryService.start()
        ├─ triggerDueRuns()          ← existing E8 scheduler
        └─ processNext() loop (max 50) ← existing E4.3 worker
```

| Concern | Decision |
|---------|----------|
| **External scheduler** | Production hosts invoke the HTTP endpoint on a wall-clock cadence (platform cron, Cloud Scheduler, Kubernetes CronJob). **No in-process cron daemon.** |
| **Reuse** | `triggerDueRuns()`, queue, worker, pipeline, and notification path are unchanged. |
| **Safety** | Repeated or concurrent ticks rely on existing scheduler locks, overlap guards, queue idempotency, and notification idempotency — safe to invoke repeatedly. |
| **Auth** | Ops route: 401 unauthenticated · 403 session-only · 200 claimed account. |

Tests: `apps/api/src/discovery-host-tick.test.ts` (includes end-to-end path to `SENT` notification when recipient configured).

---

### E10.4 — Notification preferences

Domain shape on `DiscoveryProfile.notification`:

```ts
notification: {
  emailEnabled: boolean;      // default true
  skipEmptyDigest: boolean;   // default true
}
```

| Preference | Behavior |
|--------------|----------|
| **`emailEnabled = false`** | Recipient resolver returns `null` → no email delivery → run still succeeds → results **not** marked NOTIFIED. |
| **`skipEmptyDigest = true`** (default) | Empty digest (`entries.length === 0`) → no notification plan → `empty_digest` skip. |
| **`skipEmptyDigest = false`** | Zero-new scan (no NEW/UPDATED, `unchangedResults === 0`) may produce an **empty-scan** notification (summary email, `resultIds: []`). |
| **Unchanged-only rerun** | Even when `skipEmptyDigest = false`, digests with only UNCHANGED history are suppressed (`shouldSuppressEmptyHistoryScan`) — E7 novelty semantics preserved. |

**Persistence:** partial patch via existing profile update path (`PATCH /api/modules/discovery/profiles/:profileId` / user API `PUT /user/profiles/:id`) — `parseNotificationPatch` merges omitted fields.

**UI:** `DiscoveryProfilePanel` notification section — toggles + save; i18n in `discovery-translations.ts` (en, de, ru, ua).

Tests: `packages/discovery/src/notifications/notification-preferences.test.ts`, `discovery-user-api.test.ts` (E10.4), `discovery-ui.test.tsx`, canonical Playwright journey (preferences persist on reload).

---

### Novelty semantics (E7 preserved)

E10 consumes E7 decisions; it does **not** recompute eligibility in the API or UI layer.

```text
NEW       → notify (when emailEnabled and digest-eligible)
UPDATED   → notify (when material change + strategy notifyOnMeaningfulUpdate)
UNCHANGED → do not notify
```

Material field changes surface as **UPDATED** via `detectMaterialChange` / `decideNovelty`. UNCHANGED reruns never produce repeat notifications, regardless of `skipEmptyDigest`.

Digest builder (`buildDiscoveryDigest` / `isDigestEligible`) consumes `shouldNotify` from novelty — single authoritative path (E2.8 / E4.4 invariant).

---

## Exit criteria evidence

| Criterion | Evidence |
|-----------|----------|
| Digest from NEW / UPDATED | `digest-builder.ts`; `notifications.test.ts`; E10.1 wiring tests |
| Attention-first email | `plan-builder.ts`; `render-discovery-email.ts` |
| Skip empty emails by default | `skipEmptyDigest` default `true`; plan-builder + notification-service |
| User notification control | E10.4 API/UI tests; Playwright preferences persistence |
| No repeat notify for UNCHANGED | `novelty-decision.ts`; `notification-preferences.test.ts` (unchanged-only + `skipEmptyDigest=false`) |
| UI shows last scan when email skipped | E9 run summary + zero-new surfaces in `DiscoveryProfilePanel` |
| Automated daily path without second scheduler | `discovery-host-tick.test.ts` → scheduler + worker + SENT notification |

### Verification status (2026-09-02)

| Suite | Result |
|-------|--------|
| `packages/discovery` full | **552/552** |
| E10.4 notification preferences | **5/5** |
| E10 user API preferences | **6/6** |
| E10.1 notification wiring (`apps/api`) | **5/5** |
| E10.3 host tick (`apps/api`) | **6/6** |
| Web discovery UI + i18n | **23/23** |
| Canonical Playwright (incl. notification prefs) | **1/1** |
| `packages/discovery` + `apps/api` TypeScript | **green** |

---

## Explicitly deferred (not E10 blockers)

Future product/engine work — **not required to mark E10 complete:**

| Item | Notes |
|------|--------|
| **Account-linked recipient resolution** | Map profile owner → real account email (currently env / test override in composition root) |
| **Unsubscribe / List-Unsubscribe** | `emailEnabled` preference satisfies MVP user control; one-click unsubscribe headers deferred |
| **Localized email templates** | Web i18n localized; email copy remains English in plan-builder / renderer |
| **Self-serve schedule UI** | Daily schedule projection works via API; UI-created profiles default to `manual` cadence |
| **Weekly recurrence** | Profile field stored; operational auto-schedule deferred (`NON_AUTOMATIC_NEXT_RUN_AT`) |

---

## Outside E10 / deployment configuration

These are **not E10 acceptance failures:**

| Item | Owner |
|------|--------|
| Production cron / Cloud Scheduler / Kubernetes scheduling | Platform / deployment |
| Email provider deployment (`RESEND_API_KEY`, sender domain) | Infrastructure / ops |
| Production smoke vs real HTTP transport selection | Host configuration |
| Multi-tenant ops runbooks | E11 / operations |

---

## Later epic — E11 Production Hardening

Not in E10 scope:

- Observability dashboards and structured run logs
- Cost budgets and abuse/rate-limit boundaries
- Security review playbooks for fetch + AI paths
- Strategy version migration tooling

---

## Consequences

- **E11** is the next major roadmap epic; E1–E10 form the MVP vertical slice for Jobs + Giveaways with automated email delivery.
- Hosts must configure (1) external tick cadence hitting `/api/ops/discovery/trigger-due-runs` and (2) notification email resolution for production recipients.
- E4.4 notification boundary remains authoritative — no eligibility logic in Atlas gateway or React UI.
- E9 Run now and E10 host tick share the same `DiscoveryService`, scheduler, queue, worker, and notification stack.

## Related

- [E4.4 notifications](./adr-006-addendum-e4-4-notifications.md)
- [E4.5 production email](./adr-006-addendum-e4-5-production-email-notifications.md)
- [E7 persistence & history](./adr-006-addendum-e7-persistence-and-history.md)
- [E8 scheduler](./adr-006-addendum-e8-scheduler.md)
- [E9 Discovery UI](./adr-006-addendum-e9-discovery-ui.md)
- [Discovery domain index](../discovery/README.md)
- [PDE roadmap](../discovery/personal-discovery-engine-roadmap.md)
