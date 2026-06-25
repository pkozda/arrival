# arr-028 — Life Events Galaxy · Spatial Core extraction · P0 stabilization

**Branch:** `arr-028`  
**Tracks:** Life Events Galaxy of Consequences · Spatial Core (`spatial-core/`) · LE performance stabilization · ARR-029 reuse prep  
**Base:** `develop` (post arr-027)

Transforms the Life Events **module plan view** from a page-inside-a-page (header + cards + grid) into a **fullscreen spatial galaxy** — consequence nodes on orbital rings, curved unlock/dependency edges, and a HUD inspector. Stabilizes the implementation (P0 fixes), extracts a **reusable spatial engine** under `spatial-core/`, and prepares adapters for Economic Reality and Profile without backend or data-model changes.

**Product verdict:** Life Events should feel like a **spatial star map**, not a dashboard section. The galaxy is the page. Inspector is contextual HUD, not a form. No new product features — stabilization + extraction + cleanup only.

**Diff vs `develop` (working tree):** ~25 files · +~2,100 / −~400 lines (`apps/web`) · new `spatial-core/` module (~730 lines).

---

# Part 1 — Galaxy of Consequences (spatial perception)

## Summary

```text
/modules/life-event (active plan)
  └── GalaxyViewport                    (fullscreen fixed shell · JS scroll lock)
        └── LifeEventPlanView
              └── ModuleLifeEventWireframe
                    └── ActionBreakdownBlock (variant=module)
                          └── GalaxyGraphInspectorBridge
                                ├── GalaxyGraphStage      (orbits · edges · nodes)
                                └── GalaxyInspectorShell  (HUD inspector)
```

The module route drops `PageHeader`, `.container`, `AtlasSurface` card shells, and the three-column breakdown grid. Loading, error, intake, and active-plan states all render inside `GalaxyViewport` so the celestial starfield remains visible and scroll is owned by the viewport shell.

## What changed (perception layer)

| Before | After |
|--------|-------|
| `PageHeader` + `le-module-page` scroll flow | Fullscreen `GalaxyViewport` (`position: fixed; inset: 0`) |
| Horizontal card strip / breakdown grid | Orbital constellation on elliptical rings |
| Flat list inspector | Right-side HUD (`le-galaxy-hud le-consequence-inspector`) |
| Straight connector lines | Curved SVG paths (`galaxyEdgePath`) |
| Page scroll under content | Single viewport; stage `overflow: hidden` |

## Orbital layout

| Constant | Value | Role |
|----------|-------|------|
| `GALAXY_CENTER` | `{ x: 42, y: 40 }` | Sun / journey node; shifted left for HUD breathing room |
| `GALAXY_ORBIT_RADII` | 4 elliptical rings | Primary → blocked → completed → secondary → contextual |
| Safe margins | top 14 · bottom 16 · left 8 · right 30 | Nodes stay inside viewport (no below-fold drift) |
| Orbit arc | 58°–302° | Satellites spread bottom → left → top |

Journey node (`__journey__`) sits at center (soft orange sun). Immune to hover dimming; always full brightness.

## Graph semantics (unchanged)

Edges derived from existing wireframe buckets — no planner / backend changes:

| Edge type | Derivation |
|-----------|------------|
| `unlock` | Journey → primary; primary → secondary/contextual |
| `dependency` | Blocked node → primary focus |

Inspector sections: **Context** · **Unlocks** · **Blocked** · **Actions** · **Recommendations**.

## Home wireframe preserved

`ActionBreakdownBlock` with `variant="home"` keeps the three-column card layout (`SecondaryColumn` · `BlockedColumn` · `ContextualColumn`) for homepage snapshot composition. Only the module path uses the galaxy bridge.

---

# Part 2 — P0 stabilization (critical fixes)

## 2.1 Single scroll-lock owner

| Removed | Kept |
|---------|------|
| CSS `html/body/:has([data-ui-surface='life-event-galaxy'])` overflow lock in `life-event-polish.css` | JS `useEffect` in `GalaxyViewport` — sets `documentElement` + `body` overflow, restores on unmount |

No duplicate route-level scroll side effects outside Life Events mount lifecycle.

## 2.2 O(E) edge resolution

| Before | After |
|--------|-------|
| `graphNodes.find(...)` inside edge render loop — O(E×N) | `graphNodeById.get(edge.from/to)` — O(E) via precomputed `Map` in `useGalaxyGraphModel` |

Graph semantics unchanged; traversal cost only.

## 2.3 Hover blast radius isolation

