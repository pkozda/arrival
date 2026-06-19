# UI Architecture Audit — Frontend Scalability & Contract Alignment

**Mode:** Read-only Architecture Audit  
**Scope:** Entire `apps/web` application  
**System:** Arrival Atlas (ArrivalOS)  
**Date:** 2026-06-18  
**Purpose:** Assess frontend architecture after UI Ready Gate completion

---

## Executive Summary

The Arrival Atlas frontend has **successfully evolved from an application UI to a contract-driven platform UI**. The web layer is a thin Next.js shell (32 source files) with **zero hardcoded module IDs**, **one generic dynamic route**, and **no runtime package imports** in source.

New modules can be added with **zero frontend file changes** when registered on the backend with a public contract and schema. Navigation, routing, forms, execution rendering, and explain UI are fully generic.

Remaining gaps are **architectural maturity items**, not contract violations: capabilities are available in the catalog but unused for feature gating, category metadata is ignored, dashboard presentation applies hardcoded priority heuristics, and schema-driven forms support a limited JSON Schema subset. These limit scale beyond moderate module counts without UX restructuring — not module addition itself.

**Frontend Maturity Level:** **Level 4 — Contract-Driven Platform UI**

**Final Verdict:** **READY FOR MODERATE SCALE**

---

## Frontend Maturity Level

### Level 4 — Contract-Driven Platform UI

| Level | Definition | Match |
|-------|------------|-------|
| Level 1 — Hardcoded Application UI | Per-module pages, domain parsing | ❌ Eliminated |
| Level 2 — Modular UI | Reusable components, some hardcoding | ❌ Surpassed |
| Level 3 — Contract-Aligned UI | Consumes product-contract types | ✅ Baseline met |
| **Level 4 — Contract-Driven Platform UI** | **Generic module shell driven by contracts** | **✅ Current state** |
| Level 5 — Self-Extending Platform UI | Capabilities/categories drive UI; unknown schemas fully supported | ❌ Not yet |

**Justification:**

- All module flows route through `PublicModuleContract`, `ContractSnapshot`, `ModuleUIProjection`, `ModuleExplanationView`, and `UiSnapshot` projection fields.
- `@/lib/product-contract` is the sole bridge to `@arrivalos/product-contract`; CI enforces boundary via `web-package-boundary.test.ts`.
- No `switch(moduleId)`, no module-specific components, no legacy domain payload parsing.

**Why not Level 5:**

- `NormalizedCapabilities` is never consumed for conditional rendering.
- `metadata.category` exists on contracts but UI renders a flat module list.
- `SchemaForm` handles a subset of JSON Schema types (no arrays, formats, or client-side validation).
- Dashboard applies frontend-owned priority filtering (`high`/`critical`, top-2 attention slice).

---

## Module Scalability Findings

### Scalability Matrix

| Area | Classification | Evidence |
|------|----------------|----------|
| **Navigation** | **Fully Dynamic** | `Header.tsx` builds nav from `useApp().modules`, filtered `status === 'available'`, sorted by `title` |
| **Module Discovery** | **Fully Dynamic** | `fetchModuleCatalog()` in `AppProvider`; home grid uses same catalog |
| **Module Pages** | **Fully Dynamic** | Single route `app/modules/[moduleId]/page.tsx` → `ContractModulePage` |
| **Forms** | **Fully Dynamic** | `SchemaForm` + `fetchModuleSchema()` + `deriveDefaultValues()` / `extractSchemaFields()` |
| **Results Rendering** | **Fully Dynamic** | `ModuleProjectionRenderer` renders generic `ModuleUIProjection` shape |
| **Explain UI** | **Fully Dynamic** | `ExplainPanel` + `useModuleExplanation` → `GET /explain` only |
| **Dashboard Integration** | **Partially Dynamic** | Snapshot sections use projection types; module grid uses catalog + snapshot summaries; priority heuristics are hardcoded in selectors |

### Required Finding: Files to Change for a Brand-New Module

**Answer: 0 frontend files.**

Adding a module requires only backend steps:

1. Register module in the module catalog / SDK pipeline
2. Publish `PublicModuleContract` via `GET /api/modules`
3. Expose input schema via `GET /api/modules/:id/schema`

The frontend automatically:

- Adds navigation links (`Header.tsx`)
- Adds home grid cards (`HomeSnapshotRenderer.tsx`)
- Resolves `/modules/{newModuleId}` via dynamic route
- Generates forms from schema
- Renders execution and explain output generically

No routing registration, no new page files, no form overrides, no renderer forks.

---

## Contract Coverage Findings

### Coverage Table

| Contract | Available (API / package) | Consumed in `apps/web` | Coverage % |
|----------|----------------------------|------------------------|------------|
| **PublicModuleContract** | ✅ `GET /api/modules`, `GET /api/modules/:id` | Navigation, discovery, page titles, icons, status filter | **~75%** |
| **ContractSnapshot** | ✅ `GET /api/modules/:id/schema` | Form field extraction, defaults, profile merge | **~60%** |
| **NormalizedCapabilities** | ✅ Embedded in catalog; also `GET /capabilities` | **Not consumed** | **0%** |
| **ModuleUIProjection** | ✅ Execute response + ui-snapshot | All result rendering (`ModuleProjectionRenderer`) | **~95%** |
| **ModuleExplanationView** | ✅ `GET /api/modules/:id/explain` | Sole reasoning source (`ExplainPanel`) | **100%** |
| **UiSnapshotProjection** | ✅ `GET /api/ui-snapshot` | Dashboard sections, recent executions, per-module state | **~85%** |

### PublicModuleContract — Detail

| Use case | Consumed? | Location |
|----------|-----------|----------|
| Navigation | ✅ | `Header.tsx` — `module.title`, `module.metadata.icon` |
| Discovery / home grid | ✅ | `HomeSnapshotRenderer.tsx` — `module.title`, `module.description` |
| Module metadata on page | ✅ | `ContractModulePage.tsx` — `contract.title`, `contract.description` |
| Status filtering | ✅ | `status === 'available'` in Header and home grid |
| Grouping by category | ❌ | `metadata.category` never read |
| Filtering by capabilities | ❌ | `contract.capabilities` never read |
| Per-module contract fetch | ❌ | `fetchModuleContract()` defined in `api.ts` but unused |

### ContractSnapshot — Detail

| Use case | Consumed? | Location |
|----------|-----------|----------|
| Form generation | ✅ | `ContractModulePage` → `extractSchemaFields(schema.inputSchema)` |
| Defaults | ✅ | `deriveDefaultValues()` + `mergeProfileIntoDefaults()` |
| Validation | ❌ | No client-side schema validation; server validates on execute |
| Output schema / documentation | ❌ | `outputSchema` not fetched or displayed |

### Capabilities — Detail

`PublicModuleContract.capabilities` is returned in the catalog response but **never referenced** in any component. There is no `fetchModuleCapabilities()` client. UI does not gate:

- Explain panel visibility (`supports.explanation`)
- Recommendations section (`supports.recommendations`)
- Actions section (`supports.actions`)
- Risk-related UI (`supports.riskModel`)

All sections render based on projection content presence, not capability flags.

### ModuleUIProjection — Detail

| Path | Uses projection? | Notes |
|------|------------------|-------|
| Module page results | ✅ | `useModuleSnapshot` → `uiState.projection` → `ModuleExecutionPanel` |
| Home recent executions | ✅ | `execution.projection` → `ModuleProjectionRenderer` |
| Execute response direct render | ❌ (by design) | Execute triggers snapshot refresh; UI reads from snapshot |
| `projection.explanation` inline | ❌ (correct) | Not rendered; explain comes from Explain API only |
| Legacy `data` / `ux` paths | ❌ | Not present in web source |

**Alternate rendering paths:** None. Single renderer (`ModuleProjectionRenderer`) for all modules.

### ModuleExplanationView — Detail

