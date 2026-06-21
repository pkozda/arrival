---
id: life-event-module-v1.0-figma-wireframe
title: Life Event Module v1.0 — Figma Wireframe Spec
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
  - life-event-module-v1.0-ux-blueprint
  - life-event-module-v2-v1.0-architecture-freeze
related:
  - l10-a-localization-pass
  - l10-a2-content-localization-completion
---

# Life Event Module v1.0 — Figma Wireframe Spec

**Screen route:** `/modules/life-event`  
**Primary Figma frame:** `LifeEventModule / Desktop / v1.0`  
**Architecture:** LE-1 → LE-8 frozen — **visual structure only**

This document is a **pixel-independent wireframe system** for direct translation into Figma frames, auto-layout, and components. No backend logic, no architecture changes, no new features.

**Companion spec:** [life-event-module-v1.0-ux-blueprint.md](./life-event-module-v1.0-ux-blueprint.md)

---

## 1. Frame Definition

### Primary frame

| Property | Value | Figma setup |
|----------|-------|-------------|
| **Frame name** | `LifeEventModule / Desktop / v1.0` | Top-level page frame |
| **Reference width** | 1440px | Desktop reference only |
| **Layout grid** | 12 columns | Layout grid: 12 cols, stretch |
| **Margin** | 80px left + right | Grid margin 80 |
| **Gutter** | 24px | Grid gutter 24 |
| **Max content width** | 1120px | Inner `Content / Max-1120` auto-layout frame, centered |
| **Vertical flow** | Top → bottom | Auto-layout vertical, gap via spacing tokens (§5) |
| **Background** | Neutral page surface | Token: `surface/page` |

### Frame hierarchy (Figma layers)

```text
LifeEventModule / Desktop / v1.0
└── Content / Max-1120                    [Auto-layout: vertical, fill container]
    ├── Page / Module Title               [Optional page chrome — cols 1–12]
    ├── Section / Header                  [Block: Header / Life Event Context]
    ├── Section / Scenario Overlay        [Block: Overlay / Scenario Hint — conditional]
    ├── Section / Hero                    [Block: Hero / Primary Action]
    ├── Section / Action Breakdown        [Block: Actions / Breakdown]
    ├── Section / Understanding           [Block: Insight / Why This Now]
    └── Section / Scenario Explorer       [Appendix — separate wireframe variant]
```

### Supplementary frames (same spec, different breakpoints)

| Frame name | Width | Notes |
|------------|-------|-------|
| `LifeEventModule / Tablet / v1.0` | 768px | 8-column grid, margin 32px, gutter 16px |
| `LifeEventModule / Mobile / v1.0` | 375px | 4-column grid, margin 16px, gutter 12px |
| `LifeEventModule / Desktop / Loading` | 1440px | Skeleton variant (§10) |
| `LifeEventModule / Desktop / Empty` | 1440px | No-plan variant (§10) |
| `LifeEventModule / Desktop / Error` | 1440px | No-profile / error gate (§10) |

---

## 2. Page Layout Structure (Top → Bottom)

Vertical reading order is **fixed**. Do not reorder sections per life state.

### 2.0 Page chrome (above Header)

**Figma block:** `Page / Module Title`

| Element | Width | Content source | Wireframe label |
|---------|-------|----------------|-----------------|
| H1 module title | 12 cols | `life-event.module.title` | “Life Event Module” |
| Body description | 8 cols max | `life-event.module.description` | 1–2 lines muted |

**Spacing below:** 32px → Header section.

---

### 2.1 Header Section (Context Identity)

**Figma block:** `Header / Life Event Context`  
**Maps to:** `LifeEventPlanV1.currentLifeState`, `reasoning.planConfidence`

```
┌──────────────────────────────────────────────────────────────────┐
│  [Caption] Your current situation          [Caption] Plan conf.  │
│  [State Badge] New arrival                   High confidence ▾   │
│  [Optional: Scenario Indicator pill]                             │
└──────────────────────────────────────────────────────────────────┘
```

