# Atlas Frontend Optimization Audit

**Scope:** `apps/web` as of `arr-026` (AURL, SNEL, spatial memory, UI cohesion).  
**Method:** Static code analysis + dependency inspection. Production `next build` currently fails on a type error in `useAtlasNavigation.ts`, so bundle sizes are **estimated** from dependency graph and Next.js conventions, not measured chunk output.

---

## Executive Summary

### Optimization Health Score: **44 / 100**

| Dimension | Score | Summary |
|-----------|-------|---------|
| Bundle Efficiency | 50 | Thin deps, but **zero route-level lazy loading**; fat global layout client boundary |
| Render Efficiency | 35 | **60fps React state updates** from parallax; duplicate star canvases on `/` |
| State Efficiency | 42 | Deep provider tree; `AppContext` value recreated every render |
| Motion Efficiency | 30 | **2× RAF star loops** on homepage + global parallax RAF + 13 framer-motion entry points |
| CSS Efficiency | 48 | **4,409 CSS lines**; ~1,800 lines loaded on routes that never use them |
| Scalability Readiness | 40 | Single mega-context; linear SVG/motion cost per node; no list virtualization |

### If the app doubled tomorrow — what breaks first?

1. **Continuous animation + React reconciliation** (parallax RAF → full subtree rerenders)
2. **Homepage GPU compositing** (blur filters × nodes + dual canvas + particles)
3. **`AppProvider` rerender fan-out** (every data fetch hits all `useApp()` consumers)
4. **Initial JS payload** (framer-motion + full runtime shell on every route)
5. **CSS parse cost** (global imports grow linearly with each new module stylesheet)

---

## 1. Bundle Analysis

**Current state:** No `next/dynamic`, no `React.lazy`, no route-level code splitting in app code. `next.config.mjs` only transpiles workspace packages — no `modularizeImports`, no bundle analyzer.

### Top 10 largest JS contributors (estimated first-load)

| Chunk / Source | Est. gzip | Reason | Lazy? | Impact |
|----------------|-----------|--------|-------|--------|
| `next` client runtime | ~90 KB | Framework | No | Every route |
| `react-dom` | ~45 KB | Framework | No | Every route |
| **framer-motion** | ~35–45 KB | 13 files import it; homepage + destinations | Partially | High on `/` |
| App shell (`AppProvider` + runtime) | ~40–60 KB | Client layout wraps all pages | No | Every route |
| `@arrival-atlas/core` i18n | ~15–25 KB | `life-event-translations.ts` (599 lines) | Yes | Loaded via `AppProvider` |
| `@arrival-atlas/product-contract` | ~20–35 KB | Types + adapters transpiled | Partial | LE/ER/profile |
| Spatial stack (AURL + celestial + SNEL) | ~15–25 KB | Engine, interceptor, memory, providers | Partial | Every route via `AtlasRuntimeRoot` |
| LE module page graph | ~25–40 KB | `LifeEventScenarioExplorer`, `SchemaForm`, wireframe | **Should be** | Only `/modules/life-event` |
| ER module UI | ~15–25 KB | Section renderers, action cards | **Should be** | Only `/modules/economic-reality` |
| Profile editor stack | ~15–20 KB | `DomainMutationEditor`, field renderers | **Should be** | Only `/profile/*/edit` |

### Top 10 easiest bundle reductions

| # | Change | Est. savings | Effort |
|---|--------|--------------|--------|
| 1 | `dynamic()` LE `LifeEventScenarioExplorer` + `SchemaForm` | 25–40 KB off homepage/ER | Low |
| 2 | `dynamic()` ER `EconomicRealityPage` sections | 15–25 KB | Low |
| 3 | Split framer-motion: CSS transitions on HUD/rail; FM only for spatial shell | 20–35 KB on `/` | Medium |
| 4 | Move `life-event-polish.css` out of root `layout.tsx` → destinations only | 0 JS, faster CSS parse | **Very low** |
| 5 | Lazy-load `home-landing.css` (only via `HomeSnapshotRenderer` paths) | ~983 lines CSS | Low |
| 6 | Tree-shake / split `@arrival-atlas/core` translations by locale | 10–20 KB | Medium |
| 7 | Server Components for static profile/LE headers (`PageHeader` copy) | 5–15 KB + less hydration | Medium |
| 8 | Defer `SpatialNavigationInterceptor` history patch to client-only chunk | Small | Low |
| 9 | Profile `DomainMutationEditor` dynamic import | 10–15 KB | Low |
| 10 | `@next/bundle-analyzer` + `modularizeImports` for framer-motion | 5–15 KB | Low |

