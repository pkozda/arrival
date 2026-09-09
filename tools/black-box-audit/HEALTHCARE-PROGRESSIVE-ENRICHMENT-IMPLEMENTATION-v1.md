---
id: healthcare-progressive-enrichment-implementation-v1
title: Arrival Atlas — Healthcare Progressive Enrichment Implementation v1 (PD-003)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
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

# Healthcare Progressive Enrichment Implementation v1

## Implemented

* **Minimum context:** `situation` + explicit insurance assumption (`insured` | `uninsured` | `unknown`). Emergency may run with insurance unknown.
* **Insurance semantics:** `deriveHealthcareInsuranceAssumption` — unknown is not collapsed to uninsured/insured. Removed silent defaults in healthcare Zod input, profile `input-merger`, SchemaForm optional checkboxes/enums, and `deriveDefaultValues` for non-required fields.
* **Terminal outcome model:** domain payload `outcome` ∈ `RECOMMENDATIONS` | `MORE_INFO_REQUIRED` | `NO_APPLICABLE_RESULT`; projection maps `execution_error` → `TECHNICAL_ERROR`.
* **Normalizer:** `normalizeHealthcareNavigationRecommendations` maps scenario `steps` → MRC recommendations only for `RECOMMENDATIONS`; does not fabricate lists for more-info / no-applicable.
* **API contract:** `/api/modules/healthcare-navigation/execute` returns HTTP 200 with `projection.outcome`, `insuranceAssumption`, `missingContext`, and recommendations when applicable — empty arrays are no longer the sole success signal.
* **UI:** `ModuleProjectionRenderer` renders each outcome explicitly (guidance list, missing-info CTA, no-applicable empty state, recoverable technical error).
* **Profile integration:** missing insurance CTA → `/profile/health-insurance/edit` via existing profile mutation path (no healthcare-specific store).

## State flow

```text
CURRENT CONTEXT
    ↓
SUFFICIENT?
    ├── NO (insurance unknown ∧ situation ≠ emergency)
    │       → MORE_INFO_REQUIRED
    │
    └── YES → EXECUTE
                 ├── RECOMMENDATIONS (steps present)
                 ├── NO_APPLICABLE_RESULT (evaluated, empty body)
                 └── TECHNICAL_ERROR (ModuleResult status ≠ success)
```

## Previous failure

```text
HTTP 200
+ MRC recommendations/actions always [] (no healthcare normalizer)
+ DEFAULT_MODULE_CONTRACT (no recommendation capability)
+ insurance unknown → hasInsurance=false / insuranceType='none'
+ UI: empty lists + capabilities off → blank / unchanged screen
```

Prevention:

1. Domain emits an explicit `outcome` before MRC projection.
2. Healthcare normalizer + `produces-recommendations` contract capability surface steps when present.
3. `ModuleUIProjection.outcome` / `missingContext` / `insuranceAssumption` distinguish intentional empty from incomplete evaluation.
4. UI branches on `outcome`, not on “array length alone”.
5. Technical failures project `status: error` + `outcome: TECHNICAL_ERROR`, not success + `[]`.

## Tests

| Test | Coverage | Result |
|---|---|---|
| A — sufficient context → semantic result | domain + API | PASS |
| B — insufficient → MORE_INFO_REQUIRED | domain + normalizer + API | PASS |
| C — unknown ≠ insured/uninsured | domain | PASS |
| D — no applicable → NO_APPLICABLE_RESULT | domain + normalizer + projection | PASS |
| E — technical failure ≠ `[]` | projection (`execution_error` → TECHNICAL_ERROR) | PASS |
| F — recommendations representable | domain + normalizer + projection + API + browser | PASS |
| G — API distinguishes outcomes | API + projection | PASS |

Focused suites (18 tests):

* `packages/modules/src/healthcare-navigation/healthcare-navigation.test.ts`
* `packages/module-runtime/src/normalizers/healthcare-navigation.pd003.test.ts`
* `packages/product-contract/src/healthcare-outcome.pd003.test.ts`
* `apps/api/src/healthcare-progressive-enrichment.pd003.api.test.ts`

Existing E2E tests were not modified.

## Browser validation

Probe: `tools/black-box-audit/probes/probe-pd003-healthcare-local.mjs`  
Artifacts: `tools/black-box-audit/artifacts/pd003-healthcare/`

Observations:

1. Healthcare Navigation → situation only → execute → `outcome: MORE_INFO_REQUIRED`, `insuranceAssumption: unknown`, missing insurance CTA visible.
2. After insurance known (profile path) → execute → `outcome: RECOMMENDATIONS`, 5 recommendations, UI guidance visible.
3. Profile insurance save attempted; reload completed (context persists via profile).
4. Observed live: `MORE_INFO_REQUIRED`, `RECOMMENDATIONS`.
5. `NO_APPLICABLE_RESULT`: UNVERIFIED in browser (current scenario catalog always yields steps when insurance known). Covered by unit tests.
6. `TECHNICAL_ERROR`: UNVERIFIED in browser (requires forced runtime failure). Covered by projection unit test.

**Browser verdict:** PASS for the previously broken empty-success path.

## Persistence behavior

* Terminal execute `outcome` is not persisted as a durable healthcare result document (session execute response only).
* Insurance / health-insurance profile fields persist via existing mutation + projection; reload returns to Healthcare Navigation with known insurance assumption.

## Limitations

* `NO_APPLICABLE_RESULT` not safely reproducible in browser with current scenario catalog.
* Scenario step/decision copy remains mostly English (pre-existing domain content); new outcome/missing UI strings are localized EN/DE/RU/UA.
* Optional SchemaForm / `deriveDefaultValues` behavior changed globally for non-required fields so unknown insurance can be submitted — intentional for progressive enrichment.

## Remaining PD-003 work

* Richer progressive enrichment beyond insurance (only when current logic truly needs it).
* Additional healthcare contexts / broader recommendation coverage without medical overreach.
* Safer browser path for `NO_APPLICABLE_RESULT` / recoverable `TECHNICAL_ERROR`.
* Deeper localization of pre-existing scenario step copy.
* Full E2E hardening (new tests only; do not rewrite unrelated suites).
