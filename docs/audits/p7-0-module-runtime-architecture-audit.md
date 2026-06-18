# P7.0 — Module Runtime Architecture Audit

**Project:** Arrival Atlas (ArrivalOS)  
**Document Type:** Architecture Audit Report  
**Domain:** Module Runtime Platform (MRC)  
**Status:** Initial Audit  
**Version:** 1.0  
**Date:** June 2026  

**Baseline:** IAM Phase 3.1.2 complete (150/150 API tests, 8/8 web tests)  
**Reference documents:**

- [Module Runtime Contract v1.0 — Specification](../architecture/module-runtime-contract-v1-specification.md)
- [Module Runtime Contract v1.0 — Evolution Roadmap](../architecture/module-runtime-evolution-roadmap.md)
- [Financial Module v2 — Architecture Notes](../architecture/financial-module-v2-notes.md)
- [User Profile Engine Runtime Unification Report](./user-profile-engine-runtime-unification-report.md)
- [P5.0 — Full System Architecture Audit](./p5-0-full-system-architecture-audit.md)

**Scope:** Read-only audit of module execution stack across `packages/core`, `packages/modules`, `packages/profile`, `packages/ux`, `packages/shared-services`, `apps/api`, `apps/web`. No code changes performed.

---

## 1. Executive Summary

Arrival Atlas has a **working but informal** module execution stack. Financial Reality and Benefits Simulator execute successfully through a shared registry, Profile Engine context resolution, and DPSS persistence — but they do **not** yet conform to Module Runtime Contract v1.0.

### MRC Readiness Score

| Area | Score | Notes |
|------|-------|-------|
| **Financial Reality** | **52 / 100** | Strong domain engine; weak envelope, explanation, trace |
| **Benefits Simulator** | **48 / 100** | Rich output schema; ignores context; no UX path |
| **Registry** | **61 / 100** | Solid bootstrap; missing capabilities, envelope, kernel |
| **UI Snapshot** | **55 / 100** | Snapshot-driven UI exists; stores opaque domain payloads |
| **DPSS** | **58 / 100** | Stable mutation model; result/trace shapes need evolution |
| **Overall platform** | **55 / 100** | Foundations exist; contract formalization not started |

### Verdict

| Question | Answer |
|----------|--------|
| Can we start MRC-1 (Runtime Foundations) immediately? | **Yes** — types and adapter layer can be added without breaking behavior |
| Can Financial Reality / Benefits Simulator adopt MRC with adapters only? | **Partially** — input/schemas migrate easily; output envelope and explanation model require structural changes |
| Is a big-bang migration required? | **No** — dual-read projection adapter can bridge legacy `result` payloads |
| Highest-risk migration surface? | **DPSS stored executions + web snapshot selectors** |

**Recommended next step:** Phase **MRC-1** — introduce `@arrivalos/module-runtime` types and `toModuleRuntimeContext()` adapter; no module rewrites until MRC-2.

---

## 2. Audit Methodology

| Area | Method |
|------|--------|
| Module purity | Trace imports in `packages/modules/**`; verify no DPSS/Fastify dependencies |
| Execution path | Trace `POST /api/modules/:id/execute` from `build-app.ts` through registry to DPSS |
| Context contract | Compare `AppContext` usage vs MRC `ModuleRuntimeContext` |
| Output shape | Compare domain schemas vs MRC `ModuleResult` envelope |
| Trace coverage | Inspect `ExecutionTrace` steps vs MRC `ModuleTrace` |
| UI consumption | Trace `buildUiSnapshot()` → web `getModuleUIState()` → module pages |
| Determinism | Search for `Date.now()`, `new Date()` in module and engine paths |
| Registry | Inspect `ModuleRegistry` API vs MRC `ModuleRegistry` contract |

---

## 3. Current Execution Architecture

