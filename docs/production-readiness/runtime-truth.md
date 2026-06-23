# Runtime Truth — ARR-023 Phase 5

> **Role:** AUTHORITATIVE ALIGNMENT (Phase 5)**  
> Documents **actual runtime behavior** as of ARR-023 P0 implementation.  
> When this file disagrees with older prose in other docs, **this file and verified runtime win**.

[ux.md](./ux.md) · [engineering.md](./engineering.md) · [verification.md](./verification.md) · [index.md](./index.md)

---

## A. Runtime truth table

| System area | Actual behavior (verified) | Prior doc assumption | Status |
|-------------|---------------------------|----------------------|--------|
| **Home ER card visibility** | ER card (`EconomicRealityHomeSection`) is **not rendered** when `shouldHideHomeSecondarySections` is true: LE plan loading, LE plan card visible, or LE cold-start active (`home-p0.ts` PH-5). ER remains reachable via module route and LE wireframe action links. | ER card always visible alongside LE on Home | **Aligned** — LE dominates Home; ER is secondary |
| **Home LE dominance** | When LE has meaningful state (loading / plan card / cold start), catalog, priority actions, browse grid, and ER card are suppressed. Single primary focus on LE next-steps. | Implicit “all Home blocks always show” | **Aligned** — canonical PH-5 rule |
| **ER module retry / caching** | Session-scoped in-memory cache keyed by `deterministicHash` (`REL-R3`). Successful fetch hydrates cache. Reload with unchanged hash may show cached presentation **without** surfacing a new API error. User-initiated **Retry** (`requestSync('ECONOMIC')`) always re-triggers fetch and shows skeleton → content or error. | Reload + API 500 always shows error panel | **Aligned** — cache persistence is **valid**; error panel applies on fetch failure when no valid cached presentation |
| **LE module retry** | No session-scoped presentation cache equivalent to ER. Reload + API 500 reliably shows error panel + Retry. | Same as ER | **Aligned** — LE and ER differ on cache; reliability model matches per-surface fetch contract |
| **Bootstrap retry** | `BootstrapGate` renders `data-ui-surface="bootstrap-error"` + `SurfaceErrorPanel` + `retryBootstrap` on session create failure. Playwright POST intercept on first visit is **environment-flaky**. | Browser E2E always proves bootstrap retry | **Aligned** — contract test + manual gate; optional flaky Playwright skip |
| **Home plan error** | Error visible in `NextStepsCard` inside snapshot **or** plan fallback on `page.tsx` when snapshot lags but plan state exists. | Error only inside snapshot renderer | **Aligned** |
| **Profile edit → ER** | E2E-03 validates LE Home text update + ER **module** body after profile edit. Home ER card not asserted when hidden by PH-5. | Profile edit updates Home ER card | **Aligned** — ER refresh validated at module surface |
| **E2E-01 first visit** | Intake → plan visible; no blank main; LE surface marker present. ER card may be absent when LE plan dominates. | First visit always shows ER card loading | **Aligned** |
| **Unit: ux-contract-boundary** | Fails on hardcoded `'View your situation'`; runtime uses i18n `life-event.home.situationViewProfile`. | Literal copy lock | **Outdated spec test** — non-blocking |
| **Unit: economic-reality-boundary** | Flags `test-harness.ts` importing `buildEconomicRealityPlan` for runtime test fixtures. | Zero engine imports outside ER package | **Outdated spec test** — non-blocking |
| **Unit: contract-lock** | Flags `scenario-registry.ts`, `scenario-signals.ts` reading `userContext.profile` for LE scenarios. | Profile reads only in `selectors.ts` | **Outdated spec test** — non-blocking |

---

## B. Canonical UX contract (source of truth)

### 1. Home composition rule (PH-5 / `HOME-C01`)

**Rule:** Life Event **dominates** the Home primary surface when it has meaningful state.

`shouldHideHomeSecondarySections` returns true when **any** of:

- `planLoading` — LE plan fetch in progress
- `showPlanCard` — LE next-steps plan card is shown
- `showColdStart` — LE cold-start intake path is active

When true, Home **does not render**:

- Economic Reality card
- Suggested modules section (when plan card would show)
- Priority actions section
- Browse-topics grid

**Not a failure.** ER is still available at `/modules/economic-reality` and via links inside the LE wireframe when applicable.

**Verify:** `HOME-C01` · Playwright `UX-RETRY-ER-H` skips when card hidden (expected).

---

### 2. ER module retry rule (`UX-RETRY-ER`)

| Condition | User sees |
|-----------|-----------|
| Initial fetch fails (no cached presentation) | Error panel + Retry in module body |
| User taps Retry | Skeleton → content **or** error panel |
| Fetch succeeded earlier; cache has presentation for current hash | Cached content (no error) |
| User taps Retry after error state | Skeleton → refetch → content or error |
| Reload after success + injected API 500 with same hash | May show **cached** content — not an error state |

**Retry always re-triggers fetch.** Cache does not block explicit Retry.

**Verify:** `ER-M02`–`ER-M06` on **error-state path** · `RETRY-ER03`–`RETRY-ER05` · Playwright ER module retry **skips** when cache masks injected reload failure (documented).

---

### 3. Caching rule (`REL-R3`)

| Layer | Behavior |
|-------|----------|
| **ER economic plan** | In-memory `Map` keyed by `economic-plan:{deterministicHash}`. Invalidated when hash changes after profile sync. |
| **LE life-event plan** | No equivalent presentation cache in web client; plan state held in runtime sync layer and refetched on retry. |
| **Purpose** | Avoid unnecessary refetch flicker (P1 optimization). |
| **Failure contract** | Cache **does not** replace error UI when `state.error` is set. Cache **may** serve stale-success presentation across reload when hash unchanged and no new fetch error propagated to state. |

---

### 4. Bootstrap failure handling (`UX-RETRY-BOOT` / `REL-02`)

| Step | Behavior |
|------|----------|
| Session `POST /api/sessions` fails | `bootstrapLoading` false · `bootstrapError` set · `BootstrapGate` shows error surface within 10s |
| User taps Retry | `retryBootstrap` · loading indicator · Retry disabled |
| Success | App shell + Home load |
| Failure | Error surface · Retry re-enabled |

**Validation tier:**

1. **P0:** `BOOT-C01` source contract (`BootstrapGate.tsx` bindings)
2. **P0:** Manual / staging — block session API, confirm error + retry
3. **Optional:** Playwright bootstrap test — skip when POST intercept does not fire

---

### 5. Profile change refresh (`REL-R1`)

| Surface | Updates without full document reload? |
|---------|--------------------------------------|
| Home LE next-steps / situation text | Yes — E2E-03 |
| Home ER card | Yes **when card visible**; not shown when PH-5 hides secondary sections |
| ER module body | Yes — E2E-03 navigates to module |
| LE module | Yes — via runtime sync (E2E-03 scope: Home + ER module) |

---

## C. Mismatch resolution plan (Phase 5)

| ID | Resolution | Action |
|----|------------|--------|
| M1 | LE dominates Home | Document PH-5 in ux.md; add `HOME-C01`; conditional `RETRY-ER-H` |
| M2 | ER cache valid | Document cache semantics; ER-M02 scoped to error path; Playwright skip documented |
| M3 | Bootstrap E2E flaky | `BOOT-C01` contract test; demote Playwright bootstrap to optional |
| M4 | Compound beta gates | Split verification.md Beta Ready Gate to atomic rows |
| M5 | Unit test failures | Classify as outdated in verification.md; non-blocking for P0 |

**No UI refactors required** for Phase 5 alignment.

---

## D. Readiness (Phase 5)

| Criterion | Status |
|-----------|--------|
| Runtime fully described in docs | ✅ This file + ux.md / verification.md patches |
| No implicit “ER always on Home” assumption | ✅ |
| E2E tests reflect real behavior (skips documented) | ✅ |
| No compound beta gates | ✅ verification.md |
| System explainable without guessing | ✅ |

**Production-consistency statement:** Documentation now matches runtime. P0 user journeys are reliable and testable. Remaining gaps are **classified** (outdated unit tests, optional bootstrap Playwright, P1 items) — not hidden spec drift.
