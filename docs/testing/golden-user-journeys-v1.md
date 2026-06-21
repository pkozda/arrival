---
id: golden-user-journeys-v1
title: Golden User Journeys v1
project: Arrival Atlas
system: Arrival Atlas
type: specification
domain: platform
status: active
maturity: frozen
owner: architecture
tags:
  - golden-journeys
  - e2e-contract
  - life-event
  - economic-reality
  - behavioral-spec
  - regression-governance
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - platform-planning-constitution-v1
  - economic-reality-v1-closure-spec
  - life-event-module-v2-spec
related:
  - e2e-user-journey-tests-report
  - economic-classifier-fixtures
  - life-event-classifier-fixtures
  - ux-contract-v1
---

# Golden User Journeys v1

**Document type:** Platform behavioral contract — not a test report  
**Version:** 1.0.0  
**Status:** Active / Frozen  
**Audience:** Architecture, engineering, QA, product, audit reviewers

---

## Metadata

| Field | Value |
|-------|-------|
| **ID** | `golden-user-journeys-v1` |
| **Project** | Arrival Atlas |
| **Domain** | Platform |
| **Maturity** | Frozen |
| **Owner** | Architecture |
| **Created** | 2026-06-21 |
| **Updated** | 2026-06-21 |

---

## Purpose

Golden Journeys define the **expected user-visible outcomes** that must hold as Arrival Atlas evolves. They describe what a newcomer should experience when the platform classifies their situation, routes them across modules, plans next steps, and renders guidance — independent of how those outcomes are produced internally.

A Golden Journey is valid even when:

- rule engines are rewritten
- graph catalogs are reorganized
- planners are refactored or replaced
- presentation adapters change shape

Golden Journeys intentionally **ignore**:

- rule IDs (e.g. R1–R7)
- graph node IDs and internal graph names
- planner pipeline stages and implementation files
- fixture construction mechanics beyond canonical input identifiers

Only **observable behavior** matters: classification results visible to the user journey, module recommendations, plan shape, presentation sections, action availability, UI card types, and determinism guarantees at API boundaries.

This document is the authoritative reference for:

- E2E test design and coverage expectations
- platform audits and readiness reviews
- regression analysis after refactors
- roadmap validation (“does this change preserve user intent?”)
- cross-module integration contracts

Supporting evidence for current implementation alignment: [E2E User Journey Tests Report](../economic-reality/e2e-user-journey-tests-report.md).

---

## Scope

### In scope

**Modules**

| Module | Role in Golden Journeys |
|--------|-------------------------|
| Life Event | Situation classification and cross-module recommendation |
| Economic Reality | Economic planning, action surfacing, and guidance presentation |

**Behavioral layers**

| Layer | Contract concern |
|-------|------------------|
| Classification | Life state and economic state recognized from user context |
| Module routing | Catalog-backed recommendation and entry into Economic Reality |
| Planning | Strategy selection appropriate to user situation |
| Presentation | Section structure and action surfacing |
| UI | Card types and copy-key presentation boundary |

### Out of scope

- Internal rule engine semantics and rule catalogs
- Graph catalog structure and node topology
- EP-12 feedback and telemetry events
- Visual design, pixel layout, and localization copy content
- Implementation-specific response field ordering or internal metadata
- Modules not yet covered by v1 (Benefits Simulator, Housing, Legal, etc.)

### Canonical inputs

Golden Journeys reference **fixture identifiers** only. Fixture definitions live in:

- Life Event: [life-event-classifier-fixtures.md](../life-events/life-event-classifier-fixtures.md) (`F01`, …)
- Economic Reality: [economic-classifier-fixtures.md](../economic-reality/economic-classifier-fixtures.md) (`EF03`, `EF07`, `EF13`, …)

Fixture IDs denote **deterministic user-context profiles**, not test implementation details.

---

## Observable vocabulary

Terms used throughout this specification describe **user-visible outcomes**, not internal implementation.

