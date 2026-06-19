---
id: mrc-6-to-platform-roadmap
title: MRC-6 to Platform Roadmap
project: Arrival Atlas
system: Arrival Atlas
type: roadmap
domain: platform
status: active
maturity: stable
owner: system
tags:
  - product-contract
  - ui-ready-gate
  - platform-evolution
created: 2026-06-01
updated: 2026-06-19
related:
  - roadmap-vs-current-state
---

# Roadmap: MRC-6 → Tranche → UI-Ready + Module-Ready Platform

**Project:** Arrival Atlas  
**Document Type:** Architecture Roadmap  
**Domain:** Module Runtime Platform → Product Contract Layer  
**Status:** Proposed  
**Version:** 1.0  
**Date:** June 2026  

**Supersedes (partially):** [Module Runtime Evolution Roadmap](../archive/module-runtime-evolution-roadmap.md) Phases MRC-6/MRC-7 naming — governance kernel (MRC-6 debt closure) is complete; this document defines the **next** tranche.

**Bound by:**

- [MRC ADL v1.0](../core/mrc-adl.md)
- [Module Runtime Contract v1.0](../core/module-runtime-contract-v1.md)
- [P7.2 MRC-5 Gate Audit](../audits/p7-2-mrc-5-registry-hardening-gate-audit.md) (conditions closed in MRC-6)

---

## 1. Executive Summary

Arrival Atlas has crossed the **correct runtime system** threshold:

```text
Governance Kernel (MRC-6)
  → authorizeExecution()
  → executeGovernedModule()
  → MRC-3 semantics + MRC-4 actions
  → seal
```

The platform is **architecturally sound** but **not yet product-abstracted**. UI and future module authors can still:

- depend on internal registry shapes (`enabled`, `featureFlags`, raw `ModuleRegistration`)
- receive dual semantic paths (`moduleResult` envelope vs legacy `data` vs `ux` attachment)
- infer capabilities from response shape instead of a stable contract
- reach toward governance/runtime concepts via diagnostic endpoints (`/trace`)

This roadmap closes that gap in five phases and ends at a **UI-ready gate**: frontend and third-party module authors work exclusively against stable public contracts.

### Target end state

```text
UI Layer
  ↓
Public Contract Layer          ← Phase 1 (P0 BLOCKING)
  ↓
Explainability Layer           ← Phase 2 (P1 STRONG)
  ↓
Governance Kernel (MRC-6)      ← DONE
  ↓
Execution Engine
```

Parallel track for scale:

```text
Module SDK + Versioning        ← Phase 3 (P2 CORE)
Observability & Health         ← Phase 4 (P2 SUPPORT)
UI Ready Gate                  ← Phase 5 (FINAL)
```

---

## 2. Phase 0 — Current State (Baseline)

**Status:** ✅ **FIXED — do not regress**

### 2.1 What exists today

| Layer | Status | Evidence |
|-------|--------|----------|
| Governed execution kernel | ✅ | `GovernedModuleRegistry`, `bootstrapGovernedRuntime()`, `authorizeExecution()` |
| Single registry authority | ✅ | No dual `globalRegistry` + contract registry in production path |
| Deterministic execution pipeline | ✅ | Policy derived from contract + capabilities + input schema |
| MRC-3 semantic enrichment | ✅ | `enrichModuleResultSemantics()` — recommendations + explanation |
| MRC-4 action enrichment | ✅ | `enrichModuleResultActions()` — `ActionItem[]` |
| Runtime contract enforcement | ✅ | Bootstrap validation, deep-frozen governance kernel |
| Regression suite | ✅ | 45/45 `@arrival-atlas/module-runtime`, 155/155 `@arrival-atlas/api` |
| IAM boundary | ✅ | Route security map, credential-required execute |

### 2.2 What is intentionally internal (must stay internal)

| Concept | Location | Must NOT leak to UI |
|---------|----------|---------------------|
| `GovernedModuleRegistry` | `@arrival-atlas/module-runtime/governance` | ✅ not exported via API |
| `globalRegistry` | `@arrival-atlas/core` | ⚠️ still used at bootstrap only |
| `ModuleRuntimeCapabilities.executionConstraints` | governance kernel | ⚠️ no public endpoint yet |
| `RegisteredModuleContract` | registry contract types | ⚠️ no public endpoint yet |
| MRC envelope construction | `buildModuleResultEnvelope()` | ⚠️ partially exposed via execute response |