```text
POST /api/modules/:id/execute                    apps/api/build-app.ts
        │
        ├─ entitlementService.assertModuleExecutionAllowed()
        │
        ▼
resolveExecutionContext()                        packages/profile
  · profile load + policy + input merge
  · buildAppContext()
  · ExecutionTrace (profile steps only)
        │
        ▼
globalRegistry.execute(id, mergedInput, context) packages/core
  · Zod input/output validation
  · module.execute(input, AppContext)
  · returns ModuleExecutionResult { success, data, error }
        │
        ▼
systemStateCoordinator.applyMutation(MODULE_EXECUTE)
  · stores result.data (raw domain output)
  · stores ExecutionTrace
  · profile activation side-effect (financial-reality, healthcare-navigation)
        │
        ▼
attachUxToExecutionResult()                      apps/api/ux-integration.ts
  · post-hoc UXActionPlan from raw domain output
        │
        ▼
buildUiSnapshot(state)                           apps/api/state/snapshot-projection-engine.ts
  · executions[].result = raw domain output
  · uxSnapshot from buildUXActionPlan(latest executions)
```

**Key observation:** The runtime kernel described in MRC §4 does not exist as a package. Orchestration lives in `apps/api/build-app.ts`; contract types are split across `@arrivalos/core`, `@arrivalos/profile`, and per-module schemas.

---

## 4. Financial Reality — MRC Gap Analysis

**Location:** `packages/modules/src/financial-reality/`  
**Engine:** `packages/shared-services/src/financial/` (v2 pipeline + v1 legacy)  
**Registry ID:** `financial-reality` v2.0.0

### 4.1 What Already Aligns with MRC

| MRC requirement | Current implementation | Status |
|-----------------|------------------------|--------|
| **R-SE-1** No DPSS writes in module | Pure `execute()`; persistence in API coordinator | ✅ |
| **R-SE-3** No network I/O | Local calculation only | ✅ |
| **R-UI-1** No UI rendering | Returns data structures only | ✅ |
| Zod input/output validation | `FinancialRealityInputSchema`, `FinancialRealityOutputSchema` | ✅ |
| Registry registration | `financialRealityRegistration` via `registerAllModules()` | ✅ |
| Profile policy | `FINANCIAL_REALITY_POLICY` in profile engine | ✅ |
| Profile input merge | `MODULE_INPUT_CONFIG['financial-reality']` in `input-merger.ts` | ✅ |
| Context read (partial) | `resolveFinancialProfileContext()` reads `profileSlice` | ✅ |
| Recommendations (partial) | `decisions[]` with title, description, priority | ⚠️ Legacy shape |
| Explainability (partial) | `benefits.buergergeld.reasoning: string[]` | ⚠️ Unstructured |
| Confidence metadata | `meta.confidence`, `meta.disclaimer` (v2 path) | ⚠️ Inside payload, not envelope |
| Scenario support | v2 `comparison`, `scenarios`, `verdict` | ⚠️ Typed as `z.any()` |
| Domain separation | Calculation in `@arrivalos/shared-services` | ✅ |
| Golden tests | Fixtures in `packages/shared-services` | ✅ |

### 4.2 What Must Be Rewritten or Migrated

| Gap | Current code | MRC target | Phase | Effort |
|-----|--------------|------------|-------|--------|
| Context type | `execute(input, context: AppContext)` | `ModuleRuntimeContext` | MRC-1/2 | Low — adapter |
| Output envelope | Raw `FinancialRealityOutput` | `ModuleResult<FinancialPayload>` | MRC-2 | Medium |
| Recommendations | `decisions[]` with optional `action: string` | `Recommendation[]` + `ModuleExplanation` | MRC-3 | Medium |
| Reasoning | `reasoning: string[]` | `ExplanationFactor[]` | MRC-3 | Medium |
| Actions | Embedded in `decisions[].action` | `ActionItem[]` with `ActionKind` | MRC-4 | Medium |
| Module trace | No engine steps recorded | `ENGINE_STEP` trace entries | MRC-2 | Medium |
| UX actions | Parsed from `adminRules` strings in `packages/ux` | Declared in `ModuleResult.actions` | MRC-4/6 | High |
| Determinism | `calculatedAt: new Date()` in `financial-pipeline.ts` | Timestamp from runtime context | MRC-2 | Low |
| Weak typing | `comparison: z.any()`, `scenarios: z.any()` | Typed payload or moved to envelope meta | MRC-2 | Low |
| Runtime mutation | `setAdvancedTaxScenarios()` module-global flag | Registry `featureFlags` only | MRC-5 | Low |
| Capabilities | Not declared | `ModuleCapabilities` with `requires-profile`, `produces-recommendations`, `supports-scenarios` | MRC-1 | Low |
| `runtimeContractVersion` | Absent | `'1.0'` on metadata | MRC-1 | Trivial |

