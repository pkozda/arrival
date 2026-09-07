---
id: e2e-product-specification-v1
title: Arrival Atlas — E2E Product Specification v1
project: Arrival Atlas
system: Arrival Atlas
type: contract
domain: product
status: active
maturity: canonical
owner: product
tags:
  - e2e
  - product-specification
  - black-box-audit
  - journey-contracts
  - normative
created: 2026-09-07
updated: 2026-09-07
related:
  - product-guide-v1
  - platform-planning-constitution-v1
---

# Arrival Atlas — E2E Product Specification v1

## 1. Purpose

This document defines **observable end-to-end product behavior** for Arrival Atlas newcomer journeys.

It answers, at the product level:

> Where am I now? Why does this matter? What do I need to do next? What happens after I do it?

This specification is intentionally **implementation-independent**.

It is written so that browser-level E2E tests can later assert user-visible outcomes without coupling to React component names, CSS classes, internal hooks, database tables, or exact API implementations.

It does **not** authorize production changes by itself. It transforms:

1. black-box production audit evidence under `tools/black-box-audit/`;
2. Product Guide v1 (`docs/product/product-guide-v1.md`);

into precise journey contracts.

---

## 2. Source of Truth

Use this hierarchy:

| Priority | Source | Role |
| -------- | ------ | ---- |
| 1 | Black-box production evidence (`tools/black-box-audit/probes/`, `artifacts/`) | What the current product actually did under audit |
| 2 | Product Guide v1 (`docs/product/product-guide-v1.md`) | Desired behavioral / UX rules (PR-001…PR-018) |
| 3 | Explicit Product Decisions (PD-001…PD-007) | Open gates that must not be silently resolved |
| 4 | Existing implementation / automated tests | Terminology and coverage location only |

**Observed behavior** and **desired behavior** are distinct.

- If audit evidence conflicts with the Product Guide, this specification records the **desired** behavior and marks the current production observation as `OBSERVED_GAP`, `UNVERIFIED`, or `AMBIGUOUS` as appropriate.
- Existing implementation and older E2E tests are **not** the source of truth for desired behavior.

### Audit corpus referenced

| Probe | STEPs | Scope |
| ----- | ----- | ----- |
| probe-001 | 0–18 | First contact, Life Events, Healthcare, Profile health insurance |
| probe-002 | 0–26 | Economic Reality, housing save/return, Registration, Work & Growth |
| probe-003 | 27–40 | Discovery |
| probe-004 | 41–45 | Household & Family |
| probe-005 | 46–51 | Employment, return visit, failure/recovery, Benefits downstream |

### User Story ID policy

No historical `US-*` identifiers were found in black-box probes or artifacts.

Therefore journey mappings use:

- `NEW PRODUCT CONTRACT` when no audited User Story ID exists;
- known gap labels already established by the Product Guide / audit narrative where applicable (`CROSS-UX-001`, `CROSS-UX-002`, `ER-LOOP-001`).

Do not invent historical User Story IDs.

---

## 3. E2E Status Vocabulary

| Status | Meaning |
| ------ | ------- |
| `OBSERVED_PASS` | Audit observed behavior that matches the desired contract for the checked assertions. |
| `OBSERVED_GAP` | Audit observed behavior that conflicts with the desired Product Guide contract. Strong candidate for product remediation. |
| `REQUIRED` | Desired behavior is normative for v1, but was not observed as a full pass in the current audit pass. |
| `PRODUCT_DECISION` | Desired behavior cannot be finalized until an explicit Product Decision (PD-*) is made. |
| `UNVERIFIED` | Audit could not verify the behavior under normal-session constraints. **Not** a confirmed defect. |
| `AMBIGUOUS` | Evidence exists but is insufficient to classify pass, gap, or failure. **Not** a confirmed defect. |

Rules:

- Do **not** treat `UNVERIFIED` or `AMBIGUOUS` as confirmed defects.
- Do **not** upgrade audit-session limitations (fresh Playwright context, no reusable `storageState`) into product defects.
- Do **not** invent backend explanations for empty results.

---

## 4. Global Product Contracts

### E2E-GLOBAL-001 — Language consistency

**User Story:** `NEW PRODUCT CONTRACT` (aligns with Product Guide §12 / PR-016; gap label `CROSS-UX-001`)

**Desired behavior**

Given the user selects Ukrainian:

- `document.lang` is `uk`;
- navigation, headings, descriptions, actions, state labels, forms, validation, errors, results, and recommendations in the active journey are consistently localized;
- mixed Ukrainian / Russian / English content in the same active flow is a localization defect.

**Observed**

- Selecting Українська sets `lang=uk` and enables continue (`artifacts/probe-001/step-1-after-ukrainian.json`).
- After entering the 7-day journey, nav is largely Ukrainian while Journey H1/slides/CTAs remain English; Discovery nav label observed as Russian `Поиск` (`artifacts/probe-001/step-3-after-next-7-days.json`).

**Current Status:** `OBSERVED_GAP`

**Evidence:** probe-001 STEPs 0–3; Product Guide PR-016; `CROSS-UX-001`

---

### E2E-GLOBAL-002 — Observable action consequence

**User Story:** `NEW PRODUCT CONTRACT` (Product Guide §4.1 / PR-003)

**Desired behavior**

Every meaningful user action produces at least one observable consequence:

- navigation;
- modal/dialog;
- editor/form;
- state transition;
- execution state;
- explicit success;
- explicit failure;
- explicit empty / nothing-applicable outcome.

A control that appears actionable but produces no observable consequence fails this contract.

**Observed**

- Many actions do produce navigation or state change.
- `Показати маршрут` produced no observable UI change in audited Life Event flows (probe-001 STEP 7; probe-002 STEP 4). Gap label `CROSS-UX-002`.

**Current Status:** `OBSERVED_GAP` (for route CTA); contract remains normative globally.

**Evidence:** probe-001 STEP 7; probe-002 STEP 4; Product Guide PR-003

---

### E2E-GLOBAL-003 — Explainable blocked state

**User Story:** `NEW PRODUCT CONTRACT` (Product Guide §3.3 / PR-001, PR-002)

**Desired behavior**

A blocked state must expose:

1. current blocked status;
2. reason;
3. missing prerequisite;
4. actionable recovery path where one exists.

“No direct constraints” must not be the explanation for a visibly blocked user action.

**Observed**

Anmeldung shows `Blocked` with Bürgeramt context text, but Blocked section also says `No direct constraints.`, and Actions are non-interactive text (`artifacts/probe-005/step-50-state-comparison.json`).

**Current Status:** `OBSERVED_GAP`

**Evidence:** probe-002 STEPs 19/24; probe-005 STEP 50

---

### E2E-GLOBAL-004 — Completed prerequisite recognition

**User Story:** `NEW PRODUCT CONTRACT` (Product Guide §3.2 / PR-006, PR-007; gap `ER-LOOP-001`)

**Desired behavior**

If a prerequisite is complete, downstream flows must recognize it.

A completed prerequisite must not be presented as unresolved unless the UI explicitly explains why additional information is still required.

**Observed**

Housing save succeeded (`POST /api/mutations` 200). Returning to Economic Reality kept housing as the active prerequisite path (`planChanged: false`) despite completed housing facts (`artifacts/probe-002/step-13-housing-save-network.json`, `step-14-economic-return-network.json`).

**Current Status:** `OBSERVED_GAP`

**Evidence:** probe-002 STEPs 13–15; `ER-LOOP-001`

---

### E2E-GLOBAL-005 — Execution outcome

**User Story:** `NEW PRODUCT CONTRACT` (Product Guide §9 / PR-005, PR-013)

**Desired behavior**

Every execution terminates in a user-understandable semantic outcome:

- success with result;
- successful no-result;
- more information required;
- recoverable error.

HTTP 200 alone is not a product outcome.

**Observed**

Healthcare execute returned HTTP 200 with `projection.status:"success"`, `recommendations:[]`, `actions:[]`, and unchanged recommendation UI (`artifacts/probe-001/step-13-execute-response.json`; probe-002 STEP 22).

**Current Status:** `OBSERVED_GAP`

**Evidence:** probe-001 STEPs 10–13; probe-002 STEPs 20–22

---

### E2E-GLOBAL-006 — Persistence and continuation

**User Story:** `NEW PRODUCT CONTRACT` (Product Guide §13 / PR-015)

**Desired behavior**

Meaningful user progress must be available when the user returns through the normal user session, where persistence is part of the product contract.

**Observed**

Within-session leave/return for Anmeldung preserved blocked selection (`step-50-state-comparison.json`).

Cross-session persistence of STEP 45 household / Discovery profiles could **not** be verified because fresh Playwright sessions did not expose prior saved state (`step-49-state-comparison.json`, STEPs 37/40/51).

