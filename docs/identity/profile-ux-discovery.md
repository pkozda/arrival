---
id: profile-ux-discovery
title: Profile UX Discovery Audit
project: Arrival Atlas
system: Arrival Atlas
type: research
domain: identity
status: active
maturity: stable
owner: system
tags:
  - profile-mirror
  - user-motivation
  - hybrid-model
created: 2026-06-01
updated: 2026-06-19
related:
  - profile-ux-spec
---

# Profile UX Discovery Audit

**Mode:** Read-only UX + Product Architecture Research  
**Scope:** Entire Arrival Atlas platform  
**System:** Arrival Atlas  
**Date:** 2026-06-18  
**Status:** Product discovery — no implementation proposed

**Related:** [../identity/profile-system-v1-roadmap.md](../identity/profile-system-v1-roadmap.md) (technical architecture), [../audits/ui-architecture-audit.md](../audits/ui-architecture-audit.md) (contract-driven UI)

---

## Executive Summary

Arrival Atlas helps **newcomers navigate life in Germany** — Jobcenter, Krankenkasse, Finanzamt, housing, benefits — through modular decision support, not generic SaaS profile management.

The Profile experience should **not** feel like a settings page or CRM contact record. It should feel like a **personal integration dossier**: a living summary of the user's situation in Germany that **reduces repeated bureaucracy** and **orients them toward the next meaningful action**.

**Core UX thesis:**

> Users come to Arrival Atlas to **decide what to do next**, not to **manage a database of themselves**.  
> Profile exists to **support decisions**, not to become the primary product surface.

**Recommended model:** **Hybrid (Module-first capture, Profile as mirror)** — users primarily interact through modules; Profile is the **trusted summary, completeness guide, and preference hub** they open when they want orientation, correction, or continuity.

---

## Part 1 — User Motivation

### Product context

Arrival Atlas users are typically:

- Recent or prospective arrivals in Germany
- Navigating unfamiliar institutions in a second language
- Facing overlapping domains (registration, work, insurance, benefits, housing)
- Anxious about mistakes with legal or financial consequences
- Time-constrained and cognitively overloaded

Profile motivations must be evaluated against this context — not against generic app account patterns.

### Motivation inventory

| # | Motivation | User goal | Expected outcome | Frequency | Value |
|---|------------|-----------|------------------|-----------|-------|
| M1 | **Avoid re-entering the same facts** | Run another module without repeating income, rent, household size | Forms pre-filled; faster second module | High (every new module) | High — direct time savings |
| M2 | **Understand "what the system knows about me"** | See a plain-language summary of stored situation | Confidence, transparency, trust | Medium (after first module) | High — reduces black-box anxiety |
| M3 | **Correct a mistake** | Fix wrong income, city, insurance status | Updated summary; better future module defaults | Medium (when life changes or error noticed) | High — prevents bad guidance |
| M4 | **Track onboarding progress** | Know what setup steps remain for life in DE | Clear checklist; reduced overwhelm | High (first 2–4 weeks) | Very high for newcomers |
| M5 | **Set language & reading comfort** | Use RU/UA/DE/EN consistently | All content in preferred language | High (first session); low ongoing | High — accessibility |
| M6 | **Set UI preferences** | Theme, density, explanation depth | Comfortable reading experience | Low | Medium — quality of life |
| M7 | **Prepare before a life event** | Job loss, move, marriage, visa renewal | Relevant modules surfaced; profile reflects new situation | Episodic (life transitions) | Very high at moment of need |
| M8 | **Verify imported / inferred data** | Confirm facts pulled from a prior module | Trust in cross-module consistency | Medium | High — "did Financial Reality save my rent?" |
| M9 | **See household context at a glance** | Partner, children, household size for benefits/housing | Quick orientation for family decisions | Low–medium | Medium–high for families |
| M10 | **Understand why modules ask certain questions** | Learn what data helps which decisions | Informed consent; less form abandonment | Medium (during modules) | High — aligns with explainability principle |
| M11 | **Personalize dashboard focus** | Prioritize finance vs healthcare vs daily life | Home reflects their current life phase | Low–medium | Medium |
| M12 | **Export or review for appointment** | Bring summary to Beratung, Jobcenter, Ausländerbehörde | Printable / readable situation summary | Episodic | High when preparing for appointments |
| M13 | **Manage privacy comfort** | Control what is stored vs ephemeral | Sense of safety with sensitive data | Low but critical | High for trust |
| M14 | **Resume after break** | Return weeks later and continue | Profile + onboarding state restore context | Medium | High — continuity |

