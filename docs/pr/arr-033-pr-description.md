# arr-033 — MBDE foundation · UX Vision Bible · consultant audits

**Branch:** `arr-033`  
**Tracks:** Maximum Benefits Discovery Engine (MBDE) · UX Vision & Design Constitution · product walkthrough · immigrant cognition audit  
**Base:** `develop` (post arr-032)

Ships three parallel deliverables that together define **what Arrival Atlas can become** (vision) and **what it can compute** (benefits engine v0):

1. **`@arrival-atlas/mbde`** — declarative benefits opportunity mining: rule engine, scoring, clustering, ingestion pipeline, API, admin surface, Postgres schema for future persistence.
2. **`docs/vision/`** — long-term UX design constitution (10 canonical documents + README) — philosophy, principles, galaxy semantics, guide role, onboarding ideal, cognitive load rules.
3. **`docs/audits/`** — evidence base: complete product walkthrough for UX consultants + stressed-immigrant cognition audit with P0–P3 roadmap.

**Product verdict:** Arrival Atlas must eventually answer *“What support, subsidies, and optimizations exist for **my** household — and what is the one highest-value next step?”* MBDE is the computational foundation. The Vision Bible is the filter every future UI must pass. The audits ground both in observed v1 behavior.

**Diff vs `develop` (working tree):** ~55 files · +~6,500 lines · new package `packages/mbde` (~2,400 LOC) · API routes + admin UI · `docs/vision/` (~2,800 lines) · `docs/audits/` (+~1,050 lines).

---

# Part 1 — Maximum Benefits Discovery Engine (MBDE)

## Problem

German migrants face hundreds of overlapping programs (Bund / Land / Kommune / Krankenkasse / tax / NGO / retail) scattered across portals. Existing product modules (`benefits-simulator`, `financial-reality`) solve **narrow calculation** scenarios — not **full opportunity mining** across a household profile.

MBDE v0 establishes the **engine architecture** for:

- Structured `BenefitNode` graph (not FAQ text)
- Declarative `RuleExpression` eligibility (AND / OR / NOT / Condition)
- Probabilistic surfacing (confidence ≥ 0.35 — show uncertain opportunities)
- Scoring maximization (value × confidence × accessibility − effort − time)
- Hidden-benefit clustering (stackable health / housing / tax paths)
- Hybrid ingestion (official · scraped · curated · LLM-normalized)
- Continuous refresh scheduler tiers (daily / weekly / monthly)

## Architecture

```text
UserProfileViewV1 (session profile)
  └── adaptUserProfileView() → MbdeUserProfile
        └── MbdeService.recompute()
              ├── computeAllBenefits()     ← opportunity engine
              │     ├── evaluateEligibility()   declarative rules
              │     └── scoreBenefit()            scoring engine
              ├── buildImpactSummary()
              └── clusterBenefits()        ← hidden / stackable clusters

BenefitGraphStore (in-memory + file-backed JSON)
  ├── GERMANY_SEED_BENEFITS (13 curated nodes)
  ├── ingestRawDocuments() / runScheduledIngestion()
  └── change detection + versioning

API (apps/api)
  ├── GET  /api/benefits/max
  ├── POST /api/benefits/recompute
  ├── GET  /api/benefits/clusters
  ├── GET  /api/benefits/impact-summary
  └── admin: nodes CRUD · deprecate · ingest

Web admin: /admin/mbde — graph list · JSON editor · save · deprecate
```

## Package map (`packages/mbde`)

| Area | Files | Role |
|------|-------|------|
| **Types** | `types/user-profile.ts`, `benefit-node.ts`, `rules.ts`, `scoring.ts`, `cluster.ts`, `ingestion.ts`, `api.ts` | Zod schemas · `MbdeUserProfile` · `BenefitNode` · `RuleExpression` |
| **Engine** | `engine/eligibility-engine.ts`, `opportunity-engine.ts`, `scoring-engine.ts`, `cluster-engine.ts` | Core logic |
| **Profile** | `profile/adapt-user-profile.ts` | `UserProfileViewV1` → `MbdeUserProfile` |
| **Ingestion** | `ingestion/pipeline.ts`, `normalizer.ts`, `change-detection.ts`, `scheduler.ts` | LLM-ready `LlmNormalizerPort` · heuristic fallback |
| **Seeds** | `ingestion/seeds/germany-seed-benefits.ts` | 13 programs: Bürgergeld, Wohngeld, Kindergeld, Krankenkasse orthopedics, tax medical, transport disability, Deutschlandticket, Berlin Bildungsprämie, municipal rent, BAföG, Caritas, Riester, Payback |
| **Storage** | `storage/benefit-graph-store.ts` | `InMemoryBenefitGraphStore` · `FileBenefitGraphStore` |
| **Schema** | `schema/postgres.sql` | Future Postgres persistence (JSONB rules, versions, geo mapping) |
| **Service** | `mbde-service.ts` | Orchestration for API layer |

