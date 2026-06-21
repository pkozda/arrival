---
id: economic-reality-module-v1-roadmap
title: Economic Reality Module v1.0 — Roadmap
project: Arrival Atlas
system: Arrival Atlas
type: roadmap
domain: finance
status: active
maturity: evolving
owner: product
tags:
  - economic-reality
  - arr-019
  - business-delivery
  - jobcenter
  - sozialamt
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - economic-reality-module-v1
  - economic-state-model
  - profile-system-p4-roadmap
  - life-event-module-v2-v1.0-architecture-freeze
related:
  - economic-classifier-fixtures
  - economic-graph-catalog-v1
  - economic-rule-engine-v1
  - platform-planning-constitution-v1
  - financial-module-v2-plan
  - life-event-platform-integration-audit
  - audits/economic-reality-module-v1-readiness-audit
---

# Economic Reality Module v1.0 — Roadmap

**Module:** `economic-reality` (proposed new catalog module)  
**Track:** Second planning pillar — institutional survival  
**Branch:** `arr-019` (proposed)  
**Priority:** **P0 product module** (immigrant economic survival)

> Platform P1–P4 and Life Event v1.0 are prerequisites. This roadmap delivers **economic planning** on the same architectural pattern as LE-1–LE-5 — not a new platform layer.

**Canonical spec:** [economic-reality-module-v1-spec.md](./economic-reality-module-v1-spec.md)

---

## Product goal

Turn economic survival in Germany from scattered module hints into a **coherent institutional plan**:

> *"I understand which system I'm in (Jobcenter / Sozialamt / work), where support comes from, and what I must do next financially."*

**North star:** Refugee and immigrant users with limited funds never land in a dead-end Home — they are routed to the correct support rail within the Economic Reality module in ≤ 3 clicks from Life Event or Home secondary entry.

**Platform pairing:**

```text
Life Event     →  "What is happening in my life?"
Economic Reality  →  "How do I survive financially in the system?"
```

---

## Prerequisites

### Design (this PR / doc track)

| Document | Status |
|----------|--------|
| [economic-state-model.md](./economic-state-model.md) | ✅ Draft v1.0 |
| [economic-classifier-fixtures.md](./economic-classifier-fixtures.md) | ✅ EF01–EF24 |
| [economic-graph-catalog-v1.md](./economic-graph-catalog-v1.md) | ✅ G1–G6 |
| [economic-reality-module-v1-spec.md](./economic-reality-module-v1-spec.md) | ✅ Draft |
| Readiness audit | ✅ [economic-reality-module-v1-readiness-audit.md](../audits/economic-reality-module-v1-readiness-audit.md) |

### Platform (done)

| Track | Status |
|-------|--------|
| P1 — UserContextV1 | ✅ |
| UX-P3 — Profile correction | ✅ |
| UX-P4 — Profile insights | ✅ |
| Life Event v1.0 (LE-1–LE-5) | ✅ frozen |
| Module runtime + `/modules/[moduleId]` | ✅ |
| `financial-reality` execute (calculator) | ✅ v1 |
| `benefits-simulator` | ✅ |

---

## Phase overview (EP-1 → EP-8)

Mirror Life Event layering nomenclature (`EP` = Economic Planning).

| Phase | Focus | Deliverable | Status |
|-------|-------|-------------|--------|
| **EP-0** | Design docs | Spec, state model, graphs, fixtures, **rule engine**, **constitution** | ✅ |
| **EP-1** | Rule engine + types | `evaluateEconomicRules()`, `EconomicEvaluationV1`, thin classifier | ⬜ |
| **EP-2** | Jobcenter graphs | G2 onboarding + G3 active Bürgergeld | ⬜ |
| **EP-3** | Employment graph | G4 transitions | ⬜ |
| **EP-4** | Support system rules | **Absorbed into EP-1** — R3/R4 in rule engine | ⬜ |
| **EP-5** | Planner engine | `buildEconomicPlan()` — evaluation + graph only | ⬜ |
| **EP-6** | API layer | `GET /api/modules/economic-reality/plan` | ⬜ |
| **EP-7** | UI integration | Module page + optional Home secondary card | ⬜ |
| **EP-8** | LE integration bridge | Cross-module signals (optional, LE-8 style) | ⬜ backlog |

**MVP = EP-1 through EP-7.** EP-8 deferred until platform authority contract matures (see ARR-018 audit).

---

## Phase detail

### EP-1 — Rule Engine + Types (revised)

**Goal:** Lock deterministic evaluation contract — no UI, no separate EP-4 resolver.

| Task | Output |
|------|--------|
| Product contract types | `EconomicEvaluationV1`, `EconomicPlanV1`, axes |
| `evaluateEconomicRules()` | R1–R7, FIRST MATCH WINS |
| `classifyEconomicState()` | Thin wrapper over `evaluate()` |
| Predicates | Fact extractors from `UserContextV1` |
| Fixtures EF01–EF24 | Assert `economicState`, `supportSystem`, `graphId`, `appliedRules`, `axes` |

**Exit criteria:** All fixtures pass; `appliedRules` auditable; no graph logic in classifier.

**Canonical spec:** [economic-rule-engine-v1.md](./economic-rule-engine-v1.md)

---

### EP-4 — Support System Resolver (merged into EP-1)

> **Phase retained for roadmap traceability only.** Implementation is R3 (Sozialamt) and R4 (Jobcenter) inside the rule engine — not a separate module or service.

---

### EP-2 — Jobcenter Graph (G2 + G3)

**Goal:** Implement graph catalog nodes for onboarding and active Bürgergeld.

