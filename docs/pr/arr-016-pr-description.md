# arr-016 — UX-P4 Profile Intelligence + Life Event v2 v1.0 Architecture Freeze

**Branch:** `arr-016`  
**Tracks:** UX-P4 (Profile Intelligence) · Life Event Module v2 (LE-1 → LE-8) · v1.0 architecture freeze

---

# Part 1 — UX-P4: Adaptive Profile Intelligence Layer

Implements **UX-P4 (Profile Intelligence P4)** — a deterministic, read-only interpretation layer on top of `UserContextV1`. Profile becomes **transparent**: the system can explain what it knows, how confidently, and what might be missing — without new facts, writes, or a second profile model.

**Depends on:** P1 mutation pipeline (`UserContextV1`, contract lock) · UX-P3 correction UI (`fact.correct` via `profile_ui`)  
**Roadmap:** [profile-system-p4-roadmap.md](../identity/profile-system-p4-roadmap.md)

## Summary (P4)

P4 adds a separate read path for interpretation metadata. Situation **facts** still flow through `GET /api/user-context`; **insights** flow through `GET /api/profile-insights`. The web never sees raw mutation events.

```text
UserContextV1 (authoritative)
        +
MutationEvent[] + execution metadata (server-only)
        │
        ▼
interpretProfileInsights()  →  ProfileInsightViewV1
        │
        ▼
GET /api/profile-insights  (derived-non-authoritative)
        │
        ├── Profile domain detail — provenance + confidence block
        ├── Profile overview — per-section confidence badges
        ├── Home — missing-context hints (≤ 3)
        └── Module prefill — confidence-aware banner copy
```

## What was done (P4)

### Profile Intelligence engine (`packages/profile-intelligence/`)

New package `@arrival-atlas/profile-intelligence` — read-only, no mutation commit paths.

| Module | Purpose |
|--------|---------|
| `interpret-profile-insights.ts` | Main projection: `ProfileInsightViewV1` from inputs |
| `confidence.ts` | Deterministic domain/global confidence (high / medium / low / none) |
| `provenance.ts` | Plain-language narratives from module executions + Profile corrections |
| `missing-context.ts` | Actionable gap hints with stable priority ordering (cap ≤ 3) |
| `types.ts` | Mirror section definitions, execution metadata shapes |

### Product contract · API · Web

See [profile-system-p4-roadmap.md](../identity/profile-system-p4-roadmap.md) for full P4 file list and test counts.

## P4 architecture compliance

- ✅ Situation facts via `selectUserContextProfile(userContext)` only
- ✅ Writes via `submitMutation()` only
- ✅ `MutationEvent[]` stays server-side
- ✅ P4 suggestions are advisory — no auto-write

---

# Part 2 — Life Event Module v2 v1.0 Architecture Freeze

Implements **Life Event Module v2** (LE-1 → LE-8): deterministic planning core, optional overlay layers, ADRs, and v1.0 architecture freeze documentation.

**Freeze spec:** [life-event-module-v2-v1.0-architecture-freeze.md](../life-events/life-event-module-v2-v1.0-architecture-freeze.md)  
**Roadmap:** [life-event-module-v2-roadmap.md](../life-events/life-event-module-v2-roadmap.md)

## Summary (Life Event)

Life Event Module v2 turns `life-event` from static scenario tables into a **profile-aware planning engine** with a strict linear pipeline. v1.0 **freezes the core at LE-5**; LE-6–LE-8 are optional, removable overlays.

```text
UserContextV1 → LifeEventPlanV1 → API → UI → ActionSurfaceV1 → ExecutionSurfaceV1 (AEAL)
     LE-1           LE-1/2         LE-2   LE-3      LE-4              LE-5  ← FROZEN CORE

Optional overlays (non-authoritative):
  LE-6  Presentation Dedup (active on Home)
  LE-7  Scenario Overlay (active banner on Home)
  LE-8  Runtime MRC (library-only, not wired)
```

P4 insights feed LE-1 at the API boundary (`buildProfileInsightsFromState` → `buildLifeEventPlan`). LE-6 deduplicates P4 hints against plan on Home.

## What was done (Life Event)

### LE-1 — Planner (`packages/modules/src/life-event/plan/`)

