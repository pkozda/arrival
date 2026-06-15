# MVP-R1 — Profile Merge Strategy Port

**Date:** June 2026  
**Refactor ID:** MVP-R1  
**Status:** Completed  
**Related audit:** `docs/audits/platform-architecture-audit.md` (MVP-R1)

---

## Summary

Removed the **Profile Engine → Shared Services (Financial)** dependency by introducing a **module-driven merge strategy registry**. Profile Engine orchestrates merge resolution only; Benefits Simulator owns its domain-specific merge logic.

**Success criterion met:** `@arrivalos/profile` contains **zero** imports of financial or benefits-specific code.

---

## 1. Dependency Analysis

### 1.1 Imports removed from `@arrivalos/profile`

| Source file | Imported symbol | Purpose | Domain-specific? |
|-------------|-----------------|---------|:----------------:|
| `engine/benefits-simulator-input-merge.ts` | `Employment` (type) | Type baseline employment map defaults | **Yes** — Financial |
| `engine/benefits-simulator-input-merge.ts` | `buildHouseholdFromLegacy` | Build v2 household from profile slices | **Yes** — Financial / Housing |
| `engine/benefits-simulator-input-merge.ts` | `resolveEmploymentsForLegacyInput` | Derive employments from profile employment | **Yes** — Financial / Employment |
| `engine/input-merger.ts` | `mergeBenefitsSimulatorInputFromProfile` | Benefits-simulator profile hydration | **Yes** — Benefits |
| `engine/input-merger.ts` | `ensureBenefitsSimulatorEmployments` | Default employments per household member | **Yes** — Benefits |
| `package.json` | `@arrivalos/shared-services` | Package dependency for above | **Yes** — Financial |

### 1.2 Remaining profile imports (non-domain)

| Source file | Imported package | Domain-specific? |
|-------------|------------------|:----------------:|
| All engine/policy/trace files | `@arrivalos/core` | No — platform contract |
| `engine/input-merger.ts` | `MODULE_INPUT_CONFIG` field resolvers | **Partially** — maps profile fields to module input keys for `financial-reality` and `healthcare-navigation` without importing financial types |

> **Note:** `MODULE_INPUT_CONFIG` still contains field mappings for financial-reality and healthcare-navigation. These are **declarative profile→input projections** (no financial engine imports). Full extraction to module-owned strategies is **MVP-R8** (Beta), not MVP-R1 scope.

### 1.3 Verification

```bash
rg '@arrivalos/shared-services|benefits-simulator-input-merge|financial/' packages/profile
# → no matches
```

---

## 2. Merge Strategy Contract

### 2.1 Interface

```typescript
interface ModuleMergeStrategy {
  moduleId: string;
  merge(params: MergeModuleInputParams, trace?: TraceCollector): MergeModuleInputResult;
}
```

Located in `packages/profile/src/merge/types.ts`.

### 2.2 Registry

| Function | Purpose |
|----------|---------|
| `registerModuleMergeStrategy(strategy)` | Module packages register at startup |
| `getModuleMergeStrategy(moduleId)` | Profile Engine resolves by moduleId |
| `unregisterModuleMergeStrategy(moduleId)` | Remove single strategy |
| `clearModuleMergeStrategies()` | Test helper |

Located in `packages/profile/src/merge/registry.ts`.

### 2.3 Resolution order in `mergeModuleInput()`

```
1. getModuleMergeStrategy(moduleId)  →  if found, delegate to strategy.merge()
2. MODULE_INPUT_CONFIG[moduleId]       →  declarative field merge (financial-reality, healthcare-navigation)
3. Passthrough                         →  return requestInput with input provenance only
```

`resolveExecutionContext()` flow is **unchanged externally** — still calls `mergeModuleInput(moduleId, ...)`.

---

## 3. Architecture Diagrams

### 3.1 Old dependency graph

```
┌─────────────────┐
│   apps/api      │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌─────────┐ ┌─────────┐
│ profile │ │ modules │
└────┬────┘ └────┬────┘
     │           │
     ▼           ▼
┌─────────────────────┐
│  shared-services    │
│  (financial engine) │
└─────────────────────┘
     ▲
     │  ❌ BOUNDARY VIOLATION
     │
┌─────────┐
│ profile │──imports buildHouseholdFromLegacy, resolveEmploymentsForLegacyInput
└─────────┘
```

### 3.2 New dependency graph

```
┌─────────────────┐
│   apps/api      │
└────────┬────────┘
         │
    ┌────┴────────────────┐
    ▼                     ▼
┌─────────┐         ┌─────────┐
│ profile │◄────────│ modules │
│ (merge  │ register│         │
│ registry│ strategy└────┬────┘
└────┬────┘              │
     │                   ▼
     │            ┌─────────────────────┐
     ▼            │  shared-services    │
┌─────────┐       │  (financial engine) │
│  core   │       └─────────────────────┘
└─────────┘

Profile Engine
      ↓
Merge Strategy Interface (ModuleMergeStrategy)
      ↓
Module-provided Merge Strategy (benefits-simulator/merge-strategy.ts)
      ↓
Shared Services (financial helpers — domain concern)
```

