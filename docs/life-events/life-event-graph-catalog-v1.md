---
id: life-event-graph-catalog-v1
title: Life Event Graph Catalog v1
project: Arrival Atlas
system: Arrival Atlas
type: spec
domain: life-events
status: active
maturity: stable
owner: product
tags:
  - life-event
  - life-event-graph
  - graph-catalog
  - planning
  - product-model
created: 2026-06-20
updated: 2026-06-20
depends_on:
  - life-state-model
  - life-event-module-v2
related:
  - life-event-classifier-fixtures
  - life-event-module-v2-spec
  - life-event-module-v2-roadmap
---

# Life Event Graph Catalog v1

**Document type:** Product model — action graph definitions per life state  
**Version:** 1.0.0  
**Status:** Active — authoritative graph design for Life Event Module v2 LE-1  
**Audience:** Product, engineering (graph catalog, planner, golden tests)

**Upstream:** [life-state-model.md](./life-state-model.md) · [life-event-classifier-fixtures.md](./life-event-classifier-fixtures.md)  
**Downstream:** Planner implementation · Home "Your next steps" · `/modules/life-event` plan view

---

# 1. Purpose

The graph catalog answers:

> **For each life state, what is the structured action graph that drives planning?**

### Why graphs exist

Life states classify *where the user is*. Graphs define *what must happen* in that context — in what order, with what dependencies, and what blocks progress. Without graphs, classification produces a label with no actionable structure.

### Three-layer separation

| Layer | Question | This document? |
|-------|----------|----------------|
| **Life State Model** | What situation is the user in? | No — see life-state-model |
| **Graph Catalog** | What action structure applies to that situation? | **Yes** |
| **Planner** | Given facts + graph, what is the plan today? | No — execution logic in LE-1 |

```text
States classify reality.
Graphs define action structure.
Planner resolves structure against current facts.
```

A user in `arrival_unregistered` and a user in `housing_instability` may both need "confirm housing address" — but the **graph** places that step in different phases with different dependencies and rationale.

### What graphs are not

| Graphs are | Graphs are not |
|------------|----------------|
| Dependency maps of life constraints | Flat checklists |
| Versioned planning templates per state | UI step wizards |
| Inputs to reasoning generation | Stored user progress (v1) |
| Stable product definitions | Module-internal implementation detail |

---

# 2. Design Principles

### G1 — One graph per primary state

Each of the seven active life states has exactly one graph in catalog v1.0.0. Secondary conditions modify ranking within a graph — they do not select a different graph.

### G2 — Deterministic structure

Graph topology (nodes, dependencies, phases) is fixed per catalog version. Given the same primary state, the graph structure is identical for every user. Only *which nodes are satisfied, blocked, or focused* varies with situation facts.

### G3 — Dependencies, not display order

Edges express **life constraints** — "registration unlocks tax ID workflow" — not visual layout. A blocked node may still appear in `timeline` with a clear blocker explanation.

### G4 — Germany-specific administrative reality

Nodes reference real German life admin: Anmeldung, Krankenkasse, Agentur für Arbeit, Jobcenter, Wohngeld, Steuer-ID. Generic "complete your profile" is not a graph node — correction of facts supports nodes but is not a substitute for life actions.

### G5 — Actionable nodes only

Every node must link to at least one **action path**:

- Open a domain module (financial reality, healthcare navigation, benefits simulator)
- Correct situation facts in Profile (P3)
- Explore a life-event scenario (arrival, job-loss, move-city, etc.)

Nodes without action paths belong in P4 hints, not the graph.

### G6 — Stable and versioned

Catalog version `1.0.0` ships with LE-1. Changes to node topology require a catalog version bump and fixture re-validation. Wording may evolve; dependency structure should not change without review.

### G7 — Reasoning-ready

Each node carries **rationale** — why it exists in this graph — so the planner can populate `whyThisNow` and `whatIsBlocking` without inventing copy.

### G8 — Not checklists

Nodes can be *satisfied* by situation facts but are never *checked off* by the user in v1. No persistence of node completion. Re-evaluation on every plan read.

### G9 — Shared nodes, distinct graphs

