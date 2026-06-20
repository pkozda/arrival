---
id: life-state-model
title: Life State Model — Canonical Reference for Life Event Planning
project: Arrival Atlas
system: Arrival Atlas
type: spec
domain: life-events
status: active
maturity: stable
owner: product
tags:
  - life-event
  - life-state
  - product-model
  - planning
  - germany
created: 2026-06-20
updated: 2026-06-20
depends_on:
  - life-event-module-v2
  - profile-ux-discovery
related:
  - life-event-module-v2-spec
  - life-event-module-v2-roadmap
  - life-event-classifier-fixtures
  - life-event-graph-catalog-v1
  - profile-ux-discovery
---

# Life State Model

**Document type:** Product model — canonical life-state reference  
**System:** Arrival Atlas  
**Version:** 1.1  
**Status:** Active — authoritative for Life Event Module v2 planning  
**Audience:** Product, design, engineering (classifier, graph catalog, reasoning, fixtures)

---

## Purpose

This document answers:

> **What life situations can a user be in, and what does each situation mean for planning next steps in Germany?**

It is the canonical reference for:

- Life state classification in the Life Event planning engine
- Graph catalog design (which action graph applies to which situation)
- Planner reasoning ("why this now")
- Golden test fixture design
- Future state expansion discussions

### Position in the product stack

```text
P1–P3  →  what is true        (situation facts)
P4     →  what it means       (confidence, gaps, provenance)
Life Event  →  what to do next   (action plan — guided by this model)
```

A user’s **life state** is not a stored fact. It is a **planning context** — a derived label that tells the planner which constraints, priorities, and transitions matter right now.

### Active life states (v1)

| State ID | Short label | Planning severity |
|----------|-------------|-------------------|
| `arrival_unregistered` | New arrival, registration incomplete | **critical** |
| `insurance_gap` | Health insurance not established | **critical** |
| `housing_instability` | Housing situation unclear or incomplete | **high** |
| `economic_setup_pending` | Income and employment foundation missing | **high** |
| `arrival_stabilizing` | Early settlement, basics still forming | **high** |
| `benefits_exploration` | May qualify for support — needs assessment | **medium** |
| `situation_stable` | Core life admin in place — optimization phase | **low** |

### Planning pipeline (product model)

```text
Situation facts (P1–P3)
        ↓
Primary state classification     ← one dominant planning context
        +
Secondary conditions             ← additional constraints (0–n)
        ↓
Graph catalog selection          ← one graph per primary state
        ↓
Planner (rank + reason)
        ↓
Home + module experience
```

**Ownership boundaries:**

| Concept | Owner | Role |
|---------|-------|------|
| Life **state** | This document | Dominant planning context — selects graph |
| **Secondary condition** | This document | Additional constraint — adjusts ranking & reasoning |
| **Graph node** | Spec / graph catalog | Actionable step within a state |
| **P4 missing-context hint** | P4 | Interpretation signal — maps to secondary conditions in LE-5 |
| **FTU onboarding** | Home FTU | Product onboarding — not life planning |
| **Module suggestion** | Deprecated LE-4 | Replaced by life-event plan |

---

## Planning Severity

**Planning severity** describes how urgently the planner should treat a **primary state** for Home surfacing and focus selection. It is not a user-facing label in v1 — it guides ranking and emphasis.

| Severity | Meaning | Home behavior |
|----------|---------|---------------|
| **critical** | Legal or mandatory survival risk — delay has consequences | Always surface; never bury below optimization |
| **high** | Structural instability — user cannot plan reliably | Primary focus; full next-actions block |
| **medium** | Important but assessable — user has foundation to explore options | Visible plan; calmer tone |
| **low** | Maintenance and optimization — no acute crisis | Light touch; scenario exploration welcome |

Severity applies to **primary states only**. Secondary conditions have their own urgency (see Secondary Conditions).

---

## 1. `arrival_unregistered`

### Planning severity: **critical**

**Rationale:** Municipal registration is a legal obligation with deadlines. Without it, most administrative life in Germany cannot proceed reliably. Planner must treat this as highest urgency among active states when entry conditions are met.

### Definition

The user has recently arrived in Germany (or is in the first phase of establishing legal residence) and has not yet completed the foundational registration steps that unlock most administrative life — especially **Anmeldung** (municipal registration at the Bürgeramt).

