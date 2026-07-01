# arr-031 — Journey Guide · cinematic unlock sequence · profile correction toast

**Branch:** `arr-031`  
**Tracks:** Journey Guide · cinematic unlock discovery · route traversal animation · emergence · replay · profile correction toast UX  
**Base:** `develop` (post arr-030)

Replaces the arr-030 **static discovery toast** (“New routes discovered.” + planet glow) with a **multi-phase cinematic unlock sequence** when completing a mission simultaneously unlocks new planets. The sequence walks the causal chain on the galaxy graph: completion pulse → edge traversal → lock fade / planet emergence → discovery overlay → guided speech with replay. Also refactors **Profile Correction Toast** into a self-contained fixed overlay driven by `?updated=1`, and clears Journey Guide state in dev reset.

**Product verdict:** Unlocking a new route should feel like a **spatial discovery moment** — the user sees *why* a planet opened (completed source → traversed path → emerged destination), not a fleeting banner. Profile corrections should confirm success without breaking the galaxy layout.

**Diff vs `develop`:** ~19 files · +~1,089 / −~107 lines (`apps/web`) · new `cinematic-unlock-engine.ts` (~236 lines) + tests (~89 lines).

---

# Part 1 — Cinematic unlock architecture

## Summary

```text
Graph snapshot change (completion + unlock in same tick)
  └── JourneyGuideProvider
        ├── cinematic-unlock-engine
        │     ├── findNewlyCompletedNodeIds()
        │     ├── findNewlyUnlockedNodeIds()
        │     └── buildUnlockSequence() → routeSteps · emergence order
        ├── phase timer orchestration (completion → routes → emergence → overlay → guide)
        ├── persistUnlockEvent() → localStorage lastUnlockEvent
        └── GalaxyGraphStage visual classes (is-cinematic-*)
              └── life-event-polish.css animations
```

Trigger requires **both** a newly completed node and newly unlocked nodes in the same graph snapshot update. Source node = last newly completed mission (causal attribution).

## Module map

| File | Role |
|------|------|
| `journey-guide/cinematic-unlock-engine.ts` | Detection · path building · timing constants · copy · stored-event serialization |
| `journey-guide/cinematic-unlock-engine.test.ts` | Unit tests for detection, chain build, messages |
| `journey-guide/types.ts` | `CinematicUnlockPhase` · `CinematicUnlockState` · `StoredUnlockEvent` |
| `journey-guide/storage.ts` | `persistUnlockEvent()` · `lastUnlockEvent` in persisted state |
| `journey-guide/JourneyGuideProvider.tsx` | Phase orchestration · replay · context exports |
| `journey-guide/JourneyGuideLayer.tsx` | Overlay · guide speech during `guide` phase · replay button |
| `journey-guide/JourneyGuide.tsx` | `CinematicDiscoveryOverlay` component |

## Replaces arr-030 discovery

| arr-030 | arr-031 |
|---------|---------|
| `discovery: DiscoveryState` (3.2s toast) | `cinematicUnlock: CinematicUnlockState` (multi-phase) |
| `is-discovery-unlock` planet glow | `is-cinematic-completion` · `is-cinematic-route` · `is-cinematic-emergence` |
| `.journey-guide-discovery` toast | `.cinematic-discovery-overlay` (title + destination list) |
| No replay | `replayCinematicUnlock()` from `lastUnlockEvent` |

`DiscoveryState` type retained in `types.ts` but no longer used at runtime.

---

# Part 2 — Cinematic unlock phases

## Phase timeline (`CINEMATIC_TIMING`)

| Phase | Duration / offset | Visual |
|-------|-------------------|--------|
| `completion` | 0 → 1000ms | Source planet pulse (`is-cinematic-completion`) |
| `routes` | +450ms per hop | Edges traverse (`is-cinematic-traverse` / `is-cinematic-traversing`) · route nodes glow |
| `emergence` | +650ms per node | Locked planets emerge (`is-cinematic-emergence` · lock fades) |
| `overlay` | +2800ms | Fixed overlay: “New route discovered” / “N new destinations available” |
| `guide` | +4000ms | Probe speech: unlock explanation · optional **Replay discovery** |
| end | auto-clear | `cinematicUnlock` → `null` |

