---
id: life-event-module-v1.0-ux-blueprint
title: Life Event Module v1.0 — UX Blueprint
project: Arrival Atlas
system: Arrival Atlas
type: specification
domain: life-events
status: canonical
maturity: stable
owner: product
created: 2026-06-20
updated: 2026-06-20
depends_on:
  - life-event-module-v2-v1.0-architecture-freeze
  - adr-001-life-event-layered-architecture
  - adr-004-le-7-scenario-overlay
  - l10-a-localization-pass
  - l10-a2-content-localization-completion
related:
  - life-event-module-v2-spec
  - le-6-consistency-rules
---

# Life Event Module v1.0 — UX Blueprint

**Module:** `life-event`  
**Screen:** `/modules/life-event` (+ Home condensed card)  
**Architecture:** LE-1 → LE-8 frozen (presentation composition only)  
**Audience:** Design, product, engineering (presentation layer)

This document defines the **ideal final user-facing experience** for the Life Event Module v1.0 screen. It is a **UX and product composition spec** — not an implementation task and not an architecture change.

**Hard boundary:** This blueprint sits entirely on top of the frozen LE-1 → LE-8 system. No new planner states, graphs, scenarios, action types, or backend logic are proposed.

---

## 1. Executive UX Summary

### What this screen is

The Life Event Module is Arrival Atlas’s **scenario-based life guidance system for Germany**. It translates a user’s profile situation into a **deterministic action plan**: one clear focus, ordered next steps, visible blockers, and optional timeline context.

The screen is the **full-plan view**. Home (`NextStepsCard`) is a **condensed entry point** to the same plan model.

### What problem it solves

New arrivals and life-transition users face **administrative overload**: registration, insurance, employment, housing, and benefits interact in non-obvious order. The module reduces that overload by answering:

1. **Where am I?** (life state)
2. **What matters most now?** (primary focus)
3. **Why?** (reasoning)
4. **What is stopping me?** (blockers)
5. **What comes next?** (secondary + timeline actions)

### User mindset supported

| Phase | User feeling | Screen job |
|-------|--------------|------------|
| Arrival stress | Overwhelmed, uncertain | **Directive clarity** — one focus, explicit urgency |
| Stabilizing | Busy, task-switched | **Ordered progress** — visible blockers + next best steps |
| Stable / exploring | Calm, optional | **Neutral guidance** — timeline collapsed, low urgency |

**Emotional arc:** arrival stress → clarity → action → (optional) deeper understanding.

---

## 2. Information Architecture (single screen model)

The Life Event Module page is a **single vertical screen** with four stacked zones. Zones map 1:1 to cognitive layers — never interleaved.

```text
┌─────────────────────────────────────────────┐
│  ZONE 1 — Situation Header                  │
├─────────────────────────────────────────────┤
│  ZONE 2 — Primary Action Block (Focus)      │
├─────────────────────────────────────────────┤
│  ZONE 3 — Action Breakdown Layer            │
├─────────────────────────────────────────────┤
│  ZONE 4 — Understanding Layer               │
├─────────────────────────────────────────────┤
│  APPENDIX — Scenario Explorer (legacy path) │
└─────────────────────────────────────────────┘
```

### Zone 1 — Situation Header

**Purpose:** Orient the user in one glance.

| Element | Source | Required |
|---------|--------|----------|
| Module title + description | `PublicModuleContract` → localized via `life-event.module.*` | Yes |
| Life state label | `plan.currentLifeState` → `life-event.state.{id}` | Yes |
| Scenario hint banner | `ScenarioMatchV1` (LE-7, optional) | Conditional |
| Plan confidence indicator | `plan.reasoning.planConfidence` → `life-event.plan.confidence.*` | Yes |

**Rules:**

- Life state is always visible above the focus card.
- Scenario banner (if present) sits **below** the state label, **above** Zone 2 — interpretive only, never replaces state.
- Confidence is secondary metadata (small, muted) — not a progress bar.

### Zone 2 — Primary Action Block (Focus Layer)

**Purpose:** Single authoritative “do this now.”

