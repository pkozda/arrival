---
id: adr-002-action-vs-execution-boundary
title: ADR-002 — Action vs Execution Boundary Contract
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: stable
owner: engineering
created: 2026-06-20
updated: 2026-06-20
related:
  - adr-001-life-event-layered-architecture
  - adr-003-le-layer-realignment
---

# ADR-002 — Action vs Execution Boundary Contract

**Status:** Accepted  
**Date:** 2026-06-20

---

## Context

Life Event v2 introduces two consecutive derived models after `LifeEventPlanV1`:

1. **ActionSurfaceV1** (LE-4) — structures plan nodes into UI buckets
2. **ExecutionSurfaceV1** (LE-5 / AEAL) — prepares those buckets for interaction semantics

Without a formal boundary, engineers may treat ActionSurface as executable, or allow ExecutionSurface to reinterpret planning decisions.

---

## Decision

**ActionSurfaceV1 is never executable.**  
**ExecutionSurfaceV1 exists solely to decorate action identity for interaction-time systems.**

> Execution layer can only decorate, never reinterpret.

---

## Why ActionSurfaceV1 is not executable

`ActionSurfaceV1` contains `LifeEventPlanNode` objects — full graph nodes with `satisfied`, `blocked`, `phase`, `category`, and nested `actions[]` (`LifeActionRef`).

It answers: **"Which plan nodes belong in which UI section?"**

It does not answer:

- Whether a click should fire
- Which module runtime handler runs
- What post-execute side effects occur

Executable semantics require a separate contract with explicit `executionState` and safety guards — that is `ExecutionSurfaceV1`.

---

## Why ExecutionSurfaceV1 exists

`ExecutionSurfaceV1` flattens nodes into **execution actions** with:

- Stable `id` (from plan node)
- `label`, optional `href`
- `executionState`: `ready` | `deferred` | `disabled`
- `source`: `primary` | `secondary` | `contextual` | `blocked`
- Optional `uiHint` for presentation

It answers: **"How should the UI (and future runtime bridges) treat each action?"**

AEAL is **additive and side-effect free**. It does not execute anything.

---

## Identity rules

| Field | Rule |
|-------|------|
| `id` | **Must equal** `LifeEventPlanNode.id`. No new IDs. No suffixes. No hashes. |
| `sourceNodeId` | **Must equal** `node.id` when present |
| `label` | Mapped from `node.title` — display normalization only |
| `href` | First `node.actions[0].href` when valid string; otherwise omitted |

**Forbidden:**

- Generating composite IDs (`primary-g1-…`)
- Domain-based ID aliases (`registration-action`)
- Merging multiple nodes into one execution action

---

## Mapping rules (LE-4 → LE-5)

| ActionSurfaceV1 | ExecutionSurfaceV1 | Notes |
|-----------------|---------------------|-------|
| `primaryAction` | `primary` | Exactly one or null |
| `secondaryActions` | `secondary` | Max 3; order preserved |
| `blockedActions` | `blocked` | All entries `executionState: disabled` |
| `contextualActions` | `contextual` | Timeline-derived; informational |

### Label mapping

```text
ExecutionAction.label ← LifeEventPlanNode.title
```

No rewording, no i18n at AEAL layer (i18n belongs in content/scenario layers).

### Href resolution

```text
href = node.actions[0]?.href  (if non-empty string)
```

No fallback href synthesis. No inference from `moduleId` or `profileMirrorSlug`.

### Blocked vs disabled semantics

| Concept | Layer | Meaning |
|---------|-------|---------|
| **Blocked** (plan) | LE-1 | Graph dependency unsatisfied — node in `activeBlocks` |
| **Blocked** (surface) | LE-4 | Same nodes in `blockedActions` bucket |
| **Disabled** (execution) | LE-5 | `executionState: 'disabled'` — not interactable |

A node in `blockedActions` **must never** appear in `primary`, `secondary`, or `contextual` on the execution surface.

Secondary/contextual actions use `executionState: 'ready'` unless explicitly listed in `blockedActions`.

---

## Decoration-only rule

Execution layer **may add**:

- `executionState`
- `source`
- `uiHint`
- Flattened `label` / `href` fields

Execution layer **must not**:

- Re-rank actions
- Filter actions beyond blocked-id safety (already done in LE-4)
- Change titles or priorities
- Map to module IDs
- Merge P4 insights
- Introduce new planning semantics

---

## Invalid input handling

| Condition | Behavior |
|-----------|----------|
| Malformed node (empty `id` or `title`) | Drop silently |
| Invalid `ActionSurfaceV1` / missing primary | `EMPTY_EXECUTION_SURFACE` |
| Blocked ID collision | Exclude from executable sets |

No synthetic fallback actions.

---

## UI contract

- UI renders **plan nodes** from `ActionSurfaceV1` for content (title, description, action links).
- UI uses **execution lookup** from `ExecutionSurfaceV1` for disabled styling.
- `executionSurface={null}` on components → bypass AEAL (LE-3/LE-4 fallback).

---

## Consequences

- Clear handoff point for future LE-8+ module-runtime MRC (post-execute only).
- AEAL tests enforce identity and non-mutation.
- ActionSurface tests remain independent of execution metadata.

---

## References

- `apps/web/src/lib/life-event-plan/actions.ts` — `projectActionSurface`
- `apps/web/src/lib/life-event-plan/execution/adapter.ts` — `buildExecutionSurface`
- `apps/web/src/lib/life-event-plan/execution/tests/adapter.test.ts`
