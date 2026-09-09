---
id: employment-dual-track-implementation-v1
title: Arrival Atlas — Employment Dual Track Implementation v1 (PD-004)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-004
  - employment
  - dual-track
created: 2026-09-08
updated: 2026-09-08
related:
  - employment-dual-track-design-v1
---

# Employment Dual Track Implementation v1

## Implemented

* **Employment entry:** Work & Growth slide primary CTA → `/modules/employment` (no longer Life Events).
* **Employment landing:** presentation page with two tracks — Work & Income (current situation) and Job Search (capability).
* **Work & Income:** reads profile `employment` / `income`; missing status = `not_provided` (never silent unemployed); locked until Move to Germany complete with unlock CTA.
* **Job Search:** CTA → `/modules/discovery` with honesty copy (no auto-run, no fake results).
* **Localization:** EN / DE / RU / UA via `EMPLOYMENT_I18N`.
* **No new Employment domain module package** — presentation + navigation only (PD-004 Option D).

## Files changed

| Area | Path |
| --- | --- |
| Design | `tools/black-box-audit/EMPLOYMENT-DUAL-TRACK-DESIGN-v1.md` |
| Implementation doc | `tools/black-box-audit/EMPLOYMENT-DUAL-TRACK-IMPLEMENTATION-v1.md` |
| Probe | `tools/black-box-audit/probes/probe-pd004-employment.mjs` |
| View model | `apps/web/src/lib/employment/employment-dual-track.ts` (+ test) |
| UI | `apps/web/src/components/employment/EmploymentDualTrackView.tsx` |
| Route | `apps/web/src/app/(destinations)/modules/employment/page.tsx` |
| Work & Growth CTA | `apps/web/src/components/atlas-home/atlas-data.ts` |
| i18n | `packages/core/src/i18n/employment-translations.ts` (+ test), wired in `index.ts` |
| CSS | `apps/web/src/app/ui-cohesion.css` |

## Domain changes

None beyond reusing existing profile employment/income/migration fields. No parallel employment store. No Discovery lifecycle/persistence changes.

## Presentation / navigation

```text
Work & Growth → /modules/employment
  ├── Work & Income → /profile/work-income[/edit] or unlock /profile/move-to-germany/edit
  └── Job Search → /modules/discovery
```

## Localization

Keys under `employment.*` for EN/DE/RU/UA. Employment status labels reuse existing `profile.options.employmentStatus.*`.

## Tests

| Test | Result |
| --- | --- |
| A — Work & Growth → Employment href | PASS |
| B — separate track hrefs | PASS |
| C — known employment as current state | PASS |
| D — missing ≠ unemployed | PASS |
| E — Job Search → Discovery | PASS |
| F — no implied job-search intent | PASS |
| G — no fake Discovery claims | PASS |
| H — i18n EN/DE/RU/UA | PASS |
| Locked unlock path | PASS |

Suites:

* `apps/web/src/lib/employment/employment-dual-track.test.ts` (8)
* `packages/core/src/i18n/employment-translations.pd004.test.ts` (1)

Existing E2E suites were not modified.

## Browser validation

Probe: `tools/black-box-audit/probes/probe-pd004-employment.mjs`  
Artifacts: `tools/black-box-audit/artifacts/pd004-employment/`

Observations:

1. Employment landing reachable; not redirected to Life Events.
2. Both tracks visible (`work-income`, `job-search`).
3. Default situation `not_provided` — UA copy “Ще не вказано”; not labeled unemployed.
4. Job Search CTA (`href=/modules/discovery`) navigated to Discovery; zero Discovery POST run requests from Employment.
5. Reload: Employment still reachable; `claimsDiscoveryRun=false`.

**Browser verdict:** PASS

## Limitations

* Atlas Work & Growth slide chrome copy remains largely English (pre-existing).
* Work & Income remains gated by Move to Germany (existing Profile dependency; explained, not force-enabled).
* Discovery wizard / persistence / run lifecycle intentionally deferred (PD-005/006/007).
* Probe must wait for spatial `landed`/`idle` before Job Search click (spatial transition timing).

## Final verdict

`PD-004 EMPLOYMENT SLICE PASS WITH LIMITATIONS`