| Element | Source | Required |
|---------|--------|----------|
| Focus node | `ActionSurfaceV1.primaryAction` (= `plan.currentFocus`) | Yes |
| Urgency badge | `node.priority` → `life-event.severity.{critical\|high\|medium\|low}` | Yes |
| Title + description | `node.id` → `life-event.node.{id}.title\|description` (fallback: planner text) | Yes |
| Action CTAs | `node.actions[]` → `life-event.action.*` (fallback: planner labels) | Yes (≥0) |
| Execution state | `ExecutionSurfaceV1` → disabled styling only | Yes |

**Rules:**

- Exactly **one** primary focus card per screen.
- Focus card is visually dominant (strongest border/elevation in the screen).
- Primary CTA = first actionable link in focus node actions (when execution allows).

### Zone 3 — Action Breakdown Layer

**Purpose:** Structured task landscape — blocked vs next vs future.

Three **visually separated** sub-sections (never mixed in one list):

| Sub-section | Source | Default visibility | Max visible |
|-------------|--------|-------------------|-------------|
| **Blocked actions** | `ActionSurfaceV1.blockedActions` | When non-empty | All (typically ≤3) |
| **Secondary actions** | `ActionSurfaceV1.secondaryActions` | When non-empty | **Max 3** (LE-4 cap) |
| **Contextual actions** | `ActionSurfaceV1.contextualActions` | **Collapsed** (`<details>`) | All when expanded |

Each sub-section uses the same node card pattern as Zone 2 but with **de-emphasized** styling tier:

- Focus → strong accent
- Secondary → standard card
- Blocker → warning-adjacent border (not error-red)
- Timeline/contextual → muted, collapsible

**Blocked section heading:** `life-event.plan.blockedActions` or Home equivalent.  
**Secondary heading:** `life-event.plan.nextActions`.  
**Contextual heading:** `life-event.timeline.upcomingSteps` inside `life-event.timeline.title` collapse.

### Zone 4 — Understanding Layer

**Purpose:** Explain the plan without repeating action copy verbatim.

| Sub-section | Source | Visibility |
|-------------|--------|------------|
| **Why this now** | `plan.reasoning.whyThisNow` → localized via graph intent + focus rationale keys | When non-empty |
| **What is blocking** | Blocker nodes (Zone 3) + `plan.reasoning.whatIsBlocking` → localized secondary/blocker keys | When blockers or reasons exist |
| **Why progress is constrained** | Subset of blocking reasons (narrative bullets) | When `showBlockingReasons` |

**Rules:**

- Understanding layer comes **after** actions — users see *what* before *why* (except state header).
- Bullets are short (1–2 lines each); no paragraph essays.
- Do not duplicate node titles as bullets unless the bullet adds new information.

### Appendix — Scenario Explorer (below plan)

**Purpose:** Legacy guided scenario tool (`execute()` path) — **separate** from LE-1 plan.

- Visually separated from Zones 1–4 (distinct card, explanatory intro).
- Label: `life-event.explorer.*`
- Must not be mistaken for the authoritative plan above it.

---

## 3. Content Model Mapping

### Structural source of truth

```text
LifeEventPlanV1 (LE-1)
        │
        ├─► projectActionSurface() ──► ActionSurfaceV1 (LE-4)
        │         primaryAction
        │         secondaryActions (≤3)
        │         blockedActions
        │         contextualActions
        │
        ├─► buildExecutionSurface() ──► ExecutionSurfaceV1 (LE-5)
        │         per-node disabled / ready (same node IDs)
        │
        ├─► projectLifeEventPage() ──► section visibility flags
        │         showActiveBlocks, showBlockingReasons, showTimeline
        │
        └─► reasoning.* ──► Understanding Layer (localized at render)
```

### Overlay mapping (non-authoritative)

| Overlay | Input | UX role | Must not |
|---------|-------|---------|----------|
| **LE-6 P4 dedup** | `ProfileInsightViewV1` + plan | Suppress redundant Home hints only | Change plan buckets |
| **LE-7 Scenario** | `ScenarioMatchV1` | Optional banner in Zone 1 | Replace plan, change focus |
| **LE-8 Runtime MRC** | `RuntimeActionEffectV1` | Optional advisory strip (library-only today) | Restructure actions |

### Field-level mapping table

