# arr-034 — E0 Arrival Welcome · E1 Certainty Layer · CSR · MBDE boot fix

**Branch:** `arr-034`  
**Tracks:** Phase 0 Arrival Welcome · Phase 1 Certainty Navigation foundation · Current Situation Resolver · local dev reliability  
**Base:** `develop` (post arr-033)

Ships the first two migration epics from the Vision → Implementation roadmap — **before** Home redesign, Guide defaulting, or Situation Layer (E2):

1. **E0 — Arrival Welcome Layer** — first-contact language selection, trust copy, and session state above the live app (not a Home replacement).
2. **E1 — Certainty Layer (complete)** — semantic `CertaintyState` contract, formatters, surface adapters (Life Events · Profile · Economic), UI primitives, Journey Guide integration, and **Current Situation Resolver** (platform authority for “what matters most”).
3. **MBDE boot fix** — `FileBenefitGraphStore` constructor crash that blocked API session bootstrap on fresh dev installs.
4. **Vision migration docs** — implementation roadmap, UX epic backlog, four primitive specifications.

**Product verdict:** A stressed newcomer must choose language and feel welcomed **before** encountering the galaxy metaphor. Every core surface must eventually answer *where am I · what next · why · what happens* through one semantic contract — not competing ad-hoc copy. This PR lays that contract and wires the first consumers (Life Events inspector, optional Guide path) behind feature flags.

**Diff vs `develop` (working tree):** ~30 files touched · +~4,500 lines · new domains: `lib/arrival-welcome/`, `lib/certainty/`, `lib/current-situation/` · UI: `components/arrival/`, `components/certainty/` · Journey Guide adapters/formatters · vision primitives + roadmap · MBDE store fix + test.

---

# Part 1 — E0 · Arrival Welcome Layer

## Problem

Pre-arr-034 first contact:

```text
Open website
  → English landing
  → Understand Atlas metaphor
  → Hunt for language settings
  → Enter Atlas
```

Vision [onboarding-philosophy.md](../vision/onboarding-philosophy.md) and cognition audit score **4.5/10** partly because language and trust arrive too late. E0 inverts the order without replacing Home visuals.

## Architecture

```text
AppProvider
  └── ArrivalWelcomeGate
        ├── shouldShow? → ArrivalWelcomeLayer (overlay)
        │     ├── LanguageSelector (DE · UA · RU · EN)
        │     ├── WelcomeMessage (localized copy)
        │     └── ContinueAction
        └── environment (inert while welcome active)

useArrivalWelcome()
  ├── detectBrowserLanguage() → suggestion (never forced)
  ├── readArrivalWelcomeState() → localStorage
  ├── selectLanguage() → AppProvider.changeLanguage()
  └── complete() → persist + dispatch welcome-completed event
```

**Separate from demo state:** Arrival Welcome is orthogonal to `arrival_atlas_demo_active` (arr-032). First contact ≠ “Enter Atlas” exploration.

## Package map (`lib/arrival-welcome/`)

| File | Role |
|------|------|
| `types.ts` | `SupportedLanguage`, storage key, completed event |
| `arrival-welcome-state.ts` | Read/write/clear persisted welcome record |
| `detect-browser-language.ts` | `navigator.language` → suggestion with fallback |
| `language-labels.ts` | Native language names for selector |
| `arrival-welcome-copy.ts` | Localized welcome strings (DE/UA/RU/EN) |
| `useArrivalWelcome.ts` | React hook — show/skip/complete lifecycle |
| `arrival-welcome-telemetry.ts` | Custom event dispatch for analytics hooks |

## UI components (`components/arrival/`)

| Component | Role |
|-----------|------|
| `ArrivalWelcomeGate.tsx` | Gate wrapper · `inert` on live environment |
| `ArrivalWelcomeLayer.tsx` | Composed welcome surface |
| `welcome/WelcomeShell.tsx` | Layout shell |
| `welcome/LanguageSelector.tsx` | Language chips |
| `welcome/WelcomeMessage.tsx` | Headline + reassurance |
| `welcome/ContinueAction.tsx` | Primary CTA |

Styles: `ui-cohesion.css` (`.arrival-welcome-*` block).

## Integration

| File | Change |
|------|--------|
| `AppProvider.tsx` | Wraps children in `<ArrivalWelcomeGate>` after bootstrap |