### 4.3 Financial Reality — Migration Map

```text
Phase MRC-1 (no behavior change)
  └─ Add ModuleCapabilities declaration
  └─ Add toModuleRuntimeContext() adapter at registry boundary

Phase MRC-2
  └─ Wrap output in ModuleResult envelope
  └─ Promote meta.confidence → result.meta.confidence
  └─ Pass executedAt from runtime (remove new Date() from engine meta)
  └─ Add INPUT_VALIDATED / OUTPUT_VALIDATED / ENGINE_STEP to trace

Phase MRC-3
  └─ Migrate decisions[] → recommendations[]
  └─ Migrate reasoning[] → explanation.factors[]
  └─ Add explanation.summary per recommendation

Phase MRC-4
  └─ Migrate decisions[].action strings → ActionItem[]
  └─ Remove normalizeFinancialReality() string parsing in packages/ux

Phase MRC-6
  └─ Web reads result.payload.income instead of result.income
  └─ ModuleResultRenderer reads result.recommendations
```

### 4.4 Files Touched (Estimated)

| File | Change type |
|------|-------------|
| `packages/modules/src/financial-reality/index.ts` | Envelope wrapper, context type |
| `packages/modules/src/financial-reality/profile-context.ts` | Use typed `ModuleRuntimeContext.profileSlice` |
| `packages/shared-services/src/financial/pipeline/financial-pipeline.ts` | Inject `calculatedAt` from caller |
| `packages/ux/src/ux-orchestrator.ts` | Deprecate `normalizeFinancialReality()` |
| `apps/web/src/app/modules/financial-reality/page.tsx` | Read `payload` + `recommendations` |
| `apps/api/src/build-app.ts` | Route through `ModuleRuntime.execute()` |

---

## 5. Benefits Simulator — MRC Gap Analysis

**Location:** `packages/modules/src/benefits-simulator/`  
**Engine:** `packages/shared-services/src/financial/simulator/`  
**Registry ID:** `benefits-simulator` v1.0.0  
**Web UI:** None (API-only module)

### 5.1 What Already Aligns with MRC

| MRC requirement | Current implementation | Status |
|-----------------|------------------------|--------|
| **R-SE-1** No DPSS writes | Pure orchestrator | ✅ |
| **R-SE-3** No network I/O | Local grid simulation | ✅ |
| Zod schemas | `BenefitsSimulatorInputSchema`, `BenefitsSimulatorOutputSchema` | ✅ |
| Registry registration | `benefitsSimulatorRegistration` | ✅ |
| Profile policy | `BENEFITS_SIMULATOR_POLICY` | ✅ |
| Profile merge | Dedicated `benefitsSimulatorMergeStrategy` | ✅ |
| Scenario support | `scenarios[]`, `baseline`, `comparison` | ✅ |
| Recommendations (partial) | `recommendations[]` with `rationale` | ⚠️ Custom schema |
| Risk warnings | `riskWarnings[]` with severity, category | ⚠️ Custom schema |
| Confidence | `meta.confidence` | ⚠️ Inside payload |
| Schema versioning | `meta.schemaVersion: '1.0.0'` | ✅ |
| Golden tests | `golden-scenarios.test.ts` + fixtures | ✅ |

### 5.2 What Must Be Rewritten or Migrated

