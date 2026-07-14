---
id: certainty-layer
title: Certainty Layer — UX Contract Specification
project: Arrival Atlas
system: Arrival Atlas
type: primitive
domain: product
status: draft
maturity: canonical
owner: design
tags:
  - certainty
  - navigation
  - next-step
  - cognitive-load
created: 2026-07-13
updated: 2026-07-13
related:
  - ../ux-principles.md
  - ../cognitive-load-rules.md
  - ../product-personality.md
  - ../journey-guide-philosophy.md
  - ../implementation-roadmap.md
  - ./arrival-welcome.md
---

# Certainty Layer — UX Contract Specification

**Semantic contract — adapters describe reality; UI owns language.**

The Certainty Layer is the primary UX contract for answering four questions on every important surface:

1. **Where am I?** — `location` + `title`
2. **What should I do next?** — `nextAction.label`
3. **Why?** — `nextAction.reason` (semantic)
4. **What happens if I do it?** — `nextAction.expectedOutcome` (semantic)

Progress and confidence extend the contract without replacing these four answers.

---

## Architecture

```
Surface data (Life Events, Home, Guide, Profile, …)
        ↓
   Adapter (semantic only — no English sentences)
        ↓
   CertaintyState
        ↓
   Formatters (Calm Navigator copy — localizable)
        ↓
   UI primitives (CertaintyPanel, NextStepCard, …)
```

**Rule:** Adapters never format user-facing copy. Components never invent "because" text.

---

## CertaintyState

```ts
interface CertaintyState {
  location: string;              // Surface context, e.g. "Life Events"
  title: string;                 // Current focus
  nextAction?: {
    label: string;               // Human action label
    reason: CertaintyReason;     // Semantic "why"
    expectedOutcome?: CertaintyExpectedOutcome;
  };
  progress?: { completed: number; total: number };
  confidence?: 'clear' | 'needs_attention' | 'blocked' | 'unknown';
}
```

---

## Semantic reason variants

| Type | Meaning | Example semantic payload |
|------|---------|--------------------------|
| `dependency` | A prerequisite blocks the target | `{ prerequisite: "Registration", target: "Housing support" }` |
| `description` | Surface-specific explanation exists | `{ description: "housing support becomes available after registration" }` |
| `progress` | Fallback when no description | `{ target: "Registration" }` |

Formatters turn these into Calm Navigator copy, e.g.:

- `To unlock Housing support, Registration is needed first.`
- `Do this now because housing support becomes available after registration.`

---

## Semantic expected outcome variants

| Type | Meaning |
|------|---------|
| `unlock` | Completing the step unlocks a blocked target |
| `openPath` | Completing the step opens a downstream step |

---

## Confidence presentation

`getConfidencePresentation(level)` returns presentation metadata for UI:

- `label` — badge text (from shared copy)
- `icon` — icon identifier
- `tone` — semantic tone for theming
- `badgeVariant` / `colorToken` — CSS modifier keys

Adapters set `confidence` from domain state only — not from copy decisions.

---

## Consumers

CertaintyState is the single semantic engine for user guidance. Surfaces are presentations only.

```
Life Events adapter ──┐
Profile adapter ──────┼──► CertaintyState ──► Formatters ──► Inspector / Guide / (future Home)
Economic adapter ─────┘
                              │
                              └──► Journey Guide presenter (feature-flagged)
```

| Consumer | Adapter | Bundle builder | UI integration | Status |
|----------|---------|----------------|----------------|--------|
| **Life Events** | `life-event-certainty.ts` | `buildLifeEventCertaintyBundle` | Inspector + Guide | Reference implementation |
| **Profile** | `profile-certainty.ts` | `buildProfileCertaintyBundle` | Adapter only (Guide-ready) | E1 complete |
| **Economic Reality** | `economic-certainty.ts` | `buildEconomicCertaintyBundle` | Adapter only (Guide-ready) | E1 complete |
| **Journey Guide** | `journey-guide/adapters/certainty.ts` | — | Speech UI presenter | Life Events wired |
| **Home** | — | — | — | Future (E2+ boundary) |

**One truth, many presentations:** Every surface emits the same semantic language. No surface may hardcode recommendation copy.

### Shared bundle shape