| Element | Component | Position | Notes |
|---------|-----------|----------|-------|
| Sub-label | Text / Caption | Top-left | Key: `life-event.plan.currentSituation` |
| Life State Badge | `Badge / State` | Below sub-label, left | Key: `life-event.state.{id}` |
| Plan Confidence | Text / Caption + value | Top-right, aligned | Key: `life-event.plan.planConfidence` + confidence value |
| Scenario Indicator | `Badge / Scenario` | Below state badge OR inline | **Optional** — only when LE-7 match; see §2.5 |

**Layout rules:**

- **Horizontal row:** left cluster (sub-label + state) vs right cluster (confidence).
- **Left-aligned primary** identity; **right-aligned meta** (confidence).
- Auto-layout: horizontal, space-between, align top.
- Min height: 72px (content-driven).

**Do not place** primary action or secondary cards in this block.

---

### 2.2 Primary Focus Section (Hero Action)

**Figma block:** `Hero / Primary Action`  
**Maps to:** `ActionSurfaceV1.primaryAction` (= `plan.currentFocus`)

```
┌──────────────────────────────────────────────────────────────────┐
│  [Urgency Badge] Critical                                        │
│                                                                  │
│  H1  Secure a registrable address                                │
│                                                                  │
│  Body  Confirm where you can legally register and obtain…        │
│        (max 2 lines, truncate with ellipsis in wireframe)        │
│                                                                  │
│  [Primary CTA Button ─────────────────────]                      │
│  [Secondary action chip] [Secondary action chip]  (optional)     │
└──────────────────────────────────────────────────────────────────┘
```

| Element | Typography | Required |
|---------|------------|----------|
| Urgency badge | Badge / Urgency | Yes — above title |
| Title | H1 | Yes — **largest text on screen** |
| Description | Body | Yes — max 2 lines |
| Primary CTA | Button / Primary | Yes — always visible, 1 per screen |
| Node action chips | Button / Secondary | Optional — additional `LifeActionRef` links |

**Hierarchy rules:**

1. Urgency badge **above** title (never below CTA).
2. Title = dominant visual weight (H1).
3. CTA **always visible** without scroll on desktop (hero max ~280px tall).
4. Card width: 12 cols; internal padding 16px; border 2px accent (Primary Action Card variant).

**ExecutionSurface (LE-5):** disabled CTA uses `Button / Disabled` variant — **same layout**, no reflow.

---

### 2.3 Action Breakdown Section

**Figma block:** `Actions / Breakdown`  
**Maps to:** `ActionSurfaceV1.secondaryActions`, `blockedActions`, `contextualActions`

**Desktop layout:** 3-column grid inside 12-col content (each column ≈ 4 cols).

```
┌─────────────────┬─────────────────┬─────────────────┐
│ COL A           │ COL B           │ COL C           │
│ Secondary       │ Blocked         │ Contextual      │
│ Actions         │ Actions         │ (collapsed)     │
│ max 3 cards     │ all blockers    │ ▶ Upcoming steps│
└─────────────────┴─────────────────┴─────────────────┘
```

#### Column A — Secondary Actions

| Property | Value |
|----------|-------|
| Source | `ActionSurfaceV1.secondaryActions` |
| Max cards | **3** (LE-4 hard cap) |
| Component | `Action Card / Secondary` |
| Section label | H2 — `life-event.plan.nextActions` |
| Visual tone | Primary neutral — standard border |

Each card contains: title (H3), urgency badge, 1-line description, 1+ secondary buttons.

#### Column B — Blocked Actions

| Property | Value |
|----------|-------|
| Source | `ActionSurfaceV1.blockedActions` |
| Max cards | All present (typically 0–3) |
| Component | `Action Card / Blocked` |
| Section label | H2 — `life-event.plan.blockedActions` |
| Visual tone | Grey/muted fill + **warning-adjacent** left border (not error red) |
| Lock indicator | Icon + `life-event.node.blocked` badge |
| Tooltip placeholder | “Why blocked” — `ⓘ` icon → tooltip frame (prototype) |

**Rule:** Blocked cards **never** share a list container with Column A.