**Current Status:** `UNVERIFIED` (cross-session); within-session partial `OBSERVED_PASS` for Anmeldung leave/return state preservation only.

**Evidence:** probe-005 STEPs 49–51; probe-003 STEPs 37/40

---

## 5. Journey Specifications

---

## 5.1 First Arrival

### E2E-ARR-001 — Choose language and enter Atlas

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to choose my language and enter Arrival Atlas so I can begin orientation in a language I understand.

#### Preconditions

- Fresh browser session.
- Landing page `https://arrival-atlas.pro/` is reachable.

#### Main Scenario

Given I am on the Arrival Atlas landing page  
When I select Українська and continue  
Then `document.lang` is `uk` and I can proceed into the newcomer journey

#### State Transition

`Language unset / continue disabled → Select Ukrainian → lang=uk / continue enabled → Continue → Journey surface`

#### Observable Assertions

- Language choices are visible.
- Continue is disabled until a language is selected.
- After Українська: `document.lang === "uk"`.
- Continue becomes available and advances the user.

#### Recovery Scenario

If language selection fails or continue remains disabled, the user sees an understandable reason and can retry language selection.

#### Current Status

`OBSERVED_PASS` for language select + continue enablement.  
Localization completeness of the subsequent journey is covered by `E2E-GLOBAL-001` (`OBSERVED_GAP`).

#### Evidence

`artifacts/probe-001/step-0-initial.json`, `step-1-after-ukrainian.json`, `step-2-after-continue.json`

---

### E2E-ARR-002 — Understand what matters in the next 7 days

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to understand what matters in the next 7 days so I know where to start.

#### Preconditions

- Ukrainian selected; continue completed.

#### Main Scenario

Given I have entered Atlas after language selection  
When I choose the next-7-days / orientation path  
Then I see a situation-oriented orientation surface with a clear next action

#### State Transition

`Post-continue landing → Select next-7-days CTA → Orientation / Journey surface with next actions`

#### Observable Assertions

- URL and title are visible.
- Journey / orientation content explains domains or next focus.
- At least one next action is visible (enter Atlas / see what’s next / equivalent).

#### Recovery Scenario

If the user leaves and returns, orientation remains reachable through normal navigation without requiring the user to rediscover how to start.

#### Current Status

`OBSERVED_PASS` for reachability of journey surface.  
`OBSERVED_GAP` for full Ukrainian consistency of journey chrome (`CROSS-UX-001`).

#### Evidence

`artifacts/probe-001/step-3-after-next-7-days.json`

---

## 5.2 Registration

### E2E-REG-001 — Discover Registration

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to find the registration / Anmeldung path so I can begin address registration in Germany.

#### Preconditions

- First Arrival completed (language + journey entry).

#### Main Scenario

Given I am exploring the newcomer journey  
When I open Registration / Start Registration  
Then I reach a Registration-related Life Events surface

#### State Transition

`Journey Registration intent → Start Registration → /modules/life-event (or equivalent Registration surface)`

#### Observable Assertions

- Registration intent is discoverable from the journey.
- Destination exposes Registration / Anmeldung related content.
- User can identify Registration as the current focus.

#### Recovery Scenario

If the user navigates away, Registration remains discoverable from Journey / Life Events without requiring architecture knowledge.

#### Current Status

`OBSERVED_PASS` (Registration CTA reaches Life Events Registration graph).

#### Evidence

probe-001 STEPs 4–5 (`step-4-after-registration.json`, `step-5-after-start-registration.json`); probe-002 STEPs 16–19

---

### E2E-REG-002 — Understand why Registration is blocked

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to understand why Anmeldung is blocked so I know what is missing.

#### Preconditions

- Registration surface open.
- Anmeldung node visible in Blocked state (fresh / incomplete address context).

#### Main Scenario

Given Anmeldung is shown as Blocked  
When I select the blocked Anmeldung node  
Then I see why it is blocked, what prerequisite is missing, and what I can do now

#### State Transition

`Anmeldung Blocked (unexplained or incomplete) → Select node → Inspector explains reason + prerequisite + recovery`

#### Observable Assertions

- Status communicates Blocked.
- Reason is user-understandable.
- Missing prerequisite is identified.
- Recovery action is interactive when logically possible.
- “No direct constraints” is not the sole explanation for a blocked action.

#### Recovery Scenario

See `E2E-REC-001` / `E2E-REC-002`.

#### Current Status

`OBSERVED_GAP`

Observed: Blocked label + Bürgeramt context text, but Blocked section also shows “No direct constraints.”; Actions appear as non-interactive text (`step-50-state-comparison.json`).

#### Evidence

probe-002 STEP 19; probe-005 STEP 50; Product Guide §3.3 / PR-001 / PR-002

---

### E2E-REG-003 — Complete the address prerequisite

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to provide / verify my registration address so Anmeldung can become ready.

#### Preconditions

- Address prerequisite is incomplete or unverified.
- Address action is available through Profile / Life Events.

#### Main Scenario

Given Registration is waiting on address  
When I provide / verify address through the normal UI and confirm  
Then address is visibly complete / verified

#### State Transition

`Address missing / incomplete → Provide/verify address → Address COMPLETE / Verified`

#### Observable Assertions

- Address editor or verification path is reachable.
- Successful confirmation is visible.
- Address status updates to complete/verified.
- No silent failure.

#### Recovery Scenario

If save/verification fails, the user sees an error and previously entered useful values are preserved where practical.

#### Current Status

`OBSERVED_PASS` for enabling and selecting/verifying address after housing path in the audited Economic Reality → Registration continuation (probe-002 STEP 23).  
Full Product Guide end-to-end “provide address → Anmeldung READY” remains incomplete because of `E2E-REG-004`.

#### Evidence

probe-002 STEP 23 (`probe-002-economic-registration-address.mjs` artifacts)

---

### E2E-REG-004 — Registration becomes actionable once prerequisites are satisfied

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want Anmeldung to become actionable after address is complete so I can proceed.

#### Preconditions

- Address prerequisite is complete / verified.
- No other known prerequisite remains, **or** any remaining prerequisite is explicitly identified.

#### Main Scenario

Given address is complete  
When I return to Registration / Anmeldung  
Then Anmeldung is READY / actionable, or the UI explicitly names the remaining blocker

#### State Transition

`Address COMPLETE + Anmeldung BLOCKED → Recalculate → Anmeldung READY (or explicit remaining blocker)`

#### Observable Assertions

- Anmeldung is no longer silently blocked without explanation.
- If still blocked, the missing prerequisite is explicit and actionable.
- If ready, Start / Prepare Anmeldung is available.

#### Recovery Scenario

If readiness does not update, the user can still see current state and a next action without rediscovering the process.

#### Current Status

`OBSERVED_GAP`

Observed after address verification: Anmeldung became disabled with no visible explanation of the new block; click was skipped because the control was disabled (probe-002 STEP 24). Do **not** claim Anmeldung is impossible.

#### Evidence

probe-002 STEP 24; Product Guide §7

---

### E2E-REG-005 — Start / prepare the external Anmeldung process

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want Atlas to help me prepare for Anmeldung without implying Atlas performs the government process.

#### Preconditions

- Registration is READY, or preparation guidance is available.

#### Main Scenario

Given Registration is ready for preparation  
When I start / open Anmeldung preparation  
Then Atlas shows preparation guidance and clearly distinguishes Atlas help from the authority process

#### State Transition

`Registration READY → Start/prepare → External-process preparation guidance visible`

#### Observable Assertions

- Preparation content is visible.
- Copy does not claim Atlas completes Bürgeramt registration.
- Next steps for the external process are understandable.

#### Recovery Scenario

User can leave and return without losing preparation context when persistence is part of the contract (`E2E-REG-007`).

#### Current Status

`REQUIRED` (desired). Current production path did not expose a clear completion/preparation continuation after address verification (`E2E-REG-004` gap).

#### Evidence

Product Guide §7 External process rule; probe-002 STEP 24 observed discontinuity

---

### E2E-REG-006 — Record Registration completion

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to record that Anmeldung is done so Atlas stops treating Registration as incomplete.

#### Preconditions

- External Anmeldung completed with the authority.
- Product Decision PD-001 defines the recording mechanism.

#### Main Scenario

Given I completed Anmeldung externally  
When I record completion through the defined Atlas mechanism  
Then Registration becomes COMPLETE and downstream plans recalculate

#### State Transition

`Registration READY / in external process → Record completion → Registration COMPLETE → Downstream recalculation`

#### Observable Assertions

- Completion recording control exists (per PD-001).
- Visible confirmation of completion.
- Registration status becomes Complete.
- Downstream recommendations stop treating Anmeldung as missing unless a new reason exists.

