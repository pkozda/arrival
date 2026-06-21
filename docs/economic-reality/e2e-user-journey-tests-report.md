# E2E User Journey Tests — Economic Reality × Life Event

**Status:** complete — **29 tests, all passing** (2026-06-21)

This document reports on the end-to-end test suite for cross-module user journeys between **Life Event** and **Economic Reality**. Tests assert only observable behavior at API, orchestration, and UI boundaries — not internal rule-engine or graph-engine implementation.

---

## Summary

| Layer | Location | Files | Tests | Status |
|-------|----------|-------|-------|--------|
| API E2E | `apps/api/tests/e2e/economic-reality/` | 5 | 9 | ✅ |
| Module orchestration E2E | `packages/modules/tests/e2e/economic-reality/` | 5 | 14 | ✅ |
| UI rendering E2E | `apps/web/tests/e2e/economic-reality/` | 4 | 6 | ✅ |
| **Total** | | **14** | **29** | ✅ |

Run commands:

```bash
# All three layers
npm run test --workspace=@arrival-atlas/api -- tests/e2e/economic-reality
npm run test --workspace=@arrival-atlas/modules -- tests/e2e/economic-reality
npm run test --workspace=@arrival-atlas/web -- tests/e2e/economic-reality
```

---

## Scenarios covered

### Scenario A — First-time user onboarding → economic assistance

**Fixtures:** Life Event `F01` (arrival unregistered), Economic Reality `EF07` (crisis), `EF03` (institution path)

| Assertion | API | Modules | Web |
|-----------|-----|---------|-----|
| Life Event classifies `arrival_unregistered` | ✅ | ✅ | — |
| Catalog suggests `economic-reality` with CRISIS entrypoint | — | ✅ | ✅ |
| Plan returns `CRISIS_FIRST` / `PROGRESSION_FIRST` strategy | ✅ | ✅ | — |
| PRIMARY + SYSTEM sections present (crisis path) | ✅ | ✅ | ✅ |
| Benefit / system intent action present | ✅ | ✅ | ✅ |
| `open_module` enriched with `entry=CRISIS` in **plan** tracks | — | ✅ | — |
| IntentCard + ResourceCard UI mapping | — | — | ✅ |

**Note:** `open_module` href enrichment (`?entry=CRISIS`) is applied at plan-build time, not in the raw `actionSet`. Tests assert enriched plan actions, not pre-enrichment actionSet hrefs.

### Scenario B — Stabilized user (employment + benefits)

**Fixture:** `EF13` (employment + reporting)

| Assertion | API | Modules | Web |
|-----------|-----|---------|-----|
| `INSTITUTION_FIRST` strategy | ✅ | ✅ | — |
| PRIMARY + SECONDARY sections | ✅ | ✅ | ✅ |
| `update_profile` actions in plan | ✅ | ✅ | — |
| No crisis benefit intents | ✅ | ✅ | ✅ |
| SYSTEM section minimal or empty | ✅ | ✅ | ✅ |
| ProfileCard UI mapping, no crisis IntentCard | — | — | ✅ |

**Bonus:** `EF01` (self-sustained) verifies minimal system surface at modules layer.

### Scenario C — Crisis recovery progression

**Flow:** `EF07` crisis context → profile stabilization → second plan request

| Assertion | API | Modules | Web |
|-----------|-----|---------|-----|
| Initial `CRISIS_FIRST` plan | ✅ | ✅ | — |
| `deterministicHash` changes after context update | ✅ | ✅ | — |
| Transition to `INSTITUTION_FIRST` / progression path | ✅ | ✅ | — |
| UI strategy and section layout change post-stabilization | — | — | ✅ |

---

## Test layers (design)

### 1. API layer E2E (`apps/api`)

Uses Fastify `inject()` against a real `buildApp()` instance with seeded session state.

**Endpoints exercised:**

- `GET /api/modules/life-event/plan`
- `GET /api/modules/economic-reality/plan`
- `POST /api/modules/economic-reality/action/execute`

**Assertions:**

- Zod-safe response validation via `validateEconomicRealityPlanResponse`
- `deterministicHash` identical across repeated GET for same context
- Plan action IDs ⊆ `actionSet` action IDs
- Action execute accepts in-set IDs, rejects out-of-set IDs (403/400 boundary)

**Files:**

| File | Purpose |
|------|---------|
| `helpers.ts` | Session bootstrap, context seeding, plan fetch |
| `scenario-a-api-journey.test.ts` | F01 + EF07 onboarding path |
| `scenario-b-api-journey.test.ts` | EF13 stabilized institution path |
| `scenario-c-api-journey.test.ts` | EF07 → stabilize → hash change |
| `action-execute-e2e.test.ts` | actionSet membership enforcement |
| `determinism-api.test.ts` | Per-fixture hash/plan replay (EF01, EF03, EF07, EF13) |

### 2. Module orchestration E2E (`packages/modules`)

Exercises the full pipeline without HTTP: Life Event plan → catalog routing → Economic Reality plan build.

**Assertions:**

