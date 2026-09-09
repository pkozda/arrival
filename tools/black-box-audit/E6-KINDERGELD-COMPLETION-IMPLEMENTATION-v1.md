---
id: e6-kindergeld-completion-implementation-v1
title: Arrival Atlas — Kindergeld Completion Fact Implementation v1 (E6)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e6
  - benefits
  - kindergeld
created: 2026-09-08
updated: 2026-09-08
---

# E6 Kindergeld Completion Fact Implementation v1

## Files changed

### Contract / persistence

* `packages/product-contract/.../domain-field-types.ts` — `receivingKindergeld?: boolean`
* `packages/product-contract/.../field-registry.ts` — persistent fact id + definition
* `packages/profile/.../profile-document.ts` — document schema
* `packages/profile/.../ui-profile-response.ts` — UI benefits type
* `packages/profile-engine/.../project-profile-state.ts` — project into UserProfileView
* `apps/api/.../materialize-profile-document.ts` — materialize nested benefits

### Awareness / adapter

* `packages/mbde/src/awareness/kindergeld-awareness.ts` — COMPLETED short-circuit
* `packages/mbde/src/profile/adapt-user-profile.ts` — receiving alias for MBDE lists
* `packages/mbde/src/awareness/kindergeld-awareness.test.ts` — E5 + E6 cases

### UI

* `apps/web/.../domain-field-definitions.ts` — benefits-support checkbox
* `apps/web/.../BenefitsAwarenessPanel.tsx` — Kindergeld record-receiving CTA
* `apps/web/.../situation-utils.ts` / `profile-mirror-utils.ts` — include fact

### i18n

* `packages/core/.../profile-translations.ts`
* `packages/core/.../benefits-awareness-translations.ts`
* `packages/core/.../benefits-awareness.e6.test.ts`

### Docs / probe

* `tools/black-box-audit/E6-KINDERGELD-COMPLETION-DESIGN-v1.md`
* `tools/black-box-audit/E6-KINDERGELD-COMPLETION-IMPLEMENTATION-v1.md`
* `tools/black-box-audit/probes/probe-e6-kindergeld-completion.mjs`

## Implementation details

COMPLETED only when `receivingKindergeld === true`. Panel secondary CTA for Kindergeld READY_TO_ACT links to benefits-support with Kindergeld-specific label. No apply CTA in COMPLETED (primary action is review benefits flags).

## Tests

See final report — MBDE E5/E6 awareness + i18n E6.

## Browser probe

`probe-e6-kindergeld-completion.mjs` → **PASS WITH LIMITATIONS** (P0=0, P1=0)

Observed: A READY_TO_ACT (children, no receiving) → B COMPLETED after confirm → C reload COMPLETED → D revoke → READY_TO_ACT → E EN/UA → F Wohngeld present.

## Regressions

Wohngeld COMPLETED path unchanged (E4 probe green); shared panel still lists both benefits.

## Limitations

No authority verification; ages still optional; no third benefit.