Common administrative steps (registration, insurance) appear in multiple graphs under different phases and dependencies. Shared **node identity** allows consistent reasoning; graph context defines priority.

---

# 3. Graph Structure Model (Conceptual)

Product-language definitions only — no implementation syntax.

### Node

A **node** is a single planning unit — something the user should understand, decide, or complete.

| Attribute (conceptual) | Meaning |
|------------------------|---------|
| **Identity** | Stable label within catalog (e.g. "Complete Anmeldung") |
| **Category** | legal · survival · stabilization · optimization · life_transition |
| **Priority tier** | critical · high · medium · low — within graph |
| **Description** | Plain-language what and why |
| **Action paths** | Where user goes to act (module, profile correction, scenario) |
| **Completion signal** | What situation facts mean this node is satisfied |
| **Rationale** | Why this node exists in this graph |

### Dependency

A **dependency** connects two nodes:

| Type | Meaning |
|------|---------|
| **blocks** | Target cannot be focus until source is satisfied |
| **enables** | Source satisfaction unlocks optional target path |

Example: *Complete Anmeldung* **blocks** *Receive tax ID*.

### Blocker

A **blocker** is a runtime condition — not a graph edge — that prevents progress on a node:

- Upstream dependency unsatisfied
- Secondary condition active (e.g. insurance gap while job-seeking)
- Missing situation facts needed to act

Blockers feed `activeBlocks` and `whatIsBlocking` in the plan.

### Completion condition

What "done" means for a **node** — expressed as situation facts, not user checkbox:

- "Municipal registration confirmed"
- "Health insurance type known and coverage active"
- "Employment status and income basis recorded"

### Transition trigger

What causes the user to **leave this graph** (reclassification to another primary state):

- Survival foundation met → `arrival_stabilizing` or `situation_stable`
- Dominant gap shifts → more specific state (e.g. insurance graph)
- Life crisis → regression to instability state

Transitions are classifier outputs on next plan read — not graph-internal navigation.

---

# 4. Life State Graphs

## Catalog index

| Graph ID | State | Phases | Primary fixtures |
|----------|-------|--------|------------------|
| G1 | `arrival_unregistered` | 4 | F01, F12, F20 |
| G2 | `arrival_stabilizing` | 5 | F02, F22 |
| G3 | `economic_setup_pending` | 4 | F04, F13, F23 |
| G4 | `housing_instability` | 4 | F06, F07, F16 |
| G5 | `insurance_gap` | 4 | F03, F05, F14 |
| G6 | `benefits_exploration` | 4 | F08, F11, F18, F19 |
| G7 | `situation_stable` | 3 | F09, F10, F15, F17, F21, F24 |

---

## 4.1 `arrival_unregistered` — Graph G1

### Intent of this state graph

Establish **legal presence** — user becomes administratively visible in Germany through registration and the documents that follow.

### Entry context

Classifier assigns this state when municipal registration is incomplete — first arrival or re-registration after move (F01, F12, F20).

### Exit condition

**Stability for this graph:** User is registered at a valid address. Planning reclassifies to `arrival_stabilizing` (if other survival gaps remain) or a more specific state.

### Core phases

#### Phase 1 — Immediate priority: Secure registrable address

| Actions | Understand where you can legally register; obtain landlord confirmation (Wohnungsgeberbestätigung) if required |
| Dependencies | None — entry phase |
| Blockers | No lease or sublet permission; landlord refuses confirmation |
| Rationale | Anmeldung requires a valid address — housing and registration are coupled |

**Action paths:** Profile correction (housing) · Explore scenario *move-city* if relocating · Financial Reality if rent affordability unclear

#### Phase 2 — Administrative unlock: Complete Anmeldung

| Actions | Book Bürgeramt appointment; gather passport, rental contract, confirmation; register within legal deadline |
| Dependencies | Phase 1 address clarity **blocks** this if address invalid |
| Blockers | No appointment availability; missing documents; visa status unclear |
| Rationale | Registration is the legal gateway — unlocks tax ID, most insurance paths, employment formalities |

**Action paths:** Explore scenario *arrival* · System Translation for Bürgeramt vocabulary

#### Phase 3 — Stabilization: Mandatory insurance awareness

