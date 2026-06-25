# arr-027 — Spatial memory · homepage performance · UI cohesion wave 1

**Branch:** `arr-027`  
**Tracks:** Spatial Memory Layer · Atlas Frontend Performance Sweep (80/20) · UI Cohesion Wave 1 · Optimization audit  
**Base:** `develop` (post arr-026)

Extends the arr-026 spatial runtime with **context-aware transition memory**, delivers a **low-risk homepage performance sweep** (no architecture redesign), and raises **destination surface cohesion** so profile / LE / ER feel like the same Atlas universe as `/`.

**Product verdict:** The app should feel **faster on the homepage**, **smoother when navigating back**, and **visually continuous** from star-map home into modules — without new features, backend changes, or layout refactors.

**Diff vs `develop` (working tree):** ~48 files · +~900 / −~280 lines (`apps/web`) · 1 audit doc.

---

# Part 1 — Spatial Memory Layer

## Summary

```text
Navigation event
  └── spatialNavigationInterceptor
        ├── spatialMemoryStore.recordTransition(from, to, nodeId)
        └── getSpatialTransitionContext(from, to, memory)
              └── buildSpatialTransition(arrival, context)
                    ├── motion primitive (relation-aware)
                    └── modifiers: durationScale · motionScale · isReturnPath
```

A **session-scoped memory layer** — not a new animation system. It records recent routes and transition patterns, derives `SpatialTransitionContext`, and applies subtle modifiers when the user returns along a familiar path.

## What was added

| Piece | Location | Role |
|-------|----------|------|
| `SpatialMemoryStore` | `lib/atlas-runtime/spatial-memory-store.ts` | Route stack (max 12) · transition history (max 5) · visit/pattern queries |
| `getSpatialTransitionContext` | `lib/atlas-runtime/spatial-transition-context.ts` | Direction · depth change · cluster relation · `memoryMatch` · `isReturnTrip` |
| Engine integration | `lib/atlas-runtime/spatial-transition-engine.ts` | `buildSpatialTransition(arrival, context?)` · return-path easing + duration scale |
| Motion modifiers | `lib/atlas-runtime/spatial-motion.ts` · `lib/celestial/spatial-easing.ts` | `durationScale` · `isReturnPath` passed into camera motion |
| Types | `lib/celestial/types.ts` · `lib/atlas-runtime/types.ts` | `spatialTransitionContext` on `ArrivalContext` |
| Wiring | `spatial-navigation-interceptor.ts` · `ArrivalProvider.tsx` · `useAtlasNavigation.ts` · `SpatialContentLayer.tsx` | Memory recorded on every navigation; context attached to arrival |

## Behavior

| Signal | Effect |
|--------|--------|
| `isReturnTrip` | Shorter duration (~0.72×) · reduced motion scale · return easing profile |
| `memoryMatch` (repeated from→to) | Familiar-path duration/motion scale (~0.88×) |
| Relation (`same-cluster`, `node-to-module`, …) | Chooses primitive: `drift` · `expand-from-node` · `collapse-to-node` |

Memory resets on full page refresh (in-memory only).

---

# Part 2 — Homepage Performance Sweep (80/20)

**Principle:** highest user-perceived gain, lowest implementation risk. No provider splitting, no `AppContext` redesign, no routing changes.

## P1 — Homepage runtime

| Change | Before | After |
|--------|--------|-------|
| **Single starfield** | `PersistentSpatialCanvas` + `AtlasAmbientLayers` (~640 star draws/frame on `/`) | Canvas hidden when `shellMode === 'star-map'`; ambient layer is sole authority (~220 stars) |
| **Parallax without React rerenders** | `useAtlasParallax` → `setState` on every `mousemove` | CSS variables on `.atlas-parallax-root` via `requestAnimationFrame` (lerped) |
| **Animation cost trim** | 320+320 stars · 28 particles · heavy SVG blur on nodes | 220 stars · 18 particles · reduced blur radii (visual identity preserved) |