### Motivations that are **weak or misleading** for Arrival Atlas

| Motivation | Why weak |
|------------|----------|
| "Complete my profile for completion's sake" | Gamification without action linkage feels bureaucratic — mirrors the systems users are trying to escape |
| "Browse all possible fields upfront" | Overwhelms newcomers; violates progressive disclosure |
| "Social profile / identity expression" | Wrong product category |
| "Connect with other users" | Out of scope |
| "Personalize recommendation algorithms" (opaque) | Conflicts with explainability principle unless tied to visible facts |

### Primary vs secondary entry reasons

**Primary (why users would intentionally open Profile):**

1. M2 — transparency ("what do you know about me?")
2. M3 — correction
3. M4 — onboarding progress
4. M1 — continuity across modules (often discovered indirectly)

**Secondary (Profile as supporting surface):**

- M5/M6 preferences (may live in header/settings shortcut instead of full Profile)
- M12 export (future)
- M13 privacy (future)

**Rare direct opens:**

- M9 household management as standalone — usually edited in context of a module

---

## Part 2 — User Journey Mapping

### 2.1 How profile creation starts

Arrival Atlas should support **three entry paths**, weighted differently:

| Path | Description | UX weight | When |
|------|-------------|-----------|------|
| **A. Module-first (primary)** | User opens a module (e.g. Financial Reality), fills form, profile activates on execute | **Default** | Most users |
| **B. Guided onboarding (secondary)** | Short welcome flow collects language + 2–3 high-leverage facts (city, employment status, household size) | **First session** | New users with no executions |
| **C. Explicit Profile (tertiary)** | User opens Profile to add/edit information directly | **Power users / corrections** | After trust established |

**Recommended start:** **B → A hybrid** — minimal onboarding seeds language and location; first module deepens domain facts; Profile reflects accumulated state.

Explicit Profile-first onboarding (long form before any module) is **misaligned** with Arrival Atlas goals — users want decisions, not data entry homework.

### 2.2 How profile evolves over time

```text
Session start
    → language/theme set (preferences)
    → optional mini-onboarding (3–5 questions)
    → first module execute
         → profile activation writes domain facts
    → second module
         → prefill from profile
         → may extend new domains
    → life event (job loss, move)
         → user updates via module OR Profile correction
    → profile enters "maintained" state
         → periodic stale prompts (gentle)
```

Profile is **event-driven**, not **schedule-driven**. Updates correlate with:

- Module executions
- Life events (user-initiated)
- Corrections (user-initiated)
- Time-based staleness prompts (system-initiated, low frequency)

### 2.3 Events that should update profile data

| Event | UX trigger | User awareness |
|-------|------------|----------------|
| Module execute with mappable input | Automatic activation | **Confirm subtly** — "Saved to your profile" toast or inline note |
| User edits field in Profile | Explicit save | Clear confirmation |
| Onboarding step completion | Guided flow | Progress indicator |
| Language change in header | Preference update | Immediate; may sync to profile language |
| Life Event module selection | Contextual enrichment | "Update your situation?" prompt if conflicting facts |

### 2.4 Information that becomes stale

