---
id: product-guide-v1
title: Arrival Atlas — Product Guide v1
project: Arrival Atlas
system: Arrival Atlas
type: contract
domain: product
status: active
maturity: canonical
owner: product
tags:
  - product-guide
  - ux-rules
  - journey-continuity
  - state-semantics
  - normative
created: 2026-09-07
updated: 2026-09-07
related:
  - ux-contract-v1
  - ux-contract-v2
  - platform-planning-constitution-v1
  - economic-reality-module-v1
  - life-event-module-v2-v1.0-architecture-freeze
---

# Arrival Atlas — Product Guide v1

## 1. Purpose

Arrival Atlas is a newcomer-oriented decision and guidance system.

Its primary responsibility is not to expose a collection of modules. Its responsibility is to help a newcomer answer:

> **Where am I now, what matters next, why does it matter, and what can I do about it?**

Every product flow should therefore connect:

**User intent → current situation → next step → action → outcome → updated situation → next step**

The Product Guide defines the behavioral and UX rules required to make this model consistent across Arrival Atlas.

---

# 2. Core Product Model

## 2.1 User Story is the primary unit

Every meaningful capability must be expressible as a User Story.

Example:

> As a newcomer, I want to understand how to register my address so that I can complete my Anmeldung.

A module, graph node or API endpoint is not itself a product flow.

---

## 2.2 Situation is the starting point

The product should prefer:

> “Based on your situation, this is what matters now.”

over:

> “Here are six modules you can open.”

The user should not need to understand Arrival Atlas architecture before being able to use it.

---

## 2.3 State must be understandable

Internal domain state may contain complex values, confidence, provenance, revisions and dependencies.

The user-facing product must translate those states into understandable concepts such as:

* Not added yet
* Available
* In progress
* Complete
* Needs update
* Blocked
* Ready for next step

Technical state names must not be exposed unless they have direct user meaning.

---

# 3. State Semantics

## 3.1 Not Added Yet

Meaning:

> Atlas does not currently have enough information in this domain.

Required UX:

* explain what information is missing;
* explain why it may matter;
* provide an action where appropriate.

Example:

> Household & family
> No household details yet.
> Household size can affect benefits estimates and family-related guidance.
> **[Add household details]**

---

## 3.2 Complete

Meaning:

> Atlas has sufficient information for the relevant purpose.

Required UX:

* visibly communicate completion;
* show the important known information;
* provide Edit;
* downstream modules must recognize the completed state.

A completed prerequisite must not silently reappear as an unresolved prerequisite.

---

## 3.3 Blocked

Blocked is a **temporary state**, not a dead end.

Every user-visible blocked state must answer:

1. Why is this blocked?
2. What prerequisite is missing?
3. What can I do now?

Preferred structure:

> **Registration**
> Blocked
>
> Before completing Anmeldung, you need to confirm your registration address.
>
> **[Provide address]**

If no action is currently possible, the product must still explain the dependency.

The phrase:

> “No direct constraints”

must not be presented as the explanation for a visibly blocked user action.

---

## 3.4 Ready

Meaning:

> All known prerequisites are satisfied and the user can proceed.

A transition from:

`BLOCKED → READY`

must be reflected in the UI without requiring the user to rediscover the state.

---

## 3.5 In Progress

Execution or a multi-step process is underway.

The UI must communicate:

* what is happening;
* whether the user can leave;
* whether progress is preserved;
* what outcome will appear.

Indefinite “running” states without an understandable lifecycle are not acceptable.

---

# 4. Action Semantics

## 4.1 Every action must have an observable consequence

A meaningful user action must result in at least one of:

* navigation;
* modal/dialog;
* editor/form;
* state transition;
* execution state;
* explicit success;
* explicit failure;
* explicit “nothing found / nothing applicable” outcome.

A button or action label that produces no observable consequence is not acceptable.

This rule specifically applies to route-like actions such as:

> Показати маршрут

if the action does not visibly expose a route.

---

## 4.2 Selection is not navigation

Graph nodes may be selectable.

Selection may legitimately produce:

```text
Node selected
→ Inspector updated
→ Context / Status / Actions displayed
```

This is different from navigation.

Therefore the product must distinguish visually and semantically between:

**Select**

and:

**Open / Start / Continue / Edit / Explore**

---

## 4.3 Action labels must describe their consequence

Prefer:

* Open healthcare options
* Update housing information
* Complete registration
* Start job search

