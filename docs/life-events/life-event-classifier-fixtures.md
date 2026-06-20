---
id: life-event-classifier-fixtures
title: Life Event Classifier — Fixture Catalog
project: Arrival Atlas
system: Arrival Atlas
type: spec
domain: life-events
status: active
maturity: stable
owner: product
tags:
  - life-event
  - classifier
  - fixtures
  - golden-tests
  - product-model
created: 2026-06-20
updated: 2026-06-20
depends_on:
  - life-event-module-v2
  - life-state-model
  - life-event-classifier-fixtures
  - life-event-graph-catalog-v1
related:
  - life-event-classifier-fixtures
  - life-event-graph-catalog-v1
  - life-event-module-v2-spec
  - life-event-module-v2-roadmap
---

# Life Event Classifier — Fixture Catalog

**Document type:** Canonical classifier examples — pre-implementation reference  
**Purpose:** Define expected primary state, secondary conditions, and planning focus before LE-1 coding  
**Authority:** [life-state-model.md](./life-state-model.md) (states, severity, priority order)

> These fixtures describe **user situations in plain language**. They intentionally avoid implementation field names. Engineering maps situations to situation facts during golden test authoring.

---

## How to use this catalog

| Consumer | Use |
|----------|-----|
| Classifier design | Validate priority order against realistic cases |
| Graph catalog | Confirm each primary state has actionable planning focus |
| Planner reasoning | Source `whyThisNow` and `whatIsBlocking` patterns |
| Golden tests | One fixture → one deterministic classification test |
| Product review | Challenge state model before code lock |

---

## Fixture Index

| # | Scenario | Primary state |
|---|----------|---------------|
| F01 | Fresh arrival, no registration | `arrival_unregistered` |
| F02 | Arrived, registered, nothing else | `arrival_stabilizing` |
| F03 | Registered, has job, no insurance | `insurance_gap` |
| F04 | Laid off last week | `economic_setup_pending` |
| F05 | Between jobs, insurance lapsed | `economic_setup_pending` |
| F06 | Couch-surfing, no fixed address | `housing_instability` |
| F07 | Has apartment, rent unknown | `housing_instability` |
| F08 | Low wage, high rent, employed | `benefits_exploration` |
| F09 | On Bürgergeld, stable | `situation_stable` |
| F10 | Established expat, all basics | `situation_stable` |
| F11 | Family of four, missing child details | `benefits_exploration` |
| F12 | Moved cities, not re-registered | `arrival_unregistered` |
| F13 | Student finishing studies, no job | `economic_setup_pending` |
| F14 | Self-employed, insurance unclear | `insurance_gap` |
| F15 | Newborn, otherwise stable | `situation_stable` |
| F16 | Divorced, lost apartment | `housing_instability` |
| F17 | Visa renewal due, otherwise stable | `situation_stable` |
| F18 | Part-time job, exploring Wohngeld | `benefits_exploration` |
| F19 | Unemployed, complete profile, exploring ALG | `benefits_exploration` |
| F20 | Arrival with job offer, not registered | `arrival_unregistered` |
| F21 | Stable worker, missing rent in profile | `situation_stable` |
| F22 | New arrival, housing OK, no job or insurance | `arrival_stabilizing` |
| F23 | Job loss, stable housing, insured | `economic_setup_pending` |
| F24 | Registered, insured, employed, no income figure saved | `situation_stable` |

---

## Fixtures

### F01 — Fresh arrival, no registration

**Situation summary:** Ana moved to Berlin 10 days ago. She has a sublet room but has not been to the Bürgeramt. She does not know about the 14-day registration rule.

**Expected primary state:** `arrival_unregistered`

**Expected secondary conditions:** `housing_data_missing`, `insurance_gap`, `employment_data_missing`, `income_data_missing`

**Expected planning focus:** Complete Anmeldung — understand documents, appointment, and housing confirmation.

**Expected blockers:** No municipal registration; landlord confirmation may be missing; insurance not started.

**Reasoning:** Registration is the legal gateway. Multiple other gaps exist but all are downstream of or parallel to registration — priority order rule 1 applies.

---

### F02 — Arrived, registered, nothing else

**Situation summary:** Marco completed Anmeldung two weeks ago. No job yet, no insurance enrolled, no bank account mentioned. He is not in crisis but overwhelmed by open tasks.

**Expected primary state:** `arrival_stabilizing`

**Expected secondary conditions:** `insurance_gap`, `employment_data_missing`, `income_data_missing`, `banking_not_established`

**Expected planning focus:** Order the early settlement stack — insurance, income path, banking.