| UX element | Contract field | Layer |
|------------|----------------|-------|
| Life state label | `currentLifeState` | LE-1 |
| Focus title/description | `currentFocus` / `primaryAction` | LE-1 → LE-4 |
| Urgency badge | `node.priority` | LE-1 |
| Blocked list | `activeBlocks` → `blockedActions` | LE-1 → LE-4 |
| Next steps | `nextBestActions` → `secondaryActions` | LE-1 → LE-4 |
| Timeline steps | `timeline` → `contextualActions` | LE-1 → LE-4 |
| Why bullets | `reasoning.whyThisNow` | LE-1 |
| Blocker prose | `reasoning.whatIsBlocking` | LE-1 |
| Confidence | `reasoning.planConfidence` | LE-1 |
| CTA disabled | `ExecutionSurfaceV1` lookup by `node.id` | LE-5 |
| Scenario narrative | `ScenarioMatchV1.reasoning` | LE-7 |
| P4 missing context | `ProfileInsightViewV1` hints (Home only) | LE-6 |

---

## 4. UX States

### State matrix

| State | Trigger | Zone 1 | Zone 2 | Zone 3 | Zone 4 | Notes |
|-------|---------|--------|--------|--------|--------|-------|
| **Loading** | Plan fetch in flight | Skeleton | Skeleton | Hidden | Hidden | Module metadata may show from catalog cache |
| **Module loading** | Catalog fetch | Skeleton page | — | — | — | Full-page placeholder |
| **No profile / gate error** | API 4xx, missing UserContext | Error message | Hidden | Hidden | Hidden | Direct user to profile completion |
| **Plan error** | Plan fetch failed | Error strip | Hidden | Hidden | Hidden | Retry affordance |
| **No plan** | Empty/null plan | State unknown copy | Empty state | Hidden | Hidden | `life-event.empty.noPlan` |
| **Partial plan** | `primaryAction` null | State if known | Empty focus message | Hidden | Partial reasoning | Rare; degraded but non-crashing |
| **Full plan** | Valid `LifeEventPlanV1` | Complete | Focus card | Breakdown | Understanding | Default happy path |
| **Scenario overlay active** | `ScenarioMatchV1` present | + banner | Unchanged | Unchanged | Unchanged | Banner only |
| **Runtime feedback** | LE-8 effect (when wired) | + advisory strip | Unchanged | Unchanged | Unchanged | Non-blocking |

### Loading skeleton structure

1. Header: 2 lines (title + description placeholders)
2. State pill placeholder
3. Focus card: title bar + 2 text lines + 2 button placeholders
4. Optional: single secondary card placeholder

Skeleton must preserve **zone order** — never animate a single generic spinner for the whole page.

### Empty / error copy

All copy is key-based (`life-event.empty.*`, API error passthrough for diagnostics). No hardcoded locale strings in components.

---

## 5. Action Hierarchy Rules (critical UX rules)

These rules are **non-negotiable** for v1.0 and mirror LE-4/LE-5 invariants.

| # | Rule |
|---|------|
| 1 | **Primary action is always single** — one `primaryAction` card in Zone 2. |
| 2 | **Secondary actions: max 3 visible** — LE-4 enforces slice; UI must not render more. |
| 3 | **Blocked actions are visually separated** — own sub-section; never mixed with secondary list. |
| 4 | **Contextual actions collapsed by default** — timeline-derived; expand on user intent. |
| 5 | **No duplicate node IDs in UI** — LE-4 dedupes; UI must not re-introduce duplicates across sections. |
| 6 | **ExecutionSurface affects disabled state only** — never reorders, hides, or re-buckets nodes. |
| 7 | **Blocked node cards default disabled CTAs** — `variant=blocker` or execution lookup. |
| 8 | **Satisfied nodes do not appear as primary/secondary** — planner excludes them; UI respects buckets. |
| 9 | **Home card is a subset** — same hierarchy, condensed; link to full plan for Zone 4 depth. |

### Home condensed mapping

| Full page zone | Home (`NextStepsCard`) |
|----------------|------------------------|
| Zone 1 (partial) | Card title + optional scenario banner |
| Zone 2 | Primary focus node |
| Zone 3 blocked | Blocked sub-section (if any) |
| Zone 3 secondary | Secondary sub-section (if any) |
| Zone 4 | Omitted — “View full plan” CTA |

