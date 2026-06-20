---
id: profile-ux-spec
title: Profile UX Design Specification
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
  - situation-summary
created: 2026-06-01
updated: 2026-06-19
related:
  - ux-contract-v1
  - ux-contract-v2
  - profile-mutation-model-v1
  - profile-ux-design-prompt
  - profile-ux-discovery
  - profile-system-v1-roadmap
---

# Profile UX Design Specification v1

**Document type:** UX Design Specification (Discovery → Design)  
**System:** Arrival Atlas  
**Date:** 2026-06-18  
**Status:** Design spec — no implementation  
**Inputs:** [profile-ux-discovery-audit.md](../identity/profile-ux-discovery.md), [profile-system-v1-roadmap.md](../identity/profile-system-v1-roadmap.md), current `apps/web` UI

**Scope:** Product and interaction design only. No code, APIs, backend architecture, or implementation plan.

---

## 1. Executive UX Summary

Profile System v1 UX introduces **"Your situation in Germany"** — a user-facing integration dossier that mirrors facts gathered through modules, orients newcomers toward the next useful action, and allows corrections without re-running tools.

**How Profile should feel:**

| Feels like | Does not feel like |
|------------|-------------------|
| A personal situation summary for life in Germany | A CRM contact record |
| A mirror of what modules learned | A registration form before you can do anything |
| A checklist companion during first weeks | A settings page buried in the app |
| A place to fix mistakes safely | A database admin panel |

**UX model (final):** **Module-first capture · Profile-as-mirror · Onboarding-as-checklist**

**Primary user promise:**

> *"Arrival Atlas remembers what helps you decide — and shows you clearly what it knows, what's missing, and what to do next."*

**Design north star:** Profile exists to **support decisions**, not to manage identity.

---

## 2. Current UX Surface Analysis (Code Reality)

### 2.1 Where profile is exposed today

| Surface | File / component | Profile exposure | User-facing quality |
|---------|------------------|------------------|---------------------|
| **Home dashboard** | `HomeSnapshotRenderer.tsx` | Raw `profile` object rendered via `RecordFields` — keys as labels, nested objects as JSON strings | **Debug-like** — internal data shape visible |
| **Home — Session** | Same | Shows `session.language` in a "Session" card | **Debug-like** — not user language |
| **Home — FTU** | Same | Shows `ftu.isFirstTimeUser` boolean and `ftu.step` number | **Debug-like** — not onboarding UX |
| **Home — Modules** | Same | Category-grouped module cards (no profile dependency) | **Good** — contract-driven |
| **Home — Actions / signals** | Same | Snapshot action cards; shows `moduleId` slugs | **Mixed** — useful content, internal labels leak |
| **Home — Recent executions** | Same | Projections + explain toggle | **Good** — decision-focused |
| **Module forms** | `ContractModulePage.tsx` | `mergeProfileIntoDefaults(schemaDefaults, uiSnapshot?.profile)` — silent prefill | **Implicit** — user not told data came from profile |
| **Module results** | `ModuleExecutionPanel.tsx` | No profile reference | N/A |
| **Explain panel** | `ExplainPanel.tsx` | May show factors labeled "Your situation" (`context` type) — profile-derived at API level | **Implicit** — good direction, not linked to Profile |
| **Header** | `Header.tsx` | Language buttons, theme toggle — session prefs | **Good** — correct placement for chrome prefs |
| **Profile route** | — | **Does not exist** | **Missing** — no `/profile` or equivalent |

### 2.2 Where profile is implicit (user cannot see the connection)

| Behavior | Mechanism | User awareness |
|----------|-----------|----------------|
| Form prefill | `mergeProfileIntoDefaults` on module load | **None** — fields may appear filled with no explanation |
| Profile activation on execute | Server-side after `financial-reality`, `healthcare-navigation` | **None** — no "saved to your situation" feedback |
| Partial module state | `getModuleUIState` returns `partial` when `snapshot.profile` exists but no execution | **Invisible** — status not surfaced in UI |
| Explain factors from profile | Explain API / reason mapping | **Partial** — "Your situation" label only |
| FTU heuristic | Snapshot projection when no profile + no executions | **Opaque** — boolean display only |

