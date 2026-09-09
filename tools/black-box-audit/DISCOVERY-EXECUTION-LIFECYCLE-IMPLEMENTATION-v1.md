---
id: discovery-execution-lifecycle-implementation-v1
title: Arrival Atlas — Discovery Execution Lifecycle Implementation v1 (PD-007)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-007
  - discovery
  - execution
  - lifecycle
created: 2026-09-08
updated: 2026-09-08
related:
  - discovery-execution-lifecycle-design-v1
  - discovery-guided-wizard-implementation-v1
  - discovery-persistence-implementation-v1
---

# Discovery Execution Lifecycle Implementation v1

## Verdict

**PD-007 DISCOVERY EXECUTION SLICE PASS WITH LIMITATIONS**

## What was implemented

1. Product lifecycle mapper (`IDLE|QUEUED|RUNNING|SUCCESS|NO_RESULTS|ERROR`) over existing scheduler `lastRun` + `promotedFromRunId` result counts.
2. `GET .../run-summary` and `POST .../run-now` now return `lifecycle` + `applicableResultCount`.
3. `executeProfileRunNow` drains until terminal (or queue empty); `already_running` continues the active run instead of user-facing failure.
4. Discovery UI surfaces lifecycle from server summary; Run Now disabled while QUEUED/RUNNING; reload reconstructs state; observe/continue loop for non-terminal runs.
5. i18n EN/DE/RU/UA for lifecycle copy.
6. Focused unit/API tests + browser probe.

## Mapping (engine → product)

| Engine lastRun.status | applicableResultCount | Product |
| --- | --- | --- |
| (none) | — | IDLE |
| PENDING | — | QUEUED |
| RUNNING | — | RUNNING |
| SUCCESS / PARTIAL_SUCCESS | ≥ 1 | SUCCESS |
| SUCCESS / PARTIAL_SUCCESS | 0 | NO_RESULTS |
| FAILED / CANCELLED | — | ERROR |

## Files

| Area | Path |
| --- | --- |
| Design | `tools/black-box-audit/DISCOVERY-EXECUTION-LIFECYCLE-DESIGN-v1.md` |
| Implementation | `tools/black-box-audit/DISCOVERY-EXECUTION-LIFECYCLE-IMPLEMENTATION-v1.md` |
| Probe | `tools/black-box-audit/probes/probe-pd007-discovery-execution.mjs` |
| Mapper | `packages/discovery/src/user-api/execution-lifecycle.ts` |
| Run now | `packages/discovery/src/user-api/profile-run.ts` |
| Service | `packages/discovery/src/user-api/discovery-user-service.ts` |
| Types | `packages/discovery/src/user-api/types.ts` |
| Web hook/UI | `useDiscoveryModule.ts`, `DiscoveryProfilePanel.tsx`, `DiscoveryPage.tsx` |
| i18n | `packages/core/src/i18n/discovery-translations.ts` |
| Tests | `execution-lifecycle.pd007.test.ts`, `discovery-execution.pd007.test.ts` (i18n), `discovery-execution.pd007.api.test.ts`, extended user-api tests |

## Tests executed

| ID | Coverage | Result |
| --- | --- | --- |
| A IDLE after create | unit + API + browser | PASS |
| B Start → active | browser (often too brief) | LIMITED |
| C Long-running stays active | unit ACTIVE mapping; browser brief | LIMITED |
| D SUCCESS | unit | PASS |
| E NO_RESULTS | unit + service + browser | PASS |
| F ERROR | unit | PASS |
| G Reload active | hook observes server active | covered by design/code |
| H Reload terminal | browser NO_RESULTS | PASS |
| I Duplicate Run Now | continue active + UI disable | PASS (architecture) |
| J Ownership | API 404 cross-session | PASS |
| K Profile ≠ run | API/browser IDLE | PASS |
| L PD-005 | create path IDLE then Run Now | PASS (same create≠run) |
| M Localization | EN/DE/RU/UA keys | PASS |

Browser probe verdict: `PASS_WITH_LIMITATIONS` (artifacts under `tools/black-box-audit/artifacts/pd007-discovery-execution/`).

## Limitations

* Inline pull-process often completes before the UI can paint QUEUED/RUNNING; in-flight overlay uses RUNNING while POST is open, but fast NO_RESULTS paths may skip visible active states.
* Deterministic browser ERROR fixture not exercised; unit mapper covers ERROR.
* Scheduled (non-manual) drains still rely on ops host tick; PD-007 focuses on manual Run Now observability.
* No new DB tables; lifecycle is derived, not a separate persisted enum column.

## Non-regressions

* Did not modify black-box E2E suite.
* Did not change Registration / ER / Healthcare / Employment / PD-005 wizard semantics / PD-006 ownership rule.
* Did not redesign the Discovery engine or ranking.