---

## 6. Scenario Overlay Layer (LE-7 integration)

### When the banner appears

Display when **all** are true:

1. `resolveScenario()` returns `ScenarioMatchV1`
2. Consumer opts in (Home: yes; full page: optional future)
3. Match confidence meets consumer threshold (current: any match)

### Banner anatomy

| Part | Key | Behavior |
|------|-----|----------|
| Title | `life-event.scenario.contextShiftTitle` | Fixed interpretive label |
| Body | `life-event.scenario.{scenarioId}.reasoning` | Localized; fallback: registry English |
| State transition | *Not shown as authoritative* | May appear in copy as narrative only |

### What the overlay modifies

| Modifies | Does not modify |
|----------|-----------------|
| User **perception** of context shift | `LifeEventPlanV1` |
| Optional explanatory prose | `ActionSurfaceV1` buckets |
| Emotional framing (“your situation may be changing”) | `ExecutionSurfaceV1` |
| | Focus node selection |
| | Blocker list ordering |

### Transition communication

- Use **interpretive language** (“may be changing”, “shifts toward”) — never declarative state assignment (“You are now in state X”).
- Banner is dismissible in future designs; v1.0 may be persistent for the session.
- No toggle that re-runs planner or swaps plan content.

---

## 7. Localization Architecture (L10-ready)

### Principle

**Planner owns facts. UI owns language.**

All user-visible strings render through the platform i18n system (`getTranslations` → `AppProvider.t()`). No hardcoded English, German, Russian, or Ukrainian in presentation components.

### String taxonomy (UX → implementation)

Blueprint taxonomy maps to implemented `life-event.*` keys (L10-A + L10-A2):

| UX taxonomy | Purpose | Implemented prefix | Example |
|-------------|---------|-------------------|---------|
| `life_state.*` | Structural state labels | `life-event.state.{lifeStateId}` | `arrival_unregistered` → “New arrival” |
| `action.*` | Node titles, descriptions, CTA labels | `life-event.node.{nodeId}.*`, `life-event.action.*` | `g1-complete-anmeldung.title` |
| `blocker.*` | Blocker prose, waiting templates | `life-event.reasoning.secondary.*`, `life-event.reasoning.blocker.waiting` | `registration_incomplete` |
| `scenario.*` | Overlay + explorer | `life-event.scenario.*`, `life-event.explorer.*` | `job_loss.reasoning` |
| `ui.*` | Section chrome, empty, severity | `life-event.plan.*`, `life-event.home.*`, `life-event.severity.*`, `life-event.empty.*` | `plan.whyThisNow` |

### Label classes

| Class | Mutable at render? | Fallback |
|-------|-------------------|----------|
| **Structural labels** | Yes — always keyed | Key → English platform fallback |
| **Dynamic labels** (node copy) | Yes — keyed by stable ID | Planner English text |
| **System labels** (section titles, severity) | Yes — keyed | Key as last resort |

### Locale support

`en`, `de`, `ru`, `ua` — no new locales in v1.0 blueprint.

### Text expansion

Layout must tolerate **+40% horizontal expansion** for German compound strings without truncation of primary focus title.

---

## 8. Copy Tone System

### Voice pillars

| Pillar | Definition |
|--------|------------|
| **Direct** | Imperative titles (“Complete Anmeldung”, not “You might want to register”) |
| **Non-judgmental** | Blockers explain constraints, not user failure |
| **Specific** | Name German admin concepts when relevant (Anmeldung, Krankenkasse) |
| **Calm urgency** | Critical = clear priority, not alarmist panic |

### Tone by life state cluster

| Cluster | States | Tone |
|---------|--------|------|
| Arrival / survival | `arrival_unregistered`, `arrival_stabilizing`, `insurance_gap` | Directive, sequential, low ambiguity |
| Instability | `housing_instability`, `economic_setup_pending` | Problem-solving, stabilizing |
| Exploration | `benefits_exploration` | Informative, optional paths |
| Stable | `situation_stable` | Neutral, proactive optional guidance |