#### Recovery Scenario

If recording fails, the user sees an error and can retry without losing confirmed prerequisites.

#### Current Status

`PRODUCT_DECISION` (PD-001)

#### Evidence

Product Guide §18 PD-001; no audited recording mechanism observed

---

### E2E-REG-007 — Recover after leaving and returning

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want my Registration state and next action preserved when I leave and return.

#### Preconditions

- Anmeldung is in a known blocked or in-progress state within the current session.

#### Main Scenario

Given Anmeldung is selected and Blocked  
When I leave to Profile and return to Life Events  
Then the blocked state, reason, and next action are still understandable

#### State Transition

`Blocked Anmeldung selected → Navigate away → Return → Same blocked state + recovery path`

#### Observable Assertions

- Anmeldung remains Blocked (or updated honestly if state changed).
- Blocking reason remains visible.
- Recovery action remains available when logically possible.

#### Recovery Scenario

Same as main scenario; failure mode is loss of state or unexplained empty inspector.

#### Current Status

`OBSERVED_GAP` for recovery clarity; state preservation within session `OBSERVED_PASS`.

Observed: status preserved as Blocked; Actions still empty / non-interactive; Blocked contradiction remains (`step-50-state-comparison.json`).

#### Evidence

`artifacts/probe-005/step-50-state-comparison.json`

---

## 5.3 Economic Reality

### E2E-ER-001 — Discover Economic Reality

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to open Economic Reality so I can understand what to do next financially.

#### Preconditions

- First Arrival completed.

#### Main Scenario

Given I am in Atlas  
When I open Economic Reality from navigation or journey  
Then I reach the Economic Reality module

#### State Transition

`Any Atlas surface → Open Economic Reality → /modules/economic-reality`

#### Observable Assertions

- Module URL / title identifies Economic Reality.
- Current situation or welcome/entry content is visible.
- A next action is available.

#### Recovery Scenario

Module remains reachable from primary navigation.

#### Current Status

`OBSERVED_PASS`

#### Evidence

probe-002 STEPs 0–2

---

### E2E-ER-002 — Understand recommended economic action

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to understand the recommended economic next step and why it matters.

#### Preconditions

- Economic Reality open.

#### Main Scenario

Given Economic Reality has a recommendation  
When I view the recommended action  
Then I see what is recommended, why now, what it unlocks, and how to start

#### State Transition

`ER entry → Recommendation visible → User understands next step`

#### Observable Assertions

- Recommendation label/content visible.
- Why-now explanation present or reachable.
- Start / continue action present.

#### Recovery Scenario

If no recommendation exists, the UI explains why and what information is missing.

#### Current Status

`OBSERVED_PASS` for presence of recommended/guided entry surfaces; quality of “why now / unlocks” varies and is incomplete where route CTA fails (`CROSS-UX-002`).

#### Evidence

probe-002 STEPs 3–5

---

### E2E-ER-003 — Start benefit application intent

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to start a benefit-application intent so Atlas can guide prerequisites.

#### Preconditions

- Economic Reality open with an actionable benefit/application intent.

#### Main Scenario

Given a benefit intent is available  
When I start the intent  
Then the plan updates to show the next prerequisite path

#### State Transition

`ER idle / recommended → Start intent → Plan shows prerequisite nodes (e.g. housing / profile update)`

#### Observable Assertions

- Start-intent control is available.
- After click, plan/graph/inspector reflects a new next step.
- Previous start control is no longer misleadingly primary if consumed.

#### Recovery Scenario

If start fails, user sees an error and can retry.

#### Current Status

`OBSERVED_PASS` (`planChanged: true` after start intent in audit).

#### Evidence

probe-002 STEP 5 (`step-5-start-intent-network.json`)

---

### E2E-ER-004 — Open required Profile data

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want Economic Reality to send me to the required Profile data so I can complete prerequisites.

#### Preconditions

- Benefit intent started; housing/profile update required.

#### Main Scenario

Given ER requires Profile housing data  
When I follow Update Profile / housing action  
Then I reach the relevant Profile editor

#### State Transition

`ER prerequisite → Open Profile housing → Profile editor visible`

#### Observable Assertions

- Navigation to Profile / housing editor occurs.
- Required fields are understandable.
- Save / cancel controls are visible.

#### Recovery Scenario

User can cancel without unintended mutation.

#### Current Status

`OBSERVED_PASS`

#### Evidence

probe-002 STEPs 6–8

---

### E2E-ER-005 — Save housing data

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to save housing data and see confirmation so I know Atlas has my situation.

#### Preconditions

- Housing editor open with required fields filled through the normal UI.

#### Main Scenario

Given I entered housing details  
When I save  
Then I see confirmation and housing becomes complete / updated

#### State Transition

`Housing incomplete → Edit + Save → Mutation success → Visible confirmation → Housing COMPLETE`

#### Observable Assertions

- Save produces visible confirmation.
- Updated values are shown.
- Domain status reflects completion/update.
- No silent-only backend success as primary UX.

#### Recovery Scenario

If save fails, error is visible and entered values survive where practical.

#### Current Status

`OBSERVED_PASS`

#### Evidence

`artifacts/probe-002/step-13-housing-save-network.json` (`POST /api/mutations` 200, success)

---

### E2E-ER-006 — Recognize completed housing downstream

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, after housing is complete I want Economic Reality to move to the next incomplete prerequisite (Registration), not reopen completed housing.

#### Preconditions

- Housing save succeeded and housing facts are complete.
- Registration remains incomplete.

#### Main Scenario

Given Housing = COMPLETE and Registration = INCOMPLETE  
When I return to Economic Reality  
Then the product communicates that housing is complete and the next step is Registration (or another explicit incomplete prerequisite)

#### State Transition

`Housing COMPLETE + Registration INCOMPLETE → Return to ER → Recommendation/plan advances off completed housing`

#### Observable Assertions

- Completed housing is not presented as the unresolved primary prerequisite without explanation.
- Registration (or explicit next incomplete prerequisite) is surfaced.
- Plan/recommendation recalculation is visible.

Desired encoding of `ER-LOOP-001` fix:

> Housing information is complete. Your next step is registration.

Not:

> Re-open the housing editor as if housing were still missing.

#### Recovery Scenario

If recalculation cannot advance, UI explains remaining blockers explicitly.

#### Current Status

`OBSERVED_GAP` (`ER-LOOP-001`)

Observed: return to ER after housing save showed `planChanged: false` and continued housing-oriented prerequisite presentation while registration remained unmet (`step-14-economic-return-network.json`).

#### Evidence

probe-002 STEPs 14–15; Product Guide §8 Completed prerequisite rule; PR-006 / PR-007

---

### E2E-ER-007 — Continue from Profile back into the relevant plan

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, after updating Profile I want an obvious path back into the relevant Economic Reality plan.

#### Preconditions

- User was sent from ER to Profile and saved.

#### Main Scenario

Given Profile save succeeded from an ER prerequisite  
When I look for continuation  
Then I can return to Economic Reality / plan and see recalculated next step

#### State Transition

`ER → Profile update → Save → Confirmation → Return to plan → Recalculated next step`

#### Observable Assertions

- Continuation path is visible after save.
- Returning to ER does not dead-end.
- Next step reflects saved state (`E2E-ER-006`).

#### Recovery Scenario

If continuation is missing, user can still reach ER via primary navigation and understand current state.

#### Current Status

`OBSERVED_GAP` (continuation exists via navigation, but recalculated next step fails `E2E-ER-006`).

#### Evidence

probe-002 STEPs 14–15; Product Guide §8 Profile continuation

---

## 5.4 Healthcare

### E2E-HC-001 — Open Healthcare from a relevant recommendation

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to open Healthcare from a relevant recommendation so I can understand insurance options.

#### Preconditions

- Life Events / recommendation surfaces Healthcare.

#### Main Scenario

Given Healthcare is recommended or linked  
When I open healthcare options / navigation  
Then I reach the Healthcare module

#### State Transition

`Recommendation / Life Event action → Open Healthcare → /modules/healthcare-navigation`

#### Observable Assertions

- Destination URL identifies Healthcare.
- Module title / form is visible.
- Context of arrival is understandable when provided.

#### Recovery Scenario

Module remains reachable if user leaves and returns.

#### Current Status

`OBSERVED_PASS`

#### Evidence

probe-001 STEP 9; probe-002 STEPs 20–21

---

### E2E-HC-002 — Provide healthcare context

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to provide healthcare context so recommendations can be relevant.

#### Preconditions

- Healthcare module open.

#### Main Scenario

Given the healthcare form is visible  
When I enter available context (situation, insurance, urgency, city, etc.)  
Then fields accept input and requirements are understandable

#### State Transition