### 2.3 Current public API surface (gaps highlighted)

| Endpoint | Exists | Product-safe? | Gap |
|----------|--------|---------------|-----|
| `GET /api/modules` | ✅ | ⚠️ Partial | Returns `enabled`, `featureFlags` — runtime ops fields, not product contract |
| `GET /api/modules/:id` | ✅ | ⚠️ Partial | Same leakage; no capabilities or schema |
| `GET /api/modules/:id/capabilities` | ❌ | — | Required for UI-safe capability discovery |
| `GET /api/modules/:id/schema` | ❌ | — | Listed in `docs/core/current-state.md` P1; never implemented |
| `GET /api/modules/:id/explain` | ❌ | — | No product-grade explain API |
| `POST /api/modules/:id/execute` | ✅ | ⚠️ Partial | Returns legacy `data` + optional `moduleResult` + optional `ux` — three parallel shapes |
| `GET /api/modules/:id/trace` | ✅ | ❌ | Diagnostic; leaks execution internals; UI must not depend |
| `GET /api/ui-snapshot` | ✅ | ⚠️ Partial | Aggregates legacy `executions[].result`; `moduleResult` projection deferred per ADL §7 |

### 2.4 Current UI consumption pattern

```text
apps/web
  → POST /api/modules/:id/execute     (direct module execution)
  → GET  /api/ui-snapshot             (session state)
  → module-specific pages parse legacy domain shapes
```

**Risk:** UI encodes knowledge of `financial-reality` / `benefits-simulator` domain payloads. No `ModuleUIProjection` boundary exists.

### 2.5 Interpretation

| State | Description |
|-------|-------------|
| **Now** | Correct runtime system — governance-correct, test-green, ADL-bound |
| **Not yet** | Product-safe platform — UI can still couple to runtime internals |
| **Not yet** | Module ecosystem — no SDK, versioning policy, or isolation contract |

---

## 3. Phase 1 — Product Contract Layer (P0 BLOCKING)

**Goal:** Make the system **UI-safe** and **module-safe**.

**Priority:** MUST complete before any serious UI build-out or external module integration.

### 3.1 Public Module Contract API

**Deliverable:** Stable HTTP surface under `/api/modules`:

```text
GET /api/modules
GET /api/modules/:id
GET /api/modules/:id/capabilities
GET /api/modules/:id/schema
```

**New package boundary (proposed):**

```text
packages/product-contract/
  src/
    PublicModuleContract.ts
    ContractSnapshot.ts
    NormalizedCapabilities.ts
    projectPublicContract.ts      // GovernedModuleRegistry → PublicModuleContract
    projectContractSnapshot.ts    // frozen product view
```

**Rule:** UI and external consumers MUST NOT read:

- `GovernedModuleRegistry`
- `ModuleRegistration`
- `RegisteredModuleContract`
- `ModuleRuntimeCapabilities.executionConstraints`
- bootstrap or governance state