| Check | Result |
|-------|--------|
| Only reasoning source | ✅ `ExplainPanel` renders `ModuleExplanationView` exclusively |
| Reasoning reconstruction in UI | ❌ None found |
| `/trace` usage | ❌ None in `apps/web` |
| `projection.explanation` fallback | ❌ Not used (correct per Phase 5B boundary) |

---

## Domain Knowledge Findings

### Search Results

| Pattern | Occurrences in `apps/web/src` |
|---------|-------------------------------|
| `switch(moduleId)` | **0** |
| `if (moduleId === '...')` | **0** |
| Hardcoded module slugs (`financial-reality`, etc.) | **0** |
| Module-specific components | **0** |
| Module-specific defaults | **0** |

### Classified Findings

| Finding | Location | Severity | Classification |
|---------|----------|----------|----------------|
| Priority filter: `high` / `critical` only | `get-global-ux.ts` L12–14 | Low | UI-only concern — dashboard presentation heuristic |
| Attention layer: top 2 high-priority cards | `get-global-ux.ts` L17–18 | Low | UI-only concern — dashboard curation rule |
| Explain factor type labels (`input` → "Your input") | `ExplainPanel.tsx` L9–21 | Low | UI-only concern — presentation mapping |
| Session bootstrap defaults (`language: 'en'`, `theme: 'light'`) | `AppProvider.tsx` L136–140 | Low | UI-only concern — first-session fallback |
| Field label camelCase → Title Case | `schema-form-utils.ts` L53–61 | Low | UI-only concern — display formatting |
| Hardcoded dashboard section titles | `HomeSnapshotRenderer.tsx` | Low | UI-only concern — copy, not domain logic |
| `status === 'available'` filter | `Header.tsx`, `HomeSnapshotRenderer.tsx` | None | Uses contract field correctly |
| Shallow profile → schema merge | `mergeProfileIntoDefaults()` (contract helper) | Low | Contract-aligned but limited depth |

**Contract violations:** **None identified.**

**Domain duplication:** **None identified.** No business rules, eligibility logic, or module-domain payload parsing in the frontend.

---

## Dashboard Findings

### Data Sources

| Dashboard section | Source | Module-specific? |
|-------------------|--------|------------------|
| Session | `UiSnapshot.session` | No |
| First-time experience | `UiSnapshot.ftu` | No |
| Profile | `UiSnapshot.profile` | No |
| Attention layer | `getAttentionLayer(snapshot)` | No — generic action cards |
| Action cards | `getGlobalUxActions(snapshot)` | No |
| Priority signals | `getPrioritySignals(snapshot)` | No — filtered recommendations |
| Module grid | **`useApp().modules`** (catalog) + `snapshot.summaries` | No — but catalog-driven, not snapshot.modules |
| Recent executions | `snapshot.executions[]` with projections | No |

### Scale Assessment

| Scenario | Assessment |
|----------|------------|
| **20 modules** | ✅ Works today — CSS grid `auto-fill, minmax(280px, 1fr)` scales; flat nav drawer grows linearly |
| **50 modules** | ⚠️ Functional but UX-degraded — ungrouped flat nav and home grid become unwieldy; no search, pagination, or category tabs |
| **Redesign required?** | Not for correctness; **yes for usability** at ~30+ modules without category grouping |

### Module / Action Type Dependency

Dashboard does **not** depend on specific module IDs or action kinds. It depends on:

- Generic `ActionCard`, `SnapshotRecommendation`, `ExecutionSnapshot` shapes from snapshot projection
- Frontend-owned priority heuristics (not module-specific)

---

## Routing Findings

### Current Model

```text
app/
  page.tsx                    → Home / dashboard
  modules/[moduleId]/page.tsx → Generic module shell
```

| Question | Answer |
|----------|--------|
| Truly generic? | **Yes** — parametric `moduleId`, catalog lookup, 404 on unknown ID |
| Module-specific screens? | **None** — all modules use `ContractModulePage` |
| Route registration required for new modules? | **No** |
| Future modules appear automatically? | **Yes** — when catalog includes them with `status: 'available'` |

### Routing Classification: **Fully Dynamic**

---

## State Management Findings

### Architecture

