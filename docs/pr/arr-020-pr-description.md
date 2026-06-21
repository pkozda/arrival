# arr-020 — Runtime Consistency v2, hydration/bootstrap fix, and reactivity remediation

**Branch:** `arr-020`  
**Tracks:** Runtime Consistency Model v2 · Runtime Reactivity Audit P1–P2 · SSR/hydration determinism · Golden User Journeys  
**Base:** `develop` (post arr-019)

Addresses **production-critical client runtime defects** identified after Economic Reality v1 closure: stale UI after actions, fragmented refresh graph, hydration mismatch (`Language` vs `Язык`), and boot-time `/plan` 400 errors. Introduces **Runtime Consistency Model v2** as a graph-driven sync layer **without** React Query, Zustand, or server pipeline changes.

**Product verdict:** Client runtime is **interactive-closure-ready** for P1–P2 audit items; P3–P4 hardening (home catalog coherence, session-scoped cache, LE-8 wiring) remains deferred.

---

# Part 1 — Runtime Consistency Model v2

Unified event-driven sync bus replacing fragmented `refresh*` calls across `AppProvider` and isolated `EconomicRealityPlanProvider` fetch-on-mount.

## Summary

```text
PROFILE_MUTATED ──┐
ECONOMIC_ACTION_EXECUTED ──┼──► runtimeReactionBus ──► runtimeConsistencyModel
SESSION_SYNC_REQUESTED ──┘         │
                                   ▼
                          domainSyncGraph (annotated plan)
                                   │
                    PROFILE → LIFE_EVENT → ECONOMIC → SNAPSHOT
                                   │
                                   ▼
                    commitStateTransaction → RuntimeConsistencyProvider
```

## What was done

| Piece | Role |
|-------|------|
| `runtimeReactionBus` | Pub/sub for input events + `SYNC_STARTED` / `SYNC_COMPLETED` |
| `domainSyncGraph` | Static graph + topological sync plan builder |
| `domainSyncExecution` | Dependency blocking, skip reasons, consistency policy |
| `runtimeConsistencyModel` | Queued sync execution, bootstrap guard, domain fetch orchestration |
| `RuntimeConsistencyProvider` | React context; atomic domain commits + loading/errors |
| `stateTransaction` | Domain patch merge + legacy loading/error projection |
| `EconomicRealityPlanProvider` | Thin adapter over `useRuntimeConsistency()` (no isolated fetch) |

### Sync graph edges

| From | To | Semantics |
|------|-----|-----------|
| PROFILE | LIFE_EVENT | cascade |
| PROFILE | ECONOMIC | cascade |
| LIFE_EVENT | ECONOMIC | dependency |
| ECONOMIC | SNAPSHOT | recompute |

### Key files

| Area | Location |
|------|----------|
| Runtime layer | `apps/web/src/lib/runtime/` |
| Provider integration | `apps/web/src/components/AppProvider.tsx` |
| ER plan adapter | `apps/web/src/lib/economic-reality/useEconomicRealityPlan.tsx` |
| Action feedback bus | `apps/web/src/lib/economic-reality/useEconomicFeedbackTracker.ts` |
| Contract spec | [runtime-consistency-contract-v1.md](../runtime/runtime-consistency-contract-v1.md) |

### Closes (audit RR-04, RR-05, partial RR-03)

- Profile mutation → ER + snapshot refresh in one graph
- `refreshSessionState()` → `requestSync('FULL')` through model
- `EconomicRealityPlanProvider` reads from shared consistency state

---

# Part 2 — Hydration & bootstrap safety

Fixes SSR/client divergence and sync race on cold boot.

## Symptoms fixed

| Symptom | Root cause |
|---------|------------|
| Hydration mismatch `Language` / `Язык` | `localStorage` + `t()` applied before mount |
| `GET /life-event/plan` → 400 on boot | Sync before `UserContext.profile` ready |
| `GET /economic-reality/plan` → 400 on boot | Same bootstrap race |

## What was done