| Domain | Staleness signal | Typical cadence |
|--------|------------------|-----------------|
| Employment / income | Job change, raise, unemployment | Months |
| Housing / rent | Move, rent increase | Months–years |
| Insurance status | GKV enrollment, job change | Months |
| Benefits receipt | New application, approval/denial | Weeks–months |
| Residency / visa | Renewal, status change | Months–years |
| Location (city/Bundesland) | Move | Rare but impactful |
| Household composition | Marriage, child, separation | Episodic |
| Children ages | Automatic age drift | Annually (low priority v1) |
| Language preference | User change | Stable |
| Days in Germany | Time-based | Auto-computable; stale if `arrivedAt` wrong |

**UX rule:** Staleness prompts should be **domain-specific and actionable** — "Has your employment status changed?" not "Your profile is 47% stale."

### 2.5 What should be editable

| Category | Editable in Profile? | Rationale |
|----------|---------------------|-----------|
| Language | Yes (prefs section) | User-owned chrome |
| Theme / UI density | Yes (prefs) | User-owned chrome |
| Location, residency | Yes | Foundational; low module frequency |
| Employment, income | Yes, with sensitivity notice | High impact; user must correct errors |
| Housing | Yes | Common correction after move |
| Insurance | Yes | Changes with employment |
| Benefits status | Yes, carefully worded | Legal sensitivity — confirm not claim |
| Household / children | Yes | Family context |
| Tax class, church tax | Yes (advanced section) | Expert users; optional |
| Module scenario inputs | **No** — stay module-local | "What-if" inputs are not profile facts |
| Derived/computed values | **No** — read-only in Profile | Net income, eligibility results belong to module outputs |

### 2.6 Lifecycle model

```text
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  New User   │ ──► │ Partial Profile │ ──► │ Useful Profile  │ ──► │ Maintained Profile│
└─────────────┘     └─────────────────┘     └─────────────────┘     └──────────────────┘
     │                      │                        │                        │
  Language set          1–2 domains            3+ domains overlap       User trusts mirror
  FTU active            First module done      Multi-module prefill     Gentle stale prompts
  No domain facts       Onboarding checklist   Completeness meaningful  Corrections rare
```

| Stage | User mental model | Profile UX role |
|-------|-------------------|-----------------|
| **New User** | "I'm exploring" | Onboarding checklist; almost empty mirror; no guilt |
| **Partial Profile** | "I've tried one tool" | Show what was saved; suggest next module |
| **Useful Profile** | "It remembers me" | Summary card; cross-module prefill visible |
| **Maintained Profile** | "My situation tracker" | Correction + staleness; export (future) |

---

## Part 3 — Profile Information Architecture

### UX grouping (not backend schema)

Profile UI should use **user-meaningful chapters**, aligned with how newcomers think about life in Germany — not internal engine field names.

### Recommended top-level sections

| Section | UX label (user-facing) | Contains (conceptual) | User importance | Update frequency | Onboarding priority | Module relationships |
|---------|------------------------|----------------------|-----------------|------------------|----------------------|----------------------|
| **1. About your move** | "Your situation in Germany" | Country of origin, residency status, arrival timing, days in Germany, preferred language | Very high | Low | **P0** — first onboarding | Life Event, Benefits, Financial |
| **2. Where you live** | "Location & housing" | Bundesland, city, rent, utilities | High | Medium | **P1** | Financial Reality, Benefits, Grocery |
| **3. Household** | "Household & family" | Size, marital status, children | High | Low–medium | **P1** | Financial, Benefits, Life Event |
| **4. Work & income** | "Work & income" | Employment status, gross income, tax class | Very high | Medium | **P2** — sensitive; defer or soft ask | Financial Reality, Benefits |
| **5. Health coverage** | "Health insurance" | GKV/PKV/none, has coverage | High | Medium | **P2** | Healthcare Navigation |
| **6. Benefits & support** | "Benefits & support" | Bürgergeld, ALG1, Wohngeld, days thresholds | High | Medium | **P3** — after employment/housing context | Benefits Simulator, Financial |
| **7. Preferences** | "Language & display" | Language, theme, explanation depth, dashboard focus | Medium | Low | **P0** for language only | System Translation, all modules |
| **8. Privacy & data** | "Your data" (future) | What is stored, revision history summary, delete/export | Medium | Rare | **P4** | Trust layer |