**Expected blockers:** No single dominant gap after registration; multiple survival fronts open.

**Reasoning:** Registration is done — not `arrival_unregistered`. No single domain dominates enough for insurance, housing, or economic primary states. Breadth state applies (priority 6).

---

### F03 — Registered, has job, no insurance

**Situation summary:** Elena registered and started full-time work last month. Her employer has not confirmed Krankenkasse enrollment and she is unsure if she is covered.

**Expected primary state:** `insurance_gap`

**Expected secondary conditions:** none required

**Expected planning focus:** Confirm and secure health insurance continuity through employment.

**Expected blockers:** Mandatory coverage unclear; employment-insurance linkage unresolved.

**Reasoning:** Registration and employment are present. Insurance is the dominant legal risk — priority rule 2.

---

### F04 — Laid off last week

**Situation summary:** Thomas lost his job in Munich. He is still in his apartment, was insured through his employer, and does not know his next steps with Agentur für Arbeit or insurance.

**Expected primary state:** `economic_setup_pending`

**Expected secondary conditions:** `insurance_gap`, `life_transition_pending`

**Expected planning focus:** Stabilize employment situation — register as job-seeker, understand insurance gap risk, clarify income.

**Expected blockers:** No current employment; insurance may lapse; transition stress.

**Reasoning:** Job loss makes economic foundation the dominant context. Insurance is secondary — urgent but subordinate to employment/income re-establishment unless coverage already lapsed critically.

---

### F05 — Between jobs, insurance lapsed

**Situation summary:** Sara quit her job and her last day was Friday. She has savings, knows her notice period, but has no new employer and her Krankenkasse membership ended.

**Expected primary state:** `insurance_gap`

**Expected secondary conditions:** `economic_setup_pending`, `life_transition_pending`

**Expected planning focus:** Restore mandatory health coverage immediately; then address job search.

**Expected blockers:** Active insurance gap — legal exposure; short employment gap.

**Reasoning:** When coverage has lapsed or is imminently invalid, mandatory insurance risk can dominate even during job transition. Economic setup remains secondary.

---

### F06 — Couch-surfing, no fixed address

**Situation summary:** Dmitri is staying with friends while looking for an apartment. He cannot register at his current address and his housing search is active.

**Expected primary state:** `housing_instability`

**Expected secondary conditions:** `registration_incomplete`, `housing_search_active`

**Expected planning focus:** Secure registrable housing; understand sublet and registration rules.

**Expected blockers:** No stable address for Anmeldung; housing search in progress.

**Reasoning:** Housing dominates — registration is blocked by housing situation. Primary is housing, not arrival_unregistered, because the user's core problem is housing instability rather than first-time arrival paperwork alone.

---

### F07 — Has apartment, rent unknown

**Situation summary:** Lisa lives in Hamburg with a signed lease. She has not added rent amount to her situation. She is employed and insured.

**Expected primary state:** `housing_instability`

**Expected secondary conditions:** `housing_data_missing`

**Expected planning focus:** Complete housing picture — rent affects benefits eligibility and budgeting.

**Expected blockers:** Incomplete housing cost data blocks accurate benefits and planning.

**Reasoning:** Physical housing is stable but planning-critical housing **information** is missing. When rent blocks benefits or budgeting paths, housing_instability applies over situation_stable. If only minor profile gap with no planning impact, would be `situation_stable` + secondary only (see F21).

---

### F08 — Low wage, high rent, employed

**Situation summary:** Ahmed works full-time in retail. His rent is high relative to income. He has never explored Wohngeld or other support.

**Expected primary state:** `benefits_exploration`

**Expected secondary conditions:** none required

**Expected planning focus:** Assess whether housing or income support applies.

**Expected blockers:** Support options unexplored; may be leaving money on table.

**Reasoning:** Employment and income exist — not economic_setup_pending. Dominant open question is benefits assessment, not job seeking.

---

### F09 — On Bürgergeld, stable

**Situation summary:** Fatima receives Bürgergeld, lives in social housing, is insured, registered. She wants to know if anything needs updating.

**Expected primary state:** `situation_stable`

**Expected secondary conditions:** none required

**Expected planning focus:** Maintenance — review obligations, upcoming renewals, integration opportunities.

**Expected blockers:** None acute; compliance and renewal awareness.

**Reasoning:** Survival foundation complete. Benefits are already reflected — not exploration state.

---

### F10 — Established expat, all basics

**Situation summary:** James has lived in Germany four years. Employed, insured, owns rental contract, knows his income. Considering whether to change tax class.