| Actions | Understand health insurance obligation and enrollment window; begin Krankenkasse process if employment not imminent |
| Dependencies | Phase 2 **enables** smoother insurance enrollment; not strictly blocked in all cases |
| Blockers | User unaware insurance is mandatory — knowledge gap |
| Rationale | Insurance is legally required — awareness must follow registration urgency |

**Action paths:** Healthcare Navigation module

#### Phase 4 — Secondary setup: Banking and tax path

| Actions | Open bank account suitable for rent and salary; know Steuer-ID will arrive after Anmeldung |
| Dependencies | Phase 2 **blocks** tax ID receipt; banking can proceed in parallel |
| Blockers | None critical — supportive phase |
| Rationale | Financial infrastructure supports housing and employment next steps |

**Action paths:** Financial Reality module · Profile correction (housing, migration)

### Critical blockers

- No registrable address
- Missed or unknown Anmeldung deadline
- Residence permit status prevents registration

### Required plan outputs

| Output | Interpretation |
|--------|----------------|
| **currentFocus** | Phase 1 or 2 node — whichever is unsatisfied and highest priority |
| **nextBestActions** | Next 2–4 unsatisfied nodes in phase order |
| **activeBlocks** | Nodes blocked by Phase 1–2 dependencies |
| **timeline** | All four phases in order; satisfied nodes marked implicitly by facts |

### Transitions

| To state | When |
|----------|------|
| `arrival_stabilizing` | Registered; multiple survival domains still open (F02 pattern) |
| `insurance_gap` | Registered; insurance becomes dominant gap |
| `economic_setup_pending` | Registered; no employment or income |
| `housing_instability` | Registration done but housing still unstable |
| `situation_stable` | Rare fast path — registered with job, housing, insurance already confirmed |

---

## 4.2 `arrival_stabilizing` — Graph G2

### Intent of this state graph

**Order early settlement** — user has passed registration crisis but needs a clear sequence across survival domains without overwhelm.

### Entry context

Registered (or never in pre-registration limbo) with multiple open survival fronts and no single dominant gap (F02, F22).

### Exit condition

**Stability for this graph:** Enough survival domains satisfied that a specific state (`insurance_gap`, `economic_setup_pending`, etc.) or `situation_stable` better describes the user.

### Core phases

#### Phase 1 — Immediate priority: Confirm registration outcome

| Actions | Verify Anmeldung completed; update situation if recently moved |
| Dependencies | None if already registered |
| Blockers | Re-registration needed after address change |
| Rationale | Confirm foundation before stacking other tasks |

**Action paths:** Profile correction (migration, housing)

#### Phase 2 — Administrative unlock: Health insurance enrollment

| Actions | Enroll in statutory or private insurance; understand employment-linked vs self-arranged paths |
| Dependencies | Registration **enables** smoother enrollment |
| Blockers | No insurance path chosen; gap between arrival and enrollment |
| Rationale | Mandatory coverage — highest survival priority after registration |

**Action paths:** Healthcare Navigation · Profile correction (health insurance)

#### Phase 3 — Stabilization: Economic path

| Actions | Clarify employment status or job search; record income basis if employed |
| Dependencies | Insurance **enables** employment in some cases; parallel paths allowed |
| Blockers | No income path; language barrier in job market |
| Rationale | Income unlocks sustainable settlement |

**Action paths:** Financial Reality · Profile correction (employment, income) · Explore scenario *arrival* or *job-change*

#### Phase 4 — Stabilization: Housing and banking

| Actions | Confirm housing situation and rent; open bank account for daily life |
| Dependencies | Partially parallel to Phase 3 |
| Blockers | Temporary housing; incomplete rent picture |
| Rationale | Physical and financial base for daily life |

**Action paths:** Profile correction (housing) · Financial Reality

#### Phase 5 — Secondary setup: Benefits awareness

| Actions | If income low or uncertain, understand whether support programs may apply |
| Dependencies | Phases 3–4 **enable** meaningful benefits assessment |
| Blockers | Income and housing too incomplete to explore |
| Rationale | Do not lead with benefits before economic picture exists |

**Action paths:** Benefits Simulator · Explore only if income context exists

