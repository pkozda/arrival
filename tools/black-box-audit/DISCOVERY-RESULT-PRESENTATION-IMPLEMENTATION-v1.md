---
id: discovery-result-presentation-implementation-v1
title: Arrival Atlas — Discovery Result Presentation Implementation v1 (PD-008)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-008
  - discovery
  - results
created: 2026-09-08
updated: 2026-09-08
related:
  - discovery-result-presentation-design-v1
  - discovery-execution-lifecycle-implementation-v1
---

# Discovery Result Presentation Implementation v1

## Verdict

**PD-008 DISCOVERY RESULTS SLICE PASS WITH LIMITATIONS**

## Implemented

* Opportunity presentation helpers (URL resolution, PASS-gated external open, no invented fields).
* Score percent formatting fixed for 0–100 engine scores.
* Results list lifecycle-aware: in-progress / NO_RESULTS / ERROR / empty / SUCCESS count + current-run markers.
* Result detail: Open source (external) or explicit source-unavailable; org/salary/summary/verification/timestamps when present.
* NO_RESULTS recovery: Adjust profile + Run again on profile panel.
* i18n EN/DE/RU/UA for new copy.
* Focused tests + browser probe.

## Files

| Area | Path |
| --- | --- |
| Design | `tools/black-box-audit/DISCOVERY-RESULT-PRESENTATION-DESIGN-v1.md` |
| Implementation | `tools/black-box-audit/DISCOVERY-RESULT-PRESENTATION-IMPLEMENTATION-v1.md` |
| Probe | `tools/black-box-audit/probes/probe-pd008-discovery-results.mjs` |
| Helpers | `apps/web/src/lib/discovery/opportunity-presentation.ts` |
| UI | `DiscoveryResultsList.tsx`, `DiscoveryResultDetail.tsx`, `DiscoveryProfilePanel.tsx`, `DiscoveryPage.tsx` |
| i18n | `packages/core/src/i18n/discovery-translations.ts` |
| Tests | `opportunity-presentation.pd008.test.ts`, `discovery-results.pd008.test.ts`, updated `discovery-ui.test.tsx` |

## Browser probe

`PASS_WITH_LIMITATIONS` — IDLE → run → `NO_RESULTS` (explicit panel) → reload keeps `NO_RESULTS`. Live SUCCESS with result cards not hit this environment (adapters often return zero applicable); covered by unit/UI tests with PASS+URL fixtures.

## Limitations

* Location not on persisted `DiscoveryResult` — omitted.
* In-app list order remains recency (+ current-run grouping); digest ranking not applied in UI.
* Browser SUCCESS/action path depends on live Discovery finding verified opportunities.

## Non-regressions

No changes to Registration / ER / Healthcare / Employment / PD-005–007 semantics beyond result presentation consuming PD-007 lifecycle.
