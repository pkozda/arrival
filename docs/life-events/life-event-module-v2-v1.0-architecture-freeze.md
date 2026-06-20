---
id: life-event-module-v2-v1.0-architecture-freeze
title: Life Event Module v2 — v1.0 Architecture Freeze
project: Arrival Atlas
system: Arrival Atlas
type: specification
domain: life-events
status: frozen
maturity: stable
owner: engineering
created: 2026-06-20
updated: 2026-06-20
depends_on:
  - life-event-module-v2-roadmap
  - adr-001-life-event-layered-architecture
  - adr-002-action-vs-execution-boundary
  - adr-003-le-layer-realignment
  - adr-004-le-7-scenario-overlay
  - adr-005-le-8-module-runtime-mrc
related:
  - life-event-module-v2-spec
  - life-event-architecture-consistency-checklist
  - le-6-consistency-rules
---

# Life Event Module v2 — v1.0 Architecture Freeze

**Module:** `life-event`  
**Freeze date:** 2026-06-20  
**Status:** **FROZEN** — documentation consolidation; no runtime changes in this pass  
**Implementation track:** `arr-016` (per [roadmap](./life-event-module-v2-roadmap.md))

This document is the **single authoritative freeze spec** for Life Event Module v2 architecture. It reconciles roadmap claims, implementation reality, and ADR-001 through ADR-005.

---

## 1. Executive Summary

### What is frozen (v1.0 core)

**LE-1 through LE-5** constitute the **product core** — a deterministic, test-backed pipeline from profile context to execution-safe UI actions:

| Layer | Artifact | Location |
|-------|----------|----------|
| LE-1 | `LifeEventPlanV1` | `packages/modules/src/life-event/plan/` |
| LE-2 | `GET /api/modules/life-event/plan` | `apps/api/src/routes/life-event-plan.ts` |
| LE-3 | Home + module UI | `apps/web/src/components/home/`, `apps/web/src/components/life-event/` |
| LE-4 | `ActionSurfaceV1` | `apps/web/src/lib/life-event-plan/actions.ts` |
| LE-5 | `ExecutionSurfaceV1` (AEAL) | `apps/web/src/lib/life-event-plan/execution/` |

**Freeze boundary:** LE-5 is the last **authoritative** layer. Everything downstream is optional.

### What is optional (non-authoritative overlays)

| Layer | Name | Status | Integration |
|-------|------|--------|-------------|
| LE-6 | Presentation Dedup | **Active** on Home | `buildHomePlanViewModelV2` |
| LE-7 | Scenario Overlay | **Active** on Home (banner) | `resolveScenario` → `NextStepsCard` |
| LE-8 | Runtime MRC | **Library-only** | **Not wired** to execution flow |

Overlays are **removable**. Deleting LE-6–LE-8 code paths leaves LE-1–LE-5 behavior unchanged.

### What is explicitly out of scope (v1.0)

| Item | Status |
|------|--------|
| LE-2.5 — `execute()` `currentStatus` prefill from profile | **Not implemented** |
| Counterfactual scenario engine (`buildScenarioPlan`) | **Not implemented** |
| `EVENT_HANDLERS` extraction to `scenarios/*.ts` | **Not implemented** |
| LE-8 runtime wiring to module execution | **Not wired** |
| Full removal of `SuggestedModulesSection` | **Not implemented** (semantic suppression only) |
| `packages/module-runtime` server MRC for life-event | **Platform backlog** (separate from web LE-8) |

---

## 2. Canonical Architecture Pipeline

### Core pipeline (frozen)

```text
UserContextV1 (+ ProfileInsightViewV1 at API boundary only)
        │
        ▼
   LE-1  Planner ─────────────────────────► LifeEventPlanV1
        │                                    (packages/modules/.../plan/)
        ▼
   LE-2  API ───────────────────────────────► GET /api/modules/life-event/plan
        │
        ▼
   LE-3  UI projection ───────────────────► NextStepsCard, LifeEventPlanView
        │                                    (no planner imports in web)
        ▼
   LE-4  ActionSurfaceV1 ─────────────────► projectActionSurface(plan)
        │                                    planning-time buckets only
        ▼
   LE-5  ExecutionSurfaceV1 (AEAL) ───────► buildExecutionSurface(surface)
                                             interaction metadata only
```