### User perspective

> *"I recently arrived and I'm still trying to complete the basic registration steps. I don't fully know what I'm supposed to do first or in what order."*

### Entry conditions

- User indicates or behaves as a new arrival in Germany
- Core registration status is unknown or clearly incomplete
- User may have a place to stay but has not confirmed completion of municipal registration
- User may lack clarity on residency status relative to local registration requirements

### Exit conditions

- User has completed municipal registration (Anmeldung) or equivalent confirmation
- User can be treated as legally present at an address for administrative purposes
- Planning can shift from "first legal steps" to "building a stable daily life"

### Primary user goal

**Become legally and administratively visible** — register address, obtain documents that other institutions require, and stop living in a pre-registration limbo.

### Typical planning priorities

1. **Registration** — Anmeldung, understanding deadlines and required documents
2. **Housing** — confirm address validity for registration (Wohnungsgeberbestätigung)
3. **Health insurance** — understand mandatory coverage obligation and timeline
4. **Banking** — open account for rent, salary, and official correspondence
5. **Residency / visa** — if applicable, align immigration status with registration steps

### Common blocking factors

- No appointment at Bürgeramt or long waiting times
- Landlord has not provided housing confirmation
- Unclear visa or residence permit status
- Language barrier at administrative offices
- User does not know registration is time-sensitive (typically within 14 days of move-in)

### Related life transitions

- **Arrival** (primary)
- **Move to another city** (re-registration)
- **Visa renewal** (if status and registration are intertwined)

### Planning notes

- **Legal obligations outrank everything else** in this state — especially registration and mandatory insurance awareness
- Missing registration **blocks** downstream workflows: tax ID, many insurance enrollments, employment formalities
- Do not push optimization tasks (language courses, cost-saving tips) ahead of registration clarity
- Surface deadlines and institutions in plain language — user is often anxious and overwhelmed
- Housing and registration are tightly coupled — address problems often explain registration delays

---

## 2. `arrival_stabilizing`

### Planning severity: **high**

**Rationale:** Not always legally acute like registration, but multiple survival fronts are open simultaneously. User needs strong ordering guidance — breadth of risk warrants high urgency even when no single crisis dominates.

### Definition

The user has moved past the most urgent registration crisis (or was never in a full pre-registration limbo) but is still in the **early settlement phase** — building the practical foundation of life in Germany. Core systems are partially in place; several survival-level domains remain incomplete.

### User perspective

> *"I'm here and I've started the paperwork, but my life still feels unsettled. I'm juggling housing, work, insurance, and daily admin and I'm not sure what to tackle next."*

### Entry conditions

- User is not in acute pre-registration limbo, but settlement is incomplete
- One or more survival-level areas remain open: stable housing picture, income, insurance, banking
- User may have completed Anmeldung but not yet stabilized work, coverage, or finances
- User presents as "new-ish" to Germany with partial progress across domains

### Exit conditions

- Survival-level domains are sufficiently established that planning can focus on specific gaps rather than broad settlement
- User is routed to a more specific state (`economic_setup_pending`, `housing_instability`, `insurance_gap`) OR progresses toward `situation_stable`
- User no longer needs a "general early settlement" framing

### Primary user goal

**Build a stable foundation** — turn arrival chaos into a workable daily life with address, income path, coverage, and basic financial infrastructure.

### Typical planning priorities

1. **Housing** — confirm living situation, rent, contract clarity
2. **Income / employment** — job, job search, or income source
3. **Health insurance** — enroll or confirm coverage
4. **Banking** — salary-ready account, direct debits
5. **Tax and employment admin** — tax ID, employment registration awareness
6. **Benefits awareness** — if income is low or uncertain, know what support may exist

### Common blocking factors

- Competing urgent tasks without clear ordering
- Employment not yet secured — delays insurance and benefits assessment
- Temporary housing — uncertainty about address and contracts
- User completed one step (e.g. registration) but does not know what unlocks next
- Administrative letters in German user cannot interpret

### Related life transitions

- **Arrival** (continuing)
- **Job change** / **Job loss** (if early employment is unstable)
- **Move to another city**
- **Childbirth** / **Marriage** (if family forms early in settlement)

