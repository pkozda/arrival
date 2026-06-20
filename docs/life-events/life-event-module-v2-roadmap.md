---
id: life-event-module-v2-roadmap
title: Life Event Module v2 — Roadmap
project: Arrival Atlas
system: Arrival Atlas
type: roadmap
domain: life-events
status: active
maturity: stable
owner: product
tags:
  - life-event
  - arr-016
  - business-delivery
created: 2026-06-20
updated: 2026-06-20
depends_on:
  - life-event-module-v2
  - life-state-model
  - profile-system-p4-roadmap
related:
  - life-event-module-v2-readiness-audit
  - life-state-model
  - life-event-classifier-fixtures
  - life-event-graph-catalog-v1
  - profile-ux-discovery
  - adr-001-life-event-layered-architecture
  - adr-002-action-vs-execution-boundary
  - adr-003-le-layer-realignment
  - adr-004-le-7-scenario-overlay
  - adr-005-le-8-module-runtime-mrc
  - life-event-module-v2-v1.0-architecture-freeze
---

# Life Event Module v2 — Roadmap

**Module:** `life-event` (existing)  
**Track:** Business delivery on stable platform  
**Branch:** `arr-016`  
**Priority:** **P0 product module**

> Architecture P1–P4 is stable. This roadmap tracks **life-event v2 delivery** inside the existing module — not a new platform layer.

**Canonical architecture:** [ADR-001](../adr/adr-001-life-event-layered-architecture.md) · [ADR-003](../adr/adr-003-le-layer-realignment.md) · **[v1.0 Freeze](./life-event-module-v2-v1.0-architecture-freeze.md)**

---

## Current canonical state (2026-06-20)

| Phase | Status | Deliverable |
|-------|--------|-------------|
| **LE-1** Planner | ✅ Complete | `buildLifeEventPlan()` → `LifeEventPlanV1` |
| **LE-2** API | ✅ Complete | `GET /api/modules/life-event/plan` |
| **LE-3** UI | ✅ Complete | Home `NextStepsCard` + `/modules/life-event` plan view |
| **LE-4** Action surface | ✅ Complete | `ActionSurfaceV1` (`projectActionSurface`) |
| **LE-5** AEAL | ✅ Complete | `ExecutionSurfaceV1` (`buildExecutionSurface`) |
| **LE-6** P4 + Home polish | ✅ Complete | Hint dedup; suppress legacy overlaps |
| **LE-7** Scenario refactor | ✅ Complete | State transition + scenario resolver layer |
| **LE-8** Module-runtime MRC | ✅ Complete | Post-execute runtime layer; [ADR-005](../adr/adr-005-le-8-module-runtime-mrc.md) |

**System status:** **v1.0 frozen** — core at LE-1–LE-5; LE-6–LE-8 are optional overlays. See [architecture freeze](./life-event-module-v2-v1.0-architecture-freeze.md).

```text
UserContextV1 → LifeEventPlanV1 → API → UI → ActionSurfaceV1 → ExecutionSurfaceV1
     LE-1          LE-1/2        LE-2    LE-3      LE-4            LE-5
```

---

### Prerequisites (design — done)

| Document | Status |
|----------|--------|
| [life-state-model.md](./life-state-model.md) v1.1 | ✅ States, severity, secondaries, priority |
| [life-event-classifier-fixtures.md](./life-event-classifier-fixtures.md) | ✅ 24 fixtures |
| [life-event-graph-catalog-v1.md](./life-event-graph-catalog-v1.md) | ✅ G1–G7 graphs |
| Pre-implementation hardening pass | ✅ 2026-06-20 |
| Architecture ADRs LE-1–LE-8 | ✅ [docs/adr/](../adr/) |
| **v1.0 architecture freeze** | ✅ [life-event-module-v2-v1.0-architecture-freeze.md](./life-event-module-v2-v1.0-architecture-freeze.md) |

### Prerequisites (platform — done)

| Track | Status |
|-------|--------|
| P1 — UserContextV1 | ✅ |
| UX-P3 — Profile correction | ✅ |
| UX-P4 — Profile insights | ✅ (arr-016) |
| Module runtime + `/modules/[moduleId]` | ✅ |

---

## 0. Product Goal

Turn `life-event` from a static scenario reference into the **primary navigation engine**:

> *"This is what you should focus on next — and why it matters now."*

**North star:** User understands their next step in Germany from Home in ≤ 2 clicks.

---

## 1. Phase overview (canonical)

| Phase | Focus | Deliverable | Status |
|-------|-------|-------------|--------|
| **LE-1** | Plan engine | `buildLifeEventPlan()` + graph catalog v1 | ✅ |
| **LE-2** | API | `GET /api/modules/life-event/plan` | ✅ |
| **LE-3** | UI projection | Home + `/modules/life-event` plan views | ✅ |
| **LE-4** | Action surface | `ActionSurfaceV1` | ✅ |
| **LE-5** | Execution adapter (AEAL) | `ExecutionSurfaceV1` | ✅ |
| **LE-6** | P4 + Home polish | Insights dedup; legacy Home cleanup | ✅ |
| **LE-7** | Scenario layer | State transition + scenario resolver | ✅ |
| **LE-8** | Module-runtime MRC | Post-execute runtime normalization | ✅ |