### Route splitting reality

| Route | Code split? | CSS on first paint |
|-------|-------------|-------------------|
| `/` (homepage) | No — inherits full shell | `globals` + `atlas-home` + `atlas-runtime` + `ui-cohesion` + **`life-event-polish`** + **`home-landing`** (via globals import) |
| Destinations | Next.js page chunks only | Above + `celestial-destinations` |

**Homepage pays for LE/ER/profile CSS and runtime it does not render.**

---

## 2. Homepage Runtime Performance

### Component workload

| Component | Render trigger | Animation | Severity |
|-----------|----------------|-----------|----------|
| **`PersistentSpatialCanvas`** | `SpatialParallaxProvider` offset **every frame** | 320-star canvas RAF | **Critical** |
| **`AtlasAmbientLayers`** | `useAtlasParallax` mousemove + `loadPhase` | **Second** 320-star canvas RAF | **Critical** |
| **`SpatialParallaxProvider`** | `setOffset` @ ~60fps | RAF loop | **Critical** |
| **`useAtlasParallax`** | `setNormalized` on every `mousemove` | Re-renders slider shell | **Critical** |
| **`AtlasSlider`** | Parent parallax + slide change | Re-renders map + 6 slides + panels | High |
| **`AtlasNode` × 7** | Slide focus, hover, `loadPhase` | framer-motion per node + SVG blur | High |
| **`AtlasSlide` × 6** | All mounted; `isActive` toggles opacity | 6× `motion.div` | Medium |
| **`JourneyTimeline`** | Stage change | Infinite pulse on active dot | Low |
| **`AtlasConnection` × 14** | Slide emphasis | CSS/SVG stroke | Low |
| **`AtlasHUD`** | Pathname only | Static | Low |

### What limits homepage FPS first?

**Rank: Critical**

1. **Dual canvas RAF** — ~640 `arc()` fills/frame (`AtlasAmbientLayers` 320 + `SpatialCanvasLayer` 320), both active on `/`
2. **`SpatialParallaxProvider` React setState every RAF** — forces React reconciliation across destination shell **even on homepage** (canvas reads `offset.background`)
3. **`useAtlasParallax` mousemove → setState** — full `AtlasSlider`/`AtlasGuestLanding` rerender on pointer move

**Rank: Medium**

4. SVG `filter: blur()` on every node glow layer (7 nodes × animated breathe)
5. 52 CSS-animated particles (28 + 24)
6. framer-motion layout animations on slide change (`AnimatePresence mode="wait"`)

**Rank: Low**

7. `JourneyTimeline` infinite scale pulse
8. 14 connection lines + 7 local lines (static SVG)

---

## 3. React Render Audit

| Component | Issue | Severity | Expected gain |
|-----------|-------|----------|---------------|
| **`AppProvider` / `AppProviderSessionLayer`** | `AppContext.Provider value={{...}}` — **new object every render** | **Critical** | Large reduction in LE/ER/profile rerenders |
| **`SpatialParallaxProvider`** | `setOffset` every RAF → all `useSpatialParallax()` consumers | **Critical** | 60fps → near-zero React work during idle |
| **`AtlasSlider`** | Rerenders on every mousemove via `useAtlasParallax` | **Critical** | Smooth pointer tracking without React |
| **`AtlasSlider`** | Renders **all 6 `AtlasSlide`** always | High | ~5× less slide subtree work |
| **`LifeEventScenarioExplorer`** | `useApp()` — any app state change rerenders full explorer + form | High | Isolated on LE route only after lazy load |
| **`AtlasNode`** | Parent rerender re-renders all 7 nodes | Medium | `React.memo` on nodes |
| **`AtlasMap`** | `motion.g` pan/zoom on slide change rerenders all nodes/connections | Medium | Acceptable unless node count 3× |
| **`ArrivalProvider`** | Context value properly `useMemo`'d | OK | — |
| **`AtlasRuntimeProvider`** | Stable `useMemo` runtime object | OK | — |
| **`ProfileMirrorOverview`** | `useApp()` + maps all domains | Medium at 100 domains | Memoize cards |
| **`JourneyTimeline`** | 4 stages, cheap | Low | — |

---

## 4. State Management Audit