## P2 — Rendering stability

| Change | Detail |
|--------|--------|
| `useMemo` on `AppContext.Provider` value | Stable reference when deps unchanged — reduces fan-out rerenders |
| `React.memo` on `AtlasNode` · `AtlasConnection` | Map subtree skips redundant reconciliation |
| Active slide only | `AtlasSlider` mounts one `AtlasSlide` + `AnimatePresence mode="wait"` (was 6 stacked) |

## P3 — CSS weight

| Stylesheet | Before | After |
|------------|--------|-------|
| `life-event-polish.css` | Root `layout.tsx` (every route) | `(destinations)/layout.tsx` only |
| `home-landing.css` | `globals.css` `@import` | `HomeExperienceLayout.tsx` import (snapshot home only) |

### Estimated impact

| Metric | Before | After (est.) |
|--------|--------|--------------|
| Homepage star canvas draws | ~640/frame | ~220/frame |
| Parallax pointer path | React rerender tree | rAF → CSS vars only |
| Mounted slide panels | 6 | 1 |
| Irrelevant CSS on `/` | ~1,734 lines parsed | 0 from scoped files |
| Optimization health score | **44 / 100** | **~58–62 / 100** (audit baseline) |

Full audit: [atlas-frontend-optimization-audit.md](../audits/atlas-frontend-optimization-audit.md).

---

# Part 3 — UI Cohesion Wave 1

**Principle:** visual-only — no layout, business logic, or screen redesign.

**Target:** perceived cohesion **~57 → ~72** on destination routes.

## P1 — Surface unification

Raw `.card` on active destination routes replaced with **Atlas glass** (`AtlasSurface` / `LegacyPanelSurface` / `legacy-form-node`):

- Profile overview · domain detail · edit flows
- Life Event plan intake · module wireframe loading/content
- Generic module schema forms
- Loading / error shells on profile + `[moduleId]` routes

`legacy-form-node` upgraded to match `legacy-panel-surface` glass tokens.

## P2 — Shared page header system

`PageHeader` CSS aligned with homepage slide rhythm:

- Tracked uppercase eyebrow (`text-eyebrow` · 0.14em letter-spacing)
- Strong headline (`clamp(1.5rem, 2.2vw, 2rem)` · −0.03em tracking)
- Muted supporting copy (0.875rem · 1.65 line-height)

Profile domain + edit pages now use `eyebrow="Profile"`.

## P3 — Life Event harmonization

`life-event-polish.css` retokenized (structure unchanged):

| Target | Change |
|--------|--------|
| `le-hero` | Glass gradient · cyan edge glow · backdrop blur |
| `le-node-card` | Already glass — action row uses unified secondary |
| `le-explorer` · `le-explorer-panel` | Atlas glass borders/shadows |
| `le-plan-intake` | Typography classes + `AtlasSurface` wrapper |
| `le-confidence` | Dark glass chip |

## P4 — Button consistency

| Addition | Usage |
|----------|-------|
| `AtlasSecondaryLink` | LE intake · LE node actions · `ProfileEditCTA` |
| `atlas-secondary-button--compact` | LE plan node action chips |
| `btn-primary-link` · `text-link-accent` | Profile module CTAs · back links |

`ui-cohesion.css` — link variants for `a.atlas-secondary-button` · destination-scoped error glass.

## P5 — Typography cleanup

High-traffic inline styles replaced with utilities: `text-section-title` · `text-body--muted` · `text-caption` · `stack-sm` · `mt-sm`.

ER `HighlightPanel` + section renderers adopt shared scale.

---

# Part 4 — Tests

| File | Covers |
|------|--------|
| `lib/atlas-runtime/spatial-memory.test.ts` | Memory store · return trip · familiar path · context derivation (7 tests) |
| `lib/atlas-runtime/spatial-navigation.test.ts` | SNEL path normalization · intent · interceptor · fallback (5 tests) |