## Behavior contract

| Visitor | Flow |
|---------|------|
| **New** | Welcome overlay → language select → localized copy → continue → app |
| **Returning** | Saved language + completed flag → skip overlay |

Browser language is **suggested**, never auto-applied without user confirmation.

## Tests

| File | Covers |
|------|--------|
| `detect-browser-language.test.ts` | Locale parsing · unsupported fallback |
| `arrival-welcome-state.test.ts` | Persist · complete · clear |
| `ArrivalWelcomeGate.test.tsx` | Gate visibility · inert · completion |
| `ArrivalWelcomeLayer.test.tsx` | Copy · selector · telemetry · continue |

---

# Part 2 — E1 · Certainty Layer (semantic contract)

## Problem

Life Events inspector, Journey Guide, Profile, and Economic Reality each reason about “next step” independently. Copy leaks into adapters; Guide duplicates unlock semantics. Vision **Certainty Navigation** requires one explainable contract:

> Where am I · What next · Why · What happens if I do it

## Architecture

```text
Surface data (Life Events plan, profile gaps, economic actions)
        ↓
   Adapter (semantic only — no English sentences)
        ↓
   CertaintyState
        ↓
   Formatters (Calm Navigator copy — localizable)
        ↓
   UI primitives (CertaintyPanel, NextStepCard, …)
```

**Rule:** Adapters emit `CertaintyReason` / `CertaintyExpectedOutcome` objects. Formatters own language. Components never invent “because” text.

## CertaintyState (core types)

```typescript
interface CertaintyState {
  location: string;
  title: string;
  nextAction?: {
    label: string;
    reason: CertaintyReason;           // dependency | description | progress
    expectedOutcome?: CertaintyExpectedOutcome;  // unlock | openPath
  };
  progress?: { completed: number; total: number };
  confidence?: 'clear' | 'needs_attention' | 'blocked' | 'unknown';
}
```

## Package map (`lib/certainty/`)

| Area | Files | Role |
|------|-------|------|
| **Types** | `types.ts`, `types-bundle.ts` | `CertaintyState`, bundles, registration |
| **Formatters** | `formatters/formatReason.ts`, `formatOutcome.ts`, `formatProgress.ts`, `getConfidencePresentation.ts` | User-facing copy from semantic objects |
| **Copy** | `certainty-copy.ts` | Calm Navigator string templates |
| **Validation** | `validate-certainty-state.ts` | Runtime shape checks |
| **Feature flag** | `certainty-feature-flag.ts` | `NEXT_PUBLIC_CERTAINTY_LAYER_ENABLED` |
| **Telemetry** | `certainty-events.ts` | Custom events for certainty impressions |
| **Adapters** | `adapters/life-event-certainty.ts` | Plan nodes → bundle |
| | `adapters/profile-certainty.ts` | Profile gaps → bundle |
| | `adapters/economic-certainty.ts` | Economic actions → bundle |

## UI primitives (`components/certainty/`)

| Component | Role |
|-----------|------|
| `CertaintyPanel.tsx` | Composed certainty surface |
| `CertaintyHeader.tsx` | Location + title + confidence badge |
| `NextStepCard.tsx` | Primary action CTA |
| `BecauseExplanation.tsx` | Reason paragraph (via formatter) |
| `ProgressDelta.tsx` | Completed/total progress |
| `LifeEventInspectorCertainty.tsx` | Life Events inspector integration |

## Life Events wiring

| File | Change |
|------|--------|
| `GalaxyGraphInspectorBridge.tsx` | Renders `LifeEventInspectorCertainty` when flag on; builds certainty bundle for Guide reporter |

Inspector shows certainty block **above** existing action breakdown — no galaxy layout redesign.

## Feature flag

```bash
# .env.example
NEXT_PUBLIC_CERTAINTY_LAYER_ENABLED=false   # off by default
```

When `false`: inspector certainty hidden; adapters/formatters still testable in isolation.

## Tests

| File | Covers |
|------|--------|
| `certainty.test.ts` | Formatters · validation · copy |
| `profile-certainty.test.ts` | Profile gap → semantic state |
| `economic-certainty.test.ts` | Economic action → semantic state |
| `CertaintyPrimitives.test.tsx` | Component rendering |
| `LifeEventInspectorCertainty.test.tsx` | Inspector integration |