| Gap | Current code | MRC target | Phase | Effort |
|-----|--------------|------------|-------|--------|
| Context ignored | `execute(input, _context)` | Read `profileSlice` when relevant | MRC-2 | Low |
| Output envelope | Raw `BenefitsSimulatorOutput` | `ModuleResult<BenefitsPayload>` | MRC-2 | Medium |
| Recommendations | Custom `recommendations[]` schema | MRC `Recommendation[]` + `ModuleExplanation` | MRC-3 | Medium |
| Risk warnings | Separate `riskWarnings[]` | Merge into `Recommendation[]` (severity preserved) | MRC-3 | Medium |
| Actions | `riskWarnings[].action` free strings | `ActionItem[]` with `ActionKind` | MRC-4 | Medium |
| Rationale | `rationale: string` | `explanation: ModuleExplanation` | MRC-3 | Medium |
| Module trace | None | `ENGINE_STEP` per scenario grid phase | MRC-2 | Medium |
| UX integration | `normalizeModuleOutput` default → `[]` | Full UX from `ModuleResult.actions` | MRC-4/6 | Medium |
| Profile activation | Not in `moduleInputToProfilePatch` | Evaluate if execute should write profile | Out of MRC | TBD |
| Input merge location | Merge in profile engine, ignored in module | Module may validate context-assisted defaults | MRC-2 | Low |
| Determinism | `calculatedAt: new Date()` in `scenario-grid.ts` | Runtime-provided timestamp | MRC-2 | Low |
| Capabilities | Not declared | `supports-scenarios`, `produces-recommendations`, `requires-profile` | MRC-1 | Low |

### 5.3 Benefits Simulator — Migration Map

```text
Phase MRC-1
  └─ Declare ModuleCapabilities
  └─ Document profile merge as upstream concern (already correct)

Phase MRC-2
  └─ Wrap in ModuleResult envelope
  └─ Accept ModuleRuntimeContext (even if read-only validation)
  └─ Engine timestamp injection

Phase MRC-3
  └─ Normalize recommendations[] + riskWarnings[] → Recommendation[]
  └─ Convert rationale → explanation.factors

Phase MRC-4
  └─ riskWarnings[].action → ActionItem[]
  └─ Add normalizeBenefitsSimulator or remove UX normalizer entirely

Phase MRC-6
  └─ Add web page consuming snapshot result.payload / result.recommendations
```

### 5.4 Structural Advantage

Benefits Simulator is **closer to MRC-3/4 semantically** than Financial Reality: it already has structured `recommendations[]`, `riskWarnings[]`, and `summary`. Migration is primarily **renaming and envelope wrapping**, not inventing new concepts.

---

## 6. Registry — Keep vs Replace

**Location:** `packages/core/src/registry/index.ts`

### 6.1 Keep (Reuse in MRC-5)

| Component | Rationale |
|-----------|-----------|
| `ModuleRegistry` class | Map-based registration, lookup, list — sound foundation |
| `register()` / `get()` / `list()` | Bootstrap pattern works |
| `globalRegistry` singleton | Used by API and tests |
| `registerAllModules()` in `packages/modules` | Central registration point |
| Zod validation in `execute()` | Matches MRC input/output validation rules |
| `trackEvent()` instrumentation | Aligns with auditability goals |
| `featureFlags` on registration | Maps to capabilities feature gating |
| `enabled` toggle | Operational concern, keep |
| `Module` interface shape | Extend, don't replace |

### 6.2 Replace or Extend

| Component | Current | MRC target | Action |
|-----------|---------|------------|--------|
| Return type | `ModuleExecutionResult<T>` | `ModuleResult<T>` | **Extend** — new envelope type |
| Context param | `AppContext` | `ModuleRuntimeContext` | **Adapter** at kernel boundary |
| Metadata | No `runtimeContractVersion` | Required `'1.0'` | **Add field** |
| Capabilities | Absent | `ModuleCapabilities` per module | **Add** |
| Bootstrap validation | None | `validateRegistrations()` | **Add** |
| Registry mutability | `setEnabled()`, `setFeatureFlag()` mutable | Frozen after bootstrap (optional) | **Harden** (MRC-7) |
| Execution entry | `globalRegistry.execute()` called from API | `ModuleRuntime.execute()` only | **Extract kernel** |
| `getCapabilities()` | N/A | Required on registry | **Add** |
| Module definition | `Module` + separate `ModuleRegistration` | `ModuleDefinition` with embedded capabilities | **Merge types** |