#### Column C — Contextual Actions

| Property | Value |
|----------|-------|
| Source | `ActionSurfaceV1.contextualActions` |
| Component | `Section / Collapsible` wrapping `Action Card / Contextual` list |
| Section label | `life-event.timeline.upcomingSteps` inside summary |
| Default state | **Collapsed** (`▶`) |
| Expanded state | Vertical stack of contextual cards |

**Column visibility:**

| Column | Empty state |
|--------|-------------|
| A | Show section shell + “No upcoming actions” caption (`life-event.empty.noUpcomingActions`) |
| B | Hide column OR show “No active blockers” (`life-event.empty.noBlockers`) — designer choice; prefer hide if empty |
| C | Collapsed header only; 0 items = collapsed with empty caption |

**Inter-column gap:** 24px (desktop).

---

### 2.4 Understanding Section

**Figma block:** `Insight / Why This Now`  
**Maps to:** `plan.reasoning.whyThisNow`, `whatIsBlocking` (localized at render)

```
┌──────────────────────────────────────────────────────────────────┐
│  H2  Why this now                                                │
│  • Bullet one (graph intent)                                     │
│  • Bullet two (focus rationale)                                  │
│                                                                  │
│  H2  What is blocking you                                        │
│  • Blocker summary bullet                                        │
│                                                                  │
│  H3  Why progress is constrained                                 │
│  • Narrative bullet                                              │
└──────────────────────────────────────────────────────────────────┘
```

| Sub-block | Key | Emphasis |
|-----------|-----|----------|
| Why this now | `life-event.plan.whyThisNow` | Low — Body bullets |
| Blocker summary | `life-event.plan.whatIsBlocking` | Low |
| Progress constrained | `life-event.plan.whyProgressConstrained` | Lowest — H3 + bullets |

**Layout:**

- Full width (12 cols).
- Vertical text stack; bullet list formatting.
- **Low visual emphasis:** no card border; optional light background `surface/muted`.
- Top divider (1px) separating from Action Breakdown — 48px section gap above.

**Visibility:** Hide entire sub-blocks when planner arrays empty (preserve section shell in component variants).

---

### 2.5 Scenario Overlay Banner (Optional Layer)

**Figma block:** `Overlay / Scenario Hint`  
**Maps to:** `ScenarioMatchV1` (LE-7 only)

```
┌──────────────────────────────────────────────────────────────────┐
│  [Label] Context shift detected                                  │
│  Body: Losing employment shifts your situation toward economic…  │
│  [Optional scenario badge: job_loss]                             │
└──────────────────────────────────────────────────────────────────┘
```

| Element | Key |
|---------|-----|
| Label | `life-event.scenario.contextShiftTitle` |
| Body | `life-event.scenario.{scenarioId}.reasoning` |
| Scenario badge | `Badge / Scenario` — scenarioId for design QA only |

**Placement (choose one in Figma; both valid wireframe variants):**

| Variant | Position | Frame name |
|---------|----------|------------|
| **A (recommended)** | Between Header (§2.1) and Hero (§2.2) | `…/ With Scenario / Below Header` |
| **B** | Top of Action Breakdown (§2.3), above 3-column grid | `…/ With Scenario / Above Actions` |

**Rules:**

- Conditionally visible — use Figma component property `scenarioVisible: boolean`.
- **NOT replacing** plan content — hero and columns unchanged when overlay toggled on.
- Left accent border 3px (interpretive, not alert).
- Do not duplicate scenario copy inside Understanding section.

---

## 3. Component Library Mapping

Create a Figma page: **`Life Event / Components v1.0`**

### 3.1 Action Card

**Component set:** `Action Card`

| Variant | Border | Background | Badge | CTA state |
|---------|--------|------------|-------|-----------|
| **Primary** | 2px accent | elevated | urgency | enabled/disabled |
| **Secondary** | 1px neutral | default | urgency | enabled/disabled |
| **Blocked** | 1px warning + left bar | muted grey | urgency + locked | **always disabled** |
| **Contextual** | 1px neutral | transparent | urgency optional | enabled/disabled |

