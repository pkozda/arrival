# arr-029 — Spatial galaxy unification · ER + Profile · dependencies · per-node progress

**Branch:** `arr-029`  
**Tracks:** Spatial Core reuse · Economic Reality Orbit Ledger · Profile Identity Nebula · Planet dependency visualization · Spatial progress (per-node stars)  
**Base:** `develop` (post arr-028)

Completes the **ARR-028 reuse plan**: migrates **Economic Reality** and **Profile** destination pages onto the shared `spatial-core/` galaxy shell, adds a **dependency visualization layer** (locked planets · dashed arrows · prerequisite paths), and introduces **read-only per-node star ratings** under each planet. No backend, data-model, or routing URL changes.

**Product verdict:** All three destination modules (Life Events · Economic Reality · Profile) should feel like the **same spatial solar system** — orbital planets, HUD inspector, explicit prerequisite links, and visible lock state — not separate dashboard layouts.

**Diff vs `develop` (working tree):** ~30 files · +~2,800 / −~220 lines (`apps/web`) · ~12 new adapter / spatial-core files.

---

# Part 1 — Spatial unification (ER + Profile)

## Summary

```text
/modules/economic-reality
  └── GalaxyViewport (surfaceId: economic-reality-galaxy)
        └── EconomicRealityPage (mode=full)
              └── EconomicRealityGalaxyBridge
                    ├── GalaxyGraphStage
                    └── GalaxyInspectorShell

/profile
/profile/[domainSlug]
  └── GalaxyViewport (surfaceId: profile-galaxy)
        └── ProfileGalaxyBridge
              ├── GalaxyGraphStage (initialSelectedNodeId for deep links)
              └── GalaxyInspectorShell
```

Life Events (`/modules/life-event`) unchanged in architecture — already on `GalaxyViewport` since arr-028. This branch brings ER and Profile to parity.

## What changed (perception layer)

| Route | Before | After |
|-------|--------|-------|
| `/modules/economic-reality` | Section cards inside `AtlasSurface` / page scroll | Fullscreen `GalaxyViewport` + galaxy bridge |
| `/profile` | `ProfileMirrorOverview` card grid | Fullscreen galaxy · domain planets |
| `/profile/[domainSlug]` | `ProfileDomainDetail` form-like detail | Galaxy with domain pre-selected in inspector |

## Home / embedded surfaces preserved

| Surface | Behavior |
|---------|----------|
| ER `mode="embedded"` | Legacy section layout (`PrimarySection` · `SecondarySection` · `SystemSection`) unchanged |
| LE `variant="home"` | Three-column wireframe breakdown unchanged |
| Homepage `/` | Out of scope |

## Legacy components (kept, unused by pages)

| Component | Notes |
|-----------|-------|
| `ProfileMirrorOverview` | Replaced by `ProfileGalaxyBridge` on `/profile` |
| `ProfileDomainDetail` | Replaced by galaxy deep-link on `/profile/[domainSlug]` |
| `ProfileDomainSectionCard` | No longer mounted on destination routes |

`/profile/[slug]/edit` remains legacy form — not migrated in this branch.

---

# Part 2 — Domain graph adapters

Same hub-and-spoke pattern as Life Events: journey sun → primary focus → secondary/contextual unlocks · blocker → focus dependencies.

## Economic Reality

| File | Role |
|------|------|
| `lib/presentation/economic-reality/build-galaxy-graph.ts` | `buildEconomicRealityGalaxyGraph()` |
| `lib/presentation/economic-reality/build-galaxy-graph.test.ts` | Graph shape regression |
| `modules/economic-reality/ui/EconomicRealityGalaxyBridge.tsx` | Stage + HUD wiring |
| `modules/economic-reality/ui/EconomicCardInspectorActions.tsx` | Card-level inspector actions |
| `modules/economic-reality/ui/components/EconomicActionButton.tsx` | Extracted action button |

**Node mapping:**

| Bucket | Source | Galaxy status |
|--------|--------|---------------|
| Primary focus | `dominantActionRefIds` match · else first `PRIMARY` card | `recommended` |
| Blocked | `PROFILE_CARD` + `severity === 'high'` (non-primary) | `blocked` |
| Secondary | `SECONDARY` + non-focus `PRIMARY` | `recommended` |
| Contextual | `SYSTEM` section | `future` |