| Piece | Role |
|-------|------|
| `buildLifeEventPlan()` | Deterministic plan from `UserContextV1` |
| `classifyLifeState()` | 7 life states (F01–F24 fixtures) |
| `GRAPH_CATALOG_V1` | G1–G7 graph catalog |
| `LifeEventPlanV1` | Product contract |

### LE-2 — API (`apps/api/`)

| Piece | Role |
|-------|------|
| `GET /api/modules/life-event/plan` | Plan read endpoint |
| `buildLifeEventPlanFromState()` | P4 insights at API boundary |
| `life-event-plan.api.test.ts` | 28 fixture parity tests |

### LE-3 — UI (`apps/web/`)

| Piece | Role |
|-------|------|
| `fetchLifeEventPlan()` | API client — no planner in web |
| `NextStepsCard` | Home "Your next steps in Germany" |
| `LifeEventPlanView` | `/modules/life-event` plan page |
| `LifeEventScenarioExplorer` | Legacy `execute()` below plan |

### LE-4 — ActionSurfaceV1 · LE-5 — ExecutionSurfaceV1 (AEAL)

Planning-time buckets + identity-preserving execution metadata. 76 + 54 tests.

### LE-6 — Presentation Dedup

`mergeP4WithPlan`, `dedupeHomeSurfaces`, `buildHomePlanViewModelV2` — **active** on Home.

### LE-7 — Scenario Overlay

`resolveScenario()` — interpretive only. Optional banner on `NextStepsCard`. ADR-004.

### LE-8 — Runtime MRC

`processModuleRuntimeEvent()` — **library-only**, **not wired**. ADR-005.

### Architecture documentation

| Document | Role |
|----------|------|
| ADR-001–005 | Layered architecture through runtime MRC |
| `life-event-module-v2-v1.0-architecture-freeze.md` | **v1.0 freeze spec** |
| `le-6-consistency-rules.md` | LE-6 invariants |
| Roadmap + checklist realignment | LE-1–LE-8 aligned to code |

## v1.0 freeze boundary

| In scope (frozen) | Out of scope (v1.1+ backlog) |
|-------------------|------------------------------|
| LE-1 → LE-5 core pipeline | LE-2.5 execute `currentStatus` prefill |
| LE-6 dedup (active) | Full `SuggestedModulesSection` removal |
| LE-7 overlay (active banner) | Counterfactual `buildScenarioPlan` |
| LE-8 library | LE-8 execution wiring |
| 8 legacy `execute()` scenarios | `EVENT_HANDLERS` → `scenarios/` extract |

## Test plan (full branch)

### P4

- [x] `@arrival-atlas/profile-intelligence` — determinism, missing-context, provenance, confidence
- [x] `@arrival-atlas/api` — `profile-insights.api.test.ts`
- [x] `@arrival-atlas/web` — `profile-insights-boundary.test.ts`

### Life Event

- [x] `packages/modules` — 45 classifier/plan tests (F01–F24)
- [x] `apps/api` — 28 life-event-plan API tests
- [x] `apps/web` — 213 life-event + life-event-plan tests
- [x] Boundary tests: planner, scenario, runtime isolation

```bash
npm run test --workspace=@arrival-atlas/profile-intelligence
npm run test --workspace=@arrival-atlas/modules -- --run src/life-event
npm run test --workspace=apps/api -- --run life-event profile-insights
npm run test --workspace=apps/web -- --run src/lib/life-event src/lib/life-event-plan src/lib/profile-insights
```

### Smoke (manual)

- [ ] Home: plan card + P4 hints deduped when plan covers same intent
- [ ] `/modules/life-event`: plan view + legacy scenario execute
- [ ] Profile: confidence badges + missing-context hints
- [ ] Scenario banner on Home when `resolveScenario` matches

## Architecture invariants (Life Event v1.0)

- Action identity = `node.id` through LE-5
- `ExecutionSurfaceV1` decorates only — never reinterprets plan
- LE-6 dedup does not mutate plan or surfaces
- LE-7 cannot influence planner, execution, or dedup
- LE-8 is post-execution only; library not wired
- All overlays removable without affecting LE-1–LE-5

## Related docs

- [life-state-model.md](../life-events/life-state-model.md)
- [life-event-graph-catalog-v1.md](../life-events/life-event-graph-catalog-v1.md)
- [life-event-architecture-consistency-checklist.md](../adr/life-event-architecture-consistency-checklist.md)