### Planning notes

- This is a **breadth-over-depth** state — user needs ordering, not a flat checklist
- Prioritize **survival constraints** (housing, income, insurance) over integration extras
- Registration may already be done — do not repeat Anmeldung guidance unless signals suggest otherwise
- Good state for **cross-domain explanations** ("insurance matters for employment"; "rent affects benefits estimates")
- Transition users to narrower states as soon as one dominant gap emerges

---

## 3. `economic_setup_pending`

### Planning severity: **high**

**Rationale:** Without income or employment clarity, insurance, benefits, and housing planning are unreliable. Economic foundation is a structural prerequisite — not always legal emergency, but high planning urgency.

### Definition

The user's most pressing planning context is **economic foundation** — employment status, income, or both are missing, unclear, or insufficient for stable life planning. Other domains may be partially fine, but without income clarity most financial and benefits planning is unreliable.

### User perspective

> *"I don't have a stable job or income sorted out yet. I need to figure out how I'll support myself and what my options are."*

### Entry conditions

- No clear employment situation established
- No reliable income picture available
- User may be unemployed, between jobs, seeking first employment in Germany, or entering self-employment
- Economic uncertainty is the **dominant** planning constraint

### Exit conditions

- User has a defined employment status and/or income basis sufficient for downstream planning
- Benefits exploration may become relevant if income remains low but is now known
- User may move to `situation_stable` or `benefits_exploration` depending on income level

### Primary user goal

**Establish an economic base** — secure or clarify employment, understand take-home income, and know what financial obligations and options apply.

### Typical planning priorities

1. **Employment** — job search, contract, notice periods, registration with authorities
2. **Income** — understand gross/net, pay cycles, tax class basics
3. **Health insurance** — mandatory coverage tied to employment status
4. **Benefits** — Bürgergeld, ALG I, Wohngeld if income is insufficient
5. **Banking** — account suitable for salary and benefits
6. **Registration / admin** — only if still blocking employment or benefits access

### Common blocking factors

- No job offer and unclear Jobcenter or Agentur für Arbeit obligations
- Gap between jobs — insurance continuity risk
- Foreign qualifications not recognized — delayed employment
- Language barrier in job market
- User does not understand difference between unemployment insurance and citizen's income support

### Related life transitions

- **Job loss** (primary entry path)
- **Job change**
- **Arrival** (without job offer)
- **Visa renewal** (employment-dependent permits)

### Planning notes

- **Income clarity unlocks** benefits simulation, tax understanding, and realistic housing budgeting
- Insurance and employment are tightly linked in Germany — surface continuity risks during gaps
- Do not treat "get any job" and "understand financial reality" as the same action — both may be needed
- Legal registration issues, if still present, outrank job search only when they **block** employment or benefits access
- Self-employment and freelancing are economically distinct — future state expansion may split this

---

## 4. `housing_instability`

### Planning severity: **high**

**Rationale:** Housing uncertainty undermines registration, benefits, and daily stability. Urgent when dominant — can escalate toward critical if registration is blocked by address issues (primary may shift to `arrival_unregistered`).

### Definition

The user's housing situation is **incomplete, uncertain, or financially unclear** in ways that affect legal registration, benefits estimates, or daily stability. This state applies when housing — not employment or insurance — is the dominant planning bottleneck.

### User perspective

> *"I'm not fully settled with where I live — maybe I'm still looking, or I don't have my rent and address details sorted, or I'm not sure how housing affects my benefits."*

### Entry conditions

- Living location is unknown, temporary, or not reflected in user's situation
- Rent amount or housing cost picture is missing where it matters for planning
- User may be couch-surfing, in temporary accommodation, or between apartments
- Housing gaps block registration, benefits, or financial planning

### Exit conditions

- User has a stable address picture and sufficient housing cost information for planning
- Housing is no longer the dominant constraint — planner routes to other states if gaps remain
- User may still have housing quality concerns but not planning-critical instability

### Primary user goal

**Stabilize where and how they live** — secure housing, clarify rent and contract, and ensure address supports registration and benefits.

### Typical planning priorities