**Edges:** journey → focus · focus → secondary/contextual (`unlock`) · high-severity profile cards → focus (`dependency`).

## Profile

| File | Role |
|------|------|
| `lib/presentation/profile/build-galaxy-graph.ts` | `buildProfileGalaxyGraph()` |
| `lib/presentation/profile/build-galaxy-graph.test.ts` | Graph + dedup regression |
| `components/profile/ProfileGalaxyBridge.tsx` | Stage + HUD wiring |
| `components/profile/ProfileDomainInspectorContent.tsx` | Domain inspector body + actions |

**Node mapping:**

| Bucket | Source | Galaxy status |
|--------|--------|---------------|
| Primary focus | `missingContext[0]` · else `needs_attention` · else `not_added` | `recommended` |
| Blocked | `needs_attention` (non-primary) | `blocked` |
| Completed | `complete` | `completed` |
| Secondary | `not_added` with `ctaModuleId` | `recommended` |
| Contextual | remaining domains | `future` |

**Two dependency sources:**

1. Focus blockers — `blocked → focus` (same as LE/ER)
2. `PROFILE_DOMAIN_DEPS` — cross-domain prerequisites (e.g. `benefits-support` ← `move-to-germany`, `work-income`, …)

Edges emitted only when upstream domain is incomplete. `addEdge()` + `edgeIds` Set prevents duplicate keys.

## Shared bridge pattern

```text
build*GalaxyGraph()          → graphNodes + graphEdges
useGalaxyGraphModel()        → selection · lockedNodeIds · inspectorSelection
useGalaxyProgressReporter()  → visited nodes · per-node star ratings
GalaxyGraphStage             → orbits · dependency edges · nodes
GalaxyInspectorShell         → domain-specific HUD content
GalaxyInspectorSections      → shared inspector primitives
```

---

# Part 3 — Planet dependency visualization

Makes prerequisite relationships explicit without reading the inspector.

## Core logic (`galaxy-dependencies.ts`)

| Rule | Detail |
|------|--------|
| Edge semantics | `source → target` — target depends on source |
| Satisfied prerequisite | Source node `status === 'completed'` (`__journey__` always satisfied) |
| Locked planet | Any unsatisfied incoming `dependency` edge |
| Keyboard nav | Locked nodes excluded from `selectableNodeIds` |

## Visual states

### Locked planet

| Property | Value |
|----------|-------|
| Filter | `grayscale(1)` |
| Opacity | ~0.42 |
| Blur | `blur(0.5px)` on orb |
| Glow | disabled |
| Cursor | `not-allowed` |
| Interaction | click blocked · hover allowed |
| Overlay | lock icon SVG (top-right of beacon) |
| Hint | tooltip + inline `Requires: X completed` on hover |

### Dependency edges

| State | Stroke | Arrow |
|-------|--------|-------|
| Active (source completed) | `rgba(120, 140, 255, 0.6)` dashed | blue arrowhead |
| Locked (source incomplete) | `rgba(120, 120, 120, 0.25)` dashed | gray arrowhead |
| Flow highlight (hover path) | brighter blue · thicker · dash animation | flow arrowhead |

Multi-prerequisite targets: **separate curved paths** with `assignDependencyEdgeCurvatureOffsets()` — no line merging.

### Emphasis system

| Interaction | Effect |
|-------------|--------|
| Hover any planet | Outgoing + incoming dependency edges highlighted; unrelated edges dimmed |
| Hover locked planet | Unsatisfied source planets brightened (`is-dependency-source-highlight`); path animated source → target |

## `useGalaxyGraphModel` extensions

| Addition | Role |
|----------|------|
| `lockedNodeIds` | Computed set exposed to stage + selection |
| `initialSelectedNodeId` | Profile domain deep links (`/profile/[domainSlug]`) |

---

# Part 4 — Spatial progress (per-node stars)

Read-only UI layer — no backend persistence.

## Module map