### Sections to **not** expose as top-level in v1

| Avoid | Why |
|-------|-----|
| Raw JSON / technical field names | Breaks plain-language principle |
| "Extensions" bucket | Internal module storage — surface only in module context |
| Engine concepts (slice, policy, revision IDs) | Implementation leakage |
| Module scenario parameters | Not profile — confuses users |

### Navigation within Profile

```text
Profile Home (summary + completeness + quick actions)
    ├── Your situation in Germany
    ├── Location & housing
    ├── Household & family
    ├── Work & income
    ├── Health insurance
    ├── Benefits & support
    └── Language & display
```

**Progressive disclosure:** Advanced fields (tax class, church tax, utilities breakdown) collapsed under "More details" within each section.

### Alignment with module categories

| Module category (nav) | Primary profile sections |
|-----------------------|--------------------------|
| finance | Work & income, Location & housing |
| benefits | Benefits & support, Household, Your situation |
| healthcare | Health insurance, Location |
| daily-life | Location, Household |
| language | Preferences only |
| life-events | Your situation, all domains (event-dependent) |

This creates **conceptual consistency** between category navigation and Profile IA without hardcoding module IDs in Profile UI copy.

---

## Part 4 — Profile Completeness

### Should Arrival Atlas expose completeness?

**Yes — but as a navigation aid, not a score to optimize.**

Completeness aligns with newcomer overwhelm: users need to know **what's missing for better guidance**, not **how close they are to 100%**.

### What completeness should measure

| Measure | Include? | Rationale |
|---------|----------|-----------|
| Domain coverage (employment, housing, insurance…) | **Yes** | Actionable — links to modules |
| Cross-module overlap readiness | **Yes** | "Financial + Benefits work better with housing info" |
| Field-level micro-completion | **No** in v1 | Feels bureaucratic |
| Global 0–100 score alone | **De-emphasize** | Use as secondary visual, not primary CTA |
| Verification status ("confirmed by you") | **Optional v2** | Distinguish inferred vs confirmed |

### Global vs per-domain

**Per-domain completeness is primary.** Global score is a derived summary.

Example UX:

```text
Your profile helps with:
  ✓ Language & location
  ◐ Work & income — add employment status
  ○ Health insurance — not yet provided
```

### Should users be rewarded?

**No points, badges, or streaks.** Arrival Atlas is not a game.

**Positive reinforcement patterns that fit:**

- "Your profile now covers finance and benefits — try Benefits Simulator with less typing"
- Unlocking **convenience**, not features — all modules remain accessible
- Reduced form length visible on next module visit

### Should modules explain why information is requested?

**Yes — strongly aligned with product principles.**

| Pattern | Where |
|---------|-------|
| Inline field helper | Module forms: "We use rent to estimate Wohngeld relevance" |
| Explain panel linkage | After execute: profile factors in explanation |
| Profile domain empty state | "Healthcare module asked for insurance — add it here to prefill next time" |

Completeness and module explainability should **tell the same story** — profile facts exist to improve decision support.

---

## Part 5 — Profile vs Modules

### Model comparison

| Dimension | A) Profile-first | B) Module-first | C) Hybrid |
|-----------|------------------|-----------------|-----------|
| First experience | Long profile form | Jump into module | Mini-onboarding + module |
| Data entry burden upfront | High | Low | Low–medium |
| User understands purpose | Unclear until modules used | Immediate value | Value quickly, context grows |
| Cross-module consistency | Strong if profile complete | Weak without activation | Strong after 1–2 modules |
| Correction path | Natural (Profile) | Awkward (re-run modules) | Profile mirror + module |
| Fits explainability | Abstract | Concrete | Concrete + summary |
| Fits newcomer psychology | Overwhelming | Empowering | Balanced |
| Risk of stale data | User forgets Profile | Profile lags modules | Manageable with mirror UX |

