---
id: module-runtime-contract-v1
title: Module Runtime Contract v1
project: Arrival Atlas
system: Arrival Atlas
type: spec
domain: core
status: active
maturity: stable
owner: system
tags:
  - module-runtime
  - governance-kernel
  - execution-pipeline
created: 2026-06-01
updated: 2026-06-19
related:
  - mrc-adl
---

# Module Runtime Contract v1.0 — Specification

**Project:** Arrival Atlas  
**Document Type:** Architecture Specification  
**Domain:** Module Runtime Platform  
**Status:** Proposed  
**Version:** 0.1  
**Date:** June 2026  

**Related documents:**

- [Module Runtime Contract v1.0 — Evolution Roadmap](../archive/module-runtime-evolution-roadmap.md)
- [IAM Evolution Roadmap](../platform/iam-evolution-roadmap.md)
- [Financial Module v2 — Architecture Notes](../finance/financial-module-v2-notes.md)
- [User Profile Engine Runtime Unification Report](../audits/user-profile-engine-runtime-unification-report.md)
- [P7.0 — Module Runtime Architecture Audit](../audits/p7-0-module-runtime-architecture-audit.md)

---

## 1. Executive Summary

This specification defines **Module Runtime Contract v1.0** — the formal boundary between the Profile System, module execution engines, and UI Snapshot projection.

The roadmap ([Module Runtime Evolution Roadmap](../archive/module-runtime-evolution-roadmap.md)) describes *what* to build and in what order. This document defines *how* the contract looks: TypeScript interfaces, pipeline invariants, and enforcement rules.

**Contract boundary:**

```text
┌─────────────────────────────────────────────────────────────┐
│  OUT OF SCOPE FOR MODULES                                   │
│  DPSS · Profile Engine · IAM · Entitlements · UI rendering  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   Module Runtime Contract     │
              │   (this specification)        │
              └───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  DOWNSTREAM ONLY                                              │
│  Explanation Engine · UX Orchestrator · UI Snapshot           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Current State (As-Is)

The platform already has partial runtime infrastructure. This section maps existing code to the target contract.

### 2.1 Execution Pipeline (Today)

```text
POST /api/modules/:id/execute
        │
        ▼
resolveExecutionContext()          ← packages/profile
  · load profile by session
  · apply module profile policy
  · merge input (profile → input → default)
  · build AppContext
  · collect ExecutionTrace
        │
        ▼
globalRegistry.execute()           ← packages/core
  · validate input (Zod)
  · module.execute(input, context)
  · validate output (Zod)
        │
        ▼
systemStateCoordinator.applyMutation({ type: 'MODULE_EXECUTE' })
  · persist result + trace in DPSS
        │
        ▼
attachUxToExecutionResult()        ← apps/api (optional UX layer)
        │
        ▼
buildUiSnapshot(state)             ← pure projection
  · executionsByModuleId → UiSnapshot.executions
  · buildUXActionPlan() → uxSnapshot
