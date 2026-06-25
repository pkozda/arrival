# arr-030 — Journey Guide · route preview · galaxy visual refinements

**Branch:** `arr-030`  
**Tracks:** Journey Guide / AI Navigator · mission-based guidance · route preview · progressive assistance · dependency gravity (hover-only) · edge visibility tuning  
**Base:** `develop` (post arr-029)

Introduces **Journey Guide** — a first-time-user guidance layer for all three galaxy surfaces (Life Events · Economic Reality · Profile). The guide is a small autonomous navigation probe (not a modal product tour): welcome choice · guided journey · independent mode · locked-planet help · route preview illumination · unlock discovery. Also ships galaxy **visual refinements** from UX iteration on arr-029: hover-only dependency gravity, px-scale edge strokes, selection-active/inactive edge hierarchy, and a profile-graph fix so completed domains are never re-recommended after reload.

**Product verdict:** A new user should understand within ~60 seconds — where they are · what to do next · why it matters · what unlocks afterward — without leaving the galaxy view or reading docs. The guide must feel like a **navigation companion**, not tooltip spam.

**Diff vs `develop` (working tree):** ~26 files · +~2,600 / −~140 lines (`apps/web`) · new `journey-guide/` module (~1,300 lines).

---

# Part 1 — Journey Guide architecture

## Summary

```text
GalaxyViewport (surfaceId per module)
  └── GalaxyProgressProvider
        └── JourneyGuideProvider (surfaceId)
              ├── GalaxyViewportShell
              │     ├── __world → *GalaxyBridge → GalaxyGraphStage
              │     └── JourneyGuideLayer (probe · speech · welcome · FAB)
              └── useJourneyGuideReporter()   ← each bridge syncs graph snapshot
```

Guide logic lives in `lib/journey-guide/` — decoupled from domain adapters. Bridges report graph state; the provider owns UX mode, persistence, and recommendation.

## Module map

| File | Role |
|------|------|
| `journey-guide/types.ts` | Modes · persisted state · recommendation · route preview · locked-guide types |
| `journey-guide/storage.ts` | `localStorage` key `arrival-atlas-journey-guide-v1` |
| `journey-guide/mission-labels.ts` | `toMissionTitle()` — task → mission framing |
| `journey-guide/recommendation-engine.ts` | `getRecommendedNextPlanet()` · `buildRoutePreviewChain()` · `buildLockedGuideState()` |
| `journey-guide/JourneyGuideProvider.tsx` | Context · mode · panel · route preview · discovery · assistance stages |
| `journey-guide/useJourneyGuideReporter.ts` | Syncs graph snapshot + selection ref from bridges |
| `journey-guide/JourneyGuide.tsx` | Probe · speech bubble · welcome panel · floating button |
| `journey-guide/JourneyGuideLayer.tsx` | Anchored positioning · ambient dim · orchestration |
| `journey-guide/index.ts` | Public exports |

## Integration points

| Surface | `surfaceId` | Bridge reporter |
|---------|-------------|-----------------|
| Life Events | `life-event-galaxy` | `GalaxyGraphInspectorBridge` |
| Economic Reality | `economic-reality-galaxy` | `EconomicRealityGalaxyBridge` |
| Profile | `profile-galaxy` | `ProfileGalaxyBridge` |

`GalaxyViewport` nests `JourneyGuideProvider` + `JourneyGuideLayer` alongside existing `GalaxyProgressProvider`.

---

# Part 2 — User flows

## First visit

| Step | Behavior |
|------|----------|
| Detect | No `hasChosenMode` in persisted state · welcome not dismissed for `surfaceId` |
| Show | Welcome panel near galaxy · stage dimmed (`is-guide-welcome`) |
| Copy | “Welcome to Arrival Atlas.” · “Let's build your journey together.” |
| Actions | **Start Guided Journey** · **Explore On My Own** |
| Persist | Choice written to `localStorage` · welcome dismissed for surface |

## Guided journey mode

| Behavior | Detail |
|----------|--------|
| Highlight | Recommended planet only (`guidedDimActive` when panel open) |
| Dim | Unrelated planets via `is-guide-dimmed` |
| Probe | Anchored next to recommended node · speech with mission title + reason |
| Unlock preview | List of downstream missions (up to 4) |
| Route preview | **Preview route** button · 3.5s chain illumination |
| Auto-open | Panel opens on guided entry; re-opens until dismissed while stage ≤ 2 |

## Independent mode