### 6.3 Registry Migration Sequence

```text
MRC-1: Add @arrivalos/module-runtime package
       ModuleRuntime wraps existing ModuleRegistry.execute()
       AppContext → ModuleRuntimeContext adapter

MRC-5: Move registry to module-runtime package (or re-export)
       Add validateRegistrations() at buildApp bootstrap
       Freeze registry after registerAllModules()

MRC-7: Contract test — API must not call globalRegistry.execute() directly
```

### 6.4 Risk: `setAdvancedTaxScenarios()`

Financial Reality mutates engine selection via module-level state (`useV2Engine`) and `registration.featureFlags` simultaneously. MRC requires feature flags to be the single source of truth read by the runtime kernel.

**Action:** Remove module-global `useV2Engine`; read `registration.featureFlags.advancedTaxScenarios` inside `execute()`.

---

## 7. UI Snapshot — Field Compatibility

**Location:** `apps/api/src/state/snapshot-projection-engine.ts`, `apps/web/src/lib/snapshot/`

### 7.1 Compatible Fields (No Change)

These snapshot fields remain valid under MRC:

| Field | Notes |
|-------|-------|
| `schemaVersion` | Snapshot schema version; increment on MRC-6 |
| `snapshotVersion` | DPSS monotonic version — unchanged |
| `lastMutationId` | Unchanged |
| `generatedAt` | Unchanged |
| `session.*` | Session projection — unchanged |
| `profile` | Profile document projection — unchanged |
| `modules[]` | Module catalog — unchanged |
| `executions[].moduleId` | Unchanged |
| `executions[].executionId` | Unchanged |
| `executions[].timestamp` | Unchanged |
| `executions[].snapshotVersion` | Unchanged |
| `executionsByModuleId` | Key structure unchanged |
| `ftu` | First-time user state — unchanged |

### 7.2 Incompatible Fields (Breaking After MRC-6)

| Field | Current shape | MRC shape | Consumer impact |
|-------|---------------|-----------|-----------------|
| `executions[].result` | Raw domain object (`FinancialRealityOutput`, etc.) | `ModuleResult` envelope | **Breaking** — all module pages |
| `executions[].result.income` | Top-level domain field | `result.payload.income` | **Breaking** — `financial-reality/page.tsx` |
| `executions[].result.decisions` | Top-level array | `result.recommendations` | **Breaking** — page + `ModuleResultRenderer` |
| `executions[].result.benefits` | Top-level | `result.payload.benefits` | **Breaking** |
| `executions[].result.recommendations` | Benefits custom schema | MRC `Recommendation[]` at envelope | **Breaking** — field name collision with different shape |
| `uxSnapshot.actionCards` | `UXActionCard[]` from post-hoc orchestrator | Derived from `ModuleResult.actions` | **Shape drift** — `source` field may change |
| `uxSnapshot.prioritySignals` | `UXNormalizedSignal[]` | Derived from `ModuleResult.explanation` | **Semantic drift** |

### 7.3 API Execute Response Incompatibilities

| Field | Current (`apps/web/src/lib/api.ts`) | MRC target |
|-------|-------------------------------------|------------|
| `success: boolean` | Present | `status: 'success' \| 'validation_error' \| 'execution_error'` |
| `data?: T` | Present | `payload?: T` |
| `ux?: UxPayload` | Attached post-execute | Deprecated → `result.actions` |
| `moduleId`, `version`, `executedAt` | Top-level on response | Inside `result.meta` |
| Missing | — | `result.meta.executionId`, `confidence`, `runtimeContractVersion` |