```

### 2.2 Existing Types (Partial Contract)

| Target concept | Current implementation | Location |
|----------------|------------------------|----------|
| `ModuleMetadata` | `ModuleMetadata` + `ModuleRegistration` | `packages/core/src/types/index.ts` |
| `ModuleRuntimeContext` | `AppContext` (built by Profile Engine) | `packages/core`, `packages/profile` |
| `ModuleTrace` | `ExecutionTrace` | `packages/profile/src/trace/execution-trace.ts` |
| `ModuleResult` | `ModuleExecutionResult<T>` + raw domain output | `packages/core` |
| `ModuleRegistry` | `ModuleRegistry` / `globalRegistry` | `packages/core/src/registry/index.ts` |
| Recommendations | Module-specific (e.g. `decisions[]`, `recommendations[]`) | Per-module schemas |
| Actions | `UXActionCard` via post-hoc UX orchestrator | `packages/ux` |
| Explanations | Ad-hoc `reasoning[]`, `rationale` strings | Per-module output fields |

### 2.3 Gap Summary

| Gap | Impact |
|-----|--------|
| No unified `ModuleResult` envelope | Domain outputs differ structurally; UI Snapshot stores opaque `result: unknown` |
| `AppContext` ≠ formal runtime context | Context builder output is split across `context`, `mergedInput`, `trace` |
| Trace covers profile resolution only | Module-internal reasoning is not traced uniformly |
| UX layer is post-hoc | Actions derived outside module contract via `buildUXActionPlan()` |
| No `ModuleCapabilities` | Entitlements and feature flags are registry metadata, not typed capabilities |
| No explanation schema | Reasoning fields are module-specific strings |

---

## 3. Target Contract — Core Types

All types below are **normative** for Module Runtime Contract v1.0. Implementations may live in a new `@arrival-atlas/module-runtime` package (Phase MRC-1).

### 3.1 ModuleMetadata

Describes a registered module. Extends the existing core metadata with runtime contract version.

```typescript
export type ModuleMetadata = {
  /** Stable identifier, kebab-case. Example: 'financial-reality' */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semver. Example: '2.0.0' */
  version: string;
  description: string;
  /** Contract version this module implements */
  runtimeContractVersion: '1.0';
  enabled: boolean;
  featureFlags: Record<string, boolean>;
};
```

**Rules:**

- `id` is immutable after registration.
- `version` follows semver; breaking output changes require a major bump.
- `runtimeContractVersion` must be `'1.0'` for modules in this contract.

---

### 3.2 ModuleCapabilities

Declares what a module can produce and what profile data it requires. Used by registry discovery, entitlements, and profile policy alignment.

```typescript
export type ModuleCapability =
  | 'produces-recommendations'
  | 'produces-actions'
  | 'produces-explanations'
  | 'requires-profile'
  | 'supports-scenarios'
  | 'supports-comparison';

export type ModuleCapabilities = {
  /** Capabilities this module declares at registration time */
  capabilities: readonly ModuleCapability[];
  /** Profile document paths the module may read (dot notation) */
  requiredProfileFields: readonly string[];
  /** Profile paths the module must never receive (policy enforced upstream) */
  forbiddenProfileFields: readonly string[];
  /** Entitlement key required for execution; null = no entitlement gate */
  entitlementKey: string | null;
};
```

**Rules:**

- Capabilities are declared, not inferred.
- Profile field access is enforced by Profile Engine policy **before** context reaches the module.
- A module declaring `requires-profile` must handle `profileSlice === null` gracefully (anonymous sessions).

---

### 3.3 ModuleRuntimeContext

The **only** input a module receives besides validated domain input. Replaces direct use of `AppContext` at the module boundary.

```typescript
import type { SupportedLanguage, DataProvenanceEntry } from '@arrival-atlas/core';
import type { ProfileSlice } from '@arrival-atlas/profile';

export type ModuleRuntimeContext = {
  /** Execution identity */
  sessionId: string;
  accountId: string | null;

  /** Locale and UI preferences (read-only) */
  locale: SupportedLanguage;
  uiPreferences: {
    theme: 'light' | 'dark' | 'system';
  };

  /** Policy-filtered profile slice; null when no profile exists */
  profileSlice: ProfileSlice | null;
  profileId: string | null;
  profileVersion: number | null;

  /** Field-level provenance for merged input */
  dataProvenance: readonly DataProvenanceEntry[];

  /** Optional location hint (non-authoritative) */
  location?: string;

  /** Runtime metadata — not for business logic branching */
  runtime: {
    moduleId: string;
    executedAt: string; // ISO-8601, assigned by runtime before execute()
    traceId: string;    // correlates pre-execution trace
  };
};
```

**Rules:**

- Modules **must not** mutate `ModuleRuntimeContext`.
- Modules **must not** access DPSS, Profile Engine, or session stores.
- `profileSlice` is already policy-filtered; modules must not attempt to bypass field restrictions.
- `dataProvenance` is read-only audit metadata; modules may include it in trace output but must not modify it.

**Migration note:** Today `AppContext` (`packages/core`) is built by `resolveExecutionContext()`. Phase MRC-1 introduces an adapter:

```typescript
function toModuleRuntimeContext(
  appContext: AppContext,
  params: { moduleId: string; traceId: string; executedAt: string }
): ModuleRuntimeContext;
```

---

### 3.4 ModuleInput / ModuleOutput (Domain Layer)

Domain schemas remain module-specific but must conform to runtime wrapping rules.

```typescript
import type { z } from 'zod';