| Term | Behavioral meaning |
|------|-------------------|
| **Arrival classified** | Life Event produces a recognizable life-state outcome for the user's integration status (e.g. arrival not yet completed). |
| **Economic Reality suggested** | Module catalog recommends Economic Reality as a relevant next module for the user's situation. |
| **Crisis-oriented path** | Planning prioritizes immediate economic survival: urgent primary actions and system-level support resources are surfaced. |
| **Progression-oriented path** | Planning prioritizes forward movement through institutional integration steps rather than emergency support. |
| **Institution-oriented path** | Planning assumes active participation in institutional systems and focuses on maintenance, reporting, and compliance. |
| **PRIMARY section** | The dominant action surface — what the user should do next. |
| **SECONDARY section** | Supporting actions that complement the primary path. |
| **SYSTEM section** | Platform or external resources that assist without being the user's main task. |
| **Benefit or support initiation** | An actionable intent to begin or continue access to economic support (not merely informational copy). |
| **Institutional next steps** | Actions that advance registration, benefits office, or related official processes. |
| **Profile maintenance** | Actions that invite the user to update declared employment, income, benefits, or related profile facts. |
| **deterministicHash** | Stable fingerprint of the full planning outcome for a given input context; must change when user-visible planning outcome should change. |

---

## Journey index

| ID | Title | Primary fixtures | Planning posture |
|----|-------|------------------|------------------|
| **GJ-01** | First arrival without income | F01, EF07 | Crisis-oriented |
| **GJ-02** | Registration incomplete | EF03 | Progression-oriented |
| **GJ-03** | Employed with active benefits | EF13 | Institution-oriented |
| **GJ-04** | Crisis recovery transition | EF07 → stabilized | Crisis → non-crisis |

---

# Journey GJ-01

## First arrival without income

### Input

| Source | Fixture | Meaning |
|--------|---------|---------|
| Life Event | `F01` | Newcomer with incomplete arrival integration |
| Economic Reality | `EF07` | No declared income, employment, or benefits |

### Expected user experience

The user enters the platform with minimal economic context.

The system recognizes that arrival integration is not complete and that the user's economic situation requires immediate attention.

The system recommends the **Economic Reality** module as a relevant next step.

When the user enters Economic Reality, they receive **crisis-oriented guidance**: clear primary actions for what to do now, plus system-level resources for immediate support. The experience must not suggest that the user is economically self-sufficient.

### Required outcomes

**Life Event**

- Arrival situation is classified (integration not complete).

**Routing**

- Economic Reality is suggested via module catalog (not ad-hoc hardcoded routing).

**Economic Reality — planning**

- Crisis-oriented planning path is selected.

**Presentation**

- PRIMARY section exists and contains actionable guidance.
- SYSTEM section exists and surfaces support resources.

**Actions**

- At least one benefit or support initiation action is available to the user.

**UI**

- IntentCard is rendered for system or benefit-oriented intents.
- ResourceCard is rendered for system-level external resources.

### Forbidden outcomes

- Self-sustained or “no action needed” economic path.
- Economic Reality module hidden or absent from recommendations when economically relevant.
- Empty primary action surface with no guidance for the user.

---

# Journey GJ-02

## Registration incomplete

### Input

| Source | Fixture | Meaning |
|--------|---------|---------|
| Economic Reality | `EF03` | Integration started; institutional steps remain incomplete |

### Expected user experience

The user has begun the integration process but has not finished institutional registration.

The system does **not** treat this as an acute economic emergency. Instead, it emphasizes **progression** — completing the next institutional steps required to move forward.

### Required outcomes

**Planning**

- Progression-oriented path is selected.

**Presentation**

- PRIMARY section exists with forward-looking guidance.

**Actions**

- Institutional next steps are available (e.g. beginning or continuing official processes).

**UI**

- Progression guidance is visible through appropriate action and intent surfaces.

### Forbidden outcomes

- Crisis-first experience with emergency framing.
- Emphasis on immediate emergency support over institutional progression.

---

# Journey GJ-03

## Employed with active benefits

### Input

| Source | Fixture | Meaning |
|--------|---------|---------|
| Economic Reality | `EF13` | Active employment and active benefits participation |

### Expected user experience

The user already participates in institutional economic systems (employment and benefits).

The system shifts from onboarding or crisis framing to **maintenance and reporting**. The user should see how to keep their declared situation accurate and stay compliant with institutional requirements.

### Required outcomes