**Compatibility strategy (MRC-2):** API may emit both shapes during transition:

```typescript
// Transitional response (one release)
{
  status: 'success',
  payload: { ... },
  success: true,      // deprecated alias
  data: { ... },      // deprecated alias
}
```

### 7.4 Web Client Impact Map

| File | Current assumption | Required change |
|------|-------------------|-----------------|
| `apps/web/src/lib/api.ts` | `ModuleResult { success, data }` | Align with MRC envelope |
| `apps/web/src/lib/snapshot/to-module-result.ts` | Synthesizes fake `ModuleResult` from snapshot | Read real envelope from snapshot |
| `apps/web/src/lib/snapshot/selectors/get-module-ui-state.ts` | `result = execution?.result` as domain | `result = execution?.result.payload` |
| `apps/web/src/lib/snapshot/selectors/get-module-ux.ts` | Reads `uxSnapshot` global | Read `execution.result.actions` |
| `apps/web/src/app/modules/financial-reality/page.tsx` | `FinancialResult` interface on raw result | `ModuleResult<FinancialPayload>` |
| `apps/web/src/components/ModuleResultRenderer.tsx` | Renders domain-specific children | Render `recommendations` + `payload` |

### 7.5 Dual-Read Adapter (Recommended)

Until all stored executions are migrated, projection should support:

```typescript
function unwrapExecutionResult(stored: unknown): ModuleResult {
  if (isModuleResultEnvelope(stored)) return stored;
  return legacyDomainToModuleResult(stored); // adapter per moduleId
}
```

This avoids breaking existing `.arrivalos-state/*.json` files on disk.

---

## 8. DPSS — Storage Structure Changes

**Location:** `apps/api/src/state/system-state-types.ts`, `system-state-apply.ts`

### 8.1 Current Storage Model

```typescript
// system-state-types.ts
type StoredModuleExecution = {
  moduleId: string;
  result: unknown;              // ← raw domain output only
  timestamp: number;
  executionId: string;
  snapshotVersion: number;
};

type SystemState = {
  executionsByModuleId: Record<string, StoredModuleExecution[]>;
  executionTracesByModuleId: Record<string, ExecutionTrace[]>;
  // ... session, profile, events, version
};
```

**What is stored today on execute** (`build-app.ts` line 196–207):

```typescript
await systemStateCoordinator.applyMutation({
  type: 'MODULE_EXECUTE',
  result: result.data,           // domain payload ONLY
  trace: { ...trace, sessionId }, // profile-resolution trace
  executionId,
  executedAt: result.executedAt,
  // ...
});
```

The `ModuleExecutionResult` wrapper (`success`, `moduleId`, `version`, `error`) is **not** persisted.

### 8.2 Target Storage Model (MRC)

```typescript
type StoredModuleExecution = {
  moduleId: string;
  result: ModuleResult;          // full envelope
  timestamp: number;
  executionId: string;
  snapshotVersion: number;
};

type ModuleTrace = {
  traceId: string;
  sessionId: string;
  moduleId: string;
  executionId: string;
  steps: ModuleTraceStep[];      // profile + runtime + engine steps
  startedAt: string;
  completedAt: string;
};

type SystemState = {
  executionsByModuleId: Record<string, StoredModuleExecution[]>;
  executionTracesByModuleId: Record<string, ModuleTrace[]>;
  // unchanged: session, profile, events, version, modules, projectionConfig
};
```

### 8.3 Structures That Change

| Structure | Change | Migration |
|-----------|--------|-----------|
| `StoredModuleExecution.result` | `unknown` → `ModuleResult` | Dual-read adapter in projection |
| `ModuleExecuteMutation.result` | `unknown` → `ModuleResult` | Type update in `system-mutation-types.ts` |
| `ExecutionTrace` | Profile steps only | `ModuleTrace` with `traceId`, `executionId`, timestamps, engine steps |
| `executionTracesByModuleId` values | Short trace | Extended trace per execution |
| `events[]` on MODULE_EXECUTE | `module.execute.success` | Add `executionId` correlation (optional) |