### Parallel path (unchanged, independent)

Legacy `execute()` scenario system (`EVENT_HANDLERS` in `packages/modules/src/life-event/index.ts`) runs on `/modules/life-event` below the plan view. It is **not** part of the LE-1–LE-5 planning chain.

### Optional overlays (non-authoritative)

```text
LE-1…LE-5 core output
        │
        ├─► LE-6  Presentation Dedup ──► HomePlanViewModelV2 (Home only)
        │         mergeP4WithPlan + dedupeHomeSurfaces
        │
        ├─► LE-7  Scenario Overlay ────► ScenarioMatchV1 (optional banner)
        │         resolveScenario — interpretive only
        │
        └─► LE-8  Runtime MRC ─────────► processModuleRuntimeEvent (library-only)
                  post-execution normalization — not wired
```

### Timing model

| Layer | When | Question answered |
|-------|------|-------------------|
| LE-1 | Pre-runtime | What should I do now? |
| LE-4 | Pre-execution | How are plan nodes structured for UI? |
| LE-5 | Execution-time | How should each action be styled/safeguarded? |
| LE-7 | Interpretive (parallel) | Why might my situation state apply? |
| LE-8 | Post-execution | What changed after a module action? |

---

## 3. Core System (v1.0 Frozen Contract)

LE-1 through LE-5 are **immutable behavioral contracts** for v1.0. Changes require a new architecture version (v1.1+), not silent drift.

### LE-1 — Planner

- **Input:** `UserContextV1`, optional `ProfileInsightViewV1` (API boundary)
- **Output:** `LifeEventPlanV1`
- **Source of truth:** Graph catalog G1–G7 (`GRAPH_CATALOG_V1`)
- **Tests:** 45 classifier fixture tests (F01–F24)

### LE-2 — API

- **Endpoint:** `GET /api/modules/life-event/plan`
- **Rule:** Thin orchestration — `resolveUserContext` → `buildLifeEventPlan` → validate → headers
- **Tests:** 28 API fixture parity tests

### LE-3 — UI

- **Rule:** Consumes plan via API client only; **no** `buildLifeEventPlan` imports in `apps/web`
- **Surfaces:** `NextStepsCard` (Home), `LifeEventPlanView` (`/modules/life-event`)

### LE-4 — ActionSurfaceV1

- **Rule:** Planning-time structuring only — **not executable**
- **Buckets:** `primaryAction`, `secondaryActions` (≤3), `blockedActions`, `contextualActions`
- **Tests:** 76 action surface tests

### LE-5 — ExecutionSurfaceV1 (AEAL)

- **Rule:** Decorate only — **never reinterpret** plan semantics
- **Identity:** `executionAction.id === LifeEventPlanNode.id` (no new IDs)
- **Tests:** 54 adapter tests

### Core invariants

| Invariant | Applies to |
|-----------|------------|
| Planning determinism | Same `UserContextV1` (+ same optional insights + `generatedAt`) → same `LifeEventPlanV1` |
| Action identity stability | `action.id` unchanged LE-1 → LE-4 → LE-5 |
| Execution non-mutability | LE-5 does not mutate `ActionSurfaceV1` or `LifeEventPlanV1` |
| No cross-layer contamination | LE-3–LE-5 do not call classifier, graph catalog, or planner |
| API read-only | Plan endpoint does not mutate profile or persist plans |

---

## 4. Optional Overlay System

> **Overlays are non-authoritative and removable.**

### LE-6 — Presentation Dedup

| Property | Value |
|----------|-------|
| **Status** | **Active** on Home |
| **Code** | `apps/web/src/lib/life-event-plan/p4-merge.ts`, `home-dedup.ts`, `presentation-v2.ts` |
| **Behavior** | Semantic suppression of P4 hints and legacy module suggestions when plan already covers intent |
| **Does not** | Mutate `LifeEventPlanV1`, `ActionSurfaceV1`, or `ExecutionSurfaceV1` |
| **Rules doc** | [le-6-consistency-rules.md](./le-6-consistency-rules.md) |