- `suggestModulesForLifeContext` returns catalog-backed `economic-reality` targets
- `resolveCrossModuleLink` entrypoints (e.g. CRISIS for `job_loss`)
- No duplicate cross-module routes; catalog is sole routing source
- `actionSet` integrity and presentation key-only contract
- Deterministic replay: `hashRun1 === hashRun2`, `planRun1 === planRun2`

**Files:**

| File | Purpose |
|------|---------|
| `helpers.ts` | Fixtures, `buildJourneyEconomicPlan`, determinism helpers |
| `scenario-a-onboarding-journey.test.ts` | LE classification + crisis/institution ER paths |
| `scenario-b-stabilized-user.test.ts` | EF13 + EF01 stabilized paths |
| `scenario-c-crisis-recovery.test.ts` | Context transition + hash change |
| `module-orchestration-journey.test.ts` | Catalog routing integrity |
| `determinism-regression.test.ts` | Full EF catalog replay stability |

### 3. UI rendering E2E (`apps/web`)

Lightweight boundary tests using `adaptPresentationToUi` — no browser, no snapshots.

**Assertions:**

- Section → panel mapping: PRIMARY → `MainActionPanel`, SECONDARY → `SupportPanel`, SYSTEM → `SystemPanel`
- Card type mapping: `INTENT_CARD` → `IntentCard`, `PROFILE_CARD` → `ProfileCard`, `RESOURCE_CARD` → `ResourceCard`
- Copy contract: all `titleKey` / `labelKey` values use `ER.*` prefix (i18n keys, not raw strings)
- User-visible keys do not leak graph action ref patterns (`gN-node:action-id`)
- Life-event bridge uses catalog only (no static cross-module maps)

**Files:**

| File | Purpose |
|------|---------|
| `helpers.ts` | `buildUiJourneyPlan`, copy-key and UI projection assertions |
| `scenario-a-ui-rendering.test.ts` | Crisis PRIMARY + SYSTEM |
| `scenario-b-ui-rendering.test.ts` | Stabilized PRIMARY + SECONDARY |
| `scenario-c-ui-rendering.test.ts` | Post-recovery layout change |
| `module-orchestration-ui.test.ts` | Catalog bridge + router boundary |

---

## Determinism contract

Every layer enforces:

```
same userContext + same generatedAt → same deterministicHash
same hash → same graphContext, executionState, actionSet, plan, presentation
```

Fixed metadata in all E2E helpers:

```ts
{ requestId: 'e2e_*_request', generatedAt: '2026-06-21T12:00:00.000Z' }
```

Dedicated regression suites:

- `packages/modules/.../determinism-regression.test.ts` — all EF fixtures + full catalog sweep
- `apps/api/.../determinism-api.test.ts` — repeated HTTP GET per fixture

---

## Fixture map

| ID | Role | Key outcomes |
|----|------|--------------|
| **F01** | Life Event — empty arrival | `arrival_unregistered`, catalog → economic-reality |
| **EF01** | Self-sustained | Minimal system surface |
| **EF03** | Registration incomplete | `PROGRESSION_FIRST`, institution entry |
| **EF07** | Crisis (no income/employment/benefits) | `CRISIS_FIRST`, `CRISIS_UI`, benefit intent |
| **EF13** | Employment + benefits active | `INSTITUTION_FIRST`, PRIMARY+SECONDARY, profile actions |

Fixtures are reused from existing `ECONOMIC_FIXTURES` and `CLASSIFIER_FIXTURES` — no ad-hoc inline contexts in tests.

---

## Anti-goals (verified absent)

The suite does **not**:

- Assert rule IDs (R1–R7) or graph node IDs as business logic
- Import or mock internal rule/graph engine modules directly
- Use snapshots (except structural equality via `toEqual`)
- Depend on wall-clock time or randomness
- Test visual rendering / pixel layout

---

## Known boundaries & fixes applied during implementation

1. **Plan vs actionSet enrichment** — `open_module.entrypoint` and `?entry=CRISIS` href appear in plan track actions after catalog enrichment; raw `actionSet` keeps `entrypoint: 'auto'`. Scenario A modules test asserts plan-level href.

2. **UI action ref IDs** — `actionRefIds` and `cardId` are internal adapter metadata and may contain graph-scoped IDs. The "no raw IDs in UI" check applies only to user-visible copy keys (`titleKey`, `labelKey`), not structural fields.

3. **Vitest module resolution (web)** — Specific `@arrival-atlas/modules/*` subpath aliases must precede the broad `@arrival-atlas/modules` alias in `vitest.config.ts` to avoid resolution failures from `copy.ts` → `@arrival-atlas/modules/i18n`.

---

## Regression detection scope

This suite acts as a system-level safety net for:

- Cross-module routing regressions (catalog → open_module)
- Plan strategy selection (CRISIS_FIRST vs INSTITUTION_FIRST vs PROGRESSION_FIRST)
- actionSet ↔ plan integrity
- deterministicHash stability and intentional invalidation on context change
- Presentation → UI adapter mapping
- API action-execute authorization boundary

---

## Next steps (optional)

- Add CI job matrix entry running all three `tests/e2e/economic-reality` paths on PR
- Extend Scenario C with `POST action/execute` after stabilization (profile update mutation round-trip)
- Add Playwright smoke test reusing same fixtures for true browser E2E (out of scope for v1 lightweight UI tests)