| Provider | Consumers | Update frequency | Optimization |
|----------|-----------|------------------|--------------|
| **`AppProvider` (`AppContext`)** | 30+ components (LE, ER, profile, home cards) | Every bootstrap fetch, profile sync, plan refresh, language change | **Split contexts**: session / profile / plan / i18n; `useMemo` value |
| **`RuntimeConsistencyProvider`** | `AppProviderSessionLayer`, ER plan | Per sync event; value is `useMemo`'d | Good; keep consumers narrow |
| **`SpatialParallaxProvider`** | `SpatialCanvasLayer`, `SpatialPageShell`, `SpatialContentLayer` | **~60/sec** | **Refs + CSS variables**, not React state |
| **`ArrivalProvider`** | Spatial shell, `useAtlasNavigation` | Route change + spatial phases | Good; consider splitting phase vs transition |
| **`AtlasRuntimeProvider`** | Canvas, navigation | Pathname change only | Good |
| **`AtlasHomeProvider`** | HUD, guest/member gate | Auth toggle only | Good |
| **`EconomicRealityPlanProvider`** | ER module subtree | Plan hash changes | OK |

**Provider nesting cost (every route):**

`AppProvider` → `RuntimeConsistencyProvider` → `EconomicRealityPlanProvider` → `BootstrapGate` → `AtlasRuntimeProvider` → `ArrivalProvider` → `SpatialParallaxProvider` → page

**7 client providers** before any page content — all hydrate on `/`.

---

## 5. Motion Performance Audit

| Animation source | Cost | Frequency | Optimization potential |
|------------------|------|-----------|------------------------|
| **`SpatialCanvasLayer` canvas RAF** | High CPU (320 arcs + resize) | Continuous, all routes | Recess on `/`; single canvas authority |
| **`AtlasAmbientLayers` canvas RAF** | High CPU (duplicate) | Continuous, homepage only | **Remove duplicate** — use persistent canvas only |
| **`SpatialParallaxProvider` RAF + setState** | High CPU + **React** | Continuous | Ref-based transforms |
| **`useAtlasParallax` mousemove** | Medium React | Every pointer move on `/` | rAF throttle or CSS-only |
| **framer-motion spatial transitions** | Medium GPU (blur, scale, rotate) | Per navigation | Keep; already respects `prefers-reduced-motion` |
| **SVG node `filter: blur(12px)`** | High GPU | 7 nodes, CSS breathe animation | Reduce blur radius; `will-change` sparingly |
| **CSS particles (52 spans)** | Medium compositor | Infinite CSS animations | Reduce count on low-end / `prefers-reduced-motion` |
| **Nebula gradients (destination canvas)** | Medium GPU | Static layers | OK |
| **Spatial memory / SNEL** | Low CPU | Per navigation | OK |

**Most expensive animation:** dual star-field canvas loops + parallax-driven React updates.

---

## 6. CSS Audit

| File | Lines | Active on `/` | Dead / low-value on `/` | Notes |
|------|-------|---------------|-------------------------|-------|
| `atlas-home.css` | 1,379 | Yes | ~5% | Homepage-specific; justified |
| `home-landing.css` | 983 | **Imported globally** | **~95%** on `/` | Legacy home components not on star map |
| `life-event-polish.css` | 833 | **Root layout** | **100%** on `/` | LE-only tokens |
| `globals.css` | 519 | Yes | ~40% | Legacy `.card`, header, home utilities |
| `ui-cohesion.css` | 267 | Yes | ~50% | Destination-oriented |
| `celestial-destinations.css` | 271 | No | — | Destinations only ✓ |
| `atlas-runtime.css` | 157 | Yes | ~30% | Canvas + shell |

**Top CSS complexity without proportional value on homepage:**

1. `home-landing.css` (983 lines, globally imported)
2. `life-event-polish.css` (833 lines on root layout)
3. Duplicate tokens across `globals.css` / `ui-cohesion.css` / `atlas-home.css`

**`@keyframes` inventory:** 39 total across files (27 in `home-landing.css` alone).

---

## 7. Homepage Rendering Cost

| Asset | Count |
|-------|-------|
| Map nodes | 7 |
| Connections | 14 (+ 7 local lines) |
| Stars (canvas) | **640** (320 + 320 duplicate) |
| Particles (DOM) | 52 |
| SVG filters (`blur`) | ~7 node glows + beacon on center |
| Gradients | Map vignette + ambient vignette + nebula (destination) |
| framer-motion nodes | 7 `AtlasNode` + 6 `AtlasSlide` + slider wrappers |

**Most expensive visual effect:** **SVG `filter: blur()` on node glow layers** combined with **dual full-screen canvas twinkle loops**.

**Lower-end laptop breaks first:**

1. Dual 320-star canvas at DPR 2
2. Parallax React rerenders + framer-motion simultaneously
3. GPU memory from stacked blurs + large canvas + `backdrop-filter` glass panels

---

## 8. Lazy Loading Opportunities (by ROI)