### 8.4 Structures That Do NOT Change

| Structure | Reason |
|-----------|--------|
| `SystemState.session` | IAM/DPSS concern, not MRC |
| `SystemState.profileRecord` | Profile Engine scope |
| `SystemState.profileRevisions` | Profile Engine scope |
| `SystemState.version` | Snapshot versioning unchanged |
| `SystemState.accountId` | IAM scope |
| `SystemState.modules` | Catalog metadata |
| `SystemState.projectionConfig` | UX feature flag stays |
| `SystemState.events` | Event shape compatible |
| Mutation type `MODULE_EXECUTE` | Same mutation; different payload shape |
| File-per-session persistence | `.arrivalos-state/{sessionId}.json` format evolves in-place |

### 8.5 Side Effects Outside MRC (Unchanged but Documented)

`applyModuleExecute()` triggers **profile activation** for `financial-reality` and `healthcare-navigation` via `moduleInputToProfilePatch()`. This is a DPSS coordinator concern, not module behavior — it remains outside MRC scope but must not be broken during migration.

### 8.6 DPSS Migration Phases

```text
MRC-2: Write ModuleResult envelope for new executions
       Keep dual-read for old executions in buildUiSnapshot()

MRC-2: Extend trace with INPUT_VALIDATED, OUTPUT_VALIDATED steps

MRC-3: Store explanation data inside ModuleResult (no separate DPSS field)

MRC-6: Bump UI_SNAPSHOT_SCHEMA_VERSION
       Remove legacy dual-read after backfill window

Optional backfill job:
  For each StoredModuleExecution where result is not ModuleResult:
    wrap with legacyDomainToModuleResult(moduleId, result)
```

---

## 9. Cross-Cutting Findings

### 9.1 Determinism Violations

| Location | Issue | MRC rule |
|----------|-------|----------|
| `financial-pipeline.ts` | `calculatedAt: new Date().toISOString()` | R-DET-2 |
| `scenario-grid.ts` | `calculatedAt: new Date().toISOString()` | R-DET-2 |
| `ModuleRegistry.execute()` | `executedAt: new Date().toISOString()` | Acceptable at runtime kernel level |

**Fix:** Runtime kernel assigns `executedAt` once; engines receive it via context.

### 9.2 UX Layer Architectural Debt

`packages/ux/src/ux-orchestrator.ts` reverse-engineers actions from domain output:

- Financial Reality: parses `adminRules` strings for "Anmeldung", "Krankenkasse"
- Benefits Simulator: **no normalizer** — always returns `[]`
- Healthcare, system-translation: domain-specific parsers

MRC-4/6 eliminates this by requiring modules to emit `ActionItem[]` directly.

### 9.3 Profile Engine (Upstream — Mostly Ready)

| Component | MRC readiness |
|-----------|---------------|
| `resolveExecutionContext()` | ✅ Becomes Runtime Context Builder |
| `ExecutionTrace` | ⚠️ Extend to `ModuleTrace` |
| `ModuleProfilePolicy` | ✅ Maps to `ModuleCapabilities.requiredProfileFields` |
| `mergeModuleInput()` | ✅ Upstream of runtime — keep |
| `input-merger.ts` per-module config | ✅ Keep; benefits uses merge strategy instead |

### 9.4 Other Modules (Out of Scope for Detailed Audit)

| Module | MRC score (estimate) | Notes |
|--------|---------------------|-------|
| `healthcare-navigation` | ~45 | Same gaps as financial; has profile activation |
| `system-translation` | ~40 | Minimal output; UX normalizer only |
| `life-event` | ~42 | Custom output; no explanation model |
| `grocery-optimization` | ~42 | Custom output; no explanation model |

Full MRC-2 migration should treat all six registered modules uniformly.

---

## 10. Migration Roadmap (Consolidated)

Aligned with [Module Runtime Evolution Roadmap](../architecture/module-runtime-evolution-roadmap.md):