**Expected primary state:** `situation_stable`

**Expected secondary conditions:** none required

**Expected planning focus:** Optimization — tax class, financial planning, optional life transitions.

**Expected blockers:** None structural.

**Reasoning:** Default stable state when no higher-priority rule matches.

---

### F11 — Family of four, missing child details

**Situation summary:** The Nguyen family has two adults employed, insured, with housing. They have children but household details are incomplete. They may qualify for additional family benefits.

**Expected primary state:** `benefits_exploration`

**Expected secondary conditions:** `household_data_missing`

**Expected planning focus:** Complete household picture; explore Kindergeld, Wohngeld family components.

**Expected blockers:** Family size affects benefit rates — data gap blocks assessment.

**Reasoning:** Economic foundation exists. Benefits exploration dominates because household composition is central to entitlement.

---

### F12 — Moved cities, not re-registered

**Situation summary:** Sophie moved from Cologne to Leipzig three weeks ago. She has a new lease but has not completed Ummeldung.

**Expected primary state:** `arrival_unregistered`

**Expected secondary conditions:** `re_registration_required`

**Expected planning focus:** Re-register at new address within deadline.

**Expected blockers:** Address change not registered; downstream admin may use old address.

**Reasoning:** Registration incomplete — same primary as first arrival. Secondary distinguishes re-registration from first Anmeldung in reasoning copy.

---

### F13 — Student finishing studies, no job

**Situation summary:** Yuki's student visa and university enrollment end in two months. She has no job lined up and does not know how insurance will work after studies.

**Expected primary state:** `economic_setup_pending`

**Expected secondary conditions:** `insurance_gap`, `life_transition_pending`

**Expected planning focus:** Plan post-study employment and insurance transition.

**Expected blockers:** No income path; student insurance ending; future `student` state candidate.

**Reasoning:** Economic and insurance transitions dominate. Future `student` state may split this — v1 uses economic primary with secondaries.

---

### F14 — Self-employed, insurance unclear

**Situation summary:** Klaus started freelancing. He is registered, has income, but is unsure which Krankenkasse to join or whether his prior coverage still applies.

**Expected primary state:** `insurance_gap`

**Expected secondary conditions:** none required

**Expected planning focus:** Proactively enroll in mandatory health insurance as self-employed.

**Expected blockers:** Self-employed must arrange insurance — no employer path.

**Reasoning:** Insurance is the dominant legal obligation. Economic picture exists. Future `self_employed` state may refine — v1 uses insurance primary.

---

### F15 — Newborn, otherwise stable

**Situation summary:** Maria and Peter are registered, employed, insured. They recently had a child and want to know about Elterngeld, Kindergeld, and family insurance.

**Expected primary state:** `situation_stable`

**Expected secondary conditions:** `life_transition_pending`, `household_data_missing`

**Expected planning focus:** Family administration — benefits for child, insurance update, optional scenario exploration.

**Expected blockers:** Life transition paperwork — not survival crisis.

**Reasoning:** Foundation is stable. Childbirth triggers transition planning within stable state — not benefits_exploration unless income support is the main open question.

---

### F16 — Divorced, lost apartment

**Situation summary:** After divorce, Ralf left the shared apartment. He is temporarily in a hostel, employed, but needs housing and address registration.

**Expected primary state:** `housing_instability`

**Expected secondary conditions:** `registration_incomplete`, `life_transition_pending`

**Expected planning focus:** Secure housing and re-establish registrable address.

**Expected blockers:** No stable housing; registration at risk; family transition.

**Reasoning:** Housing dominates despite employment. Divorce is secondary transition signal.

---

### F17 — Visa renewal due, otherwise stable

**Situation summary:** Priya's residence permit expires in 60 days. She is employed, insured, registered. She needs to prepare renewal documents.

**Expected primary state:** `situation_stable`

**Expected secondary conditions:** `life_transition_pending`

**Expected planning focus:** Visa renewal preparation — scenario exploration within stable baseline.

**Expected blockers:** Upcoming permit deadline — proactive, not survival crisis.

**Reasoning:** Survival foundation met. Visa is important transition — future `visa_at_risk` state if deadline imminent and dominant. At 60 days with stable base, stable primary with transition secondary.

---

### F18 — Part-time job, exploring Wohngeld

**Situation summary:** Nina works 20 hours per week. She knows her income and rent and wonders if Wohngeld applies alongside partial employment.

**Expected primary state:** `benefits_exploration`

**Expected secondary conditions:** none required

**Expected planning focus:** Estimate housing benefit with partial employment.

