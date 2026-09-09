---
id: e1-cross-module-journey-implementation-v1
title: Arrival Atlas — Cross-Module Journey Implementation v1 (E1)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e1
  - localization
  - cross-module
created: 2026-09-08
updated: 2026-09-08
related:
  - e1-cross-module-journey-audit-v1
---

# E1 Implementation Notes

## Fix implemented (P1)

**Problem:** Ukrainian Discovery i18n object spread Russian (`const UA = { ...RU, ... }`), so HUD `nav.discovery` rendered as Russian `Поиск` during UA journeys (CROSS-UX-001 residual / E1-LOC-001).

**Change:** Override UA Discovery navigation and core chrome strings to Ukrainian (`Пошук`, profile list/create chrome, etc.).

**Test:** `packages/core/src/i18n/discovery-ua-localization.e1.test.ts` asserts UA ≠ RU for nav/module/create labels.

**Validation:** E1 browser probe observed HUD label `Пошук` with `document.lang=uk`.

## Intentionally not fixed (P2/P3)

* Atlas Home slide English under UA  
* Journey Guide English welcome  
* Full elimination of `...RU` inheritance for all Discovery keys  
* Employment HUD placement  
* ER recalculation toast remount limitation  

## Probe

`tools/black-box-audit/probes/probe-e1-cross-module-journey.mjs` — coherent A→I journey; no manufactured SUCCESS.