| Behavior | Detail |
|----------|--------|
| Passive | No auto-dim; guide available via floating FAB (bottom-right) |
| Resume | “Resume guided journey” in speech when no recommendation context |
| Re-enable | `resumeGuidedJourney()` restores guided mode |

## Locked planet click

| Step | Behavior |
|------|----------|
| Trigger | Click locked planet → `handleLockedNodeSelect` |
| Message | “Destination locked” · mission title · required steps |
| Visual | Prerequisite path highlighted on graph |
| Action | **Take Me There** → `goToPrerequisite()` selects first unsatisfied source |

## Route preview

| Property | Value |
|----------|-------|
| Trigger | Welcome start · **Preview route** button |
| Chain | Walks outgoing `unlock` + `dependency` edges (up to 3 hops) |
| Duration | 3.5s then reset |
| Visual | Route nodes/edges bright pulse · non-route elements heavily dimmed |
| Sharpness | No `backdrop-filter` blur on route chain during preview (`is-route-preview-active`) |

## New route discovery

When graph unlock set grows (module completion / profile update):

| Step | Behavior |
|------|----------|
| Detect | Newly unlocked node IDs vs previous snapshot |
| Toast | “New routes discovered.” (top, 3.2s fade) |
| Visual | `is-discovery-unlock` glow on new planets — subtle, no confetti |

## Progressive assistance (stages 1–4)

Derived from `completedMissionIds` count + mode:

| Stage | Trigger | Guide behavior |
|-------|---------|----------------|
| 1 | 0 completed · guided | Very active — auto panel |
| 2 | 1–3 completed · guided | Helpful |
| 3 | 4–7 completed · guided | Minimal |
| 4 | 8+ completed · or independent | On-demand FAB only |

---

# Part 3 — Recommendation engine

## `getRecommendedNextPlanet()`

**Inputs:** `graphNodes` · `graphEdges` · `lockedNodeIds` · `nodeTitles` · `primaryNodeId` · `completedNodeIds`

**Scoring (highest wins):**

| Priority | Score | Condition |
|----------|-------|-----------|
| Primary focus | 100 | `primaryNodeId` match · not completed · not locked |
| Recommended | 80 | `status === 'recommended'` |
| Blocked | 60 | `status === 'blocked'` |
| Future | 20 | `status === 'future'` |
| Excluded | −1 | `__journey__` · locked · `completed` · in `completedNodeIds` |

**Output:** `nodeId` · `missionTitle` · `reason` · `unlockPreview[]` (outgoing unlock/dependency edges, deduped, max 4)

## Route preview chain

`buildRoutePreviewChain(startNodeId)` — prefers `unlock` edges over `dependency` for forward walk (matches LE/ER/Profile graph semantics where focus → secondary uses `unlock`).

## Locked guide

`buildLockedGuideState(nodeId)` — direct unsatisfied prerequisite sources via `getUnsatisfiedDependencySources()`.

## Mission framing

`toMissionTitle(nodeId, title)` — profile domain labels + prefix transforms (`Complete` → `Establish`, `Add` → `Define`, …). Examples:

| Task label | Mission title |
|------------|---------------|
| Complete profile | Establish Your Identity |
| Add address | Set Your Home Base |
| Language settings | Configure Communication Systems |

---

# Part 4 — Persistence & completion sync

## Storage (`arrival-atlas-journey-guide-v1`)

| Field | Purpose |
|-------|---------|
| `hasChosenMode` | Welcome completed |
| `mode` | `guided` \| `independent` |
| `completedMissionIds` | Acknowledged / completed node IDs |
| `dismissedWelcomeSurfaces` | Per-surface welcome dismiss |
| `lockedClickCount` | Stuck-detection heuristic |
| `lastActiveAt` | ISO timestamp |

No backend / profile API writes — session-local guidance state only.

## Completion sync (no repeat recommendations after reload)

| Source | Mechanism |
|--------|-----------|
| Graph status | Nodes with `status === 'completed'` merged into `completedMissionIds` on snapshot load |
| Live update | `useJourneyGuideReporter` calls `onNodeCompleted()` when graph nodes complete |
| Engine filter | `completedNodeIds` excluded from scoring |
| Profile fix | `domainGalaxyStatus()` — `complete` domains always `completed` even when primary focus; `pickPrimaryFocus()` skips complete domains |

When no actionable recommendation remains → panel closes · guided dim inactive.

---

# Part 5 — Spatial-core integration

## `GalaxyViewport.tsx`