export interface ModuleDefinition<TInput, TOutput> {
  metadata: ModuleMetadata;
  capabilities: ModuleCapabilities;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;

  /**
   * Pure, deterministic execution.
   * MUST NOT perform I/O, mutate external state, or render UI.
   */
  execute(
    input: TInput,
    context: ModuleRuntimeContext
  ): Promise<TOutput> | TOutput;
}
```

**Rules:**

- `inputSchema` and `outputSchema` are validated by the runtime, not by individual modules.
- `execute()` must be **pure**: same `(input, context)` → same output.
- `execute()` must be **side-effect free**: no file writes, network calls, DPSS mutations, or profile updates.
- Async is allowed for computational work only (not for I/O).

---

### 3.5 ModuleResult

The **canonical execution envelope**. All module outputs are wrapped before persistence and projection.

```typescript
export type ModuleResultStatus = 'success' | 'validation_error' | 'execution_error';

export type ModuleResultMeta = {
  moduleId: string;
  moduleVersion: string;
  runtimeContractVersion: '1.0';
  executionId: string;
  executedAt: string;       // ISO-8601
  snapshotVersion?: number; // assigned by DPSS on persist
  engineVersion?: string;   // domain engine semver (optional)
  confidence: 'high' | 'medium' | 'low';
  disclaimer?: string;
};

export type ModuleResult<TPayload = unknown> = {
  status: ModuleResultStatus;
  meta: ModuleResultMeta;
  /** Domain payload. Present only when status === 'success' */
  payload?: TPayload;
  /** Structured recommendations (Phase MRC-3+) */
  recommendations?: readonly Recommendation[];
  /** User-facing actions (Phase MRC-4+) */
  actions?: readonly ActionItem[];
  /** Explanation for the overall result (Phase MRC-3+) */
  explanation?: ModuleExplanation;
  /** Error message when status !== 'success' */
  error?: string;
};
```

**Rules:**

- API responses and DPSS storage use `ModuleResult`, not raw domain output.
- `payload` contains domain data only; recommendations/actions/explanation live at the envelope level.
- `confidence` is required on every successful result.
- Modules that cannot assess confidence must declare `'medium'` and document why in `explanation`.

**Current mapping:**

| Today | Target |
|-------|--------|
| `ModuleExecutionResult<T>` with `success`, `data`, `error` | `ModuleResult<T>` with `status`, `payload`, `error` |
| Domain `meta.confidence` inside payload | Promoted to `ModuleResult.meta.confidence` |
| `decisions[]` / `recommendations[]` inside payload | Normalized to `Recommendation[]` at envelope |

---

### 3.6 ModuleTrace

Extends profile-resolution trace with module execution steps.

```typescript
export type ModuleTraceStep =
  | { type: 'PROFILE_LOADED'; profileId: string }
  | { type: 'POLICY_APPLIED'; policyId: string }
  | { type: 'FIELD_ALLOWED'; field: string }
  | { type: 'FIELD_REDACTED'; field: string }
  | { type: 'INPUT_OVERRIDE'; field: string; value: unknown }
  | { type: 'MERGE_DECISION'; field: string; source: 'profile' | 'input' | 'default' }
  | { type: 'FINAL_VALUE'; field: string; value: unknown }
  | { type: 'INPUT_VALIDATED'; schemaVersion: string }
  | { type: 'OUTPUT_VALIDATED'; schemaVersion: string }
  | { type: 'ENGINE_STEP'; step: string; detail?: Record<string, unknown> }
  | { type: 'RECOMMENDATION_EMITTED'; recommendationId: string }
  | { type: 'ACTION_EMITTED'; actionId: string };

