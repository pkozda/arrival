# Benefits Simulator — M1.1 Production Hardening Report

**Date:** June 2026  
**Module:** `benefits-simulator` v1.0.0  
**Output schema:** `1.0.0`  
**Follows:** `docs/audits/benefits-simulator-implementation-plan.md`  
**Status:** Complete

---

## Executive Summary

M1.1 hardens the Benefits Simulator for production readiness through **deterministic golden fixtures**, **snapshot-style regression tests**, **output schema versioning**, and a **UI rendering contract** — without changing financial engines, scenario-grid logic, or business rules.

**100 automated tests pass** (44 profile + 31 shared-services + 22 modules + 3 API). All 87 pre-existing tests preserved; **13 new golden tests** added.

---

## Scope

### In scope (completed)

| Task | Deliverable |
|------|-------------|
| Golden scenario fixtures | `tests/fixtures/benefits-simulator-scenarios.json` (12 scenarios) |
| Golden snapshot tests | `packages/modules/src/benefits-simulator/golden-scenarios.test.ts` |
| Schema versioning | `meta.schemaVersion: "1.0.0"` |
| UI contract | `docs/contracts/benefits-simulator-ui-contract.md` |

### Out of scope (unchanged)

- Financial engines (`benefitsEngine`, `payrollEngine`)
- `runScenarioGrid()` logic
- Event transform semantics
- API routes
- Web UI components

---

## 1. Golden Scenario Fixture Suite

**File:** `tests/fixtures/benefits-simulator-scenarios.json`

| ID | Scenario |
|----|----------|
| S01 | Unemployment → Bürgergeld fallback |
| S02 | Minijob €450 transition |
| S03 | Midijob €800 transition |
| S04 | Part-time employment change |
| S05 | Child addition |
| S06 | Child removal |
| S07 | Rent increase |
| S08 | Rent decrease |
| S09 | Partner job loss |
| S10 | Partner job gain |
| S11 | Full household unemployment |
| S12 | Dual income Minijob optimization |

Each fixture contains:

- `input` — full `BenefitsSimulatorInput` payload
- `expect` — golden metrics (not full output dump)
- `description` — human-readable intent

Fixture file version (`1.0.0`) aligns with `meta.schemaVersion`.

---

## 2. Golden Snapshot Tests

**File:** `packages/modules/src/benefits-simulator/golden-scenarios.test.ts`

### Validated per fixture

| Assertion | Field |
|-----------|-------|
| Baseline household resources | `baseline.financialImpact.totalHouseholdResources` |
| Baseline Bürgergeld | `baseline.benefitChanges.buergergeld.after` |
| Scenario ordering | `scenarios[].id` matches `expect.scenarioOrder` |
| Per-scenario resources | `financialImpact.totalHouseholdResources` |
| Bürgergeld delta | `benefitChanges.buergergeld.delta` |
| Delta from baseline | `financialImpact.deltaFromBaseline` |
| Risk warnings presence | `riskWarnings.length > 0` vs `expect.hasRiskWarnings` |
| Risk categories | Sorted category set when specified |
| Best scenario | `comparison.bestScenarioId` |
| Spread | `comparison.spread` |
| Schema version | `meta.schemaVersion === fixture.version` |

### Determinism test

Repeated execution of S01 produces identical `totalHouseholdResources`, scenario resources, and `comparison` object.

### Design choice

Golden values are **curated metrics**, not full JSON snapshots. This avoids brittleness from `calculatedAt` timestamps while locking financial outputs.

---

## 3. Schema Versioning

### Added fields

```typescript
// schema.ts
export const BENEFITS_SIMULATOR_SCHEMA_VERSION = '1.0.0';

meta: {
  // ...existing fields
  schemaVersion: z.string().default('1.0.0'),
}
```

### Injection point

`orchestrator.ts` adds `schemaVersion` when mapping grid output to module output — **not** in `scenario-grid.ts` (engine unchanged).

### Backward compatibility

- New field is additive only
- Zod default ensures validation passes for clients ignoring the field
- Existing consumers reading `meta.engineVersion` / `meta.taxYear` unaffected

---

## 4. UI Contract

**File:** `docs/contracts/benefits-simulator-ui-contract.md`

Defines (non-functional):

| Topic | Rules |
|-------|-------|
| Required render fields | disclaimer, confidence, baseline, scenarios, summary |
| Scenario table order | Baseline first, then input order (no auto-sort) |
| Column mapping | Financial impact, benefit deltas, gain from work |
| Risk severity | critical → high → medium → low with color tokens |
| Recommendations order | Priority-based with scenario linking |
| Schema compatibility | Unknown `schemaVersion` → graceful degradation |

---

## 5. Files Changed

### New

| Path | Purpose |
|------|---------|
| `tests/fixtures/benefits-simulator-scenarios.json` | 12 golden scenarios |
| `packages/modules/src/benefits-simulator/golden-scenarios.test.ts` | Regression suite |
| `docs/contracts/benefits-simulator-ui-contract.md` | UI binding contract |
| `docs/audits/benefits-simulator-m1-1-hardening-report.md` | This report |

### Modified (additive only)

| Path | Change |
|------|--------|
| `packages/modules/src/benefits-simulator/schema.ts` | `schemaVersion` + constant |
| `packages/modules/src/benefits-simulator/orchestrator.ts` | Inject `schemaVersion` |
| `packages/modules/src/benefits-simulator/index.ts` | Export constant |
| `packages/modules/src/benefits-simulator/benefits-simulator.test.ts` | Assert `schemaVersion` |

### Unchanged

- `shared-services/financial/simulator/*`
- `scenario-grid.ts`
- `event-transform.ts`
- `analysis.ts`
- Profile engine
- API layer

---

## 6. Test Summary

| Package | Before M1.1 | After M1.1 | Delta |
|---------|-------------|------------|-------|
| `@arrivalos/profile` | 44 | 44 | — |
| `@arrivalos/shared-services` | 31 | 31 | — |
| `@arrivalos/modules` | 9 | 22 | +13 |
| `@arrivalos/api` | 3 | 3 | — |
| **Total** | **87** | **100** | **+13** |

---

## 7. Constraint Verification

| Constraint | Status |
|------------|--------|
| No financial engine changes | ✅ |
| No scenario-grid logic changes | ✅ |
| No new business logic | ✅ |
| Deterministic hardening only | ✅ |
| All existing tests preserved | ✅ |
| No breaking API changes | ✅ |

---

## 8. Sample Golden Output (S02 Minijob)

```json
{
  "baselineTotalHouseholdResources": 1363,
  "scenarioOrder": ["minijob-450"],
  "scenarios": [{
    "id": "minijob-450",
    "totalHouseholdResources": 1533,
    "buergergeldDelta": -280,
    "deltaFromBaseline": 170
  }],
  "hasRiskWarnings": true,
  "bestScenarioId": "minijob-450",
  "spread": 170
}
```

---

## Verdict

Benefits Simulator M1.1 is **production-hardened** for deterministic regression safety and UI integration readiness. Financial behavior is locked by 12 golden scenarios; output contract is versioned and documented.

**Recommended next step:** Web UI page implementing `docs/contracts/benefits-simulator-ui-contract.md`.