### 2.3 Duplication and confusion

| Issue | Manifestation | User impact |
|-------|---------------|-------------|
| **Dual language** | Header language vs `profile.preferredLanguage` (snapshot) | User may not know which is authoritative |
| **Prefs vs profile** | Theme in header/session; domain facts in profile document | Correct split, but no unified "Your situation" concept |
| **Profile on Home vs nowhere else** | Raw dump on Home only; no dedicated Profile | Users see ugly data once, cannot edit or understand it |
| **Internal naming on Home** | "Attention layer", "Priority signals", `moduleId` in cards | Product vocabulary mixed with engineering vocabulary |
| **Session card on Home** | Exposes session mechanics | Feels like a dev dashboard, not newcomer home |
| **No save feedback** | Module execute refreshes snapshot silently | User doesn't know profile updated |
| **Prefill mismatch** | Shallow merge — nested profile may not fill flat schema fields | Prefill appears broken; erodes trust |

### 2.4 Alignment gap vs discovery model

| Discovery principle | Current UX | Gap |
|--------------------|------------|-----|
| Module-first capture | Modules work; no profile feedback loop | **Missing save confirmation + mirror** |
| Profile-as-mirror | Raw JSON on Home | **Wrong presentation entirely** |
| Onboarding checklist | FTU boolean display | **No checklist UX** |
| Domain-based IA | Flat key dump | **No domains** |
| No bureaucratic form feeling | Home shows schema keys | **Actively violates** |
| Decision-support clarity | Modules strong; profile absent | **Profile story missing** |

---

## 3. Current UX Problems (Prioritized)

### P0 — Must fix in v1 design

1. **No Profile destination** — users cannot intentionally review or correct their situation.
2. **Raw profile dump on Home** — exposes `employment`, `schemaVersion`, JSON blobs; reads as internal debug UI.
3. **No onboarding product** — FTU is a boolean, not a guided path for newcomers.
4. **Silent profile lifecycle** — prefill and save are invisible; users don't trust or understand the system.

### P1 — High impact

5. **No completeness concept** — users can't see what's missing for better guidance.
6. **No entry points** — Header has no "Your situation"; modules don't link to Profile.
7. **Internal vocabulary on Home** — "Session", "Attention layer", module slugs undermine newcomer trust.
8. **Correction path undefined** — wrong data requires re-running module or no path at all.

### P2 — Medium impact

9. **Suggested next step absent** — Home lists all modules equally; no orientation for partial profiles.
10. **Explain ↔ Profile disconnect** — explanations reference situation but Profile doesn't close the loop.
11. **Sensitive data on Home** — income/rent could appear in raw dump on shared screens.

---

## 4. Target UX Model (Final Vision)

### 4.1 Conceptual model (user mental map)

