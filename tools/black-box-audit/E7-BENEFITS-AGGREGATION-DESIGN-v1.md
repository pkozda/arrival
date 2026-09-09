---
id: e7-benefits-aggregation-design-v1
title: Arrival Atlas — Benefits Awareness Aggregation Design v1 (E7)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e7
  - benefits
  - aggregation
created: 2026-09-08
updated: 2026-09-08
---

# E7 Benefits Awareness Aggregation Design v1

## Current multi-benefit architecture

`evaluateWohngeldAwareness` + `evaluateKindergeldAwareness` → `evaluateBenefitsAwareness` → `BenefitsAwarenessPanel` on Economic Reality (beside Action Planner).

Individual results remain authoritative. No persisted benefit scores.

## Aggregation problem

Two independent cards can leave the user without a clear “what next” when states mix (e.g. one COMPLETED, one READY_TO_ACT). Seed order alone (Wohngeld then Kindergeld) can put completed cards first.

## Selected approach

**YES — smallest typed derived summary** `BenefitsAwarenessSummaryV1`:

* ordered `items` (individual semantics preserved)
* `counts` by state
* `primaryFocus` (first actionable / information-gathering card)
* `focusMode` + `summaryKey` for chrome

**NO ranking/ML/amounts.** Ordering is an explicit presentation band policy.

## Ordering policy

1. `READY_TO_ACT`
2. `POTENTIALLY_RELEVANT`
3. `NOT_ENOUGH_INFORMATION`
4. `NOT_APPLICABLE`
5. `COMPLETED`

Tie-break: original evaluation/seed order (Wohngeld before Kindergeld).  
This is **not** legal priority.

## Action Planner relationship

**No — remain presentation-only.**

Action Planner owns registration/housing/income/employment situation actions. Benefits stay in `BenefitsAwarenessPanel`. Feeding Benefits into the planner would risk a hidden ranking engine and dilute the registration gate.

## Persistence

Aggregation is derived only. Persist profile facts alone.

`profile → individual evaluations → summarizeBenefitsAwareness`

## Localization

EN/DE/RU/UA aggregate chrome keys. No UA←RU.

## Accessibility

Section `aria-labelledby`, cards as `article` with titles, completed marker text (not color-only), aggregate `role="status"`.

## Limitations

* Only two benefits
* No Action Planner integration
* Presentation bands are heuristic UX, not entitlement ranking

## Deferred

Third benefit, monetary ranking, planner feed, application workflows.