| File | Role |
|------|------|
| `module-progress.ts` | `computeNodeStarRating()` · `computeModuleProgressUI()` |
| `GalaxyProgressProvider.tsx` | React context for progress state |
| `useModuleProgressUI.ts` | `useGalaxyProgressReporter()` — tracks visited nodes on selection |
| `GalaxyViewport.tsx` | Wraps children in `GalaxyProgressProvider` |
| `GalaxyNodeRenderer.tsx` | Renders 0–3 mini-stars under each planet |

## Star rules (per node)

| Condition | Stars |
|-----------|-------|
| `completed` status | 3★ |
| Visited + `recommended` / `future` | 2★ |
| Visited otherwise | 1★ |
| Not visited | 0★ |

Stars pulse on selected node only. **No bottom module progress bar** — removed after UX review; progress is communicated per-planet and via lock/dependency visuals.

---

# Part 5 — Shared spatial-core additions

| File | Role |
|------|------|
| `GalaxyInspectorSections.tsx` | `GalaxyInspectorTitle` · `Section` · `Items` · `Requires` · `Context` · `Empty` |
| `map-galaxy-node.ts` | `galaxyStatusLabel()` · `toGalaxyNodeStatus()` |
| `galaxy-layout.ts` | `galaxyEdgePath(from, to, curvatureOffset?)` — multi-dep curve spread |
| `GalaxyGraphStage.tsx` | Dependency arrows (SVG markers) · lock hints · emphasis system |
| `GalaxyNodeRenderer.tsx` | Lock overlay · locked interaction guard |
| `types.ts` | `isLocked` · `isDependencySourceHighlight` on node visual state; edge `isSatisfied` · `isFlowHighlighted` |

Inspector shell (`GalaxyInspectorShell`) remains domain-agnostic — bridges supply content only.

---

# Part 6 — Tests

| File | Covers |
|------|--------|
| `spatial-core/galaxy-dependencies.test.ts` | Lock logic · edge satisfaction · curvature offsets |
| `spatial-core/module-progress.test.ts` | Node star ratings · module star tiers |
| `economic-reality/build-galaxy-graph.test.ts` | ER graph nodes + edges |
| `profile/build-galaxy-graph.test.ts` | Profile graph · `PROFILE_DOMAIN_DEPS` · edge dedup |
| `le-ux/galaxy-layout.test.ts` | Layout regression (arr-028, unchanged semantics) |
| `economic-reality/__tests__/ep9-ui-surface.test.ts` | Route path fix for destinations layout |

```bash
cd apps/web && npx vitest run \
  src/lib/presentation/spatial-core/galaxy-dependencies.test.ts \
  src/lib/presentation/spatial-core/module-progress.test.ts \
  src/lib/presentation/economic-reality/build-galaxy-graph.test.ts \
  src/lib/presentation/profile/build-galaxy-graph.test.ts \
  src/lib/presentation/le-ux/galaxy-layout.test.ts \
  src/modules/economic-reality/__tests__/ep9-ui-surface.test.ts
```

---

## Architecture compliance

| Constraint | Status |
|------------|--------|
| No backend / data model changes | ✓ — presentation + layout only |
| No routing URL changes | ✓ — same paths (`/profile`, `/modules/economic-reality`, …) |
| No new product functionality | ✓ — same surfaces, spatial perception upgrade |
| Graph semantics from existing buckets | ✓ — unlock/dependency derived, not recomputed in UI |
| LE home wireframe unchanged | ✓ |
| ER embedded/home card layout unchanged | ✓ |
| Homepage `/` out of scope | ✓ |
| `implemented-baseline.md` unchanged | ✓ |

## Validation checklist (ARR-029 ready)

| Criterion | Status |
|-----------|--------|
| Three modules on shared `GalaxyViewport` | ✓ LE · ER · Profile |
| One adapter pattern per domain | ✓ `build*GalaxyGraph` + `*GalaxyBridge` |
| Dependency lock visible without inspector | ✓ lock icon · gray planet · arrows |
| Locked planets not selectable | ✓ click + keyboard |
| Per-node progress visible | ✓ stars under planets |
| Inspector shared primitives | ✓ `GalaxyInspectorSections` |
| O(E) edge resolution preserved | ✓ `graphNodeById` (arr-028) |
| Hover isolated to stage | ✓ (arr-028) |

