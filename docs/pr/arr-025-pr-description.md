# arr-025 — Atlas Home immersive homepage + ARR-023 P0 surface implementation

**Branch:** `arr-025`  
**Tracks:** Atlas Home (guest landing + member slider) · ARR-023 execution lock · P0 surface reliability · Playwright E2E  
**Base:** `develop` (post arr-022)

Replaces the legacy `/` experience (global `Header` + `HomeSnapshotRenderer` dashboard) with an **immersive Atlas Home** — dark premium map-first landing for guests and a six-slide interactive journey for authenticated members. In the same branch, implements the **ARR-023 P0 execution contract**: unified error/retry surfaces, session bootstrap gate, profile load banner, and Playwright coverage aligned with [EXECUTION-LOCK.md](../production-readiness/EXECUTION-LOCK.md).

**Product verdict:** `/` is now a **product-grade Atlas entry surface** (guest CTA + member map slider). LE/ER module routes and shared home components remain functional; real OAuth is **not** in scope — member mode uses a **mock sessionStorage gate**.

**Diff vs `develop`:** 72 files · +6,715 / −498 lines · 3 commits (`New design home` → `Home page v1` → `Homepage v2`).

---

# Part 1 — Atlas Home (`/`)

## Summary

```text
/  →  AtlasHomePage
         ├── AtlasHomeProvider (mock auth: sessionStorage)
         └── AtlasHomeGate
               ├── Guest  → AtlasGuestLanding  (static map + copy + Log in / Sign up)
               └── Member → AtlasMemberSlider  (6 slides · interactive map · HUD)
```

The old `page.tsx` hero + snapshot grid is removed from `/`. `HomeSnapshotRenderer` and related home components **remain in the codebase** for LE wireframe composition and module-adjacent surfaces; they are no longer the default home route.

## Guest experience (unauthenticated)

| Element | Behavior |
|---------|----------|
| **Layout** | Left copy column + static constellation map (no slide rail, no side panel, no journey timeline) |
| **Map** | `interactive={false}` — nodes visible, no click navigation, no profile location under YOU ARE HERE |
| **CTA** | Log in / Sign up / Enter Your Atlas → `login()` (mock) |
| **Data** | `GUEST_LANDING_COPY` + `GUEST_LANDING_MAP` in `guest-landing-data.ts` |
| **Surface markers** | `data-ui-surface="home-atlas"` · `home-atlas-entry` · `home-atlas-map` |

## Member experience (mock login)

| Element | Behavior |
|---------|----------|
| **Slides** | Six slides `01–06` from `ATLAS_SLIDES` in `atlas-data.ts` (orientation → registration → housing → healthcare → finance → work & growth) |
| **Navigation** | Left rail `01–06` · keyboard arrows · **map node click** (`getSlideIndexForNode`) |
| **Map** | Pan/zoom to focused node · emphasized connections · node states (inactive / active / completed / blocked) |
| **UI** | Glass side panel · journey timeline (Arrival → Setup → Stabilize → Build) · Linear-style HUD |
| **Location** | `useAtlasLocationLabel()` — city/week/phase under YOU ARE HERE (member only) |
| **Load sequence** | `useAtlasLoadSequence` — stars → constellation → nodes → center → UI (~2.4s) |

## Visual system

| Piece | Location |
|-------|----------|
| Scoped CSS (`atlas-home.css`) | Design tokens, map hero grid, HUD, nodes, panels, responsive breakpoints |
| Ambient depth | `AtlasAmbientLayers` — canvas stars, particles, constellation SVG |
| Parallax | `useAtlasParallax` — layered mouse offset (stars / map / UI) |
| Motion | `framer-motion` — slide transitions, map enter, node reveal |
| Logo (active) | Compass + constellation mark — `AtlasLogoMark.tsx` · `icon.svg` · `apple-icon.svg` |
| Logo (shelved) | `AtlasLogoMark.variant-nodes.tsx` · `AtlasLogoMark.variant-grid.tsx` · `atlas-logo-variants.ts` |

### Atlas component map

| Component | Role |
|-----------|------|
| `AtlasHomePage.tsx` | Provider + guest/member gate |
| `AtlasHomeProvider.tsx` | Mock auth (`arrival_atlas_home_authenticated`) |
| `AtlasGuestLanding.tsx` | Static guest surface |
| `AtlasSlider.tsx` | Member slider orchestration |
| `AtlasMap.tsx` / `AtlasNode.tsx` / `AtlasConnection.tsx` | SVG constellation map |
| `AtlasHUD.tsx` | Brand + member nav + auth actions |
| `AtlasSlide.tsx` / `AtlasSidePanel.tsx` / `JourneyTimeline.tsx` | Slide copy, focus panel, stage timeline |
| `AtlasLogo.tsx` / `AtlasLogoMark.tsx` | HUD wordmark + mark |

### Map interaction fixes (member)