**Rule:** API route handlers delegate to `projectPublicContract(governedRegistry)` — never map registry objects inline (today's `build-app.ts` pattern is technical debt).

#### `PublicModuleContract` (proposed shape)

```typescript
type PublicModuleContract = {
  id: string;
  title: string;
  description: string;
  version: string;
  status: 'available' | 'disabled' | 'restricted';
  capabilities: NormalizedCapabilities;
  metadata: {
    category?: string;
    icon?: string;
    entitlementKey?: string | null;
  };
};
```

**Migration note:** `GET /api/modules` response shape changes — version behind `Accept` header or `?contractVersion=1` during transition; existing fields deprecated with sunset date.

### 3.2 ContractSnapshot Layer

**Deliverable:** Immutable product contract snapshot, distinct from runtime contract.

```typescript
type ContractSnapshot = {
  contractVersion: '1.0';
  moduleId: string;
  inputSchema: JsonSchema;      // derived from Zod at bootstrap, frozen
  outputSchema: JsonSchema;     // derived from Zod at bootstrap, frozen
  capabilities: NormalizedCapabilities;
  version: string;
  metadata: PublicModuleMetadata;
  frozenAt: string;
};
```

**Key distinction:**

| Artifact | Purpose | Audience |
|----------|---------|----------|
| `RegisteredModuleContract` | Runtime governance | Kernel only |
| `ContractSnapshot` | Product description | UI, SDK, docs |

**Implementation:** Build snapshot during `bootstrapGovernedRuntime()` → `freezeGovernanceKernel()` pipeline. Serve from read-only store; never rebuild per request.

### 3.3 Capability Normalization Layer

**Deliverable:** Single normalized model — no runtime inference at API boundary.

```typescript
type NormalizedCapabilities = {
  supports: {
    recommendations: boolean;
    actions: boolean;
    explanation: boolean;
    riskModel: boolean;
  };
};
```

**Rules:**

- Values MUST be derived from `RegisteredModuleContract.spec.capabilities` at bootstrap
- MUST NOT infer from execute response shape
- MUST NOT expose raw `ModuleCapability[]` strings to UI
- Mapping table owned by product-contract layer (one place to extend)

**Current kernel mapping (baseline):**

| Contract capability | Normalized field |
|--------------------|------------------|
| `produces-recommendations` | `supports.recommendations` |
| `produces-actions` | `supports.actions` |
| explanation normalizer present | `supports.explanation` |
| risk warnings in domain schema | `supports.riskModel` (per-module ADL rule) |

### 3.4 UI-Safe Projection Layer (CRITICAL)

**Deliverable:** `ModuleUIProjection` — the only shape UI may consume for module output.

```typescript
type ModuleUIProjection = {
  moduleId: string;
  title: string;
  status: 'success' | 'error';
  summary?: string;
  recommendations: SanitizedRecommendation[];
  actions: SanitizedAction[];
  explanation?: SanitizedExplanation;
  error?: { message: string; code?: string };
};
```

**Sanitization rules (ADL-aligned):**

- No internal IDs (`executionConstraints`, normalizer keys, registry module keys)
- No governance concepts in field names or values
- No raw domain payload passthrough — project from sealed `ModuleResult`
- `meta.confidence` canonical; mirror in explanation only
- Actions from MRC-4 `ActionItem[]` only — not legacy `decisions[].action`

**Integration points:**

```text
POST /api/modules/:id/execute
  → executeGovernedModule()
  → buildModuleResultEnvelope() + MRC-3/4 + seal
  → projectModuleUI(sealedModuleResult)     // NEW
  → response: { projection: ModuleUIProjection, ...legacyCompat? }
```

**Parallel path to eliminate:** `attachUxToExecutionResult()` on legacy `data` — ADL §7.2 marks UX orchestrator as parallel until snapshot migration. Phase 1 adds `ModuleUIProjection` as the **authoritative UI path**; Phase 5 retires legacy UX attachment for UI consumers.

### 3.5 Phase 1 exit criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| E1 | UI can list/describe modules without registry imports | Contract test: web package has zero `@arrival-atlas/core` registry imports |
| E2 | Capabilities discoverable via `/capabilities` | Integration test per production module |
| E3 | Input schema discoverable via `/schema` | JSON Schema valid; matches Zod at bootstrap |
| E4 | Execute response includes `ModuleUIProjection` | Snapshot test: no internal field leakage |
| E5 | No governance types in API OpenAPI/schema | Static analysis on `apps/api` response types |
| E6 | ContractSnapshot immutable post-bootstrap | Deep-freeze test mirrors MRC-6 governance test |

**Gate verdict:** Platform is **product-safe** — UI can be built against public contracts only.

---

## 4. Phase 2 — Explainability Layer (P1 STRONG)

**Goal:** UI and support tooling can answer **"why"** without kernel access.

**Priority:** Strongly recommended before UI launch; not a hard blocker for static module cards, but blocking for trust UX ("why this recommendation?").

### 4.1 Explain API

```text
GET /api/modules/:id/explain?executionId=<uuid>
```

**Output (product-grade, ADL-level):**

```typescript
type ModuleExplanationView = {
  moduleId: string;
  executionId: string;
  triggeredBecause: ExplanationFactor[];
  actions: Array<{ actionId: string; because: ExplanationFactor[] }>;
  recommendations: Array<{ recommendationId: string; because: ExplanationFactor[] }>;
  confidence: 'low' | 'medium' | 'high';
};
```

**Rules:**

- Source: sealed `ModuleResult.explanation` + ADL factor mapping
- MUST NOT expose runtime trace steps (`ENGINE_STEP`, `INPUT_VALIDATED`) — ADL TRC-03
- MUST NOT expose governance authorization decisions
- Rule-level, not stack-trace-level

### Final state: UI never calls `/trace` for user-facing explainability.

### 4.2 Execution Trace v2 (product-grade)

**Deliverable:** Replace diagnostic trace as UI-facing artifact.

```typescript
type ProductExecutionTrace = {
  executionId: string;
  moduleId: string;
  lifecycle: Array<{
    phase: 'context-resolved' | 'authorized' | 'executed' | 'enriched' | 'sealed';
    at: string;
    deterministic: true;
  }>;
};
```

**Not included:** internal state dumps, profile slice contents, normalizer selection, registry lookups.

**Migration:** `GET /api/modules/:id/trace` remains diagnostic-only with stronger `Deprecation` header; new `GET /api/modules/:id/executions/:executionId/lifecycle` for product trace.

### 4.3 Reason Mapping Layer

**Deliverable:** Explicit mapping graph:

```text
ActionItem → source field (ADL) → ExplanationFactor → user-facing reason
Recommendation → normalizer origin → ExplanationFactor → user-facing reason
```

**Package:** `packages/product-contract/src/reason-mapping/`

### 4.4 Phase 2 exit criteria

| # | Criterion |
|---|-----------|
| E1 | Explain API returns ADL-compliant factors for financial-reality + benefits-simulator |
| E2 | UI can render "why" from Explain API alone |
| E3 | ProductCode path from execute → explain without `/trace` |
| E4 | Product trace contains no forbidden TRC-03 fields |

---

## 5. Phase 3 — Module SDK (P2 CORE FOR SCALING)

**Goal:** New modules can be added **without modifying runtime or governance kernel**.

**Priority:** MUST complete before scaling beyond ~6 modules or accepting external/third-party modules.

### 5.1 Module Definition SDK

**Deliverable:** `@arrival-atlas/module-sdk`

```typescript
defineModule({ id, version, inputSchema, outputSchema, execute })
defineAction({ kind, priority, ... })
defineRecommendation({ priority, ... })
```

**Integration:** SDK output compiles to `ModuleRegistration` + `RegisteredModuleContract` spec — consumed by `bootstrapGovernedRuntime()` unchanged.

### 5.2 Module Versioning Policy

Formal rules document + CI enforcement:

| Change type | Rule |
|-------------|------|
| Input schema breaking | Major version bump; old version coexists until deprecation window |
| Output schema additive | Minor version |
| Capability removal | Major + migration guide |
| Normalizer change | Patch if output-equivalent; minor if shape change |

**Deliverable:** `docs/platform/module-versioning-policy.md` + semver gate in `validateModuleRegistration()`.

### 5.3 Module Isolation Contract

**Prohibited:**

- Cross-module `execute()` calls from within module code
- Shared mutable state between modules
- Implicit dependency graph (module A assumes module B ran)

**Enforcement:** Static analysis + runtime contract test suite.

### 5.4 Module Error Model

```typescript
type ModuleError = {
  code: string;
  category: 'validation' | 'domain' | 'policy' | 'internal';
  retryable: boolean;
  userFacingMessage: string;
};
```

**Integration:** Map governance `PolicyDecision` denials and module catch blocks to `ModuleError` at API boundary — never expose raw stack traces.

### 5.5 Phase 3 exit criteria

| # | Criterion |
|---|-----------|
| E1 | New module addable via SDK + registration only — zero kernel edits |
| E2 | Versioning policy CI gate active |
| E3 | Isolation contract tests pass |
| E4 | All module failures return `ModuleError` shape at API |

**Gate verdict:** Platform is a **module ecosystem** — safe to scale module catalog.

---

## 6. Phase 4 — Observability & Health (P2 SUPPORT)

**Goal:** Operability without exposing internals to UI.

### 6.1 System Health Layer

```text
GET /api/health/modules          (ops-only, not UI)
GET /api/health/governance       (ops-only)
```

Reports: registry frozen, contract snapshot age, module count, bootstrap integrity checksum.

### 6.2 Execution Metrics Layer

Per module (internal/ops):

- p50/p95 latency
- failure rate by `ModuleError.category`
- action/recommendation generation counts

**Not UI-facing** — feeds ops dashboard only.

### 6.3 Governance Health Checks

| Check | Detects |
|-------|---------|
| Contract drift | Bootstrap snapshot vs live Zod schema mismatch |
| Schema drift | ContractSnapshot JSON Schema stale |
| Normalizer drift | Golden fixture output change without version bump |

**Integration:** Run at bootstrap (hard fail) + periodic CI (soft alert).

### 6.4 Phase 4 exit criteria

| # | Criterion |
|---|-----------|
| E1 | Health endpoints cover registry + governance + execution |
| E2 | Drift detection fails CI on unintentional schema change |
| E3 | Metrics exported for production modules |

---

## 7. Phase 5 — UI Ready Gate (FINAL)

**Goal:** UI team builds **fully independently** from backend complexity.

### 7.1 Final guarantees

**UI sees ONLY:**

| Artifact | Source |
|----------|--------|
| `PublicModuleContract` | `/api/modules*` |
| `ContractSnapshot` | `/api/modules/:id/schema` |
| `ModuleUIProjection` | execute response + ui-snapshot projection |
| `ModuleExplanationView` | `/api/modules/:id/explain` |

**UI never sees:**

- Registry, governance kernel, execution pipeline internals
- MRC layer types (`ModuleResult` raw, `RegisteredModuleContract`)
- Diagnostic trace
- Legacy domain payloads (unless explicit compat window documented)

### 7.2 Snapshot migration (ADL §7 closure)

Complete deferred work from MRC ADL:

| Field | Migrate from | Migrate to |
|-------|--------------|------------|
| `executions[].result` | Legacy domain | `ModuleUIProjection` or sealed summary |
| `uxSnapshot.actionCards` | UX orchestrator on legacy | Derived from `moduleResult.actions` |
| Cross-module priority | UX orchestrator | Snapshot aggregation layer |

### 7.3 UI Ready checklist

| # | Item |
|---|------|
| G1 | Web app consumes only product-contract types |
| G2 | No `@arrival-atlas/core` or `@arrival-atlas/module-runtime` imports in `apps/web` |
| G3 | Module pages driven by `PublicModuleContract` + `ContractSnapshot` |
| G4 | Execute flow uses `ModuleUIProjection` only |
| G5 | Explain flow uses Explain API only |
| G6 | Contract tests enforce boundary (like today's `registry-guard-policy.test.ts`) |
| G7 | 155/155 API + expanded product-contract test suite green |

**Gate verdict:** **UI-ready + module-ready platform** — architecture-stable for frontend team parallelization.

---

## 8. Priority Matrix

### MUST DO BEFORE UI (Phase 1 — blocking)

| Item | Phase | Rationale |
|------|-------|-----------|
| Public Module Contract API | 1.1 | UI module discovery |
| ContractSnapshot | 1.2 | Form/schema rendering without Zod in frontend |
| Capability normalization | 1.3 | Feature gating without response-shape inference |
| ModuleUIProjection | 1.4 | Output sanitization — highest leak risk today |

### MUST DO BEFORE SCALE MODULES (Phase 3 — blocking for ecosystem)

| Item | Phase | Rationale |
|------|-------|-----------|
| Module SDK | 3.1 | Repeatable module authoring |
| Versioning rules | 3.2 | Safe schema evolution |
| Module error model | 3.4 | Consistent failure UX |

### STRONGLY RECOMMENDED BEFORE UI LAUNCH (Phase 2)

| Item | Phase | Rationale |
|------|-------|-----------|
| Explain API | 2.1 | Trust UX for recommendations/actions |
| Reason mapping | 2.3 | ADL-compliant "why" without trace |

### NICE TO HAVE EARLY / PARALLEL (Phase 4)

| Item | Phase | Rationale |
|------|-------|-----------|
| Governance health checks | 4.3 | Prevents drift as Phase 1 contracts land |
| Execution metrics | 4.2 | Ops visibility during UI beta |

---

## 9. Suggested Implementation Order

```text
Sprint A (Phase 1 core)
  ├── packages/product-contract (types + projectors)
  ├── GET /capabilities, GET /schema
  ├── Refactor GET /modules, GET /modules/:id → PublicModuleContract
  └── ModuleUIProjection on execute response

Sprint B (Phase 1 hardening)
  ├── ContractSnapshot at bootstrap
  ├── UI boundary contract tests
  └── Deprecation plan for legacy execute fields

Sprint C (Phase 2)
  ├── Explain API
  ├── Reason mapping layer
  └── Product execution lifecycle trace

Sprint D (Phase 3)
  ├── @arrival-atlas/module-sdk
  ├── Versioning policy + CI
  └── ModuleError at API boundary

Sprint E (Phase 4 + 5)
  ├── Health + drift detection
  ├── UiSnapshot migration (ADL §7)
  └── UI Ready gate audit
```

---

## 10. Relationship to Prior Roadmap Documents

| Document | MRC-6 meaning there | Actual state |
|----------|----------------------|--------------|
| [module-runtime-evolution-roadmap.md](../archive/module-runtime-evolution-roadmap.md) | MRC-6 = UI Snapshot Integration | **Renamed:** UI snapshot work moves to **this roadmap Phase 5** |
| Same doc | MRC-7 = Runtime Governance | **Done early** as MRC-5 debt closure + MRC-6 governance kernel |
| [mrc-adl-architecture-decision-layer.md](../core/mrc-adl.md) | §7 UX/snapshot migration at "MRC-6" | Deferred — explicit scope of **Phase 5 here** |

**Recommendation:** Add deprecation banner to old roadmap Phases MRC-6/MRC-7 pointing to this document.

---

## 11. Risk Register

| ID | Risk | Phase | Mitigation |
|----|------|-------|------------|
| R1 | UI already couples to legacy domain shapes | 1 | ModuleUIProjection + compat window with sunset |
| R2 | Triple response shape on execute (`data`, `moduleResult`, `ux`) | 1 | Single authoritative `projection`; deprecate others for UI |
| R3 | `featureFlags`/`enabled` exposed — ops vs product confusion | 1 | Split `PublicModuleContract.status` from internal flags |
| R4 | Schema endpoint stale vs live Zod | 1, 4 | ContractSnapshot frozen at bootstrap; drift CI |
| R5 | Explain API reintroduces trace leakage | 2 | ADL TRC-03 contract tests |
| R6 | SDK bypasses governance kernel | 3 | SDK compiles to registration only; no direct execute path |

---

## 12. Success Statement

| Milestone | Platform state |
|-----------|----------------|
| **Today (MRC-6)** | Correct runtime system |
| **After Phase 1** | Product-safe platform |
| **After Phase 2** | Trustworthy, explainable product surface |
| **After Phase 3** | Module ecosystem |
| **After Phase 5** | UI-ready + module-ready — architecture-stable |

The governance kernel (MRC-6) is the **foundation**. This roadmap builds the **product abstraction layer** above it without weakening deterministic execution, ADL semantics, or regression guarantees.

---

## Appendix A — Current vs Target API Comparison

| Concern | Current | Target (Phase 1+) |
|---------|---------|-------------------|
| Module list | `{ id, name, version, enabled, featureFlags }` | `PublicModuleContract[]` |
| Module detail | Same | + linked capabilities/schema URLs |
| Capabilities | Not exposed | `NormalizedCapabilities` |
| Schema | Not exposed | `ContractSnapshot.inputSchema/outputSchema` |
| Execute output | `data` + `moduleResult?` + `ux?` | `ModuleUIProjection` (+ optional legacy compat) |
| Explain | `/trace` (diagnostic) | `/explain` (product) |
| UI snapshot executions | `result: unknown` (domain) | projected from sealed envelope |

## Appendix B — Test Strategy per Phase

| Phase | New test obligation |
|-------|---------------------|
| 1 | `product-contract.test.ts` — projection sanitization, no leakage |
| 1 | `ui-boundary-policy.test.ts` — web cannot import runtime packages |
| 2 | Explain API ADL compliance fixtures |
| 3 | SDK compile → bootstrap integration test |
| 4 | Drift detection golden tests |
| 5 | Full UI Ready gate audit (P7.x style, read-only) |