---

# Part 3 — E1 Phase 3 · Journey Guide × Certainty

## Problem

Journey Guide maintained parallel reasoning for mission text, explanation, and unlock preview. Vision requires Guide as **presentation** of `CertaintyState`, not a competing semantic engine.

## Architecture

```text
Life Events plan + graph context
        ↓
buildLifeEventCertaintyBundle()
        ↓
CertaintyState + recommendedNodeId
        ↓
buildJourneyGuideViewModelFromCertainty()   ← lib/journey-guide/adapters/certainty.ts
        ↓
JourneyGuideViewModel
        ↓
viewModelToPlanetRecommendation() → existing Guide speech UI
```

Graph unlock preview (node ids, probe anchor) passes as **presentation metadata** — not duplicated reasoning.

## New / modified Journey Guide files

| File | Role |
|------|------|
| `adapters/certainty.ts` | `CertaintyState` → `JourneyGuideViewModel` |
| `formatters/formatGuideSpeech.ts` | Wraps `formatReason` with Guide tone |
| `formatters/formatGuideOutcome.ts` | Outcome phrasing |
| `formatters/formatGuideMission.ts` | Mission title from location/title |
| `guide-certainty-feature-flag.ts` | `NEXT_PUBLIC_GUIDE_USE_CERTAINTY` |
| `guide-certainty-events.ts` | Telemetry when Guide uses certainty path |
| `JourneyGuideProvider.tsx` | Consumes certainty view model when flag on |
| `useJourneyGuideReporter.ts` | Accepts certainty bundle from Life Events bridge |
| `types.ts` | Extended view model fields |

## Mapping

| Certainty | Guide ViewModel | Guide UI |
|-----------|-----------------|----------|
| `location` + `title` | `currentMission` | Context in speech |
| `nextAction.label` | `recommendedStep` | Mission title |
| `nextAction.reason` | `explanation` | Reason paragraph |
| `nextAction.expectedOutcome` | `outcome` | Outcome phrasing |
| `confidence` | `tone` + `confidencePresentation` | Tone metadata |
| Graph unlock preview | `unlockPreview` | “Completing this unlocks” list |

## Feature flag

```bash
NEXT_PUBLIC_GUIDE_USE_CERTAINTY=false   # off by default; requires Life Events context
```

## Tests

| File | Covers |
|------|--------|
| `adapters/certainty.test.ts` | View model mapping · edge cases |
| `JourneyGuideCertainty.test.tsx` | Provider + reporter integration |

---

# Part 4 — E1 final · Current Situation Resolver (CSR)

## Problem

With Life Events, Profile, and Economic each emitting `CertaintyState`, the platform lacks authority for **which surface’s certainty is currently most important** — risk of competing next-step engines.

CSR answers one domain question:

> What should Arrival Atlas consider the user's **current reality** right now?

CSR does **not** generate language. CSR does **not** own UI. It selects the winning bundle among registered producers.

## Architecture

```text
Life Events Bundle ──┐
Profile Bundle ──────┼──► Current Situation Registry
Economic Bundle ─────┘              │
                                    ▼
                         Current Situation Resolver
                                    ▼
                           CurrentSituationResult
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
   (future Home)              (future E2                (future HUD,
                              Situation Layer)           Guide default,
                                                         MBDE, notifications)
```

## Package map (`lib/current-situation/`)

| File | Role |
|------|------|
| `types.ts` | `SurfaceRegistration`, `CurrentSituationResult`, `ResolutionReason` |
| `registry.ts` | Register/unregister surface bundles |
| `priority.ts` | Surface priority constants (Life Events 100 · Economic 80 · Profile 60) |
| `resolver.ts` | Confidence rank → surface priority → winner selection |
| `validation.ts` | Bundle registration validation |
| `current-situation-feature-flag.ts` | `NEXT_PUBLIC_CURRENT_SITUATION_ENABLED` |

## Resolution policy

1. **Confidence rank:** `blocked` > `needs_attention` > `clear` > `unknown`
2. **Surface priority:** Life Events > Economic > Profile (tie-breaker)
3. **Resolution reason:** Auditable enum (`highest_priority_blocked`, `surface_priority_tiebreak`, …)

## Feature flag

