---
id: benefits-simulator-implementation-plan
title: Benefits Simulator Implementation Plan
project: Arrival Atlas
system: Arrival Atlas
type: roadmap
domain: benefits
status: active
maturity: stable
owner: system
tags:
  - benefits-calculation
  - module-delivery
created: 2026-06-01
updated: 2026-06-19
related:
  - benefits-simulator-design
---

# Benefits Simulator — Implementation Plan & Architecture Rationale

**Date:** June 2026  
**Module:** `benefits-simulator` v1.0.0  
**Follows:** `docs/benefits/benefits-simulator-design.md`  
**Status:** Implemented (M1)

---

## Executive Summary

The Benefits Simulator module is implemented as a **thin orchestration layer** over existing Financial v2 shared services. It performs zero benefit, payroll, or eligibility calculations internally. All financial math flows through `benefitsEngine`, `payrollEngine`, and `compareScenarios`.

**87 automated tests pass** across profile, shared-services, modules, and API packages.

---

## 1. Implementation Plan

### Phase BS-M0 — Shared Services Extension ✅

| Task | File | Status |
|------|------|--------|
| Simulator types | `shared-services/financial/simulator/types.ts` | ✅ |
| Pure event transforms | `shared-services/financial/simulator/event-transform.ts` | ✅ |
| Scenario grid runner | `shared-services/financial/simulator/scenario-grid.ts` | ✅ |
| Analysis (warnings, recommendations) | `shared-services/financial/simulator/analysis.ts` | ✅ |
| Unit tests | `event-transform.test.ts`, `scenario-grid.test.ts` | ✅ |

### Phase BS-M1 — Module Shell ✅

| Task | File | Status |
|------|------|--------|
| Zod input/output schemas | `modules/benefits-simulator/schema.ts` | ✅ |
| Input adapter | `modules/benefits-simulator/adapter.ts` | ✅ |
| Output orchestrator | `modules/benefits-simulator/orchestrator.ts` | ✅ |
| Module registration | `modules/benefits-simulator/index.ts` | ✅ |
| Registry wiring | `modules/src/index.ts` | ✅ |
| Module tests | `benefits-simulator.test.ts` | ✅ |

### Phase BS-M2 — Profile Integration ✅

| Task | File | Status |
|------|------|--------|
| Module profile policy | `profile/policy/module-profile-policy-registry.ts` | ✅ |
| Profile → input merge | `profile/engine/benefits-simulator-input-merge.ts` | ✅ |
| Input merger hook | `profile/engine/input-merger.ts` | ✅ |
| Dependency | `profile/package.json` → `@arrival-atlas/shared-services` | ✅ |

### Phase BS-M3 — Future (not in scope)

| Task | Status |
|------|--------|
| Web UI page | Pending |
| Localized output strings | Pending |
| Saved scenarios in profile extensions | Pending |
| Golden fixture validation (24 scenarios) | Pending |

---

## 2. Architecture Rationale

### 2.1 Three-layer separation

```
Benefits Simulator Module          Shared Services                 Profile Engine
─────────────────────────          ───────────────                 ──────────────
schema.ts (contract)               benefitsEngine                  resolveExecutionContext()
adapter.ts (map input)      ───►   payrollEngine            ◄───  policy + merge + trace
orchestrator.ts (map output)       compareScenarios                (no module profile access)
index.ts (register)
```

### 2.2 Rule compliance

| Rule | Implementation |
|------|----------------|
| **No duplicate engines** | Module imports only orchestration; all math in `shared-services/financial/simulator/` calls existing engines |
| **Immutable scenarios** | `applyEventsToBaseline()` uses `structuredClone` + reduce; baseline never mutated |
| **Single source of truth** | `runScenarioGrid()` → `benefitsEngine.evaluateScenario()` + `compareScenarios()` |
| **Profile via pipeline only** | Module `execute()` receives merged input; profile merge in `input-merger.ts` |

### 2.3 Why extend shared-services instead of module?

| Concern | Location | Reason |
|---------|----------|--------|
| Event → state transform | `event-transform.ts` | Pure, reusable, testable without module registry |
| Multi-scenario grid | `scenario-grid.ts` | Uses `benefitsEngine` directly; future modules could reuse |
| Risk/recommendation analysis | `analysis.ts` | Aggregates comparison results; not benefit calculation |
| Zod API contract | Module `schema.ts` | Module-specific boundary |
| Output shape mapping | Module `orchestrator.ts` | Module-specific presentation |

---

## 3. Module Skeleton

