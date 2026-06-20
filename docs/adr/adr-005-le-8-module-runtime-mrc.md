---
id: adr-005-le-8-module-runtime-mrc
title: ADR-005 — LE-8 Module Runtime MRC (Post-Execution Layer)
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
  - adr-004-le-7-scenario-overlay
  - life-event-architecture-consistency-checklist
---

# ADR-005 — LE-8 Module Runtime MRC (Post-Execution Layer)

**Status:** Accepted  
**Date:** 2026-06-20  
**Scope:** Post-execution runtime normalization and cross-module signals (LE-8)

---

## Context

LE-1–LE-7 cover planning, presentation, and interpretive scenario overlays. After a user executes a module action, outcomes need **post-execution reconciliation** without feeding back into the planner or changing authoritative plan state.

`packages/module-runtime` handles server-side MRC enrichment. LE-8 is a **web-side, life-event-scoped post-execution layer** for normalizing client-visible execution results and emitting advisory cross-module signals.

---

## Decision

Adopt LE-8 as an **optional, post-execution runtime layer** that processes `ModuleRuntimeEventV1` and returns `RuntimeActionEffectV1`.

### Canonical rules

1. **LE-8 operates after execution only** — it does not plan, classify, or execute actions.
2. **LE-8 must not influence LE-1–LE-7** — no access to `LifeEventPlanV1`, `ActionSurfaceV1`, `ExecutionSurfaceV1`, or scenario resolver output as inputs that mutate upstream layers.
3. **Cross-module signals are advisory** — they must not trigger planner recomputation, state classification, or scenario mutation.
4. **LE-8 is removable** — deleting `apps/web/src/lib/life-event/runtime/` leaves LE-1–LE-7 behavior unchanged unless optional UI metadata props are passed.

### Layer distinction

| Layer | Question answered |
|-------|-------------------|
| LE-4 | What can be done? |
| LE-5 | How is action execution prepared? |
| LE-7 | Why might state change? (interpretive) |
| **LE-8** | **What changed after execution?** (post-execution truth normalization) |

---

## Architecture position

```text
LE-4 ActionSurface → LE-5 ExecutionSurface → USER ACTION
                                              ↓
                                    LE-8 Runtime Engine
                                              ↓
                          RuntimeActionEffectV1 + CrossModuleSignalV1
```

**Code:** `apps/web/src/lib/life-event/runtime/`

---

## Forbidden

- Mutating `LifeEventPlanV1`, profile, or planner inputs
- Modifying `ActionSurfaceV1` or `ExecutionSurfaceV1`
- Calling `resolveScenario` or `buildLifeEventPlan`
- Forward planning (“next best actions”)
- Required UI coupling

## Allowed

- Normalize `ModuleExecutionResultV1` into effects
- Ephemeral `runtimeSessionState` (in-memory)
- Registry-based handler hooks per `moduleId`
- Optional UI badges via `runtimeEffect` prop

---

## References

| Artifact | Path |
|----------|------|
| Runtime engine | `apps/web/src/lib/life-event/runtime/runtime-engine.ts` |
| Signal engine | `apps/web/src/lib/life-event/runtime/cross-module-signal-engine.ts` |
| LE-7 overlay ADR | [ADR-004](./adr-004-le-7-scenario-overlay.md) |