1. **Housing search / contract** — lease, sublet rules, deposit, notice periods
2. **Registration** — address change, Anmeldung at new address
3. **Rent and costs** — cold rent, utilities, affordability
4. **Benefits** — Wohngeld, KdU (housing cost) components in social support
5. **Employment / income** — affordability linkage
6. **Household** — family size affects housing need and benefits

### Common blocking factors

- Cannot find long-term housing in tight market
- Landlord will not provide registration confirmation
- User does not know rent amount or contract type
- Recent move — re-registration not done
- Shared housing — unclear legal status for Anmeldung

### Related life transitions

- **Arrival**
- **Move to another city** (primary)
- **Job change** (relocating for work)
- **Divorce** / **Separation** (housing change)
- **Childbirth** (need for larger housing)

### Planning notes

- Housing and **registration** are coupled — flag when address blocks Bürgeramt steps
- Rent information affects **benefits estimates** — incomplete rent is a planning gap, not just a profile gap
- Distinguish "looking for apartment" from "have apartment but data incomplete" in reasoning copy, not necessarily as separate states yet
- Do not deprioritize housing when user is otherwise employed — unstable housing undermines everything
- Wohngeld and social housing logic may apply — link to benefits exploration when income is known

---

## 5. `insurance_gap`

### Planning severity: **critical**

**Rationale:** Health insurance is mandatory in Germany. Gaps create legal and financial exposure. When insurance is the dominant constraint, planner treats it with same tier as registration crises — below only `arrival_unregistered` when registration itself blocks enrollment.

### Definition

The user lacks a clear **health insurance** situation — uninsured, unknown coverage, gap between systems, or transition risk. In Germany, health insurance is mandatory and affects employment, benefits, and access to care; an insurance gap is a high-urgency planning context.

### User perspective

> *"I'm not sure if I'm properly insured, or I'm between jobs and worried about my health coverage."*

### Entry conditions

- Health insurance status is unknown or clearly not established
- User may be between employment and lost prior coverage
- New arrival may not have enrolled in statutory or private insurance
- User may not understand mandatory insurance rules

### Exit conditions

- User has confirmed insurance type and coverage status adequate for planning
- Insurance continuity is established or a clear enrollment path exists
- Dominant constraint shifts to another domain

### Primary user goal

**Secure continuous health coverage** — enroll, transition, or confirm insurance without gaps that create legal or financial risk.

### Typical planning priorities

1. **Health insurance enrollment** — GKV, PKV, student insurance, etc.
2. **Employment linkage** — how job status affects insurance
3. **Gap coverage** — between jobs, arrival window, visa-related requirements
4. **Family coverage** — spouse, children on policy
5. **Benefits** — if uninsured and low income, social insurance via Jobcenter paths
6. **Registration** — sometimes required before insurance enrollment

### Common blocking factors

- Between jobs — employer deregistered from Krankenkasse
- Confusion between public and private insurance
- Student status change — insurance type must change
- Self-employment — must proactively choose insurance
- Language barrier with Krankenkasse
- User unaware of retroactive coverage rules and penalties

### Related life transitions

- **Job loss** (primary)
- **Job change**
- **Arrival**
- **Childbirth** (family insurance)
- **Marriage** (family coverage)
- **Student-to-work transition** (future state candidate)

### Planning notes

- Insurance gaps are **legal and financial risk** — treat as high urgency, below only registration when registration blocks insurance
- Employment transitions are the most common insurance gap trigger — surface continuity explicitly
- Do not bundle insurance with generic "healthcare navigation" without explaining **mandatory coverage** distinction
- Family composition changes insurance obligations — household context matters in reasoning
- Arrival users need enrollment timeline awareness (typically within months of arrival)

---

## 6. `benefits_exploration`

### Planning severity: **medium**

**Rationale:** Financially important but typically assessable — user often has enough context to explore. Urgent for low-income households, but survival basics are usually partially in place. Tone should be supportive, not alarmist.

### Definition

The user has enough economic context to explore **state support and benefits** — but has not yet established what they may qualify for or how support interacts with work, housing, and insurance. This is an assessment and decision state, not yet "receiving benefits."

### User perspective

> *"I think I might be entitled to some support — housing help, unemployment benefits, or citizen's income — but I don't know what applies to me or what I should apply for."*

### Entry conditions

