---
id: journey-guide-philosophy
title: Journey Guide — Philosophy & Future Role
project: Arrival Atlas
system: Arrival Atlas
type: vision
domain: product
status: active
maturity: canonical
owner: design
tags:
  - journey-guide
  - navigation
  - ai
created: 2026-07-06
updated: 2026-07-06
related:
  - galaxy-design-language
  - onboarding-philosophy
---

# Journey Guide Philosophy

The Journey Guide is the most important — and most misunderstood — surface in Arrival Atlas.

This document redefines its role. **Challenge the current implementation.** Vision outranks v1.

---

## What the Guide is NOT

| Misconception | Truth |
|--------------|-------|
| Product tour | Tours teach UI. Guide teaches **life sequencing**. |
| Chatbot | Chat answers questions. Guide **reduces questions**. |
| Tooltip spam | Tooltips annotate. Guide **decides priority**. |
| Gamification narrator | Games entertain. Guide **protects**. |

---

## What the Guide IS

**One sentence:**

> The Journey Guide is a **trustworthy navigator** that converts a dependency map into **one safe next action** — with explainable cause.

### Primary archetype: **Navigator**

Not assistant (too passive). Not operating system (too grand). Not mentor (too personal).

**Navigator** — like GPS:

- Knows the map
- Speaks briefly
- Recalculates when you deviate
- Never pretends to be the destination

Secondary qualities:

| Quality | Role |
|---------|------|
| **Translator** | Bureaucracy → human language |
| **Witness** | Acknowledges progress |
| **Guardian** | Blocks harmful sequencing with explanation |

---

## Should users make choices?

### Default answer: **No — not at entry**

Under stress, **choice is cost**.

The Guide should:

1. **Default to one recommended path**
2. Offer **escape hatches**, not equal alternatives
3. Treat “Explore on my own” as **advanced mode**, not co-equal welcome

### v1 challenge

Current welcome presents **Start Guided Journey** vs **Explore On My Own** as peers.

**Vision correction:**

- First visit: Guide active by default — no mode election
- “I'll explore alone” → secondary, with consequence explained: *“You won't see recommended next steps until you ask.”*
- Mode change always available — never blocking

---

## Should the Guide reduce choices?

**Yes. Relentlessly.**

| User-facing chaos | Guide collapse |
|-------------------|----------------|
| 40 possible steps | 1 recommended |
| 3 locked planets | 1 prerequisite path |
| 5 benefit programs | 1 highest-confidence opportunity |
| Crisis | 1 stabilizing action |

The Guide is a **choice reduction engine**. If it adds decisions, it has failed.

---

## Should the Guide ever disappear?

### Never disappear entirely

The map remains when Guide is quiet. But **access to navigation help** must always exist — one tap.

### Guide visibility should fade in **intensity**, not availability

| User maturity | Guide behavior |
|---------------|----------------|
| Day 1 | Proactive recommendation + auto-open context |
| Week 1 | Proactive highlight; panel on demand |
| Month 1 | Quiet until stuck, crisis, or major unlock |
| Expert | Dormant icon; instant recall |

**Silence is earned.** **Abandonment is forbidden.**

---

## Should the Guide become the primary interface?

### Long-term: **Yes — for novice and crisis modes**

The ideal interface is not “galaxy + optional guide.”

It is:

```
[ Plain language situation summary ]
[ One next step — large ]
[ Map — supporting evidence ]
[ Why this / What unlocks / What if I'm wrong ]
```

The galaxy becomes **proof**, not homework.

v1 keeps galaxy-primary for engineering reasons. **Vision is guide-primary, map-secondary for stressed users.**

### Dual-mode interface (future)

| Mode | Primary surface |
|------|-----------------|
| **Navigate** | Guide sentence + CTA |
| **Understand** | Galaxy map |
| **Correct** | Forms |

User toggles mode — or product infers from behavior.

---

## Guide speech principles

| Rule | Example |
|------|---------|
| Short sentences | Max ~20 words per beat |
| No jargon without translation | “Anmeldung (address registration)” |
| Always include **because** | “Do X **because** Y unlocks” |
| Never fake certainty | “You may qualify” not “You qualify” |
| One CTA per speech | Not three links |

---

## Locked planet philosophy

Locked is **the most teachable moment**.

Guide must appear (or intensify) when user hits lock — without shame:

> “Not yet — and that's normal. You need {prerequisite} first. [Take me there]”

Padlock icon alone is **never sufficient**.

---

## Cinematic unlock philosophy

Unlock cinematics are **causality lessons**, not rewards.

**Vision rules:**

- Skippable always after first view
- Auto-skip when user urgency signals detected (rapid clicks, crisis entry)
- Must end with **textual summary** even if skipped
- Never block urgent action longer than **3 seconds** without consent

v1 long cinematics are **educationally valid, operationally excessive** for crisis persona.

---

## Guide vs Situation Map

| Situation Map | Journey Guide |
|---------------|---------------|
| What is true | What to do now |
| Persistent | Contextual |
| User-owned | Product-authored |
| Shows all | Highlights one |
| Structural | Narrative |

They must never contradict.

---

## Failure modes to eliminate

1. Guide asks mode before demonstrating value  
2. Guide speaks English while UI speaks German  
3. Guide competes with intake overlays  
4. Guide absent when map is least interpretable  
5. Guide celebrates when user needed substance  
6. Independent mode hides help below fold  

---

## Success metric

> **Time to trustworthy next action** — measured from problem statement, not app open.

Not engagement. Not animation completion. **Action clarity.**

---

## Related documents

- [onboarding-philosophy.md](./onboarding-philosophy.md)
- [emotional-design.md](./emotional-design.md)
- [galaxy-design-language.md](./galaxy-design-language.md)
