# arr-026 — Atlas UI Runtime Layer + spatial navigation enforcement

**Branch:** `arr-026`  
**Tracks:** Atlas UI Runtime Layer (AURL) · Celestial destination shell · SNEL · UI cohesion · Homepage node glyphs  
**Base:** `develop` (post arr-025)

Unifies the Atlas frontend into a **single spatial runtime** without rewriting LE/ER business logic. Introduces the **Atlas UI Runtime Layer** (theme, motion engine, navigation graph, persistent canvas), migrates destination routes into a celestial spatial shell, enforces **every route transition** through `SpatialTransitionEngine`, and raises visual cohesion across profile / LE / ER surfaces.

**Product verdict:** The app should feel like **one continuous spatial environment** — star-map home → spatial destination pages with shared HUD, canvas, motion vocabulary, and glass surfaces. No third feature; no backend or EP pipeline changes.

**Diff vs `develop`:** 112 files · +3,799 / −757 lines (`apps/web`).

---

# Part 1 — Atlas UI Runtime Layer (AURL)

## Summary

```text
RootLayout
  └── AtlasRuntimeRoot
        └── UnifiedAppShell
              ├── AtlasRuntimeProvider   (theme · shell mode · motion engine · nav graph)
              ├── ArrivalProvider          (spatial transitions · SNEL)
              ├── SpatialParallaxProvider
              ├── PersistentSpatialCanvas  (recessive star field under all routes)
              └── routes
                    /           → Atlas Home (unchanged layout; node glyph polish)
                    (destinations) → CelestialDestinationRoot → SpatialPageShell
```

## What was added

| Piece | Location | Role |
|-------|----------|------|
| Runtime types + theme | `lib/atlas-runtime/types.ts` · `theme.ts` | `AtlasAppRuntime`, cosmic tokens, shell mode (`star-map` \| `destination`) |
| Spatial graph | `lib/atlas-runtime/spatial-graph.ts` | Route ↔ celestial node mapping |
| Motion vocabulary | `lib/atlas-runtime/motion-vocabulary.ts` | `drift` · `focus-in` · `collapse-to-node` · `expand-from-node` · `ambient-shift` |
| Transition engine | `lib/atlas-runtime/spatial-transition-engine.ts` | `buildSpatialTransition` · `fallback()` (drift default) |
| Runtime root | `components/atlas-runtime/AtlasRuntimeRoot.tsx` | Root mount in `layout.tsx` |
| Unified shell | `components/atlas-runtime/UnifiedAppShell.tsx` | Shared providers + canvas + viewport |
| Legacy wrappers | `components/atlas-runtime/legacy/*` | `LegacyPanelSurface` / `AtlasSurface` · `LegacyGridField` · `LegacyFormNode` · `LegacyDataPlane` |
| Runtime CSS | `app/atlas-runtime.css` | Canvas + particle base styles |

### Design constraints honored

- No homepage layout redesign
- `AtlasHomeProvider` / star-map positioning logic untouched
- No backend or module execution refactor
- Celestial layer re-exports motion primitives; business pages keep existing data flow

---

# Part 2 — Celestial destination shell + route migration

## Summary

```text
app/(destinations)/
  layout.tsx              → CelestialDestinationRoot
  profile/**              → SpatialPageShell + Atlas HUD
  modules/life-event/**   → SpatialPageShell
  modules/economic-reality/**
  modules/[moduleId]/**
```

Legacy flat routes under `app/profile/*` and `app/modules/*` removed; equivalent pages live under `(destinations)`.

## Spatial shell stack

| Component | Role |
|-----------|------|
| `CelestialDestinationRoot` | Slim wrapper — providers lifted to `UnifiedAppShell` |
| `SpatialPageShell` | HUD + parallax structure + `AnimatePresence` content layer |
| `SpatialContentLayer` | Camera enter/exit via `buildSpatialVariants` + easing profiles |
| `SpatialCanvasLayer` | 320 twinkling stars + floating particles (homepage-like) |
| `NodeTrace` | Subtle origin-node breadcrumb on destination pages |
| `ArrivalProvider` | Arrival context, spatial phase, transition resolution |

## Visual fix — stars on destination pages

| Change | Why |
|--------|-----|
| `celestial-destinations.css` — transparent destination root | Opaque gradient was hiding persistent canvas |
| Gradient moved to `.spatial-canvas` | Depth preserved without blocking stars |
| `PersistentSpatialCanvas` at ~35% opacity under shell | Recessive continuity from home → destinations |

---

# Part 3 — Spatial Navigation Enforcement Layer (SNEL)

**Principle:** spatial navigation is the default transport layer — not optional.

## Priority order (enforced)

```text
1. useAtlasNavigation().arriveAt() / navigate()   — explicit intent
2. AtlasLink click                                 — atlas-link origin
3. History interceptor (pushState / popstate)      — router-fallback / back-forward
4. Destination mount fallback                      — drift · center node · fallback-spatial
```

## Components

| Piece | Location |
|-------|----------|
| `useAtlasNavigation` | `components/atlas-runtime/useAtlasNavigation.ts` |
| `AtlasLink` | `components/atlas-runtime/ui/AtlasLink.tsx` |
| `spatialNavigationInterceptor` | `lib/atlas-runtime/spatial-navigation-interceptor.ts` |
| Dev bypass warnings | `console.warn` on raw `<Link />` or `router.push` outside runtime (dev only) |

## Behavior

- **Every** internal route change records spatial arrival intent (sessionStorage)
- Missing intent → `buildFallbackArrivalContext()` with `navigationMode: fallback-spatial`, motion primitive `drift`
- `router.push` / `replace` from `useAtlasNavigation` are guarded; raw history navigation intercepted
- All 23 internal `<Link />` usages migrated to `AtlasLink`
- `ActionRenderer` programmatic nav → `useAtlasNavigation`
- `useCelestialNavigation` → deprecated alias of `useAtlasNavigation`

