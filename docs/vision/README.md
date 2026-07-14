---
id: vision-readme
title: Arrival Atlas — UX Vision & Design Bible
project: Arrival Atlas
system: Arrival Atlas
type: index
domain: product
status: active
maturity: canonical
owner: design
tags:
  - vision
  - design-system
  - constitution
created: 2026-07-06
updated: 2026-07-06
related:
  - arrival-atlas-philosophy
  - ux-principles
---

# Arrival Atlas — UX Vision & Design Bible

This folder is the **design constitution** for Arrival Atlas.

It is not implementation documentation. It is not marketing. It is not a snapshot of Version 1.

Every future screen, animation, feature, and interaction must be **evaluated against these documents before it ships**.

---

## What this is

A long-term UX philosophy package derived from:

- [product-walkthrough-ux-consultant.md](../audits/product-walkthrough-ux-consultant.md) — what exists today  
- [ux-cognition-audit-immigrant-persona.md](../audits/ux-cognition-audit-immigrant-persona.md) — how it feels under stress  
- [production-readiness-ui-ux-audit.md](../audits/production-readiness-ui-ux-audit.md) — release gaps  
- [phase-1-release-blockers.md](../production-readiness/phase-1-release-blockers.md) — tactical fixes  

**Audits diagnose. Vision prescribes.**

When audit findings and vision conflict, **vision defines the destination** — blockers bridge the gap.

---

## Document map

```text
                    ┌─────────────────────────┐
                    │  arrival-atlas-         │
                    │  philosophy.md          │
                    │  (WHY)                  │
                    └───────────┬─────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           ▼                    ▼                    ▼
   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
   │ mental-model  │   │ emotional-    │   │ product-      │
   │ .md           │   │ design.md     │   │ personality.md│
   │ (how users    │   │ (how it       │   │ (how it       │
   │  think)       │   │  should feel) │   │  speaks)      │
   └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
           │                   │                   │
           └─────────┬─────────┴─────────┬─────────┘
                     ▼                   ▼
           ┌─────────────────┐ ┌─────────────────┐
           │ galaxy-design-  │ │ journey-guide-  │
           │ language.md     │ │ philosophy.md   │
           │ (spatial        │ │ (navigator      │
           │  semantics)     │ │  role)          │
           └────────┬────────┘ └────────┬────────┘
                    │                   │
        ┌───────────┴───────┬───────────┴───────────┐
        ▼                   ▼                       ▼
┌───────────────┐  ┌───────────────┐      ┌───────────────┐
│ ux-principles │  │ interaction-  │      │ onboarding-   │
│ .md           │  │ principles.md │      │ philosophy.md │
│ (immutable    │  │ (behavior)    │      │ (first run)   │
│  rules)       │  │               │      │               │
└───────┬───────┘  └───────┬───────┘      └───────┬───────┘
        │                  │                      │
        └──────────────────┼──────────────────────┘
                           ▼
                 ┌─────────────────┐
                 │ cognitive-load- │
                 │ rules.md        │
                 │ (measurable     │
                 │  limits)        │
                 └─────────────────┘
```

---

## Documents

| Document | Read when you… |
|----------|----------------|
| [arrival-atlas-philosophy.md](./arrival-atlas-philosophy.md) | Need the **why** — problem, emotions, differentiation |
| [mental-model.md](./mental-model.md) | Design IA, entry flows, or copy — **user thinking first** |
| [ux-principles.md](./ux-principles.md) | Review any PR — **25 immutable rules** |
| [galaxy-design-language.md](./galaxy-design-language.md) | Touch spatial UI — **semantic meaning of every element** |
| [journey-guide-philosophy.md](./journey-guide-philosophy.md) | Design guidance, coaching, AI — **navigator role** |
| [emotional-design.md](./emotional-design.md) | Shape tone, pacing, celebration — **Arrival Curve** |
| [interaction-principles.md](./interaction-principles.md) | Motion, unlocks, disclosure — **behavior rules** |
| [onboarding-philosophy.md](./onboarding-philosophy.md) | First-run — **ideal** path, not v1 optimization |
| [cognitive-load-rules.md](./cognitive-load-rules.md) | QA / design review — **testable limits** |
| [product-personality.md](./product-personality.md) | Write strings — **voice & behavior** |

---

## How to use this bible (contributors)

### Before designing a feature

1. Read **philosophy** + **mental-model** (if new to project)  
2. Write the **user problem sentence** — not the feature sentence  
3. Sketch **one primary next step**  
4. Map spatial elements to [galaxy-design-language.md](./galaxy-design-language.md)  
5. Check against [ux-principles.md](./ux-principles.md)  

### Before implementing UI

1. Run [cognitive-load-rules.md](./cognitive-load-rules.md) checklist  
2. Verify [interaction-principles.md](./interaction-principles.md) for motion/overlays  
3. Copy review against [product-personality.md](./product-personality.md)  
4. First-run flows against [onboarding-philosophy.md](./onboarding-philosophy.md)  

### Before shipping

1. **375px mobile** — navigation reachability (cognitive rule 8)  
2. **Stressed-user test** — can someone in a hurry state the next step aloud?  
3. **Language consistency** — no mixed-language viewports  
4. **No dead ends** — recovery on every error  

