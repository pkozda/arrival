---
id: economic-state-model
title: Economic State Model — Canonical Reference for Economic Reality Planning
project: Arrival Atlas
system: Arrival Atlas
type: spec
domain: finance
status: draft
maturity: evolving
owner: product
tags:
  - economic-reality
  - economic-state
  - jobcenter
  - buergergeld
  - sozialamt
  - germany
  - refugees
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - economic-reality-module-v1
  - economic-rule-engine-v1
  - life-state-model
  - platform-planning-constitution-v1
related:
  - economic-reality-module-v1-spec
  - economic-reality-module-v1-roadmap
  - economic-classifier-fixtures
  - economic-graph-catalog-v1
  - benefits-simulator-design
---

# Economic State Model

**Document type:** Product model — canonical economic-state reference  
**System:** Arrival Atlas · Economic Reality Module v1.0  
**Version:** 1.0  
**Status:** Draft — authoritative for Economic Reality planning  
**Audience:** Product, design, engineering (classifier, graph catalog, fixtures)

---

## Purpose

This document answers:

> **In which economic survival mode is the user operating within the German institutional system — and what does that mean for financial next steps?**

It is **not** the Life Event state model. Life Event describes life situation; this model describes **how money and public support flow** (or fail to flow) in that situation.

### Position in the product stack

```text
P1–P3  →  situation facts
P4     →  confidence & gaps
Life Event  →  life situation & life-action plan
Economic Reality  →  institutional economic survival plan  ← this document
```

An **economic state** is a derived planning label — not a stored profile fact. Users do not "set" E4; the [Rule Engine](./economic-rule-engine-v1.md) infers it from declared employment, benefits, residency, and income signals.

**Classification owner:** [economic-rule-engine-v1.md](./economic-rule-engine-v1.md) — not this document. This document defines **meaning**, not execution order.

---

## Economic axes v1 (system-centric lens)

States are **composite**, not a single employment-centric line. The rule engine projects two axes alongside `economicState`:

### Axis A — Income source

| Value | Meaning |
|-------|---------|
| `employment` | Primary survival from work relationship |
| `benefits_jobcenter` | Primary survival from SGB II / Bürgergeld |
| `benefits_sozialamt` | Primary survival from Sozialamt-path support |
| `none` | No stable income source declared |

### Axis B — Institutional dependency

| Value | Meaning |
|-------|---------|
| `independent` | No ongoing public subsistence dependency |
| `semi_dependent` | Partial support, reporting, or transition (e.g. employed + reporting) |
| `fully_dependent` | Active institutional support system (Jobcenter or Sozialamt) |
| `transitional` | Between systems — application, crisis, or job loss |

**Design shift:** The primary planning lens is **which system the user depends on**, not whether they have a job title. Employment is one income source; benefits systems are peers, not derived afterthoughts.

**Example — E4:**

```text
economicState: benefits_jobcenter
axes.incomeSource: benefits_jobcenter
axes.institutionalDependency: fully_dependent
```

---

## Active economic states (v1.0)

| State ID | Code | Short label | Planning severity |
|----------|------|-------------|-------------------|
| `self_sustained` | **E1** | No public support — self-sustained | **low** |
| `employment_active` | **E2** | Employed / active income | **low–medium** |
| `unemployment_transition` | **E3** | Job loss or unstable work — needs evaluation | **high** |
| `benefits_jobcenter` | **E4** | Bürgergeld / Jobcenter system active | **medium** |
| `benefits_sozialamt` | **E5** | Sozialamt / asylum-era or municipal support path | **high** |
| `application_pending` | **E6** | Support application in progress, not resolved | **high** |
| `financial_crisis` | **E7** | No income and no active support | **critical** |

### Default axis mapping

| State | Axis A (`incomeSource`) | Axis B (`institutionalDependency`) |
|-------|-------------------------|-----------------------------------|
| E1 | `none` or `employment` | `independent` |
| E2 | `employment` | `independent` or `semi_dependent` |
| E3 | `none` | `transitional` |
| E4 | `benefits_jobcenter` | `fully_dependent` |
| E5 | `benefits_sozialamt` | `fully_dependent` |
| E6 | `none` | `transitional` |
| E7 | `none` | `transitional` |