`Empty/default form → User enters context → Form ready for execution`

#### Observable Assertions

- Inputs are visible and editable.
- Required fields are indicated.
- Validation messages are understandable when triggered.

#### Recovery Scenario

User can change inputs before execution without losing the module context.

#### Current Status

`OBSERVED_PASS` for form editability. Minimum sufficient context remains `PRODUCT_DECISION` (PD-003).

#### Evidence

probe-001 STEPs 10–12; Product Guide PD-003

---

### E2E-HC-003 — Execute healthcare recommendation request

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to request healthcare recommendations and receive a semantic outcome.

#### Preconditions

- Healthcare form ready (defaults or filled).

#### Main Scenario

Given I am ready to request recommendations  
When I submit / get recommendations  
Then execution ends in one explicit semantic outcome (`E2E-HC-004`…`007`)

#### State Transition

`Form ready → Execute → Terminal semantic outcome`

#### Observable Assertions

- Execution control is available.
- Loading/in-progress state is understandable if shown.
- Terminal outcome is user-visible (not HTTP-only).

#### Recovery Scenario

See `E2E-HC-007` / `E2E-REC-003`.

#### Current Status

`OBSERVED_GAP` for semantic outcome (execution occurs, but empty-success UI). Execution request itself is reachable (`OBSERVED_PASS` for ability to click).

#### Evidence

`artifacts/probe-001/step-13-execute-response.json`; probe-002 STEP 22

---

### E2E-HC-004 — Display recommendations when available

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Execution returns recommendations.

#### Main Scenario

Given recommendations exist  
When execution completes  
Then recommendations, explanation, actions, and next step are visible

#### State Transition

`Executing → SUCCESS with recommendations → Recommendations UI`

#### Observable Assertions

- Recommendation items visible.
- Explanation / rationale visible where available.
- Actions / next step visible.

#### Recovery Scenario

User can re-run after changing context.

#### Current Status

`REQUIRED` (desired). Not observed with non-empty recommendations in the audited production runs.

#### Evidence

Product Guide §9; audited executes returned empty arrays

---

### E2E-HC-005 — Display explicit “more information required” state

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Execution cannot recommend without additional information.

#### Main Scenario

Given more information is required  
When execution completes  
Then the UI lists missing information, why it is needed, and an action to provide it

#### State Transition

`Executing → MORE INFO REQUIRED → Missing-info UI + action`

#### Observable Assertions

- Explicit missing-info state.
- Why needed.
- Action to update information.

#### Recovery Scenario

User follows action, updates Profile/form, retries.

#### Current Status

`REQUIRED` (desired). Not observed as a distinct UI state in audited empty-success responses.

#### Evidence

Product Guide §9; contrast with STEP 13/22 empty-success

---

### E2E-HC-006 — Display explicit “no applicable result” state

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Search completed with no applicable recommendation.

#### Main Scenario

Given no applicable result exists  
When execution completes  
Then the UI states search completed, nothing applicable was found, why if known, and how to continue

#### State Transition

`Executing → NO APPLICABLE RESULT → Explicit empty terminal UI`

#### Observable Assertions

- Completion acknowledged.
- No-result is explicit (not silent unchanged form).
- Continuation guidance present.

#### Recovery Scenario

Change criteria / update profile / retry.

#### Current Status

`REQUIRED` (desired). Audited empty arrays were not surfaced as an explicit no-result product state.

#### Evidence

Product Guide §9 / PR-013; STEPs 13/22

---

### E2E-HC-007 — Display recoverable execution error

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Healthcare execution fails technically.

#### Main Scenario

Given execution fails  
When the failure is shown  
Then the user sees an understandable error, can retry, and useful entered information is preserved

#### State Transition

`Executing → ERROR → Recoverable error UI`

#### Observable Assertions

- Error message visible.
- Retry available when recovery is possible.
- Form values preserved where practical.

#### Recovery Scenario

Retry or update inputs then retry (`E2E-REC-004`).

#### Current Status

`REQUIRED` (desired). Not exercised as a forced failure in the audit.

#### Evidence

Product Guide §9 / §14; PR-014

---

### E2E-HC-008 — Never leave a successful empty execution unexplained

#### User Story

`NEW PRODUCT CONTRACT` — Empty-success prohibition (Product Guide §9 Empty-success rule / PR-005)

#### Preconditions

- Healthcare execution returns HTTP success with empty recommendations/actions.

#### Main Scenario

Given execution returns success with empty recommendations and actions  
When the UI settles  
Then the user still sees an explicit semantic outcome (more info required, no applicable result, or explained empty state) — not an unchanged form

#### State Transition

`Execute → HTTP success + empty payload → Explicit semantic empty/missing-info UI (never silent)`

#### Observable Assertions

- UI changes to communicate outcome.
- Empty recommendations are explained.
- Next action exists.

Prohibited observed pattern:

```text
200 OK
+ empty recommendations
+ empty actions
+ no explanation
+ unchanged UI
```

Do **not** invent why the backend returned empty.

#### Recovery Scenario

`E2E-REC-003`

#### Current Status

`OBSERVED_GAP`

#### Evidence

`artifacts/probe-001/step-13-execute-response.json`; probe-001 `step-13-after-execution.json`; probe-002 STEP 22

---

## 5.5 Household & Family

### E2E-FAM-001 — Open Household & Family

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to open Household & family so I can record my family situation.

#### Preconditions

- Profile reachable.

#### Main Scenario

Given I open Profile  
When I select Household & family  
Then I see household status and available actions

#### State Transition

`Profile → Select Household & family → Inspector/status visible`

#### Observable Assertions

- Household node selectable.
- Status visible (e.g. Not added yet / Complete).
- Actions visible (edit / show section / benefits link as applicable).

#### Recovery Scenario

Node remains reachable after navigation away/return within session.

#### Current Status

`OBSERVED_PASS`

#### Evidence

probe-004 STEPs 41–42

---

### E2E-FAM-002 — Edit household information

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Household inspector open.

#### Main Scenario

Given Household actions include Edit  
When I open the editor  
Then I can view editable household fields without mandatory save

#### State Transition

`Household inspector → Edit → Editor form visible`

#### Observable Assertions

- Editor URL / form visible.
- Fields for household size / marital status (or equivalent) visible.
- Cancel / back available without forced mutation.

#### Recovery Scenario

Cancel returns without saving.

#### Current Status

`OBSERVED_PASS`

#### Evidence

probe-004 STEP 43

---

### E2E-FAM-003 — Save household information

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to save household size and marital status and see confirmation.

#### Preconditions

- Household editor open.
- User enters valid values through the normal UI (audit reference: size 3, married).

#### Main Scenario

Given I entered household details  
When I save once  
Then mutation succeeds and confirmation is visible

#### State Transition

`Household incomplete → Save → Persisted household facts → Visible confirmation`

#### Observable Assertions

- Save success confirmation visible.
- Saved values reflected.
- No Discovery execution triggered.

#### Recovery Scenario

Validation errors are understandable; failed save does not claim success.

#### Current Status

`OBSERVED_PASS` (within the saving session)

#### Evidence

probe-004 STEP 45 (`step-45-household-save-network.json`)

---

### E2E-FAM-004 — Observe completion and confidence update

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Successful household save in session.

#### Main Scenario

Given save succeeded  
When I view Household & family  
Then status is Complete, key values are shown, and confidence/completeness updates are visible where the product exposes them

#### State Transition

`Not added yet → Save → Complete + values shown + confidence/completeness updated`

#### Observable Assertions

- Complete status visible.
- Household size / marital status visible.
- Edit remains available.
- Downstream plan/missing-domain signals update where shown.

#### Recovery Scenario

If confirmation UI is missing despite backend success, that fails Product Guide §6.1 (not observed as silent in STEP 45).

#### Current Status

`OBSERVED_PASS` (within saving session; STEP 45)

#### Evidence

probe-004 STEP 45 summary artifacts

---

### E2E-FAM-005 — Verify downstream Benefits Simulator consumption

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer who saved household information, I want Benefits Simulator to use that information.

#### Preconditions

- Previously saved Household state available through the **normal** user session.
- Do **not** recreate, inject storage/API state, or call private endpoints to manufacture persistence.

#### Main Scenario

Given Household is Complete (size 3, married) in the normal session  
When I open Benefits Simulator via the visible action once  
Then the destination visibly consumes household/family values or explains what is still missing

#### State Transition

`Household COMPLETE → Open Benefits Simulator → Simulator reflects household state or explains gaps`

#### Observable Assertions

- Destination URL/title visible.
- Household size / marital status shown if consumed.
- Missing prerequisites explained if calculation cannot proceed.
- No intentional calculate/simulate/execute unless opening itself auto-triggers (if auto-trigger occurs, stop and record).

