---
id: arrival-welcome
title: Arrival Welcome — UX Primitive Specification
project: Arrival Atlas
system: Arrival Atlas
type: primitive
domain: product
status: draft
maturity: canonical
owner: design
tags:
  - onboarding
  - language
  - first-contact
  - trust
created: 2026-07-13
updated: 2026-07-13
related:
  - ../onboarding-philosophy.md
  - ../emotional-design.md
  - ../product-personality.md
  - ../ux-principles.md
  - ../cognitive-load-rules.md
---

# Arrival Welcome — UX Primitive Specification

**Behavioral design specification — not implementation.**

This primitive defines the first-contact trust layer that occurs **before** the user enters the deeper Atlas experience. It is not a Home redesign. It is not a fullscreen wizard. It is the emotional and linguistic handshake that makes everything downstream possible.

---

## Purpose

Establish trust, language, and orientation in the first 30 seconds — before the user is asked to understand the galaxy metaphor, module names, or product architecture.

---

## User Problem

A stressed newcomer arrives at Arrival Atlas and faces:

```
Open website
→ English landing
→ Understand Atlas metaphor
→ Find language
→ Enter Atlas
```

This order is wrong. The user needs to feel:

- "This product understands me"
- "I can use my own language"
- "This is made for my situation"
- "I know what happens next"

**Before** they are asked to understand complexity.

---

## Product Principles Supported

| Principle | How Arrival Welcome supports it |
|-----------|--------------------------------|
| **Calm before complexity** ([ux-principles.md](../ux-principles.md) §3) | Language and reassurance precede map and modules |
| **Language is infrastructure** (§14) | Language is visible at first contact, not buried in settings |
| **Honesty over comfort** (§12) | Plain preview framing — not government, not account |
| **Reduce uncertainty before adding information** (§4) | Answers "what is this?" in one sentence before features |
| **Design for the worst day** (§25) | Mobile-first, large targets, no hunt for settings |
| **Onboarding is not introduction** ([onboarding-philosophy.md](../onboarding-philosophy.md)) | Shortest path from arrival to one safe next step |

---

## Experience Goals

1. **Language first** — user reads in their language before any other commitment.
2. **Belonging** — user believes the product is for migrants like them.
3. **Clarity** — user understands what the product does in plain language.
4. **Forward motion** — user knows the single next action.
5. **No trap** — urgent access is never blocked by marketing or ceremony.

---

## First 30 Seconds Experience

| Seconds | User sees | User feels |
|---------|-----------|------------|
| 0–5 | Language choice (visible, prominent) | "I can use my language here" |
| 5–15 | Short reassurance in chosen language | "This is for me, not a government site" |
| 15–25 | One-line product purpose | "This helps me know what to do next in Germany" |
| 25–30 | One primary CTA | "I know what to do now" |

**Success:** User can state the next action aloud in their chosen language within 30 seconds.

---

## Information Hierarchy

Priority order (highest first):

1. **Language selection** — always visible on first visit
2. **Trust reassurance** — private guidance, not government, device-local preview
3. **Product purpose** — one sentence, problem-oriented
4. **Primary CTA** — single action to continue
5. **Secondary escape** — skip/defer only if it does not hide urgent paths

Everything else is deferred until after entry.

---

## States

### First visit

- Language unknown
- Welcome layer active
- Full hierarchy visible (language → reassurance → purpose → CTA)
- No galaxy metaphor explanation required

### Language not detected

- Browser locale not in supported set, or detection unavailable
- Show all four supported languages with equal weight
- No default pre-selection that could mislead
- Prompt: neutral invitation to choose

### Language detected

- Browser locale matches DE / UA / RU / EN
- Suggest detected language visually (highlight, "Suggested for you")
- Manual override always available — never auto-apply without user confirmation on first visit
- Other languages remain one tap away

### Language selected

- UI re-renders in chosen language immediately (`lang` attribute updates)
- Welcome copy personalizes to selected language
- Preference persisted (session + durable storage per existing i18n contract)
- User proceeds to trust reassurance + CTA

### Returning user

- Saved language preference exists
- Welcome friction bypassed (no language re-election unless user requests)
- Optional brief "Welcome back" — max one line, no replay of full welcome
- Resume previous context (demo state, last lens, or home as appropriate)

---

## State Machine (First Session)

```text
New visitor:
  language unknown
    ↓
  language selected (or confirmed from suggestion)
    ↓
  welcome personalized
    ↓
  enter Atlas (existing flow — unchanged architecture)

Returning visitor:
  saved language
    ↓
  skip welcome friction
    ↓
  resume previous context
```

---

## Rules

### Must