**Planning**

- Institution-oriented path is selected.

**Presentation**

- PRIMARY section exists.
- SECONDARY section exists with supporting maintenance actions.
- SYSTEM section is minimal or empty — the user does not need emergency platform resources.

**Actions**

- Profile maintenance actions are available (update employment, income, benefits, or related facts).

**UI**

- ProfileCard is rendered for profile maintenance actions.
- No crisis-oriented IntentCard for benefit application or emergency entry.

### Forbidden outcomes

- Crisis guidance or emergency economic framing.
- Benefit application initiation flow (user is already in the system).
- Emergency or crisis module entrypoint emphasis.

---

# Journey GJ-04

## Crisis recovery transition

### Input

| Phase | Fixture / state | Meaning |
|-------|-----------------|---------|
| Initial | `EF07` | Crisis economic context |
| Updated | Stabilized employment and income profile | User context improved after profile update |

“Stabilized” means the user context reflects active employment and declared income sufficient to exit crisis planning — without prescribing internal classification thresholds.

### Expected user experience

Initially, the user receives crisis-oriented support guidance consistent with GJ-01.

After the user improves their profile (employment and income declared), the system **recognizes the change** and shifts focus toward progression and institutional maintenance. The user should perceive a meaningful change in what the platform recommends — not the same crisis plan as before.

### Required outcomes

**Initial state**

- Crisis-oriented plan (consistent with GJ-01 planning posture).

**Updated state**

- Non-crisis plan (progression- or institution-oriented posture).
- Plan content differs from the initial crisis plan in user-visible ways.

**System**

- `deterministicHash` changes after stabilization — the platform acknowledges a new planning outcome.
- Presentation reflects a visible transition in UI strategy (section emphasis and card types shift accordingly).

### Forbidden outcomes

- Unchanged plan after profile stabilization when economic posture has materially improved.
- Unchanged `deterministicHash` after a context change that should alter user-visible planning.

---

## Determinism contract

Golden Journeys inherit the platform determinism contract. This applies to **all journeys** (GJ-01 through GJ-04).

### Same input → same outcome

For a fixed user context and request metadata, the platform must produce:

| Artifact | Stability requirement |
|----------|----------------------|
| Module routing | Identical catalog-backed recommendations |
| Planning result | Identical plan structure and action membership |
| Presentation | Identical section layout and card mapping |
| `deterministicHash` | Identical across repeated requests |

Repeated requests with unchanged context must not drift.

### Context change → intentional transition

When user context changes in a way that alters the user's economic or integration posture:

| Artifact | Transition requirement |
|----------|------------------------|
| `deterministicHash` | Must change |
| Planning result | Must reflect the new posture |
| Presentation | Must visibly adapt to the new plan |

Context changes that should **not** alter planning (e.g. cosmetic profile fields) are out of v1 Golden Journey scope and belong in module-specific contracts.

### Regression signal

| Symptom | Likely contract breach |
|---------|------------------------|
| Same context, different hash across runs | Determinism violation |
| Same context, different plan | Determinism violation |
| Material context change, same hash | Stale planning / missed transition (GJ-04) |
| Material context change, same user-visible plan | Missed transition (GJ-04) |

---

## Cross-cutting invariants

These invariants apply to **every** Golden Journey regardless of planning posture.

| Invariant | Requirement |
|-----------|-------------|
| **Catalog-only routing** | Cross-module recommendations resolve through the module catalog. No parallel hardcoded routing maps. |
| **actionSet integrity** | Every action surfaced in the plan must belong to the authorized action set for that planning outcome. |
| **Copy-key presentation** | User-visible labels use i18n keys (`ER.*`, etc.), not raw implementation strings or internal action identifiers. |
| **No silent module drop** | When a module is economically relevant to the user's classified situation, it must remain discoverable through catalog recommendation. |
| **Section contract** | Presentation sections use the PRIMARY / SECONDARY / SYSTEM model. Posture determines which sections are populated, not whether the model exists. |

---

## E2E coverage mapping

Golden Journeys are enforced by E2E suites at three architectural boundaries. Coverage status as of 2026-06-21.