- Income and/or employment picture exists but suggests possible eligibility for support
- User may be low-income, unemployed, underemployed, or facing high housing costs
- Benefits situation is unknown or not yet explored
- User is not in a more urgent survival crisis that must be resolved first (or that crisis is already handled)

### Exit conditions

- User has clarity on benefits relevance — applying, not eligible, or support already reflected in situation
- Planning shifts to stability or specific life transitions
- Economic picture changes enough to reclassify (e.g. full employment → `situation_stable`)

### Primary user goal

**Understand and access appropriate support** — know which benefits may apply, what trade-offs exist, and what to do next without wrong assumptions.

### Typical planning priorities

1. **Benefits assessment** — Bürgergeld, ALG I, Wohngeld, Kindergeld, etc.
2. **Employment obligations** — work requirements, availability rules
3. **Housing costs** — rent level affects housing benefit components
4. **Household** — family size, children affect rates
5. **Insurance** — coverage while on benefits
6. **Application pathways** — Jobcenter, Wohngeldstelle, other institutions

### Common blocking factors

- Fear of stigma or misunderstanding of "welfare"
- Incomplete rent or income data — cannot estimate entitlements
- Immigration status limits benefit access — user may not know restrictions
- Complex interaction between benefits and part-time work
- Prior rejection — user assumes ineligibility without re-assessment

### Related life transitions

- **Job loss** (primary)
- **Arrival** (without sufficient income)
- **Childbirth** (Elterngeld, Kindergeld, increased needs)
- **Divorce** (household income change)
- **Move to another city** (Wohngeld recalculation)

### Planning notes

- Benefits planning **requires** income and housing context — do not surface benefits-first if economic picture is empty (route to `economic_setup_pending`)
- Emphasize **exploration and estimation** — not automatic entitlement
- Legal residence status may affect eligibility — note uncertainty without legal advice overreach
- Cross-link employment and benefits — working part-time while receiving support has rules
- This state is often **temporary** during a life transition, not a long-term identity

---

## 7. `situation_stable`

### Planning severity: **low**

**Rationale:** Core admin is in place. Planner should not manufacture urgency. Focus on transitions, optimization, and preventive maintenance — user trust depends on calm accuracy here.

### Definition

The user's **core administrative foundation** is in place — registration, housing picture, income basis, and insurance are sufficiently established for day-to-day life planning. Remaining tasks are primarily **optimization, life transitions, or maintenance** rather than survival-level setup.

### User perspective

> *"The basics are sorted — I have a place, work, and insurance. Now I want to know what to improve, prepare for, or plan next."*

### Entry conditions

- No dominant survival-level gap in registration, housing, income, or insurance
- User's situation is complete enough for proactive rather than reactive planning
- May still have minor gaps — but none that redefine the whole planning context

### Exit conditions

- A major life transition or new gap emerges (job loss, move, divorce, etc.)
- User is reclassified into a specific instability state
- Stability is ongoing — user may remain here across many sessions

### Primary user goal

**Maintain stability and prepare for what's next** — optimize finances, handle life events, integrate, and avoid silent admin drift.

### Typical planning priorities

1. **Life transitions** — marriage, job change, move, childbirth, visa renewal
2. **Financial optimization** — tax class, savings, contracts
3. **Language and integration** — courses, long-term settlement
4. **Benefits review** — if circumstances change
5. **Family administration** — schools, Kindergeld, partnerships
6. **Preventive admin** — renewals, document updates

### Common blocking factors

- Complacency — user unaware renewal or re-registration is due
- Upcoming life event not yet modeled in situation
- Slow admin drift (e.g. address change not registered)
- User wants optimization but product surfaces only crisis tasks

### Related life transitions

- **Job change**
- **Marriage** / **Divorce**
- **Childbirth**
- **Move to another city**
- **Visa renewal**
- All episodic scenarios — primary audience for scenario exploration mode

### Planning notes

- Default **optimization and transition** framing — not survival panic
- Surface **upcoming renewals and life events** proactively
- Minor gaps can be mentioned without reclassifying — use P4-style hints for small corrections
- This is the natural home for **scenario exploration** (job loss what-if, move planning) without implying crisis
- Do not invent urgency — user trust depends on calm, accurate guidance here

---

# Secondary Conditions