| State | Owner | Rerenders on hover |
|-------|-------|-------------------|
| Selection · inspector derivation | `useGalaxyGraphModel` | No |
| Hover · dim · edge highlight | `GalaxyGraphStage` (`useState`) | Stage + memoized nodes only |

Inspector is a sibling of the stage — hover does not force inspector recomputation.

## 2.4 Naming clarity

| Public export | Internal implementation |
|---------------|-------------------------|
| `ActionBreakdownBlock` (unchanged API) | Module path delegates to `GalaxyGraphInspectorBridge` |
| — | Removes "breakdown / task grid" mental model from graph path |

---

# Part 3 — Spatial Core extraction (`spatial-core/`)

Reusable primitives for ARR-029 (ER Orbit Ledger · Profile Identity Nebula).

## Module map

| File | Role |
|------|------|
| `types.ts` | `GalaxyNodeState` · `GalaxyEdgeType` · `SpatialGraphNode` · `SpatialGraphEdge` · visual state types |
| `galaxy-layout.ts` | `layoutGalaxyGraphNodes<T>()` · `distributeOrbitAngles` · `galaxyEdgePath` · orbit constants |
| `useGalaxyGraphModel.ts` | `graphNodeById` · neighbor map · selection · `inspectorSelection` · keyboard nav |
| `GalaxyViewport.tsx` | Fullscreen container · camera lock · HUD chrome label |
| `GalaxyNodeRenderer.tsx` | Memoized state-driven node button (beacon · halo · descriptor) |
| `GalaxyGraphStage.tsx` | Orbits SVG · edges · nodes; local hover state |
| `GalaxyInspectorShell.tsx` | Reusable HUD `<aside>` — no domain logic |
| `index.ts` | Public exports |

## Life Events adapter layer

| File | Role |
|------|------|
| `le-ux/build-galaxy-graph.ts` | `buildLifeEventGalaxyGraph()` — plan surface → nodes + edges |
| `le-ux/components/GalaxyGraphInspectorBridge.tsx` | Wires spatial-core + LE labels, actions, recommendations |
| `le-ux/galaxy-layout.ts` | Re-export shim → `spatial-core` (backward compat) |
| `le-ux/components/GalaxyViewport.tsx` | Re-export shim → `spatial-core` |

## Architecture split

```text
Domain derivation          Graph model              Presentation
─────────────────          ───────────              ────────────
buildLifeEventGalaxyGraph  useGalaxyGraphModel      GalaxyGraphStage
  (LE plan buckets)          (nodeById · adjacency)    GalaxyNodeRenderer
                             (selection · inspector)   GalaxyInspectorShell
GalaxyGraphInspectorBridge (LE copy + actions only)
```

UI renders; it does not compute graph topology.

---

# Part 4 — Cleanup

| Removed | Reason |
|---------|--------|
| `viewportYStretch` | Dead layout helper; margin-based clamp replaces it |
| `LE_UX_BREAKDOWN_GRID_STACKED` | Unused wireframe token |
| `buildModuleInsightContent` export | Never imported |
| CSS duplicate scroll-lock rules | Superseded by JS viewport lock |
| ~400 lines inline graph JSX in `ActionBreakdownBlock` | Moved to bridge + spatial-core |

---

# Part 5 — Tests

| File | Covers |
|------|--------|
| `le-ux/galaxy-layout.test.ts` | Orbit angle spread · journey center placement · safe Y bounds · curved edge path |
| `le-ux/le-ux-wireframe.test.ts` | Wireframe node uniqueness · bucket caps (regression) |

```bash
cd apps/web && npx vitest run \
  src/lib/presentation/le-ux/galaxy-layout.test.ts \
  src/lib/presentation/le-ux/le-ux-wireframe.test.ts
```

---

## Architecture compliance

| Constraint | Status |
|------------|--------|
| No backend / data model changes | ✓ — presentation + layout only |
| No UX concept redesign (spatial galaxy, not cards) | ✓ — perception layer aligns with Galaxy of Consequences spec |
| No new product functionality | ✓ — same plan surface, same inspector sections |
| Two features only (LE + ER) | ✓ — LE module path only; home wireframe unchanged |
| No BL-* / EP pipeline changes | ✓ |
| Module URL unchanged (`/modules/life-event`) | ✓ |
| Graph semantics unchanged | ✓ — unlock/dependency from existing buckets |
| `implemented-baseline.md` unchanged | ✓ |

## Validation checklist (ARR-028 ready for reuse)