export type ModuleTrace = {
  traceId: string;
  sessionId: string;
  moduleId: string;
  executionId: string;
  steps: readonly ModuleTraceStep[];
  startedAt: string;
  completedAt: string;
};
```

**Rules:**

- Pre-execution steps (profile load, merge) are collected by the Runtime Context Builder.
- Post-validation steps (`INPUT_VALIDATED`, `OUTPUT_VALIDATED`) are appended by the runtime kernel.
- Module-internal steps use `ENGINE_STEP` with stable `step` identifiers (not free-form debug strings).
- Trace is persisted alongside `ModuleResult` in DPSS (`executionTracesByModuleId`).
- `GET /api/modules/:id/trace` remains diagnostic-only; UI must not depend on it.

---

### 3.7 ModuleExplanation (Phase MRC-3)

Common explanation model for recommendations and overall results.

```typescript
export type ExplanationFactor = {
  id: string;
  label: string;
  value: string | number | boolean;
  source: 'profile' | 'input' | 'rule' | 'calculation' | 'default';
  weight?: number; // 0–1, optional contribution weight
};

export type ModuleExplanation = {
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  factors: readonly ExplanationFactor[];
  /** Rule or calculation identifiers invoked */
  ruleIds?: readonly string[];
};
```

**Rules:**

- Every `Recommendation` must include `explanation: ModuleExplanation`.
- `summary` is user-facing; `factors` support audit and debug.
- Empty `factors` arrays are forbidden when `confidence !== 'high'`.

---

### 3.8 Recommendation (Phase MRC-3 / MRC-4)

```typescript
export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  priority: RecommendationPriority;
  explanation: ModuleExplanation;
  /** Optional link to a scenario or domain entity */
  scopeRef?: string;
};
```

**Rules:**

- `id` is stable within an execution (suitable for trace correlation).
- Priority ordering is determined by the runtime/explanation engine, not the UI.
- Legacy fields (`decisions[]`, inline `reasoning[]`) migrate to `Recommendation` + `ModuleExplanation`.

---

### 3.9 ActionItem (Phase MRC-4)

```typescript
export type ActionKind =
  | 'apply'
  | 'contact'
  | 'collect-documents'
  | 'schedule';

export type ActionItem = {
  id: string;
  kind: ActionKind;
  title: string;
  description: string;
  priority: RecommendationPriority;
  /** Institution, URL, or contact target — opaque to UI routing */
  target?: string;
  /** Recommendation this action derives from */
  recommendationId?: string;
};
```

**Rules:**

- Actions are **declarative**. Modules describe intent; UI decides presentation.
- `kind` must be one of the supported action kinds (extensible in v2).
- Post-hoc UX card generation (`packages/ux`) migrates to reading `ModuleResult.actions`.

---

## 4. Runtime Kernel Interface

The runtime kernel orchestrates execution. It replaces ad-hoc calls to `globalRegistry.execute()` at the API boundary.

```typescript
export type ExecuteModuleParams = {
  moduleId: string;
  requestInput: Record<string, unknown>;
  sessionId: string;
  accountId: string | null;
  requestContext?: Partial<{
    userProfile: { language?: string; uiPreferences?: { theme?: string } };
    location?: string;
    inputOverrides?: Record<string, unknown>;
  }>;
};

export type ExecuteModuleOutcome = {
  result: ModuleResult;
  trace: ModuleTrace;
  mergedInput: Record<string, unknown>;
};

export interface ModuleRuntime {
  /** Discover registered modules */
  listModules(): readonly ModuleMetadata[];

  /** Inspect capabilities before execution */
  getCapabilities(moduleId: string): ModuleCapabilities | null;