### Critical blockers

- Insurance gap with legal exposure
- No economic path at all
- Housing prevents daily stability

### Required plan outputs

| Output | Interpretation |
|--------|----------------|
| **currentFocus** | Earliest unsatisfied phase among 2–4 (insurance or economic usually) |
| **nextBestActions** | Breadth-first: top open survival nodes across phases |
| **activeBlocks** | Cross-phase dependencies (e.g. benefits blocked by missing income) |
| **timeline** | Full phased settlement arc |

### Transitions

| To state | When |
|----------|------|
| `insurance_gap` | Insurance becomes clearly dominant |
| `economic_setup_pending` | Employment/income is clearly dominant |
| `housing_instability` | Housing becomes clearly dominant |
| `benefits_exploration` | Income known; support assessment is main open question |
| `situation_stable` | Survival foundation sufficient (fast settlers) |

---

## 4.3 `economic_setup_pending` — Graph G3

### Intent of this state graph

Establish **economic foundation** — employment path, income clarity, and the admin that connects work to insurance and benefits.

### Entry context

No reliable employment and income picture; economic uncertainty dominates (F04, F13, F23).

### Exit condition

**Stability for this graph:** Employment status defined and income basis sufficient for downstream planning — or benefits exploration becomes the primary context.

### Core phases

#### Phase 1 — Immediate priority: Stabilize employment situation

| Actions | Register with Agentur für Arbeit if unemployed; understand notice periods if in transition; clarify job search obligations |
| Dependencies | None — economic dominance |
| Blockers | Unclear visa/work permission; not registered with agency when required |
| Rationale | Employment status drives insurance, benefits, and daily income |

**Action paths:** Financial Reality · Explore scenario *job-loss* or *job-change* · Profile correction (employment)

#### Phase 2 — Administrative unlock: Insurance continuity

| Actions | Prevent or close insurance gap during employment transition; understand Krankenkasse options while unemployed |
| Dependencies | Phase 1 **enables** correct insurance path (employee vs unemployed) |
| Blockers | Coverage lapsed; confusion between public and private |
| Rationale | Mandatory insurance must not gap during job transition |

**Action paths:** Healthcare Navigation · Profile correction (health insurance)

#### Phase 3 — Stabilization: Income clarity

| Actions | Document or estimate income; understand net pay, tax class basics if employed |
| Dependencies | Phase 1 **enables** meaningful income |
| Blockers | No job offer; undeclared work uncertainty |
| Rationale | Income unlocks budgeting and benefits assessment |

**Action paths:** Financial Reality · Profile correction (income)

#### Phase 4 — Secondary setup: Benefits pathway

| Actions | If income insufficient, explore Bürgergeld, ALG I, or bridging support |
| Dependencies | Phases 1 and 3 **enable** assessment |
| Blockers | Income completely unknown |
| Rationale | Support may be available — exploration follows economic clarity |

**Action paths:** Benefits Simulator · Profile correction (benefits, household)

### Critical blockers

- Work permission unclear
- Insurance lapsed without mitigation plan
- Agency registration required but not done

### Required plan outputs

| Output | Interpretation |
|--------|----------------|
| **currentFocus** | Phase 1 node unless insurance gap is acute (F05 → may reclassify to G5) |
| **nextBestActions** | Employment + insurance continuity nodes |
| **activeBlocks** | Insurance blocked by unknown employment status |
| **timeline** | Economic recovery arc |

### Transitions

| To state | When |
|----------|------|
| `insurance_gap` | Coverage gap dominates (F05) |
| `benefits_exploration` | Income known but low; support is main question |
| `situation_stable` | Employment and income restored |
| `housing_instability` | Job loss led to housing crisis (F16) |

---

## 4.4 `housing_instability` — Graph G4

### Intent of this state graph

**Stabilize housing** — secure registrable address, clarify costs, and unblock registration and benefits that depend on rent.

### Entry context

Housing is the dominant bottleneck — search, temporary stay, missing rent data with planning impact (F06, F07, F16).

### Exit condition

**Stability for this graph:** Stable address, registrable housing, and rent picture sufficient for admin and benefits planning.

### Core phases

#### Phase 1 — Immediate priority: Clarify living situation