| Journey | API tests | Module E2E tests | UI E2E tests |
|---------|-----------|------------------|--------------|
| **GJ-01** First arrival without income | `scenario-a-api-journey` | `scenario-a-onboarding-journey` | `scenario-a-ui-rendering`, `module-orchestration-ui` |
| **GJ-02** Registration incomplete | `determinism-api` (EF03), `scenario-a-api-journey` (institution branch) | `scenario-a-onboarding-journey` (EF03 branch) | — |
| **GJ-03** Employed with active benefits | `scenario-b-api-journey`, `determinism-api` (EF13) | `scenario-b-stabilized-user` | `scenario-b-ui-rendering` |
| **GJ-04** Crisis recovery transition | `scenario-c-api-journey` | `scenario-c-crisis-recovery` | `scenario-c-ui-rendering` |
| **Determinism (all journeys)** | `determinism-api` | `determinism-regression` | — |
| **Routing integrity (GJ-01)** | — | `module-orchestration-journey` | `module-orchestration-ui` |
| **Action execute boundary** | `action-execute-e2e` | — | — |

**Suite locations**

| Layer | Path |
|-------|------|
| API | `apps/api/tests/e2e/economic-reality/` |
| Module orchestration | `packages/modules/tests/e2e/economic-reality/` |
| UI rendering | `apps/web/tests/e2e/economic-reality/` |

A Golden Journey without E2E coverage at any applicable layer is **incompletely enforced** and must be treated as a specification gap, not an optional test nicety.

---

## Architectural status

Golden User Journeys v1 are **frozen platform contracts**.

They represent the minimum behavioral bar for Life Event × Economic Reality integration at platform maturity v1. They do not prescribe implementation; they prescribe **user intent that must survive refactors**.

Future changes to any of the following must preserve all Golden Journeys or explicitly amend this specification:

- Life Event classification and plan output
- Economic Reality planning and presentation pipeline
- Module Catalog entries and cross-module link resolution
- Routing and `open_module` behavior
- Presentation section model and UI adapter mapping
- Determinism and `deterministicHash` semantics

**Implementation may change. Behavioral intent may not — unless this document is formally updated.**

---

## Change governance

Any modification to a Golden Journey requires all of the following:

| Step | Action | Owner |
|------|--------|-------|
| 1 | Architecture review — confirm the behavioral change is intentional | Architecture |
| 2 | Specification update — amend this document with version bump or addendum | Architecture |
| 3 | E2E update — add or modify tests at affected layers | Engineering |
| 4 | Audit acknowledgement — record impact in relevant audit or closure document | Architecture / QA |

### Prohibited change patterns

- Modifying a Golden Journey **only** because implementation changed, without product or architecture intent.
- Removing E2E coverage for a journey while leaving the journey active in this specification.
- Asserting internal rule or graph IDs in E2E tests as a substitute for behavioral contracts defined here.

### Allowed change patterns

- Refactoring planners, graphs, or rules while all Golden Journey outcomes remain unchanged.
- Adding new Golden Journeys (GJ-05+) via specification version increment.
- Expanding E2E coverage depth (e.g. browser-level tests) without altering journey definitions.

**Behavioral intent is authoritative. Implementation follows the contract — not the reverse.**

---

## Versioning and evolution

| Version | Scope | Status |
|---------|-------|--------|
| **v1** | Life Event + Economic Reality; GJ-01 – GJ-04 | Frozen / Active |

Future platform modules (Benefits Simulator, Housing, Legal) will receive their own Golden Journey sets under `golden-user-journeys-v2` or domain-specific addenda. v1 journeys remain in force for Life Event × Economic Reality regardless of v2 expansion.

---

## Related documents

| Document | Relationship |
|----------|--------------|
| [Platform Planning Constitution v1](../platform/platform-planning-constitution-v1.md) | Planning authority and governance kernel |
| [Economic Reality v1 Closure Spec](../economic-reality/economic-reality-v1-closure-spec.md) | Module closure boundary referenced by GJ-01 – GJ-04 |
| [E2E User Journey Tests Report](../economic-reality/e2e-user-journey-tests-report.md) | Current implementation evidence (not normative) |
| [UX Contract v1](../ux/ux-contract-v1.md) | Presentation and interaction boundaries |