### Severity interpretation

| Severity | Meaning for UI |
|----------|----------------|
| **critical** | Immediate survival risk — hero focus, crisis recovery graph |
| **high** | Wrong or missing system attachment — urgent routing |
| **medium** | In system but obligations / transitions need attention |
| **low** | Stable or optimization-phase economics |

---

## State definitions

### E1 — `self_sustained` (No Support / Self-Sustained)

**Meaning:** User declares stable income adequate for current household needs without active public subsistence support.

**Typical signals:** Employed or self-employed with declared income; no active Bürgergeld / Sozialhilfe; may still explore Wohngeld separately (out of ER v1 core).

**Planning focus:** Maintain stability; voluntary transitions (raise, hours, tax class) via tools — not crisis routing.

**Not this state if:** Income unknown + no support → prefer E6 or E7.

---

### E2 — `employment_active` (Employment Active)

**Meaning:** User has active employment relationship but economic picture may be incomplete (partial income, mini-job, probezeit).

**Typical signals:** `employmentStatus: employed`; income may be partial; benefits may be inactive or being phased out.

**Planning focus:** Income reporting, benefit exit obligations if transitioning from E4, insurance continuity.

**Distinction from E1:** E2 emphasizes **employment relationship** as the dominant economic anchor even if income is thin.

---

### E3 — `unemployment_transition` (Unemployment / Transition)

**Meaning:** Job loss, contract end, or unstable employment requiring **support system evaluation**.

**Typical signals:** Recently unemployed; ALG I may apply (linked, not fully modeled in v1); must route toward Jobcenter assessment.

**Planning focus:** Register with Agentur für Arbeit / Jobcenter; gather termination documents; avoid gap between last salary and first support payment.

**Life Event link:** Often co-occurs with LE `economic_setup_pending` — LE owns life narrative; ER owns **which office and benefit rail**.

---

### E4 — `benefits_jobcenter` (Benefits Active — Jobcenter)

**Meaning:** User is in the **SGB II / Bürgergeld** institutional loop via Jobcenter.

**Typical signals:** Declared Bürgergeld receipt or Jobcenter case; reporting obligations; integration agreements possible.

**Planning focus:** Ongoing Melde obligations, document updates, job search requirements, transition planning to employment.

**Design note:** Jobcenter is a **system node**, not a module detail.

---

### E5 — `benefits_sozialamt` (Benefits Active — Sozialamt)

**Meaning:** User receives or should receive support primarily through **Sozialamt** pathways.

**Typical signals (Germany, immigrant-relevant):**

- Asylum procedure — **AsylbLG** via Sozialamt
- Protection status (e.g. §24 AufenthG) with municipal Sozialleistungen arrangements
- Edge cases where SGB II is not yet the correct rail

**Planning focus:** Correct office contact, proof of arrival/registration, transition awareness toward Jobcenter when status/income preconditions change.

**Product priority:** Core for **refugee and protection-status users** — not an edge-case state.

---

### E6 — `application_pending` (Application Pending)

**Meaning:** User has initiated or intends support but **system attachment is unresolved** — no stable payments yet.

**Typical signals:** "Applied to Jobcenter"; appointment scheduled; missing documents blocking decision; declared intent without confirmation.

**Planning focus:** Document checklist, appointment prep, bridging strategies (legally bounded — product copy avoids advising fraud).

**Distinction from E7:** E6 implies **process started**; E7 implies **no process and no income**.

---

### E7 — `financial_crisis` (Financial Crisis / Gap)

**Meaning:** No adequate declared income **and** no active or pending public support — survival gap.

**Typical signals:** Zero/unknown income; benefits inactive; savings depleted (if declared); new arrival without system registration.

**Planning focus:** Emergency stabilization graph G5 — route to correct support rail fast; link LE registration/housing blockers.

