---
id: e4-benefits-vertical-slice-design-v1
title: Arrival Atlas — Benefits Vertical Slice Design v1 (E4)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e4
  - benefits
  - wohngeld
  - mbde
created: 2026-09-08
updated: 2026-09-08
---

# E4 Benefits Vertical Slice Design v1

## Capability assessment

### Already exists (usable)

* Profile domains: housing (city, rent), income, household, benefits receiving flags
* Economic Reality Action Planner (situation → missing → next action)
* MBDE: real eligibility engine + curated Germany seeds including `de_federal_wohngeld`
* Benefits Simulator: Bürgergeld math (separate; wrong tone for awareness)
* LE benefits awareness nodes (prototype graph)

### Not ready / deferred

* Full MBDE product UI / clusters / € maximization
* Official legal eligibility
* All German benefits
* Dedicated Benefits top-level module

## MBDE assessment

Use **as-is via adapter**. `evaluateEligibility` returns `missingFields`, `partialMatch`, `eligible` (heuristic). Map to awareness states; never surface “you are eligible”. Fixed receiving-ID aliases (`wohngeld` → also `de_federal_wohngeld`).

## Entry point

**Economic Reality** — extends the planner mental model without a new top-level module.

## Selected first slice

**Wohngeld (housing benefit) awareness**

`UserProfileView → adaptUserProfileView → evaluateEligibility(wohngeld seed) → awareness DTO → BenefitsAwarenessPanel`

### States

| State | Meaning |
| --- | --- |
| `NOT_ENOUGH_INFORMATION` | Rent and/or income missing |
| `READY_TO_ACT` | Heuristic match with known facts — check official source |
| `NOT_APPLICABLE` | Known facts fail heuristic |
| `COMPLETED` | `receivingWohngeld === true` |
| `POTENTIALLY_RELEVANT` | Reserved in enum for soft framing / future |

### Actions

* Update housing / income (profile edit routes)
* Open official Wohngeld URL from seed source
* Review benefits-support profile flags

### Persistence

Authoritative: profile facts only. Awareness is **derived** on each render (no separate Benefits store).

### Localization

EN/DE/RU/UA via `BENEFITS_AWARENESS_I18N` — no UA←RU inheritance.

## Explicitly deferred

All other benefits, simulator UI, legal amounts, ALG I, Kindergeld children form, MBDE admin UX, Discovery coupling.