## Arrival metadata (new fields on `ArrivalContext`)

| Field | Values |
|-------|--------|
| `navigationOrigin` | `explicit` · `atlas-link` · `router-fallback` · `back-forward` · `unknown` |
| `navigationMode` | `explicit-spatial` · `fallback-spatial` |

---

# Part 4 — Homepage node visual enhancement

Micro visual pass on star-map nodes only — no layout or interaction refactor.

| Change | Detail |
|--------|--------|
| Embedded glyphs | `atlas-node-icons.tsx` — stroke SVG icons inside node cores (~64% of core diameter) |
| Icon mapping | Registration → form · Housing → house · Healthcare → cross · Finance → chart · Work → grid · Community → chat · Center → user |
| Glow hierarchy | `.atlas-node__radiance` layer + hover/focus brightness bump |
| Hit targets | Decorative layers `pointer-events: none`; `.atlas-node__hit` unchanged |

---

# Part 5 — UI Cohesion Sprint (~57 → ~75 perceived)

Visual-only alignment across destination surfaces — no new features.

| Addition | Usage |
|----------|-------|
| `ui-cohesion.css` | Typography scale · unified `.btn-secondary` / layout utilities |
| `PageHeader` | Consistent page headers on profile, LE, ER, contract modules |
| `AtlasSurface` | Alias on `LegacyPanelSurface` — replaces raw `.card` |
| `AtlasSecondaryButton` | ER debug, error panels, explain toggles, action cards |
| LE CSS retokenized | `le-node-card`, `le-explorer` → atlas glass tokens |

### Surfaces touched

- Profile mirror + domain detail + edit flows
- Life Event module + scenario explorer + plan intake
- Economic Reality module sections + banners + highlights
- Contract module pages + execution/explain panels

---

# Part 6 — Tests

| File | Covers |
|------|--------|
| `lib/atlas-runtime/spatial-navigation.test.ts` | Path normalization · intent recording · history interceptor · fallback drift intent |

```bash
cd apps/web && npx vitest run src/lib/atlas-runtime/spatial-navigation.test.ts
```

---

## Architecture compliance

| Constraint | Status |
|------------|--------|
| Two features only (LE + ER) | ✓ — runtime layer is shell/motion, not a third feature |
| No BL-* runtime graph redesign | ✓ — UI transport + surface layer only |
| No backend / EP pipeline changes | ✓ |
| Atlas Home layout preserved | ✓ — glyph/glow micro-enhancement only |
| Module routes preserved (`/modules/life-event`, `/modules/economic-reality`, `/profile`) | ✓ — moved to `(destinations)` group, URLs unchanged |
| `implemented-baseline.md` unchanged | ✓ |
| Mock Atlas Home auth unchanged | ✓ |

## Known issues / pre-existing

| Item | Notes |
|------|-------|
| `EconomicActionV1` type error in `resolve-action-route.ts` | Pre-existing; may block full `next build` |
| Some vitest contract tests reference old `app/modules/...` paths | Update paths to `app/(destinations)/...` in follow-up |

## Deferred (explicitly out of scope)

| Item | Notes |
|------|-------|
| Full AURL P0–P3 adoption (auth, theme sync, nav graph ownership) | Documented in prior migration audit; follow-up |
| Homepage motion unification with destination engine | Parallax/ambient remain separate from destination camera |
| Real OAuth | Mock `sessionStorage` gate on Atlas Home |
| `Header.tsx` removal | Retained for hydration tests; production uses `AtlasHUD` |
| ESLint rule enforcing `AtlasLink` | Dev `console.warn` only for now |

---

## Test plan

### Unit

```bash
cd apps/web && npx vitest run src/lib/atlas-runtime/spatial-navigation.test.ts

# Regression baseline
cd apps/web && npx vitest run --project regression

npm run test
```

### Manual smoke — spatial continuity

- [ ] **Guest `/`** — star map loads; node glyphs visible; hover glow subtle
- [ ] **HUD nav** (member) — Explore Atlas / Life Events / ER / Profile feel spatial (drift minimum), not instant swap
- [ ] **AtlasLink CTAs** — profile, LE, ER internal links trigger exit → enter motion
- [ ] **Back/forward** — browser history feels spatial (fallback drift, not white flash)
- [ ] **ER action cards** — `open_module` / `update_profile` navigate through spatial layer
- [ ] **Destination pages** — twinkling stars visible behind glass content
- [ ] **Profile → LE → ER** — consistent `PageHeader`, `AtlasSurface`, typography

### Manual smoke — UI cohesion

- [ ] Profile overview + domain detail — glass surfaces, no raw `.card` regression
- [ ] LE explorer + plan intake — atlas glass, not orphan `le-*` flat panels
- [ ] ER module — unified headers and inline surfaces

### Dev warnings (development only)

- [ ] Raw `next/link` without `data-atlas-nav` → console warn (should not occur after migration)
- [ ] Direct `useRouter().push` outside `useAtlasNavigation` → console warn + fallback still applied

### Typecheck / build

```bash
cd apps/web && npm run typecheck
cd apps/web && npm run build
```

---

## Related docs

- [arr-025-pr-description.md](./arr-025-pr-description.md) — Atlas Home immersive homepage + P0 surfaces (prior track)
- [arr-022-pr-description.md](./arr-022-pr-description.md) — production readiness contract
- [EXECUTION-LOCK.md](../production-readiness/EXECUTION-LOCK.md) — P0 execution freeze
- [ux.md](../production-readiness/ux.md) · [verification.md](../production-readiness/verification.md) — behavior + gates