| Actions | Determine if current housing is temporary or long-term; understand registration implications |
| Dependencies | None |
| Blockers | Couch-surfing; no lease; illegal sublet |
| Rationale | Cannot plan admin without knowing housing status |

**Action paths:** Profile correction (housing) · Explore scenario *move-city*

#### Phase 2 — Administrative unlock: Secure registrable housing

| Actions | Find apartment or legal sublet; obtain contract and landlord confirmation |
| Dependencies | Phase 1 **blocks** registration at stable address |
| Blockers | Housing market tightness; deposit barriers |
| Rationale | Registrable address unlocks Anmeldung and benefits |

**Action paths:** Financial Reality (affordability) · Profile correction

#### Phase 3 — Stabilization: Registration at address

| Actions | Complete Anmeldung or Ummeldung at new address |
| Dependencies | Phase 2 **blocks** if no valid address |
| Blockers | Landlord won't confirm; between apartments |
| Rationale | Legal address required for most downstream admin |

**Action paths:** Explore scenario *arrival* or *move-city* · Profile correction (migration)

#### Phase 4 — Secondary setup: Rent and benefits linkage

| Actions | Record rent amount; explore Wohngeld if income constrained |
| Dependencies | Phases 2–3 **enable** accurate rent and benefits |
| Blockers | Rent unknown (F07) |
| Rationale | Rent affects benefits and affordability planning |

**Action paths:** Benefits Simulator · Profile correction (housing, income)

### Critical blockers

- No path to registrable address
- Active homelessness or emergency — product surfaces crisis resources; graph may be insufficient alone
- Registration deadline at risk

### Required plan outputs

| Output | Interpretation |
|--------|----------------|
| **currentFocus** | Phase 1 or 2 for active search; Phase 4 for F07 (has home, missing rent) |
| **nextBestActions** | Housing-first nodes |
| **activeBlocks** | Registration blocked by address |
| **timeline** | Housing stabilization arc |

### Transitions

| To state | When |
|----------|------|
| `arrival_unregistered` | Registration incomplete and dominant |
| `benefits_exploration` | Housing stable enough; rent + income support question |
| `economic_setup_pending` | Housing settled but no income |
| `situation_stable` | Housing and core admin complete |

---

## 4.5 `insurance_gap` — Graph G5

### Intent of this state graph

**Secure continuous mandatory health coverage** — enroll, transition, or confirm insurance without legal or financial gap.

### Entry context

Insurance unclear, lapsed, or not established; coverage is dominant constraint (F03, F05, F14).

### Exit condition

**Stability for this graph:** Insurance type known and coverage active or clear enrollment path in progress.

### Core phases

#### Phase 1 — Immediate priority: Assess coverage status

| Actions | Determine if currently insured; identify gap start date if lapsed |
| Dependencies | None |
| Blockers | User has no information from prior Krankenkasse |
| Rationale | Cannot fix gap without knowing it exists |

**Action paths:** Healthcare Navigation · Profile correction (health insurance)

#### Phase 2 — Administrative unlock: Choose insurance path

| Actions | Select GKV vs PKV vs student vs self-employed path based on status |
| Dependencies | Phase 1 **enables** correct path |
| Blockers | Employment status unclear; self-employed path confusion |
| Rationale | Wrong path wastes time and may leave gap open |

**Action paths:** Healthcare Navigation · Financial Reality (if employment-linked)

#### Phase 3 — Stabilization: Enroll or restore coverage

| Actions | Contact Krankenkasse; complete enrollment; confirm no retroactive penalty risk |
| Dependencies | Phase 2 **blocks** enrollment without path |
| Blockers | Between jobs; employer delay; language barrier |
| Rationale | Close the mandatory coverage gap |

**Action paths:** Healthcare Navigation · Profile correction

#### Phase 4 — Secondary setup: Family coverage

| Actions | If household members exist, confirm family insurance rules |
| Dependencies | Phase 3 **enables** family add-ons |
| Blockers | Household composition unknown |
| Rationale | Family coverage is common post-enrollment task |

**Action paths:** Profile correction (household, health insurance)

### Critical blockers

