---
id: profile-ux-design-prompt
title: Profile UX Design Prompt v1
project: Arrival Atlas
system: Arrival Atlas
type: ux
domain: identity
status: active
maturity: stable
owner: system
tags:
  - profile-mirror
  - onboarding-ux
  - design-brief
  - situation-summary
created: 2026-06-19
updated: 2026-06-19
related:
  - profile-ux-spec
  - profile-ux-discovery
  - profile-system-v1-roadmap
---

# Profile UX Design Prompt v1

**Role:** Senior UX architect and product designer on Arrival Atlas — a decision-support system for newcomers in Germany.

**Task:** Design and evaluate the Profile system UX, called **"Your situation in Germany"**.

This is not a settings page and not a user account. It is a **living integration dossier** that mirrors user data collected through modules and helps users:

- understand what the system knows about them
- see what is missing
- correct incorrect information
- reduce repetition in future modules
- understand what to do next

---

## Core Product Principle (Non-negotiable)

**Profile exists to support decisions, not to manage identity.**

**UX model:**

```text
Module-first capture → Profile-as-mirror → Onboarding-as-checklist
```

- Modules are the primary interaction surface
- Profile is a secondary reflective layer
- Onboarding is lightweight and action-driven (not form-driven)

---

## Target User Context

Users are newcomers to Germany dealing with bureaucracy (Jobcenter, Krankenkasse, housing, taxes). They are cognitively overloaded, time-constrained, and often non-native German speakers.

Design must prioritize:

| Priority | Over |
|----------|------|
| Clarity | Completeness |
| Action | Data entry |
| Trust | Abstraction |
| Explanation | Hidden automation |

---

## What Profile MUST DO

- Show a plain-language summary of the user's situation
- Reflect data gathered from modules automatically
- Allow safe correction of incorrect data
- Show what is missing and what it affects
- Reduce repetition in future module usage
- Provide onboarding progress guidance
- Serve as a trusted mirror of system knowledge

---

## What Profile MUST NOT DO

Do **not** design Profile as:

- a registration form
- a CRM/contact system
- a settings page
- a gamified progress system
- a data schema viewer
- a backend debug panel

Avoid:

- raw JSON or internal field names
- module IDs or technical vocabulary
- forcing users to complete profile before using modules
- opaque "AI personalization"
- global completion scores as primary metric
- identity/social features (avatars, bios, networking)

---

## UX Architecture — Profile Sections

| Section | Purpose |
|---------|---------|
| **Your situation in Germany** | Page title / overview — not a data domain |
| **Location & housing** | City, Bundesland, rent, residency context |
| **Household & family** | Household size, partner, children |
| **Work & income** | Employment status, gross income, tax context |
| **Health insurance** | Coverage type, enrollment status |
| **Benefits & support** | Bürgergeld, ALG, Wohngeld indicators |
| **Language & display** | Language, theme, reading preferences |

Each section must:

- use plain language
- show readable values (not schema fields)
- include edit capability
- explain why the data matters (linked modules)

---

## Key UX Behaviors

### 1. Module-first capture

- Users enter data inside modules
- Profile updates implicitly after module execution
- Profile is never required before first module use

### 2. Profile-as-mirror

Profile must always:

- reflect module-collected data
- show "last updated from [Module Title]"
- allow edits without re-running modules

### 3. Onboarding-as-checklist (Home UX)

- lightweight onboarding card
- max 5 steps
- steps link to modules or profile sections
- dismissible after early engagement

### 4. Completeness model (critical constraint)

Do **not** use gamification. Use per-domain status only:

| Status | Meaning |
|--------|---------|
| **Complete** | Enough data for linked modules |
| **Needs attention** | Stale, inconsistent, or partial |
| **Not added yet** | No data; module can fill it |

No global score as primary element.

### 5. Home dashboard integration

**Home must show:**

- human-readable "Your situation" summary card
- onboarding checklist (if early stage)
- 1–3 suggested modules based on missing domains
- priority actions
- recent results

**Home must NOT show:**

- raw profile objects
- session/debug information
- internal IDs
- schema keys

---

## Lifecycle States

| State | Characteristics |
|-------|-----------------|
| **1. New User** | No profile data; onboarding visible; first module encouraged |
| **2. Partial Profile** | Some domains filled; checklist active; suggestions by missing data |
| **3. Useful Profile** | Multiple domains filled; strong prefill; decision-support mirror |
| **4. Maintained Profile** | Stable users; staleness prompts on key domains only; correction + continuity |

---

## Critical UX Rules

**Profile IS allowed to:**

- summarize situation in plain language
- show domain completeness
- show provenance ("from Financial Reality")
- allow edits per section
- link to modules for missing data

**Profile IS NOT allowed to:**

- block module usage
- act as onboarding gate
- show raw data structures
- contain scenario inputs (what-if values)
- change module logic or recommendations

---

## Core User Promise

> *"Arrival Atlas remembers what helps you decide — and shows you clearly what it knows, what's missing, and what to do next."*

---

## Design Goals

A successful Profile UX:

- is understandable in 5 seconds by a newcomer
- does not feel like bureaucracy
- reduces repeated form filling
- increases trust in system memory
- clearly separates: **modules = decisions**, **profile = memory mirror**

---

## Output Expectations (Design Tasks)

When working with this prompt, produce:

- UX flows (not technical architecture)
- screen-level structure
- user-facing copy
- state transitions
- interaction rules
- navigation logic
- onboarding flows
- home + profile integration behavior

Do **not** produce: backend schema, API design, database models, implementation code.

---

## Optional Design Constraint (High Priority)

All UX must feel like:

> *"A helpful assistant remembering your life situation"*

NOT:

> *"A system managing your user record"*

---

## Related Documents

| Document | Role |
|----------|------|
| [profile-ux-discovery.md](./profile-ux-discovery.md) | Research inputs |
| [profile-ux-spec.md](./profile-ux-spec.md) | Full screen-level design spec |
| [profile-system-v1-roadmap.md](./profile-system-v1-roadmap.md) | Technical delivery roadmap |
