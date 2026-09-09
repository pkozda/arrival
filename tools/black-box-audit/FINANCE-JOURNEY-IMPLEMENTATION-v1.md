---
id: finance-journey-implementation-v1
title: Arrival Atlas — Finance Journey Implementation v1 (E10)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e10
  - finance
created: 2026-09-08
updated: 2026-09-09
---

# Finance Journey Implementation v1 (E10)

## Selected slice

**Option C — Tax Administration** hosted on Economic Reality.

## Files changed

* `apps/web/src/lib/finance/build-tax-administration-view-model.ts`
* `apps/web/src/lib/finance/build-tax-administration-view-model.test.ts`
* `apps/web/src/modules/economic-reality/ui/components/TaxAdministrationPanel.tsx`
* `apps/web/src/modules/economic-reality/ui/EconomicRealityPage.tsx`
* `packages/core/src/i18n/finance-tax-translations.ts`
* `packages/core/src/i18n/finance-tax.e10.test.ts`
* `packages/core/src/i18n/index.ts`
* `tools/black-box-audit/probes/probe-e10-finance-journey.mjs`
* `tools/black-box-audit/FINANCE-JOURNEY-DESIGN-v1.md`
* `tools/black-box-audit/FINANCE-JOURNEY-IMPLEMENTATION-v1.md`

### Semantic hardening (churchTax tri-state)

* `apps/web/src/lib/profile-correction/domain-field-definitions.ts`
* `apps/web/src/lib/profile-correction/mutation-request-builder.ts`
* `apps/web/src/lib/profile-correction/mutation-request-builder.test.ts`
* `apps/web/src/lib/profile-correction/church-tax-tri-state.test.ts`
* `apps/web/src/components/profile/DomainFieldRenderer.tsx`
* `packages/core/src/i18n/profile-translations.ts`
* `packages/core/src/i18n/church-tax-tri-state.e10.test.ts`

## Domain / presentation boundaries

* Domain facts remain on `employment.taxClass` / `employment.churchTax` in the product-contract profile.
* Presentation derives `NOT_ADDED | INCOMPLETE | READY` only; does not invent bank/tax-id facts.
* Panel is ER-hosted; no Finance module registry entry.

## Mutations

Existing work-income profile editor mutation path (`/profile/work-income/edit`). No finance-specific ownership or revision semantics.

## Recalculation path

Profile mutation → user context profile refresh → `buildTaxAdministrationViewModel` re-derives panel state. Financial Reality / payroll consumers continue to read the same fields independently.

## Tests / probe

* Tax Administration VM unit: 7/7
* Finance tax i18n: 2/2
* churchTax tri-state unit: 13/13
* churchTax tri-state i18n: 2/2
* Browser probe: extended for tri-state hardening

## Semantic hardening — churchTax tri-state

### Root cause

1. `buildInitialDraft` defaulted every `boolean` field to `false` when the profile value was `undefined`.
2. `normalizeDraftFieldValue` used `Boolean(raw)`, coercing `undefined` → `false`.
3. `DomainFieldRenderer` rendered churchTax as a checkbox (`checked={Boolean(value)}`), so unknown looked identical to “No”.
4. Mutation comparison previously treated `false ≡ undefined` for booleans, which masked some writes but still left the draft/UI manufacturing a false-looking state; any path that compared normalized draft `false` as a real change could persist unknown → false without explicit user intent.

### Previous behavior

* Unknown church tax appeared as an unchecked checkbox (“No”).
* Saving Work & Income risked treating unknown as authoritative `false`.

### Corrected behavior

* `churchTax` is a **tri-state select**: Not specified / Yes / No.
* Draft uses `'' | 'true' | 'false'`; normalize maps only explicit yes/no to booleans; `''` stays `undefined`.
* Unrelated field saves do **not** emit `churchTax`.
* Only explicit select changes emit `churchTax: true` or `churchTax: false`.
* Tax Administration READY remains based on known `taxClass` (E10 unchanged); churchTax unknown stays UNKNOWN on the panel.

### Tri-state contract

| State | Profile | Editor | Meaning |
| --- | --- | --- | --- |
| Unknown | `undefined` | Not specified (`''`) | Not provided/confirmed |
| Yes | `true` | Yes | Explicitly applies |
| No | `false` | No | Explicitly does not apply |

### Mutation semantics

* Compare **normalized** draft vs **normalized** profile values.
* `undefined` is never coerced to `false`.
* `fact.correct` still cannot clear an existing boolean back to unknown (selecting Not specified after Yes/No is a known limitation; no `fact.invalidate` path added).

### Regression coverage

* Unit: init unknown/yes/no; unrelated save preserves undefined; explicit transitions; Tax Admin READY/INCOMPLETE.
* i18n: EN/DE/RU/UA; no UA←RU.
* Browser probe phases T-A…T-H: unknown preserved after unrelated save; true/false persist across reload; ER planner / Housing / Benefits still present.

## Limitations

* Banking / IBAN facts do not exist — explicitly deferred in UI copy.
* No Steuer-ID field; no official tax filing flow.
* Income remains ER-owned and is not shown as Finance status.
* Clearing churchTax from true/false back to unknown is not supported via `fact.correct` (would need invalidate).

## Known follow-ups

* Authoritative bank-account facts before any Banking Setup slice
* Optional `fact.invalidate` path to clear churchTax back to unknown
* Life Event banking nodes: replace heuristic completion language with explicit-unknown