- Active coverage gap with legal exposure
- Registration required before enrollment and not complete → may reclassify to G1
- Self-employed without proactive enrollment

### Required plan outputs

| Output | Interpretation |
|--------|----------------|
| **currentFocus** | Phase 1 or 3 — assess or enroll |
| **nextBestActions** | Insurance path nodes |
| **activeBlocks** | Enrollment blocked by unknown employment path |
| **timeline** | Coverage restoration arc |

### Transitions

| To state | When |
|----------|------|
| `economic_setup_pending` | Insurance OK but employment is now dominant |
| `arrival_stabilizing` | Newcomer with insurance fixed but other gaps |
| `situation_stable` | Coverage confirmed |

---

## 4.6 `benefits_exploration` — Graph G6

### Intent of this state graph

**Assess and navigate state support** — user has enough economic context to explore entitlements without implying automatic eligibility.

### Entry context

Income and employment exist but support relevance is the main open question (F08, F11, F18, F19).

### Exit condition

**Stability for this graph:** User has clarity on benefits relevance — applying, not eligible, or already receiving — and next steps are clear.

### Core phases

#### Phase 1 — Immediate priority: Complete assessment inputs

| Actions | Ensure income, rent, household size, and employment status are known |
| Dependencies | None — but incomplete facts **block** meaningful Phase 2 |
| Blockers | Missing rent (F11 household); missing income components |
| Rationale | Benefits estimates require complete inputs |

**Action paths:** Profile correction (income, housing, household, benefits)

#### Phase 2 — Administrative unlock: Identify relevant programs

| Actions | Distinguish Bürgergeld, ALG I, Wohngeld, Kindergeld, Elterngeld relevance |
| Dependencies | Phase 1 **blocks** accurate identification |
| Blockers | Immigration status limits; fear or stigma |
| Rationale | Programs have different gates — user needs map not single answer |

**Action paths:** Benefits Simulator · Financial Reality

#### Phase 3 — Stabilization: Understand obligations

| Actions | Learn work availability rules, reporting duties, interaction with part-time work |
| Dependencies | Phase 2 **enables** |
| Blockers | Misinformation about "welfare trap" |
| Rationale | Support comes with obligations — user must understand trade-offs |

**Action paths:** Benefits Simulator · Explore scenario *job-loss*

#### Phase 4 — Secondary setup: Application pathway

| Actions | Identify which office (Jobcenter, Wohngeldstelle); prepare document checklist |
| Dependencies | Phase 2 **enables** |
| Blockers | Prior rejection assumed permanent |
| Rationale | Exploration becomes action when user is ready |

**Action paths:** Benefits Simulator · System Translation for official terms

### Critical blockers

- Income or housing too incomplete for any estimate → reclassify to `economic_setup_pending` or `housing_instability`
- Legal residence restricts access — surface uncertainty, not legal advice

### Required plan outputs

| Output | Interpretation |
|--------|----------------|
| **currentFocus** | Phase 1 if inputs missing; Phase 2 if ready to explore |
| **nextBestActions** | Assessment and simulator nodes |
| **activeBlocks** | Simulator blocked by missing rent or household |
| **timeline** | Benefits exploration arc — calmer tone (medium severity) |

### Transitions

| To state | When |
|----------|------|
| `economic_setup_pending` | Income/employment lost |
| `housing_instability` | Housing becomes dominant |
| `situation_stable` | Benefits clarity achieved or not applicable |

---

## 4.7 `situation_stable` — Graph G7

### Intent of this state graph

**Maintain stability and prepare proactively** — optimization, life transitions, and preventive admin without manufactured urgency.

### Entry context

Survival foundation sufficient; no higher-priority state matches (F09, F10, F15, F17, F21, F24).

### Exit condition

**Stability for this graph:** Ongoing — until life transition or new gap triggers reclassification.

### Core phases

#### Phase 1 — Immediate priority: Confirm foundation current

| Actions | Light review — registration, insurance, employment, housing still accurate |
| Dependencies | None |
| Blockers | Silent drift (address changed, not updated) |
| Rationale | Stability requires accuracy — catch drift early |

**Action paths:** Profile correction (any domain) · P4-driven minor gaps only as secondaries