## Known issues / pre-existing

| Item | Notes |
|------|-------|
| `le-consequence-*` / `le-galaxy-*` CSS in `life-event-polish.css` | Still LE-coupled; neutral `galaxy-*` token file deferred |
| `ProfileMirrorOverview` / `ProfileDomainDetail` | Dead code on routes; files kept for reference / edit flow |
| `/profile/[slug]/edit` | Legacy form — not galaxy-migrated |
| `/modules/[moduleId]` generic pages | Not migrated |
| `GalaxyEdgeRenderer` standalone export | Edges still inline in `GalaxyGraphStage` |
| Bottom module progress bar | Intentionally removed — per-node stars only |
| Locked = dependency-based only | `blocked` status alone does not lock if prerequisites satisfied |

## Deferred — post ARR-029

| Item | Notes |
|------|-------|
| Neutral `spatial-core.css` | Decouple from `le-*` class prefixes |
| Profile edit galaxy shell | `/profile/[slug]/edit` |
| Generic module galaxy adapter | `/modules/[moduleId]` |
| `GalaxyEdgeRenderer` extraction | Optional refactor |
| Route-level `dynamic()` galaxy chunk | Perf follow-up from arr-027 audit |
| Configurable journey center node | Per-module sun label / id |
| Backend-persisted mastery progress | Stars are session UI-only today |

---

## Test plan

### Unit

```bash
cd apps/web && npx vitest run \
  src/lib/presentation/spatial-core/galaxy-dependencies.test.ts \
  src/lib/presentation/spatial-core/module-progress.test.ts \
  src/lib/presentation/economic-reality/build-galaxy-graph.test.ts \
  src/lib/presentation/profile/build-galaxy-graph.test.ts \
  src/lib/presentation/le-ux/galaxy-layout.test.ts

npm run test
```

### Manual smoke — Economic Reality

- [ ] **`/modules/economic-reality`** — fullscreen galaxy; no page header scroll
- [ ] **Primary card** — recommended orb; journey unlock edge visible
- [ ] **High-severity profile cards** — dependency edges into focus; locked if prerequisites incomplete
- [ ] **Inspector** — card context · unlocks · requires · actions
- [ ] **Loading / error** — overlay inside `GalaxyViewport`
- [ ] **Embedded ER** (home snapshot) — legacy section layout still renders

### Manual smoke — Profile

- [ ] **`/profile`** — domain planets on orbital rings
- [ ] **`/profile/benefits-support`** (or domain with deps) — deep link selects domain; dependency edges from incomplete upstream domains
- [ ] **Locked domain** — gray planet · lock icon · `Requires: …` on hover · click blocked
- [ ] **Hover locked domain** — source prerequisites brighten; dashed path animates
- [ ] **Completed domain** — full-color orb · 3★ if visited
- [ ] **Inspector depth** — summary on `/profile` · detail on `/profile/[slug]`

### Manual smoke — Life Events (regression)

- [ ] **`/modules/life-event`** — galaxy unchanged; dependency edges from blocked actions
- [ ] **Per-node stars** — appear under planets after visit
- [ ] **Home LE section** — three-column wireframe intact

### Manual smoke — cross-module

- [ ] **Scroll lock** — document does not scroll behind any galaxy viewport
- [ ] **Keyboard** — arrow keys skip locked planets
- [ ] **No bottom progress bar** — only per-planet stars

### Typecheck / build

```bash
cd apps/web && npm run typecheck
cd apps/web && npm run build
```

---

## Related docs

- [arr-028-pr-description.md](./arr-028-pr-description.md) — Life Events Galaxy · Spatial Core extraction · P0 stabilization
- [arr-027-pr-description.md](./arr-027-pr-description.md) — spatial memory · homepage perf · UI cohesion wave 1
- [atlas-frontend-optimization-audit.md](../audits/atlas-frontend-optimization-audit.md) — perf baseline
- [EXECUTION-LOCK.md](../production-readiness/EXECUTION-LOCK.md) — P0 execution freeze
