---
id: economic-reality-action-planner-design-v1
title: Arrival Atlas — Economic Reality Action Planner Design v1 (PD-002)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-002
  - economic-reality
  - action-planner
created: 2026-09-08
updated: 2026-09-08
---

# Economic Reality Action Planner Design v1

## Current pipeline

```text
UserContextV1
  → evaluate() (axes / economicState)
  → resolveGraphContext() (G1–G6)
  → buildExecutionState() (satisfaction keys → node status)
  → buildActionSet() (node-action-catalog → actions)
  → buildPlan() / buildPresentation()
  → GET /api/modules/economic-reality/plan
  → web PROFILE_MUTATED cascade → ER refetch → galaxy/inspector UI
```

## Existing action model

`EconomicActionV1` from `node-action-catalog` templates (`update_profile`, `open_module`, `external_resource`, `system_intent`). Registration nodes (`g2-registration`, `g5-registration`, `g6-arrival-proof`) currently bind primarily to **Update housing**.

## Existing recommendation / presentation model

Presentation cards + `primaryHighlight` + galaxy. Recommendations are section cards; actions are linked by `actionRefIds`.

## Existing satisfaction model

Keys: `registration_confirmed` (PD-001: address + explicit confirm), `income_declared`, `employment_status_known`, benefits/jobcenter/sozialamt keys. **No housing/address key.**

## Existing execution model

- `update_profile` → navigate to profile editor → `fact.correct` → `PROFILE_MUTATED` → ER plan rebuild
- `system_intent` → `POST …/action/execute` → feedback events → rebuild

## Current gap (verified)

1. **ER-LOOP-001 still open:** housing save refreshes the plan, but registration nodes stay `active` on `registration_confirmed` and keep emitting **the same** `UPDATE_HOUSING` action. Address alone cannot complete registration (correct for PD-001), but the planner must not keep recommending housing after city is present.
2. Action Planner UX does not surface: known / missing / next action / post-action recalculation confirmation as a first-class product flow.
3. Galaxy completed bucket is unused for ER.

## Slice decisions

| Decision | Choice |
|---|---|
| Concrete action | Registration-gate housing → confirm path (fixes ER-LOOP-001) + Action Planner surface |
| Satisfaction | Add `registrable_address` (city present). Keep PD-001 `registration_confirmed`. |
| Action filtering | Registration nodes: missing address → housing; address present, unconfirmed → confirm/migration; not the same unresolved housing CTA |
| Planner UI | Compact Action Planner panel on ER module (situation + missing + next CTA) |
| Out of scope | Simulators, forecasts, full galaxy redesign |

## Important semantic rule

> Address alone never completes Registration. After address is present, the next Registration-related action must be confirmation (or equivalent), not another identical housing update.