Single global React Context (`AppProvider`) + local component state. No Redux, Zustand, or global stores.

### State Duplication Report

| State | Source of Truth | Duplicate Exists? | Notes |
|-------|-----------------|-------------------|-------|
| Module catalog | `GET /api/modules` | Client cache in `AppProvider.modules` | Required client copy; not a type mirror |
| UI snapshot | `GET /api/ui-snapshot` | Client cache in `AppProvider.uiSnapshot` | Version-gated updates via `snapshotVersion` |
| Execution projection | Snapshot `executionsByModuleId` | View model `ModuleUIState` in `snapshot/types.ts` | Thin selector wrapper; not a parallel domain model |
| Explanation | `GET /api/explain` | Ephemeral cache in `useModuleExplanation` | Fetch-on-demand; correct pattern |
| Profile | Snapshot `profile` | Used for form defaults only | No separate profile store |
| Recommendations / actions | Snapshot projection fields | Rendered directly or via selectors | No duplicate recommendation state |
| Session / theme / language | Snapshot session + API PATCH | Derived in `AppProvider` via selectors | Aligned with contract types |
| Translations | `GET /api/i18n/:lang` | Local `translations` map | i18n cache, not contract duplication |

**Verdict:** No problematic duplication of product contract semantics. View-model types (`ModuleExecutionView`, `ModuleUIState`, `SnapshotReconstruction`) are thin presentation layers over snapshot data.

---

## Generic UI Capability Audit

| Capability | Status | Limitation |
|------------|--------|------------|
| **Dynamic Forms** | ✅ **Yes** | Subset only: object, boolean, enum, number/integer, text. No arrays, `oneOf`, formats, or nested validation |
| **Dynamic Execution** | ✅ **Yes** | Any module returning `ModuleUIProjection` |
| **Dynamic Explanations** | ✅ **Yes** | Any module with explain API response |
| **Dynamic Recommendations** | ✅ **Yes** | Renders `SanitizedRecommendation[]` generically |
| **Dynamic Actions** | ✅ **Yes** | Renders `SanitizedAction[]` generically |
| **Dynamic Dashboard** | ⚠️ **Partial** | Renders unknown modules in grid; priority/attention rules are fixed heuristics |

**Can the UI render unknown future modules without code changes?** **Yes**, for core execute/explain flows. **Partially**, for complex schemas (arrays, conditional fields) and capability-gated layouts.

---

## Technical Debt Register

Architecture debt only. Excludes styling, design, accessibility, animations.

| Debt | Severity | Location | Impact |
|------|----------|----------|--------|
| Capabilities never consumed for feature gating | **Medium** | Entire web app | UI cannot adapt layout to module capability flags; scales poorly for heterogeneous modules |
| `metadata.category` unused — flat module list | **Medium** | `Header.tsx`, `HomeSnapshotRenderer.tsx` | Blocks category-based navigation at scale |
| `fetchModuleContract()` dead code | **Low** | `api.ts` L111–117 | Unused API wrapper; catalog sufficient today |
| Dead snapshot selectors exported but unused | **Low** | `get-module-ux.ts`, `hasGlobalUx`, `getUiPreferences`, `getTheme` | Maintenance noise |
| Stale `transpilePackages: ['@arrivalos/core']` | **Low** | `next.config.mjs` L3 | Config drift; no runtime impact |
| Dashboard priority heuristics in frontend selectors | **Medium** | `get-global-ux.ts` | Presentation rules should eventually live in snapshot aggregation or contract metadata |
| Schema form JSON Schema subset | **Medium** | `SchemaForm.tsx` | Complex future modules may need richer form generation |
| Shallow `mergeProfileIntoDefaults` | **Low** | Contract helper used by web | Nested profile fields may not map to schema paths |
| Dual explain UX pattern | **Low** | `ModuleExecutionPanel` (auto-fetch) vs `ExecutionExplainToggle` (lazy) | Inconsistent explain loading behavior between module page and home |
| Module grid uses catalog, not snapshot | **Low** | `HomeSnapshotRenderer.tsx` L139 | `UiSnapshot` includes session state; catalog is authoritative for discovery — acceptable but dual-source |
| `NormalizedCapabilities` re-exported, never imported | **Low** | `product-contract.ts` L15 | Dead re-export |
| No client-side schema validation | **Low** | `SchemaForm.tsx` | Server validates; UX feedback delayed until submit |