over vague labels such as:

* Continue
* Explore
* Next

unless the destination is already unambiguous.

---

# 5. Recommendation Semantics

Recommendations are not decorative.

A recommendation represents:

> **The system believes this is the most useful next step given the current situation.**

Every recommendation should therefore provide:

1. What is recommended?
2. Why now?
3. What will it unlock or accomplish?
4. How to start?

Example:

> **Recommended next step**
> Confirm your registration address.
>
> Your housing information is complete, but registration still depends on an address confirmation.
>
> **[Confirm address]**

---

## 5.1 Recommendation persistence

Selecting a recommended node must not make the recommendation disappear without explanation.

If the user selects the recommendation:

```text
Recommendation
↓
Selected state
↓
Actionable inspector
```

The user should still understand that this is the recommended next step.

---

## 5.2 Recommendation recalculation

After any meaningful state mutation:

```text
Profile updated
↓
Domain state changed
↓
Plan recalculated
↓
Recommendation recalculated
```

The product must not continue recommending a prerequisite that is already complete.

---

# 6. Profile as the State Foundation

Profile domains are the persistent representation of the user's situation.

The canonical pattern is:

```text
Domain
 ↓
Inspect
 ↓
Edit
 ↓
Save
 ↓
Persist
 ↓
Visible confirmation
 ↓
Domain becomes Complete / Updated
 ↓
Downstream plan recalculates
```

The existing Housing and Household save flows provide a useful reference implementation.

---

## 6.1 Save behavior

After a successful save, the user should receive:

* explicit confirmation;
* updated values;
* updated state;
* updated completeness where applicable;
* updated downstream recommendations where relevant.

A backend mutation succeeding without visible confirmation is insufficient as the primary UX.

---

## 6.2 Dirty state

Where practical:

* Save should communicate whether changes exist;
* unchanged forms should not imply that saving is necessary;
* validation should be understandable;
* field requirements should be explicit.

This is a guideline rather than an immediate mandatory redesign of every existing editor.

---

# 7. Registration Product Guide

## User Story

> As a newcomer, I want to understand and complete the registration process in Germany.

## Desired state progression

```text
Registration
 ↓
Address missing
 ↓
Provide / verify address
 ↓
Address COMPLETE
 ↓
Registration READY
 ↓
Start Anmeldung process
 ↓
External / guided process
 ↓
Confirm completion
 ↓
Registration COMPLETE
```

## Required behavior

When address is incomplete:

> Registration is waiting for your address information.

Provide an actionable path.

When address becomes complete:

> Your address information is complete.

Registration must become actionable if no other prerequisite remains.

If another prerequisite remains, the product must explicitly identify it.

---

## External process rule

Arrival Atlas must never imply that it performs an external government process when it does not.

For external processes, clearly distinguish:

**Atlas helps you prepare**

from:

**You must complete this with the relevant authority.**

After the external process, the product needs a defined mechanism for recording completion.

---

## Registration recovery

After leaving and returning:

* preserve the known state;
* preserve the blocking reason;
* preserve the next action;
* do not force the user to rediscover the process.

---

# 8. Economic Reality Product Guide

## User Story

> As a newcomer, I want to understand my financial situation and know what I should do next to become financially stable.

## Primary role

For v1, Economic Reality should operate primarily as an **action-oriented financial plan**.

It should answer:

> What should I do next?

A richer financial assessment can be added later without changing the core state/action model.

---

## Desired progression

```text
Economic Reality
 ↓
Understand current situation
 ↓
Recommended action
 ↓
Start intent
 ↓
Prerequisite
 ↓
Complete
 ↓
Next prerequisite
 ↓
Financial / benefits path
```

---

## Completed prerequisite rule

Example:

```text
Housing = COMPLETE
Registration = INCOMPLETE
```

The product must communicate:

> Housing information is complete.
> Your next step is registration.

It must not simply reopen the housing editor.

This directly addresses `ER-LOOP-001`.

---

## Profile continuation

If Economic Reality sends the user to Profile:

```text
Economic Reality
 ↓
Update Profile
 ↓
Save
 ↓
Confirmation
 ↓
Return to relevant plan
 ↓
Plan recalculated
```

The user should have an obvious continuation path.

---

# 9. Healthcare Product Guide

## User Story

> As a newcomer, I want to understand my health-insurance situation and know what I should do next.

## Execution contract