| Task | Output |
|------|--------|
| `GRAPH_CATALOG_V1` G2, G3 | `plan/graph/catalog.ts` |
| G1-A/B/C layered nodes | Detection / routing / activation separation |
| Satisfaction key resolver | Profile domain mapping |
| Node ranking + blockers | Planner inputs |

**Exit criteria:** EF03–EF06, EF12, EF21–EF22 produce expected `currentFocus`.

---

### EP-3 — Employment Transition Graph (G4)

**Goal:** Job ↔ benefits transitions.

| Task | Output |
|------|--------|
| G4 nodes | Benefit exit, offer evaluation |
| Links to `financial-reality` | `open_module` actions |

**Exit criteria:** EF13–EF15 pass; G4 handoff from G3 verified.

---

### EP-5 — Planner Engine

**Goal:** `buildEconomicPlan()` — mirror `buildLifeEventPlan()`.

```text
UserContextV1 → evaluateEconomicRules() → EconomicEvaluationV1 → graph + rank → EconomicPlanV1
```

| Task | Output |
|------|--------|
| `buildEconomicPlan()` | Main entry — **no classification logic** |
| `currentFocus` / `nextBestActions` / `activeBlocks` / `timeline` | Plan shape |
| Reasoning strings | `whyThisState`, node `rationale` |

**Exit criteria:** Full fixture suite on plan output; snapshot tests for plan JSON.

---

### EP-6 — API Layer

**Goal:** Read-only plan endpoint.

| Task | Output |
|------|--------|
| `buildEconomicPlanFromState()` | `apps/api/src/state/` |
| `GET /api/modules/economic-reality/plan` | Route + security map |
| API tests | Fixture parity server-side |

**Exit criteria:** API matches module package output for all EF fixtures.

---

### EP-7 — UI Integration

**Goal:** User-facing plan surfaces — **secondary to Life Event on Home**.

| Task | Output |
|------|--------|
| `fetchEconomicPlan()` | Web client |
| `/modules/economic-reality` | Plan view (reuse le-ux patterns) |
| Home secondary card | When ER state ≠ self_sustained OR pinned |
| i18n keys | `economic-reality-translations.ts` |
| Life Event graph links | `open_module` → economic-reality from LE nodes |

**Exit criteria:** Demo path from LE `economic_setup_pending` → ER module with coherent plan.

**Home rule:** [Platform Planning Constitution v1](../platform/platform-planning-constitution-v1.md) — ER secondary card only in v1.

---

### EP-8 — Integration Bridge (optional backlog)

**Goal:** LE ↔ ER feedback without duplicate Home planners.

| Task | Output |
|------|--------|
| ER completion signals | Library (like LE-8) |
| LE graph consumption | Soft satisfaction hints |
| Runtime wiring | Platform backlog |

**Defer** until ARR-018 priority 1–3 addressed.

---

## Implementation map (target)

```text
packages/
  product-contract/src/economic-reality/     # EconomicEvaluationV1, EconomicPlanV1
packages/modules/src/economic-reality/plan/
  rule-engine/              # EP-1 core
  graph/                    # EP-2–EP-3
  build-economic-plan.ts    # EP-5
apps/
  api/src/routes/economic-reality-plan.ts    # EP-6
  api/src/state/economic-reality-projection.ts
  web/src/lib/economic-reality-plan/         # EP-7 client + presentation
  web/src/app/modules/economic-reality/      # EP-7 page
```

---

## Relationship to `financial-reality`

| Phase | financial-reality | economic-reality |
|-------|-------------------|------------------|
| EP-1–EP-7 | Unchanged execute calculator | New plan module |
| Post-v1 | Linked from ER graph nodes | Owns institutional planning |
| financial v2 plan | Household decision engine | Complementary — see [financial-module-v2-plan.md](../finance/financial-module-v2-plan.md) |

---

## Test strategy

| Layer | Tests |
|-------|-------|
| Classifier | 24 fixture tests (EF01–EF24) |
| Graph/planner | Per-graph focus tests |
| API | Parity with module package |
| Web | Boundary — no planner in web |
| Cross-module | LE handoff smoke tests (EP-7) |

```bash
# Target commands (after EP-1)
npm run test --workspace=@arrival-atlas/modules -- --run src/economic-reality
npm run test --workspace=apps/api -- --run economic-reality
npm run test --workspace=apps/web -- --run src/lib/economic-reality-plan
```

---

## Success criteria (v1.0 ship)

| # | Criterion |
|---|-----------|
| 1 | User identifies support system (Jobcenter / Sozialamt / work / none) |
| 2 | Refugee fixtures EF08–EF11 pass |
| 3 | Deterministic `EconomicPlanV1` |
| 4 | Clean LE boundary — no duplicated life states |
| 5 | Module registered in catalog + route security |
| 6 | Linked from LE graph `open_module` where appropriate |

---

## Post-v1.0 backlog

| Item | Track |
|------|-------|
| EP-8 LE bridge | Platform integration |
| ALG I dedicated nodes | G4 extension |
| Wohngeld / Kindergeld links | Cross-module |
| `financial-reality` branding merge | Product decision |
| Country packs (non-DE) | v2 |
| Plan-aware module shell (return to plan) | ARR-018 platform |

---

## Related

- [economic-reality-module-v1-spec.md](./economic-reality-module-v1-spec.md)
- [life-event-module-v2-roadmap.md](../life-events/life-event-module-v2-roadmap.md) — pattern reference
- [life-event-platform-integration-audit.md](../audits/life-event-platform-integration-audit.md)
