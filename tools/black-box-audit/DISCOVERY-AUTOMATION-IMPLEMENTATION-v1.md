---
id: discovery-automation-implementation-v1
title: Arrival Atlas — Discovery Automation & Digest Implementation v1 (PD-010)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-010
  - discovery
  - automation
  - digest
created: 2026-09-08
updated: 2026-09-08
related:
  - discovery-automation-design-v1
---

# Discovery Automation & Digest Implementation v1

## Existing scheduler/worker infrastructure (reused)

* Profile declarative `schedule`: `manual | daily | weekly`
* Operational projection `sched:{profileId}` via `schedule-projection.ts`
* Host tick: `POST /api/ops/discovery/trigger-due-runs` (`executeDiscoveryHostTick`)
* Overlap guard: `runningRunId` / `already_running` (scheduler)
* Digests: `DiscoveryNotificationService.deliverDigest` + `skipEmptyDigest`
* No second cron/queue introduced

## Ownership model

`userId = accountId ?? sessionId` (PD-006). Schedule PATCH/run-summary resolve ownership from trusted identity. Foreign profiles → 404.

Session-scoped profiles **can** store daily cadence (scheduler can fire), but UI shows an explicit durability warning — not a durable account promise.

## Execution flow

Manual: `Run Now` → existing lifecycle (PD-007).

Scheduled: host tick → due schedules → enqueue → worker → same lifecycle → digest attempt (independent of run status).

## Scheduling state (authoritative)

Exposed on `GET .../run-summary` as `automation`:

* `cadence`, `automaticExecution` (daily + enabled)
* `nextRunAt` from operational schedule (placeholder `2099-01-01…` → null)
* `hourUtc`, `delivery.{emailEnabled,skipEmptyDigest}`
* `lastRunTrigger` from last run record

UI enable = PATCH `{ cadence: 'daily', hourUtc }` (default hour 6); disable = `{ cadence: 'manual' }`.

## Result/newness semantics

Reuse novelty (`NEW` when `firstSeenAt === lastChangedAt`) and run-scoped `promotedFromRunId`. Do not invent “new since last successful run” beyond that. UI copy clarifies novelty ≠ applied ≠ email opened.

## Digest/notification semantics

* Schedule ≠ email delivery (independent prefs)
* Empty digest: default `skipEmptyDigest: true` → no email
* Delivery failure does not rewrite Discovery lifecycle (existing notification service contract)
* No SENT history API in v1 — UI states preference/intent, not confirmed delivery

## Persistence

Schedule + notification on profile SQLite store; operational `nextRunAt` on schedule store; results/runs unchanged from PD-008.

## Failure boundaries

| Failure | Discovery lifecycle |
| --- | --- |
| Scheduler cannot enqueue | no false SUCCESS; skip/error as engine reports |
| Execution fails | `ERROR` |
| NO_RESULTS | explicit `NO_RESULTS` |
| Digest/delivery fails | lifecycle unchanged |

## Session/account limitations

* Session automation allowed with warning
* Ops host tick may be environment-limited without `ARRIVAL_ATLAS_OPS_TOKEN`
* Weekly cadence still deferred (not auto-due)

## Files changed

* `packages/discovery/src/user-api/automation-summary.ts` (+ tests)
* `packages/discovery/src/user-api/types.ts`, `discovery-user-service.ts`, exports
* `apps/web/.../DiscoveryAutomationPanel.tsx`, `DiscoveryProfilePanel.tsx`, `DiscoveryPage.tsx`
* `apps/web/src/lib/discovery/types.ts`, `discovery-module.css`
* `packages/core/src/i18n/discovery-translations.ts` (+ pd010 i18n test)
* `apps/api/src/discovery-automation.pd010.api.test.ts`
* `tools/black-box-audit/DISCOVERY-AUTOMATION-DESIGN-v1.md`
* `tools/black-box-audit/probes/probe-pd010-discovery-automation.mjs`

## Tests executed

* `automation-summary.pd010.test.ts`
* `automation.pd010.test.ts` (enable/disable/persist/nextRunAt/overlap/ownership/novelty)
* `discovery-automation.pd010.api.test.ts`
* `discovery-automation.pd010.test.ts` (i18n EN/DE/RU/UA)
* `discovery-ui.test.tsx` (automation panel + session warning)

## Browser validation

Probe: `tools/black-box-audit/probes/probe-pd010-discovery-automation.mjs`

**Result (2026-09-08):** `PASS_WITH_LIMITATIONS`

Validated live:

* Automation panel + session durability warning
* Enable daily → status on → reload persists (`data-cadence=daily`, next run shown)
* Manual Run Now → terminal `NO_RESULTS` (honest; not manufactured SUCCESS)
* Disable → reload persists manual
* Delivery summary visible

Limitation: `ARRIVAL_ATLAS_OPS_TOKEN` unset — ops host tick not exercised in the browser probe (covered by existing `discovery-host-tick.test.ts` + PD-010 overlap unit test).

## Known limitations

1. Host tick not in-process; requires ops endpoint + token
2. No durable digests/SENT mailbox UI
3. Weekly auto-recurrence deferred
4. Session automation is honest but not account-durable
5. “New” remains novelty-based, not unread/email-read
