---
id: discovery-trust-verification-implementation-v1
title: Arrival Atlas — Discovery Trust & Verification Implementation v1 (PD-009)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-009
  - discovery
  - verification
  - trust
created: 2026-09-08
updated: 2026-09-08
related:
  - discovery-trust-verification-design-v1
  - discovery-result-presentation-implementation-v1
---

# Discovery Trust & Verification Implementation v1

## Verdict

**PD-009 DISCOVERY TRUST SLICE PASS WITH LIMITATIONS**

## Implemented

* `trust-presentation.ts` — maps stored verification/checks/evidence to strategy-aware summaries (no invented claims).
* `DiscoveryTrustPanel` — status + summary, source classification, freshness, checked-at, progressive “What was checked” (`<details>`).
* List items show a concise trust line; Open source remains PASS+URL only.
* Match score labeled as criteria match (not trust).
* Source-unavailable messaging distinguishes not-verified vs missing URL.
* i18n EN/DE/RU/UA for trust copy.
* Focused tests + browser probe.

## Truthful claims used

| Condition | UI claim |
| --- | --- |
| Jobs PASS + `official_source` TRUE | Official source page was checked |
| Giveaways PASS + free + deadline TRUE | Free-entry and deadline checks passed |
| PASS without those checks | Required verification checks passed |
| FAIL | Verification failed |
| UNKNOWN | Verification unknown |

Boundary copy states: no eligibility / ongoing availability / application completion guarantee.

## Files

| Area | Path |
| --- | --- |
| Design | `tools/black-box-audit/DISCOVERY-TRUST-VERIFICATION-DESIGN-v1.md` |
| Implementation | `tools/black-box-audit/DISCOVERY-TRUST-VERIFICATION-IMPLEMENTATION-v1.md` |
| Probe | `tools/black-box-audit/probes/probe-pd009-discovery-trust.mjs` |
| Helpers | `apps/web/src/lib/discovery/trust-presentation.ts` |
| UI | `DiscoveryTrustPanel.tsx`, `DiscoveryResultDetail.tsx`, `DiscoveryResultsList.tsx` |
| i18n | `packages/core/src/i18n/discovery-translations.ts` |
| Tests | `trust-presentation.pd009.test.ts`, `discovery-trust.pd009.test.ts`, UI regression updates |

## Browser

`PASS_WITH_LIMITATIONS` — NO_RESULTS remains an execution outcome; live SUCCESS+trust panel not hit (fixture-covered).

## Limitations

* Promoted results are nearly always PASS (engine excludes FAIL/UNKNOWN) — unverified UI paths are fixture-driven.
* Freshness is an adapter signal, not a “still available” guarantee.
* Live SUCCESS with Open source depends on Discovery finding verified opportunities.