Healthcare execution must produce one explicit product outcome.

Allowed outcomes:

### Recommendations found

Show:

* recommendations;
* explanation;
* actions;
* next step.

### More information needed

Show:

* missing information;
* why it is needed;
* action to provide it.

### No applicable result

Show:

* that the search completed;
* that no result was found;
* why, where known;
* how the user can continue.

### Technical failure

Show:

* understandable error;
* retry action;
* preservation of useful entered information.

---

## Empty-success rule

This state is prohibited:

```text
200 OK
+
empty recommendations
+
empty actions
+
no explanation
+
unchanged UI
```

A successful execution must always have a user-visible semantic outcome.

This directly addresses the observed Healthcare empty-success state.

---

# 10. Employment Product Guide

## User Story

> As a newcomer, I want to find suitable work and understand what I should do next.

## Canonical journey

The preferred conceptual flow is:

```text
Work & Growth
 ↓
Employment
 ↓
Job search
 ↓
Discovery / Jobs
 ↓
Search profile
 ↓
Execution
 ↓
Results
 ↓
Apply / continue
```

This creates a bridge between the newcomer-facing journey and the existing Discovery capability.

---

## Work & income vs Job Search

These are different concepts.

**Work & income**

describes the user's current employment situation.

**Job Search**

is an active capability for finding opportunities.

They should not be conflated.

---

## Unlock behavior

If Work & income is disabled:

The product should explain:

* why;
* what prerequisite is missing;
* how to unlock it.

If there is no real prerequisite, the domain should not remain mysteriously disabled.

---

# 11. Discovery Product Guide

## User Story

> As a newcomer, I want Atlas to find relevant opportunities for me.

Discovery should support:

```text
Intent
 ↓
Choose opportunity type
 ↓
Configure criteria
 ↓
Create profile
 ↓
Confirm creation
 ↓
Run search
 ↓
Observe execution
 ↓
Receive result
```

---

## 11.1 Guided Discovery

A “Guided” entry point must actually guide the user.

Expected:

```text
Guided
 ↓
What are you looking for?
 ↓
Where?
 ↓
Important constraints
 ↓
Delivery
 ↓
Review
 ↓
Create
```

If this guided experience cannot be provided, the product should not present a CTA that implies it exists.

---

## 11.2 Profile creation

After successful creation:

```text
Profile created
```

must be explicitly communicated.

The user should understand:

* profile exists;
* what it searches for;
* whether it is enabled;
* whether it has run;
* what they can do next.

---

## 11.3 Execution lifecycle

Discovery runs must have an explicit lifecycle:

```text
IDLE
 ↓
QUEUED
 ↓
RUNNING
 ├── SUCCESS
 ├── NO RESULTS
 └── ERROR
```

Every terminal state must be visible.

---

## 11.4 No-results state

“No results” is not an error.

It should say:

> Search completed, but no matching opportunities were found.

and provide useful next actions such as:

* change criteria;
* broaden location;
* modify role;
* run again.

---

## 11.5 Error state

Errors should provide recovery:

```text
Search failed
 ↓
Why, if known
 ↓
[Retry]
```

---

## 11.6 Persistence

Discovery profiles are persistent user assets.

If the product creates a profile, a returning user should be able to find it again through the normal authenticated/user session.

This should be verified by E2E once normal session persistence is available.

---

# 12. Localization Guide

Localization is a product requirement, not merely a technical property.

If the user selects Ukrainian:

```text
document.lang = uk
```

is necessary but insufficient.

The relevant journey must consistently localize:

* navigation;
* headings;
* descriptions;
* actions;
* state labels;
* forms;
* validation;
* errors;
* results;
* recommendations.

Mixed Ukrainian/Russian/English content should be treated as a localization defect when it occurs in the same user flow.

This directly addresses `CROSS-UX-001`.

---

# 13. Persistence & Return Visits

A newcomer should be able to leave Atlas and return without losing meaningful progress.

Desired:

```text
Session 1
 ↓
Update profile
 ↓
State saved
 ↓
Leave
 ↓
Return
 ↓
State restored
 ↓
Next action restored
```

Persistence applies to:

* profile facts;
* completed domains;
* meaningful journey state;
* discovery profiles;
* relevant plan state.

Temporary UI state does not necessarily need persistence.

---

# 14. Recovery Principles

Every meaningful failure must answer:

1. What happened?
2. Did my information survive?
3. What can I do now?

