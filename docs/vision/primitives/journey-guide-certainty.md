---
id: journey-guide-certainty
title: Journey Guide × Certainty Layer Integration
project: Arrival Atlas
system: Arrival Atlas
type: primitive
domain: product
status: draft
maturity: canonical
owner: design
tags:
  - journey-guide
  - certainty
  - navigation
created: 2026-07-13
updated: 2026-07-13
related:
  - ./certainty-layer.md
  - ../journey-guide-philosophy.md
  - ../ux-principles.md
  - ../implementation-roadmap.md
---

# Journey Guide × Certainty Layer Integration

**Architectural contract — not a Journey Guide redesign.**

Journey Guide is one presentation of `CertaintyState`. It must not maintain a competing semantic engine for next-step reasoning.

---

## Ownership

| Layer | Owns |
|-------|------|
| **Certainty** (`lib/certainty/`) | Semantic truth: location, next action, reason, outcome, progress, confidence |
| **Life Events adapter** | Plan nodes → `CertaintyState` + `recommendedNodeId` |
| **Guide adapter** (`lib/journey-guide/adapters/certainty.ts`) | `CertaintyState` → `JourneyGuideViewModel` |
| **Guide formatters** (`lib/journey-guide/formatters/`) | Personality wrapping over Certainty formatters |
| **Guide UI** (`JourneyGuideLayer`, speech primitives) | Rendering only — no new reasoning |

**Rule:** Guide adds tone and mission framing. Guide does **not** invent "because" text or unlock semantics.

---

## Data flow (Life Events)

```
Life Events plan + graph context
        ↓
buildLifeEventCertaintyBundle()
        ↓
CertaintyState + recommendedNodeId
        ↓
buildJourneyGuideViewModelFromCertainty()
        ↓
JourneyGuideViewModel
        ↓
viewModelToPlanetRecommendation() → existing Guide speech UI
```

Graph context (unlock preview node ids, probe anchor) is presentation metadata passed alongside Certainty — not duplicated reasoning.

---

## Mapping

| Certainty | Guide ViewModel | Guide UI |
|-----------|-----------------|----------|
| `location` + `title` | `currentMission` | Context (implicit in speech) |
| `nextAction.label` | `recommendedStep` | Mission title line |
| `nextAction.reason` | `explanation` | Reason paragraph (via `formatGuideSpeech` → `formatReason`) |
| `nextAction.expectedOutcome` | `outcome` | Outcome phrasing (via `formatGuideOutcome`) |
| `confidence` | `tone` + `confidencePresentation` | Guide tone metadata |
| `progress` | `progress.label` | Future mission progress (not yet in speech UI) |
| Graph unlock preview | `unlockPreview` | "Completing this unlocks" list |

---

## Guide formatters

| Function | Role |
|----------|------|
| `formatGuideMission()` | Mission personality via `toMissionTitle` |
| `formatGuideSpeech()` | Delegates to `formatReason()` — no invented reasoning |
| `formatGuideOutcome()` | Guide phrasing over `formatExpectedOutcome()` |

Example personality wrap (outcome):

- Certainty: `This opens the path to Housing support.`
- Guide: `That opens the path to Housing support.`

---

## Feature flag

`NEXT_PUBLIC_GUIDE_USE_CERTAINTY=true` enables Guide to consume Certainty on supported surfaces.

| Flag state | Behavior |
|------------|----------|
| Off (default) | Legacy `getRecommendedNextPlanet()` — unchanged |
| On + complete Certainty | Guide uses `JourneyGuideViewModel` from Certainty |
| On + incomplete Certainty | Fallback to legacy recommendation engine |

Inspector flag (`NEXT_PUBLIC_CERTAINTY_LAYER_ENABLED`) is independent — Guide can consume Certainty without showing the inspector panel.

---

## Fallback policy

Guide **never** renders an empty recommendation.

1. If flag off → legacy engine (always)
2. If flag on but no `certaintySource` → legacy + `guide_certainty_missing` telemetry
3. If flag on but incomplete state → legacy + `guide_certainty_fallback` telemetry
4. If flag on and complete → Certainty path + `guide_certainty_enabled` telemetry

Surfaces without a Certainty adapter (Profile, Economic Reality) continue on legacy until their adapters exist.

---

## Rollout strategy

1. **Life Events only** — shared `buildLifeEventCertaintyBundle` in galaxy bridge
2. Enable `NEXT_PUBLIC_GUIDE_USE_CERTAINTY` in staging; compare telemetry ratios
3. Add Profile / Economic Reality certainty adapters before enabling flag globally
4. Remove legacy recommendation copy paths once all surfaces have adapters

---

## Telemetry

| Event | Meaning |
|-------|---------|
| `guide_certainty_enabled` | Guide successfully consumed complete Certainty |
| `guide_certainty_fallback` | Certainty incomplete — legacy engine used |
| `guide_certainty_missing` | Flag on but no certainty source from surface |

Dispatched via `arrival-atlas:guide-certainty-telemetry`. Existing Journey Guide behavior telemetry (localStorage persistence) is unchanged.

---

## Implementation location

```
apps/web/src/lib/certainty/adapters/life-event-certainty.ts   — shared Life Events truth
apps/web/src/lib/journey-guide/adapters/certainty.ts          — Certainty → ViewModel
apps/web/src/lib/journey-guide/formatters/                    — Guide personality layer
apps/web/src/lib/journey-guide/JourneyGuideProvider.tsx       — flag + fallback orchestration
apps/web/src/lib/presentation/le-ux/components/GalaxyGraphInspectorBridge.tsx — Life Events wiring
```

---

## Principles supported

| Principle | How integration supports it |
|-----------|----------------------------|
| **One Next Step** | Single `CertaintyState.nextAction` feeds Guide |
| **Certainty before Exploration** | Semantic reason before graph decoration |
| **One Truth, Many Presentations** | Inspector + Guide share one adapter output |
| **Always include because** | Reason from Certainty formatters only |
| **Navigator personality** | Mission titles and outcome phrasing in guide formatters |