### Recommendation: **C) Hybrid — Module-first capture, Profile as mirror**

**Primary interaction:** Modules  
**Primary storage UX:** Profile as **read-mostly mirror** with explicit edit capability  
**Primary onboarding:** Short guided seed + first module

**User-facing narrative:**

> "Tell us about your situation as you explore tools — we'll remember what helps, and you can always review or update your summary in Profile."

**Justification against Arrival Atlas goals:**

| Goal | Hybrid support |
|------|----------------|
| Clarity over complexity | Modules ask contextual questions; Profile summarizes |
| Explainability | Decisions explained in modules; Profile shows stored facts |
| Decision support over information | Profile drives "what to do next" via completeness → module suggestions |
| Modularity | Modules remain independent; Profile is cross-cutting read model |

### Edit authority model

| Action | Primary surface |
|--------|-----------------|
| First capture of fact | Module form |
| Correction | Profile (preferred) or re-run module |
| Preference (language, theme) | Header / Profile prefs |
| Scenario / what-if | Module only |
| Delete fact | Profile (with confirmation) |

---

## Part 6 — Dashboard Integration

### Current home (baseline)

Today the dashboard shows: Session debug, FTU flag, raw profile dump, attention/action cards, priority signals, category-grouped modules, recent executions.

**Product gap:** Home reads like a **developer snapshot viewer**, not a **user command center**.

### What belongs on Home (dashboard)

| Element | Include? | UX purpose |
|---------|--------|------------|
| **Onboarding progress card** | **Yes (v1)** | FTU → guided checklist; primary newcomer anchor |
| **Profile completeness by domain** | **Yes (v1)** | Orient toward next useful module |
| **Suggested next module** | **Yes (v1)** | 1–3 cards based on completeness + category gaps — not algorithmic ranking |
| **Recent decisions / executions** | **Yes** (already exists) | Continuity |
| **Action cards from snapshot** | **Yes** | Decision support |
| **Category-grouped module catalog** | **Yes** | Discovery |
| **Household one-liner** | **Optional** | "Household of 3 · Berlin" — humanizing |
| **Raw profile JSON fields** | **No** | Replace with summary card linking to Profile |
| **Session debug (language string)** | **No** | Move to settings or remove from home |

### What belongs only inside Profile

| Element | Why dashboard-excluded |
|---------|------------------------|
| Full domain edit forms | Depth; not glanceable |
| Sensitive fields (income) | Privacy on shared screens |
| Preference fine-tuning | Settings pattern |
| Staleness correction workflows | Requires focus |
| Data export / privacy controls | Trust actions need dedicated space |
| Revision / audit history | Power user |

### Recommended home layout (conceptual)

```text
┌─────────────────────────────────────────────┐
│ Welcome back · [onboarding progress if FTU] │
├─────────────────────────────────────────────┤
│ Your situation (summary card → Profile)      │
│   3 of 5 areas covered · [Continue setup]    │
├─────────────────────────────────────────────┤
│ Suggested for you (1–3 module cards)         │
├─────────────────────────────────────────────┤
│ Priority actions (from snapshot)             │
├─────────────────────────────────────────────┤
│ Browse by topic (category modules)           │
├─────────────────────────────────────────────┤
│ Recent results                               │
└─────────────────────────────────────────────┘
```

**Dashboard Profile presence:** **Summary + link**, never full editor.

---

## Part 7 — Personalization

Personalization opportunities that **do not change module execution logic** — UI and ordering only.

