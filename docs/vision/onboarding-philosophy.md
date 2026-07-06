---
id: onboarding-philosophy
title: Onboarding Philosophy
project: Arrival Atlas
system: Arrival Atlas
type: vision
domain: product
status: active
maturity: canonical
owner: design
tags:
  - onboarding
  - first-run
  - activation
created: 2026-07-06
updated: 2026-07-06
related:
  - mental-model
  - journey-guide-philosophy
  - emotional-design
---

# Onboarding Philosophy

**Do not optimize the current onboarding. Design the ideal.**

Current v1 patterns (marketing deck, demo entry, mode election, stacked overlays) are **anti-patterns** relative to this document.

---

## Onboarding is not introduction

Onboarding is **the shortest path from panic to one safe action**.

It is not:

- A product tour  
- A brand video  
- A feature slideshow  
- An account creation funnel  

---

## Ideal first session (stressed immigrant, Germany, day 1)

### Step 0 — Language (5 seconds)

**Before anything else:**

> “Which language do you want to use?”  
> [ Deutsch ] [ English ] [ Русский ] [ Українська ]

No other content until chosen. `lang` attribute updates immediately.

**v1 violation:** Language picker unreachable.

---

### Step 1 — Safety (10 seconds)

Single screen:

> **This is private guidance — not a government website.**  
> Your answers stay on this device until you choose to save them.  
> We help you see what to do next in Germany.

[ Continue ]

No map yet. No choices. **Trust first.**

---

### Step 2 — Problem intake (30 seconds)

One question — not a form wall:

> **What do you need help with right now?**

| Option | Routes internally |
|--------|-------------------|
| I just arrived | Registration path |
| I need to register my address | Anmeldung path |
| I lost my job / income | Economic crisis path |
| I need health insurance | Coverage path |
| I can't pay rent | Housing + benefits path |
| I'm not sure — show my situation | Situation map path |

**No module names.** Problem language only.

---

### Step 3 — Minimum facts (60 seconds, only if needed)

Ask **only** fields required for the chosen path — max 3–5 questions.

Each field shows: *“We ask because {reason}”*

Skip allowed with honest consequence: *“We can still show the map, but recommendations will be limited.”*

**Never block the entire map** before user sees value.

---

### Step 4 — First map view (30 seconds)

User sees **their** sky — already centered on their problem:

- One highlighted next step (large, plain language)  
- Map as evidence (secondary)  
- Guide speaks one sentence + one button  

**No mode election.** Guide is on by default.

---

### Step 5 — First action (5–10 minutes)

User completes **one real step** — or records one real fact.

Confirmation:

> “Done. {Concrete unlock}. Your next step is {Y}.”

**Session success = one closed loop.**

---

## What we deliberately omit from onboarding

| Omitted | Why |
|---------|-----|
| Six-slide marketing carousel | Delays help |
| “Enter Atlas” without meaning | False metaphor |
| Guided vs Independent choice | Choice before value |
| Full profile upfront | Interrogation |
| Account creation | Not needed for first trust |
| Feature map of all modules | IA is our problem, not user's |

---

## Returning user onboarding

**No re-onboarding.**

Return user sees:

- Updated situation map  
- Changed nodes if facts changed  
- One new recommendation if state shifted  

Optional: *“Welcome back — you completed X. Next is Y.”*

---

## Crisis onboarding variant

Skip marketing and map beauty entirely:

```
You said: I lost my job.

Next safe step:
Apply for unemployment registration at the Jobcenter.
[ Why this / What you'll need / Start ]

Your other concerns are saved — we'll return to them.
```

One screen. One action. Map collapsed behind “See full picture.”

---

## Onboarding success criteria

| Metric | Target |
|--------|--------|
| Time to first recommendation | < 90 seconds |
| Time to first completed action | < 15 minutes |
| Overlay count at once | **1** |
| User can articulate next step aloud | Yes |
| “I felt lost” rate in testing | < 10% |

---

## Relationship to Journey Guide

Onboarding **is** the Guide for session 1.

By session 3, onboarding dissolves into standing Guide behavior.

No separate “onboarding product.”

---

## v1 → vision migration (preserving engineering)

Engineering investments preserved:

- Galaxy graph engine  
- Journey Guide provider  
- Profile mutation pipeline  
- Module orchestration  

UX replaced incrementally:

| v1 | Vision direction |
|----|------------------|
| Guest marketing home | Problem intake entry |
| Member slider | Optional “Understand the big picture” depth |
| Enter Atlas demo flag | Honest “Start private preview” |
| Welcome modal | Default guided — no election |
| Cold-start intake overlay | Inline minimum facts in flow |

---

## Related documents

- [mental-model.md](./mental-model.md)
- [cognitive-load-rules.md](./cognitive-load-rules.md)
- [emotional-design.md](./emotional-design.md)
