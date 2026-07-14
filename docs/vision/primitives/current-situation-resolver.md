---
id: current-situation-resolver
title: Current Situation Resolver — Platform Authority
project: Arrival Atlas
system: Arrival Atlas
type: primitive
domain: product
status: draft
maturity: canonical
owner: design
tags:
  - certainty
  - situation
  - resolver
  - platform
created: 2026-07-13
updated: 2026-07-13
related:
  - ./certainty-layer.md
  - ../mental-model.md
  - ../ux-principles.md
  - ../implementation-roadmap.md
---

# Current Situation Resolver (CSR)

**Domain architecture — not presentation. Not E2 Situation Layer.**

CSR answers one platform question:

> What should Arrival Atlas consider the user's **current reality** right now?

CSR does **not** generate language. CSR does **not** own UI. CSR only selects the most important `CertaintyState` among registered surface producers.

---

## Problem

Arrival Atlas now has multiple Certainty producers:

- Life Events
- Profile
- Economic Reality

Each emits a semantic `CertaintyState`. Without CSR, there is no single authority for "what matters most" across surfaces — creating risk of competing next-step engines at the platform level.

---

## Architecture

```
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

CSR sits **above** surface adapters and **below** presentation layers.

---

## Responsibilities

| Layer | Owns |
|-------|------|
| Surface adapters | Local state → `CertaintyState` |
| **CSR** | Which surface's certainty is platform-current |
| Formatters | Human language from semantic objects |
| UI / Guide / Home | Presentation only |

**CSR decides:** what is currently most important.  
**CSR does not:** rewrite copy, navigate, or render.

---

## Registration API

Runtime-only registry (no persistence):

```ts
registry.registerSurfaceBundle({
  surface: 'life-events',
  bundle: buildLifeEventCertaintyBundle(...),
});

registry.registerSurfaceBundle({
  surface: 'profile',
  bundle: buildProfileCertaintyBundle(...),
});

registry.registerSurfaceBundle({
  surface: 'economic',
  bundle: buildEconomicCertaintyBundle(...),
});
```

Latest registration per surface wins (duplicate replace).

Methods: `register`, `remove`, `resolve`, `getCurrent`, `subscribe`, `unsubscribe`, `clear`.

---

## Resolution algorithm

Deterministic two-stage comparison:

### 1. Confidence precedence

| Rank | Level |
|------|-------|
| 1 (highest) | `blocked` |
| 2 | `needs_attention` |
| 3 | `clear` |
| 4 (lowest) | `unknown` |

`blocked` wins over everything. `needs_attention` wins over `clear`. `unknown` only wins if nothing better exists.

### 2. Surface priority tie-break

When confidence is equal, higher numeric priority wins:

| Surface | Default priority |
|---------|------------------|
| Life Events | 100 |
| Economic Reality | 80 |
| Profile | 60 |

Further tie-break: lexical `surface` id (deterministic).

### Resolution reason (semantic)

Examples:

- `highest_priority_blocked`
- `highest_confidence_needs_attention`
- `highest_surface_priority_tiebreak`
- `only_registered_surface`
- `fallback_unknown`

Not user-facing copy.

---

## Output shape

```ts
type CurrentSituationResult = {
  source: 'life-events' | 'profile' | 'economic';
  certainty: CertaintyState;
  priority: number;
  reason: ResolutionReason;
};
```

---

## Validation & safety

- Invalid source, priority, or certainty → registration rejected (no throw)
- Resolver never throws
- Listener errors isolated
- Missing confidence → invalid registration

---

## Feature flag

`NEXT_PUBLIC_CURRENT_SITUATION_ENABLED=false` (default)

Infrastructure only in E1. No consumer wired yet. Existing application behavior unchanged.

---

## Future consumers (E2+)

| Consumer | Role |
|----------|------|
| **Situation Layer (E2)** | Primary consumer — platform situation model |
| Home | Problem-first entry from current situation |
| Journey Guide | Default recommendation source |
| HUD | Persistent situation chip |
| MBDE | Benefit eligibility context |
| Notifications | Urgency routing |
| Arrival Welcome | Returning-user handoff |

---

## Implementation

```
apps/web/src/lib/current-situation/
  types.ts          — domain types
  priority.ts       — default surface priorities
  validation.ts     — registration guards
  resolver.ts       — deterministic selection
  registry.ts       — runtime registry + subscriptions
  index.ts          — public exports
```

---

## Relationship to Certainty Layer

Certainty Layer (E1) defines **what each surface knows**.  
CSR (E1 final) defines **which surface matters most right now**.  
Situation Layer (E2) will expose platform situation to users — consuming CSR, not replacing it.
