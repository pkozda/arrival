---
id: adr-001-life-event-layered-architecture
title: ADR-001 — Life Event Layered Architecture (Canonical Model)
project: Arrival Atlas
system: Arrival Atlas
type: adr
domain: life-events
status: accepted
maturity: stable
owner: engineering
created: 2026-06-20
updated: 2026-06-20
supersedes: []
related:
  - life-event-module-v2-roadmap
  - adr-002-action-vs-execution-boundary
  - adr-003-le-layer-realignment
  - adr-004-le-7-scenario-overlay
  - life-event-architecture-consistency-checklist
---

# ADR-001 — Life Event Layered Architecture (Canonical Model)

**Status:** Accepted  
**Date:** 2026-06-20  
**Scope:** Life Event Module v2 (`life-event`) — planning through UI execution adapter

---

## Context

Life Event Module v2 replaces static scenario tables with a **deterministic, profile-aware planning pipeline**. LE-1 through LE-5 are implemented. Documentation historically described phases differently (Home vs ActionSurface vs P4 vs MRC). This ADR is the **canonical architectural model** aligned with code.

---

## Decision

Adopt a **strict linear pipeline** with five completed layers (LE-1–LE-5). Each layer has a single responsibility, deterministic output, and a no-mutation policy toward upstream layers.

---

## Canonical pipeline

```text
UserContextV1 (+ optional ProfileInsightViewV1 at API boundary)
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ LE-1  Planner (packages/modules/src/life-event/plan/)         │
│       classifyLifeState → graph catalog → buildLifeEventPlan    │
│       Output: LifeEventPlanV1                                 │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ LE-2  API (apps/api)                                          │
│       GET /api/modules/life-event/plan                        │
│       Thin orchestration: context → planner → validate        │
│       Output: LifeEventPlanV1 (JSON + contract headers)       │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ LE-3  UI projection (apps/web)                                │
│       NextStepsCard, LifeEventPlanView, /modules/life-event   │
│       Consumes LifeEventPlanV1 — no planner imports           │
│       Output: rendered plan surfaces (no new domain logic)    │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ LE-4  Action surface (apps/web/lib/life-event-plan/actions)   │
│       projectActionSurface(plan) → ActionSurfaceV1          │
│       Planning-time action structuring for UI                 │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ LE-5  Execution adapter — AEAL (apps/web/.../execution/)      │
│       buildExecutionSurface(surface) → ExecutionSurfaceV1    │
│       Interaction-time decoration + safety normalization      │
└───────────────────────────────────────────────────────────────┘
```

**Parallel path (unchanged, independent):** legacy `execute()` scenario system on `/modules/life-event` — not part of LE-1–LE-5 planning chain.

---

## Layer definitions

| Layer | Name | Responsibility | Authoritative? |
|-------|------|----------------|----------------|
| LE-1 | Planner | Classify state, resolve graph, rank nodes, generate reasoning | Plan is derived, not profile-authoritative |
| LE-2 | API | Expose plan read model with contract headers | Transport only |
| LE-3 | UI | Render plan fields; fetch via API client | Presentation only |
| LE-4 | Action surface | Map plan nodes → primary/secondary/blocked/contextual buckets | Derived from plan |
| LE-5 | AEAL | Attach `executionState`, preserve identity, enforce blocked safety | Derived from action surface |

### Planning layer (LE-1)

- **Input:** `UserContextV1`, optional `ProfileInsightViewV1`
- **Output:** `LifeEventPlanV1`
- **Rules:** Deterministic; graph catalog is source of truth; no invented nodes or priorities
- **Location:** `packages/modules/src/life-event/plan/`

### API layer (LE-2)

- **Input:** Session state → `UserContextV1`, `ProfileInsightViewV1`
- **Output:** Validated `LifeEventPlanV1`
- **Rules:** No enrichment, re-ranking, or transformation beyond orchestration + schema validation
- **Location:** `apps/api/src/routes/life-event-plan.ts`, `state/life-event-plan-projection.ts`

### UI projection layer (LE-3)

- **Input:** `LifeEventPlanV1` from API
- **Output:** Home card + module page layout
- **Rules:** Dumb renderer; must not import LE-1 functions; may use LE-4/LE-5 projections
- **Location:** `apps/web/src/components/home/NextStepsCard.tsx`, `life-event/LifeEventPlanView.tsx`

### Action surface layer (LE-4)

- **Input:** `LifeEventPlanV1`
- **Output:** `ActionSurfaceV1` (`primaryAction`, `secondaryActions`, `blockedActions`, `contextualActions`)
- **Semantics:** **Planning-time structuring** — which plan nodes appear in which UI buckets
- **Rules:** Preserve planner order; cap slices only (e.g. secondary max 3); no new actions