Total runtime scales with `routeSteps.length` and `newlyUnlockedNodeIds.length`.

## Detection logic

| Function | Input | Output |
|----------|-------|--------|
| `findNewlyCompletedNodeIds` | previous completed set · graph nodes | IDs where `status === 'completed'` (excl. `__journey__`) |
| `findNewlyUnlockedNodeIds` | previous locked set · current locked · nodes | IDs that left locked set |
| `buildUnlockSequence` | sourceId · newly unlocked · edges | BFS paths along `unlock` + `dependency` edges · deduped route steps · emergence order |

Unlock edges preferred over dependency edges when path-finding (`unlock` sorts first).

## Guide copy (`buildUnlockGuideMessage`)

| Unlocks | Title | Body pattern |
|---------|-------|----------------|
| 1 | “A new route has become available” | “Completing {source} unlocked your access to {dest}.” |
| 2 | “New routes discovered” | “Completing {source} unlocked {A} and {B}.” |
| 3+ | “{N} new destinations available” | Comma-separated list |

## Replay

| Property | Value |
|----------|-------|
| Persisted | `lastUnlockEvent` in `arrival-atlas-journey-guide-v1` |
| Scope | Per `surfaceId` |
| UI | **Replay discovery** ghost button in guide speech (guided + cinematic guide phase) |
| Behavior | `startCinematicUnlock(event, isReplay: true)` — no re-persist |

---

# Part 3 — Spatial-core integration

## `GalaxyGraphStage.tsx`

| Visual flag | When |
|-------------|------|
| `isCinematicCompletion` | Phase `completion` · source node |
| `isCinematicRoute` | Node on revealed route chain |
| `isCinematicEmergence` | Newly unlocked node in emergence |
| `isCinematicEmerging` | Currently animating emergence (active index) |
| `isCinematicDimmed` | All non-highlighted nodes during cinematic |
| `isCinematicTraverse` | Edge on route chain |
| `isCinematicTraversing` | Active edge hop (pulse animation) |

Stage class: `is-cinematic-unlock` when cinematic active.  
`isDiscoveryUnlock` hardcoded `false` — legacy class path unused.

## `GalaxyNodeRenderer.tsx`

- Cinematic CSS classes on node wrapper
- Lock icon hidden during `isCinematicEmergence` (fade animation on lock)

## `GalaxyViewport.tsx`

- `is-cinematic-unlock-active` when `cinematicUnlock` set

## `types.ts` extensions

Node: `isCinematicCompletion` · `isCinematicRoute` · `isCinematicEmergence` · `isCinematicEmerging` · `isCinematicDimmed`  
Edge: `isCinematicTraverse` · `isCinematicTraversing`

## Interaction guards during cinematic

| Action | Blocked during cinematic? |
|--------|---------------------------|
| Route preview | Yes |
| Guided dim / auto-panel | Paused until cinematic ends |
| Planet click | No — interactions not blocked |

---

# Part 4 — Journey Guide layer changes

## `JourneyGuideLayer.tsx`

| Change | Detail |
|--------|--------|
| Probe anchor | During `guide` phase → first newly unlocked or source node |
| Probe state | `highlighting` during non-guide cinematic phases |
| Panel | Opens during `guide` phase with cinematic copy |
| Ambient | `journey-guide-ambient--cinematic-unlock` (hidden, same as route-preview) |
| Overlay | `CinematicDiscoveryOverlay` at `overlay` phase |
| Removed | `.journey-guide-discovery` toast block |

## Context API additions

