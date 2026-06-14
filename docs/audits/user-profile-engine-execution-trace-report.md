# User Profile Engine — Phase 1.8 Execution Traceability Layer Report

**Date:** June 2026  
**Package:** `@arrivalos/profile@0.1.0`  
**Follows:** `docs/audits/user-profile-engine-policy-layer-report.md`  
**Design reference:** `docs/audits/user-profile-engine-design.md`  
**Status:** Complete

---

## Executive Summary

Phase 1.8 introduces a deterministic **Execution Trace System** that records every significant decision in the profile resolution pipeline: policy application, field inclusion/exclusion, input overrides, merge precedence, and final resolved values.

Trace collection is integrated into the canonical `resolveExecutionContext()` entry point. Each module execution stores the last trace per session for read-only retrieval via `GET /api/modules/:id/trace`.

**54 automated tests pass** (22 profile + 25 shared-services + 6 modules + 1 API integration). `AppContextSchema`, `ModuleRegistry`, and policy behavior are unchanged.

---

## Problem Statement

Before Phase 1.8, the profile pipeline produced correct outputs but offered no structured audit trail:

| Gap | Consequence |
|-----|-------------|
| Opaque policy decisions | Cannot explain why a field was redacted or excluded |
| Non-verifiable merges | Financial inputs could not be traced to profile vs request vs default |
| No compliance artifact | GDPR field-level access audits require explainable decision paths |
| Scale debugging | Production issues require log archaeology instead of structured traces |

---

## Solution Overview

### New subsystem: `@arrivalos/profile/trace`

| File | Role |
|------|------|
| `trace/execution-trace.ts` | `ExecutionTrace`, `ExecutionTraceStep` types |
| `trace/trace-collector.ts` | Pure `TraceCollector`, `aggregateTraceSteps`, `sortStepsByField` |
| `trace/trace-collector.test.ts` | 3 collector unit tests |
| `trace/index.ts` | Public exports |

### ExecutionTrace shape

```typescript
type ExecutionTrace = {
  sessionId: string;
  moduleId: string;
  steps: ExecutionTraceStep[];
};

type ExecutionTraceStep =
  | { type: 'PROFILE_LOADED'; profileId: string }
  | { type: 'POLICY_APPLIED'; policyId: string }
  | { type: 'FIELD_ALLOWED'; field: string }
  | { type: 'FIELD_REDACTED'; field: string }
  | { type: 'INPUT_OVERRIDE'; field: string; value: unknown }
  | { type: 'MERGE_DECISION'; field: string; source: 'profile' | 'input' | 'default' }
  | { type: 'FINAL_VALUE'; field: string; value: unknown };
```

### Trace step semantics

| Step | When emitted | Source |
|------|--------------|--------|
| `PROFILE_LOADED` | Session has a bound profile | `resolveExecutionContext()` |
| `POLICY_APPLIED` | Module policy resolved | `applyProfilePolicy()` |
| `FIELD_ALLOWED` | Top-level domain present in profile and allowed by policy | `applyProfilePolicy()` (sorted alphabetically) |
| `FIELD_REDACTED` | Sensitive or redact dot-path in policy | `applyProfilePolicy()` (sorted alphabetically) |
| `INPUT_OVERRIDE` | Request override wins merge or context resolution | `mergeModuleInput()`, `buildAppContext()` |
| `MERGE_DECISION` | Field resolved from profile, input, or default | `mergeModuleInput()`, `buildAppContext()` |
| `FINAL_VALUE` | Resolved value for a traced field | `mergeModuleInput()`, `buildAppContext()` |

**Override precedence:** When an override wins, the trace records `INPUT_OVERRIDE` followed by `FINAL_VALUE` (no `MERGE_DECISION`, since override is not in the merge-decision source enum).

---

## Pipeline Integration

### Updated `resolveExecutionContext()` return type

```typescript
interface ResolveExecutionContextResult {
  context: AppContext;
  mergedInput: Record<string, unknown>;
  profile: ProfileRecord | null;
  profileSlice: ProfileSlice | null;
  trace: ExecutionTrace;  // NEW
}
```

### Trace collection flow

```
resolveExecutionContext()
  │
  ├─ TraceCollector (local, no global state in profile package)
  │
  ├─ 1. PROFILE_LOADED (if profile bound)
  ├─ 2. applyProfilePolicy(..., trace)
  │      → POLICY_APPLIED, FIELD_ALLOWED*, FIELD_REDACTED*
  ├─ 3. buildPolicyConstrainedDocument() — unchanged, no trace (behavior preserved)
  ├─ 4. mergeModuleInput(..., trace)
  │      → MERGE_DECISION / INPUT_OVERRIDE, FINAL_VALUE per configured field
  ├─ 5. buildAppContext(..., trace)
  │      → context.* MERGE_DECISION / INPUT_OVERRIDE, FINAL_VALUE
  │
  └─ traceCollector.build({ sessionId, moduleId })
```

Trace steps are appended in **pipeline execution order**. Within policy segments, `FIELD_ALLOWED` and `FIELD_REDACTED` steps are sorted alphabetically by field path for determinism.