> **Note:** An earlier draft of this roadmap labeled LE-4 as "Home" and LE-5 as "P4". That numbering is obsolete — see [ADR-003](../adr/adr-003-le-layer-realignment.md).

**MVP (shipped) = LE-1 through LE-5.**

---

## 2. Phase LE-1 — Plan Engine ✅

**Goal:** Profile-aware deterministic planner in `packages/modules/src/life-event/plan/`.

| ID | Task | Status |
|----|------|--------|
| LE-1.1 | `LifeEventPlanV1` schemas | ✅ |
| LE-1.2 | `classifyLifeState()` | ✅ |
| LE-1.3 | `detectSecondaryConditions()` | ✅ |
| LE-1.4 | Graph catalog G1–G7 (G1–G3 deepest) | ✅ |
| LE-1.5 | Node satisfaction signals | ✅ |
| LE-1.6 | `buildLifeEventPlan()` | ✅ |
| LE-1.7 | `buildReasoning()` | ✅ |
| LE-1.8 | Golden tests F01–F24 | ✅ |

---

## 3. Phase LE-2 — API ✅

**Goal:** Module-scoped plan read endpoint.

| ID | Task | Status |
|----|------|--------|
| LE-2.1 | `GET /api/modules/life-event/plan` | ✅ |
| LE-2.2 | `resolveUserContext` → `buildLifeEventPlan` | ✅ |
| LE-2.3 | Authority headers | ✅ |
| LE-2.4 | `life-event-plan.api.test.ts` | ✅ |
| LE-2.5 | `execute()` `currentStatus` prefill from profile | ⏳ |

---

## 4. Phase LE-3 — UI Projection ✅

**Goal:** Read-only consumption of `LifeEventPlanV1` on Home and module page.

| ID | Task | Status |
|----|------|--------|
| LE-3.1 | `fetchLifeEventPlan()` web client | ✅ |
| LE-3.2 | `LifeEventPlanView` | ✅ |
| LE-3.3 | `LifeEventScenarioExplorer` (legacy execute below plan) | ✅ |
| LE-3.4 | Dedicated `/modules/life-event` route | ✅ |
| LE-3.5 | Deep-link `?event=` pre-select | ✅ |
| LE-3.6 | `NextStepsCard` on Home | ✅ |

### Home layout (current)

```text
Onboarding (FTU)
Your situation
Situation insights (P4)
Your next steps in Germany       ← life-event plan (LE-3)
Suggested modules                ← legacy; LE-6 suppresses overlaps (not removed)
Priority actions (post-execute)
Browse topics
Recent results
```

---

## 5. Phase LE-4 — Action Surface ✅

**Goal:** Deterministic `LifeEventPlanV1` → `ActionSurfaceV1` projection for UI buckets.

| ID | Task | Status |
|----|------|--------|
| LE-4.1 | `projectActionSurface()` | ✅ |
| LE-4.2 | Primary / secondary / blocked / contextual buckets | ✅ |
| LE-4.3 | Fixture tests F01–F24 | ✅ |
| LE-4.4 | LE-3 presentation regression tests | ✅ |

**Contract:** Planning-time structuring only — not executable. See [ADR-002](../adr/adr-002-action-vs-execution-boundary.md).

**Location:** `apps/web/src/lib/life-event-plan/actions.ts`

---

## 6. Phase LE-5 — Execution Adapter (AEAL) ✅

**Goal:** `ActionSurfaceV1` → `ExecutionSurfaceV1` — identity-preserving interaction metadata.

| ID | Task | Status |
|----|------|--------|
| LE-5.1 | `buildExecutionSurface()` | ✅ |
| LE-5.2 | Execution state (`ready` / `disabled`) | ✅ |
| LE-5.3 | Blocked safety guards | ✅ |
| LE-5.4 | UI integration with fallback | ✅ |
| LE-5.5 | Adapter tests (54+) | ✅ |

**Not in scope:** Module mapping, domain inference, module-runtime MRC — see [ADR-001](../adr/adr-001-life-event-layered-architecture.md).

**Location:** `apps/web/src/lib/life-event-plan/execution/`

---

## 7. Phase LE-6 — P4 + Home Polish ✅

**Goal:** P4 hints improve plan without duplicate Home noise; suppress legacy overlaps when plan already covers intent.

| ID | Task | Status |
|----|------|--------|
| LE-6.1 | `mergeP4WithPlan` advisory overlay | ✅ |
| LE-6.2 | `dedupeHomeSurfaces` semantic identity dedup | ✅ |
| LE-6.3 | `buildHomePlanViewModelV2` Home aggregation | ✅ |
| LE-6.4 | Home UI wired through presentation-v2 | ✅ |
| LE-6.5 | LE-6 consistency rules doc | ✅ |

**Code:** `apps/web/src/lib/life-event-plan/p4-merge.ts`, `home-dedup.ts`, `presentation-v2.ts`  
**Rules:** [le-6-consistency-rules.md](./le-6-consistency-rules.md)