```
packages/modules/src/benefits-simulator/
├── index.ts              # Module + registration
├── schema.ts             # BenefitsSimulatorInput/Output (Zod)
├── adapter.ts            # Module input → SimulatorGridInput
├── orchestrator.ts       # runScenarioGrid → module output
└── benefits-simulator.test.ts
```

### Entry point

```typescript
// index.ts
async execute(input, _context) {
  return runBenefitsSimulator(input);  // no profile access
}
```

---

## 4. Adapter Design

**File:** `adapter.ts`

Maps module Zod input to `SimulatorGridInput`:

| Module field | Shared service field |
|--------------|---------------------|
| `household` | `baseline.household` |
| `baselineEmployments` | `baseline.employments` |
| `scenarios[]` | `scenarios[]` (events passed through) |
| `taxYear` | `taxYear` |
| `currentBenefits.receivingBuergergeld` | `receivingBuergergeld` |

No transformation logic beyond field mapping — events are validated by Zod at module boundary and consumed by shared `event-transform.ts`.

---

## 5. Orchestrator Design

**File:** `orchestrator.ts`

```
runBenefitsSimulator(input)
  → adaptToSimulatorGridInput(input)
  → runScenarioGrid(gridInput)          // shared-services
  → mapGridOutputToModuleOutput(grid)   // ScenarioResult → UI contract
```

`mapScenarioSummary()` derives:

- `financialImpact` from `ScenarioResult.household` + `totalHouseholdResources`
- `benefitChanges` from baseline vs scenario Bürgergeld/Kindergeld
- `effectiveGainFromWork` from `ScenarioComparison`

---

## 6. Event Transform Design (Pure Functions)

**File:** `shared-services/financial/simulator/event-transform.ts`

```typescript
applyEventsToBaseline(baseline, events):
  events.reduce(applySingleEvent, clone(baseline))
```

Each `applySingleEvent`:

1. Clones household + employments
2. Applies one event type
3. Returns new state

**Supported events (v1):**

| Event | Transform |
|-------|-----------|
| `unemployment` | Member employment → `{ type: 'none' }` |
| `employment` | → `{ type: 'regular', grossMonthly, taxClass, ... }` |
| `part-time-employment` | → regular with `hoursPerWeek ≤ 30` |
| `minijob` | → `{ type: 'minijob', grossMonthly }` |
| `midijob` | → `{ type: 'midijob', grossMonthly, taxClass }` |
| `child-added` | Append child member + none employment |
| `child-removed` | Remove child by index |
| `household-composition` | Rebuild members from maritalStatus + children |
| `rent-change` | Update `housing.coldRent` |
| `partner-employment-change` | Set partner employment |

---

## 7. Scenario Grid Design

**File:** `shared-services/financial/simulator/scenario-grid.ts`

```typescript
runScenarioGrid(input):
  1. baselineResult = benefitsEngine.evaluateScenario(baselineScenario, baselineHousehold, params)
  2. for each scenarioDefinition:
       transformed = applyEventsToBaseline(baseline, events)  // immutable
       result = benefitsEngine.evaluateScenario(scenario, transformed.household, params)
  3. comparisons = scenarioResults.map(r => compareScenarios(baselineResult, r))
  4. analysis = buildComparisonSummary + buildRiskWarnings + buildRecommendations
  5. return SimulatorGridOutput
```

**Not used:** `financialPipeline` directly — the simulator needs N scenarios, not baseline+proposed pair. However, each scenario evaluation uses the same engines as `financialPipeline`.

---

## 8. Shared Services Extensions

### Added

| Export | Purpose |
|--------|---------|
| `runScenarioGrid` | Multi-scenario evaluation entry point |
| `applyEventsToBaseline` | Pure event transforms |
| `describeEvents` | Event type labels for output |
| `SimulatorGridInput/Output` | Shared orchestration types |

### Reused (unchanged)

| Export | Usage |
|--------|-------|
| `benefitsEngine.evaluateScenario` | Every scenario evaluation |
| `payrollEngine` | Via benefitsEngine |
| `compareScenarios` | Baseline vs each scenario |
| `DISCLAIMER` | From decision-engine |
| `buildHouseholdFromLegacy` | Profile merge helper |
| `resolveEmploymentsForLegacyInput` | Profile employment inference |

### Not duplicated

- `calculateBuergergeld`
- `calculateEmploymentFreibetrag`
- `decisionEngine` (simulator uses lighter `analysis.ts` for transition-specific warnings)

---

## 9. Profile Integration