| Component | Current | Recommended | Expected gain | ROI |
|-----------|---------|-------------|---------------|-----|
| `LifeEventScenarioExplorer` + `SchemaForm` | Eager in LE page | `dynamic(..., { ssr: false })` | 25–40 KB JS; faster other routes | **★★★★★** |
| `life-event-polish.css` | Root layout | Destinations layout import | Faster `/` CSS parse | **★★★★★** |
| `home-landing.css` | `globals.css` import | Import only where `HomeSnapshotRenderer` used | ~983 lines off `/` | **★★★★☆** |
| `PersistentSpatialCanvas` on `/` | Always on | `shellMode === 'star-map'` → hide or pause | **~50% animation CPU on `/`** | **★★★★☆** |
| `EconomicRealityPage` heavy sections | Eager | Route-level dynamic | 15–25 KB | **★★★★☆** |
| `DomainMutationEditor` | Eager on edit route | Dynamic | 10–15 KB | **★★★☆☆** |
| `ScenarioExplorerPanel` | Eager when `mode=scenarios` | Conditional dynamic | Medium on LE | **★★★☆☆** |
| `AtlasSlide` inactive slides | All 6 mounted | Render active only | Less FM work | **★★★☆☆** |
| `@arrival-atlas/life-event-demo` | Transpiled dep | Dynamic import for demo preset only | Small | **★★☆☆☆** |
| `Header.tsx` | In test bundle only | Already not in prod shell | N/A | — |

---

## 9. Memory & Lifecycle Audit

| Location | Issue | Severity |
|----------|-------|----------|
| **`SpatialParallaxProvider`** | RAF runs **on all routes** even when parallax effect is invisible | High |
| **`AtlasAmbientLayers` + `SpatialCanvasLayer`** | **Duplicate** star systems on `/` | High |
| **`ArrivalProvider`** | `document` click capture on all routes | Low (correct for SNEL) |
| **`spatialNavigationInterceptor`** | `history.pushState` patch — survives route changes (intended) | Low |
| **`AtlasSlider` keydown** | Proper cleanup | OK |
| **`SpatialCanvasLayer` effect** | Restarts RAF when `offset.background` changes (frequent) | Medium |
| **`HomePresenceHero`** | `setInterval` — only if mounted | Low |
| **No leak found** | Listeners generally cleaned in `useEffect` returns | — |

---

## 10. Scalability Stress Audit (50 modules / 100 domains / 20 nodes / 10× data)

| System | Risk | Reason |
|--------|------|--------|
| **`AppContext` fan-out** | **Critical** | 50 modules in catalog → any refresh rerenders all `useApp()` consumers |
| **Homepage SVG map** | **High** | 20 nodes × (glow blur + framer-motion) = linear GPU/CPU cost |
| **Profile domain grid** | **High** | `ProfileMirrorOverview` maps N domains without virtualization |
| **LE plan node list** | **Medium** | Plan cards scale with backend payload |
| **Spatial memory / SNEL** | **Low** | Fixed-size stack (12) + history (5) |
| **CSS token surface** | **Medium** | Each module adds polish CSS to global imports if pattern continues |
| **Translation payload** | **Medium** | 10× copy → larger i18n object in memory |
| **Spatial transitions** | **Low** | O(1) per navigation; memory capped |

---

## Bottleneck Ranking — Top 20

| # | Issue | Impact | Complexity | Risk | Gain | ROI |
|---|-------|--------|------------|------|------|-----|
| 1 | Dual star canvas on `/` | Critical | Low | Low | **Very high** | ★★★★★ |
| 2 | `SpatialParallaxProvider` setState @ 60fps | Critical | Medium | Low | **Very high** | ★★★★★ |
| 3 | `AppContext` inline value object | Critical | Medium | Low | High | ★★★★☆ |
| 4 | `life-event-polish.css` on root layout | High | Very low | None | High (parse) | ★★★★★ |
| 5 | `home-landing.css` global import | High | Low | None | High (parse) | ★★★★☆ |
| 6 | No `dynamic()` on LE explorer | High | Low | Low | High (JS) | ★★★★☆ |
| 7 | `useAtlasParallax` mousemove setState | High | Low | Low | High on `/` | ★★★★☆ |
| 8 | All 6 `AtlasSlide` mounted | Medium | Low | None | Medium | ★★★☆☆ |
| 9 | SVG node blur filters | Medium | Low | Visual tweak | Medium GPU | ★★★☆☆ |
| 10 | framer-motion on 13 files | Medium | Medium | Medium | Medium JS | ★★★☆☆ |
| 11 | `SpatialCanvasLayer` effect deps on offset | Medium | Low | Low | Medium | ★★★☆☆ |
| 12 | Full runtime shell on `/` | Medium | High | Medium | Medium | ★★☆☆☆ |
| 13 | 52 CSS particles | Medium | Low | Low | Low–medium | ★★☆☆☆ |
| 14 | `AtlasNode` not memoized | Medium | Low | None | Low–medium | ★★☆☆☆ |
| 15 | i18n bundle not split by locale | Medium | Medium | Low | Medium | ★★☆☆☆ |
| 16 | Provider nesting (7 deep) | Medium | High | Medium | Low–medium | ★★☆☆☆ |
| 17 | Global SNEL click capture | Low | — | — | Low | ★☆☆☆☆ |
| 18 | `JourneyTimeline` infinite pulse | Low | Low | None | Low | ★☆☆☆☆ |
| 19 | Google Fonts render-blocking | Low | Low | None | Low–medium LCP | ★★☆☆☆ |
| 20 | `tsconfig.tsbuildinfo` in repo | Low | Trivial | None | Dev only | ★☆☆☆☆ |