```ts
type CertaintySurfaceBundle = {
  state: CertaintyState;
  recommendedFocusId: string | null;
  meta?: Record<string, unknown>; // future metadata slot
};
```

Life Events uses `recommendedNodeId` (same role as `recommendedFocusId`). Profile and Economic use `recommendedFocusId` for galaxy/guide anchoring.

**One truth, many presentations:** Inspector and Guide must never maintain separate "next step" reasoning for the same surface.

---

## Adapter responsibilities

Each surface provides an adapter that maps local state → `CertaintyState`:

| Surface | Adapter | Bundle builder | Status |
|---------|---------|----------------|--------|
| Life Events | `buildLifeEventInspectorCertaintyState` | `buildLifeEventCertaintyBundle` | Inspector + Guide |
| Profile | `buildProfileCertaintyState` | `buildProfileCertaintyBundle` | Adapter ready |
| Economic Reality | `buildEconomicCertaintyState` | `buildEconomicCertaintyBundle` | Adapter ready |
| Journey Guide | `buildJourneyGuideViewModelFromCertainty` | — | Presenter over Certainty |
| Home | — | — | Future |

Adapters may use surface-specific helpers (`titleForNode`, `descriptionForNode`) but must output semantic objects only.

---

## UI primitives

| Component | Question answered |
|-----------|-------------------|
| `CertaintyHeader` | Where am I? |
| `NextStepCard` | What should I do? + expected outcome |
| `BecauseExplanation` | Why? |
| `ProgressDelta` | What changed? |
| `CertaintyPanel` | Composition only |

Components call formatters; they do not embed string templates.

---

See [current-situation-resolver.md](./current-situation-resolver.md) for platform-wide situation selection over registered bundles.

---

## Feature flags

| Flag | Purpose | Default |
|------|---------|---------|
| `NEXT_PUBLIC_CERTAINTY_LAYER_ENABLED` | Inspector `CertaintyPanel` | `false` |
| `NEXT_PUBLIC_GUIDE_USE_CERTAINTY` | Journey Guide consumes `CertaintyState` | `false` |
| `NEXT_PUBLIC_CURRENT_SITUATION_ENABLED` | CSR infrastructure (E2+ consumers) | `false` |

Existing behavior is unchanged when flags are off.

---

## Journey Guide compatibility

Journey Guide is **not** replaced by Certainty Layer. Guide remains the conversational orchestrator and adds personality via `lib/journey-guide/formatters/`. Reasoning always comes from Certainty formatters — Guide never invents new "because" logic.

See [journey-guide-certainty.md](./journey-guide-certainty.md) for ownership, mapping, fallback, and rollout.

---

## Product principles supported

| Principle | How Certainty Layer supports it |
|-----------|----------------------------------|
| **Certainty Navigation** | One explainable next step with visible cause and effect |
| **Reduce uncertainty before adding information** (§4) | Location + confidence before detail |
| **One next step** | Single primary action in `nextAction` |
| **Always include because** ([journey-guide-philosophy.md](../journey-guide-philosophy.md)) | Semantic `reason` required for recommendations |
| **Never fake certainty** | `confidence` levels include `unknown` and `blocked` |
| **Calm Navigator personality** | Formatters enforce short, human copy |

---

## Implementation location

```
apps/web/src/lib/certainty/adapters/   — surface adapters (life-event, profile, economic)
apps/web/src/lib/certainty/formatters/ — shared copy layer
apps/web/src/components/certainty/   — UI primitives (Inspector)
apps/web/src/lib/journey-guide/        — Guide presenter + guide formatters
apps/web/src/lib/current-situation/    — Current Situation Resolver (CSR)
```

---

## Migration path

1. **Phase 1 (complete):** Domain, primitives, Life Events inspector proving ground
2. **Phase 2 (complete):** Semantic contract + formatter layer
3. **Phase 3 (complete):** Journey Guide consumes Certainty on Life Events (feature-flagged)
4. **Phase 4 (complete):** Profile + Economic Reality semantic adapters (bundle builders, no UI redesign)
5. **Phase 5+:** Wire Profile/Economic into Guide + Inspector; Home adapter (E2+ boundary)
6. **Phase 6 (complete):** Current Situation Resolver — platform authority over registered bundles (no UI consumer yet)

Do not duplicate adapter logic across surfaces — extend the adapter pattern per surface.