### Section-specific tone

| Section | Tone rule |
|---------|-----------|
| Focus title | Verb-led, ≤8 words where possible |
| Focus description | One concrete outcome + one constraint |
| Blocked actions | “Waiting on earlier steps” pattern — systemic, not personal |
| Why this now | Cause → implication (2 bullets max visible above fold on mobile) |
| Scenario banner | Conditional (“may”, “might”) — interpretive overlay |

### Anti-patterns

- Do not repeat the focus title verbatim in “Why this now.”
- Do not use “failed”, “wrong”, or “missing” for user data — use “not recorded yet”, “needs attention.”
- Do not show more than one urgency= critical badge above the fold without blocked section context.

---

## 9. Visual Hierarchy Spec (design-agnostic)

### Emphasis order (1 → 4)

1. **Primary focus card** — highest contrast border, largest title scale
2. **Life state + scenario banner** — orientation band
3. **Blocked + secondary cards** — medium density list
4. **Understanding bullets + collapsed timeline** — lowest contrast, expandable

### Spacing logic

| Group | Spacing rule |
|-------|--------------|
| Between zones | Large gap (1.5× base section gap) |
| Within Zone 3 sub-sections | Medium gap + sub-heading |
| Within node cards | Compact internal padding |
| Appendix explorer | Extra-large top margin + divider semantics |

### Density rules

| Constraint | Limit |
|------------|-------|
| Visible node cards above fold (mobile) | Focus + ≤2 secondary OR focus + blockers |
| Bullets per understanding sub-section | ≤5 rendered; remainder collapsed |
| CTAs per node card | ≤4 visible; wrap on small screens |
| Badges per node | Priority + optional “Blocked” — max 2 |

### Always visible vs collapsible

| Always visible | Collapsed by default |
|----------------|---------------------|
| Life state | Timeline / contextual actions |
| Focus card | Full understanding layer on Home |
| Blockers (when present) | Scenario explorer appendix |
| Plan confidence (muted) | Runtime advisory (when wired) |

### Severity encoding (not color-alone)

| Priority | Visual + text |
|----------|---------------|
| critical | Badge text + border weight |
| high | Badge text |
| medium | Badge text, standard border |
| low | Muted badge |

---

## 10. Interaction Model

### Action types (`LifeActionRef.kind`)

| Kind | Click behavior | Navigation |
|------|----------------|------------|
| `correct_in_profile` | Navigate to profile mirror edit route | `href` (in-app) |
| `open_module` | Navigate to target module | `/modules/{moduleId}` |
| `explore_scenario` | Navigate to life-event with event prefill | `/modules/life-event?event=…` |

### Execution interaction (LE-5)

| Execution state | UI behavior |
|-----------------|-------------|
| Ready | CTA enabled, standard link styling |
| Disabled | CTA `aria-disabled`, reduced opacity, no navigation |
| Blocker variant | All CTAs disabled regardless of execution |

ExecutionSurface **never** removes a CTA from DOM — only disables interaction.

### Expansion rules

| Element | Trigger | Result |
|---------|---------|--------|
| Timeline `<details>` | User tap | Reveals `contextualActions` node cards |
| Full plan link (Home) | User tap | Navigate to `/modules/life-event` |
| Scenario explorer form | User submit | Legacy `execute()` — does not refresh LE-1 plan |

### Scenario toggle

v1.0: **No plan-affecting scenario toggle.** Scenario explorer is independent. LE-7 banner is read-only context.

### Navigation entry points

| Entry | Lands on |
|-------|----------|
| Home next steps card | Scroll to plan zones on `/modules/life-event` |
| Module catalog | Page header + full plan |
| Deep link `?event=` | Plan zones + explorer prefill (appendix) |

---

## 11. Accessibility & Multilingual Considerations

### RTL / LTR

- Zone stack is vertical — safe for RTL without mirroring logic.
- Iconography (if added) must not convey sole meaning; text labels required.

### Color independence

- Priority communicated by **badge text** (`life-event.severity.*`) + border weight.
- Blocked state uses border pattern + “Blocked” badge (`life-event.node.blocked`), not red-only fill.

### Text expansion