## Rule engine (not if-else)

```typescript
type RuleExpression =
  | { type: 'and'; rules: RuleExpression[] }
  | { type: 'or'; rules: RuleExpression[] }
  | { type: 'not'; rule: RuleExpression }
  | { type: 'condition'; condition: Condition }

// Condition: field · operator (eq|gt|lt|in|exists|contains|…) · value
```

`evaluateEligibility()` returns `{ eligible, confidence, missingFields, partialMatch }` — enables probabilistic ranking.

## Scoring formula

```
score =
  eligibilityConfidence × w₁
  + monetaryValueWeight × w₂
  + accessibilityWeight × w₃
  − effortCostPenalty × w₄
  − timePenalty × w₅
```

Annual value log-scaled; retroactive stackable boosts; sorted DESC.

## API integration

| File | Change |
|------|--------|
| `apps/api/src/routes/mbde.ts` | 9 secured routes |
| `apps/api/src/mbde/mbde-runtime.ts` | Singleton store · seed bootstrap |
| `apps/api/src/build-app.ts` | `registerMbdeRoutes()` |
| `apps/api/src/routing/route-security-map.ts` | `credential-required` entries |
| `apps/api/package.json` | `@arrival-atlas/mbde` dependency |
| Root `package.json` | Build + test workspace order |

Persistence: `.arrival-atlas-state/mbde-benefit-graph.json` (file-backed, matches existing API state pattern).

## Admin dashboard

| Path | Component |
|------|-----------|
| `/admin/mbde` | `MbdeAdminDashboard.tsx` |

Features: node list · JSON editor · Save rules · Mark deprecated · Refresh.  
Styles: `ui-cohesion.css` (`.mbde-admin` block).

**Note:** Internal ops surface — not end-user benefits UI (deferred).

## Tests

| File | Covers |
|------|--------|
| `eligibility-engine.test.ts` | AND/OR rules · partial match · missing fields |
| `opportunity-engine.test.ts` | Multi-opportunity mining · impact summary · exclude already-receiving |
| `cluster-engine.test.ts` | Health mobility clusters · hidden stackable detection |

```bash
cd packages/mbde && npm test   # 8 tests passing
cd packages/mbde && npm run build
cd apps/api && npm run build
```

## Deferred (post arr-033)

| Item | Notes |
|------|-------|
| User-facing benefits discovery UI | Opportunity lens in Profile / Economic Reality |
| Real data ingestion (Bundesamt, Jobcenter, municipal) | Replace heuristic normalizer |
| LLM normalization production | `LlmNormalizerPort` implementation |
| Postgres migration | `schema/postgres.sql` ready |
| Cross-tab / session-persisted opportunities cache | Recompute on profile mutation hook |
| i18n for benefit titles | DE/RU/UA copy layer |

---

# Part 2 — UX Vision & Design Bible

## Purpose

`docs/vision/` is the **design constitution** — not implementation docs, not marketing. Every future screen, animation, and feature must be evaluated against it before ship.

**Status:** `canonical` — changes require design owner approval.

## Documents

| Document | Role |
|----------|------|
| [README.md](../vision/README.md) | Index · governance · **Certainty Navigation** unifying philosophy |
| [arrival-atlas-philosophy.md](../vision/arrival-atlas-philosophy.md) | **Why** — problem, emotional arc, differentiation |
| [mental-model.md](../vision/mental-model.md) | User thinks in problems, not modules |
| [ux-principles.md](../vision/ux-principles.md) | **25 immutable principles** with anti-patterns |
| [galaxy-design-language.md](../vision/galaxy-design-language.md) | Semantic spec: center, planet, route, gravity, light, darkness… |
| [journey-guide-philosophy.md](../vision/journey-guide-philosophy.md) | Guide as **navigator** — challenges v1 mode election |
| [emotional-design.md](../vision/emotional-design.md) | Arrival Curve: Curiosity → Independence |
| [interaction-principles.md](../vision/interaction-principles.md) | Motion, unlock, disclosure rules |
| [onboarding-philosophy.md](../vision/onboarding-philosophy.md) | **Ideal** first-run (problem intake → one action) — not v1 slider |
| [cognitive-load-rules.md](../vision/cognitive-load-rules.md) | Testable limits: 1 CTA, 0 stacked modals, ≤60 words… |
| [product-personality.md](../vision/product-personality.md) | Voice: calm navigator |

## Unifying philosophy: Certainty Navigation

> Arrival Atlas treats bureaucracy as a **dependency map of your life** and collapses it into **one explainable next step**.

Three pillars:

1. **Situation Map** — what is true  
2. **Dependency Truth** — what must happen before what  
3. **Next Step Engine** — what to do now (with because-string)

## Future model (preserves engineering)

**Situation-First Navigator** — Guide-primary surface for stressed users; galaxy as proof layer; HUD as Now · Situation · Support · Plan.