**Expected blockers:** Complex work-benefit interaction unexplored.

**Reasoning:** Income exists. Main open question is benefits assessment.

---

### F19 — Unemployed, complete profile, exploring ALG

**Situation summary:** Viktor is unemployed with documented previous employment. He is registered, insured via ALG I path, and wants to understand entitlement duration and obligations.

**Expected primary state:** `benefits_exploration`

**Expected secondary conditions:** none required

**Expected planning focus:** Navigate unemployment insurance rules and obligations.

**Expected blockers:** Support pathway clarity — not job search from zero (profile complete).

**Reasoning:** Economic picture and insurance exist. Benefits navigation is the planning center — not raw economic_setup_pending.

---

### F20 — Arrival with job offer, not registered

**Situation summary:** Chen has a signed job contract starting next month. He arrived last week, has temporary housing, but has not registered.

**Expected primary state:** `arrival_unregistered`

**Expected secondary conditions:** `employment_data_missing` (partial — job pending), `insurance_gap`

**Expected planning focus:** Register before employment start; prepare insurance and tax ID for payroll.

**Expected blockers:** Registration incomplete despite job offer — legal step still first.

**Reasoning:** Job offer does not replace Anmeldung. Registration priority 1.

---

### F21 — Stable worker, missing rent in profile

**Situation summary:** Oliver is employed, insured, registered for two years. He never added rent to his situation. No active benefits question.

**Expected primary state:** `situation_stable`

**Expected secondary conditions:** `housing_data_missing`

**Expected planning focus:** Optional profile completeness — no urgent replanning unless benefits exploration begins.

**Expected blockers:** Minor data gap — does not change life state.

**Reasoning:** Contrast with F07 — same missing rent, but no active benefits or housing planning need. Secondary only; primary stays stable. **Data gap ≠ state** unless planning impact exists.

---

### F22 — New arrival, housing OK, no job or insurance

**Situation summary:** Lena registered two weeks ago. She has a stable WG room with landlord confirmation. No employment, no insurance, no bank account.

**Expected primary state:** `arrival_stabilizing`

**Expected secondary conditions:** `insurance_gap`, `employment_data_missing`, `banking_not_established`

**Expected planning focus:** Post-registration settlement — insurance enrollment and economic path in order.

**Expected blockers:** Multiple open survival tasks; registration done.

**Reasoning:** Not unregistered. Insurance alone could argue for `insurance_gap`, but breadth of open fronts + recent arrival favors stabilizing over single-domain primary.

---

### F23 — Job loss, stable housing, insured

**Situation summary:** Franz was terminated. He still has his apartment and maintains statutory insurance through arbeitssuchend status. Needs income and agency steps.

**Expected primary state:** `economic_setup_pending`

**Expected secondary conditions:** `life_transition_pending`

**Expected planning focus:** Employment agency registration, income replacement, notice of rights.

**Expected blockers:** No income; job search path unclear.

**Reasoning:** Insurance maintained — no insurance_gap primary. Housing stable. Economic re-establishment dominates.

---

### F24 — Registered, insured, employed, no income figure saved

**Situation summary:** Emma is a salaried teacher. She confirmed employment and insurance but never entered salary. She is not asking about benefits.

**Expected primary state:** `situation_stable`

**Expected secondary conditions:** `income_data_missing`, `low_planning_confidence`

**Expected planning focus:** Gentle prompt to complete income for better tooling — not economic crisis.

**Expected blockers:** Profile incompleteness only — no structural life instability.

**Reasoning:** Critical distinction: missing data does not imply `economic_setup_pending`. Employment exists; no economic distress signal. P4 low confidence maps to secondary.

---

## Edge-case principles (from fixtures)

| Principle | Example fixtures |
|-----------|------------------|
| Registration beats other gaps | F01, F12, F20 |
| Data gap ≠ state without planning impact | F07 vs F21, F24 |
| Insurance primary only when dominant | F03, F05, F14 |
| Benefits requires economic context | F08, F18, F19 vs F04 |
| Breadth for post-registration newcomers | F02, F22 |
| Stable + life transition | F15, F17 |
| Secondaries accumulate; primary is one | F04, F16 |

---

## Document maintenance

| Change | Action |
|--------|--------|
| New fixture | Add to index + full entry; verify against priority order |
| Classifier rule change | Update life-state-model priority + re-validate all fixtures |
| New state | Add fixtures before state is activated in code |

**Next step:** LE-1 golden tests should map each fixture to situation-fact inputs and assert primary + secondary outputs.
