---
id: e5-kindergeld-awareness-design-v1
title: Arrival Atlas — Kindergeld Awareness Design v1 (E5)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e5
  - benefits
  - kindergeld
  - mbde
created: 2026-09-08
updated: 2026-09-08
---

# E5 Kindergeld Awareness Design v1

## Current Kindergeld capability

### Already present

* MBDE seed `de_federal_kindergeld` with rule `hasChildren eq true`
* Official URL in seed: `https://www.arbeitsagentur.de/familie-und-kinder/kindergeld`
* Profile contract: `domains.household.children?: ChildAge[]` (`age` 0–25)
* Adapter maps explicit `children[]` → MBDE household members with `role: 'child'`
* Flattened field `hasChildren` derived **only** from child roles — not from household size
* E4 Benefits awareness pattern on Economic Reality (`BenefitsAwarenessPanel`)

### Not present

* `receivingKindergeld` (or equivalent) in benefits domain → **COMPLETED** cannot be asserted from an authoritative fact
* Per-child DOB / custody / tax-ID / Familienkasse case status
* Legal-grade Kindergeld eligibility engine
* Standalone Benefits module / navigation

## Available profile facts (used)

| Fact | Use |
| --- | --- |
| `domains.household.children` **undefined** | Unknown → `NOT_ENOUGH_INFORMATION` |
| `domains.household.children === []` | Explicitly no children → `NOT_APPLICABLE` |
| `domains.household.children.length > 0` | Explicit children → seed heuristic → `READY_TO_ACT` |
| `householdSize` | **Never** used to infer children |

## Minimum supported awareness inputs

1. Presence/absence of the **explicit** `children` array (authoritative).
2. MBDE seed match on `hasChildren === true` when children are present.
3. Official guidance URL from the existing seed (external action, not completion).

Child **ages** are stored when present; E5 awareness does not branch on age. The household editor exposes a count (`dependentChildCount`) that maps to `children[]`, preserving existing ages when the count is unchanged and using `{ age: 0 }` as “age not specified” for new slots.

## Semantic states

| State | Kindergeld meaning |
| --- | --- |
| `NOT_ENOUGH_INFORMATION` | `children` not set on household |
| `READY_TO_ACT` | Explicit children + seed `hasChildren` match — check official source |
| `NOT_APPLICABLE` | Explicit empty children (or seed non-match with known facts) |
| `COMPLETED` | **Deferred** — no `receivingKindergeld` fact |
| `POTENTIALLY_RELEVANT` | Available in shared enum; unused for Kindergeld in E5 |

## Legal / product boundary

Awareness only. Copy must not claim eligibility, amounts, or award. Prefer “may be relevant”, “based on known facts”, “confirm with official source”.

## Integration point

**Economic Reality** host — same `BenefitsAwarenessPanel` as Wohngeld. No new route / nav item.

## MBDE integration

Parallel adapter `evaluateKindergeldAwareness` (same shape as Wohngeld). Bundle via `evaluateBenefitsAwareness(profile) → [wohngeld, kindergeld]`. Import path remains `@arrival-atlas/mbde/awareness` (browser-safe).

Critical difference vs Wohngeld: the eligibility engine always sees boolean `hasChildren` after adapt (`[]` when missing). Kindergeld awareness therefore checks **profile** `children` presence **before** trusting engine “not eligible”.

## Presentation architecture

Shared panel lists typed results (title, state, explanation, missing, CTA). Small shared DTO — **not** a plugin DSL, ranking engine, or schema system.

## Action / recalculation

* Missing children → CTA `/profile/household-family/edit` → save `children` → reload ER → re-evaluate
* Ready → open seed official URL (external; not completion)
* No fake CTAs for uncollectable facts

## Persistence

Only profile facts. Awareness is derived each render; reload must reconstruct the same semantic state from the same facts.

## Localization

EN/DE/RU/UA in `BENEFITS_AWARENESS_I18N` + profile field `dependentChildCount`. No UA←RU inheritance.

## Limitations

* No Kindergeld **COMPLETED** without inventing `receivingKindergeld`
* Child ages not collected as first-class UI (count → optional age 0 placeholders)
* Seed rule is intentionally thin (`hasChildren` only)
* Seed value estimates must never surface as user claims

## Explicitly deferred

Other benefits, amounts, legal eligibility, application workflows, calculators, notifications, ranking, discovery engines, generic rules language, new persistence, Kindergeld receiving flag (product decision), age-banded Kindergeld rules.

## Architecture check (E4 → E5)

Does the E4 pattern support two materially different benefits without over-generalization?

**Yes — as the current Benefits awareness pattern:**

`UserContext.profile` → benefit-specific awareness adapter → semantic result → shared presentation → existing action/guidance → profile mutation → recalculation

Abstraction stops at a shared result DTO + panel list. No plugin registry.
