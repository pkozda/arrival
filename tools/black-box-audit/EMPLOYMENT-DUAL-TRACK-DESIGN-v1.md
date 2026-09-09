---
id: employment-dual-track-design-v1
title: Arrival Atlas — Employment Dual Track Design v1 (PD-004)
project: Arrival Atlas
system: Arrival Atlas
type: design
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
---

# Employment Dual Track Design v1

## Current architecture (verified)

```text
Atlas home Work & Growth slide (atlas-data.ts)
  → CTA ctaHref = /modules/life-event
  → secondary “See what’s next” → Life Events

Profile Work & income
  → domains employment + income
  → PROFILE_DOMAIN_DEPS['work-income'] = ['move-to-germany']
  → /profile/work-income[/edit]

Discovery Jobs
  → /modules/discovery (HUD + module page)
  → independent opportunity engine (no Employment bridge)

Dedicated Employment module package
  → not present (confirmed)
```

Employment profile facts live under `profile.domains.employment.employmentStatus` (and related income fields). Missing status is absent/undefined — not auto-`unemployed` in the profile mirror builder when no fields exist (`not_added`).

## Current Work & Growth behavior

Work & Growth is a journey presentation slide. Its primary CTA currently opens Life Events, not an employment-specific destination. There is no discoverable Employment node/page between Work & Growth and Discovery.

## Current employment data

| Source | Fields used |
| --- | --- |
| Profile employment | `employmentStatus`, `taxClass`, `churchTax` |
| Profile income | `grossMonthlyIncome` |
| Unlock gate | Move to Germany complete when `countryOfOrigin` + `residencyStatus` present |

## Current Discovery Jobs entry

`/modules/discovery` via Atlas HUD and direct route. Existing create/list/run UX remains unchanged (PD-005/006/007 out of scope).

## Semantic distinction

```text
Employment (conceptual grouping / landing)
├── Work & Income     → current situation (Profile)
└── Job Search        → active capability → Discovery Jobs
```

Rules:

* Known employment status is presented as known.
* Missing employment is `not_provided` / unknown — **never** silently labeled unemployed.
* Job Search does not imply unemployment; employment does not imply job-search intent.
* Job Search CTA must navigate observably to Discovery; must not claim a run or results.

## Selected approach

**Option D dual tracks** + **lightweight Employment presentation landing** (resolves open CTA/destination detail in PD-004):

1. Work & Growth primary CTA → `/modules/employment`
2. Employment page exposes two tracks with distinct copy and CTAs
3. Work & Income → Profile (`/profile/work-income` or edit / unlock path)
4. Job Search → `/modules/discovery` (no auto-run, no fake lifecycle)

This is **not** a new `@arrival-atlas/modules` Employment package / recommendation engine. It is a web presentation + navigation contract, consistent with PD-004 “no new module package required.”

## Non-goals (PD-005 / 006 / 007)

* Guided Discovery wizard
* Discovery persistence / identity redesign
* Discovery run lifecycle (`IDLE → … → SUCCESS/NO_RESULTS/ERROR`)
* Benefits/employment planner
* Life Events galaxy redesign

## State semantics

| State | Meaning |
| --- | --- |
| `situationKind: known` | `employmentStatus` present |
| `situationKind: not_provided` | no employment status — not unemployed by default |
| `workIncomeAccess: locked` | move-to-germany incomplete; explain unlock |
| `workIncomeAccess: available` | Work & Income profile reachable |
| Job Search | always a capability CTA; `impliesJobSearchIntent = false` until user acts elsewhere |
| Discovery claims | `claimsDiscoveryRun = false` always in this slice |

## Navigation / integration contract

```text
Work & Growth → /modules/employment
Work & Income CTA → /profile/work-income[/edit] or /profile/move-to-germany/edit when locked
Job Search CTA → /modules/discovery
```

## Testing strategy

* Unit: dual-track view model (known / not_provided / locked / no intent coupling)
* Unit: localization keys EN/DE/RU/UA
* Browser probe: entry, two tracks, unknown state, Discovery handoff, reload honesty

## Known limitations

* Atlas slide chrome copy remains largely English (pre-existing); Employment page strings are fully localized.
* Discovery destination quality still depends on later PDs.
* Work & Income lock still uses existing Profile dependency (not force-enabled).