```text
┌─────────────────────────────────────────────────────────────┐
│                     Arrival Atlas                              │
├─────────────────────────────────────────────────────────────┤
│  HOME          →  orient · suggest · continue               │
│  MODULES       →  decide · act · learn (primary work)         │
│  YOUR SITUATION →  mirror · correct · track progress (Profile)│
│  HEADER        →  language · theme (quick prefs)              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Data flow (user-visible narrative)

```text
User fills module  →  "Saved to your situation"  →  Profile mirror updates
User opens Profile →  sees plain-language summary  →  edits if needed
User opens next module →  fewer questions prefilled  →  "Using saved information"
User returns later   →  Home shows progress + suggested next step
```

### 4.3 Profile positioning statement (copy-ready)

**Short:** *Your situation in Germany*  
**Supporting:** *A summary of what Arrival Atlas knows to help you decide — built from the tools you use, editable anytime.*

---

## 5. Information Architecture

### 5.1 Profile UX tree

```text
Your Situation (/profile)                          [Profile Home]
│
├── Overview                                       [default landing]
│     • One-line situation summary
│     • Domain status list (filled / needs attention / empty)
│     • Primary CTA: continue setup OR review section
│
├── Your move to Germany                           [domain section]
│     • Country of origin, residency status, time in Germany
│     • Preferred language (linked to header control)
│
├── Where you live                                 [domain section]
│     • City, Bundesland, monthly rent
│
├── Household & family                             [domain section]
│     • Household size, marital status, children
│
├── Work & income                                  [domain section]
│     • Employment status, gross income
│     • "More details" → tax class, church tax (collapsed)
│
├── Health insurance                               [domain section]
│     • Coverage type, enrolled yes/no
│
├── Benefits & support                             [domain section]
│     • Bürgergeld, ALG1, Wohngeld indicators
│     • Sensitive copy: "What you tell us helps estimate eligibility — not an application"
│
└── Language & display                             [prefs section]
      • Language (mirror + link to header)
      • Theme, reading comfort, explanation detail (brief / standard)