- Language selection must **never** be hidden on first visit
- User must **never** search for language settings to begin
- Welcome must **not** block urgent access (crisis paths remain reachable)
- Supported languages: **German, Ukrainian, Russian, English**
- Browser language detection must suggest — not force
- Manual selection always available
- Preference must persist across sessions
- Welcome must be keyboard accessible and screen-reader understandable
- Mobile-first layout with large tap targets

### Must not

- No long onboarding before value
- No forced account creation
- No technical vocabulary ("session", "localization", "module")
- No bureaucratic language in first contact
- No product architecture explanation
- No fullscreen OS-style wizard
- No cinematic intro before language selection
- No heavy ambient animation on first paint
- No stacking with other blocking overlays (coordinates with E4 Orchestrator)

---

## Visual Concept

**Not** a fullscreen wizard. **Not** a modal chain.

Instead: a visible **"first light"** area integrated into Atlas — overlaid on or preceding the existing guest landing without replacing its visual identity.

Possible structure (conceptual only — do not treat as final UI):

```text
┌─────────────────────────────────────────┐
│  [Atlas brand — minimal]                │
│                                         │
│  Welcome message (in user's language)   │
│                                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │ DE  │ │ UA  │ │ RU  │ │ EN  │       │
│  └─────┘ └─────┘ └─────┘ └─────┘       │
│                                         │
│  Simple explanation (one sentence)      │
│                                         │
│  [ Primary CTA — one action ]           │
│                                         │
│  (existing star map / ambient — dimmed) │
└─────────────────────────────────────────┘
```

The galaxy assets remain visible as atmosphere — not as the first cognitive task.

---

## Motion Rules

Aligned with [interaction-principles.md](../interaction-principles.md) and [emotional-design.md](../emotional-design.md):

| Rule | Requirement |
|------|-------------|
| Tone | Calm, welcoming |
| Duration | ≤300ms transitions; no staged reveal sequences |
| Ambient | No looping particles or orbit spin before language selection |
| Cinematic | None — no unlock-style animation on first contact |
| Reduced motion | Instant render, zero non-essential animation |
| Urgency | If user signals hurry (rapid interaction), collapse to language + CTA only |

---

## Copy Rules

**Voice:** Calm navigator ([product-personality.md](../product-personality.md))

| Good | Bad |
|------|-----|
| "Choose your language to start your journey." | "Configure localization preferences." |
| "This is private guidance — not a government website." | "Atlas session initialization." |
| "We help you see what to do next in Germany." | "Explore the dependency graph modules." |
| "Continue" | "Enter Atlas" (without context) |
| "Start preview" | "Log in" / "Sign up" |

**Constraints:**

- ≤60 words before first action ([cognitive-load-rules.md](../cognitive-load-rules.md) §6)
- 0 jargon without translation on first session
- 1 primary CTA per viewport

---

## Accessibility

| Requirement | Standard |
|-------------|----------|
| Keyboard | Full tab order: language options → primary CTA |
| Screen reader | Language buttons announce language name; `lang` updates on selection |
| Focus | Visible focus ring on all interactive elements |
| Tap targets | ≥44×44px on mobile |
| Contrast | WCAG AA minimum |
| Reduced motion | Honor `prefers-reduced-motion` — no entrance animations |
| Error | If language persistence fails, inline message — never silent fallback to English without notice |

---

## Integration Points (Architecture — Not Implementation)

| System | Relationship |
|--------|--------------|
| `BootstrapGate` | Welcome layer appears after bootstrap success, before guest home content |
| `AtlasGuestLanding` | Welcome overlays or precedes existing landing — does not replace |
| `AtlasHUD` | Gains persistent language access after first selection |
| `AppProvider` / `changeLanguage` | Reuses existing language mutation pipeline |
| `readStoredDisplayLanguage` | Reuses existing persistence keys |
| `JourneyGuideProvider` | Must not show welcome modal until E0 complete |
| E4 Orchestrator | Arrival Welcome is step 0 in first-session sequence |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time to language selection | < 5 seconds from first paint |
| Time to first CTA tap | < 30 seconds |
| Language picker search rate | 0% (must be visible, not hunted) |
| First-visit bounce before language | Baseline → reduce 30% |
| "I felt this was for me" (usability test) | ≥ 80% agree |

---

## Out of Scope (This Primitive)

- Home slider redesign (E7)
- Problem intake flow (E7 + onboarding philosophy)
- Journey Guide mode election removal (E5)
- Full guide localization (E8)
- React components, routes, or code changes

---

## Related Documents

- [onboarding-philosophy.md](../onboarding-philosophy.md) — ideal first session (Step 0 = language)
- [implementation-roadmap.md](../implementation-roadmap.md) — Phase 0
- [ux-migration-backlog.md](../ux-migration-backlog.md) — E0 epic
- [ux-cognition-audit-immigrant-persona.md](../../audits/ux-cognition-audit-immigrant-persona.md) — P0-3 language picker evidence
