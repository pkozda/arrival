---
id: emotional-design
title: Emotional Design — The Arrival Curve
project: Arrival Atlas
system: Arrival Atlas
type: vision
domain: product
status: active
maturity: canonical
owner: design
tags:
  - emotion
  - design
  - journey
created: 2026-07-06
updated: 2026-07-06
related:
  - arrival-atlas-philosophy
  - product-personality
---

# Emotional Design

Arrival Atlas designs **feelings on purpose**.

Emotion is not polish. It is **functional** — panic blocks comprehension; confidence enables action.

---

## The Arrival Curve

```text
Opening app
    ↓
Curiosity        (safe enough to look)
    ↓
Safety           (not being tricked or judged)
    ↓
Understanding    (my situation makes sense)
    ↓
Confidence       (I know the next step)
    ↓
Achievement      (something real moved)
    ↓
Ownership        (this map is mine)
    ↓
Independence     (I need less help)
```

Not every session completes the curve. **Crisis sessions** may jump to Confidence with minimal Curiosity. **Return sessions** may start at Understanding.

Design must support **entry at any phase**.

---

## Phase 1 — Curiosity

**Feeling:** *“Maybe this can help me.”*

| Design levers | Target |
|---------------|--------|
| Visual calm | Dark but warm — not sterile gov gray, not casino neon |
| Human headline | Life outcome, not tech |
| Low commitment entry | No account wall at door |

**Avoid:** Hype, false urgency, space spectacle before meaning.

**v1 gap:** Curiosity competes with unexplained metaphor and duplicate CTAs.

---

## Phase 2 — Safety

**Feeling:** *“I won't be harmed by using this.”*

| Design levers | Target |
|---------------|--------|
| Honest demo labeling | Not government, not lawyer |
| Data transparency | What is stored, where, what resets |
| Recoverable errors | No dead ends |
| Plain warnings | Before destructive actions |

**Avoid:** “Session” language · silent data loss · mock auth implying login.

**Trust is binary.** One betrayal resets the curve to zero.

---

## Phase 3 — Understanding

**Feeling:** *“My life fits into a structure I can grasp.”*

| Design levers | Target |
|---------------|--------|
| Situation map | Domains as life areas, not schemas |
| Explained locks | Cause, not padlock |
| Subtitles | Bureaucratic term → human meaning |

**Avoid:** Abstract module names · galaxy with no legend · ten peer nodes.

---

## Phase 4 — Confidence

**Feeling:** *“I know what to do next — and why.”*

| Design levers | Target |
|---------------|--------|
| One primary recommendation | Guide or equivalent |
| Because-string | Reason visible without drill-down |
| Preview route | Show dependency path |

**Avoid:** Mode choice · multiple equal CTAs · hidden mobile nav.

**This is the product's highest-value emotional state.**

---

## Phase 5 — Achievement

**Feeling:** *“I actually made progress.”*

| Design levers | Target |
|---------------|--------|
| Verified completion | Save confirmations |
| Unlock narration | What opened because of action |
| Proportional celebration | Brief, substantive |

**Avoid:** Silent dismiss · unskippable cinema blocking next urgent step · empty gamification.

---

## Phase 6 — Ownership

**Feeling:** *“This reflects my real situation.”*

| Design levers | Target |
|---------------|--------|
| Editable facts | Profile correction |
| Visible persistence | Return visits show their data |
| Cross-domain sync | Change propagates honestly |

**Avoid:** Partial saves without disclosure · contradictory modules.

---

## Phase 7 — Independence

**Feeling:** *“I can navigate without hand-holding.”*

| Design levers | Target |
|---------------|--------|
| Fading guide intensity | Not removal |
| Stable map literacy | User reads locks and routes |
| Optional depth | Scenarios, optimization on demand |

**Avoid:** Forcing guide forever · removing structure when guide fades.

---

## Negative emotions we must never cause

| Emotion | Typical cause | Prevention |
|---------|---------------|------------|
| **Betrayal** | Silent reset, false auth | Honest messaging |
| **Shame** | “Error: invalid user” | Neutral, instructional copy |
| **Helplessness** | Dead ends | Recovery CTAs |
| **Foolishness** | Unexplained locks | Prerequisite teaching |
| **Overwhelm** | Stacked overlays | One overlay rule |
| **Infantilization** | Excessive cheer | Dignified tone |

---

## Crisis emotional mode

When user enters via crisis (job loss, benefit denial, eviction):

| Normal curve | Crisis curve |
|--------------|--------------|
| Curiosity → Safety → … | Safety → Confidence (compressed) |
| Exploration welcome | **No** |
| Cinematic celebration | **Skip** |
| Marketing home | **Bypass** |

Crisis mode is not a skin. It is **behavioral prioritization**.

---

## Measuring emotional success

Qualitative:

- “I felt less lost.”
- “I knew what to do.”
- “I trust this more than random Google results.”

Quantitative proxies:

- Time to first meaningful action
- Return rate within 7 days
- Correction completion rate
- Support ticket themes (confusion vs trust)

---

## Related documents

- [product-personality.md](./product-personality.md) — how voice delivers emotion
- [onboarding-philosophy.md](./onboarding-philosophy.md) — first-run emotional design
