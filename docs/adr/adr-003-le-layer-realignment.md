---
id: adr-003-le-layer-realignment
title: ADR-003 — LE Layer Renaming Realignment
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: stable
owner: engineering
created: 2026-06-20
updated: 2026-06-20
related:
  - life-event-module-v2-roadmap
  - adr-001-life-event-layered-architecture
  - adr-004-le-7-scenario-overlay
---

# ADR-003 — LE Layer Renaming Realignment

**Status:** Accepted  
**Date:** 2026-06-20

---

## Context

The original [life-event-module-v2-roadmap.md](../life-events/life-event-module-v2-roadmap.md) (2026-06-20 initial draft) assigned:

| Original ID | Original meaning |
|-------------|------------------|
| LE-3 | Module UI only |
| LE-4 | Home integration |
| LE-5 | P4 integration + Home dedup |
| LE-6 | Scenario refactor |
| LE-7 | Module-runtime MRC actions |

Implementation evolved differently:

- Home (`NextStepsCard`) shipped with module UI (both are UI consumption).
- **ActionSurfaceV1** was introduced as a distinct projection layer (implemented as "LE-4" in engineering prompts).
- **ExecutionSurfaceV1 (AEAL)** was introduced as LE-5 — not P4, not MRC.
- An alternate LE-5 proposal (MRC keyword mapping) was **rejected** in favor of AEAL.

This ADR **supersedes phase numbering** in older roadmap sections and related doc references.

---

## Decision — canonical LE numbering

| Phase | Canonical name | Status | Primary artifact |
|-------|----------------|--------|------------------|
| **LE-1** | Planner | ✅ Complete | `buildLifeEventPlan()` → `LifeEventPlanV1` |
| **LE-2** | API | ✅ Complete | `GET /api/modules/life-event/plan` |
| **LE-3** | UI projection | ✅ Complete | `NextStepsCard`, `LifeEventPlanView`, `/modules/life-event` |
| **LE-4** | Action surface | ✅ Complete | `projectActionSurface()` → `ActionSurfaceV1` |
| **LE-5** | Execution adapter (AEAL) | ✅ Complete | `buildExecutionSurface()` → `ExecutionSurfaceV1` |
| **LE-6** | P4 + Home polish | ✅ Complete | `buildHomePlanViewModelV2`, Home dedup |
| **LE-7** | Scenario overlay | ✅ Complete | `resolveScenario()` — interpretive only; see [ADR-004](./adr-004-le-7-scenario-overlay.md) |
| **LE-8+** | Module-runtime MRC | ⏳ Planned | Post-execute action normalizer (`enrichModuleResultActions`) |

---

## Historical mismatch resolution

### "LE-4 = Home" → resolved

Home integration is **part of LE-3 UI scope**. A separate "Home phase" is no longer a numbered layer — it is a **surface** within LE-3.

Remaining Home polish (dedup, deprecate `suggestModules`) moves to **LE-6**.

### "LE-5 = P4" → resolved

P4 is already partially wired at LE-2 (`ProfileInsightViewV1` → planner). Home dedup and hint suppression is **LE-6**, not LE-5.

### "LE-5/7 = MRC" → resolved

Two distinct concepts:

| Term | Meaning | Phase |
|------|---------|-------|
| **AEAL** | Plan → execution metadata (web, pre-execute) | LE-5 ✅ |
| **Module-runtime MRC** | Execute result → action cards (platform) | LE-8+ ⏳ |

AEAL is **not** MRC. No keyword→module registry exists in LE-5.

---

## Mapping table (old → new)

| Old roadmap | New canonical | Notes |
|-------------|---------------|-------|
| LE-1 Plan engine | LE-1 Planner | Unchanged |
| LE-2 API | LE-2 API | Unchanged |
| LE-3 Module UI | LE-3 UI | Includes Home + module page |
| LE-4 Home | LE-3 UI (subset) + LE-6 polish | Home card done; dedup pending |
| — | **LE-4 ActionSurface** | New layer (was not in original roadmap) |
| LE-5 P4 | **LE-6** P4 + dedup | Renumbered |
| LE-6 Scenarios (content) | **LE-7** Scenario overlay | Renumbered; interpretive layer per ADR-004 |
| LE-7 MRC | **LE-8+** Module-runtime MRC | Renumbered; optional |

---

## MVP definition (updated)

**MVP (shipped): LE-1 through LE-5**

User sees personalized plan on Home and module page, with action structuring and execution adapter safety — all deterministic.

**Post-MVP: LE-6+**

LE-6 (Home dedup) and LE-7 (scenario overlay) are complete. LE-8+ platform MRC remains planned.

---

## Documentation hygiene

Documents that reference old numbering should be read through this ADR:

- `life-event-module-v2-spec.md` — LE-4/LE-5 Home/P4 references
- `life-event-module-v2-readiness-audit.md` — pre-implementation estimates
- `life-event-graph-catalog-v1.md` — LE-5 P4 dedup notes → LE-6

Roadmap file is authoritative **after** 2026-06-20 realignment pass.

---

## Consequences

- Engineering prompts and PRs should use canonical LE-1–LE-5 names only.
- New work on P4 dedup must be labeled **LE-6**, not LE-5.
- Module-runtime integration must be labeled **LE-8+**, not LE-5.
