---
id: healthcare-progressive-enrichment-design-v1
title: Arrival Atlas — Healthcare Progressive Enrichment Design v1 (PD-003)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-003
  - healthcare
  - progressive-enrichment
created: 2026-09-08
updated: 2026-09-08
---

# Healthcare Progressive Enrichment Design v1

## Current pipeline

```text
Profile (insurance / healthInsurance)
  → mergeModuleInput (defaults hasInsurance=false, insuranceType='none')
  → healthcareNavigationModule.execute
      → SCENARIOS[situation] → { scenario, steps, decisions, warnings }
  → MRC normalizeRecommendations (no healthcare case → [])
  → projectModuleUI → success + recommendations:[] + actions:[]
  → ModuleProjectionRenderer (capabilities off + empty lists → blank)
```

## Current result model

| Layer | Behavior |
|---|---|
| Domain payload | Always returns steps for known situations |
| MRC recommendations/actions | Always `[]` for healthcare (no normalizer) |
| ModuleUIProjection | `status: success`, empty lists, optional summary |
| Technical failure | `status: error` (exists) |
| MORE_INFO / NO_APPLICABLE | **Absent** |

## Root cause (verified)

1. **Normalizer gap:** `normalizeRecommendations` default branch returns `[]` for `healthcare-navigation`, discarding `steps`/`decisions`.
2. **Capability gap:** Healthcare uses `DEFAULT_MODULE_CONTRACT` (`capabilities: []`), so UI never shows recommendation sections even if lists were populated.
3. **Insurance ambiguity:** Zod defaults + input-merger defaults collapse missing insurance to **uninsured** (`hasInsurance=false`, `insuranceType='none'`), so unknown cannot be distinguished.
4. **No outcome discriminant:** HTTP 200 + `[]` means both “evaluated with no MRC projection” and “intentionally empty” — UI stays unchanged.

## Proposed minimal contract

```text
situation required
insurance assumption: insured | uninsured | unknown
    ↓
unknown (+ non-emergency) → MORE_INFO_REQUIRED (not [])
insured | uninsured → execute scenario
    ├── steps present → RECOMMENDATIONS (normalize steps → MRC recommendations)
    ├── steps empty → NO_APPLICABLE_RESULT
    └── execution failure → TECHNICAL_ERROR (ModuleResult status ≠ success)
```

Changes (smallest):

* Optional insurance fields; no silent uninsured defaults in schema/merger
* Domain `outcome` + `insuranceAssumption` + `missing[]` on healthcare payload
* Healthcare recommendation normalizer + `produces-recommendations` capability
* Optional `outcome` / `missingContext` on `ModuleUIProjection`
* UI renders each terminal outcome explicitly

Out of scope: medical engine redesign, new medical fields, galaxy redesign, simulators.