### LE-7 — Scenario Overlay

| Property | Value |
|----------|-------|
| **Status** | **Active** on Home (`NextStepsCard` optional banner) |
| **Code** | `apps/web/src/lib/life-event/scenarios/` |
| **Behavior** | `resolveScenario()` — interpretive transition reasoning |
| **Does not** | Influence planner, API, ActionSurface, ExecutionSurface, or LE-6 dedup |
| **ADR** | [ADR-004](../adr/adr-004-le-7-scenario-overlay.md) |

Key rules (ADR-004):

- LE-7 is not allowed to influence planning, execution, or presentation decisions beyond optional hints.
- Scenarios are not state updates — they are interpretive overlays.

`buildScenarioPlanHints()` exists as a read-only bridge but is **not wired** to UI.

### LE-8 — Runtime MRC (library)

| Property | Value |
|----------|-------|
| **Status** | **Library-only** — **not wired** |
| **Code** | `apps/web/src/lib/life-event/runtime/` |
| **Behavior** | `processModuleRuntimeEvent()` — post-execution effect normalization |
| **Does not** | Access plan, ActionSurface, ExecutionSurface, or scenario resolver |
| **ADR** | [ADR-005](../adr/adr-005-le-8-module-runtime-mrc.md) |

`RuntimeCrossModuleFeedback` and `runtimeEffect` prop on `NextStepsCard` exist but receive **no data** from Home or module execution paths in v1.0.

### Removability guarantee

| If removed… | LE-1–LE-5 behavior |
|-------------|---------------------|
| LE-6 (`presentation-v2`, dedup) | Unchanged — Home reverts to undeduped P4 + suggestions |
| LE-7 (`scenarios/`) | Unchanged — no scenario banner |
| LE-8 (`runtime/`) | Unchanged — no runtime feedback |

---

## 5. Roadmap vs Reality Reconciliation

| Topic | Roadmap claim | Implementation reality | Freeze resolution |
|-------|---------------|------------------------|-------------------|
| **LE numbering drift** | Original: LE-4=Home, LE-5=P4, LE-7=MRC | Canonical per ADR-003: LE-4=ActionSurface, LE-5=AEAL, LE-6=P4 dedup, LE-7=Scenario, LE-8=MRC | **ADR-003 is authoritative** |
| **MVP scope** | "LE-1 through LE-5" | LE-6–LE-8 also shipped as overlays | **MVP = LE-1–LE-5 core**; LE-6–LE-8 are optional extensions |
| **LE-2.5** | `execute()` prefill from profile | Not implemented | **v1.1 backlog** |
| **LE-6 SuggestedModules** | "Remove legacy section" | **Active** with semantic suppression when plan overlaps | **Dedup-only** in v1.0; full removal is backlog |
| **LE-7 naming** | "Scenario refactor" | Interpretive overlay (`resolveScenario`), not content refactor | **Renamed: Scenario Overlay** per ADR-004 |
| **LE-7 counterfactual** | Implied in early designs | `buildScenarioPlan` not implemented | **Explicit non-goal** |
| **EVENT_HANDLERS** | Extract to `scenarios/` | Still inline in `packages/modules/src/life-event/index.ts` | **Backlog** — legacy execute path unchanged |
| **LE-8 wiring** | Post-execution MRC | Library complete; **not wired** to `ContractModulePage` / execution | **Library-only** in v1.0 |
| **Server MRC** | Platform integration | `packages/module-runtime` separate from web LE-8 | **Platform track** — not part of this freeze |

### Test coverage at freeze

| Package | Scope | Tests |
|---------|-------|-------|
| `packages/modules` | LE-1 classifier + plan | 45 |
| `apps/api` | LE-2 plan API | 28 |
| `apps/web` | LE-3–LE-8 web layers | 213 |

All green at freeze date.

---

## 6. Explicit Non-Goals (v1.0)

The following are **out of scope** for v1.0 and must not be implied by freeze documentation:

1. **No counterfactual scenario engine** — no re-run of LE-1 under patched context (`buildScenarioPlan`).
2. **No execute prefill (LE-2.5)** — `currentStatus` in legacy execute form is not profile-derived.
3. **No runtime MRC integration** — `processModuleRuntimeEvent` is not called from execution paths.
4. **No planner modifications** beyond the frozen LE-1 contract without a version bump.
5. **No new life states or graph catalog changes** without fixture + ADR update.
6. **No persistence** of plans, scenarios, or runtime session state.
7. **No scenario-driven plan mutation** — LE-7 cannot override classifier or plan output.
8. **No full removal** of `SuggestedModulesSection` — only overlap suppression.

---

## 7. Architecture Invariants (Frozen Rules)

These rules are **immutable** for v1.0. Enforced by ADRs, boundary tests, and consistency checklist.

### Identity and mutation

| Rule | Enforcement |
|------|-------------|
| **Action identity = `node.id`** | ADR-002; LE-5 adapter tests |
| **ExecutionSurface cannot mutate ActionSurface** | ADR-002; snapshot tests |
| **No layer mutates upstream objects** | ADR-001; LE-6 rules |
| **No new action/node IDs in LE-4 or LE-5** | `actions.ts`, `adapter.ts` guards |

### Layer isolation

| Rule | Enforcement |
|------|-------------|
| **Web does not import LE-1 planner** | `life-event-plan-boundary.test.ts` |
| **Scenario cannot influence planner** | ADR-004; `scenario-boundary.test.ts` |
| **Dedup cannot affect plan** | LE-6 consistency rules |
| **Runtime cannot access plan/surface/scenario** | ADR-005; `runtime-boundary.test.ts` |

### Overlay rules

| Rule | Statement |
|------|-----------|
| **Overlays must be removable** | Delete LE-6/7/8 → LE-1–LE-5 identical |
| **Overlays are non-authoritative** | Plan is always truth for actions and priorities |
| **LE-8 signals are advisory** | `advisoryOnly: true` on all `CrossModuleSignalV1` |

### Determinism

Same inputs → identical outputs at every layer (LE-1 through LE-8 library functions).

---

## 8. Final System Statement

**Life Event Module v2 v1.0** is a **deterministic, layered architecture** whose **product core** is LE-1 through LE-5: a profile-aware planner produces `LifeEventPlanV1`, exposed through a thin API, rendered in UI, structured into `ActionSurfaceV1`, and decorated for safe interaction via `ExecutionSurfaceV1` (AEAL). LE-6 (Presentation Dedup), LE-7 (Scenario Overlay), and LE-8 (Runtime MRC library) are **optional, non-authoritative contextual systems** that may enrich Home presentation or post-execution reasoning but **cannot change what the plan says or how actions execute**. The freeze boundary is **LE-5**. Everything after it is ignorable overlay code. v1.0 is test-backed, ADR-governed, and suitable for a release tag; known gaps (LE-2.5, counterfactual scenarios, LE-8 wiring, full legacy Home cleanup) are explicitly deferred to v1.1+.

---

## References

| Document | Path |
|----------|------|
| Roadmap | [life-event-module-v2-roadmap.md](./life-event-module-v2-roadmap.md) |
| Specification | [life-event-module-v2-spec.md](./life-event-module-v2-spec.md) |
| ADR-001 Layered architecture | [adr-001-life-event-layered-architecture.md](../adr/adr-001-life-event-layered-architecture.md) |
| ADR-002 Action vs execution | [adr-002-action-vs-execution-boundary.md](../adr/adr-002-action-vs-execution-boundary.md) |
| ADR-003 LE realignment | [adr-003-le-layer-realignment.md](../adr/adr-003-le-layer-realignment.md) |
| ADR-004 LE-7 scenario overlay | [adr-004-le-7-scenario-overlay.md](../adr/adr-004-le-7-scenario-overlay.md) |
| ADR-005 LE-8 runtime MRC | [adr-005-le-8-module-runtime-mrc.md](../adr/adr-005-le-8-module-runtime-mrc.md) |
| Consistency checklist | [life-event-architecture-consistency-checklist.md](../adr/life-event-architecture-consistency-checklist.md) |
| LE-6 rules | [le-6-consistency-rules.md](./le-6-consistency-rules.md) |