#### Recovery Scenario

If saved household state is unavailable through the normal session, stop and classify verification as not possible — do not recreate state.

#### Current Status

`UNVERIFIED`

Observed: fresh session showed Household **Not added yet**; Benefits CTA still visible; simulator click skipped (`artifacts/probe-005/step-51-state-comparison.json`).

#### Evidence

probe-005 STEP 51; Product Guide PR-006

---

## 5.6 Employment

### E2E-EMP-001 — Discover employment intent from Work & Growth

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want Work & Growth to lead me toward employment help.

#### Preconditions

- Journey Work & Growth slide / intent available.

#### Main Scenario

Given I select Work & Growth  
When I continue  
Then I reach an employment-relevant path or a clear explanation of the next step toward work

#### State Transition

`Work & Growth intent → Continue → Employment-relevant destination OR explicit bridge explanation`

#### Observable Assertions

- Work & Growth is discoverable.
- Continuation produces an observable destination.
- Destination relates to employment, or explains the bridge.

#### Recovery Scenario

If destination is Life Events without employment content, the product must still explain how to reach work help (`E2E-EMP-002`).

#### Current Status

`OBSERVED_GAP` for employment-specific continuity.

Observed: Work & Growth CTAs navigate to Life Events (`/modules/life-event`), not an employment-specific module (probe-002 STEP 25; probe-005 STEP 46).

#### Evidence

probe-005 `step-46-employment-entry-network.json`; probe-002 STEP 25

---

### E2E-EMP-002 — Reach an employment-specific path

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- User arrived from Work & Growth or seeks work help.

#### Main Scenario

Given I am looking for employment help  
When I inspect Life Events / related surfaces  
Then I can find an employment-specific node or path

#### State Transition

`Work intent → Life Events / plan → Employment-specific node available`

#### Observable Assertions

- Employment / work / job node or equivalent is visible and selectable, **or**
- Explicit explanation that employment is handled elsewhere with a link.

#### Recovery Scenario

If no node exists, user is guided to Discovery Jobs or another defined path (PD-004).

#### Current Status

`OBSERVED_GAP`

Observed: no enabled work-related Life Events node found (probe-002 STEP 26; probe-005 STEP 46).

Do **not** claim employment functionality is absent from the product overall.

#### Evidence

probe-002 STEP 26; probe-005 STEP 46

---

### E2E-EMP-003 — Reach Jobs Discovery from newcomer employment intent

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Canonical employment architecture decided (PD-004) **or** interim bridge exists.

#### Main Scenario

Given I have employment intent  
When I follow the canonical path  
Then I can reach Discovery Jobs without needing to know internal module names

#### State Transition

`Work & Growth → (Employment?) → Discovery Jobs`

#### Observable Assertions

- Discoverable path from newcomer employment intent to Jobs.
- Discovery entry does not auto-execute (`E2E-DISC-001`).

#### Recovery Scenario

If path is missing, nav Discovery remains available but counts as disconnected from intent.

#### Current Status

`PRODUCT_DECISION` (PD-004) + `OBSERVED_GAP` for current discoverability from Work & Growth.

Observed independently: Discovery contains Jobs functionality (probe-003), but it was not reached from Work & Growth employment intent in the audited path.

#### Evidence

probe-003 STEPs 27–35; probe-005 STEPs 46–48; Product Guide PD-004

---

### E2E-EMP-004 — Understand why Work & income is disabled, if it remains disabled

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Profile open; Work & income visible.

#### Main Scenario

Given Work & income is disabled  
When I inspect it (without forcing activation)  
Then I understand why, what prerequisite is missing, and how to unlock it

#### State Transition

`Work & income disabled → Inspect explanation → Unlock prerequisite understood`

#### Observable Assertions

- Disabled state is visible.
- Explanation of why / prerequisite / unlock path is visible.
- No mysterious disablement without explanation.

#### Recovery Scenario

Follow unlock prerequisite, then re-check availability (`E2E-EMP-005`).

#### Current Status

`OBSERVED_GAP`

Observed: Work & income visible with `aria-disabled=true`; no unlock explanation discovered from enabled Profile nodes (probe-005 STEPs 47–48).

#### Evidence

`artifacts/probe-005/step-48-node-inspections.json`

---

### E2E-EMP-005 — Understand how Work & income becomes available

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Work & income disabled or locked.

#### Main Scenario

Given Work & income is not yet available  
When prerequisites are satisfied  
Then Work & income becomes available and the transition is visible

#### State Transition

`Work & income locked → Complete prerequisite → Work & income available`

#### Observable Assertions

- Unlock condition is user-visible before unlock.
- After prerequisite completion, control becomes enabled.
- Edit / view path appears.

#### Recovery Scenario

If still disabled, remaining prerequisite is explicit.

#### Current Status

`UNVERIFIED` (unlock path not discovered; cannot observe successful unlock)

#### Evidence

probe-005 STEP 48 classification: employment unlock path not discovered

---

## 5.7 Discovery

### E2E-DISC-001 — Enter Discovery without automatic execution

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want to open Discovery without triggering a search automatically.

#### Preconditions

- Discovery reachable from navigation.

#### Main Scenario

Given I open Discovery  
When the module loads  
Then no Discovery execution starts automatically

#### State Transition

`Nav → /modules/discovery → Landing / profiles UI (IDLE)`

#### Observable Assertions

- Discovery page visible.
- No automatic run/execute request attributable to mere entry.
- Create / guided / profile actions visible as applicable.

#### Recovery Scenario

User can leave without side effects beyond normal session reads.

#### Current Status

`OBSERVED_PASS`

#### Evidence

probe-003 STEP 27

---

### E2E-DISC-002 — Start Guided Discovery

#### User Story

`NEW PRODUCT CONTRACT` — As a newcomer, I want Guided Discovery to actually guide me through opportunity setup.

#### Preconditions

- Discovery landing shows Guided entry.

#### Main Scenario

Given Guided is offered  
When I start Guided  
Then I am guided through a multi-step flow (what / where / constraints / delivery / review / create)

#### State Transition

`Guided CTA → Guided steps → Review → Create`

Desired: Product Guide §11.1.

Observed undesired:

`Guided CTA → dialog closes → same empty Discovery page`

#### Observable Assertions

- Multi-step guided content appears, **or**
- Guided CTA is not shown if guided experience does not exist.

#### Recovery Scenario

User can exit guided flow and return to Discovery landing without execution.

#### Current Status

`OBSERVED_GAP` (and open `PRODUCT_DECISION` PD-005 for keep vs remove)

#### Evidence

probe-003 STEP 28; Product Guide PR-011 / PD-005

---

### E2E-DISC-003 — Create Jobs profile

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Discovery open; New profile path available.

#### Main Scenario

Given I choose Jobs and provide a valid name/criteria  
When I create the profile  
Then the profile exists and is visibly confirmed

#### State Transition

`No Jobs profile → Create Jobs profile → Profile visible (IDLE, not auto-run)`

#### Observable Assertions

- Profile name/type visible.
- Enabled/schedule/criteria basics understandable.
- Last run / results empty or idle state clear.
- Creation confirmation explicit where Product Guide requires it.

#### Recovery Scenario

Invalid create is blocked with understandable validation (see empty-name behavior in STEP 32).

#### Current Status

`OBSERVED_PASS` for create success in-session (STEP 33). Confirmation polish may still be incomplete vs Product Guide §11.2.

#### Evidence

probe-003 STEPs 29–33

---

### E2E-DISC-004 — Edit and save Jobs criteria

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Jobs profile exists in session.

#### Main Scenario

Given I open edit criteria  
When I change role/criteria and save  
Then saved criteria are visible on the profile

#### State Transition

`Existing profile → Edit criteria → Save → Updated criteria visible`

#### Observable Assertions

- Editor opens.
- Save persists values.
- Updated preferred role / criteria visible after save.
- No execution triggered by save alone.

#### Recovery Scenario

Cancel discards unsaved edits.

#### Current Status

`OBSERVED_PASS` (STEP 35; note: toast may be absent)

#### Evidence

probe-003 STEPs 34–35

---

### E2E-DISC-005 — Create Giveaways profile

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Discovery open.

#### Main Scenario

Given I create a Giveaways profile with valid inputs  
When creation succeeds  
Then the Giveaways profile is visible in-session

#### State Transition

`No Giveaways profile → Create → Profile visible`

#### Observable Assertions

- Profile visible with type Giveaways.
- No automatic execution.

#### Recovery Scenario

Same validation expectations as Jobs.

#### Current Status

`OBSERVED_PASS` in-session (STEP 39). Cross-session visibility `UNVERIFIED` (`E2E-DISC-011`).

#### Evidence

probe-003 STEPs 38–39