  /** Canonical execution entry point */
  execute(params: ExecuteModuleParams): Promise<ExecuteModuleOutcome>;
}
```

**Execution algorithm (normative):**

```text
1. Resolve module registration; fail if missing or disabled
2. resolveExecutionContext() → context, mergedInput, preTrace
3. toModuleRuntimeContext()
4. Validate mergedInput against module.inputSchema
     → trace: INPUT_VALIDATED
5. module.execute(validatedInput, runtimeContext)
6. Validate output against module.outputSchema
     → trace: OUTPUT_VALIDATED
7. Wrap output in ModuleResult envelope
     → normalize recommendations, actions, explanation
8. Return { result, trace, mergedInput }
```

**Persistence** (outside runtime kernel, in API coordinator):

```typescript
await systemStateCoordinator.applyMutation({
  type: 'MODULE_EXECUTE',
  sessionId,
  moduleId,
  result: outcome.result,          // ModuleResult envelope
  trace: outcome.trace,
  executionId: outcome.result.meta.executionId,
  executedAt: outcome.result.meta.executedAt,
  requestInput: cleanInput,
  actor,
});
```

---

## 5. ModuleRegistry Contract (Phase MRC-5)

Extends the existing `ModuleRegistry` with capability inspection and contract enforcement.

```typescript
export interface ModuleRegistry {
  register(definition: ModuleDefinition<unknown, unknown>): void;
  get(moduleId: string): ModuleDefinition<unknown, unknown> | undefined;
  list(): readonly ModuleMetadata[];
  getCapabilities(moduleId: string): ModuleCapabilities | undefined;

