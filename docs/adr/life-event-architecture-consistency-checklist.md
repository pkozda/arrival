---
id: life-event-architecture-consistency-checklist
title: Life Event Architecture — Consistency Checklist
project: Arrival Atlas
system: Arrival Atlas
type: checklist
domain: life-events
status: active
maturity: stable
owner: engineering
created: 2026-06-20
updated: 2026-06-20
related:
  - adr-001-life-event-layered-architecture
  - adr-002-action-vs-execution-boundary
  - adr-003-le-layer-realignment
  - adr-004-le-7-scenario-overlay
---

# Life Event Architecture — Consistency Checklist

Use this checklist for PRs, reviews, and onboarding. Aligned with [ADR-001](./adr-001-life-event-layered-architecture.md).

---

## Pipeline integrity

- [ ] Changes respect linear flow: `UserContext` → `LifeEventPlanV1` → API → UI → `ActionSurfaceV1` → `ExecutionSurfaceV1`
- [ ] No layer skips upstream contracts (e.g. UI does not call `classifyLifeState` directly)
- [ ] Legacy `execute()` scenario path remains independent of LE-1–LE-5

---

## Per-layer rules

### LE-1 Planner

- [ ] Deterministic: same input → same `LifeEventPlanV1`
- [ ] Graph catalog G1–G7 is sole source of nodes and dependencies
- [ ] No new life states, graph types, or fixture-defying classification
- [ ] Lives in `packages/modules/src/life-event/plan/`

### LE-2 API

- [ ] Thin orchestration only (`resolveUserContext` → `buildLifeEventPlan` → validate)
- [ ] Contract headers present (`x-module-id`, `x-plan-authority`, etc.)
- [ ] No re-ranking, caching, or plan mutation on read
- [ ] Lives in `apps/api/`

### LE-3 UI

- [ ] Consumes API / `LifeEventPlanV1` only — no LE-1 imports in `apps/web`
- [ ] Pure projection — no client-side priority logic
- [ ] Home + module page use same plan contract

### LE-4 Action surface

- [ ] `projectActionSurface` is pure function
- [ ] Does not mutate `LifeEventPlanV1`
- [ ] Preserves order; caps are slice-only (secondary ≤ 3)
- [ ] Does not introduce new action IDs or nodes

### LE-5 AEAL

- [ ] `buildExecutionSurface` is pure function
- [ ] Does not mutate `ActionSurfaceV1`
- [ ] `id` unchanged from plan node id
- [ ] No module mapping, domain inference, or MRC coupling
- [ ] Blocked IDs never appear in primary/secondary/contextual
- [ ] UI fallback works when `executionSurface={null}`

### LE-6 Presentation dedup

- [ ] Does not mutate `LifeEventPlanV1`, `ActionSurfaceV1`, or `ExecutionSurfaceV1`
- [ ] Dedup is semantic / presentation-only (see [le-6-consistency-rules.md](../life-events/le-6-consistency-rules.md))

### LE-7 Scenario overlay

- [ ] Does not import planner, ActionSurface, ExecutionSurface, or LE-6 dedup modules
- [ ] **Does not influence planning, execution, or presentation beyond optional hints** ([ADR-004](./adr-004-le-7-scenario-overlay.md))
- [ ] **Scenarios are interpretive overlays, not state updates** — no `UserContextV1` or plan mutation
- [ ] `ScenarioMatchV1` / `ScenarioPlanHintsV1` are optional; removable without affecting LE-1–LE-6
- [ ] Lives in `apps/web/src/lib/life-event/scenarios/`

### LE-8 Runtime MRC (post-execution)

- [ ] Does not import planner, ActionSurface, ExecutionSurface, or LE-7 scenario resolver
- [ ] Processes `ModuleRuntimeEventV1` only — post-execution timing
- [ ] Cross-module signals are advisory (`advisoryOnly: true`)
- [ ] Does not mutate plan, classifier, or scenario output
- [ ] Ephemeral session store only — no required persistence
- [ ] Optional UI via `runtimeEffect` prop only ([ADR-005](./adr-005-le-8-module-runtime-mrc.md))
- [ ] Lives in `apps/web/src/lib/life-event/runtime/`

---

## Global prohibitions

No layer may:

| Prohibition | Applies to |
|-------------|------------|
| Mutate upstream layer objects | LE-2–LE-5 |
| Introduce new action/node IDs | LE-4, LE-5 |
| Reinterpret life state semantics | LE-3–LE-5 |
| Call module-runtime `resolveActions` | LE-4, LE-5 |
| Execute modules or mutate profile | LE-1–LE-5 |

---

## Determinism (LE-1 → LE-5)

- [ ] Golden/fixture tests pass for classifier (LE-1)
- [ ] API fixture parity tests pass (LE-2)
- [ ] Presentation + action + execution projection tests pass (LE-4, LE-5)
- [ ] Same inputs produce deep-equal outputs in projection tests

---

## Terminology

| Term | Correct meaning | Not this |
|------|-----------------|----------|
| `ActionSurfaceV1` | LE-4 planning-time buckets | Executable actions |
| `ExecutionSurfaceV1` | LE-5 AEAL decoration | Module-runtime MRC |
| AEAL | LE-5 execution adapter | LE-8 MRC |
| MRC | Module-runtime post-execute enricher | AEAL |
| `ScenarioMatchV1` | LE-7 interpretive overlay | Authoritative state or plan input |
| Scenario `toState` | Transition narrative | Persisted life-state update |

---

## Test expectations

| Layer | Test location |
|-------|---------------|
| LE-1 | `packages/modules/.../classifier-fixtures.test.ts` |
| LE-2 | `apps/api/.../life-event-plan.api.test.ts` |
| LE-3/4 | `apps/web/.../life-event-plan.test.ts`, `actions.test.ts` |
| LE-5 | `apps/web/.../execution/tests/adapter.test.ts` |
| LE-7 | `apps/web/.../scenarios/scenario-resolver.test.ts` |
| LE-8 | `apps/web/.../runtime/runtime-engine.test.ts`, `cross-module-signals.test.ts` |
| Boundaries | `life-event-plan-boundary.test.ts`, `scenarios/scenario-boundary.test.ts`, `runtime/runtime-boundary.test.ts` |

---

## Review sign-off

Before merging life-event changes:

1. Identify which LE layer(s) are touched.
2. Confirm no cross-layer violations above.
3. If docs reference LE phases, use [ADR-003](./adr-003-le-layer-realignment.md) numbering.
