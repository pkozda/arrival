---
id: galaxy-design-language
title: Galaxy Design Language — Semantic Specification
project: Arrival Atlas
system: Arrival Atlas
type: vision
domain: product
status: active
maturity: canonical
owner: design
tags:
  - galaxy
  - metaphor
  - spatial
  - semantics
created: 2026-07-06
updated: 2026-07-06
related:
  - arrival-atlas-philosophy
  - journey-guide-philosophy
---

# Galaxy Design Language

This document defines what the galaxy **means** — not how it is drawn.

If a visual element cannot be mapped to a row in this document, it must not ship.

---

## Core thesis

The galaxy is a **dependency map of a human life** in a bureaucratic environment.

It is not a theme. It is not gamification. It is **compressed institutional reality**.

---

## The center

| Semantic | Meaning |
|----------|---------|
| **Center node** | **The user's current anchor** — “You are here” in life, not in the app |
| Life Events center | Your active journey / plan |
| Profile center | Your situation as a whole |
| Economic center | Your financial position in the system |

**Rule:** The center never represents the product brand. It represents **the person**.

**Anti-pattern:** Logo or “Arrival Atlas” at the center of every galaxy.

---

## A planet

| Semantic | Meaning |
|----------|---------|
| **Planet** | A **domain of life** or a **concrete step** that can be understood, completed, or corrected |

Planets are not “features.” They are **things that matter to a migrant**:

- Register address · insure health · report income · apply for support

**States:**

| Visual state | Meaning |
|--------------|---------|
| Neutral | Relevant, actionable or inspectable |
| Highlighted | Recommended now |
| Locked | Real prerequisite not met — **not UI gating** |
| Completed | Fact recorded or step done |
| Dimmed | Not relevant to current focus |
| Emerging | Newly became relevant — cause must be shown |

**Rule:** Every planet label must survive the **“So what in real life?”** test within one tap.

---

## A connection (route / edge)

| Semantic | Meaning |
|----------|---------|
| **Connection** | A **dependency** — legal, procedural, or practical |

Connections answer: *“Why does this require that?”*

**Types (conceptual):**

| Type | Example |
|------|---------|
| **Prerequisite** | Registration before health insurance enrollment |
| **Unlock** | Completing X enables Y |
| **Influence** | Income affects benefit amount (not binary) |

**Rule:** Highlighting a route is **explaining causality** — never decoration.

---

## Gravity

| Semantic | Meaning |
|----------|---------|
| **Gravity** | The **pull of prerequisites** — what this step depends on |

Gravity visualizes: *“This matter is weighed down by what came before.”*

**When gravity appears:** On hover or focus of a locked or dependent node — show what pulls it.

**Rule:** Gravity without labeled cause is forbidden.

---

## Distance

| Semantic | Meaning |
|----------|---------|
| **Distance from center** | **Procedural remoteness** — how far from current life anchor |

Near center: immediate survival and legal stability.  
Farther out: longer-horizon growth, optional optimization.

**Rule:** Distance may be approximate — not geographic. Never arbitrary for layout vanity.

---

## A constellation

| Semantic | Meaning |
|----------|---------|
| **Constellation** | A **thematic cluster** of related concerns |

Examples: “Health & mobility support” · “Housing cost relief” · “Family benefits”

**Rule:** Constellations help users see **stackable opportunities** — not collect badges.

---

## A nebula

| Semantic | Meaning |
|----------|---------|
| **Nebula** | **Uncertainty** — incomplete information, probabilistic eligibility, needs more data |

Nebula is honesty: *“Something may exist here for you, but we can't see it yet.”*

**Rule:** Nebula must invite **one clarifying action** — not vague mystery.

---

## Light

| Semantic | Meaning |
|----------|---------|
| **Light** | **Clarity** — known eligibility, confirmed facts, open paths |

Lighting up a node means: *“This is real for you now.”*

**Rule:** Light without explanation is distrustful. Pair with cause when non-obvious.

---

## Darkness

| Semantic | Meaning |
|----------|---------|
| **Darkness** | **Not yet relevant, blocked, or unknown** — temporarily |

Darkness is not punishment. It is **focus**.

**Rule:** Dimming must be reversible by user action or data — never permanent obscurity of rights.

---

## Animation

| Semantic | Meaning |
|----------|---------|
| **Animation** | **Change over time in the dependency graph** |

Permitted animations and their meaning:

| Animation | Means |
|-----------|-------|
| Route traversal | “This step led to that” |
| Lock fade | “Barrier removed” |
| Pulse on source | “You completed the cause” |
| Emergence | “New option became real” |
| Probe movement | “Attention belongs here” |

**Forbidden:** Continuous ambient motion with no state change to communicate.

---

## Discovery

| Semantic | Meaning |
|----------|---------|
| **Discovery** | **New bureaucratic possibility became visible** because facts changed |

Discovery is not surprise content. It is: *“Because you did X, Y is now on your map.”*

**Rule:** Every discovery names **cause → effect**.

---

## Completion

| Semantic | Meaning |
|----------|---------|
| **Completion** | A **verified state change** in the user's situation |

Completion is not clicking a button. It is **recorded truth** or **confirmed external step**.

**Rule:** Distinguish “marked done” vs “verified done” when product cannot confirm reality.

---

## Progression

| Semantic | Meaning |
|----------|---------|
| **Progression** | **Movement through a dependency graph over days and weeks** |

Progression is spatial **and** temporal — week 1 vs month 3.

**Rule:** Show progression as map change, not only badges.

---

## The Journey Guide (in galaxy context)

| Semantic | Meaning |
|----------|---------|
| **Journey Guide** | The **navigator** that translates map structure into one next step |

The Guide is not part of the sky. It is the **instrument panel** — like GPS for bureaucracy.

See [journey-guide-philosophy.md](./journey-guide-philosophy.md) for full role definition.

---

## Galaxy modes (conceptual)

| Mode | User need |
|------|-----------|
| **Situation view** | What is true about me? |
| **Plan view** | What sequence am I following? |
| **Opportunity view** | What support or optimization exists? |
| **Crisis view** | What do I do if something breaks? |

Multiple galaxies in v1 are **lenses** on one Situation — not separate products. Long-term vision may unify under one sky.

---

## When galaxy is the wrong UI

Use plain forms and lists when:

- User is correcting a single fact
- Legal precision requires linear fields
- Stress level demands maximum familiarity

**Leaving the galaxy is not failure.** Returning to it after is success.

---

## Validation checklist

Before any galaxy change:

- [ ] What real-world entity does each node represent?
- [ ] What dependency does each edge represent?
- [ ] What does lock mean in plain language?
- [ ] What single action is recommended?
- [ ] Can this be understood without space metaphor training?

---

## Related documents

- [mental-model.md](./mental-model.md)
- [interaction-principles.md](./interaction-principles.md)
- [journey-guide-philosophy.md](./journey-guide-philosophy.md)