  /** Validates all registrations at bootstrap */
  validateRegistrations(): void;
}
```

**Bootstrap rules:**

- All modules register via `registerAllModules()` only.
- `validateRegistrations()` checks:
  - unique `id`
  - valid semver
  - `runtimeContractVersion === '1.0'`
  - declared capabilities match module output (e.g. if `produces-recommendations`, result must include recommendations on success)
- Registry is frozen after bootstrap (mirrors IAM `RouteSecurityMap` pattern).

---

## 6. UI Snapshot Integration (Phase MRC-6)

UI Snapshot is a **pure projection** of DPSS state. After MRC-6, it consumes `ModuleResult` envelopes only.

### 6.1 Target Snapshot Shape (Executions)

```typescript
export type UiSnapshotModuleExecution = {
  moduleId: string;
  executionId: string;
  timestamp: number;
  snapshotVersion: number;
  result: ModuleResult; // full envelope, not opaque payload
};
```

### 6.2 Projection Rules

| Rule | Description |
|------|-------------|
| **SR-1** | `buildUiSnapshot()` reads `StoredModuleExecution.result` as `ModuleResult` |
| **SR-2** | Frontend never parses domain-specific payload structure without moduleId guard |
| **SR-3** | `uxSnapshot.actionCards` derive from `ModuleResult.actions`, not post-hoc UX rules |
| **SR-4** | `uxSnapshot.insights` derive from `ModuleResult.recommendations` + `explanation` |
| **SR-5** | Frontend has no imports from `@arrival-atlas/profile`, `@arrival-atlas/modules`, or DPSS types |

### 6.3 Current vs Target

Today `StoredModuleExecution.result` is `unknown` (raw domain output). Phase MRC-2/MRC-6 wrap and migrate stored results. Legacy executions may require a projection adapter until backfill is complete.

---

## 7. Strict Contract Rules

These rules are **mandatory** for all modules under v1.0.

### 7.1 Determinism

| ID | Rule |
|----|------|
| **R-DET-1** | `execute(input, context)` returns identical output for identical inputs |
| **R-DET-2** | No reads from system clock inside modules unless passed via context |
| **R-DET-3** | No randomness unless seeded and recorded in trace |

### 7.2 Side Effects

| ID | Rule |
|----|------|
| **R-SE-1** | Modules must not write to DPSS |
| **R-SE-2** | Modules must not mutate Profile Engine state |
| **R-SE-3** | Modules must not perform network I/O |
| **R-SE-4** | Modules must not emit HTTP responses or UI instructions |

### 7.3 Context Isolation

| ID | Rule |
|----|------|
| **R-CTX-1** | Modules receive `ModuleRuntimeContext` only — not raw Fastify request |
| **R-CTX-2** | Modules must not access `sessionId` outside provided context |
| **R-CTX-3** | Profile fields outside `requiredProfileFields` must not appear in context |

### 7.4 Output Structure

| ID | Rule |
|----|------|
| **R-OUT-1** | All successful executions produce `ModuleResult` with required `meta` |
| **R-OUT-2** | Domain payload validates against module `outputSchema` |
| **R-OUT-3** | Recommendations include `explanation` (MRC-3+) |
| **R-OUT-4** | Actions use supported `ActionKind` values only (MRC-4+) |

### 7.5 Traceability

| ID | Rule |
|----|------|
| **R-TRC-1** | Every execution produces a `ModuleTrace` |
| **R-TRC-2** | Profile merge decisions appear in trace steps |
| **R-TRC-3** | Module-internal engine steps use `ENGINE_STEP` with stable identifiers |

### 7.6 UI Independence

| ID | Rule |
|----|------|
| **R-UI-1** | Modules must not return JSX, CSS, component trees, or layout hints |
| **R-UI-2** | Modules must not return i18n keys without resolved strings |
| **R-UI-3** | UI reads snapshot projections only — never calls module execute directly for state |

---

## 8. API Surface

Existing routes remain; payloads evolve toward the contract.

### 8.1 Execute

```
POST /api/modules/:id/execute
Authorization: Bearer <token> | x-session-id (legacy)
```

**Request:**

```typescript
{
  input?: Record<string, unknown>;
  context?: {
    userProfile?: { language?: string; uiPreferences?: { theme?: string } };
    location?: string;
    inputOverrides?: Record<string, unknown>;
  };
}
```

**Response (target):**

```typescript
ModuleResult<TPayload> & {
  ux?: UXActionPlan; // deprecated — migrate to result.actions (MRC-6)
}
```

**Compatibility:** Phase MRC-2 maintains response field parity (`success`/`data` aliases) until web client migration completes.

### 8.2 Trace (Diagnostic)

```
GET /api/modules/:id/trace
```

Returns `ModuleTrace`. Header `x-deprecation` remains. Not for UI consumption.

### 8.3 UI Snapshot

```
GET /api/ui-snapshot
```

Returns projected state. After MRC-6, `executions[].result` is typed as `ModuleResult`.

---

## 9. Governance & Contract Tests (Phase MRC-7)

Contract tests enforce invariants at CI time.

### 9.1 Required Test Suites

| Suite | Asserts |
|-------|---------|
| `module-runtime-contract.test.ts` | All registered modules declare `runtimeContractVersion: '1.0'` |
| `module-purity.test.ts` | Module packages have no imports from `apps/api`, DPSS, or Fastify |
| `module-determinism.test.ts` | Golden-input fixtures produce stable outputs (existing pattern in financial fixtures) |
| `module-result-envelope.test.ts` | Execute responses conform to `ModuleResult` schema |
| `snapshot-projection.test.ts` | `buildUiSnapshot()` accepts only `ModuleResult` execution entries |
| `route-handler-isolation.test.ts` | Route handlers do not call `module.execute()` directly — runtime kernel only |

### 9.2 Static Analysis Rules

| Pattern | Allowed in |
|---------|------------|
| `globalRegistry.execute()` | Runtime kernel, bootstrap tests |
| `module.execute()` | Module package unit tests only |
| `resolveExecutionContext()` | Runtime kernel, profile engine tests |
| `buildUiSnapshot()` | Snapshot projection engine, projection tests |

---

## 10. Migration Map — Existing Modules

### 10.1 Financial Reality

| Aspect | Current | Target |
|--------|---------|--------|
| Output | `FinancialRealityOutput` with inline `decisions[]`, `meta.confidence` | `ModuleResult<FinancialRealityPayload>` + `Recommendation[]` |
| Reasoning | `benefits.buergergeld.reasoning: string[]` | `ExplanationFactor[]` on recommendation |
| Trace | Profile merge only | Add `ENGINE_STEP` for pipeline stages |
| Context | `AppContext` | `ModuleRuntimeContext` |

### 10.2 Benefits Simulator

| Aspect | Current | Target |
|--------|---------|--------|
| Output | `BenefitsSimulatorOutput` with `recommendations[]`, `riskWarnings[]` | `ModuleResult` envelope; warnings → `Recommendation` |
| Actions | Inline `action` on risk warnings | `ActionItem[]` at envelope |
| Context | Ignored (`_context`) | Must read `profileSlice` when available |

### 10.3 UX Orchestrator

| Aspect | Current | Target |
|--------|---------|--------|
| Input | Raw module outputs post-execute | `ModuleResult[]` from snapshot |
| Output | `UXActionPlan` with hardcoded templates | Derived from `ActionItem` + `Recommendation` |
| Location | `attachUxToExecutionResult()` in API | Snapshot projection layer |

---

## 11. Package Structure (Target)

```text
packages/
├── core/                    # Shared primitives (language, provenance)
├── profile/                 # Profile Engine + context builder (upstream)
├── module-runtime/          # NEW — contract types + runtime kernel (MRC-1)
│   ├── src/
│   │   ├── types/           # ModuleResult, ModuleTrace, etc.
│   │   ├── runtime/         # ModuleRuntime implementation
│   │   ├── adapters/        # AppContext → ModuleRuntimeContext
│   │   └── governance/      # Contract test utilities
│   └── package.json
├── modules/                 # Domain modules (financial-reality, benefits-simulator, …)
├── ux/                      # Explanation + action projection (downstream)
└── shared-services/         # Domain calculation engines (pure functions)
```

**Dependency direction (strict):**

```text
modules → module-runtime → core
modules → shared-services
module-runtime → profile
apps/api → module-runtime → modules
packages/ux → module-runtime
apps/web → (UI Snapshot types only)
```

Modules must not depend on `apps/api`, `apps/web`, or DPSS.

---

## 12. Acceptance Checklist

Module Runtime Contract v1.0 is **complete** when all items pass:

- [ ] `@arrival-atlas/module-runtime` package exists with normative types from §3
- [ ] `ModuleRuntime.execute()` is the sole API execution path
- [ ] Financial Reality and Benefits Simulator return `ModuleResult` envelopes
- [ ] Every recommendation includes `ModuleExplanation`
- [ ] Every execution persists `ModuleTrace` with input/output validation steps
- [ ] `buildUiSnapshot()` projects `ModuleResult` without domain-specific adapters
- [ ] Frontend consumes UI Snapshot only — no module domain imports
- [ ] Contract tests (§9) pass in CI
- [ ] No behavioral regression in existing API integration tests

---

## 13. Relationship to Adjacent Contracts

| Contract | Relationship |
|----------|--------------|
| **IAM Phase 3.1** | Provides `ResolvedIdentity` at API boundary; runtime receives `sessionId` + `accountId` only |
| **Profile Engine** | Upstream context builder; modules never bypass policy |
| **DPSS** | Downstream persistence; runtime is stateless |
| **UI Snapshot Contract v1.0** | Downstream projection; depends on `ModuleResult` shape defined here |
| **Explanation Engine v1.0** | Downstream consumer of `ModuleExplanation` and `Recommendation` |

---

## 14. Versioning

| Version | Scope |
|---------|-------|
| **1.0** | Synchronous, pure, session-bound execution with recommendations, actions, trace |
| **1.x** | Additive fields only (new `ActionKind`, optional meta fields) |
| **2.0** | Async execution, external providers (see roadmap §7) |

Breaking changes to `ModuleResult` or `ModuleRuntimeContext` require a major contract version bump and coordinated migration across all registered modules.