**Critical architecture debt:** **None.**

---

## Future Scale Simulation

### Scenario A — Add 1 New Module

| Layer | Files to change |
|-------|-----------------|
| Frontend | **0** |
| Backend | Module registration + SDK catalog entry (outside audit scope) |

**Breaks:** Nothing, assuming schema is within supported JSON Schema subset and module returns standard projection shapes.

### Scenario B — Add 10 Modules

| Area | Impact |
|------|--------|
| Routing | ✅ No change |
| Navigation | ✅ Auto-expands; drawer list grows |
| Forms / execution / explain | ✅ No change |
| Dashboard grid | ✅ CSS grid absorbs cards |
| UX | ⚠️ Flat ungrouped list becomes long; no search or categories |

**Breaks:** Nothing functionally. Usability degrades without grouping.

### Scenario C — Add External Third-Party Modules

| Requirement | Ready? |
|-------------|--------|
| Contract-compliant API surface | ✅ Frontend consumes generic contracts |
| Unknown module IDs | ✅ Dynamic route handles any ID |
| Unknown schemas (complex) | ⚠️ Form renderer may fail on unsupported schema types |
| Capability-driven UI differences | ❌ Capabilities ignored — third-party modules cannot signal UI feature presence |
| Entitlement / restricted status | ⚠️ `status: 'restricted'` filtered from nav but no entitlement UX |

**Breaks:** Complex schemas; modules expecting capability-gated UI layouts.

### Scenario D — Add Module Categories (Healthcare, Housing, Education, Employment, Family, Legal)

| Question | Answer |
|----------|--------|
| Contract supports categories? | ✅ `PublicModuleContract.metadata.category` exists |
| UI supports categories today? | ❌ No grouping, tabs, or filters by category |
| Immediate support? | **No** — requires frontend architecture work (category-aware nav/grid) |

---

## Final Verdict

### READY FOR MODERATE SCALE

The frontend is a **contract-driven platform UI** suitable for:

- Parallel frontend/backend development against stable contracts
- Adding modules without frontend refactors (within supported schema shapes)
- Moderate catalog growth (~6–20 modules)

It is **not yet platform-ready for large-scale or third-party ecosystem** scenarios due to:

- Unused capability model (0% coverage)
- No category-based discovery
- Limited schema form renderer
- Flat navigation without search or grouping at high module counts

These are **scale and maturity gaps**, not regressions from the UI Ready Gate.

---

## Recommended Next Architectural Step

**Wire `NormalizedCapabilities` into the generic module shell** — consume capability flags already present on `PublicModuleContract` (or via `/capabilities`) to conditionally render explain, recommendations, actions, and risk sections in `ModuleExecutionPanel` and `ModuleProjectionRenderer`.

This is the highest-leverage step toward Level 5 without introducing module-specific code: the UI becomes capability-driven rather than content-presence-driven, enabling heterogeneous modules and third-party authors to signal feature support through the existing contract layer.

Secondary follow-on (when catalog exceeds ~15 modules): **category-aware discovery** using `metadata.category` for grouped navigation and dashboard sections — still fully generic, no per-module code.

---

## Audit Metadata

| Item | Value |
|------|-------|
| Files audited | 32 under `apps/web/src/` |
| Hardcoded module IDs | 0 |
| Dynamic routes | 1 (`/modules/[moduleId]`) |
| Forbidden package imports in source | 0 |
| Boundary tests | `web-package-boundary.test.ts`, `explain-ui-boundary.test.ts`, `snapshot-boundary.test.ts` |
| Related audits | [ui-ready-gate-audit.md](./ui-ready-gate-audit.md), [roadmap-vs-current-state.md](./roadmap-vs-current-state.md) |