| Opportunity | Value | Complexity | Risk |
|-------------|-------|------------|------|
| **Preferred language** | Very high — core accessibility | Low | Low — already partial |
| **Category ordering on home** | Medium — surfaces relevant life area | Low | Low — prefs only, not outcomes |
| **Explanation verbosity (brief / standard)** | Medium — cognitive load tuning | Low | Low — UI rendering only |
| **Onboarding checklist ordering** | Medium — job seeker vs family vs student paths | Medium | Medium — needs persona paths, not stereotypes |
| **Dashboard density (compact / comfortable)** | Low–medium | Low | Low |
| **Hide empty snapshot sections** | Medium — cleaner home | Low | Low |
| **Suggested module copy personalization** | Medium — "Based on your housing info…" | Medium | Medium — must stay factual, not predictive |
| **Preferred module categories pin** | Medium | Low | Low |
| **Default module tab on return visit** | Low | Low | Low |
| **Notification preferences** | Low in v1 | High | Out of scope |
| **Recommendation reordering by profile** | High apparent value | High | **High** — conflicts with explainability / feels opaque |

**v1 personalization scope:** Language, theme, explanation depth, category ordering, empty-section hiding.

**Defer:** Any personalization that changes which recommendations/actions modules produce.

---

## Part 8 — Migration & Integration Context

### Existing platform UX patterns (preserve)

| Pattern | Profile integration |
|---------|---------------------|
| **Category navigation** | Profile IA mirrors categories conceptually; completeness suggests categories with gaps |
| **Capability-driven UI** | Profile does not replace capabilities — modules still declare features |
| **Contract-driven modules** | Profile never adds module-specific UI; suggestions link to generic module routes |
| **UiSnapshot dashboard** | Profile summary projected into snapshot — home reads summary, not raw document |
| **Explain flow** | Profile factors already appear in explanations — reinforce in Profile mirror |
| **Schema-driven forms** | Module forms remain authoritative for first capture; Profile edits use same domain labels |

### UX consistency principles

1. **Same vocabulary everywhere** — Profile section labels match module form language where domains overlap.
2. **Profile is never a second module catalog** — it summarizes and orients; modules remain the action surface.
3. **No profile-specific navigation per module** — one Profile route; modules link to it via "Review your saved information."
4. **Header handles ephemeral prefs** — language/theme need not require Profile visit.
5. **FTU evolves into onboarding product** — replace heuristic FTU display with intentional checklist UX.

### Entry points to Profile (recommended)

| Entry | Pattern |
|-------|---------|
| Home summary card | "Your situation" → Profile |
| Header menu | "Profile" / "Your situation" |
| Post-module execute | "Saved to your profile · Review" |
| Onboarding checklist | Step links to Profile section or relevant module |
| Empty domain in completeness | Deep link to Profile section |

---

## Part 9 — Competitive Analysis

Focused on **newcomer integration journeys** — not generic SaaS profile settings.

### Pattern library

| Source | Useful pattern | Applicability to Arrival Atlas |
|--------|----------------|-------------------------------|
| **German government portals (Bund ID, ELSTER prep flows)** | Strict identity separation; minimal data collection per task; explicit legal basis for fields | **Adopt:** minimal collection, plain legal sensitivity for benefits/tax fields |
| **Banking onboarding (N26, DKB)** | Progressive KYC — ask income/employment only when product requires | **Adopt strongly:** module-first, progressive disclosure |
| **Public insurance (TK, AOK signup wizards)** | Scenario questions ("Are you employed?") branch the flow | **Adopt:** Life Event + module branching; Profile mirrors outcomes |
| **Tax software (WISO, SteuerGo)** | Expert mode vs guided mode; clear "your data" panel | **Adopt:** advanced fields collapsed; Profile as data panel |
| **Immigration platforms (Expatica, official Ausländerbehörde prep)** | Checklists tied to visa type and timeline | **Adopt strongly:** onboarding as checklist, not form |
| **Jobcenter digital prep tools** | Situation summary before appointment | **Adopt (future):** exportable situation summary |
| **Health navigator apps (Doctolib onboarding)** | Location-first, then insurance | **Adopt:** location + insurance ordering in IA |

