---
id: economic-reality-system-audit-v1
title: Economic Reality — System Audit v1 (post-EP-11)
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: finance
status: active
maturity: evolving
owner: engineering
tags:
  - economic-reality
  - architecture
  - ep-1
  - ep-11
  - determinism
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - economic-reality-module-v1-spec
  - economic-reality-module-v1-roadmap
  - platform-planning-constitution-v1
related:
  - economic-reality-module-v1-readiness-audit
  - life-event-platform-integration-audit
---

# Economic Reality — System Audit v1 (post-EP-11)

**Date:** 2026-06-21  
**Scope:** Architectural integrity of pipeline **EP-1 → EP-11** (implementation in `packages/modules`, `apps/api`, `apps/web`)  
**Method:** Code review + invariant checks + automated test runs (no new feature work)  
**Tests at audit time:** 232 (modules) + 31 (api) + 37 (web) = **300 green**

---

## Executive verdict

| Property | Verdict | Notes |
|----------|---------|-------|
| **A. Determinism** (UserContext → full pipeline) | **CONDITIONAL PASS** | Core pipeline is deterministic and fixture-tested; `graphHint` diverges from authoritative graph; EP-12 feedback events (if enabled) change evaluation input |
| **B. Layer purity** | **CONDITIONAL PASS** | Linear pipeline respected; EP-3 satisfaction keys leak evaluation; EP-6 semantic remap |
| **C. Single source of truth** | **FAIL** | Dual graph paths (`graphHint` vs `resolveGraphContext`); parallel cross-module link tables; LE still dual-targets `financial-reality` |
| **D. Cross-module correctness** | **PARTIAL FAIL** | LE → ER catalog bridge works; LE graph + legacy runtime still reference `financial-reality` |

**Can we say “architecturally closed, deterministic, production-safe”?**

> **Not yet.** Core engine + API + client boundaries are production-grade. **6 architectural violations** (2 critical, 4 minor) must be patched or explicitly governed before v1.0 closure.

---

## A. PASS / FAIL matrix (EP-1 → EP-11)

| EP | Layer | Verdict | Summary |
|----|-------|---------|---------|
| **EP-1** | Rule engine (state) | **FAIL** | First-match enforced ✅; R7 unconditional catch-all ❌; R4/R6 predicate overlap (order-resolved) ⚠️; R7 never wins in fixtures ❌ |
| **EP-2** | Graph | **FAIL** | `resolveGraphContext` is total + tested ✅; `evaluation.graphHint` from `selectGraphHint` diverges on E1/E4 employed paths ❌ |
| **EP-3** | Execution | **FAIL** | Node status deterministic ✅; satisfaction keys use `evaluation.supportSystem` ❌; deps not enforced on completion ⚠️ |
| **EP-4** | Actions | **PASS** | Pure function of execution; catalog-only templates; stable sort |
| **EP-5** | Planner | **PASS** | Track partition + global P5 dedup + deterministic ordering |
| **EP-6** | Presentation | **FAIL** | Bijective action↔card ✅; `report_income_change` remapped to PROFILE_CARD ❌; grouped cards collapse labels ❌ |
| **EP-7** | API | **PASS** | Server-only pipeline; Zod validation; SHA-256 `meta.deterministicHash`; authority headers |
| **EP-8** | Client | **PASS** (minor) | No engine in runtime lib; hash-keyed cache; raw error strings in lib ⚠️ |
| **EP-9** | UI surfaces | **PASS** (minor) | Presentation renderer; boundary tests; debug action IDs + raw errors ⚠️ |
| **EP-10** | Catalog / router | **FAIL** | Catalog exists ✅; parallel `cross-module-links` tables ❌; hardcoded Home href ❌; LE dual module ❌ |
| **EP-11** | i18n / copy | **PASS** (minor) | Key-only wire contract ✅; UI uses `useEconomicCopy` ✅; error surfaces not keyed ⚠️ |

---

## B. System-wide invariants

### I — Pipeline integrity (linear EP-1 → EP-6 → EP-7)

**PASS**

```text
UserContext (+ optional feedbackSignals at API)
  → evaluate (EP-1)
  → resolveGraphContext (EP-2)
  → buildExecutionState (EP-3)
  → buildActionSet (EP-4)
  → buildPlan (EP-5)
  → buildPresentation (EP-6)
  → buildEconomicRealityPlanResponse + SHA-256 hash
```

Evidence: `packages/modules/src/api/economic-reality/pipeline.ts` — strict sequential chain, no backward imports in web runtime.

### II — No dual truth

