---
id: le-6-consistency-rules
title: LE-6 — P4 + Home Dedup Consistency Rules
project: Arrival Atlas
system: Arrival Atlas
type: specification
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
  - life-event-module-v2-roadmap
---

# LE-6 — P4 + Home Dedup Consistency Rules

LE-6 is a **presentation refinement layer**. It sits above LE-1 (`LifeEventPlanV1`) and LE-5 (`ExecutionSurfaceV1`) without modifying them.

**Code locations:**

| Module | Path |
|--------|------|
| P4 merge | `apps/web/src/lib/life-event-plan/p4-merge.ts` |
| Home dedup | `apps/web/src/lib/life-event-plan/home-dedup.ts` |
| Presentation v2 | `apps/web/src/lib/life-event-plan/presentation-v2.ts` |
| Semantic identity | `apps/web/src/lib/life-event-plan/semantic-identity.ts` |

---

## Architectural position

```text
LifeEventPlanV1 (LE-1/2) ──┐
ProfileInsightViewV1 (P4) ─┼──► LE-6 presentation merge ──► HomePlanViewModelV2 ──► Home UI
ActionSurfaceV1 (LE-4) ────┤         (dedup only)
ExecutionSurfaceV1 (LE-5) ─┘
```

LE-6 does **not** add a new numbered pipeline layer. It is a reversible web-only refinement that can be deleted without breaking LE-1–LE-5.

---

## Invariants

### Plan remains source of truth

- `LifeEventPlanV1` is never mutated by LE-6.
- Plan nodes, blockers, priorities, and graph structure are read-only inputs.
- When P4 and plan disagree, **plan wins**.

### P4 cannot generate actions

- P4 may contribute `missingContext` hints and completeness metadata only.
- LE-6 must not create new plan nodes, action IDs, or execution actions.
- P4 hints are **advisory** — they never override `currentFocus` or `nextBestActions`.

### Execution layer is unaffected

- `ActionSurfaceV1` (LE-4) is passed through unchanged.
- `ExecutionSurfaceV1` (LE-5) is passed through unchanged.
- LE-6 may reference execution state for display routing but must not alter execution structure.

### Dedup is presentation-only

- Suppression applies to **Home sections**, not to plan data:
  - `MissingContextHintsCard` hints
  - `SuggestedModulesSection` items
- `NextStepsCard` always renders the full LE-4 action surface when a plan primary exists.
- Dedup keys use **semantic identity** (`module:`, `mirror:`, `domain:`) — never plan node IDs.

---

## Dedup rules

### Semantic identity keys

| Source | Keys extracted |
|--------|----------------|
| Plan node action | `module:{moduleId}`, `mirror:{slug}`, `domain:{domain}` |
| P4 missing-context hint | `domain:{domain}`, `mirror:{slug}`, `module:{ctaModuleId}` |
| Legacy module suggestion | `module:{moduleId}` |

### Overlap resolution

When the plan has an active primary focus:

1. **P4 hint suppressed** if any of its semantic keys overlap with any key from the action surface (primary, secondary, blocked, contextual).
2. **Module suggestion suppressed** if `module:{id}` overlaps with plan semantic keys.
3. **`life-event` module suggestion suppressed** whenever the plan is active (plan already owns forward navigation).

### Priority preservation

- Plan order is never re-ranked.
- Primary action is never suppressed.
- Secondary actions in `NextStepsCard` are never filtered by LE-6 dedup.

---

## Graceful degradation

| Condition | Behavior |
|-----------|----------|
| Plan missing | Show full P4 hints and legacy suggestions (no dedup) |
| P4 missing | Show plan + suggestions; P4 card hidden |
| Execution surface missing | `NextStepsCard` falls back to LE-3/LE-4 rendering (`executionSurface={null}`) |
| Plan loading / error | `NextStepsCard` hidden; P4 and suggestions use last-known or empty plan |

---

## Prohibited changes (LE-6 scope)

- No edits to `packages/modules/src/life-event/plan/`
- No edits to graph catalog
- No edits to `projectActionSurface` or `buildExecutionSurface`
- No new API routes or response shapes
- No new `LifeStateId`, `SecondaryConditionId`, or plan schema fields

---

## Review checklist

Before merging LE-6 changes:

- [ ] `LifeEventPlanV1` objects are not mutated in place
- [ ] `ActionSurfaceV1` / `ExecutionSurfaceV1` deep-equal before and after LE-6 mapping
- [ ] No new action or node IDs introduced
- [ ] Dedup uses semantic keys only
- [ ] LE-1–LE-5 tests still pass unchanged
- [ ] Home degrades when plan or P4 is absent

---

## Related documents

- [ADR-001](../adr/adr-001-life-event-layered-architecture.md)
- [ADR-002](../adr/adr-002-action-vs-execution-boundary.md)
- [Life Event roadmap](./life-event-module-v2-roadmap.md) §7 LE-6