| Phase | Financial Reality | Benefits Simulator | Registry | UI Snapshot | DPSS |
|-------|-------------------|--------------------|----------|-------------|------|
| **MRC-1** | Add capabilities declaration | Add capabilities declaration | Wrap in `ModuleRuntime` | No change | No change |
| **MRC-2** | `ModuleResult` envelope | `ModuleResult` envelope | `validateRegistrations()` | Dual-read adapter | Store envelope |
| **MRC-3** | `decisions` → `Recommendation` | Normalize `recommendations` + `riskWarnings` | — | — | Explanation in envelope |
| **MRC-4** | `ActionItem[]` | `ActionItem[]` | — | Deprecate `ux` on execute response | — |
| **MRC-5** | Remove `useV2Engine` global | — | Freeze registry | — | — |
| **MRC-6** | Web reads `payload` | Add web page | — | `schemaVersion` bump | Remove dual-read |
| **MRC-7** | Contract tests | Contract tests | Bootstrap validation tests | Projection tests | Storage schema tests |

### Recommended Execution Order

```text
1. MRC-1  — @arrivalos/module-runtime types + adapter (zero behavior change)
2. MRC-2  — Envelope wrapping + DPSS dual-write/dual-read
3. MRC-3  — Explanation normalization (Financial Reality + Benefits Simulator)
4. MRC-4  — Action framework
5. MRC-6  — Web migration (can overlap with MRC-4)
6. MRC-5  — Registry hardening
7. MRC-7  — Governance tests
```

---

## 11. Risk Register

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| **MR-R1** | Existing DPSS files contain raw domain results | High | Dual-read projection adapter |
| **MR-R2** | Web module pages hardcode domain interfaces | High | Transitional API aliases + typed selectors |
| **MR-R3** | `decisions` vs `recommendations` name collision for Benefits Simulator | Medium | Envelope separates domain payload from MRC recommendations |
| **MR-R4** | UX orchestrator silently drops Benefits Simulator signals | Medium | MRC-4 makes UX derivation explicit from `ModuleResult.actions` |
| **MR-R5** | `calculatedAt` non-determinism breaks golden tests | Low | Inject timestamp from runtime before MRC-7 determinism tests |
| **MR-R6** | Profile activation side-effect coupled to execute mutation | Low | Document as DPSS concern; test in integration suite |
| **MR-R7** | Big-bang rename `data` → `payload` breaks web client | High | Dual-field API response for one release |

---

## 12. Acceptance Checklist (Pre-MRC-1 Exit)

Before starting implementation, confirm:

- [x] Current execution path documented (this audit)
- [x] Financial Reality gap analysis complete
- [x] Benefits Simulator gap analysis complete
- [x] Registry keep/replace decisions made
- [x] UI Snapshot incompatible fields identified
- [x] DPSS storage evolution defined
- [ ] Stakeholder sign-off on dual-read migration strategy
- [ ] `UI_SNAPSHOT_SCHEMA_VERSION` bump number assigned
- [ ] Transitional API response alias policy agreed

---

## 13. Conclusion

The platform is **architecturally ready for MRC-1** without behavioral changes. The hardest migration surfaces are:

1. **DPSS `StoredModuleExecution.result`** — from opaque domain object to `ModuleResult` envelope
2. **Web snapshot selectors** — from `result.income` to `result.payload.income`
3. **UX orchestrator** — from post-hoc string parsing to declared `ActionItem[]`

Financial Reality and Benefits Simulator both have **strong domain engines** in `@arrivalos/shared-services`. MRC migration is primarily **contract wrapping and normalization**, not engine rewrite.

Benefits Simulator is semantically ahead on recommendations but **behind on integration** (no web UI, no UX normalizer, context ignored). Financial Reality is **ahead on integration** but **behind on explanation structure**.

**Overall recommendation:** Proceed with **MRC-1** immediately. Target **MRC-2** for both modules in a single PR series with dual-read compatibility to avoid DPSS regression.