---

### E2E-DISC-006 — Run Discovery

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Configured profile exists.
- User intentionally starts exactly one run when testing cost-sensitive paths.

#### Main Scenario

Given a profile is ready  
When I run Discovery  
Then I observe an explicit lifecycle:

`IDLE → QUEUED → RUNNING → SUCCESS / NO_RESULTS / ERROR`

#### State Transition

`IDLE → Run → QUEUED/RUNNING → Terminal state`

#### Observable Assertions

- In-progress state is labeled understandably.
- Terminal state is one of SUCCESS / NO_RESULTS / ERROR.
- Lifecycle is user-visible (not only network metadata).

#### Recovery Scenario

`E2E-DISC-009`, `E2E-DISC-010`, `E2E-REC-005`, `E2E-REC-006`

#### Current Status

`AMBIGUOUS` for authoritative lifecycle (PD-007).  

Observed STEP 36: UI showed in-progress (`Выполняется…`) for a sustained period; no clear terminal SUCCESS/NO_RESULTS/ERROR recorded; no clear execute HTTP observed in the captured post-click window. Do **not** label this as a confirmed backend failure.

#### Evidence

probe-003 STEP 36 (`step-36-run-network.json`); Product Guide §11.3 / PD-007

---

### E2E-DISC-007 — Display successful results

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Run completed with results.

#### Main Scenario

Given results exist  
When the run reaches SUCCESS  
Then results and next actions are visible

#### State Transition

`RUNNING → SUCCESS → Results UI`

#### Observable Assertions

- Results list/cards visible.
- Next actions (open / apply / refine) understandable.

#### Recovery Scenario

User can refine criteria and run again per product policy.

#### Current Status

`REQUIRED` (desired). Not observed with non-empty results in STEP 36 window.

#### Evidence

Product Guide §11; STEP 36

---

### E2E-DISC-008 — Display explicit no-results state

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Run completed with zero matches.

#### Main Scenario

Given no matches  
When run completes  
Then UI states search completed with no matching opportunities and offers useful next actions

#### State Transition

`RUNNING → NO_RESULTS → Explicit no-results UI`

#### Observable Assertions

- Explicit completion + no matches copy.
- Actions: change criteria / broaden location / modify role / run again (as applicable).
- Not treated as a silent success.

#### Recovery Scenario

User adjusts criteria and retries.

#### Current Status

`REQUIRED` (desired). Not observed as an explicit terminal UI in STEP 36.

#### Evidence

Product Guide §11.4 / PR-013

---

### E2E-DISC-009 — Display recoverable execution error

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Run fails.

#### Main Scenario

Given execution fails  
When failure is shown  
Then user sees why (if known) and can retry

#### State Transition

`RUNNING → ERROR → Retry UI`

#### Observable Assertions

- Error visible.
- Retry available when recovery is possible.

#### Recovery Scenario

`E2E-REC-005`

#### Current Status

`REQUIRED` (desired). Not confirmed as a distinct error terminal in STEP 36.

#### Evidence

Product Guide §11.5 / PR-014

---

### E2E-DISC-010 — Handle long-running execution

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Run is in progress longer than a trivial spinner.

#### Main Scenario

Given Discovery is running  
When time passes  
Then the user understands execution is active, whether they can leave, and what outcome will appear

#### State Transition

`RUNNING (long) → User understands lifecycle / leave policy → Eventually terminal state`

#### Observable Assertions

- Persistent in-progress labeling.
- Leave/preserve expectations communicated.
- No indefinite unlabeled “running forever” without policy (PD-007).

#### Recovery Scenario

`E2E-REC-006`

#### Current Status

`AMBIGUOUS`

Observed STEP 36 in-progress UI without verified terminal outcome or leave-policy messaging.

#### Evidence

probe-003 STEP 36; PD-007

---

### E2E-DISC-011 — Persist Discovery profiles across a normal return visit

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Profile created in a prior normal user session.
- Verification uses normal browser session only — no injected storage, credentials, or private endpoints.

#### Main Scenario

Given a Discovery profile was created earlier  
When I return in a normal session and open Discovery  
Then the profile is findable again

#### State Transition

`Profile created → Leave → Return → Profile visible`

#### Observable Assertions

- Profile name/type visible.
- Criteria basics preserved.
- Last-run / results shown honestly if part of contract (PD-006).

#### Recovery Scenario

If persistence is not part of product promise, UI must not imply profiles survive return visits (PD-006).

#### Current Status

`UNVERIFIED`

Observed: fresh sessions after Jobs (STEP 37) and Giveaways (STEP 40) showed empty Discovery profiles list / profile not available. This records read-path exposure limits under audit constraints; it does **not** by itself prove deletion or backend non-persistence.

#### Evidence

probe-003 STEPs 37 / 40; Product Guide §11.6 / PD-006

---

## 5.8 Return Visit

### E2E-RETURN-001 — Persist profile state across a normal return visit

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Profile facts previously saved through normal UI.
- Verification via normal session only.

#### Main Scenario

Given Household / housing / other profile facts were saved  
When I return later through the normal session  
Then saved facts and Complete states are restored

#### State Transition

`Saved profile → Leave → Return → Restored profile facts`

#### Observable Assertions

- Completed domains remain Complete.
- Key values visible.
- Missing domains remain honestly missing.

#### Recovery Scenario

If session cannot restore state, product must not claim persistence it cannot provide.

#### Current Status

`UNVERIFIED`

Observed STEP 49: previously saved Household state unavailable in fresh session; leave/return of that saved state not executed because it would test an empty session (`step-49-state-comparison.json`).

#### Evidence

probe-005 STEP 49; Product Guide PR-015

---

### E2E-RETURN-002 — Persist meaningful journey progress

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- User made meaningful journey progress (plan state, blocked Registration, etc.).

#### Main Scenario

Given journey progress exists  
When I return  
Then meaningful progress is restored

#### State Transition

`Journey progress saved → Leave → Return → Progress restored`

#### Observable Assertions

- Plan / blocked / recommended states restored where part of contract.
- Temporary UI-only state need not persist.

#### Recovery Scenario

User can rediscover via navigation if only temporary UI state was lost — but meaningful progress must not silently vanish when persistence is promised.

#### Current Status

`UNVERIFIED` for cross-session. Within-session Anmeldung leave/return showed state preservation (`E2E-REG-007` / STEP 50).

#### Evidence

STEPs 49–50

---

### E2E-RETURN-003 — Resume the next meaningful action

#### User Story

`NEW PRODUCT CONTRACT`

#### Preconditions

- Restored state available.

#### Main Scenario

Given I return with restored state  
When I view the current surface  
Then the next meaningful action is visible

#### State Transition

`Return → Restored state → Next action visible`

#### Observable Assertions

- Current state visible.
- Next action visible and actionable when possible.

#### Recovery Scenario

If next action cannot be restored, explain current state and how to continue.

#### Current Status

`UNVERIFIED` (depends on `E2E-RETURN-001/002`). Within-session blocked Anmeldung preserved state but not a clear actionable next control (STEP 50).

#### Evidence

STEPs 49–50; Product Guide §15

---

## 5.9 Failure & Recovery

For every recovery scenario, answer:

1. What happened?
2. What state was preserved?
3. What can the user do now?

### E2E-REC-001 — Blocked Registration

#### User Story

`NEW PRODUCT CONTRACT`

#### Main Scenario

Given Anmeldung is Blocked  
When I inspect it  
Then I understand what happened, what was preserved, and what I can do now

#### Observable Assertions

- Blocked status visible.
- Reason + missing prerequisite visible.
- Interactive recovery when possible.

#### Current Status

`OBSERVED_GAP`

#### Evidence

STEP 19 / STEP 50; answers today: happened=Blocked; preserved=selection/context text; can do now=unclear (non-interactive action text)

---

### E2E-REC-002 — Return to a blocked Registration state

#### User Story

`NEW PRODUCT CONTRACT`

#### Main Scenario

Given Blocked Anmeldung  
When I leave and return within session  
Then blocked state remains and recovery remains understandable

#### Current Status

`OBSERVED_GAP` (state preserved; recovery still unclear)

#### Evidence

`step-50-state-comparison.json`

---

### E2E-REC-003 — Healthcare empty-success result

#### User Story

`NEW PRODUCT CONTRACT`

#### Main Scenario

Given healthcare execute returns empty success  
When UI settles  
Then user sees an explained terminal state and a next action

#### Answers required by Product Guide §14

- What happened? Search/request completed without usable recommendations (observed) — UI must say so.
- What state was preserved? Form inputs should remain.
- What can I do now? Update information / change city / retry / open Profile.

#### Current Status

`OBSERVED_GAP`

#### Evidence

STEPs 13 / 22

---