```bash
NEXT_PUBLIC_CURRENT_SITUATION_ENABLED=false   # no consumer wired yet
```

CSR is domain-complete; E2 Situation Layer and Home/HUD consumers deferred.

## Tests

| File | Covers |
|------|--------|
| `current-situation.test.ts` | 14 tests — registry, priority, resolver, validation |

---

# Part 5 — MBDE boot fix (local dev blocker)

## Problem

Fresh `npm run dev` crashed API bootstrap:

```text
Unable to start session / Failed to fetch
```

Root cause: `FileBenefitGraphStore` constructor called `super(seed)`, which triggered `upsert()` → `save()` **before** `this.filePath` was assigned.

## Fix

```typescript
constructor(filePath: string, seed: BenefitNode[] = []) {
  super([]);                    // no seed-through-save
  this.filePath = filePath;
  seed.forEach((node) => super.upsert(node));
}
```

## Additional

| File | Change |
|------|--------|
| `benefit-graph-store.test.ts` | **New** — constructor + persist smoke |
| Root `package.json` | `predev` builds `@arrival-atlas/mbde` before web dev |

## Tests

```bash
cd packages/mbde && npm test   # 9 tests passing (was 8 + store test)
```

---

# Part 6 — Vision migration documentation

## New documents

| Document | Role |
|----------|------|
| [implementation-roadmap.md](../vision/implementation-roadmap.md) | Phase 0–6 migration strategy · gap matrix by surface |
| [ux-migration-backlog.md](../vision/ux-migration-backlog.md) | E0–E13 epic catalog with dependencies |
| [implementation-backlog.md](../vision/implementation-backlog.md) | Redirect stub → canonical backlog |
| [primitives/arrival-welcome.md](../vision/primitives/arrival-welcome.md) | E0 behavioral spec |
| [primitives/certainty-layer.md](../vision/primitives/certainty-layer.md) | E1 semantic UX contract |
| [primitives/journey-guide-certainty.md](../vision/primitives/journey-guide-certainty.md) | E1 Phase 3 integration contract |
| [primitives/current-situation-resolver.md](../vision/primitives/current-situation-resolver.md) | CSR platform authority spec |

## Updated

| Document | Change |
|----------|--------|
| [docs/vision/README.md](../vision/README.md) | Migration strategy section · primitive links |

## Dependency graph (from roadmap)

```text
E0 Arrival Welcome Layer
 ↓
E1 Certainty Layer (+ CSR)
 ↓
E3 / E4 / E9 / E10
```

---

# Part 7 — Relationship between deliverables

```text
┌─────────────────────┐     ┌─────────────────────┐
│  Vision Bible       │────▶│  Migration roadmap   │
│  (arr-033)          │     │  + epic backlog      │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           └───────────┬───────────────┘
                       ▼
            ┌─────────────────────┐
            │  E0 Arrival Welcome│
            │  (first contact)   │
            └──────────┬─────────┘
                       ▼
            ┌─────────────────────┐
            │  E1 Certainty Layer │
            │  adapters → CSR    │
            └──────────┬─────────┘
                       ▼
            ┌─────────────────────┐
            │  Future E2–E7      │
            │  Situation · Home  │
            │  Guide defaulting  │
            └─────────────────────┘
```

arr-033 defined **where we're going**. arr-034 implements **Phase 0 + Phase 1 foundation** — the semantic plumbing future surfaces consume.

---

# Part 8 — Architecture compliance

| Constraint | E0 | E1 | CSR | MBDE fix |
|------------|----|----|-----|----------|
| No breaking changes to existing modules | ✓ overlay only | ✓ flag-gated | ✓ no consumer | ✓ constructor only |
| Preserves galaxy / guide / profile engines | ✓ | ✓ adapters wrap existing data | ✓ | — |
| SSR-safe / client-only where needed | ✓ localStorage gated | ✓ | ✓ | — |
| Feature flags default off (except E0) | Always on (by design) | ✓ | ✓ | — |
| No Home redesign | ✓ | ✓ | ✓ | — |
| No Guide UI redesign | ✓ | ✓ view model swap | — | — |
| Vision primitive specs updated | ✓ | ✓ | ✓ | — |

---

## Validation checklist (ARR-034 ready)