```

**Future (out of v1 UX spec scope):** *Your data & privacy* — export, delete, what's stored.

### 5.2 Navigation inside Profile

| Pattern | Behavior |
|---------|----------|
| **Landing** | Always Profile Home (Overview) |
| **Section list** | Vertical nav on desktop; stacked linked list on mobile |
| **Section detail** | Read view default; "Edit" enters edit mode for that section only |
| **Breadcrumb** | `Your situation › Work & income` |
| **Back** | Returns to Overview, not browser back stack confusion |

### 5.3 Entry points

| Source | Entry pattern | Label |
|--------|---------------|-------|
| **Home summary card** | Tap card → Profile Home | "Your situation" |
| **Home onboarding checklist** | Step links → Profile section OR starter module | "Add where you live" / "Try Financial Reality" |
| **Header drawer** | Nav item above module categories | "Your situation" |
| **Post-module success** | Inline link in confirmation | "Review what we saved" |
| **Module form helper** | Link on prefilled field group | "From your saved situation · Edit" |
| **Explain panel** | Optional link when context factors present | "See your saved situation" |

**Never:** Profile as mandatory gate before first module.

---

## 6. Screen-by-Screen UX Design

### 6.1 Home integration (redesigned)

**Purpose:** Orient and suggest — not expose raw state.

#### Layout order (top → bottom)

```text
1. Hero (existing — app title + subtitle)
2. [NEW] Welcome / onboarding card        (FTU / Partial Profile states only)
3. [NEW] Your situation summary card      (all states except brand-new empty)
4. [NEW] Suggested for you                (1–3 module cards, rules-based)
5. Priority actions                       (renamed from "Action cards" — user language)
6. Browse topics by category              (existing category module grid)
7. Recent results                         (existing executions)
```

#### Removed from Home (must not appear)

| Element | Reason |
|---------|--------|
| "Session" card with language string | Debug; language lives in header |
| "First-time experience" boolean | Replace with onboarding card |
| Raw "Profile" `RecordFields` dump | Replace with summary card |
| "Attention layer" label | Rename or merge into Priority actions |
| `moduleId` slugs on action cards | Show module **title** from catalog only |

#### A. Welcome / onboarding card

**Visible when:** `New User` or early `Partial Profile` (onboarding not dismissed)

```text
┌────────────────────────────────────────────────────┐
│ Getting oriented in Germany                         │
│ ░░░░░░░░░░░░░░░░░░░░  2 of 5                        │
│ ✓ Choose your language                              │
│ ✓ Try your first tool                               │
│ ○ Add where you live                                │
│ ○ Explore health insurance guidance                 │
│ ○ Review your situation summary                     │
│                                                     │
│ [Continue setup]                                    │
└────────────────────────────────────────────────────┘
```

**Rules:**
- Max 5 steps; plain language; each step links to module OR Profile section
- Dismissible after step 2 ("I'll explore on my own")
- No percentage gamification — step count only
- Completing a step auto-checks when profile/module event occurs

#### B. Your situation summary card

**Visible when:** Any profile domain has data OR user completed one module

```text
┌────────────────────────────────────────────────────┐
│ Your situation                                      │
│ Berlin · Employed · Household of 2                  │
│                                                     │
│ 4 areas help your tools work better                 │
│ 2 could use an update                               │
│                                                     │
│ [View your situation →]                             │
└────────────────────────────────────────────────────┘
```

**Empty state (New User, no modules yet):**

```text
┌────────────────────────────────────────────────────┐
│ Your situation                                      │
│ Arrival Atlas builds a summary as you use tools.    │
│ Nothing saved yet.                                  │
│ [Start with a tool below]                           │
└────────────────────────────────────────────────────┘
```

#### C. Suggested for you

**Rules-based (not ML), max 3 cards:**

| Condition | Suggestion |
|-----------|------------|
| No employment data | Financial Reality |
| No insurance data | Healthcare Navigation |
| Has finance, no benefits | Benefits Simulator |
| Recent life-event module interest | Life Event |
| Default | Highest-priority empty domain module |

Copy pattern: *"Based on what's missing from your situation"* — never *"We think you need..."*

---

### 6.2 Profile Home (Overview)

**Route concept:** `/profile` — label in UI: **"Your situation"**

```text
┌──────────────────────────────────────────────────────────────┐
│ Your situation in Germany                                     │
│ A summary built from the tools you use. Edit anything         │
│ that looks wrong.                                               │
├──────────────────────────────────────────────────────────────┤
│ AT A GLANCE                                                   │
│ Berlin · Employed · Public health insurance · Household of 2  │
├──────────────────────────────────────────────────────────────┤
│ WHAT HELPS YOUR TOOLS                                         │
│                                                               │
│ ✓  Your move to Germany          Complete                     │
│ ✓  Where you live                Complete                     │
│ ◐  Work & income                 Missing employment status    │
│ ○  Health insurance              Not added yet                │
│ ○  Benefits & support            Not added yet                │
│ ✓  Household & family            Complete                     │
│                                                               │
│ ◐ = needs attention (empty or stale)                          │
├──────────────────────────────────────────────────────────────┤
│ [Edit a section ▾]                                            │
│                                                               │
│ Language & display →                                          │
└──────────────────────────────────────────────────────────────┘
```

**Completeness rules (UX, not scoring):**
- Per-domain status: **Complete** | **Needs attention** | **Not added yet**
- No global percentage badge as primary element
- Optional subtle line: *"4 of 6 areas filled"* — secondary text only
- Each row taps through to section detail

**What user sees first:** Human summary line + domain list — not forms.

---

### 6.3 Profile Section View (read mode)

**Example: Work & income**

```text
┌──────────────────────────────────────────────────────────────┐
│ ← Your situation    Work & income                             │
├──────────────────────────────────────────────────────────────┤
│ Employment status      Employed                               │
│ Gross monthly income   €2,500                                 │
│                                                               │
│ ▸ More details (tax class, church tax)                        │
│                                                               │
│ ─────────────────────────────────────────────────────────── │
│ Last updated when you used Financial Reality · 3 days ago     │
│ [Edit this section]                                           │
└──────────────────────────────────────────────────────────────┘
```

#### Empty state (section)

```text
┌──────────────────────────────────────────────────────────────┐
│ Work & income                                                 │
│                                                               │
│ Nothing saved here yet.                                       │
│                                                               │
│ Financial Reality and Benefits Simulator use this to          │
│ estimate income, tax, and support options.                    │
│                                                               │
│ [Open Financial Reality]     [Add manually]                   │
└──────────────────────────────────────────────────────────────┘
```

**Empty state rules:**
- Always explain **why** the domain matters (which modules benefit)
- Primary CTA → relevant module (module-first)
- Secondary CTA → manual add (Profile edit)

#### Filled state metadata

- **Provenance line:** *"Last updated when you used [Module Title]"* OR *"You edited this"*
- Never show module IDs, revision numbers, or schema version to user

#### Sensitive domains (Work & income, Benefits)

- Show content only on Profile (not Home summary card details)
- Edit requires explicit tap — no inline edit on overview
- Benefits copy disclaimer on every view (see IA)

---

### 6.4 Edit Flow

**Pattern:** Section-scoped edit — not one giant form.

```text
Read mode  →  [Edit this section]  →  Edit mode  →  [Save] / [Cancel]
```

#### Edit mode behavior

| Rule | Detail |
|------|--------|
| Fields | Plain labels matching module vocabulary |
| Validation | Inline, human messages — not schema errors |
| Save | Explicit button; confirmation toast: *"Your situation was updated"* |
| Cancel | Discards; warn if dirty |
| Delete field | Clear to empty — not "null" display |
| Module link | After save: *"Your next [Module] visit will use this information"* |

#### Where correction should happen

| Scenario | Primary surface |
|----------|-----------------|
| Wrong rent after move | **Profile** → Where you live |
| Wrong result because wrong input this run | **Re-run module** with corrected input |
| Scenario / what-if (proposed income) | **Module only** — never Profile |
| Language preference | **Header** (Profile mirrors) |
| Theme | **Header** (Profile prefs section mirrors) |

**Propagation (user-visible narrative):**
- Profile edit → next module prefill updates → optional Home summary refresh
- Module execute → profile activation → toast + Profile section updates
- User never needs to understand sync mechanics — always show outcome

---

### 6.5 Onboarding Flow

**Trigger:** First visit OR `ftu.isFirstTimeUser` equivalent.

#### Step 0 — Already exists

User lands on Home; language available in header.

#### Step 1 — Optional micro-intro (modal or inline card)

```text
Welcome to Arrival Atlas