### E2E-REC-004 — Healthcare execution failure

#### User Story

`NEW PRODUCT CONTRACT`

#### Main Scenario

Given technical failure  
When error is shown  
Then retry is available and inputs preserved

#### Current Status

`REQUIRED` (desired; not forced in audit)

#### Evidence

Product Guide §9 / §14

---

### E2E-REC-005 — Discovery execution failure

#### User Story

`NEW PRODUCT CONTRACT`

#### Main Scenario

Given Discovery run fails  
When error is shown  
Then why (if known) + Retry / Change criteria are available

#### Current Status

`REQUIRED` (desired; not confirmed in STEP 36)

#### Evidence

Product Guide §11.5

---

### E2E-REC-006 — Discovery long-running state

#### User Story

`NEW PRODUCT CONTRACT`

#### Main Scenario

Given Discovery remains in progress  
When the user inspects the UI  
Then active execution is clear and leave/timeout policy is understandable (PD-007)

#### Current Status

`AMBIGUOUS`

#### Evidence

STEP 36; PD-007

---

## 5.10 Cross-module State Propagation

Reference pattern (Housing):

`edit → save → mutation → visible confirmation → complete → downstream state`

### E2E-STATE-001 — Profile → Plan

#### User Story

`NEW PRODUCT CONTRACT`

#### Main Scenario

Given Profile domain data changes  
When save succeeds  
Then relevant plan state updates

#### Current Status

`OBSERVED_GAP` for Economic Reality housing→plan advancement (`ER-LOOP-001`). Housing save itself `OBSERVED_PASS`.

#### Evidence

STEPs 13–15

---

### E2E-STATE-002 — Plan → Profile

#### User Story

`NEW PRODUCT CONTRACT`

#### Main Scenario

Given a plan prerequisite requires Profile data  
When I follow the plan action  
Then I reach the correct Profile editor

#### Current Status

`OBSERVED_PASS` (ER → housing Profile path)

#### Evidence

probe-002 STEPs 6–8

---

### E2E-STATE-003 — Profile → Recommendation

#### User Story

`NEW PRODUCT CONTRACT`

#### Main Scenario

Given Profile state changes meaningfully  
When recommendations are shown  
Then recommendations reflect the new state and do not request completed prerequisites without explanation

#### Current Status

`OBSERVED_GAP` where ER continues housing-oriented recommendation after housing completion

#### Evidence

STEPs 14–15; PR-007

---

### E2E-STATE-004 — Completed prerequisite → downstream recalculation

#### User Story

`NEW PRODUCT CONTRACT`

#### Main Scenario

Given a prerequisite becomes Complete  
When downstream modules/plans load  
Then they recognize completion and advance

#### Current Status

`OBSERVED_GAP` for ER housing; `UNVERIFIED` for Household → Benefits Simulator

#### Evidence

STEPs 14–15, 45, 51; PR-006

---

## 6. Traceability Matrix

| E2E ID | User Story | Journey | Desired behavior | Current status | Evidence | Product Decision |
| ------ | ---------- | ------- | ---------------- | -------------- | -------- | ---------------- |
| E2E-GLOBAL-001 | NEW PRODUCT CONTRACT / CROSS-UX-001 | Global | Consistent Ukrainian localization | OBSERVED_GAP | probe-001 STEPs 0–3 | — |
| E2E-GLOBAL-002 | NEW PRODUCT CONTRACT / CROSS-UX-002 | Global | Observable action consequence | OBSERVED_GAP | STEPs 4/7 (route CTA) | — |
| E2E-GLOBAL-003 | NEW PRODUCT CONTRACT | Global | Explainable blocked state | OBSERVED_GAP | STEPs 19/50 | — |
| E2E-GLOBAL-004 | NEW PRODUCT CONTRACT / ER-LOOP-001 | Global | Completed prerequisite recognition | OBSERVED_GAP | STEPs 13–15 | PD-002 |
| E2E-GLOBAL-005 | NEW PRODUCT CONTRACT | Global | Semantic execution outcome | OBSERVED_GAP | STEPs 13/22 | PD-003 |
| E2E-GLOBAL-006 | NEW PRODUCT CONTRACT | Global | Persistence & continuation | UNVERIFIED | STEPs 37/40/49/51 | PD-006 |
| E2E-ARR-001 | NEW PRODUCT CONTRACT | First Arrival | Language select + continue | OBSERVED_PASS | STEPs 0–2 | — |
| E2E-ARR-002 | NEW PRODUCT CONTRACT | First Arrival | Next-7-days orientation | OBSERVED_PASS | STEP 3 | — |
| E2E-REG-001 | NEW PRODUCT CONTRACT | Registration | Discover Registration | OBSERVED_PASS | STEPs 4–5/16 | — |
| E2E-REG-002 | NEW PRODUCT CONTRACT | Registration | Understand blocked Anmeldung | OBSERVED_GAP | STEPs 19/50 | — |
| E2E-REG-003 | NEW PRODUCT CONTRACT | Registration | Complete address prerequisite | OBSERVED_PASS | STEP 23 | — |
| E2E-REG-004 | NEW PRODUCT CONTRACT | Registration | Anmeldung actionable after prerequisites | OBSERVED_GAP | STEP 24 | — |
| E2E-REG-005 | NEW PRODUCT CONTRACT | Registration | Prepare external Anmeldung | REQUIRED | STEP 24 + Guide §7 | PD-001 |
| E2E-REG-006 | NEW PRODUCT CONTRACT | Registration | Record Registration completion | PRODUCT_DECISION | Guide PD-001 | PD-001 |
| E2E-REG-007 | NEW PRODUCT CONTRACT | Registration | Recover after leave/return | OBSERVED_GAP | STEP 50 | — |
| E2E-ER-001 | NEW PRODUCT CONTRACT | Economic Reality | Discover ER | OBSERVED_PASS | STEPs 0–2 | — |
| E2E-ER-002 | NEW PRODUCT CONTRACT | Economic Reality | Understand recommended action | OBSERVED_PASS | STEPs 3–5 | PD-002 |
| E2E-ER-003 | NEW PRODUCT CONTRACT | Economic Reality | Start benefit intent | OBSERVED_PASS | STEP 5 | — |
| E2E-ER-004 | NEW PRODUCT CONTRACT | Economic Reality | Open required Profile data | OBSERVED_PASS | STEPs 6–8 | — |
| E2E-ER-005 | NEW PRODUCT CONTRACT | Economic Reality | Save housing data | OBSERVED_PASS | STEP 13 | — |
| E2E-ER-006 | NEW PRODUCT CONTRACT / ER-LOOP-001 | Economic Reality | Recognize completed housing | OBSERVED_GAP | STEPs 14–15 | PD-002 |
| E2E-ER-007 | NEW PRODUCT CONTRACT | Economic Reality | Continue Profile → plan | OBSERVED_GAP | STEPs 14–15 | — |
| E2E-HC-001 | NEW PRODUCT CONTRACT | Healthcare | Open Healthcare | OBSERVED_PASS | STEPs 9/20–21 | — |
| E2E-HC-002 | NEW PRODUCT CONTRACT | Healthcare | Provide healthcare context | OBSERVED_PASS | STEPs 10–12 | PD-003 |
| E2E-HC-003 | NEW PRODUCT CONTRACT | Healthcare | Execute recommendation request | OBSERVED_GAP | STEPs 13/22 | PD-003 |
| E2E-HC-004 | NEW PRODUCT CONTRACT | Healthcare | Display recommendations | REQUIRED | Guide §9 | PD-003 |
| E2E-HC-005 | NEW PRODUCT CONTRACT | Healthcare | More information required state | REQUIRED | Guide §9 | PD-003 |
| E2E-HC-006 | NEW PRODUCT CONTRACT | Healthcare | No applicable result state | REQUIRED | Guide §9 | — |
| E2E-HC-007 | NEW PRODUCT CONTRACT | Healthcare | Recoverable execution error | REQUIRED | Guide §9 | — |
| E2E-HC-008 | NEW PRODUCT CONTRACT | Healthcare | No unexplained empty success | OBSERVED_GAP | STEPs 13/22 | — |
| E2E-FAM-001 | NEW PRODUCT CONTRACT | Household & Family | Open Household | OBSERVED_PASS | STEPs 41–42 | — |
| E2E-FAM-002 | NEW PRODUCT CONTRACT | Household & Family | Edit household | OBSERVED_PASS | STEP 43 | — |
| E2E-FAM-003 | NEW PRODUCT CONTRACT | Household & Family | Save household | OBSERVED_PASS | STEP 45 | — |
| E2E-FAM-004 | NEW PRODUCT CONTRACT | Household & Family | Completion + confidence | OBSERVED_PASS | STEP 45 | — |
| E2E-FAM-005 | NEW PRODUCT CONTRACT | Household & Family | Benefits Simulator consumption | UNVERIFIED | STEP 51 | — |
| E2E-EMP-001 | NEW PRODUCT CONTRACT | Employment | Discover from Work & Growth | OBSERVED_GAP | STEPs 25/46 | PD-004 |
| E2E-EMP-002 | NEW PRODUCT CONTRACT | Employment | Employment-specific path | OBSERVED_GAP | STEPs 26/46 | PD-004 |
| E2E-EMP-003 | NEW PRODUCT CONTRACT | Employment | Reach Jobs Discovery from intent | PRODUCT_DECISION | STEPs 27+/46–48 | PD-004 |
| E2E-EMP-004 | NEW PRODUCT CONTRACT | Employment | Explain disabled Work & income | OBSERVED_GAP | STEPs 47–48 | — |
| E2E-EMP-005 | NEW PRODUCT CONTRACT | Employment | Unlock Work & income | UNVERIFIED | STEP 48 | PD-004 |
| E2E-DISC-001 | NEW PRODUCT CONTRACT | Discovery | Enter without auto-execution | OBSERVED_PASS | STEP 27 | — |
| E2E-DISC-002 | NEW PRODUCT CONTRACT | Discovery | Real Guided flow | OBSERVED_GAP | STEP 28 | PD-005 |
| E2E-DISC-003 | NEW PRODUCT CONTRACT | Discovery | Create Jobs profile | OBSERVED_PASS | STEP 33 | — |
| E2E-DISC-004 | NEW PRODUCT CONTRACT | Discovery | Edit/save Jobs criteria | OBSERVED_PASS | STEPs 34–35 | — |
| E2E-DISC-005 | NEW PRODUCT CONTRACT | Discovery | Create Giveaways profile | OBSERVED_PASS | STEP 39 | — |
| E2E-DISC-006 | NEW PRODUCT CONTRACT | Discovery | Run with explicit lifecycle | AMBIGUOUS | STEP 36 | PD-007 |
| E2E-DISC-007 | NEW PRODUCT CONTRACT | Discovery | Display successful results | REQUIRED | STEP 36 / Guide | PD-007 |
| E2E-DISC-008 | NEW PRODUCT CONTRACT | Discovery | Explicit no-results | REQUIRED | Guide §11.4 | PD-007 |
| E2E-DISC-009 | NEW PRODUCT CONTRACT | Discovery | Recoverable run error | REQUIRED | Guide §11.5 | PD-007 |
| E2E-DISC-010 | NEW PRODUCT CONTRACT | Discovery | Long-running execution UX | AMBIGUOUS | STEP 36 | PD-007 |
| E2E-DISC-011 | NEW PRODUCT CONTRACT | Discovery | Persist profiles on return | UNVERIFIED | STEPs 37/40 | PD-006 |
| E2E-RETURN-001 | NEW PRODUCT CONTRACT | Return Visit | Persist profile state | UNVERIFIED | STEP 49 | — |
| E2E-RETURN-002 | NEW PRODUCT CONTRACT | Return Visit | Persist journey progress | UNVERIFIED | STEPs 49–50 | — |
| E2E-RETURN-003 | NEW PRODUCT CONTRACT | Return Visit | Resume next action | UNVERIFIED | STEPs 49–50 | — |
| E2E-REC-001 | NEW PRODUCT CONTRACT | Failure & Recovery | Blocked Registration recovery | OBSERVED_GAP | STEPs 19/50 | — |
| E2E-REC-002 | NEW PRODUCT CONTRACT | Failure & Recovery | Return to blocked Registration | OBSERVED_GAP | STEP 50 | — |
| E2E-REC-003 | NEW PRODUCT CONTRACT | Failure & Recovery | Healthcare empty-success recovery | OBSERVED_GAP | STEPs 13/22 | — |
| E2E-REC-004 | NEW PRODUCT CONTRACT | Failure & Recovery | Healthcare execution failure | REQUIRED | Guide §14 | — |
| E2E-REC-005 | NEW PRODUCT CONTRACT | Failure & Recovery | Discovery execution failure | REQUIRED | Guide §14 | PD-007 |
| E2E-REC-006 | NEW PRODUCT CONTRACT | Failure & Recovery | Discovery long-running state | AMBIGUOUS | STEP 36 | PD-007 |
| E2E-STATE-001 | NEW PRODUCT CONTRACT | Cross-module | Profile → Plan | OBSERVED_GAP | STEPs 13–15 | — |
| E2E-STATE-002 | NEW PRODUCT CONTRACT | Cross-module | Plan → Profile | OBSERVED_PASS | STEPs 6–8 | — |
| E2E-STATE-003 | NEW PRODUCT CONTRACT | Cross-module | Profile → Recommendation | OBSERVED_GAP | STEPs 14–15 | — |
| E2E-STATE-004 | NEW PRODUCT CONTRACT | Cross-module | Completed prerequisite → downstream | OBSERVED_GAP / UNVERIFIED | STEPs 14–15/51 | — |