- German/Russian/Ukrainian: allow title wrapping to 3 lines on mobile.
- Button labels: min-width flexible; no fixed-width truncation on CTAs.
- `<details>` summary must expand horizontally for long timeline headings.

### Screen reader grouping

| Region | `aria` / landmark model |
|--------|-------------------------|
| Zone 1 | `header` + life state as heading level 2 |
| Zone 2 | `main` focus region — “Recommended focus” |
| Zone 3 blocked | `section` + “Blocked actions” heading |
| Zone 3 secondary | `section` + “Next actions” heading |
| Zone 3 timeline | `section` inside `<details>` |
| Zone 4 | `complementary` — “Why this plan” |
| Scenario banner | `note` — interpretive, not live region |
| Explorer appendix | Separate `section` — “Explore scenarios” |

Live regions: only for plan load completion and error announcements — not for scenario overlay (avoid double-announcement of interpretive text).

---

## 12. Ideal Screen Definition

### First 3 seconds

The user sees:

1. **Module title** — “Life Event Module” (localized) — confirms they are in the right place.
2. **Life state label** — e.g. “New arrival” — answers *where am I in the journey*.
3. **One dominant focus card** — e.g. “Secure a registrable address” with a **Critical** badge — answers *what matters most now*.

If a scenario overlay is active, a compact **“Context shift detected”** note appears between state and focus — framed as interpretation, not a new command.

### First 10 seconds

The user understands:

- **Priority** — urgency badge on focus + at most one blocker section if progress is gated.
- **Next steps** — up to three secondary cards below, visually subordinate.
- **Confidence** — muted “Plan confidence: High / Moderate / Lower” under focus — system honesty without anxiety.

They have **not yet needed** the Understanding layer to act — actions come first by design.

### What the user does next

1. **Primary CTA** on focus card (e.g. “Update housing details” or “Explore arrival guidance”) — single clearest action.
2. If blocked, read blocker cards **above** secondary actions — understand sequencing constraint.
3. Optionally expand **Timeline** for future steps.
4. Scroll to **Why this now** if they need reassurance before acting.
5. Use **View full plan** from Home if they started on the condensed card.

### Ideal end-state feeling

> “I know where I stand in Germany’s admin journey, what to do today, what is blocking me, and what can wait — without reading a manual.”

---

## Appendix A — Home vs Full Page

| Aspect | Home `NextStepsCard` | Full `/modules/life-event` |
|--------|----------------------|----------------------------|
| LE-6 dedup | Active | N/A |
| LE-7 banner | Active | Optional (future parity) |
| LE-8 runtime strip | Hook present, unwired | Same |
| Zone 4 understanding | Omitted | Full |
| Timeline | Omitted | Collapsed |
| Scenario explorer | Omitted | Appendix |

---

## Appendix B — Compliance checklist

A design or implementation is **blueprint-compliant** when:

- [ ] Four zones render in order without mixing blocked/secondary lists
- [ ] Single primary focus; ≤3 secondary actions
- [ ] Contextual actions collapsed by default
- [ ] No duplicate `node.id` across visible sections
- [ ] ExecutionSurface only disables — never restructures
- [ ] Scenario overlay is interpretive — plan buckets unchanged
- [ ] All visible strings use `life-event.*` keys (or documented fallback to planner text)
- [ ] No backend, contract, or LE-1–LE-5 behavior changes required
- [ ] LE-6–LE-8 remain optional overlays

---

## Appendix C — References

| Document | Role |
|----------|------|
| [life-event-module-v2-v1.0-architecture-freeze.md](./life-event-module-v2-v1.0-architecture-freeze.md) | Frozen architecture |
| [ADR-004](../adr/adr-004-le-7-scenario-overlay.md) | Scenario overlay rules |
| [l10-a-localization-pass.md](./l10-a-localization-pass.md) | UI chrome i18n |
| [l10-a2-content-localization-completion.md](./l10-a2-content-localization-completion.md) | Content i18n |
| [le-6-consistency-rules.md](./le-6-consistency-rules.md) | Home dedup presentation |

---

*This blueprint is canonical for Life Event Module v1.0 UX. Implementation may lag; where code differs, this document defines the target experience without requiring architecture changes.*
