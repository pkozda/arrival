---
id: discovery-automation-design-v1
title: Arrival Atlas — Discovery Automation & Digest Design v1 (PD-010)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-010
  - discovery
  - automation
  - digest
  - schedule
created: 2026-09-08
updated: 2026-09-08
related:
  - discovery-persistence-design-v1
  - discovery-execution-lifecycle-design-v1
  - discovery-result-presentation-design-v1
  - discovery-trust-verification-design-v1
---

# Discovery Automation & Digest Design v1

## Inspection verdict

Recurring Discovery **already exists** in the engine (E10):

* Profile `schedule` (manual | daily | weekly) → operational `sched:{profileId}`
* Host tick `POST /api/ops/discovery/trigger-due-runs` (no in-process cron)
* Overlap via `runningRunId` / `already_running`
* Digests after SUCCESS/PARTIAL_SUCCESS via notification service + `skipEmptyDigest`
* Novelty NEW/UPDATED/UNCHANGED on results

PD-010 is primarily **exposing and productizing** this, not inventing a second scheduler.

---

## Semantic distinctions

| Concept | Meaning |
| --- | --- |
| Manual execution | User Run Now (`trigger: manual`) |
| Scheduled execution | Due tick enqueues (`trigger: scheduled`) |
| Completed execution | Terminal lifecycle SUCCESS / NO_RESULTS / ERROR |
| Newly discovered | Novelty NEW (firstSeenAt ≈ lastChangedAt) — not “user unread” |
| Previously seen | Novelty UPDATED / UNCHANGED / userState |
| Digest | Ephemeral email plan from a run’s digest (not a store) |
| Notification | Delivery attempt of that digest |
| Unread/new (user) | userState / novelty — do not equate to “email unread” |

**Must not imply:** scheduled ⇒ guaranteed fresh · discovered ⇒ new · new ⇒ applied · notification sent ⇒ user saw it.

---

## Empty digest decision (v1)

Reuse existing default: **`skipEmptyDigest: true`** → no email when there are no notify-eligible items.

Do **not** send a “no opportunities” email unless the user disables skip-empty.

Documented in UI copy.

---

## Automation product model (v1)

Expose on run-summary (authoritative):

```text
automation: {
  cadence: manual | daily | weekly
  automaticExecution: boolean   // daily + profile enabled (user intent)
  nextRunAt: string | null      // operational due instant; null when unknown / placeholder
  hourUtc?: number
  delivery: { emailEnabled, skipEmptyDigest }
  lastRunTrigger?: manual | scheduled
}
```

`nextRunAt` comes from operational schedule; placeholder `2099-01-01…` → `null`.

Enable/disable automation (Jobs): PATCH schedule daily (default hour) ↔ manual. Reuses existing update + `syncProfileOperationalSchedule`.

---

## Overlap

Keep existing schedule lock. No new distributed lock.

---

## New-result semantics

Do **not** invent “new since previous successful run” beyond:

* `promotedFromRunId === lastRun.runId` (from this run)
* `changeMetadata.inferredNovelty` NEW/UPDATED

UI: keep existing badges; clarify novelty ≠ unread.

---

## Digest / delivery

* Separate from scheduling (can schedule without email if emailEnabled false).
* Delivery failure must not rewrite Discovery lifecycle (already separate).
* No user-facing SENT history API in v1 — limitation: UI explains intent (prefs), not confirmed delivery.

---

## Account vs session

Scheduler can fire session-owned daily profiles, but that outlives the browser and does not migrate on claim.

**Product rule:** Automation controls remain available, but **session scope shows an explicit durability warning**. Do not promise “we’ll keep searching every day after you leave” for demo sessions. Account scope may use durable language.

---

## UI

Compact **Automation** block on Discovery profile panel:

* Automatic search on/off (Jobs)
* Schedule summary + next run (if any)
* Last run + outcome (existing lifecycle)
* Delivery prefs pointer (existing notification field)
* Session durability warning when applicable

Preserve Run Now / PD-007–009.

---

## Non-goals

New engine, ranking, verification, digests store, in-process cron daemon, fake delivery confirmations.

---

## Testing / probe

Focused API/UI/i18n; browser probe for enable → reload → disable. Scheduled tick may be environment-limited (ops token); document if not exercised live.