- Wraps `JourneyGuideProvider` + `JourneyGuideLayer`
- `is-guide-focus-active` when `ambientDimActive`
- `is-route-preview-active` during route preview

## `GalaxyGraphStage.tsx`

| Addition | Role |
|----------|------|
| `useOptionalJourneyGuideContext()` | Guide-aware visual states |
| `is-guide-highlighted` / `is-guide-dimmed` | Guided + welcome + preview dimming |
| `is-route-preview` | Chain highlight on nodes + edges |
| `is-discovery-unlock` | New unlock glow |
| `journey-guide-stage-veil` | Radial dim overlay behind nodes |
| `onLockedSelect` | Locked click → guide handler |

## `GalaxyNodeRenderer.tsx`

- `data-galaxy-node-id` for probe anchoring
- `onLockedSelect` callback on locked click (click no longer silently ignored)

## Visual state extensions (`types.ts`)

Node: `isGuideHighlighted` · `isGuideDimmed` · `isRoutePreview` · `isDiscoveryUnlock`  
Edge: `isRoutePreview` · `isGuideDimmed`

---

# Part 6 — Galaxy visual refinements (arr-029 follow-up)

Iterative UX tuning shipped in the same branch.

## Dependency gravity (`galaxy-gravity.ts`)

| Rule | Value |
|------|-------|
| Activation | **Hover only** on locked / dependency-connected planets |
| Max offset | `GRAVITY_MAX_OFFSET_PX = 3` |
| Particles | None |
| Tease / idle pull | None |

## Edge visibility

| State | Stroke | Notes |
|-------|--------|-------|
| Default dependency | ~1px · opacity 0.72 | `vector-effect: non-scaling-stroke` |
| Selection inactive | 0.75px · opacity 0.58 | |
| Selection active | 1.5px · opacity 0.82 | |
| Route preview | 2.25px · glow pulse | unlock + dependency |

## Profile graph fix

| Before | After |
|--------|-------|
| Primary focus always `recommended` even when `complete` | `complete` → `completed` always |
| `pickPrimaryFocus` could return complete domain | Skips `complete` · falls through to next actionable |

---

# Part 7 — CSS (`life-event-polish.css`)

New `journey-guide-*` block (~400 lines):

| Area | Classes |
|------|---------|
| Probe | `.journey-guide-probe` · `__core` · `__ring` · `__glow` |
| Speech | `.journey-guide-speech` · mission · list · close |
| Welcome | `.journey-guide-welcome` |
| FAB | `.journey-guide-fab` |
| Ambient | `.journey-guide-ambient` · `--route-preview` (hidden during preview) |
| Stage | `.is-guide-focus` · `.is-guide-guided` · `.is-guide-route-preview` |
| Route pulse | `@keyframes journey-guide-route-node-pulse` · `route-edge-pulse` |
| Discovery | `.journey-guide-discovery` |

`prefers-reduced-motion` disables guide + route animations.

---

# Part 8 — Tests

| File | Covers |
|------|--------|
| `journey-guide/recommendation-engine.test.ts` | Scoring · unlock chain · dependency chain · completed skip · locked prerequisites |
| `profile/build-galaxy-graph.test.ts` | Complete domains map to `completed` status |
| `spatial-core/galaxy-gravity.test.ts` | Hover gravity field · max offset clamp |
| `spatial-core/galaxy-dependencies.test.ts` | (arr-029 regression) |
| `spatial-core/module-progress.test.ts` | (arr-029 regression) |

```bash
cd apps/web && npx vitest run \
  src/lib/journey-guide/recommendation-engine.test.ts \
  src/lib/presentation/profile/build-galaxy-graph.test.ts \
  src/lib/presentation/spatial-core/galaxy-gravity.test.ts \
  src/lib/presentation/spatial-core/galaxy-dependencies.test.ts \
  src/lib/presentation/spatial-core/module-progress.test.ts
```

---

## Architecture compliance

| Constraint | Status |
|------------|--------|
| No backend / data model changes | ✓ — presentation + `localStorage` only |
| No routing URL changes | ✓ |
| Graph semantics unchanged | ✓ — recommendation reads existing node status + edges |
| All three galaxy surfaces | ✓ LE · ER · Profile |
| Home / embedded ER unchanged | ✓ |
| Homepage `/` out of scope | ✓ |
| No modal onboarding / product tour | ✓ — probe + anchored speech |

## Validation checklist (ARR-030 ready)