---

## 8. Phase LE-7 — Scenario & State Transition Layer ✅

**Goal:** Deterministic scenario resolution and state transition reasoning — independent of planner, API, and execution layers.

| ID | Task | Status |
|----|------|--------|
| LE-7.1 | `scenario-registry.ts` canonical scenarios | ✅ |
| LE-7.2 | `resolve-scenario.ts` deterministic resolver | ✅ |
| LE-7.3 | `state-transitions.ts` transition matrix + guards | ✅ |
| LE-7.4 | `scenario-plan-hints.ts` read-only hint bridge | ✅ |
| LE-7.5 | Optional Home scenario banner (NextStepsCard) | ✅ |

**Code:** `apps/web/src/lib/life-event/scenarios/`  
**Constraint:** Completely ignorable by LE-1–LE-6; no planner/API/ActionSurface/ExecutionSurface changes. See [ADR-004](../adr/adr-004-le-7-scenario-overlay.md).

---

## 9. Phase LE-8 — Module Runtime MRC (Post-Execution) ✅

**Goal:** Post-execution normalization and advisory cross-module signals — web runtime layer.

| ID | Task | Status |
|----|------|--------|
| LE-8.1 | `types.ts` + `ModuleRuntimeEventV1` contracts | ✅ |
| LE-8.2 | `runtime-registry.ts` per-module handlers | ✅ |
| LE-8.3 | `runtime-engine.ts` + `effect-resolver.ts` | ✅ |
| LE-8.4 | `cross-module-signal-engine.ts` | ✅ |
| LE-8.5 | Ephemeral `runtime-store` + optional UI feedback | ✅ |

**Code:** `apps/web/src/lib/life-event/runtime/`  
**ADR:** [ADR-005](../adr/adr-005-le-8-module-runtime-mrc.md)

**Note:** `packages/module-runtime` server MRC enrichment remains a separate platform track.

---

## 10. Risks

| Risk | Mitigation |
|------|------------|
| Home overload (plan + P4 + FTU) | LE-6 dedup; strict caps |
| Classifier wrong state | Conservative rules + F01–F24 fixtures |
| AEAL vs MRC confusion | ADRs + consistency checklist |
| Scope creep (persistence, checklist) | Explicit non-goals in spec |
| Legacy `suggestModules` vs plan | LE-6 semantic dedup (full removal: v1.1 backlog) |

---

## 11. Definition of done

### Shipped (LE-1–LE-5) ✅

- [x] `buildLifeEventPlan()` with golden tests (F01–F24)
- [x] `GET /api/modules/life-event/plan`
- [x] Dedicated `/modules/life-event` with plan view
- [x] Home "Your next steps" card
- [x] `ActionSurfaceV1` + `ExecutionSurfaceV1` (AEAL)
- [x] 8 existing scenarios still execute
- [x] P1–P4 + life-event boundary tests green

### Remaining post-MVP ⏳

- [x] LE-6 P4 Home dedup
- [x] LE-7 scenario transition layer
- [ ] LE-2.5 execute prefill
- [x] LE-8 post-execution runtime MRC (web)

**Strategic outcome:** life-event is the central product navigation module with a linear, documented architecture.

---

## 12. Related documents

| Document | Path |
|----------|------|
| Specification | [life-event-module-v2-spec.md](./life-event-module-v2-spec.md) |
| **v1.0 architecture freeze** | [life-event-module-v2-v1.0-architecture-freeze.md](./life-event-module-v2-v1.0-architecture-freeze.md) |
| Life state model | [life-state-model.md](./life-state-model.md) |
| Classifier fixtures | [life-event-classifier-fixtures.md](./life-event-classifier-fixtures.md) |
| Graph catalog | [life-event-graph-catalog-v1.md](./life-event-graph-catalog-v1.md) |
| Readiness audit | [life-event-module-v2-readiness-audit.md](../audits/life-event-module-v2-readiness-audit.md) |
| ADR-001 Layered architecture | [adr-001-life-event-layered-architecture.md](../adr/adr-001-life-event-layered-architecture.md) |
| ADR-002 Action vs execution | [adr-002-action-vs-execution-boundary.md](../adr/adr-002-action-vs-execution-boundary.md) |
| ADR-003 LE realignment | [adr-003-le-layer-realignment.md](../adr/adr-003-le-layer-realignment.md) |
| Consistency checklist | [life-event-architecture-consistency-checklist.md](../adr/life-event-architecture-consistency-checklist.md) |
| ADR-004 LE-7 scenario overlay | [adr-004-le-7-scenario-overlay.md](../adr/adr-004-le-7-scenario-overlay.md) |
| ADR-005 LE-8 runtime MRC | [adr-005-le-8-module-runtime-mrc.md](../adr/adr-005-le-8-module-runtime-mrc.md) |
| LE-6 consistency rules | [le-6-consistency-rules.md](./le-6-consistency-rules.md) |
| P4 roadmap | [profile-system-p4-roadmap.md](../identity/profile-system-p4-roadmap.md) |