- Node click switches slide via `onNodeSelect` → `getSlideIndexForNode`
- Decorative SVG layers use `pointer-events: none`; hit target on top
- Left copy / side panel use `pointer-events: none` with interactive children only — map receives clicks under overlays
- No focus ring square on node click (`onMouseDown` preventDefault, no `tabIndex`)

### UX polish in branch

- Removed duplicate bottom progress line (`atlas-slider__progress`) — journey timeline is the sole stage indicator
- HUD nav hover: single underline (`text-decoration: none` overrides global `a:hover`)

---

# Part 2 — P0 surface reliability (ARR-023)

Implements frozen contract from arr-022 docs under [implementation-first-pass-plan.md](../production-readiness/implementation-first-pass-plan.md). No runtime graph redesign; surface-level loading / error / retry only.

## Summary

```text
Session bootstrap ──► BootstrapGate (loading · error + Retry)
Profile load fail   ──► ProfileLoadErrorBanner
Any P0 surface fail ──► SurfaceErrorPanel (data-ui-surface="error-panel")
App crash           ──► AppErrorBoundary
```

## What was done

| ID / area | Change |
|-----------|--------|
| **REL-02 / UX-RETRY-BOOT** | `BootstrapGate` — skeleton on bootstrap loading; `SurfaceErrorPanel` + `retryBootstrap` on session create failure |
| **UX-ENG-01** | `SurfaceErrorPanel` — shared danger-styled error + labeled Retry (`data-ui-surface="error-panel"`) |
| **UX-RETRY-H** | Home LE next-steps / wireframe paths wire `SurfaceErrorPanel` + retry handlers |
| **UX-RETRY-ER-H** | `EconomicRealityCard` — error inside card, never vanishes on failure |
| **UX-RETRY-LE / UX-RETRY-ER** | LE module page + `EconomicRealityPage` — module body error + Retry |
| **REL-05** | `ProfileLoadErrorBanner` — `data-ui-surface="profile-load-error"` |
| **Shell** | `AppProvider` — explicit `bootstrapLoading` / `bootstrapError` / `retryBootstrap`; wraps children in `BootstrapGate` |
| **Crash** | `AppErrorBoundary` in root `layout.tsx` |
| **Helpers** | `SurfaceLoadingSkeleton` · `useSurfaceRetry` |

### Key files

| Area | Location |
|------|----------|
| Bootstrap | `apps/web/src/components/BootstrapGate.tsx` |
| Shared error UI | `apps/web/src/components/surface/SurfaceErrorPanel.tsx` |
| App shell | `apps/web/src/components/AppProvider.tsx` · `layout.tsx` |
| Home LE | `HomeSecondaryContext.tsx` · `HomeLifeEventWireframe.tsx` |
| Home ER | `EconomicRealityCard.tsx` |
| Modules | `app/modules/life-event/page.tsx` · `modules/economic-reality/ui/EconomicRealityPage.tsx` |
| i18n | `packages/core/src/i18n/life-event-translations.ts` (bootstrap error copy) |

---

# Part 3 — Home component layer (retained, refactored)

Home building blocks are **refactored** for P0 states and presence model but **decoupled from `/`**:

| Component | Role |
|-----------|------|
| `HomeExperienceLayout.tsx` | Composable home shell (hero + narrative + signals) |
| `HomePresenceHero.tsx` / `HomePrimaryNarrative.tsx` | Presence-driven copy |
| `HomeSecondaryContext.tsx` | LE plan area with retry |
| `HomeSystemSignals.tsx` | System signal strip |
| `HomeSnapshotRenderer.tsx` | Snapshot-driven renderer (still used in tests / wireframe paths; not mounted on `/`) |
| `EconomicRealityCard.tsx` | ER card with `SurfaceErrorPanel` + surface marker |

Presentation helpers: `home-presence.ts` · `home-presence-display.ts` · `useHomeLandingMotion.ts`.

`home-landing.css` imported via `globals.css` for next-gen home styling used by retained home components.

---

# Part 4 — Verification & E2E (Playwright)

## Tooling added

| Item | Location |
|------|----------|
| Playwright | `@playwright/test` · `apps/web/playwright.config.ts` |
| Scripts | `test:e2e` · `test:e2e:ci` · `test:e2e:install` in `apps/web/package.json` |
| Test suite | `apps/web/tests/e2e/arr-023/` |

## Test files

| File | Covers |
|------|--------|
| `p0-surface-contract.test.ts` | Vitest — P0 `data-ui-surface` markers + `SurfaceErrorPanel` wiring (EXECUTION-LOCK alignment) |
| `bootstrap-gate-contract.test.ts` | Bootstrap gate contract |
| `e2e-01-first-visit.spec.ts` | E2E-01 — cold boot, Atlas/LE surface visible, intake via LE module |
| `e2e-03-profile-update.spec.ts` | E2E-03 — profile edit → LE Home text + ER module refresh |
| `retry-and-failure-injection.spec.ts` | Retry cycles on injected failures |
| `helpers.ts` | Session priming, surface selectors (`home-atlas-map`, `atlas-hud`, etc.) |