| Criterion | Status |
|-----------|--------|
| Graph model separated from UI | ✓ |
| Inspector is pure presentation (receives `inspectorSelection`) | ✓ |
| Viewport is single scroll-lock owner | ✓ |
| Hover does not rerender inspector | ✓ |
| Edges resolved in O(E) | ✓ |
| No duplicate layout systems | ✓ — one `spatial-core/galaxy-layout.ts` |
| Spatial UX preserved (no regression to card pages) | ✓ |

## Known issues / pre-existing

| Item | Notes |
|------|-------|
| `EconomicActionV1` type error in `ActionRenderer.tsx` | Pre-existing; may block full `next build` |
| `le-consequence-*` / `le-galaxy-*` CSS in `life-event-polish.css` | LE-coupled; neutral `galaxy-*` tokens deferred to ARR-029 |
| `GalaxyGraphStage` rerenders on hover | Expected — isolated to stage; inspector excluded |
| Scenario explorer HUD | Still `details` panel below galaxy; not part of spatial-core |

## Deferred — ARR-029 (reuse in ER + Profile)

| Item | Notes |
|------|-------|
| `buildEconomicRealityGalaxyGraph()` | ER plan surface → spatial graph adapter |
| `buildProfileGalaxyGraph()` | Profile identity nebula adapter |
| Neutral `spatial-core.css` | Decouple from `le-*` class prefixes |
| `GalaxyEdgeRenderer` as standalone export | Edges currently inline in `GalaxyGraphStage` (O(E) preserved) |
| Route-level `dynamic()` for LE galaxy chunk | Audit item from arr-027; optional perf follow-up |
| Domain-specific journey node (`__journey__`) | Generalize to configurable center node per module |

### Minimal ARR-029 next step

One adapter per module, same shell:

```text
<GalaxyViewport label="Economic Reality" surfaceId="economic-reality-galaxy">
  <EconomicRealityGalaxyBridge />
</GalaxyViewport>
```

Copy `GalaxyGraphInspectorBridge` pattern: domain `build*GalaxyGraph()` + `useGalaxyGraphModel` + `GalaxyGraphStage` + module-specific inspector content.

---

## Test plan

### Unit

```bash
cd apps/web && npx vitest run \
  src/lib/presentation/le-ux/galaxy-layout.test.ts \
  src/lib/presentation/le-ux/le-ux-wireframe.test.ts

npm run test
```

### Manual smoke — spatial galaxy (module)

- [ ] **`/modules/life-event` (active plan)** — fullscreen galaxy; no page header; starfield visible behind viewport
- [ ] **Journey sun** — centered, always bright; not dimmed when hovering other nodes
- [ ] **Node spread** — satellites on orbital arc; none clipped below viewport or under HUD
- [ ] **Scroll** — document does not scroll behind galaxy; scroll restored after leaving module
- [ ] **Hover** — neighbor highlight + edge pulse; inspector content stable (no flicker)
- [ ] **Selection** — click node → inspector updates (Context / Unlocks / Blocked / Actions)
- [ ] **Keyboard** — arrow keys cycle selectable nodes
- [ ] **Primary pulse** — unlock edge pulses when primary recommended node selected

### Manual smoke — states

- [ ] **Loading** — skeleton inside galaxy overlay
- [ ] **Module error** — message overlay inside `GalaxyViewport`
- [ ] **Cold start intake** — intake form in galaxy overlay (scrollable)
- [ ] **Scenario explorer** — `?mode=scenarios` panel opens; galaxy still fullscreen

### Manual smoke — home wireframe (regression)

- [ ] **Home snapshot LE section** — three-column card breakdown still renders (`variant="home"`)

### DevTools quick check (optional)

- [ ] React Profiler: hover over graph node — `GalaxyInspectorShell` subtree does not reconcile
- [ ] Elements: no `html { overflow: hidden }` from CSS `:has()` — only inline style from `GalaxyViewport` mount

### Typecheck / build

```bash
cd apps/web && npm run typecheck
cd apps/web && npm run build
```

---

## Related docs

- [arr-027-pr-description.md](./arr-027-pr-description.md) — spatial memory · homepage perf · UI cohesion wave 1
- [arr-026-pr-description.md](./arr-026-pr-description.md) — AURL · celestial shell · SNEL
- [atlas-frontend-optimization-audit.md](../audits/atlas-frontend-optimization-audit.md) — perf baseline (route-level code split deferred here)
- [EXECUTION-LOCK.md](../production-readiness/EXECUTION-LOCK.md) — P0 execution freeze