#### Phase 2 — Administrative unlock: Life transition readiness

| Actions | Explore upcoming changes — job change, move, marriage, childbirth, visa renewal |
| Dependencies | Phase 1 satisfied |
| Blockers | None — optional phase |
| Rationale | Stable users need transition planning, not crisis response |

**Action paths:** Explore scenarios (*job-change*, *move-city*, *childbirth*, *visa-renewal*, etc.)

#### Phase 3 — Secondary setup: Optimization

| Actions | Tax class review, financial optimization, language courses, integration |
| Dependencies | None critical |
| Blockers | None — user-driven |
| Rationale | Value-add without urgency |

**Action paths:** Financial Reality · System Translation · scenario exploration

### Critical blockers

- None in stable state — **reclassification** is the response to new crises
- Minor data gaps (F21, F24) are secondaries, not graph blockers

### Required plan outputs

| Output | Interpretation |
|--------|----------------|
| **currentFocus** | Phase 2 if `life_transition_pending` secondary; else Phase 3 optimization or Phase 1 drift fix |
| **nextBestActions** | 2–4 optional proactive steps — never alarmist |
| **activeBlocks** | Usually empty; transition prep may note upcoming deadlines |
| **timeline** | Short — stable users see concise plan |

### Transitions

| To state | When |
|----------|------|
| `economic_setup_pending` | Job loss (F04, F23) |
| `housing_instability` | Move or housing loss (F16) |
| `insurance_gap` | Coverage lapse |
| `benefits_exploration` | Income drop; support question emerges |
| `arrival_unregistered` | Re-registration required (F12) |

---

# 5. Cross-State Relationships

Graphs are **not isolated silos**. They share structured DNA.

## Shared node families

| Node family | Appears in graphs | Role varies |
|-------------|-------------------|-------------|
| **Registration (Anmeldung)** | G1, G2, G4 | Phase 1–2 in G1; confirmatory in G2; post-housing in G4 |
| **Health insurance** | G1–G5, G7 | Awareness in G1; enrollment in G2; continuity in G3; dominant in G5 |
| **Employment / income** | G2–G4, G6–G7 | Parallel in G2; dominant in G3; affordability in G4; input in G6 |
| **Housing / rent** | G1–G4, G6 | Address for registration in G1; parallel in G2; dominant in G4; input in G6 |
| **Benefits assessment** | G2, G3, G6 | Late phase in G2–G3; dominant in G6 |
| **Banking** | G1, G2 | Secondary setup |
| **Life transition exploration** | G7 | Dominant optional path |

## Structural divergence

| Graph | Unique structural emphasis |
|-------|---------------------------|
| G1 | Registration **is** the graph center |
| G2 | **Breadth** — parallel survival phases |
| G3 | Employment-insurance **coupling** |
| G4 | Housing-registration **chain** |
| G5 | Insurance path **selection** depth |
| G6 | Assessment-input **gate** before exploration |
| G7 | **Optional** phases — no survival chain |

## Reclassification = graph switch

When transition triggers fire, the planner does not "navigate" between graphs internally. On next read:

1. Classifier may assign new primary state
2. New graph loads
3. Shared nodes may appear satisfied from facts — planner skips or de-emphasizes them

Example: User completes Anmeldung (G1 Phase 2 satisfied) → reclassified to `arrival_stabilizing` → G2 Phase 1 may already be satisfied; focus moves to G2 Phase 2 insurance.

---

# 6. Graph-to-Plan Mapping Rules

How **Life State + Graph + Facts + Secondaries** produce plan outputs. Product rules only — no pseudocode.

### currentFocus selection

1. Load graph for primary state
2. Walk phases in order
3. First **unsatisfied** node in highest-priority open phase becomes focus
4. If secondary condition has **critical** urgency (e.g. `insurance_gap` secondary while in G3), boost that node's family within graph — never override legal/registration focus in G1
5. Planning severity of state sets Home tone — critical states never show optimization as focus

### nextBestActions derivation

1. Begin with focus node
2. Add next unsatisfied nodes in same phase, then following phases
3. Cap at **4 actions** for Home; full set on module page
4. Skip satisfied nodes (facts confirm completion)
5. Demote nodes whose dependencies are blocked — they may appear in timeline but not in top actions