### Surface markers (E2E contract)

```text
bootstrap-loading / bootstrap-error
home-atlas-entry / home-atlas-map / atlas-hud
home-next-steps / economic-reality-home-card
life-event-module-body / economic-reality-module-body
profile-load-error / error-panel
```

---

# Part 5 — Production readiness documentation

Aligns frozen arr-022 contract with **implemented runtime truth** after P0 code land.

| File | Change |
|------|--------|
| [EXECUTION-LOCK.md](../production-readiness/EXECUTION-LOCK.md) | **New** — immutable ARR-023 P0 scope + LE/ER execution contracts |
| [runtime-truth.md](../production-readiness/runtime-truth.md) | **New** — verified behavior table (PH-5 LE dominance, ER card hide rules, cache vs retry) |
| [ux.md](../production-readiness/ux.md) | Atlas surfaces, retry paths, Home composition updates |
| [verification.md](../production-readiness/verification.md) | Gate rows, Playwright commands, E2E alignment |
| [engineering.md](../production-readiness/engineering.md) | Task status alignment |
| [index.md](../production-readiness/index.md) | ID traceability updates |
| [implementation-first-pass-plan.md](../production-readiness/implementation-first-pass-plan.md) | Execution progress notes |

---

## Architecture compliance

| Constraint | Status |
|------------|--------|
| Two features only (LE + ER) | ✓ — Atlas Home is entry shell, not a third feature |
| No BL-* runtime graph redesign | ✓ — surface + route changes only |
| No React Query / Zustand / EP pipeline changes | ✓ |
| Unified retry via `SurfaceErrorPanel` | ✓ |
| `data-ui-surface` markers for P0 gates | ✓ |
| `implemented-baseline.md` unchanged | ✓ |
| Module routes (`/modules/life-event`, `/modules/economic-reality`) preserved | ✓ |

## Deferred (explicitly out of scope)

| Item | Notes |
|------|-------|
| Real OAuth / accounts | Mock `sessionStorage` auth on Atlas Home only |
| Member home → live `HomeSnapshotRenderer` | Member sees Atlas slider; snapshot home not re-mounted on `/` |
| `HomeSnapshotRenderer` removal | Retained for wireframe/tests; follow-up cleanup optional |
| OAuth-gated slide content from API | Slides use static `atlas-data.ts` |
| LE-8 UI wiring | Out of P0 scope per EXECUTION-LOCK |
| Production database | Out of beta scope |
| Full Beta Ready Gate sign-off | Requires manual QA + stable CI E2E |

---

## Test plan

### Unit / contract (this PR)

```bash
# P0 surface contract + bootstrap gate
cd apps/web && npx vitest run tests/e2e/arr-023/p0-surface-contract.test.ts
cd apps/web && npx vitest run tests/e2e/arr-023/bootstrap-gate-contract.test.ts

# Regression baseline (BL-16)
cd apps/web && npx vitest run --project regression

# Workspace
npm run test
```

### Playwright (requires API + web dev servers)

```bash
# With servers already running on :3000 / :3001
cd apps/web && npm run test:e2e

# CI mode (starts servers via playwright.config.ts)
cd apps/web && npm run test:e2e:ci
```

### Manual smoke — Atlas Home

- [ ] **Guest `/`** — static map, no slide rail, no location under YOU ARE HERE, CTA triggers mock login
- [ ] **Member `/`** (after Log in) — 6 slides via left rail, keyboard arrows, and map node clicks
- [ ] **Map** — focused node highlights; pan/zoom follows slide; no focus square on node click
- [ ] **HUD** — single underline on nav hover; logo + wordmark visible
- [ ] **Journey timeline** — one progress indicator (no duplicate line below)
- [ ] **Log out** — returns to guest landing

### Manual smoke — P0 surfaces

- [ ] Cold boot — `BootstrapGate` skeleton, then Atlas HUD (not blank)
- [ ] Session create fail — bootstrap error panel + Retry
- [ ] LE plan fail — error + Retry in next-steps / wireframe surface
- [ ] ER card fail — error inside card (card does not disappear)
- [ ] LE / ER module fail — error panel + Retry in module body
- [ ] Profile load fail — `profile-load-error` banner

### Typecheck / build

```bash
cd apps/web && npm run typecheck
cd apps/web && npm run build
```

---

## Related docs

- [EXECUTION-LOCK.md](../production-readiness/EXECUTION-LOCK.md) — ARR-023 P0 freeze
- [runtime-truth.md](../production-readiness/runtime-truth.md) — verified runtime alignment
- [implementation-first-pass-plan.md](../production-readiness/implementation-first-pass-plan.md) — execution guide
- [ux.md](../production-readiness/ux.md) · [verification.md](../production-readiness/verification.md) — behavior + gates
- [arr-022-pr-description.md](./arr-022-pr-description.md) — frozen documentation contract (prior track)
- [arr-020-pr-description.md](./arr-020-pr-description.md) — runtime consistency baseline