```bash
cd apps/web && npx vitest run \
  src/lib/atlas-runtime/spatial-memory.test.ts \
  src/lib/atlas-runtime/spatial-navigation.test.ts
```

---

## Architecture compliance

| Constraint | Status |
|------------|--------|
| Two features only (LE + ER) | ✓ — memory + perf + cohesion are shell/UX layers |
| No BL-* / EP pipeline changes | ✓ |
| No homepage layout redesign | ✓ — parallax + star dedup + render trim only |
| No `AppContext` API shape change | ✓ — `useMemo` only |
| No routing / provider splitting | ✓ — explicit sweep constraint |
| Module URLs unchanged | ✓ |
| `implemented-baseline.md` unchanged | ✓ |

## Known issues / pre-existing

| Item | Notes |
|------|-------|
| `EconomicActionV1` type error in `ActionRenderer.tsx` | Pre-existing; may block full `next build` |
| `useAtlasNavigation` / `capturedAt` on `ArrivalContext` | Verify typecheck before merge |
| Home snapshot cards (`HomeSnapshotRenderer`) | Still use global `.card` — out of destination scope |
| Homepage primary CTA vs module `btn-primary` | Intentional; pill CTA remains homepage-only |

## Deferred (explicitly out of scope)

| Item | Notes |
|------|-------|
| Route-level `dynamic()` for LE/ER chunks | Audit item #1–2; follow-up arr-028+ |
| `SpatialParallaxProvider` RAF setState on destinations | Separate from homepage parallax fix |
| Provider splitting / `AppContext` decomposition | Audit recommendation; not this branch |
| ESLint rule enforcing `AtlasLink` | Dev `console.warn` only (arr-026) |
| Home snapshot surface cohesion | Requires `home-landing` route decision |

---

## Test plan

### Unit

```bash
cd apps/web && npx vitest run \
  src/lib/atlas-runtime/spatial-memory.test.ts \
  src/lib/atlas-runtime/spatial-navigation.test.ts

npm run test
```

### Manual smoke — spatial memory

- [ ] **Home → LE → back** — return motion feels slightly faster / softer than first visit
- [ ] **Repeat HUD nav** (same from→to twice) — familiar-path modifier (subtle duration change)
- [ ] **Profile ↔ module** — relation-aware primitive still correct (expand/collapse vs drift)

### Manual smoke — homepage performance

- [ ] **Guest `/`** — single starfield (no double-density flicker); parallax smooth without UI jank on mouse move
- [ ] **Member `/`** — slide rail switches copy; only one slide panel in DOM; map parallax intact
- [ ] **Destination route** — persistent canvas stars still visible (canvas unhidden outside `star-map`)

### Manual smoke — UI cohesion

- [ ] **Profile** — glass domain cards · PROFILE eyebrow · unified secondary on edit CTA
- [ ] **LE module** — glass hero · intake · explorer; no flat orphan panels
- [ ] **ER module** — highlight panel glow · section titles on scale · glass error state
- [ ] **Generic module** — schema form on glass `legacy-form-node`; loading shell not flat card

### DevTools quick check (optional)

- [ ] Homepage: no React rerender storm on `mousemove` (React Profiler)
- [ ] `/` network: `life-event-polish.css` not loaded on first paint (scoped to destinations)

### Typecheck / build

```bash
cd apps/web && npm run typecheck
cd apps/web && npm run build
```

---

## Related docs

- [arr-026-pr-description.md](./arr-026-pr-description.md) — AURL · SNEL · celestial shell · initial cohesion sprint
- [arr-025-pr-description.md](./arr-025-pr-description.md) — Atlas Home immersive homepage
- [atlas-frontend-optimization-audit.md](../audits/atlas-frontend-optimization-audit.md) — read-only perf audit (score 44 → roadmap)
- [EXECUTION-LOCK.md](../production-readiness/EXECUTION-LOCK.md) — P0 execution freeze
