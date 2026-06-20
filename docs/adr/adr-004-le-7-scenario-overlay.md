---
id: adr-004-le-7-scenario-overlay
title: ADR-004 — LE-7 Scenario Overlay (Interpretive Layer)
project: Arrival Atlas
system: Arrival Atlas
type: adr
domain: life-events
status: accepted
maturity: stable
owner: engineering
created: 2026-06-20
updated: 2026-06-20
related:
  - adr-001-life-event-layered-architecture
  - adr-003-le-layer-realignment
  - life-event-architecture-consistency-checklist
  - life-event-module-v2-roadmap
---

# ADR-004 — LE-7 Scenario Overlay (Interpretive Layer)

**Status:** Accepted  
**Date:** 2026-06-20  
**Scope:** Life Event Module v2 — scenario resolution and state-transition reasoning (LE-7)

---

## Context

LE-1 through LE-6 establish a deterministic planning and presentation pipeline. LE-7 adds **counterfactual / transition reasoning**: explaining *why* a life state may apply or shift, without participating in planning, execution, or Home dedup decisions.

Without a formal boundary, scenario output could be mistaken for authoritative state updates or allowed to influence `LifeEventPlanV1`, `ActionSurfaceV1`, or `ExecutionSurfaceV1`.

---

## Decision

Adopt LE-7 as an **optional, interpretive overlay** that sits beside — not inside — the LE-1–LE-6 pipeline.

### Canonical rules

1. **LE-7 is not allowed to influence planning, execution, or presentation decisions beyond optional hints.**

   - LE-7 must not call `buildLifeEventPlan`, mutate `LifeEventPlanV1`, alter classifier output, or change API responses.
   - LE-7 must not modify `ActionSurfaceV1` or `ExecutionSurfaceV1`.
   - LE-7 must not drive LE-6 Home dedup (`mergeP4WithPlan`, `dedupeHomeSurfaces`, `buildHomePlanViewModelV2`).
   - LE-7 may expose **optional** `ScenarioMatchV1` / `ScenarioPlanHintsV1` for explanatory UI (e.g. “Context shift detected” banner). Consumers may ignore these entirely.

2. **Scenarios are not state updates — they are interpretive overlays.**

   - `ScenarioMatchV1.toState` describes a *transition narrative*, not a persisted or authoritative life-state write.
   - Scenario resolution does not patch `UserContextV1`, profile, or plan.
   - Removing LE-7 must leave LE-1–LE-6 behavior identical.

---

## Architecture position

```text
LE-1  LifeEventPlanV1          (truth — what to do now)
LE-2  API transport
LE-3  UI projection
LE-4  ActionSurfaceV1          (interaction structure)
LE-5  ExecutionSurfaceV1       (interaction safety)
LE-6  Presentation dedup       (what to show on Home)
────────────────────────────────────────────────────────
LE-7  Scenario overlay          (why state may change — interpretive only)
```

**Code:** `apps/web/src/lib/life-event/scenarios/`

| Output | Authoritative? | Consumer |
|--------|----------------|----------|
| `LifeEventPlanV1` | Yes (LE-1) | LE-2–LE-6 |
| `ScenarioMatchV1` | No | Optional UI hints only |
| `ScenarioPlanHintsV1` | No | Read-only bridge; never fed back to planner |

---

## Allowed vs forbidden

| Allowed | Forbidden |
|---------|-----------|
| `resolveScenario(userContext, currentPlan)` | Re-running or wrapping LE-1 planner |
| `buildScenarioPlanHints(match)` read-only | Writing hints into plan or API |
| Optional banner on `NextStepsCard` | Changing action buckets or execution state |
| Deterministic transition matrix (LE-7 only) | Extending G1–G7 graph catalog |
| Registry of scenario definitions | New `LifeStateId` values or profile mutations |

---

## Removability

LE-7 is **completely ignorable**. Delete `apps/web/src/lib/life-event/scenarios/` and remove optional `scenario` props from Home components — no other layer requires LE-7 to function.

---

## Consequences

**Positive**

- Clear separation: plan = action truth; scenario = transition explanation.
- No regression risk to LE-1–LE-6 when scenario logic evolves.
- Engineers cannot accidentally route scenario output into execution.

**Negative**

- Two sources of “state language” (plan `currentLifeState` vs scenario `toState`) — consumers must treat plan as authoritative.

---

## References

| Artifact | Path |
|----------|------|
| Scenario resolver | `apps/web/src/lib/life-event/scenarios/resolve-scenario.ts` |
| Scenario registry | `apps/web/src/lib/life-event/scenarios/scenario-registry.ts` |
| Plan hints bridge | `apps/web/src/lib/life-event/scenarios/scenario-plan-hints.ts` |
| LE-6 consistency | [le-6-consistency-rules.md](../life-events/le-6-consistency-rules.md) |
| Layer map | [ADR-001](./adr-001-life-event-layered-architecture.md) |