---

## Quick Wins (< 1 day)

1. **Pause or hide `PersistentSpatialCanvas` on `shellMode === 'star-map'`** — homepage already has `AtlasAmbientLayers`
2. **Move `life-event-polish.css` from root `layout.tsx` → `(destinations)/layout.tsx`**
3. **Remove `home-landing.css` from `globals.css`**; import only in components that need it
4. **`useMemo` the `AppContext.Provider` value** in `AppProviderSessionLayer`
5. **`dynamic()` import `LifeEventScenarioExplorer`** on LE page
6. **Render only active `AtlasSlide`** (replace `.map` with single active slide)
7. **Throttle `useAtlasParallax`** with `requestAnimationFrame` + ref (no setState per mousemove)
8. **`React.memo(AtlasNode)`** and `AtlasConnection`
9. **Reduce star count** on homepage from 320 → 180 (single canvas)
10. **`prefers-reduced-motion`**: skip canvas RAF entirely (partial — destination canvas already checks)

---

## High ROI (< 1 week)

1. **Refactor `SpatialParallaxProvider`** — write offsets to CSS variables via ref; no React state in RAF loop
2. **Single star-field authority** — merge ambient + persistent canvas; one RAF, one particle layer
3. **Split `AppContext`** into SessionContext + ProfileContext + ModuleContext
4. **Route-level code splitting** for LE, ER, profile edit bundles
5. **Replace framer-motion on homepage rail/HUD** with CSS transitions (keep FM for spatial page enter)
6. **Reduce node glow `blur()` from 12px → 6–8px** or use pre-blurred radial gradients
7. **Conditional particle count** based on `navigator.hardwareConcurrency` or `matchMedia`
8. **Fix build** + add `@next/bundle-analyzer` for measured baselines
9. **Profile domain cards** — virtualize or paginate at 20+ domains
10. **Server Component boundaries** for static headers and copy blocks

---

## Final Answer: 2× faster *feel* without changing functionality

Perceptual speed is dominated by **animation jank and initial weight**, not API latency. Highest-impact changes:

1. **Eliminate duplicate star canvas on `/`** — immediate FPS win; homepage feels “lighter” instantly.
2. **Stop parallax from driving React rerenders** — idle CPU drops; pointer movement becomes smooth; transitions feel cleaner.
3. **Remove ~1,800 lines of irrelevant CSS from homepage** (`life-event-polish` + `home-landing` global imports) — faster first paint, less style recalc.
4. **Lazy-load LE/ER heavy UI** — navigating away from `/` and cold-loading modules feels snappier even if homepage bundle unchanged.
5. **Stabilize `AppContext`** — after login, profile/plan refreshes stop stuttering LE explorer and ER cards.

Users would feel “2× faster” because **the star map would stop fighting the GPU and React on every frame**, **pages would paint sooner**, and **post-login interactions would stop rippling through the entire tree** — without removing any feature or changing the spatial design language.

---

## Recommended next step

Fix the `useAtlasNavigation` type error, run `next build` with `@next/bundle-analyzer`, and treat items #1–3 as a single “homepage performance” PR (estimated **1–2 days**, highest ROI).

---

## Related docs

- [arr-026-pr-description.md](../pr/arr-026-pr-description.md) — AURL + SNEL implementation track
- [frontend-ux-alignment-audit.md](./frontend-ux-alignment-audit.md) — prior UI cohesion audit
- [ui-architecture-audit.md](./ui-architecture-audit.md) — UI architecture review