We help you decide what to do next in Germany —
insurance, benefits, finances, and more.

As you use tools, we build a private summary of your
situation so you don't repeat the same questions.

[Choose a first tool]    [See how it works]
```

*"See how it works"* → 3-slide explainer: Modules decide · Situation saves · You stay in control

#### Step 2 — First module (required for value)

- Suggest **one** module based on optional 2-question seed (city + employment status) OR default Financial Reality / Healthcare based on seed
- **No profile form before this**

#### Step 3 — Post-first-execute confirmation

```text
┌────────────────────────────────────────────────────┐
│ ✓ Saved to your situation                           │
│                                                     │
│ We remembered your [rent / employment / city]       │
│ so other tools can use it later.                    │
│                                                     │
│ [View your situation]    [Continue]                 │
└────────────────────────────────────────────────────┘
```

**First appearance of Profile concept** — after value delivered, not before.

#### Step 4 — Home checklist active

Onboarding card tracks progress until dismissed or 5 steps complete.

---

### 6.6 Module flow integration

#### Form prefill (ContractModulePage behavior — UX spec)

When defaults come from profile:

```text
┌─────────────────────────────────────────┐
│ Using information from your situation    │
│ [Review or edit]                         │
├─────────────────────────────────────────┤
│ Gross monthly income                     │
│ [ 2500          ]                        │
│ ...                                      │
└─────────────────────────────────────────┘
```

- Banner appears once per module visit when any field prefilled
- "Review or edit" → Profile section OR inline acknowledge
- User can override prefilled values without visiting Profile

#### Post-submit

- Success → existing result panel + **save toast** (if activation occurred)
- No blocking redirect to Profile

#### Explain integration

When explanation includes situation factors:

```text
Your situation
• Gross income: €2,500 (Your situation)
• Household size: 2 (Your situation)