### Execution adapter layer (LE-5 / AEAL)

- **Input:** `ActionSurfaceV1`
- **Output:** `ExecutionSurfaceV1` (`primary`, `secondary`, `blocked`, `contextual` as execution actions)
- **Semantics:** **Interaction-time adapter** — safe metadata for disabled/ready styling
- **Rules:** Identity preservation; decorate only; no module routing; no domain inference

---

## Determinism rules (LE-1 → LE-5)

| Layer | Guarantee |
|-------|-----------|
| LE-1 | Same `UserContextV1` (+ same optional insights + `generatedAt`) → same `LifeEventPlanV1` |
| LE-2 | Same session facts → same API response body |
| LE-3 | Same plan JSON → same visual structure (given stable components) |
| LE-4 | Same plan → same `ActionSurfaceV1` |
| LE-5 | Same action surface → same `ExecutionSurfaceV1` |

No randomness, no client-side re-ranking, no time-dependent logic in LE-4/LE-5.

---

## Data immutability and no-cross-layer mutation

1. **Upstream objects are read-only** to downstream layers.
2. LE-4 must not mutate `LifeEventPlanV1`.
3. LE-5 must not mutate `ActionSurfaceV1` (verified via snapshot tests).
4. UI may hold React state for loading/errors; it must not rewrite plan semantics.
5. API must not persist or alter profile state on plan reads.

---

## Explicit separations

### ActionSurfaceV1 vs ExecutionSurfaceV1

| | ActionSurfaceV1 (LE-4) | ExecutionSurfaceV1 (LE-5) |
|--|------------------------|---------------------------|
| **When** | After plan fetch, before interaction hints | Before render styling / future execution hooks |
| **Contains** | `LifeEventPlanNode` references | Flat execution actions with `executionState` |
| **Purpose** | Bucket plan nodes for UI sections | Decorate for disabled/ready/context |
| **Executable?** | **No** — structural projection only | **Prepared for** execution systems; still no side effects in AEAL |

### AEAL vs module-runtime MRC

| | AEAL (LE-5) | Module-runtime MRC (future LE-8+) |
|--|-------------|-----------------------------------|
| **Trigger** | Plan read / Home render | Post-module `execute()` success |
| **Input** | `ActionSurfaceV1` | Module output payload |
| **Output** | `ExecutionSurfaceV1` | Enriched `ModuleResult.actions` |
| **Coupling** | Web-only, life-event plan | `packages/module-runtime` normalizers |

These are **different boundaries**. AEAL must not call `resolveActions()` or module registry.

### LE-6 and LE-7 (post-pipeline overlays)

| | LE-6 Presentation dedup | LE-7 Scenario overlay |
|--|-------------------------|------------------------|
| **Role** | Home/UI reconciliation (P4 vs plan vs suggestions) | Transition reasoning (“why state may change”) |
| **Mutates plan?** | No | No |
| **Influences LE-4/LE-5?** | No — filters what Home *shows* | **No** — optional hints only; see [ADR-004](./adr-004-le-7-scenario-overlay.md) |
| **Authoritative?** | Presentation only; plan remains truth | **Not authoritative** — scenarios are interpretive overlays, not state updates |

> **LE-7 rule:** LE-7 is not allowed to influence planning, execution, or presentation decisions beyond optional hints. Scenarios are not state updates — they are interpretive overlays.

---

## Non-goals (all layers)

- No state mutation in LE-1–LE-5
- No domain inference in AEAL (no keyword → module mapping)
- No module-runtime coupling in LE-4/LE-5
- No persistence of plans
- No workflow engine or action execution in LE-5

---

## Consequences

**Positive**

- New engineers can trace one linear data flow.
- Tests are layer-isolated (fixtures → plan → surface → execution).
- Future MRC work does not collapse into AEAL.

**Negative**

- Historical roadmap/docs referencing "LE-4 = Home" or "LE-5 = P4" are obsolete — see [ADR-003](./adr-003-le-layer-realignment.md).

---

## References

| Artifact | Path |
|----------|------|
| Planner | `packages/modules/src/life-event/plan/` |
| API route | `apps/api/src/routes/life-event-plan.ts` |
| Action surface | `apps/web/src/lib/life-event-plan/actions.ts` |
| AEAL | `apps/web/src/lib/life-event-plan/execution/adapter.ts` |
| Consistency checklist | [life-event-architecture-consistency-checklist.md](./life-event-architecture-consistency-checklist.md) |