### Patterns to **avoid**

| Pattern | Source | Why avoid |
|---------|--------|-----------|
| Mandatory 100% profile before any feature | Legacy gov portals | Violates decision-support-first |
| Generic "Account Settings" blob | SaaS apps | Wrong mental model |
| Social graph / avatar-centric profile | Consumer apps | Irrelevant |
| Opaque "personalization" toggles | Streaming apps | Conflicts with explainability |
| Annual "confirm all details" wall | Banks | Too heavy for episodic integration use |

### Differentiator for Arrival Atlas Profile

> **Integration dossier, not account settings** — organized by life domains in Germany, fed by modules the user already trusts, always explainable.

---

## Part 10 — Final Recommendation

### 1. Recommended Profile UX model

**Hybrid: Module-first capture, Profile as trusted mirror and orientation layer.**

- Users gain value through **modules first**.
- Profile answers: *"What does Arrival Atlas know? What's missing? What's next?"*
- Direct editing supported for **corrections and preferences**.
- Onboarding is a **checklist tied to life domains**, not a registration form.

---

### 2. Recommended information architecture

**Eight user-facing sections:**

1. Your situation in Germany  
2. Location & housing  
3. Household & family  
4. Work & income  
5. Health insurance  
6. Benefits & support  
7. Language & display  
8. Your data (privacy — future)

Profile Home = summary + per-domain completeness + edit entry points.

---

### 3. Recommended onboarding strategy

**"Guided start, then learn by doing"**

| Step | UX |
|------|-----|
| 1 | Welcome + language selection (header-level) |
| 2 | Optional 3-question situation seed: city/Bundesland, employment status, household size |
| 3 | Recommend **one** starter module based on seed (not a wall of choices) |
| 4 | After first execute: show Profile mirror + "Here's what we saved" |
| 5 | Checklist on home until 3 domains touched or user dismisses |

**Persona paths (lightweight, v2):** "I just arrived" / "I'm looking for work" / "I'm managing benefits" — adjust checklist order only, not module logic.

---

### 4. Recommended dashboard integration

| Surface | Content |
|---------|---------|
| **Home** | Onboarding card + situation summary + suggested modules + snapshot actions + category browse + recent results |
| **Profile** | Full mirror, edits, completeness detail, preferences |

Remove raw profile field dump from home. Replace with human summary card.

---

### 5. Recommended Profile v1 scope (UX)

| In v1 UX scope | Out of v1 UX scope |
|----------------|-------------------|
| Profile Home with domain summary | Full privacy/export center |
| Per-domain completeness indicators | Persona-based onboarding paths |
| Onboarding checklist on home | Printable appointment summary |
| Edit core domains (forms per section) | Household member management UI |
| Post-module "saved to profile" feedback | Gamified completion rewards |
| Language/theme in prefs | Notification preferences |
| Link from home summary → Profile | Tax expert advanced panel |
| Staleness hint (1–2 domains max shown) | Cross-device profile |

---

### 6. Explicitly out-of-scope (UX)

- Account registration / login-first profile
- Social features
- Profile-driven change to module recommendations (logic)
- Mandatory profile completion gates
- Avatar, bio, display name
- Document upload (visa, Meldebescheinigung) — future product line
- Multi-user household accounts
- Chatbot profile interview
- Third-party data import (ELSTER, Bund ID)

---

### 7. Profile UX roadmap

#### UX-P0 — Discovery alignment (current)

**Goal:** Align product narrative before building Profile UI.

| Deliverable | Output |
|-------------|--------|
| UX model sign-off | Hybrid mirror model approved |
| IA sign-off | Eight sections |
| Copy principles | Plain language, domain labels |
| Dashboard wireframe concept | Summary card replaces raw dump |

**Success:** Stakeholder agreement on "integration dossier" positioning.

---

#### UX-P1 — Onboarding & home orientation

**Goal:** New users understand progress without opening Profile.