**Desired direction achieved:** Profile → Interface → Module Strategy → Financial implementation.

---

## 4. Files Changed

| Action | Path |
|--------|------|
| **Added** | `packages/profile/src/merge/types.ts` |
| **Added** | `packages/profile/src/merge/registry.ts` |
| **Added** | `packages/profile/src/merge/index.ts` |
| **Added** | `packages/modules/src/benefits-simulator/merge-strategy.ts` |
| **Added** | `packages/modules/src/benefits-simulator/merge-strategy.test.ts` |
| **Modified** | `packages/profile/src/engine/input-merger.ts` — strategy delegation |
| **Modified** | `packages/profile/src/index.ts` — export merge port |
| **Modified** | `packages/profile/package.json` — removed `@arrivalos/shared-services` |
| **Modified** | `packages/modules/src/index.ts` — `registerAllMergeStrategies()` |
| **Modified** | `packages/modules/package.json` — added `@arrivalos/profile` |
| **Deleted** | `packages/profile/src/engine/benefits-simulator-input-merge.ts` |

**Unchanged (by design):**

- `resolveExecutionContext()` signature and behavior
- `ModuleRegistry` API
- `AppContextSchema`
- API routes (`POST /api/modules/:id/execute`, `GET /api/modules/:id/trace`)
- Benefits Simulator module execute logic

---

## 5. Architectural Rationale

### Why a registry, not events?

MVP-R1 requires **synchronous, deterministic merge** at request time. A merge strategy registry preserves the existing `resolveExecutionContext()` pipeline without introducing async infrastructure (explicitly out of scope).

### Why register from `@arrivalos/modules`?

Profile cannot import modules (would invert the dependency). Modules already load at API startup via `registerAllModules()`. Co-locating `registerAllMergeStrategies()` ensures merge strategies are available before any module execute call.

### Why not extract `domain-financial`?

Out of scope per MVP-R1 constraints. Financial helpers remain in `@arrivalos/shared-services`; only the **call site** moved from profile to modules.

---

## 6. Remaining Technical Debt

| ID | Item | Target |
|----|------|--------|
| TD-R1-01 | `MODULE_INPUT_CONFIG` for `financial-reality` still in profile | MVP-R8 / Beta — extract to module strategy |
| TD-R1-02 | `MODULE_INPUT_CONFIG` for `healthcare-navigation` still in profile | MVP-R8 / Beta |
| TD-R1-03 | Benefits-simulator merge does not emit trace steps (`MERGE_DECISION`, `FINAL_VALUE`) | Pre-existing; optional enhancement |
| TD-R1-04 | Duplicate profile test dirs (`engine 2/`, etc.) | Platform hygiene (P2) |
| TD-R1-05 | `registerAllMergeStrategies()` must be called before execute — no compile-time enforcement | Document; consider startup assertion in API |
| TD-R1-06 | Extract `@arrivalos/domain-financial` from shared-services | Beta-R1 |

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|:----------:|:------:|------------|
| Merge strategy not registered before execute | Low | High — benefits-simulator gets empty input | `registerAllMergeStrategies()` called inside `registerAllModules()` |
| Behavioral regression in benefits merge | Low | High | 4 merge-strategy tests + 13 golden scenarios unchanged |
| Circular package dependency | Low | High | profile does not import modules |
| Profile tests pass without strategies | N/A | Low — profile tests only cover financial-reality declarative merge | By design |
| New module forgets to register strategy | Medium | Medium | Document pattern; Beta startup validation |

**Overall risk:** **Low** — mechanical relocation with registry indirection; no algorithm changes.

---

## 8. Regression Checklist

| Check | Status |
|-------|:------:|
| `@arrivalos/profile` has zero `@arrivalos/shared-services` imports | ✅ |
| `benefits-simulator-input-merge.ts` deleted from profile | ✅ |
| `npm run build` succeeds | ✅ |
| Profile tests (44) pass | ✅ |
| Shared-services tests (31) pass | ✅ |
| Modules tests (26) pass — including merge-strategy + golden scenarios | ✅ |
| API tests pass | ✅ (verified in full test run) |
| `financial-reality` declarative merge unchanged | ✅ |
| `benefits-simulator` merge logic byte-equivalent (moved, not rewritten) | ✅ |
| `registerAllModules()` registers merge strategies | ✅ |
| Public API contracts unchanged | ✅ |
| Trace generation path unchanged | ✅ |
| Provenance output for benefits-simulator unchanged | ✅ |

---

## 9. How to Add a Merge Strategy (Module Authors)

1. Implement `ModuleMergeStrategy` in your module package.
2. Import domain helpers from `@arrivalos/shared-services` or future domain packages — **not** from profile.
3. Call `registerModuleMergeStrategy(yourStrategy)` from `registerAllMergeStrategies()` in `packages/modules/src/index.ts` (or module-specific registration helper).

Example: `packages/modules/src/benefits-simulator/merge-strategy.ts`.

---

*End of MVP-R1 refactor report.*