**Shared anatomy (auto-layout vertical):**

```text
Action Card
├── Row: [Urgency Badge] [Blocked Badge?]
├── Title (H3)
├── Description (Body, 1–2 lines)
└── Row: [Button chips…]
```

**States (component properties):**

| Property | Values |
|----------|--------|
| `variant` | primary \| secondary \| blocked \| contextual |
| `executionState` | default \| disabled |
| `priority` | critical \| high \| medium \| low |
| `hasBlockedBadge` | true \| false |

**Node identity (design QA):** annotate `node.id` in hidden layer — never shown to users; prevents duplicate IDs in layout (§4).

---

### 3.2 Badges

| Component | Variants | Maps to |
|-----------|----------|---------|
| `Badge / Urgency` | critical, high, medium, low | `life-event.severity.*` |
| `Badge / State` | 7 life states | `life-event.state.*` |
| `Badge / Scenario` | 7 scenario IDs | LE-7 registry (design labels only) |
| `Badge / Blocked` | locked | `life-event.node.blocked` |

**Sizing:** height 24px; horizontal padding 8px; text = Caption/Badge.

**Accessibility:** urgency **must include text label** — not color-only dots.

---

### 3.3 Buttons

| Component | Usage | Count per screen |
|-----------|-------|------------------|
| `Button / Primary` | Hero main CTA | **Exactly 1** |
| `Button / Secondary` | Additional node actions | 0–N per card |
| `Button / Disabled` | Blocked cards + execution-disabled | replaces Primary/Secondary visually |

**Sizes:** Primary height 40px; Secondary height 32px; min tap target 44px on mobile.

---

### 3.4 Sections

| Component | Purpose |
|-----------|---------|
| `Section / Collapsible` | Column C contextual — `<details>` behavior |
| `Divider / Section` | 1px line + 48px vertical rhythm |
| `Group / List` | Vertical stack of Action Cards with 16px gap |
| `Section / Empty` | Placeholder copy for empty columns |

---

## 4. Layout Rules (Critical)

| # | Rule | Figma enforcement |
|---|------|-------------------|
| 1 | Primary Action = top priority visual weight | Hero below header only; H1 largest type |
| 2 | Secondary actions **max 3** visible | Column A max 3 card instances |
| 3 | Blocked **never mixed** with active secondary | Separate column B |
| 4 | Contextual **always collapsible** | Column C default collapsed |
| 5 | **No duplicate `node.id`** in one frame | Hidden annotation layer; delete duplicate instances |
| 6 | ExecutionSurface = **disabled styling only** | Swap button variant; no hide/move |
| 7 | Scenario overlay = **optional layer** | Boolean property; no structural diff |
| 8 | Understanding = **below** actions | Fixed section order |

---

## 5. Spacing System

**Base unit:** 8px — all spacing = multiples of 8.

| Token name | Value | Usage |
|------------|-------|-------|
| `space/1` | 8px | Badge internal, tight gaps |
| `space/2` | 16px | Card internal padding; card-to-card gap |
| `space/3` | 24px | Column gutter (desktop); grid gutter |
| `space/4` | 32px | Sub-section gaps |
| `space/5` | 48px | **Section spacing** (Header→Hero, Breakdown→Insight) |
| `space/6` | 64px | Page title → Header (optional) |

| Relationship | Spacing |
|--------------|---------|
| Header → Hero | **largest** — `space/5` (48px) |
| Hero → Action Breakdown | `space/5` (48px) |
| Action Breakdown → Understanding | `space/5` (48px) + divider |
| Inside Action Card | padding `space/2` (16px) |
| Between cards in column | `space/2` (16px) |

**Figma:** define as variables `space/1` … `space/6`.

---

## 6. Typography Hierarchy

Reference sizes for wireframe (scale with design system later):