### Policy (`BENEFITS_SIMULATOR_POLICY`)

Allowed: `employment`, `household`, `housing`, `location`, `benefits`  
Sensitive (redacted from slice): `employment.grossMonthlyIncome`, `housing.monthlyColdRent`

### Input merge flow

```
POST /api/modules/benefits-simulator/execute
  → resolveExecutionContext()
      → mergeBenefitsSimulatorInputFromProfile(requestInput, policyDocument)
      → module receives { household, baselineEmployments, scenarios }
  → benefitsSimulatorModule.execute(mergedInput, context)
```

Module never imports `@arrival-atlas/profile`.

---

## 10. Test Strategy

| Layer | Tests | Coverage |
|-------|-------|----------|
| `event-transform.test.ts` | 4 | Immutability, unemployment, minijob, rent, child |
| `scenario-grid.test.ts` | 2 | Multi-scenario grid, Bürgergeld recipient + minijob |
| `benefits-simulator.test.ts` | 3 | Output contract, financial-reality parity, immutability |
| Profile/input-merger | Existing suite | No regression (44 pass) |
| API | Existing suite | No API changes (3 pass) |

### Parity test (critical)

`benefits-simulator.test.ts` verifies minijob scenario produces **identical** gross and Bürgergeld vs `financialPipeline.run()` with `proposedGrossIncome: 450` on unemployed baseline.

---

## 11. Output Contract

| Field | Source |
|-------|--------|
| `baseline` | `ScenarioResult` mapped to summary |
| `scenarios[]` | Each scenario vs baseline |
| `comparison` | `buildComparisonSummary()` |
| `riskWarnings` | `buildRiskWarnings()` — Meldepflicht, benefit cliff, rent |
| `recommendations` | `buildRecommendations()` — viable/risky scenarios |
| `meta.confidence` | Bundesland / Mietstufe heuristics |
| `meta.disclaimer` | Shared `DISCLAIMER` constant |
| `summary` | Plain-language best-scenario sentence |

---

## 12. Files Changed

### New — shared-services

- `packages/shared-services/src/financial/simulator/types.ts`
- `packages/shared-services/src/financial/simulator/event-transform.ts`
- `packages/shared-services/src/financial/simulator/scenario-grid.ts`
- `packages/shared-services/src/financial/simulator/analysis.ts`
- `packages/shared-services/src/financial/simulator/index.ts`
- `packages/shared-services/src/financial/simulator/*.test.ts`

### New — modules

- `packages/modules/src/benefits-simulator/index.ts`
- `packages/modules/src/benefits-simulator/schema.ts`
- `packages/modules/src/benefits-simulator/adapter.ts`
- `packages/modules/src/benefits-simulator/orchestrator.ts`
- `packages/modules/src/benefits-simulator/benefits-simulator.test.ts`

### New — profile

- `packages/profile/src/engine/benefits-simulator-input-merge.ts`

### Modified

- `packages/shared-services/src/financial/index.ts`
- `packages/modules/src/index.ts`
- `packages/profile/src/engine/input-merger.ts`
- `packages/profile/src/policy/module-profile-policy-registry.ts`
- `packages/profile/package.json`

### Unchanged (by design)

- `resolveExecutionContext()` structure
- `financial-reality` module
- API routes
- `AppContextSchema`
- `ModuleRegistry` interface

---

## 13. Usage Example

```bash
curl -X POST http://localhost:3001/api/modules/benefits-simulator/execute \
  -H 'Content-Type: application/json' \
  -H 'X-Session-Id: <session-id>' \
  -d '{
    "input": {
      "household": {
        "members": [{ "id": "applicant", "role": "applicant", "age": 30, "taxClass": 1 }],
        "housing": { "coldRent": 800, "utilities": 0, "bundesland": "BE" },
        "currentBenefits": { "receivingBuergergeld": true }
      },
      "baselineEmployments": { "applicant": { "type": "none" } },
      "scenarios": [
        {
          "id": "minijob-450",
          "label": "Minijob €450",
          "events": [{ "type": "minijob", "grossMonthly": 450 }]
        }
      ]
    },
    "context": {}
  }'
```

With bound profile, `household` and `baselineEmployments` can be omitted — merged via `resolveExecutionContext()`.

---

## Verdict

Benefits Simulator M1 is **complete and architecturally compliant**. It adds multi-scenario life-transition simulation without duplicating financial engines, preserves immutable scenario semantics, and integrates with the Profile Engine through the established merge pipeline only.

**Next steps:** Web UI page, golden scenario fixtures, localized output strings.