---

## 7. Known Product Gaps

### Confirmed / strong candidates (artifact-backed)

| ID | Gap |
| -- | --- |
| `CROSS-UX-001` | Incomplete Ukrainian localization across active journey chrome |
| `CROSS-UX-002` | Route CTA (`Показати маршрут`) without observable route output |
| `ER-LOOP-001` | Economic Reality repeats completed housing prerequisite instead of advancing |
| Registration completion/recovery | After address verification, no clear actionable Anmeldung continuation; blocked recovery unclear (`No direct constraints` / non-interactive actions) |
| Healthcare empty-success | HTTP 200 + empty recommendations/actions + unchanged user-facing UI |
| Employment journey disconnect | Work & Growth → Life Events without visible employment node; Work & income disabled without discovered unlock path |
| Guided Discovery | Guided CTA does not provide a guided multi-step journey |

### Ambiguous / unverified (do **not** upgrade to confirmed defects)

| Topic | Status | Notes |
| ----- | ------ | ----- |
| Discovery execution lifecycle | `AMBIGUOUS` | STEP 36 in-progress without verified terminal outcome |
| Discovery profile persistence | `UNVERIFIED` | STEPs 37/40 fresh-session empty read path |
| Benefits downstream consumption | `UNVERIFIED` | STEP 51 saved household unavailable in normal fresh session |
| Full return-visit persistence | `UNVERIFIED` | STEP 49 could not access prior saved session state |
| Anmeldung external completion recording | `PRODUCT_DECISION` | PD-001 |

---

## 8. Product Decisions

These remain explicit open gates. This specification does **not** silently resolve them.

### PD-001 — Registration completion

How does Arrival Atlas record completion of an external Anmeldung process?

### PD-002 — Economic Reality scope

Is Economic Reality:

- an action planner;
- an assessment;
- or both?

### PD-003 — Healthcare minimum context

What minimum user/profile data should be sufficient to produce useful Healthcare recommendations?

### PD-004 — Employment architecture

What is the canonical newcomer employment path?

`Work & Growth → Discovery`

or

`Work & Growth → Employment → Discovery`

### PD-005 — Guided Discovery

Should Guided Discovery be implemented as a real guided multi-step flow, or removed?

### PD-006 — Discovery persistence

What persistence guarantees are part of the Discovery product contract?

### PD-007 — Discovery execution

What is the authoritative Discovery execution lifecycle, timeout, and recovery policy?

---

## 9. Implementation Independence

This specification defines **product behavior**, not implementation.

The following should generally **not** be asserted by these E2E scenarios unless they are themselves product contracts:

- React component names;
- CSS classes;
- internal hooks;
- internal state variables;
- database tables;
- exact API implementation details;
- revision numbers;
- RSC prefetch behavior;
- internal event names;
- graph rendering implementation.

Prefer assertions on:

- URL;
- `document.lang`;
- visible text / headings / status;
- enabled/disabled / selected state;
- available actions;
- navigation outcomes;
- visible confirmation / result / error / empty states;
- user-understandable lifecycle labels.

The E2E contract should remain valid if the underlying implementation changes.

---

## 10. Relationship to future Playwright E2E

This document is the product-level input for future Playwright coverage.

Recommended mapping practice:

1. One E2E ID → one primary test (or tightly scoped describe block).
2. Assert only Observable Assertions.
3. Tag tests with current status (`OBSERVED_GAP`, `REQUIRED`, etc.) for triage — do not silently rewrite desired behavior to match failing production.
4. For `UNVERIFIED` / `AMBIGUOUS` / `PRODUCT_DECISION`, do not encode speculative expected values.
5. Never use storage injection or private APIs to “prove” persistence contracts that require normal-session verification.

No production code or existing E2E tests were modified to produce this specification.