### When vision conflicts with v1 code

**Vision wins in design decisions.** File a blocker or phased migration — do not silently ship anti-patterns because “that's how it works today.”

---

## Version 1 vs vision

Version 1 proves:

- Dependency graphs can be rendered spatially  
- Journey Guide can recommend with explanation  
- Profile mutations can feed recommendations  
- Cross-module orchestration is possible  

Version 1 **does not yet fully embody** this bible.

Known tensions (intentional debt):

| v1 pattern | Vision direction |
|------------|------------------|
| Module-first HUD | Problem-first entry |
| Marketing home slider | Problem intake → one action |
| Guide mode election | Default guided |
| Galaxy-primary UI | Guide-primary for novice/crisis |
| Partial i18n | Full-language parity including guide |
| Decorative entry motion | Instructional motion only |

Engineering investments in galaxy, guide, and profile **remain valid** — they are the rendering layer for a deeper interaction model described below.

---

## The unifying design philosophy

### **Certainty Navigation**

> **Arrival Atlas is the only migration product that treats bureaucracy as a dependency map of your life — and obsessively collapses it into one explainable next step.**

Other platforms:

| Platform type | Optimizes for |
|---------------|---------------|
| Government portals | Agency completeness |
| Chatbots | Question answering |
| Task managers | Checkbox volume |
| Information sites | Content coverage |

**Arrival Atlas optimizes for:**

> **Reducing uncertainty to a single trustworthy action — with visible cause, effect, and recovery.**

### The three pillars (inseparable)

1. **Situation Map** — what is true about your life (persistent, honest, editable)  
2. **Dependency Truth** — what must happen before what (spatial, explainable)  
3. **Next Step Engine** — what to do now (one recommendation, because-string, feedback loop)  

Remove any pillar and the product becomes either a brochure, a game, or a chat toy.

### Why this is impossible to confuse with other migration platforms

- **Not a portal** — personal sequencing, not agency catalog  
- **Not a chatbot** — structure visible; answers bounded by graph  
- **Not a checklist** — dependencies are the UI  
- **Not a course** — action-first, not content-first  
- **Not a game** — metaphor serves law and procedure, not engagement metrics  

The **signature interaction** is:

```
Your situation changed
    → the map updates honestly
    → the navigator names one next step
    → you act
    → the map shows what unlocked and why
```

No other product makes **institutional causality** the core interface.

---

## Radical model (future — preserves engineering)

**Concept: Situation-First Navigator**

Single persistent object: **Your Situation** (graph + facts).

All “modules” become **lenses**:

| User question | Lens |
|---------------|------|
| What now? | Navigator (primary for stress) |
| What is true? | Situation map |
| What can I access? | Opportunity field (benefits) |
| What if…? | Scenarios |

The galaxy remains the **proof layer** users open when they doubt the recommendation.

The guide becomes the **default surface** — not an overlay on modules.

HUD becomes **Now · Situation · Support · Plan** — not product module names.

This is a **presentation inversion**, not a rewrite of graph engines, profile store, or module runtime.

---

## Governance

| Change type | Required |
|-------------|----------|
| New principle | Design review + README update |
| Exception to principle | Written rationale in PR |
| New spatial metaphor element | [galaxy-design-language.md](./galaxy-design-language.md) entry first |
| Onboarding change | [onboarding-philosophy.md](./onboarding-philosophy.md) alignment check |

**Status:** `canonical` — changes require explicit design owner approval.

---

## Related external references

Style inspiration (not copy):

- Apple Human Interface Guidelines — clarity, deference, depth  
- GOV.UK Design System — plain language, user need first  
- Stripe design principles — reduce cognitive load, earn trust through detail  

---

## Migration strategy (v1 → vision)

Vision prescribes destination. These documents define **how** to get there without discarding engineering investments:

| Doc | Role |
|-----|------|
| [implementation-roadmap.md](./implementation-roadmap.md) | Phased migration plan (Phase 0–6) |
| [ux-migration-backlog.md](./ux-migration-backlog.md) | UX epics with dependencies |
| [primitives/arrival-welcome.md](./primitives/arrival-welcome.md) | E0 first-contact primitive spec |
| [primitives/certainty-layer.md](./primitives/certainty-layer.md) | E1 certainty UX contract (semantic model + formatters) |
| [primitives/journey-guide-certainty.md](./primitives/journey-guide-certainty.md) | E1 Phase 3 — Guide consumes Certainty |
| [primitives/current-situation-resolver.md](./primitives/current-situation-resolver.md) | E1 final — platform current situation authority |

**Phase 0 — Arrival Welcome Layer** precedes all other phases: language and trust before complexity.

---

## Related internal docs

| Doc | Relationship |
|-----|--------------|
| [../production-readiness/ux.md](../production-readiness/ux.md) | Tactical UX gates |
| [../audits/ux-cognition-audit-immigrant-persona.md](../audits/ux-cognition-audit-immigrant-persona.md) | Evidence base |
| [../production-readiness/phase-1-release-blockers.md](../production-readiness/phase-1-release-blockers.md) | v1 bridge to vision |

---

*This bible should remain relevant for five years because it describes **human bureaucracy navigation** — not current component names.*