| Criterion | Status |
|-----------|--------|
| Arrival Welcome shows on first visit · skips on return | ✓ |
| Language selection persists · syncs with AppProvider | ✓ |
| `NEXT_PUBLIC_CERTAINTY_LAYER_ENABLED=true` → inspector certainty | ✓ |
| `NEXT_PUBLIC_GUIDE_USE_CERTAINTY=true` → Guide uses certainty path | ✓ |
| Profile + Economic adapters produce valid bundles | ✓ |
| CSR resolves winner with auditable reason | ✓ |
| 65 web tests (E0/E1/Guide/CSR) pass | ✓ |
| MBDE 9 tests pass · API boots on fresh dev | ✓ |
| Vision roadmap + 4 primitive specs complete | ✓ |
| No regression to arr-032 demo/session flows | ✓ |

## Known limitations

| Item | Notes |
|------|-------|
| E0 always on — no feature flag | Intentional; first contact is universal |
| Certainty inspector Guide flags off by default | Enable per-env for staged rollout |
| CSR has no UI/HUD/Home consumer | Domain ready; E2 wires presentation |
| Profile/Economic adapters not in inspector yet | Bundles + tests only |
| Home still marketing-first | E7 Home Inversion deferred |
| Guide mode election unchanged | E5 Guide Defaulting deferred |
| Partial i18n beyond welcome copy | E8 Localization Parity deferred |
| MBDE user-facing benefits UI | Still admin-only (arr-033 scope) |

---

## Test plan

### Unit

```bash
cd apps/web && npm test -- --run \
  src/lib/arrival-welcome \
  src/__tests__/arrival \
  src/lib/certainty \
  src/__tests__/certainty \
  src/lib/current-situation \
  src/lib/journey-guide/adapters \
  src/__tests__/journey-guide

cd packages/mbde && npm test
```

Expected: **65 web tests + 9 MBDE tests** passing.

### Manual smoke — E0 Arrival Welcome

- [ ] Clear `localStorage` (`arrival_atlas_welcome_state`) → welcome overlay appears
- [ ] Browser `de-DE` → German suggested · not auto-selected until click
- [ ] Select Ukrainian → copy switches · Continue → overlay dismisses
- [ ] Refresh → welcome skipped · language preserved
- [ ] Live app environment is `inert` while welcome active (no accidental clicks)

### Manual smoke — E1 Certainty (flags on)

Set in `.env.local`:

```bash
NEXT_PUBLIC_CERTAINTY_LAYER_ENABLED=true
NEXT_PUBLIC_GUIDE_USE_CERTAINTY=true
```

- [ ] Life Events inspector → certainty block with location, next step, because, progress
- [ ] Select different node → certainty updates
- [ ] Journey Guide speech aligns with inspector certainty (same next step / reason)
- [ ] Flags off → inspector and guide behave as arr-033

### Manual smoke — CSR (dev console / future hook)

- [ ] Register Life Events + Profile bundles → resolver picks blocked over clear
- [ ] Equal confidence → Life Events wins over Profile (priority 100 > 60)

### Manual smoke — MBDE / API bootstrap

- [ ] Delete `.arrival-atlas-state/mbde-benefit-graph.json` · restart API → no crash
- [ ] `GET /api/benefits/max` returns ranked opportunities
- [ ] Web `localhost:3000` → session bootstrap succeeds (no “Failed to fetch”)

### Manual smoke — regression

- [ ] arr-032 demo flows: Enter Atlas · Leave demo · session recreation notice
- [ ] Galaxy graph interaction unchanged when certainty flags off
- [ ] Bootstrap gate · focus traps · cross-tab demo reset

### Docs review

- [ ] [implementation-roadmap.md](../vision/implementation-roadmap.md) Phase 0–1 align with shipped code
- [ ] Primitive specs match adapter/formatter boundaries
- [ ] Feature flags documented in `.env.example`

---

## Related docs

- [arr-033-pr-description.md](./arr-033-pr-description.md) — MBDE foundation · Vision Bible · audits
- [arr-032-pr-description.md](./arr-032-pr-description.md) — Phase 1 release blockers · demo session trust
- [docs/vision/README.md](../vision/README.md) — Design constitution index
- [ux-migration-backlog.md](../vision/ux-migration-backlog.md) — E0–E13 epic catalog
- [phase-1-release-blockers.md](../production-readiness/phase-1-release-blockers.md) — tactical P0 fixes