| Role | Style name | Size (ref) | Weight | Example |
|------|------------|------------|--------|---------|
| **H1** | Primary action title | 28px | 700 | “Secure a registrable address” |
| **H2** | Section titles | 20px | 600 | “Next actions”, “Why this now” |
| **H3** | Card titles | 16px | 600 | Secondary node title |
| **Body** | Descriptions, bullets | 15px | 400 | Plan rationale |
| **Caption** | Metadata, confidence | 13px | 400 | “Your current situation” |
| **Badge** | Smallest system text | 12px | 600 | “Critical”, “New arrival” |

**Line heights:** H1 1.2; Body 1.5; Caption 1.4.

**Localization:** allow H1 wrap to 3 lines; Column A card titles wrap to 2 lines.

---

## 7. Interaction Notes (Figma Prototyping)

Wire prototype connections on **`LifeEventModule / Desktop / v1.0`**:

| Hotspot | Interaction | Target frame / state |
|---------|-------------|----------------------|
| Hero Primary CTA | On tap | `Flow / Action Execution` (placeholder) or external module frame |
| Secondary card CTA | On tap | Same — per `LifeActionRef.href` |
| Blocked card `ⓘ` | On tap | `Tooltip / Why Blocked` (overlay) |
| Blocked card button | — | **No navigation** — disabled |
| Column C summary | On tap | Toggle `Collapsible / Expanded` variant |
| Scenario banner | Optional | Toggle `scenarioVisible` — demo only; no plan change |
| Contextual card CTA | On tap | Action flow placeholder |

**Prototype variables:**

| Variable | Type | Purpose |
|----------|------|---------|
| `scenarioVisible` | boolean | Show/hide overlay |
| `contextualExpanded` | boolean | Column C state |
| `executionDisabled` | boolean | Swap hero CTA to disabled |

**Do not prototype:** planner re-run, scenario engine logic, or plan bucket changes.

---

## 8. Responsive Behavior

### Desktop (1440px) — primary spec

| Section | Layout |
|---------|--------|
| Content | Max 1120px centered |
| Header | Horizontal split |
| Hero | Full width |
| Action Breakdown | **3 columns** (4+4+4 cols) |
| Understanding | Full width |

### Tablet (768px)

| Section | Layout |
|---------|--------|
| Margins | 32px |
| Action Breakdown | **2 columns:** A+B top row; C full width below |
| Hero | Full width unchanged |

```text
┌──────────────┬──────────────┐
│ Secondary    │ Blocked      │
├──────────────┴──────────────┤
│ Contextual (collapsed)      │
└─────────────────────────────┘
```

### Mobile (375px)

| Section | Layout |
|---------|--------|
| Margins | 16px |
| All sections | **Stacked vertical** |
| Action order | Secondary → Blocked → Contextual (collapsed) |
| Contextual | **Always collapsed** default |
| Hero CTA | Full width button |
| Header | Stack: sub-label → state badge → confidence below |

**Breakpoint frames:** duplicate primary frame; swap layout modes — do not create new information architecture.

---

## 9. Visual Emphasis Hierarchy

Rank **1 (dominant) → 5 (lowest)** for wireframe greyscale + weight:

| Rank | Element | Wireframe treatment |
|------|---------|---------------------|
| **1** | Primary Action (Hero) | Darkest border, H1, filled CTA |
| **2** | Secondary Actions (Col A) | Standard cards, H3 titles |
| **3** | Scenario / Context overlay | Light tint band; accent left bar |
| **4** | Blocked Actions (Col B) | Muted fill, lock icon, disabled buttons |
| **5** | Insights (Understanding) | No card chrome; lightest text |

Scenario overlay at rank 3 **does not override** Hero rank 1 when both visible.

---

## 10. Empty / Edge States

Each variant **preserves vertical section order** — no reflow chaos.

### Loading skeleton

**Frame:** `LifeEventModule / Desktop / Loading`

| Section | Skeleton pattern |
|---------|-------------------|
| Page title | 2 rectangle bars (60%, 40% width) |
| Header | Pill + short bar |
| Hero | Large rectangle + 2 lines + button block |
| Breakdown | 3 columns × 2 card rectangles |
| Understanding | 4 bullet bars |