---

## API Exposure

### In-memory trace store

`apps/api/src/execution-trace-store.ts` holds the last trace per `(sessionId, moduleId)` key. Traces are stored after successful `resolveExecutionContext()` in the execute handler (before module execution).

### New endpoint

```
GET /api/modules/:id/trace
Headers: x-session-id (required)
```

| Response | Meaning |
|----------|---------|
| `200` | Last execution trace for session + module |
| `400` | Missing `x-session-id` |
| `404` | Module not found, or no trace stored for session |

Example trace fragment after override execute:

```json
{
  "sessionId": "sess_abc",
  "moduleId": "financial-reality",
  "steps": [
    { "type": "PROFILE_LOADED", "profileId": "prof_xyz" },
    { "type": "POLICY_APPLIED", "policyId": "financial-reality" },
    { "type": "FIELD_ALLOWED", "field": "employment" },
    { "type": "FIELD_REDACTED", "field": "employment.grossMonthlyIncome" },
    { "type": "MERGE_DECISION", "field": "grossIncome", "source": "input" },
    { "type": "FINAL_VALUE", "field": "grossIncome", "value": 3000 }
  ]
}
```

---

## Constraints Verified

| Constraint | Status |
|------------|--------|
| Do not change `AppContextSchema` | ✅ Unchanged |
| Do not modify `ModuleRegistry` interface | ✅ Unchanged |
| Do not alter policy behavior | ✅ Optional trace param only; slice/merge outputs identical |
| Preserve execution determinism | ✅ Same inputs → same trace step sequence |
| Pure trace collector (no side effects) | ✅ Local collector per resolve; no I/O in profile package |

---

## Files Changed

### New

| Path | Purpose |
|------|---------|
| `packages/profile/src/trace/execution-trace.ts` | Trace types |
| `packages/profile/src/trace/trace-collector.ts` | Collector + aggregation helpers |
| `packages/profile/src/trace/trace-collector.test.ts` | Unit tests |
| `packages/profile/src/trace/index.ts` | Exports |
| `apps/api/src/execution-trace-store.ts` | Session-scoped last-trace store |
| `docs/audits/user-profile-engine-execution-trace-report.md` | This report |

### Modified

| Path | Change |
|------|--------|
| `packages/profile/src/policy/apply-profile-policy.ts` | Optional `TraceCollector`; policy step recording |
| `packages/profile/src/engine/input-merger.ts` | Optional `TraceCollector`; merge step recording |
| `packages/profile/src/engine/context-builder.ts` | Optional `TraceCollector`; context field tracing |
| `packages/profile/src/engine/resolve-execution-context.ts` | Orchestrates collector; returns `trace` |
| `packages/profile/src/engine/resolve-execution-context.test.ts` | Trace assertions |
| `packages/profile/src/index.ts` | Export trace subsystem |
| `apps/api/src/build-app.ts` | Store trace on execute; `GET /api/modules/:id/trace` |
| `apps/api/src/profile.integration.test.ts` | Trace endpoint integration test |

---

## Test Coverage

| Suite | Tests | New |
|-------|-------|-----|
| `@arrivalos/profile` | 22 | +3 trace collector, +trace assertions in resolve tests |
| `@arrivalos/shared-services` | 25 | — |
| `@arrivalos/modules` | 6 | — |
| `@arrivalos/api` | 1 | +trace endpoint assertion |
| **Total** | **54** | **+4** |

---

## Example: financial-reality trace (profile-sourced income)

After execute with empty input and bound profile (€2500 gross):

1. `PROFILE_LOADED` → profile id
2. `POLICY_APPLIED` → `financial-reality`
3. `FIELD_ALLOWED` → `employment`, `household`, `housing`, … (alphabetical)
4. `FIELD_REDACTED` → `employment.grossMonthlyIncome`, `housing.monthlyColdRent`
5. `MERGE_DECISION` → `grossIncome` source `profile`
6. `FINAL_VALUE` → `grossIncome` 2500
7. `MERGE_DECISION` → `context.userProfile.income` source `profile`
8. `FINAL_VALUE` → `context.userProfile.income` 2500

The slice exposed to the module still omits `grossMonthlyIncome` (Phase 1.7 policy); the trace explains both the redaction and the merge path used for computation.

---

## Known Limitations (Phase 1.8 scope)

| Limitation | Phase 2 direction |
|------------|-------------------|
| In-memory trace store (last trace only) | Persistent trace log with retention policy |
| No trace on failed module execution | Store trace before execute; optional post-execute module steps |
| Context `systemState` fields not fully traced | Extend `buildAppContext` tracing for benefits/insurance |
| Unregistered modules: minimal policy trace only | Per-module trace profiles |

---

## Verdict

Phase 1.8 delivers a **deterministic, explainable decision engine** foundation. Policy decisions, merge precedence, and final values are auditable per session and module without changing runtime behavior. The system is ready for compliance review workflows and operational debugging at the profile pipeline layer.

**Next recommended phase:** Persistent trace storage, trace retention/GDPR export hooks, and optional module-level post-execute steps (`MODULE_EXECUTED`, result checksum).