| Fix | Change |
|-----|--------|
| Header SSR determinism | `mounted` guard — fallback `"Language"` until client mount |
| App locale bootstrap | `languageRef` starts `'en'`; `readStoredDisplayLanguage()` only in `useEffect` |
| Bootstrap gate | `bootstrapCompleteRef` + `setBootstrapReady()` before any `ingest()` |
| `runSync` guard | Early return if `!bootstrapReady \|\| !sessionId` |
| Plan domain skip | `profile_not_ready` skip for LIFE_EVENT / ECONOMIC without profile |
| Client guards | `if (!sessionId) return null` on plan fetch clients |
| Graceful 400 | `isMissingUserContextProfilePlanResponse()` in `plan-fetch.ts` |

### Key files

| Area | Location |
|------|----------|
| Header | `apps/web/src/components/Header.tsx` |
| Locale persistence | `apps/web/src/lib/i18n/display-language.ts` |
| Display language selector | `apps/web/src/lib/user-context/selectors.ts` |
| Bootstrap provider | `apps/web/src/lib/runtime/RuntimeConsistencyProvider.tsx` |
| Plan clients | `apps/web/src/lib/life-event-plan/client.ts`, `apps/web/src/lib/economic-reality/client.ts` |

### Profile language phantom default removed

- `preferredLanguage` optional in `UserProfileViewV1Schema`
- `selectAppDisplayLanguage`: explicit profile pref only; else session language
- `project-profile-state.ts`: no phantom `'en'` projection

---

# Part 3 — Economic Reality reactivity (Audit P1)

Remediates critical findings from [runtime-reactivity-audit-v1.md](../audits/runtime-reactivity-audit-v1.md) without EP pipeline changes.

## What was done

| Audit ID | Fix |
|----------|-----|
| **RR-01** | `ActionRenderer` branches by `action.type`: navigate vs execute |
| **RR-02** | `reconcileEconomicPlanState` always returns fresh object graph (`structuredClone`) |
| **RR-03** | `trackActionExecuted` → `runtimeConsistencyModel.ingest()`; inline `UI_ACTION_RECORDED` feedback |
| Sozialamt intent | `sozialamt_case_open` satisfaction key + feedback enrichment in execution state |
| i18n RU | `ECONOMIC_REALITY_COPY_RU` wired through copy-resolver and web translations |
| Action routes | `resolve-action-route.ts` for `open_module` / `update_profile` / `external_resource` |

### Key files

| Area | Location |
|------|----------|
| Action UI | `apps/web/src/modules/economic-reality/ui/components/ActionRenderer.tsx` |
| Reconcile | `apps/web/src/lib/economic-reality/reconcileEconomicPlan.ts` |
| Feedback mapper | `packages/modules/src/module-orchestration/feedback-mapper.ts` |
| Satisfaction keys | `packages/modules/src/economic-reality/execution/satisfaction-keys.ts` |
| Execution state | `packages/modules/src/economic-reality/execution/build-execution-state.ts` |
| RU copy | `packages/product-contract/src/i18n/economic-reality-strings.ru.ts` |

---

# Part 4 — Life Event cold start

Minimal intake path when user has session but no profile domains filled.

| Piece | Location |
|-------|----------|
| Intake field definitions + mutation builder | `apps/web/src/lib/life-event/cold-start-intake.ts` |
| Intake UI | `apps/web/src/components/life-event/LifeEventPlanIntake.tsx` |
| Page routing | `apps/web/src/app/modules/life-event/page.tsx` |
| i18n | `packages/core/src/i18n/life-event-translations.ts` |

---

# Part 5 — Regression test suite

System invariant tests for SSR → hydration → event bus → sync graph → commit.

| Suite | File | Tests |
|-------|------|-------|
| Hydration determinism | `apps/web/src/__tests__/hydration/hydration-determinism.test.tsx` | 3 |
| Bootstrap guards | `apps/web/src/__tests__/runtime/bootstrap-guards.test.ts` | 3 |
| Sync graph determinism | `apps/web/src/__tests__/runtime/sync-graph-determinism.test.ts` | 4 |
| Reference safety | `apps/web/src/__tests__/runtime/reactivity-reference-safety.test.ts` | 5 |
| Golden runtime flow | `apps/web/src/__tests__/e2e/golden-runtime-flow.test.tsx` | 2 |
| Forbidden behaviors | `apps/web/src/__tests__/runtime/forbidden-runtime-behaviors.test.ts` | 7 |