Use `surface/skeleton` animated shimmer in hi-fi; static grey in wireframe.

### No plan state

**Frame:** `LifeEventModule / Desktop / Empty`

| Section | Content |
|---------|---------|
| Header | State unknown OR hidden |
| Hero | `Section / Empty` — `life-event.empty.noPlan` |
| Breakdown | Hidden or greyed shells |
| Understanding | Hidden |

### No profile / error gate

**Frame:** `LifeEventModule / Desktop / Error`

| Section | Content |
|---------|---------|
| Full content area | Error card centered — profile required message |
| Hero + Breakdown + Insight | **Not rendered** |

### Partial plan state

**Frame:** `LifeEventModule / Desktop / Partial`

| Condition | Wireframe |
|-----------|-----------|
| `primaryAction` null | Hero shows empty focus message; Breakdown hidden |
| Blockers only | Col B populated; Col A empty state |
| No contextual | Col C collapsed header only |

---

## 11. Final Frame Description (Key Artifact)

### Composition narrative

The **`LifeEventModule / Desktop / v1.0`** frame is a **structured vertical flow** inside a 1120px content column:

1. **Page title** anchors module identity.
2. **Header** orients the user with life state and plan confidence — left-heavy identity, right-aligned meta.
3. **Optional scenario banner** (LE-7) adds interpretive context without altering plan structure.
4. **Hero** presents **one dominant action** — urgency badge, H1 title, short description, single primary CTA — the largest and highest-contrast element on the page.
5. **Action Breakdown** uses a **tri-column system**: active next steps (neutral), blocked steps (separated, muted, locked), and upcoming timeline steps (collapsed by default).
6. **Understanding** sits below with low emphasis — bullet explanations for “why now” and blockers without competing with actionable cards.

### Designer intent

> A user scanning top-to-bottom sees **one thing to do now**, **what can wait**, **what is blocked**, and **why** — in that order. Blocked actions never compete visually with active tasks. Scenario overlays subtly modify interpretation without changing layout or duplicating the hero.

### Figma deliverable checklist

- [ ] Primary desktop frame + tablet + mobile breakpoints
- [ ] Component page: Action Card (4 variants × states), Badges, Buttons, Sections
- [ ] Prototype with scenario + collapsible toggles
- [ ] Edge frames: Loading, Empty, Error, Partial
- [ ] Hidden `node.id` annotation layer on every Action Card instance
- [ ] Copy via `life-event.*` keys in text layer descriptions (not hardcoded locale in component names)

### Architecture compliance

| System | Wireframe touch |
|--------|-----------------|
| `LifeEventPlanV1` | Header, Understanding content |
| `ActionSurfaceV1` | Hero + 3 columns |
| `ExecutionSurfaceV1` | Button disabled variants only |
| `ScenarioMatchV1` | Optional overlay banner |
| LE-8 Runtime | Out of v1.0 wireframe scope (library unwired) |

**No changes** to LE-1 → LE-8 behavior required to build these frames.

---

## Appendix — Scenario Explorer (below fold)

Separate wireframe block — **not part of primary 5-section flow** but present on live page.

**Figma block:** `Appendix / Scenario Explorer`

| Element | Wireframe |
|---------|-----------|
| Section title | `life-event.explorer.title` |
| Description | `life-event.explorer.description` |
| Form | Schema fields (Event, Timeline, Partner, Children, Current Status) |
| Submit | `common.submit` |

Place **64px** below Understanding section. Visually distinct (divider + muted card) so it is not confused with LE-1 plan.

---

## Appendix — Home condensed card (reference)

**Frame:** `LifeEventModule / Home Card / v1.0`

Subset of primary frame:

- Card title + “View full plan” link
- Optional scenario banner
- Hero Primary Action Card (compact)
- Blocked sub-list (if any)
- Secondary sub-list (if any)

No 3-column breakdown; no Understanding section. Link prototypes to full desktop frame.

---

*Spec version: v1.0 — aligned with frozen LE architecture and [UX Blueprint](./life-event-module-v1.0-ux-blueprint.md).*
