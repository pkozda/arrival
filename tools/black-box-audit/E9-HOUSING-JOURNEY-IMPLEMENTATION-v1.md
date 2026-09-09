---
id: e9-housing-journey-implementation-v1
title: Arrival Atlas — Housing Journey Implementation v1 (E9)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e9
  - housing
created: 2026-09-08
updated: 2026-09-08
---

# E9 Housing Journey Implementation v1

## Files changed

* `apps/web/src/lib/housing/build-housing-situation-view-model.ts`
* `apps/web/src/lib/housing/build-housing-situation-view-model.test.ts`
* `apps/web/src/modules/economic-reality/ui/components/HousingSituationPanel.tsx`
* `apps/web/src/modules/economic-reality/ui/EconomicRealityPage.tsx`
* `packages/core/src/i18n/housing-situation-translations.ts`
* `packages/core/src/i18n/housing-situation.e9.test.ts`
* `packages/core/src/i18n/index.ts`
* `tools/black-box-audit/probes/probe-e9-housing-journey.mjs`
* `tools/black-box-audit/E9-HOUSING-JOURNEY-DESIGN-v1.md`
* `tools/black-box-audit/E9-HOUSING-JOURNEY-IMPLEMENTATION-v1.md`

## Implementation

Derived Housing Situation VM + ER panel. No new profile fields, module, or persistence store.

## Tests / probe

* Housing VM unit: 8/8
* Housing i18n: 2/2
* Wohngeld regression: 6/6
* PD-001 satisfaction: 3/3
* Browser probe: PASS WITH LIMITATIONS (P0=0, P1=0)

## Limitations

* No street address / housing status / search intent fields
* No marketplace
* Utilities optional and not required for READY
* Registration confirmation lives on migration domain (by design)
