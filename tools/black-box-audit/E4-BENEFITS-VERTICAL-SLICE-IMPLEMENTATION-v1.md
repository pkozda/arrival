---
id: e4-benefits-vertical-slice-implementation-v1
title: Arrival Atlas — Benefits Vertical Slice Implementation v1 (E4)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e4
  - benefits
created: 2026-09-08
updated: 2026-09-08
---

# E4 Benefits Vertical Slice Implementation v1

## Architecture

```text
UserContext.profile
  → evaluateWohngeldAwareness (MBDE adapt + wohngeld seed rules)
  → BenefitsAwarenessPanel on Economic Reality
  → CTA → existing profile mutation routes / official URL
  → profile refresh → derived recalculation
```

## Files

| File | Role |
| --- | --- |
| `packages/mbde/src/awareness/wohngeld-awareness.ts` | Domain evaluation |
| `packages/mbde/src/awareness/wohngeld-awareness.test.ts` | Unit tests |
| `packages/mbde/src/profile/adapt-user-profile.ts` | Receiving ID aliases |
| `packages/mbde/src/index.ts` | Export |
| `packages/core/src/i18n/benefits-awareness-translations.ts` | EN/DE/RU/UA |
| `packages/core/src/i18n/index.ts` | Merge dictionaries |
| `packages/core/src/i18n/benefits-awareness.e4.test.ts` | i18n guards |
| `apps/web/.../BenefitsAwarenessPanel.tsx` | UI |
| `apps/web/.../EconomicRealityPage.tsx` | Host panel |
| `apps/web/package.json`, `next.config.mjs`, `vitest.config.ts` | mbde dependency |
| `tools/black-box-audit/probes/probe-e4-benefits-vertical-slice.mjs` | Browser |
| `tools/black-box-audit/E4-BENEFITS-VERTICAL-SLICE-DESIGN-v1.md` | Design |

## Tests

* `packages/mbde` wohngeld-awareness (6)
* `packages/core` benefits-awareness.e4 (3)
* ER planner regression (pd002) — unchanged pass

## Browser

`node tools/black-box-audit/probes/probe-e4-benefits-vertical-slice.mjs`

## Limitations

* Heuristic seed threshold (income &lt; 3500) is not legal eligibility
* No benefit amounts shown
* Children/Kindergeld out of scope
* Scenario C depends on benefits-support checkbox discoverability

## Regressions

None intentional to Household/ER contracts; Action Planner unchanged.