[View your situation]
```

---

### 6.7 Header integration

Add to drawer navigation (above category groups):

```text
Menu
──────────────────
🏠  Your situation          → /profile
──────────────────
FINANCE
  Financial Reality
  ...
```

Language + theme remain in drawer footer — **not** duplicated as primary Profile workflow.

---

## 7. Profile UX States (Lifecycle)

### State definitions

| State | Criteria (user-visible) |
|-------|------------------------|
| **New User** | No profile domains filled; no module executions |
| **Partial Profile** | 1–2 domains filled OR one module used |
| **Useful Profile** | 3+ domains filled OR 2+ modules used with overlapping data |
| **Maintained Profile** | Useful profile + user has edited OR 30+ days since creation; onboarding dismissed |

---

### New User

| Surface | What user sees | System priority |
|---------|----------------|-----------------|
| **Home** | Hero + onboarding card (step 1: language ✓) + empty situation card + category modules | **Orient → first module** |
| **Profile** | Empty Overview; all domains "Not added yet"; CTA to first module | Invitation, not form |
| **Modules** | No prefill banner | Full module experience |
| **Header** | Language prominent | Accessibility first |

---

### Partial Profile

| Surface | What user sees | System priority |
|---------|----------------|-----------------|
| **Home** | Onboarding card (2–4 steps) + situation summary (partial line) + suggested module | **Continue setup** |
| **Profile** | Mix of Complete / Not added; provenance from first module | **Transparency** |
| **Modules** | Prefill banner on relevant modules | **Reduce re-entry** |
| **Post-execute** | Save toast every time activation writes | **Trust building** |

---

### Useful Profile

| Surface | What user sees | System priority |
|---------|----------------|-----------------|
| **Home** | Rich summary card + suggestions for remaining gaps + priority actions | **Decision support** |
| **Profile** | Mostly Complete domains; edit available | **Mirror + light maintenance** |
| **Modules** | Strong prefill; fewer questions | **Efficiency** |
| **Onboarding** | Dismissed or completed | Stability |

---

### Maintained Profile

| Surface | What user sees | System priority |
|---------|----------------|-----------------|
| **Home** | Summary card; no onboarding; suggestions only for stale/empty domains | **Stability + gentle maintenance** |
| **Profile** | Staleness hints on 1–2 domains max: *"Has your employment changed?"* | **Correction** |
| **Modules** | Prefill; user may not visit Profile often | **Background continuity** |

---

## 8. UX Rules (Strict)

### 8.1 Profile IS allowed to

| # | Rule |
|---|------|
| R1 | Summarize domain facts in plain language |
| R2 | Show per-domain completeness status (Complete / Needs attention / Not added) |
| R3 | Let users edit domain facts with explicit save |
| R4 | Explain provenance (*"Saved from Financial Reality"*) |
| R5 | Link to relevant modules for empty domains |
| R6 | Mirror header language/theme in prefs section |
| R7 | Show sensitive data only inside Profile (not Home) |
| R8 | Provide onboarding checklist on Home (not inside Profile only) |
| R9 | Display staleness prompts as questions, not scores |
| R10 | Close the loop with Explain ("View your situation") |

### 8.2 Profile must NEVER

| # | Rule |
|---|------|
| N1 | Block module access until profile is complete |
| N2 | Show raw JSON, schema keys, `schemaVersion`, or internal IDs |
| N3 | Use gamification (points, badges, streaks, leaderboards) |
| N4 | Present a single long form with all domains |
| N5 | Use engine vocabulary (slice, policy, document, revision, activation) |
| N6 | Display `moduleId` slugs to users |
| N7 | Change module results or recommendations (read-only mirror) |
| N8 | Feel like account registration or identity verification |
| N9 | Require profile visit before first module |
| N10 | Show full income/benefits detail on Home dashboard |
| N11 | Auto-save edits without confirmation |
| N12 | Imply legal status determination (*"You qualify for Bürgergeld"*) — guidance only |

### 8.3 Belongs in modules (not Profile)

| Content | Why |
|---------|-----|
| Scenario inputs (what-if income, event timeline) | Decision context, not persistent facts |
| Module-specific recommendations and actions | Output of execution |
| Explain reasoning detail | Module/explain surface |
| Institution-specific step-by-step plans | Module output (e.g. Life Event phases) |
| First-time deep questions for a domain | Module form (Profile captures result) |

### 8.4 Belongs in session/header (not Profile domains)

| Content | Why |
|---------|-----|
| Theme (light/dark/system) | UI chrome |
| Active session language control | Frequent toggle |
| Explanation depth preference (v1) | Presentation pref — can mirror in Profile |
| Auth token / session ID | Never user-visible |

### 8.5 Read-only vs editable (user view)

| Domain / field | Read-only | Editable in Profile |
|----------------|-----------|---------------------|
| Module recommendation text | ✓ | |
| Execution results | ✓ | |
| Explain factors | ✓ | |
| Employment, housing, insurance, etc. | | ✓ |
| Preferred language | Mirror | ✓ (syncs header) |
| Theme | Mirror | ✓ (syncs header) |
| Provenance / last updated source | ✓ | |
| Completeness status | ✓ (computed) | |
| Scenario parameters | ✓ in Profile | Edit in module |

---

## 9. User Journey Map

### Journey 1 — First-time newcomer

| Step | User action | System response | Touchpoint |
|------|-------------|-----------------|------------|
| 1 | Opens app | Home + onboarding card | Home |
| 2 | Sets language in header | UI translates | Header |
| 3 | Opens Financial Reality from suggestion | Module form (empty or minimal prefill) | Module |
| 4 | Fills income, rent; submits | Results + explain + save toast | Module |
| 5 | Taps "View your situation" | Profile Home with Work + Housing filled | Profile |
| 6 | Returns Home | Summary card + checklist progress | Home |
| 7 | Opens Healthcare | Prefill banner; insurance fields filled if available | Module |

**Emotional arc:** Curious → helped → trusting → efficient

---

### Journey 2 — Correction after mistake

| Step | User action | System response | Touchpoint |
|------|-------------|-----------------|------------|
| 1 | Notices wrong rent in module result explain factor | — | Module |
| 2 | Opens Profile → Where you live | Shows old rent + provenance | Profile |
| 3 | Edits rent; saves | Confirmation toast | Profile |
| 4 | Re-runs Financial Reality | Updated prefill; new results | Module |

**Emotional arc:** Concerned → in control → confident

---

### Journey 3 — Return after 3 weeks

| Step | User action | System response | Touchpoint |
|------|-------------|-----------------|------------|
| 1 | Opens app | Home summary + optional staleness hint on Profile | Home |
| 2 | Sees "Has your employment changed?" | Tap → Work & income section | Profile |
| 3 | Confirms or updates | Save | Profile |
| 4 | Continues to Benefits Simulator | Prefill active | Module |

**Emotional arc:** Returning → oriented → productive

---

### Journey 4 — Profile-intentional visit

| Step | User action | System response | Touchpoint |
|------|-------------|-----------------|------------|
| 1 | Opens menu → Your situation | Profile Home | Profile |
| 2 | Reviews all domains | Status list | Profile |
| 3 | No edits needed | Leaves | — |

**Emotional arc:** Seeking transparency → satisfied

---

## 10. Risks & UX Failure Modes

| Risk | Failure mode | Prevention |
|------|--------------|------------|
| **Settings-page syndrome** | Profile becomes list of toggles and empty forms | Module-first capture; Overview before edit; domain empty states link to modules |
| **Bureaucratic mirror** | Profile looks like Meldebescheinigung form | Plain language IA; progressive disclosure; no all-in-one form |
| **Silent distrust** | Prefill/save without feedback | Banners, toasts, provenance lines |
| **Debug dashboard persists** | Home still shows session/JSON | Strict Home content rules (Section 6.1) |
| **Dual language confusion** | Header vs profile language differ | Single effective language; Profile mirrors header |
| **Overloaded Home** | Too many cards | Onboarding dismissible; max 3 suggestions |
| **Sensitive data exposure** | Income on Home lock screen | Summary card uses non-sensitive abstractions (*"Employed"*, not € amount) |
| **False legal certainty** | User thinks profile = official determination | Disclaimers on benefits/tax domains |
| **Orphan correction** | User edits Profile but module still shows old explain | Copy: *"Re-run [module] to refresh results"* after material edits |
| **Checklist fatigue** | 5 steps feel like homework | Dismiss after step 2; tie steps to real value |
| **Profile competing with modules** | Users fill Profile instead of using tools | Empty states primary CTA → module; manual add secondary |

---

## 11. Copy & Vocabulary Guide

### User-facing terms (use)

| Use | Avoid |
|-----|-------|
| Your situation | Profile, ProfileDocument, user profile |
| Your situation in Germany | Account, settings |
| Saved to your situation | Profile activation, persisted |
| Areas / domains | Fields, schema, slices |
| Tools | Modules (in user copy) |
| Complete / Needs attention / Not added yet | 67% complete, XP |
| Based on what's missing | AI recommends |
| Last updated when you used [Tool Name] | mutation, revision |

### Home section renames

| Current (code) | Target (user) |
|----------------|---------------|
| Session | *(remove)* |
| First-time experience | Getting oriented in Germany |
| Profile | Your situation |
| Attention layer | *(merge into Priority actions or remove)* |
| Action cards | Priority actions |
| Priority signals | Important recommendations |
| Modules | Browse topics |
| Recent executions | Recent results |

---

## 12. v1 UX Scope Boundary

### In scope for Profile UX v1 design

- Profile Home + 6 domain sections + Language & display
- Home summary card + onboarding checklist
- Header entry point
- Module prefill banner + post-save toast
- Section edit flows
- Four lifecycle states
- Copy/vocabulary guide above

### Explicitly out of scope (UX)

- Account login / registration profile
- Document upload (visa, Meldebescheinigung)
- Export PDF for appointments
- Privacy center / delete all data
- Multi-user household accounts
- Persona selection onboarding paths
- Profile photo / display name
- Push notifications

---

## 13. Success Criteria (Design Validation)

The Profile UX v1 design is successful when:

1. **A newcomer can explain Profile in one sentence** — *"It remembers my situation for the tools."*
2. **No user-facing surface shows raw profile keys or JSON** — verified against Home + Profile mockups.
3. **Users can answer "what does Arrival Atlas know about me?"** without running a module.
4. **Users can fix wrong rent/income** without developer knowledge.
5. **First module can be completed without visiting Profile.**
6. **Profile and Modules have non-overlapping primary jobs** — modules decide; Profile mirrors.
7. **Home feels like a command center**, not a debug console.
8. **Copy passes newcomer test** — readable in EN/DE/RU/UA without bureaucratic jargon.

---

## 14. Relationship to Other Documents

| Document | Relationship |
|----------|--------------|
| [profile-ux-discovery-audit.md](../identity/profile-ux-discovery.md) | Discovery inputs — motivations, IA domains, hybrid model |
| [profile-system-v1-roadmap.md](../identity/profile-system-v1-roadmap.md) | Technical roadmap — this spec defines UX requirements for that work |
| [ui-architecture-audit.md](../audits/ui-architecture-audit.md) | Contract-driven UI constraints — Profile UI must use same patterns (no module-specific pages) |

**Handoff:** This spec is ready for wireframes, content design, and usability testing — then technical implementation per profile-system-v1-roadmap phases P1–P4.

---

**Document status:** UX Design Specification v1 complete — no implementation attached.