| Deliverable | User-visible outcome |
|-------------|---------------------|
| Onboarding checklist component | "3 steps to get oriented" on home |
| Situation summary card | Human-readable one-screen summary |
| Suggested next module | Based on domain gaps (UX rules, not ML) |
| FTU replacement | Explicit checklist replaces heuristic flag display |

**Success:** New user completes first module and sees clear "what's next" without confusion.

---

#### UX-P2 — Profile mirror (read-first)

**Goal:** Users can inspect stored information.

| Deliverable | User-visible outcome |
|-------------|---------------------|
| Profile Home | Domain sections with filled/empty states |
| Read-only domain views | Plain-language labels, no JSON |
| Completeness per domain | Actionable gaps |
| Entry from home + post-module | Consistent navigation |

**Success:** User answers "what do you know about me?" without developer UI.

---

#### UX-P3 — Profile edit & correction

**Goal:** Users fix mistakes without re-running modules.

| Deliverable | User-visible outcome |
|-------------|---------------------|
| Editable domain forms | Same vocabulary as modules |
| Save confirmation | Trust feedback |
| Sensitive field treatment | Income/benefits with context copy |
| Post-module save toast | "Updated your profile" |

**Success:** User corrects rent after move in Profile; next module prefill reflects change.

---

#### UX-P4 — Preferences & light personalization

**Goal:** Comfortable reading experience; ordered discovery.

| Deliverable | User-visible outcome |
|-------------|---------------------|
| Language & display section | Theme, density, explanation depth |
| Category pin/order | Home respects preference |
| Explain verbosity toggle | Brief vs standard in ExplainPanel |

**Success:** User adjusts explanation depth; module results unchanged, presentation adapts.

---

#### UX-P5 — Staleness & maintenance

**Goal:** Long-term profile usefulness.

| Deliverable | User-visible outcome |
|-------------|---------------------|
| Domain staleness prompts | "Has your employment changed?" |
| Dismiss/snooze | Non-nagging |
| Optional annual review | Light "confirm your situation" |

**Success:** Returning user after 3 months gets helpful prompt, not stale guidance.

---

#### UX-P6 — Trust & portability (future)

**Goal:** Appointment prep and account era.

| Deliverable | User-visible outcome |
|-------------|---------------------|
| Situation summary export | PDF/print for appointments |
| Privacy center | What's stored, delete |
| Account-linked profile | Cross-session continuity |

**Success:** User brings summary to Jobcenter; data survives device change.

---

## Appendix — Motivation → UX Feature Traceability

| Motivation | UX-P phase | Feature |
|------------|------------|---------|
| M1 Avoid re-entry | P2–P3 | Mirror + edit + module prefill feedback |
| M2 Transparency | P2 | Profile Home read view |
| M3 Correction | P3 | Domain edit forms |
| M4 Onboarding | P1 | Checklist |
| M5 Language | P4 | Preferences |
| M7 Life events | P1, P5 | Checklist + module suggestion |
| M8 Verify imported | P2 | "Saved from Financial Reality" labels |
| M10 Why questions | Modules + P2 | Field helpers + completeness links |
| M12 Appointment prep | P6 | Export |

---

## Appendix — Research Method

Read-only review of:

- Product positioning (`README.md`)
- Module descriptions and categories (finance, benefits, healthcare, daily-life, language, life-events)
- Existing profile domains (employment, housing, insurance, benefits, household, residency, location)
- Profile activation behavior (financial-reality, healthcare-navigation)
- Current home dashboard UX (`HomeSnapshotRenderer`)
- UI architecture and profile system v1 technical roadmaps
- Newcomer integration context (Germany administrative landscape)

**No implementation, API design, schema design, or package architecture proposed.**

---

**Document status:** Product discovery complete — ready for UX design phase (wireframes / content design) aligned with [../identity/profile-system-v1-roadmap.md](../identity/profile-system-v1-roadmap.md) technical phases P1–P4.