Secondary conditions complement the **one primary state** model. They capture additional constraints that matter for planning and reasoning **without** becoming parallel states.

## Definition

A **secondary condition** is a derived signal that:

- Does **not** select the graph catalog (primary state does)
- **Does** influence node ranking, blocker messaging, and reasoning depth
- May overlap semantically with a state name — but only one can be **primary**
- Maps naturally to P4 missing-context hints and low-confidence signals (LE-5)

```text
Primary state:     economic_setup_pending
Secondary:         insurance_gap, housing_data_missing
```

## Rules

| Rule | Detail |
|------|--------|
| **Not parallel states** | Secondary conditions never replace primary classification |
| **0–n per user** | Zero is valid; complexity does not require inflation |
| **Planner inputs** | Used for ranking boosts, `whatIsBlocking`, cross-links |
| **Not user-facing labels** | Surfaced as plain-language reasoning, not state names |
| **P4 bridge** | P4 hints and low-confidence map to conditions — not duplicate Home cards (LE-5) |

## Canonical secondary condition catalog (v1)

| Condition ID | Meaning | Typical urgency |
|--------------|---------|-----------------|
| `registration_incomplete` | Registration not confirmed — when **not** primary (e.g. re-registration after move) | critical |
| `insurance_gap` | Coverage unclear or gap risk — when **not** primary | critical |
| `housing_data_missing` | Location or rent picture incomplete for planning | high |
| `housing_search_active` | Actively seeking housing — instability in progress | high |
| `employment_data_missing` | Employment status unknown or stale | high |
| `income_data_missing` | Income unknown — blocks benefits and budgeting | high |
| `benefits_data_missing` | Support situation unexplored despite eligibility signals | medium |
| `household_data_missing` | Family size or composition unclear — affects benefits and housing | medium |
| `banking_not_established` | No suitable bank account for salary, rent, or benefits | medium |
| `re_registration_required` | Address change requires new Anmeldung | high |
| `life_transition_pending` | User facing or exploring a major life change (job loss, move, etc.) | medium |
| `low_planning_confidence` | P4 signals uncertainty in a domain relevant to current plan | medium |

### When a condition shares a state name

`insurance_gap` exists as both a **primary state** and a **secondary condition**.

| Situation | Classification |
|-----------|----------------|
| Insurance is the **dominant** life bottleneck | Primary: `insurance_gap` |
| User is primarily job-seeking but also uninsured | Primary: `economic_setup_pending` · Secondary: `insurance_gap` |
| User is stable but coverage recently lapsed | Primary: `situation_stable` · Secondary: `insurance_gap` |

Same logic applies to housing: `housing_instability` (primary) vs `housing_data_missing` (secondary when another state dominates).

## Secondary vs data quality

Secondary conditions describe **planning relevance**, not profile completeness scoring.

| ✅ Valid secondary | ❌ Not a secondary — use P4 hint only |
|--------------------|--------------------------------------|
| `income_data_missing` when benefits estimate is needed | `profile_40_percent_complete` |
| `housing_data_missing` when rent affects Wohngeld path | Generic completeness score |
| `low_planning_confidence` when P4 flags income uncertainty | Raw confidence enum without planning link |

---

# Classifier Priority Order

When multiple states could apply, the classifier assigns **exactly one primary state** using this priority order (highest wins):

| Priority | Primary state | When to assign |
|----------|---------------|----------------|
| 1 | `arrival_unregistered` | Registration not completed — first arrival or pre-registration limbo |
| 2 | `insurance_gap` | Mandatory coverage unclear or gap — **and** registration does not supersede as primary blocker |
| 3 | `housing_instability` | Housing is the **dominant** bottleneck (search, temp housing, missing address for admin) |
| 4 | `economic_setup_pending` | No employment **and** no income clarity — economic dominance |
| 5 | `benefits_exploration` | Income/employment exist but support assessment is the main open question |
| 6 | `arrival_stabilizing` | Multiple survival gaps, none dominant per rules 1–5 — early settlement breadth |
| 7 | `situation_stable` | Survival foundation sufficient — default when no higher rule matches |

### Resolution notes