### activeBlocks computation

1. For each unsatisfied node with unsatisfied **blocks** dependency, add to activeBlocks
2. Add secondary conditions that map to blocked node families
3. Express as plain-language blockers — not graph IDs

### timeline interpretation

1. Full graph phase order preserved
2. Satisfied nodes included but visually de-emphasized in module UI
3. Blocked nodes show dependency explanation
4. Timeline is **interpretive** — not a promise of chronological completion dates

### reasoning generation

| Field | Source |
|-------|--------|
| **whyThisNow** | Focus node's rationale + state intent + phase context |
| **whatIsBlocking** | activeBlocks + secondary conditions + dependency explanations |
| **planConfidence** | Derived from P4 when available (LE-2 API input); else from fact completeness |

Secondary conditions enrich reasoning — they do not change graph selection.

---

# 7. Consistency Check

| Check | Result |
|-------|--------|
| Every active state has a graph | ✅ G1–G7 cover all 7 states |
| No graph duplicates another entirely | ✅ Each has distinct phase emphasis (§5) |
| No graph is just a checklist | ✅ All use dependencies, blockers, completion signals |
| Each graph changes prioritization logic | ✅ G1 legal-first vs G6 assessment-first vs G7 optional |
| Each graph is actionable | ✅ Every phase has action paths |
| Fixtures align | ✅ Index maps F01–F24 to graphs via primary state |
| Secondary conditions fit | ✅ Modify rank within graph — catalog consistent |
| LE-1 scope | ✅ G1–G3 deepest authoring priority per roadmap; G4–G7 defined here for full catalog |

**No remediation required** — catalog v1.0.0 is internally consistent.

---

# 8. Golden Alignment Notes

### Life State Model

- Graph G1–G7 map 1:1 to states in life-state-model v1.1
- Planning severity flows from state → Home tone
- Classifier priority order selects graph; graph does not select state
- Secondary conditions adjust within-graph ranking per life-state-model §Secondary Conditions

### Classifier Fixtures

| Fixture group | Graph | Expected focus phase |
|---------------|-------|-------------------|
| F01, F12, F20 | G1 | Phase 1–2 (address / Anmeldung) |
| F02, F22 | G2 | Phase 2–3 (insurance / economic) |
| F04, F23 | G3 | Phase 1 (employment) |
| F05 | G3 or G5 | F05 primary economic — insurance as secondary boost in G3 |
| F06, F16 | G4 | Phase 1–2 (housing) |
| F07 | G4 | Phase 4 (rent) |
| F03, F14 | G5 | Phase 2–3 (path / enroll) |
| F08, F18, F19 | G6 | Phase 2 (identify programs) |
| F09, F10 | G7 | Phase 3 or minimal |
| F15, F17 | G7 | Phase 2 (life transition) |
| F21, F24 | G7 | Phase 1 minor — secondaries only |

Engineering golden tests: **fixture → classify → load graph → assert focus phase and top actions**.

### Life Event Module v2 Spec

- Plan output fields (`currentFocus`, `nextBestActions`, `activeBlocks`, `timeline`, `reasoning`) populated per §6
- Graph catalog version `1.0.0` referenced in plan `generatedAt` context
- Module action paths align with spec §8.3 cross-links

### Home "Your next steps"

- Home shows **currentFocus** + **nextBestActions** from resolved graph
- Critical severity graphs (G1, G5) always produce visible urgent focus
- Stable graph (G7) produces calm, short action set
- LE-6: P4 hints deduplicated when graph already covers same node family

---

## Document maintenance

| Change | Action |
|--------|--------|
| New node in graph | Version bump; re-validate affected fixtures |
| New primary state | New graph section + classifier update — not in v1 |
| Dependency change | Update §5 cross-state notes + golden tests |
| Wording only | Patch catalog revision note — no version bump |

**Canonical chain:**

```text
life-state-model.md
  → life-event-classifier-fixtures.md
  → life-event-graph-catalog-v1.md   ← this document
  → LE-1 implementation
```

**After this document:** No new product decisions required for LE-1 graph catalog implementation.