**FAIL**

| Dual truth | Location | Severity |
|------------|----------|----------|
| `evaluation.graphHint` ≠ `graph.graphId` for same run | `rule-engine/rules.ts` + `graph/resolve-graph.ts` | **Critical** |
| `presentation.metadata.deterministicHash` (planId#actions) ≠ `meta.deterministicHash` (SHA-256) | `presentation/build-presentation.ts` | Minor |
| `cross-module-links.ts` static maps parallel `MODULE_CATALOG_V1` triggers | `module-orchestration/cross-module-links.ts` | **Critical** |
| LE graph nodes offer `financial-reality` and `economic-reality` | `life-event/plan/graph/catalog.ts` | **Critical** |
| Router prefers action `href` over catalog route | `apps/web/src/app-shell/modules/router.ts` | Minor |

### III — Deterministic replay

**CONDITIONAL PASS**

| Input | Same output across runs? | Evidence |
|-------|--------------------------|----------|
| `UserContextV1` only (modules package) | ✅ | EF01–EF24 parity; repeat-run tests in action-set, plan, presentation |
| `UserContextV1` + `requestId` / `generatedAt` | ✅ (hash ignores meta noise) | `serializer.ts` + API tests |
| Locale (DE/EN) | ✅ (copy layer only; pipeline keys unchanged) | EP-11 key-only presentation |
| `economicRealityEvents[]` (EP-12, API) | ⚠️ **Out of EP-11 scope** | Feedback signals enrich EP-1 input; same events → same plan |

### IV — Catalog authority

**FAIL**

Authoritative registries exist but are not the **only** routing source:

- ✅ `GRAPH_REGISTRY` + `resolvePrimaryGraph` (EP-2)
- ✅ `MODULE_CATALOG_V1` (EP-10)
- ✅ `ER_COPY_KEYS` + DE/EN tables (EP-11)
- ❌ `selectGraphHint` still active in EP-1 output
- ❌ `LIFE_EVENT_NODE_TARGETS` etc. duplicate catalog
- ❌ `EconomicRealityCard` hardcodes `/modules/economic-reality`

---

## C. Architectural violations (classified)

### Critical (must fix or govern before v1.0 closure)

#### V-C1 — Dual graph resolution (`graphHint` vs `resolveGraphContext`)

**Class:** duplicate truth  
**Files:** `rule-engine/rules.ts`, `graph/selector.ts`, `graph/resolve-graph.ts`

`selectGraphHint()` is still embedded in EP-1 evaluation. It disagrees with authoritative EP-2 graph for multiple fixtures:

| Fixture | State | `graphHint` (EP-1) | Actual graph (EP-2) |
|---------|-------|-------------------|---------------------|
| EF01, EF15, EF16, EF19 | E1 self_sustained | G1-C | G1-A |
| EF13, EF14, EF22 | E4 + employed | G4 | G3 |

Consumers reading `evaluation.graphHint` get stale/wrong graph identity. Pipeline uses `resolveGraphContext` — wire output is internally inconsistent.

**Minimal patch:** Remove `graphHint` from evaluation or derive it from `resolveGraphContext(evaluation)` in one place only.

---

#### V-C2 — EP-3 satisfaction keys depend on evaluation output

**Class:** hidden coupling  
**Files:** `execution/satisfaction-keys.ts`, `execution/build-execution-state.ts`

```typescript
evaluation?.supportSystem === 'jobcenter'  // satisfaction-keys.ts:31
```

Spec (`economic-graph-catalog-v1.md`) states satisfaction is from `UserContextV1` only. EP-3 re-runs `evaluate()` internally and passes evaluation into satisfaction resolver — execution layer depends on classifier output, not profile facts alone.

**Minimal patch:** Derive `jobcenter_case_open` only from profile/benefits domains; drop `evaluation` parameter.

---

#### V-C3 — LE ↔ ER duplicate module authority

**Class:** duplicate truth + cross-module  
**Files:** `life-event/plan/graph/catalog.ts`, `cross-module-signal-engine.ts`

Life Event graph still routes economic setup to `financial-reality` on several nodes; some nodes expose **both** modules. Constitution §6 forbids silent dual planners; product must pick one handoff target or document dual authority.

**Minimal patch:** Product decision + migrate LE `open_module` refs to `economic-reality` where ER owns institutional planning.

---

#### V-C4 — Parallel cross-module link tables

**Class:** duplicate truth  
**File:** `module-orchestration/cross-module-links.ts`

`LIFE_EVENT_NODE_TARGETS`, `LIFE_STATE_TARGETS`, etc. duplicate `MODULE_CATALOG_V1` triggers. Drift risk when catalog changes without updating link maps.

**Minimal patch:** Generate or resolve links from catalog triggers only (`matchesModuleTriggers` / `resolveTriggeredModules`).

---

### Minor (patch in stabilization pass)

| ID | Class | Issue | Location |
|----|-------|-------|----------|
| V-M1 | determinism / spec | R7 unconditional fallback; zero fixtures with `winningRule: R7` | `rule-engine/rules.ts` |
| V-M2 | hidden coupling | R5 requires `employmentAxis === 'transition'` but unknown status → `'unemployed'` → falls to R7 | `rule-engine/axes.ts` |
| V-M3 | boundary | EP-6 `report_income_change` → `PROFILE_CARD` semantic remap | `presentation/intent-ui-mapper.ts` |
| V-M4 | boundary | Grouped cards use first action `labelKey` only | `presentation/card-builder.ts` |
| V-M5 | boundary | Raw English error strings bypass copy keys | `useEconomicRealityPlan.tsx`, `action-executor.ts` |
| V-M6 | boundary | `HighlightPanel` shows raw `dominantActionRefIds` | `ui/components/HighlightPanel.tsx` |
| V-M7 | catalog authority | Home card hardcoded href | `EconomicRealityCard.tsx` |
| V-M8 | catalog authority | `open-module-resolver` fallback href when catalog missing | `actions/open-module-resolver.ts` |
| V-M9 | duplicate truth | Nested `presentation.metadata.deterministicHash` ≠ authoritative `meta` | `presentation/build-presentation.ts` |
| V-M10 | hidden coupling | `validateActionSetCopyKeys` in tests only, not pipeline runtime | `copy-validation.ts` |

---

## D. Layer-by-layer detail

### EP-1 — Rule Engine

| Check | Result |
|-------|--------|
| R1–R7 mutually exclusive predicates | ⚠️ R4∩R6 overlap; order resolves |
| FIRST MATCH WINS enforced | ✅ `runEconomicRules` early return |
| No implicit fallbacks | ❌ R7 always matches |
| Axes deterministic | ✅ pure `computeEconomicSignals` |
| EF01–EF24 coverage | ✅ state + winningRule; ❌ no R7 winner fixture |

### EP-2 — Graph

| Check | Result |
|-------|--------|
| E-state → graph total function | ✅ `resolvePrimaryGraph` + exhaustiveness |
| No runtime overrides | ✅ no config hooks |
| `entryNodeId` stable | ✅ static maps, 24/24 fixture tests |
| SUPPORT_OVERRIDE | ✅ implemented; ⚠️ trace not fixture-asserted |

### EP-3 — Execution

| Check | Result |
|-------|--------|
| Node status deterministic | ✅ pure evaluator, repeat-run tests |
| Dependency graph acyclic | ✅ manual catalog DAG; ❌ no automated cycle test |
| Satisfaction from context only | ❌ uses evaluation |
| No hidden state | ⚠️ silent empty-key fallback in `lookupNodeCatalogEntry` |

### EP-4 — Actions

| Check | Result |
|-------|--------|
| Pure function of execution | ✅ `userContext` ignored |
| Catalog-only templates | ✅ `NODE_ACTION_CATALOG` |
| Stable ordering | ✅ type → node → id |
| Rules A–D | ✅ A,C,D; B unreachable (blocked = locked, not active) |

### EP-5 — Planner

| Check | Result |
|-------|--------|
| Tracks partition action set | ✅ + `assertNoCrossTrackDuplicates` |
| P5 global dedup | ✅ single `seen` Set |
| Ordering deterministic | ✅ `ordering.ts` |
| No hidden prioritization | ✅ strategy sort only in `ordering.ts` |

### EP-6 — Presentation

| Check | Result |
|-------|--------|
| 1:1 action → card coverage | ✅ bijection tested |
| No meaning transformation | ❌ intent UI type remap |
| UI strategy from EP-5 only | ✅ `resolvePresentationUiStrategy(orderingStrategy)` |
| Section order immutable | ✅ PRIMARY → SECONDARY → SYSTEM |

### EP-7 — API

| Check | Result |
|-------|--------|
| Full pipeline server-only | ✅ |
| No partial client recompute | ✅ |
| `deterministicHash` stable | ✅ SHA-256, meta excluded |
| `schemaVersion` defined | ✅ literals + Zod (post EP-7 incident fix) |

### EP-8 — Client

| Check | Result |
|-------|--------|
| No engine imports | ✅ `economic-reality-boundary.test.ts` |
| Cache keyed by hash only | ✅ `economic-plan:${hash}` |
| No UI heuristics in lib | ✅ |
| Hydration pure projection | ✅ `hydrateEconomicPlan` + `ui-adapter` |

### EP-9 — UI

| Check | Result |
|-------|--------|
| Presentation-only renderer | ✅ no planner in components |
| No business logic | ✅ |
| Navigation declarative | ✅ `labelKey` + catalog visibility |
| No raw-state branching | ✅ uses presentation + copy keys |

### EP-10 — Module graph

| Check | Result |
|-------|--------|
| Catalog as cross-module truth | ❌ parallel link tables |
| No hardcoded routing in UI | ❌ Home card href |
| LE → ER catalog-driven | ✅ bridge + `resolveCrossModuleLink` |
| `open_module` deterministic | ✅ strategy → entrypoint map |

### EP-11 — i18n

| Check | Result |
|-------|--------|
| No raw strings in UI tree | ✅ EP-11 test + forbidden phrase list |
| All labels via keys | ✅ wire + UI |
| No English hardcoding in surfaces | ⚠️ errors/debug IDs leak |
| Key registry completeness | ✅ DE resolves all keys; runtime validation test-only |

---

## E. Patch list (minimal diffs — no redesign)

Priority order:

1. **Unify graph authority** — retire `selectGraphHint` from evaluation output; single path via `resolveGraphContext`.
2. **EP-3 satisfaction decoupling** — remove `evaluation` from `evaluateEconomicSatisfactionKeys`.
3. **Catalog-derived cross-module links** — delete or generate static maps from `MODULE_CATALOG_V1`.
4. **LE economic handoff** — product call: migrate `financial-reality` → `economic-reality` on institutional nodes.
5. **EP-6 intent remap** — document as product rule or render `report_income_change` as `INTENT_CARD`.
6. **EP-11 error copy** — route lib/UI errors through `ER_COPY_KEYS`.
7. **Home card route** — use `buildModuleCatalogRoute(ECONOMIC_REALITY_MODULE_CATALOG_ENTRY)`.
8. **R7 fixture + predicate** — add EF fixture proving R7 or align with `economic-rule-engine-v1.md`.
9. **Drop nested presentation hash** — or align with `meta.deterministicHash`.
10. **Runtime copy validation** — call `validatePresentationCopyKeys` in `buildPresentation` (already in pipeline path).

---

## F. Out-of-scope note (post-EP-11 work in tree)

**EP-12 Integration Bridge** (feedback events → `mapEventsToFeedbackSignals` → enriched `evaluate`) is present in API state but **not in this audit scope**. It intentionally breaks strict “UserContextV1 alone” determinism: same profile + different event log → different plan. This is by design for EP-12 but must be documented in constitution before v1.0 if retained.

---

## G. Test evidence summary

```bash
# Audit commands run 2026-06-21
cd packages/modules && npx vitest run src/economic-reality src/api/economic-reality src/module-orchestration src/i18n
# 232 passed

cd apps/api && npx vitest run src/economic-reality
# 31 passed (incl. EF01–EF24 API parity)

cd apps/web && npx vitest run src/lib/economic-reality src/modules/economic-reality
# 37 passed (EP-8 boundary, EP-9/10/11 guards)
```

Boundary guard tests: `economic-reality-boundary.test.ts`, `ep9-ui-surface.test.ts`, `ep10-module-catalog.test.ts`, `ep11-i18n.test.ts`.

---

## H. Final gate statement

| Question | Answer |
|----------|--------|
| Is the pipeline architecturally sound? | **Yes** — linear, tested, server-authoritative |
| Is it fully closed? | **No** — 4 critical duplicate-truth / coupling gaps |
| Is it deterministic for v1 replay? | **Yes** for `UserContextV1` in modules; **conditional** at API with EP-12 events |
| Is it production-safe for demo/alpha? | **Yes** with known metadata inconsistencies (`graphHint`) |
| Is it v1.0 ship-ready without patches? | **No** — apply patch list §E items 1–4 minimum |

---

## Related

- [economic-reality-module-v1-roadmap.md](../economic-reality/economic-reality-module-v1-roadmap.md)
- [economic-rule-engine-v1.md](../economic-reality/economic-rule-engine-v1.md)
- [platform-planning-constitution-v1.md](../platform/platform-planning-constitution-v1.md)
- [life-event-platform-integration-audit.md](./life-event-platform-integration-audit.md)