| Criterion | Status |
|-----------|--------|
| First-visit welcome with mode choice | ✓ |
| Guided · independent · resume flows | ✓ |
| Mission-framed copy (not task labels) | ✓ |
| Route preview chain illumination | ✓ |
| Locked planet → prerequisite path + Take Me There | ✓ |
| Completed nodes not re-recommended after reload | ✓ |
| Progressive assistance stages | ✓ |
| Discovery toast on new unlocks | ✓ |
| Guide does not block planet interactions | ✓ pointer-events on probe layer only |
| arr-029 galaxy surfaces regression | ✓ |

## Known issues / limitations

| Item | Notes |
|------|-------|
| `completedMissionIds` is localStorage only | Not synced to user profile / backend |
| `onNodeCompleted` not wired to explicit user actions | Driven by graph `completed` status sync |
| Route preview chain is linear (first unlock branch) | Parallel unlocks show first path only |
| AI-generated guidance | Types + provider structured for future; copy is static today |
| Inactivity return prompts | Not implemented |
| `journey-guide-*` CSS in `life-event-polish.css` | Same LE-coupling debt as arr-029 |
| Contextual “stuck” hints | `lockedClickCount >= 2` heuristic only |

## Deferred — post ARR-030

| Item | Notes |
|------|-------|
| Backend-persisted guide mode + mission progress | Profile / session API |
| AI-generated mission copy | LLM hook in provider |
| Inactivity / return-after-absence prompts | `lastActiveAt` already stored |
| Multi-branch route preview | Show all parallel unlock paths |
| Neutral `journey-guide.css` | Decouple from `le-*` / `life-event-polish.css` |
| Per-surface mission label catalogs | ER card keys · LE node ids |
| Guide position along edge paths | Probe travels visible routes |

---

## Test plan

### Unit

```bash
cd apps/web && npx vitest run \
  src/lib/journey-guide/recommendation-engine.test.ts \
  src/lib/presentation/profile/build-galaxy-graph.test.ts \
  src/lib/presentation/spatial-core/galaxy-gravity.test.ts \
  src/lib/presentation/spatial-core/galaxy-dependencies.test.ts \
  src/lib/presentation/spatial-core/module-progress.test.ts

npm run test
```

Clear guide state for first-visit smoke:

```js
localStorage.removeItem('arrival-atlas-journey-guide-v1')
```

### Manual smoke — Journey Guide (all surfaces)

- [ ] **First visit** — welcome panel · dimmed galaxy · Start Guided / Explore On My Own
- [ ] **Guided mode** — probe + speech at recommended planet · unrelated planets dimmed
- [ ] **Preview route** — chain glows bright · rest dimmed · no blur on chain · resets after ~3.5s
- [ ] **Close guide (×)** — background returns to normal (no stuck ambient dim)
- [ ] **Independent mode** — FAB appears · panel on demand
- [ ] **Resume guided** — from independent speech when offered
- [ ] **Locked planet click** — prerequisite list · Take Me There selects source
- [ ] **Complete a domain/node** — guide advances to next step · not same recommendation after reload
- [ ] **Discovery** — complete prerequisite → “New routes discovered” toast + planet glow

### Manual smoke — Life Events

- [ ] `/modules/life-event` — guide wired · primary action recommended
- [ ] Route preview follows unlock edges from focus → secondary
- [ ] arr-029 regression — stars · locks · dependencies intact

### Manual smoke — Profile

- [ ] `/profile` — complete domain not shown as recommended primary
- [ ] Next incomplete domain becomes recommendation after reload
- [ ] Locked domain guide shows correct prerequisites

### Manual smoke — Economic Reality

- [ ] `/modules/economic-reality` — guide at primary focus card
- [ ] Preview route from recommended card

### Manual smoke — visual refinements

- [ ] Dependency gravity only on hover · max subtle pull
- [ ] Edge thickness hierarchy on selection · readable default strokes
- [ ] No galaxy disappearance during route preview

### Typecheck / build

```bash
cd apps/web && npm run typecheck
cd apps/web && npm run build
```

---

## Related docs

- [arr-029-pr-description.md](./arr-029-pr-description.md) — Spatial galaxy unification · ER + Profile · dependencies · per-node progress
- [arr-028-pr-description.md](./arr-028-pr-description.md) — Life Events Galaxy · Spatial Core extraction
- [atlas-frontend-optimization-audit.md](../audits/atlas-frontend-optimization-audit.md) — perf baseline
- [EXECUTION-LOCK.md](../production-readiness/EXECUTION-LOCK.md) — P0 execution freeze