Vitest split: `unit` (node) + `regression` (happy-dom). **24 regression tests.**

```bash
cd apps/web && npx vitest run --project regression
```

---

# Part 6 — Documentation & E2E coverage

| Document | Role |
|----------|------|
| [runtime-reactivity-audit-v1.md](../audits/runtime-reactivity-audit-v1.md) | Pre-fix audit (RR-01–RR-14) |
| [runtime-consistency-contract-v1.md](../runtime/runtime-consistency-contract-v1.md) | Frozen behavioral contract for Model v2 |
| [golden-user-journeys-v1.md](../testing/golden-user-journeys-v1.md) | Acceptance journey definitions |
| [e2e-user-journey-tests-report.md](../economic-reality/e2e-user-journey-tests-report.md) | 29 cross-module E2E tests (API + modules + web) |

---

## Architecture compliance

| Constraint | Status |
|------------|--------|
| No React Query / Zustand / Redux | ✓ |
| No EP-1→EP-11 server pipeline changes | ✓ |
| No new EP stages | ✓ |
| `domainSyncGraph` logic preserved — lifecycle guards only | ✓ |
| Event bus extension, not replacement | ✓ |
| Deterministic SSR first render | ✓ |
| Bootstrap before sync execution | ✓ |
| Reference-safe reconcile on explicit fetch | ✓ |

## Deferred (explicitly out of scope)

| ID | Item |
|----|------|
| RR-06 | Snapshot version gate hardening on forced refresh |
| RR-07 | `suggestEconomicModulesFromLifePlan` in home view model |
| RR-08 | Session-scoped economic plan cache keys |
| RR-09 | Render-time `setEconomicActionContext` refactor |
| RR-10 | LE-8 runtime React wiring |
| RR-13 | Profile editor draft resync on external mutation |
| `EconomicRealityNavLink` | Optional mounted guard if nav hydration mismatch observed |

---

## Test plan

### Automated

- [ ] `apps/web` regression — 24 invariant tests
- [ ] `apps/web` runtime unit — `src/lib/runtime/*.test.ts` (19)
- [ ] `apps/web` economic-reality — reconcile + boundary
- [ ] `packages/modules` — feedback-mapper + satisfaction-feedback
- [ ] `apps/api` — economic-reality action API (sozialamt `planChanged`)

```bash
# Regression suite (arr-020 gate)
cd apps/web && npx vitest run --project regression

# Runtime layer
cd apps/web && npx vitest run src/lib/runtime

# Cross-module E2E
npm run test -w @arrival-atlas/api -- tests/e2e/economic-reality
npm run test -w @arrival-atlas/modules -- tests/e2e/economic-reality
npm run test -w @arrival-atlas/web -- tests/e2e/economic-reality

# Modules feedback + satisfaction
cd packages/modules && npx vitest run feedback-mapper satisfaction-feedback
```

### Smoke (manual)

- [ ] Cold boot — no hydration mismatch in console; Header shows `Language` then localized label after menu open
- [ ] Cold boot — Network tab: no `/plan` 400 before profile exists
- [ ] Profile mutation → Economic Reality surface updates without reload (GJ-04)
- [ ] ER intent click — `UI_ACTION_RECORDED` feedback; Sozialamt block advances after reset + intent
- [ ] Language switch persists across navigation (localStorage + session sync)
- [ ] Life Event cold start — intake form submits and loads plan
- [ ] ER page in Russian — copy keys resolve (not raw `ER.*` keys)

### Dev workflow

```bash
npm run predev   # after package changes
npm run dev      # api + web only
npm run dev:packages  # optional modules watch
```

---

## Related docs

- [runtime-consistency-contract-v1.md](../runtime/runtime-consistency-contract-v1.md)
- [runtime-reactivity-audit-v1.md](../audits/runtime-reactivity-audit-v1.md)
- [golden-user-journeys-v1.md](../testing/golden-user-journeys-v1.md)
- [e2e-user-journey-tests-report.md](../economic-reality/e2e-user-journey-tests-report.md)
- [economic-reality-v1-closure-spec.md](../economic-reality/economic-reality-v1-closure-spec.md)
- [arr-019-pr-description.md](./arr-019-pr-description.md) — prior Economic Reality v1 closure track