`cinematicUnlock` · `cinematicRouteNodeIds` · `cinematicRouteEdgeIds` · `cinematicEmergenceNodeIds` · `lastUnlockEvent` · `canReplayUnlock` · `replayCinematicUnlock()`

`clearGuide()` and panel close also clear cinematic state + timers.

---

# Part 5 — Persistence

## Storage (`arrival-atlas-journey-guide-v1`)

| Field | Purpose |
|-------|---------|
| `lastUnlockEvent` | **New** — full unlock sequence for replay (surfaceId · source · chain · routeSteps · recordedAt) |

`persistUnlockEvent()` writes on first (non-replay) cinematic trigger.

## Dev tools

`clearDevClientState()` now removes `JOURNEY_GUIDE_STORAGE_KEY` alongside onboarding dismiss key.

---

# Part 6 — Profile correction toast refactor

## Before (arr-030)

- Parent pages read `?updated=1` via `useSearchParams`
- Passed `showUpdatedToast` prop to `ProfileGalaxyBridge` / inline in `ProfileDomainDetail`
- Toast rendered as `AtlasSurface` card inside page flow (`mb-md`)

## After (arr-031)

| Aspect | Behavior |
|--------|----------|
| Component | Self-contained — reads `?updated=1` internally |
| Position | Fixed overlay below HUD (`profile-correction-toast`) |
| Auto-dismiss | 4.2s |
| Manual dismiss | × button · `router.replace()` strips `updated` param |
| CSS | `ui-cohesion.css` (~67 lines) |
| Props removed | `showUpdatedToast` from `ProfileGalaxyBridge` |
| Page cleanup | `/profile/[domainSlug]` no longer passes search param |

Toast always mounted in galaxy bridge and legacy `ProfileDomainDetail` — visibility gated by URL param.

---

# Part 7 — CSS

## `life-event-polish.css` — cinematic block (~200 lines)

| Area | Classes / keyframes |
|------|---------------------|
| Stage dim | `.is-cinematic-unlock` · orbits fade · `is-cinematic-dimmed` nodes |
| Completion | `is-cinematic-completion` · `cinematic-completion-pulse` · `cinematic-completion-ring` |
| Route | `is-cinematic-route` · `is-cinematic-traverse` · `is-cinematic-traversing` · `cinematic-edge-trace` |
| Emergence | `is-cinematic-emergence` · `is-cinematic-emerging` · `cinematic-emergence-scale/color` · `cinematic-lock-fade` |
| Overlay | `.cinematic-discovery-overlay` · `cinematic-overlay-in` |
| Ambient | `.journey-guide-ambient--cinematic-unlock` (display: none) |
| a11y | `prefers-reduced-motion` disables cinematic animations |

## `ui-cohesion.css` — profile toast

`.profile-correction-toast` · `__content` · `__title` · `__subtitle` · `__close` · `profile-correction-toast-in`

---

# Part 8 — Tests

| File | Covers |
|------|--------|
| `cinematic-unlock-engine.test.ts` | Newly completed/unlocked detection · causal chain · cascading unlocks · guide messages · overlay title |
| arr-030 tests | Unchanged — recommendation engine · profile graph · spatial-core regressions |

```bash
cd apps/web && npx vitest run \
  src/lib/journey-guide/cinematic-unlock-engine.test.ts \
  src/lib/journey-guide/recommendation-engine.test.ts \
  src/lib/presentation/profile/build-galaxy-graph.test.ts

npm run test
```

Clear state for first-visit / replay smoke:

```js
localStorage.removeItem('arrival-atlas-journey-guide-v1')
```

---

## Architecture compliance

| Constraint | Status |
|------------|--------|
| No backend / data model changes | ✓ — presentation + `localStorage` only |
| No routing URL changes | ✓ — `?updated=1` query param unchanged |
| Graph semantics unchanged | ✓ — reads existing node status + edges |
| All three galaxy surfaces | ✓ LE · ER · Profile (cinematic via shared `GalaxyGraphStage`) |
| arr-030 guide flows preserved | ✓ welcome · guided · independent · locked · route preview |
| No modal onboarding | ✓ — probe + overlay + speech |