- **Registration vs insurance:** If user cannot enroll in insurance **because** registration is incomplete → primary is `arrival_unregistered`, secondary may include `insurance_gap`.
- **Housing vs economic:** Couch-surfing without job → housing dominates if admin address is the blocker; economic dominates if housing is settled but no income.
- **Benefits vs economic:** If user has zero income picture → `economic_setup_pending`, not `benefits_exploration`. Benefits state requires enough economic context to explore.
- **`arrival_stabilizing` is a breadth state:** Use when newcomer has partial progress across domains but no single dominant constraint. Prefer a specific state when one clearly wins.

### Secondary condition detection

After primary assignment, evaluate secondary conditions **independently** — any number may apply. See [life-event-classifier-fixtures.md](./life-event-classifier-fixtures.md) for worked examples.

---

# State Validation

Validation that each active state earns its place in the v1 model.

| State | Changes planning priorities? | Redundant? | Data-quality only? | Module boundary? | Verdict |
|-------|------------------------------|------------|-------------------|------------------|---------|
| `arrival_unregistered` | ✅ Legal-first ordering | No | No | No | **Keep** |
| `insurance_gap` | ✅ Coverage-first ordering | No | No | No — composes healthcare module | **Keep** |
| `housing_instability` | ✅ Housing-first ordering | No | No | No | **Keep** |
| `economic_setup_pending` | ✅ Employment/income-first | No | No | No — composes financial module | **Keep** |
| `benefits_exploration` | ✅ Assessment-first — distinct from raw low income | No | No | No — composes benefits module | **Keep** |
| `arrival_stabilizing` | ✅ Breadth ordering for newcomers | ⚠️ Overlaps specifics | No | No | **Keep** — see note |
| `situation_stable` | ✅ Optimization-first — distinct tone | No | No | No | **Keep** |

### `arrival_stabilizing` overlap note

This state overlaps with more specific states but remains necessary:

- **Without it:** classifiers force premature specificity when user has 3–4 partial gaps
- **With it:** planner can deliver balanced early-settlement ordering
- **Exit path:** classifier promotes to specific state when one gap dominates (priority rules 1–5)

**Not redundant** — it represents a distinct planning **mode** (breadth vs depth).

### Remediation: none required

No state should be merged or removed for v1. Future candidates (`student`, `self_employed`, etc.) remain in Future State Candidates until they change priorities beyond what secondary conditions can express.

---

# State Relationships

Life states describe **planning contexts**, not a rigid user journey. A user does not "complete" a state like a game level — they are classified into the state that best matches their dominant constraint **right now**.

## Temporary vs enduring

| Pattern | States |
|---------|--------|
| **Usually temporary** | `arrival_unregistered`, `economic_setup_pending`, `insurance_gap`, `benefits_exploration` |
| **Can be prolonged** | `arrival_stabilizing`, `housing_instability` |
| **Enduring baseline** | `situation_stable` — until a transition disrupts it |

## Instability states

These signal **urgent or structural risk** — planner should prefer legal and survival priorities:

- `arrival_unregistered`
- `housing_instability`
- `insurance_gap`
- `economic_setup_pending`

`arrival_stabilizing` is unstable in breadth (many open fronts) but not always acute. `benefits_exploration` is financially stressed but may be calmer if survival basics are met.

## Conceptual coexistence

Multiple states may **describe different facets** of the same user's life, but the planner assigns **one primary state** at a time. Additional facets become **secondary conditions**:

| Coexistence example | Primary | Secondary conditions |
|--------------------|---------|---------------------|
| Unregistered + no insurance | `arrival_unregistered` | `insurance_gap` |
| Employed + incomplete rent data | `situation_stable` or `housing_instability` | `housing_data_missing` |
| Job seeking + uninsured | `economic_setup_pending` | `insurance_gap` |
| Stable job + exploring Wohngeld | `benefits_exploration` | (none required) |
| Registered newcomer, 3 open domains | `arrival_stabilizing` | `employment_data_missing`, `insurance_gap`, etc. |

