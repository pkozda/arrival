---
id: e5-kindergeld-awareness-implementation-v1
title: Arrival Atlas — Kindergeld Awareness Implementation v1 (E5)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e5
  - benefits
  - kindergeld
created: 2026-09-08
updated: 2026-09-08
---

# E5 Kindergeld Awareness Implementation v1

## Files changed

### MBDE awareness

* `packages/mbde/src/awareness/types.ts` — shared result/state DTO
* `packages/mbde/src/awareness/kindergeld-awareness.ts` — Kindergeld adapter
* `packages/mbde/src/awareness/kindergeld-awareness.test.ts`
* `packages/mbde/src/awareness/wohngeld-awareness.ts` — add `titleKey`; re-export shared types
* `packages/mbde/src/awareness/index.ts` — `evaluateBenefitsAwareness`
* `packages/mbde/package.json` — `./awareness` export → `index`

### Presentation

* `apps/web/.../BenefitsAwarenessPanel.tsx` — list Wohngeld + Kindergeld cards

### Profile action path

* `apps/web/.../domain-field-definitions.ts` — `dependentChildCount` on household-family
* `apps/web/.../mutation-request-builder.ts` — maps count → `children[]`
* `apps/web/.../mutation-request-builder.test.ts`
* `packages/core/src/i18n/profile-translations.ts` — EN/DE/RU/UA field labels

### i18n

* `packages/core/src/i18n/benefits-awareness-translations.ts` — dual-benefit chrome + Kindergeld keys
* `packages/core/src/i18n/benefits-awareness.e4.test.ts` — title rename regression
* `packages/core/src/i18n/benefits-awareness.e5.test.ts`

### Docs / probe

* `tools/black-box-audit/E5-KINDERGELD-AWARENESS-DESIGN-v1.md`
* `tools/black-box-audit/E5-KINDERGELD-AWARENESS-IMPLEMENTATION-v1.md`
* `tools/black-box-audit/probes/probe-e5-kindergeld-awareness.mjs`

## Implementation details

### Kindergeld evaluation

1. If `domains.household.children` is not an array → `NOT_ENOUGH_INFORMATION` (never use `householdSize`).
2. If `children === []` → `NOT_APPLICABLE`.
3. If length > 0 → adapt + MBDE seed `hasChildren eq true` → `READY_TO_ACT` with official Arbeitsagentur URL.
4. `COMPLETED` not implemented — no `receivingKindergeld` fact.

### Household editor

Draft field `dependentChildCount` persists as authoritative `children[]`:

* count `0` → `[]`
* count `n` → preserve existing ages when possible; new slots use `{ age: 0 }` (age unspecified)

### Panel

`evaluateBenefitsAwareness(profile)` returns `[wohngeld, kindergeld]`. Panel keeps root `data-benefits-state` = Wohngeld for E4 probe compatibility; per-benefit cards use `data-benefits-benefit` + `data-benefits-state`.

## Tests

| Suite | Result |
| --- | --- |
| `packages/mbde` awareness (Wohngeld + Kindergeld) | 14 passed |
| `benefits-awareness.e4/e5` i18n | 8 passed |
| mutation-request-builder (incl. children map) | 5 passed |

## Browser probe

`probe-e5-kindergeld-awareness.mjs` → **PASS WITH LIMITATIONS** (P0=0, P1=0)

Observed: A insufficient → B children=1 READY_TO_ACT → C children=0 NOT_APPLICABLE → D reload → E EN/UA → F Wohngeld still present.

## Regressions

* Wohngeld unit semantics unchanged (same tests green).
* Panel still hosts on Economic Reality Action Planner page.
* E4 root `data-benefits-state` preserved for Wohngeld.

## Limitations

* No Kindergeld `COMPLETED` without inventing `receivingKindergeld`
* Child ages not first-class in the form (count → optional age 0)
* Seed rule is presence-only (`hasChildren`)
* Intentionally not a generic benefits plugin platform