**Severity:** Always **critical** when classifier confidence ≥ medium.

---

## Secondary conditions (v1.0)

Secondary conditions **adjust ranking** within a graph; they do not replace primary economic state (mirror LE pattern).

| Condition ID | Label | Effect |
|--------------|-------|--------|
| `SC-REG` | Registration incomplete | Blocks Jobcenter onboarding nodes |
| `SC-ADDR` | No stable address | Blocks Sozialamt/Jobcenter processing |
| `SC-INS` | Insurance gap | Parallel blocker — link healthcare module |
| `SC-DOC` | Missing benefit documents | Elevates document prep nodes |
| `SC-LANG` | Language barrier declared | Elevates translation / appointment prep |
| `SC-HH` | Household data incomplete | Affects needs assessment nodes |
| `SC-STATUS` | Residency status unclear | Lowers plan confidence; prompts profile correction |
| `SC-REPORT` | Reporting overdue (declared) | Elevates compliance nodes in E4 |

---

## Classification execution (delegated)

State selection is **not** defined here. See [economic-rule-engine-v1.md](./economic-rule-engine-v1.md):

```text
R1 crisis → R2 pending → R3 Sozialamt → R4 Jobcenter → R5 unemployment → R6 employment → R7 self-sustained
FIRST MATCH WINS — no score blending
```

This document describes **what each state means** after the rule engine assigns it.

---

## Support system dimension

Primary `supportSystem` is an **output** of the rule engine (singular, deterministic).

| System ID | Typical states |
|-----------|----------------|
| `jobcenter` | E4; E6 (Jobcenter track); E2 with reporting obligation |
| `sozialamt` | E5; E6 (Sozialamt track) |
| `employment_agency` | Reference only in v1 (ALG I) |
| `none` | E1, E3, E7; E2 without benefit attachment |

`EconomicPlanV1.reasoning` may expose `supportSystem` plus historical context, but classification uses one primary value from evaluation.

---

## State transitions (advisory)

| From | To | Typical trigger |
|------|-----|-----------------|
| E7 | E6 | User starts Jobcenter/Sozialamt application |
| E6 | E4 or E5 | Support approved / first payment |
| E5 | E4 | Protection stabilized → SGB II becomes correct rail |
| E4 | E2 | Employment taken; benefit exit process |
| E3 | E4 or E6 | Unemployment registered; benefit path opened |
| E2 | E3 | Job loss |
| E4/E5 | E1 | Long-term self-sufficiency without support |

Transitions appear in `EconomicPlanV1.transitions` as **user-visible education** — not automatic profile writes.

---

## Boundary with Life Event states

| Life Event state | Economic Reality interaction |
|------------------|------------------------------|
| `economic_setup_pending` | ER classifier likely E3, E6, or E7 — ER provides institutional detail |
| `benefits_exploration` | ER likely E6 or routing to E4/E5 evaluation |
| `arrival_unregistered` | ER nodes blocked by SC-REG — LE owns registration narrative |
| `situation_stable` | ER may still be E4/E5 if on benefits — LE stable ≠ economically self-sustained |

**Rule:** LE state selects **life** graph; ER state selects **economic** graph. Both may be active simultaneously.

**Governance:** [Platform Planning Constitution v1](../platform/platform-planning-constitution-v1.md) — ER wins institutional classification; LE wins lifecycle classification; Home shows LE primary + ER secondary.

---

## Fixture mapping

See [economic-classifier-fixtures.md](./economic-classifier-fixtures.md) for EF01–EF24 worked examples.

---

## Expansion backlog (post-v1.0)

| Topic | Notes |
|-------|-------|
| ALG I (Arbeitslosengeld I) | Distinct from Bürgergeld — reference nodes in G4 |
| Wohngeld | Housing benefit — link from E1/E2, not primary ER state |
| Kindergeld / Kinderzuschlag | Family supplements — household module overlap |
| Student BAföG | Separate rail — may become E8+ |
| Multi-country packs | `jurisdiction` field on rulesets |