Recovery should not reset useful user progress unless necessary.

Examples:

### Failed Discovery run

```text
Search failed
[Retry]
[Change criteria]
```

### Blocked Registration

```text
Registration blocked
Reason: address not confirmed
[Provide address]
```

### Empty Healthcare result

```text
No recommendations yet
Missing information: ...
[Update information]
```

---

# 15. Journey Continuity

The user should always be able to understand:

```text
Where am I?
        ↓
Why am I here?
        ↓
What is my current state?
        ↓
What is next?
```

The product should avoid situations where:

* a module is technically reachable but disconnected from the user's intent;
* a recommendation points nowhere;
* an action returns to a previous step without explanation;
* a completed prerequisite is requested again;
* a disabled capability has no explanation.

---

# 16. Canonical UX Pattern

The following pattern should become the default across Arrival Atlas:

```text
┌─────────────────────────────┐
│ CURRENT SITUATION            │
│                              │
│ What we know                 │
│ What is complete             │
│ What is missing              │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│ WHY THIS MATTERS             │
│                              │
│ Short explanation            │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│ NEXT STEP                    │
│                              │
│ What to do                   │
│ Why                           │
│ What it unlocks              │
│                              │
│ [Action]                     │
└──────────────┬──────────────┘
               ↓
         STATE CHANGE
               ↓
┌─────────────────────────────┐
│ CONFIRMATION                 │
│                              │
│ What changed                 │
│ What is next                 │
└─────────────────────────────┘
```

This pattern can be represented through different visual forms — graph, cards, timeline, inspector, module page — without changing its product semantics.

---

# 17. Product Rules Summary

The following rules are normative for Product Guide v1.

| ID     | Rule                                                                                 |
| ------ | ------------------------------------------------------------------------------------ |
| PR-001 | Every blocked state explains why it is blocked.                                      |
| PR-002 | Every actionable blocked state exposes a recovery path.                              |
| PR-003 | Every meaningful action produces an observable consequence.                          |
| PR-004 | Selection and navigation have different semantics.                                   |
| PR-005 | Every successful execution has a user-visible semantic outcome.                      |
| PR-006 | Completed prerequisites are recognized by downstream flows.                          |
| PR-007 | Recommendations are recalculated after meaningful state changes.                     |
| PR-008 | User intent must have a discoverable capability path.                                |
| PR-009 | Profile mutations produce explicit confirmation.                                     |
| PR-010 | External processes are clearly distinguished from Atlas actions.                     |
| PR-011 | Guided experiences must actually guide the user.                                     |
| PR-012 | Long-running execution has an observable lifecycle.                                  |
| PR-013 | No-results is a valid terminal state, not an invisible success.                      |
| PR-014 | Errors provide recovery where recovery is possible.                                  |
| PR-015 | Meaningful user progress survives normal return visits.                              |
| PR-016 | Selected language applies consistently across the active journey.                    |
| PR-017 | User-facing state must be understandable without knowledge of internal architecture. |
| PR-018 | Every journey must expose the user's current state and next meaningful action.       |

---

# 18. Product Decisions Still Required

The following questions intentionally remain open.

### PD-001 — Registration completion

How does Atlas record completion of an external Anmeldung process?

### PD-002 — Economic Reality scope

Is Economic Reality:

* action planner;
* assessment;
* or both?

### PD-003 — Healthcare minimum context

What minimum user/profile data should be sufficient to produce useful recommendations?

### PD-004 — Employment architecture

Should the canonical path be:

`Work & Growth → Discovery`

or:

`Work & Growth → Employment → Discovery`

### PD-005 — Guided Discovery

Should Guided Discovery be a real multi-step experience or be removed?

### PD-006 — Discovery persistence

What persistence guarantees are part of the product promise?

### PD-007 — Discovery execution

What is the authoritative lifecycle and timeout/recovery policy for a Discovery run?

---

# 19. Definition of a Good Journey

A journey is considered product-complete when a newcomer can:

1. state their intent;
2. find the relevant capability;
3. understand why it matters;
4. see their current state;
5. understand what is missing;
6. take the next action;
7. see what changed;
8. understand what comes next;
9. leave and return without losing meaningful progress;
10. recover from blocked, empty or failed states.

The final test is not:

> “Can the system perform the operation?”

It is:

> **“Can a newcomer understand what happened and confidently know what to do next?”**