Vision explicitly documents tension with v1 (marketing slider, module-first HUD, guide mode election) without blocking arr-032 ship.

---

# Part 3 — Consultant & cognition audits

## New audit documents

| Document | Audience | Content |
|----------|----------|---------|
| [product-walkthrough-ux-consultant.md](../audits/product-walkthrough-ux-consultant.md) | UX consultant (never seen product) | Every route · overlay · animation · CTA · state · first-time user journey · `data-ui-surface` capture map |
| [ux-cognition-audit-immigrant-persona.md](../audits/ux-cognition-audit-immigrant-persona.md) | Stressed immigrant persona | Per-screen cognitive load 1–10 · galaxy metaphor verdict · P0–P3 roadmap |

## Key audit findings (inform vision, not repeated as requirements)

| Area | Score / verdict |
|------|----------------|
| Overall cognitive readiness (immigrant persona) | **4.5 / 10** |
| Production readiness UX | **4.5 / 10** |
| Best moment | Guided Life Events with recommendation |
| Worst gaps | Mobile nav hidden · split economic routing · overlay stacking · English-only guide |

Audits → Vision Bible → Phase 1 blockers form a closed loop.

---

# Part 4 — Relationship between deliverables

```text
┌─────────────────────┐     ┌─────────────────────┐
│  Audits (evidence)  │────▶│  Vision (constitution)│
│  walkthrough +      │     │  principles · ideal   │
│  cognition          │     │  onboarding · galaxy  │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           └───────────┬───────────────┘
                       ▼
            ┌─────────────────────┐
            │  MBDE (computation)  │
            │  opportunity mining  │
            │  → future Opportunity│
            │    lens in product   │
            └─────────────────────┘
```

Vision P3-5 explicitly references MBDE user surface. MBDE implements the **Opportunity view** pillar described in [mental-model.md](../vision/mental-model.md).

---

# Part 5 — Architecture compliance

| Constraint | MBDE | Vision docs |
|------------|------|-------------|
| No breaking changes to existing modules | ✓ — new package + routes | ✓ — docs only |
| Reuses `UserProfileViewV1` | ✓ — adapter | — |
| SSR-safe / session-scoped API | ✓ — credential-required | — |
| No user-facing product change required for merge | ✓ — admin-only UI | ✓ |
| Timeless (5-year relevance) | Engine patterns stable | ✓ — no component refs |

---

## Validation checklist (ARR-033 ready)

| Criterion | Status |
|-----------|--------|
| `@arrival-atlas/mbde` builds | ✓ |
| 8 unit tests pass | ✓ |
| API routes registered + security map | ✓ |
| Seed graph loads on first API boot | ✓ |
| Admin dashboard lists + edits nodes | ✓ |
| Postgres schema documented | ✓ |
| Vision Bible 11 files complete | ✓ |
| Walkthrough + cognition audits complete | ✓ |
| No regression to arr-032 demo/session flows | ✓ (MBDE isolated) |

## Known limitations

| Item | Notes |
|------|-------|
| MBDE admin only — no migrant-facing UI | By design in v0 |
| Heuristic normalizer, not production LLM | `LlmNormalizerPort` stub |
| 13 seed benefits — not exhaustive | Expansion via ingest API |
| Profile adapter uses partial domain fields | Grows with profile contract |
| Vision vs v1 tension documented, not resolved in code | Intentional — constitution precedes refactor |

---

## Test plan

### Unit

```bash
cd packages/mbde && npm test
cd packages/mbde && npm run typecheck
cd apps/api && npm run build
```

### Manual smoke — MBDE API

- [ ] Bootstrap session · `GET /api/benefits/max` → ranked opportunities + impact summary
- [ ] Profile with low income + children → Bürgergeld, Kindergeld, Wohngeld in results
- [ ] `POST /api/benefits/recompute` with `minConfidence: 0.5` → filters probabilistic
- [ ] `GET /api/benefits/clusters` → health mobility stackable cluster when applicable
- [ ] `GET /api/benefits/admin/nodes` → 13 seed nodes
- [ ] Patch node rule · recompute → eligibility changes

### Manual smoke — Admin

- [ ] `/admin/mbde` — list loads · edit JSON · save · deprecate

### Manual smoke — regression

- [ ] arr-032 demo/session flows unchanged
- [ ] Galaxy modules unaffected

### Docs review

- [ ] Vision README governance clear for contributors
- [ ] Principles usable as PR review checklist
- [ ] Audits linked from vision README

---

## Related docs

- [arr-032-pr-description.md](./arr-032-pr-description.md) — Phase 1 release blockers · demo session trust
- [arr-031-pr-description.md](./arr-031-pr-description.md) — Journey Guide cinematic unlock
- [phase-1-release-blockers.md](../production-readiness/phase-1-release-blockers.md) — tactical P0 fixes (vision-informed)
- [docs/vision/README.md](../vision/README.md) — Design constitution index