Classifier priority order is authoritative — see [Classifier Priority Order](#classifier-priority-order) above.

## Typical progression patterns

Not mandatory workflows — common paths observed among newcomers and transients in Germany:

```text
arrival_unregistered
  → arrival_stabilizing
  → economic_setup_pending | housing_instability | insurance_gap
  → benefits_exploration (if income insufficient)
  → situation_stable
```

**Branching examples:**

```text
situation_stable
  → economic_setup_pending     (job loss)
  → housing_instability          (move, divorce)
  → insurance_gap                (employment gap)
  → benefits_exploration         (income drop)

arrival_stabilizing
  → situation_stable             (fast settlers)
  → housing_instability          (housing-first bottleneck)
```

**Regression is normal.** Job loss from `situation_stable` back to `economic_setup_pending` is expected — not a failure state.

## Overlap with life transitions

Life **transitions** (marriage, job loss, arrival) are episodic events. Life **states** are planning contexts. A transition often *causes* a state change, but users can also explore transitions while `situation_stable` (what-if planning).

---

# Future State Candidates

The following are **not** part of the active v1 model. Listed for future expansion when product depth and data support justify them.

### `student`

Students in Germany face distinct insurance obligations (public student insurance, age limits), part-time work rules, and residence requirements. A dedicated state may be needed when education status is a primary planning driver rather than a detail within `economic_setup_pending`.

### `family_with_children`

When children are present, planning priorities shift toward Kindergeld, Kita, family insurance, Wohngeld household size, and Elterngeld. May split from generic states when household composition dominates all planning.

### `job_seeker`

Distinct from generic economic setup — user is actively registered with Agentur für Arbeit, has ALG I eligibility questions, and faces specific availability obligations. Useful when employment agency workflow is the center of gravity.

### `self_employed`

Freelancers and Gewerbe must proactively manage insurance, tax, and registration differently from employees. Economic and insurance rules diverge enough to warrant a dedicated planning context.

### `language_integration`

When German proficiency is the primary barrier to employment and admin — not just an optimization task in `situation_stable`. Relevant for BAMF course eligibility and integration pathway planning.

### `retirement_transition`

Older migrants face pension (Rentenversicherung), health insurance in retirement, and different benefits logic. Low priority until product serves this demographic explicitly.

### `visa_at_risk`

When residence permit expiry, compliance issues, or status uncertainty dominate all other planning. Highly sensitive — requires careful product and legal framing before activation.

---

# Design Principles

Principles for maintaining and extending the life state model over time.

### 1. User-understandable

Every state must be explainable in one sentence a newcomer would recognize. If the team cannot explain it to a user, it should not be a state.

### 2. Meaningful planning context

States exist to change **what the planner prioritizes** — not to label data completeness. A state that does not alter planning priorities should merge with another state or become a hint.

### 3. No domain logic duplication

States describe **life situations**, not module boundaries. Do not create `financial_reality_state` or `healthcare_state` — modules serve domains; states compose them.

### 4. Stability over granularity

Prefer fewer, well-understood states over many narrow ones. Split only when planning priorities genuinely diverge (e.g. future `self_employed`).

### 5. Explainable classification

The planner must always be able to answer: *"Why am I in this state?"* using facts and plain language — never opaque scores.

### 6. Primary state + secondary conditions

One **primary state** per plan. Additional constraints are **secondary conditions** — not parallel states, not P4 duplicates on Home. See [Secondary Conditions](#secondary-conditions).

### 7. Regression is valid

Life gets harder again — users move backward in progression patterns. The model must support re-entry without stigma in copy.

### 8. Germany-specific, not generic

States reflect German administrative reality — Anmeldung, GKV/PKV, Jobcenter, Wohngeld. Do not dilute into generic "getting started" SaaS onboarding states.

### 9. Facts before interpretation before action

States are inferred from situation facts (P1–P3). P4 interpretation may adjust emphasis but should not invent a state. Life Event plan delivers actions — states do not.

### 10. Document before implement

New states require an entry in this document — definition, entry/exit, priorities — before classifier or graph work begins.

---

## Document maintenance

| Change type | Action |
|-------------|--------|
| New active state | Add full section + update State Relationships + spec/roadmap cross-reference |
| Deprecated state | Mark deprecated; migrate graphs; keep historical entry |
| Priority rule change | Update spec/roadmap — not this document (unless entry/exit meaning changes) |
| New future candidate | Add to Future State Candidates only |

**Canonical chain:** `life-state-model.md` → `life-event-classifier-fixtures.md` → `life-event-graph-catalog-v1.md` → LE-1 implementation