## Validation checklist (ARR-031 ready)

| Criterion | Status |
|-----------|--------|
| Complete mission → cinematic unlock when planets unlock | ✓ |
| Completion pulse on source planet | ✓ |
| Edge traversal animation along causal chain | ✓ |
| Emergence animation (lock fade · color restore) | ✓ |
| Discovery overlay with destination list | ✓ |
| Guide speech after cinematic with unlock explanation | ✓ |
| Replay discovery from persisted `lastUnlockEvent` | ✓ |
| Route preview blocked during cinematic | ✓ |
| Profile correction toast as fixed overlay | ✓ |
| Toast auto-dismiss + URL cleanup | ✓ |
| Dev reset clears journey guide storage | ✓ |
| arr-030 regression (guide · gravity · edges) | ✓ |

## Known issues / limitations

| Item | Notes |
|------|-------|
| Cinematic requires simultaneous completion + unlock | Unlock without completion in same tick does not trigger |
| Source = last newly completed node | Ambiguous if multiple complete in one tick |
| `DiscoveryState` type orphaned | Kept in types.ts · runtime path removed |
| Legacy `.journey-guide-discovery` CSS | Unused but not deleted |
| Cinematic timers on unmount | Cleared via `clearCinematicTimers` |
| `lastUnlockEvent` is localStorage only | Not synced to backend |
| Profile toast on legacy `ProfileDomainDetail` | Still mounted (galaxy is primary route) |

## Deferred — post ARR-031

| Item | Notes |
|------|-------|
| Remove dead discovery CSS / `DiscoveryState` type | Cleanup pass |
| Cinematic on profile-only unlocks (no mission completion) | Edge case handling |
| Skip cinematic in independent mode (user preference) | Settings hook |
| Backend-persisted unlock history | Session API |
| Sound / haptics on emergence | Optional polish |

---

## Test plan

### Unit

```bash
cd apps/web && npx vitest run src/lib/journey-guide/cinematic-unlock-engine.test.ts
npm run test
```

### Manual smoke — cinematic unlock (all surfaces)

- [ ] **Complete prerequisite mission** — cinematic starts (not old discovery toast)
- [ ] **Completion phase** — source planet pulses · galaxy dims
- [ ] **Route phase** — edges animate hop-by-hop toward unlocked planets
- [ ] **Emergence phase** — lock icon fades · planet color restores
- [ ] **Overlay** — title + destination list below HUD (~2.8s)
- [ ] **Guide phase** — probe speech explains unlock · panel open
- [ ] **Replay discovery** — button replays full sequence without re-persist
- [ ] **Route preview** — blocked during cinematic · works after
- [ ] **Reduced motion** — animations suppressed

### Manual smoke — Profile correction toast

- [ ] Edit profile domain → redirect with `?updated=1`
- [ ] Fixed toast appears below HUD (not inline card)
- [ ] Auto-dismiss ~4.2s · URL param removed
- [ ] Manual × dismiss · param stripped
- [ ] Galaxy layout unaffected by toast

### Manual smoke — arr-030 regression

- [ ] Welcome · guided · independent · locked planet · route preview
- [ ] Completed nodes not re-recommended after reload
- [ ] Dependency gravity hover-only · edge hierarchy

### Typecheck / build

```bash
cd apps/web && npm run typecheck
cd apps/web && npm run build
```

---

## Related docs

- [arr-030-pr-description.md](./arr-030-pr-description.md) — Journey Guide · route preview · galaxy visual refinements
- [arr-029-pr-description.md](./arr-029-pr-description.md) — Spatial galaxy unification · ER + Profile
- [EXECUTION-LOCK.md](../production-readiness/EXECUTION-LOCK.md) — P0 execution freeze
