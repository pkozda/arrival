---
id: economic-graph-catalog-v1
title: Economic Graph Catalog v1
project: Arrival Atlas
system: Arrival Atlas
type: spec
domain: finance
status: draft
maturity: evolving
owner: product
tags:
  - economic-reality
  - economic-graph
  - graph-catalog
  - jobcenter
  - buergergeld
  - sozialamt
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - economic-state-model
  - economic-rule-engine-v1
  - economic-reality-module-v1
related:
  - economic-classifier-fixtures
  - economic-reality-module-v1-spec
  - economic-reality-module-v1-roadmap
  - life-event-graph-catalog-v1
---

# Economic Graph Catalog v1

**Document type:** Product model — action graph definitions per economic state  
**Version:** 1.0.0  
**Status:** Draft — authoritative graph design for Economic Reality EP-1  
**Jurisdiction:** Germany (`DE`)  
**Audience:** Product, engineering (graph catalog, planner, golden tests)

**Upstream:** [economic-state-model.md](./economic-state-model.md) · [economic-classifier-fixtures.md](./economic-classifier-fixtures.md)  
**Downstream:** `buildEconomicPlan()` · `/modules/economic-reality` plan view

---

## 1. Purpose

The economic graph catalog answers:

> **For each economic state, what is the structured action graph for surviving and stabilizing financially in the German institutional system?**

### Three-layer separation (mirror Life Event)

| Layer | Question | Document |
|-------|----------|----------|
| **Rule Engine** | Which state, system, graph? | economic-rule-engine-v1 |
| **Economic State Model** | Which survival mode — semantically? | economic-state-model |
| **Graph Catalog** | What institutional action structure applies? | **this document** |
| **Planner** | Given evaluation + graph, what is today's plan? | EP-5 implementation |

```text
Rule engine classifies deterministically.
States describe meaning.
Graphs define action structure.
Planner resolves structure against current facts.
```

---

## 2. Design principles

| ID | Principle |
|----|-----------|
| **EG1** | One primary graph per economic state (G1–G6 map to E1–E7 with shared graphs where safe) |
| **EG2** | Deterministic topology per catalog version |
| **EG3** | Dependencies express **institutional** constraints (documents before payment, registration before Jobcenter case) |
| **EG4** | Support systems are explicit node categories — Jobcenter ≠ generic "benefits" |
| **EG5** | Every node has ≥1 action: profile correction, module open, or official resource link |
| **EG6** | Immigrant pathways (Sozialamt, protection status) are first-class graph branches |

### Action kinds

| Kind | Example |
|------|---------|
| `correct_in_profile` | Update work & income, benefits & support |
| `open_module` | `financial-reality`, `benefits-simulator`, `healthcare-navigation` |
| `external_resource` | Official Jobcenter / Sozialamt information (no scraping) |

---

## 3. Graph index

| Graph | Primary states | Intent |
|-------|----------------|--------|
| **G1** | E1, E3 (entry), E7 (entry) | Detect eligibility · route to correct support rail |
| **G2** | E3, E6 → E4 | Jobcenter onboarding |
| **G3** | E4 | Active Bürgergeld — obligations & stability |
| **G4** | E2, E4→E2 | Employment transition · benefit exit |
| **G5** | E7 | Financial crisis recovery |
| **G6** | E5, E6 (Sozialamt path) | Sozialamt / asylum-era support route |

**Note:** E1 (`self_sustained`) uses a **minimal G1 variant** (maintenance + optional tools). E2 uses **G4** (employment maintenance).

---

## 4. Graph definitions

### G1 — No Support / Entry Path

**States:** `self_sustained` (maintenance), `unemployment_transition`, `financial_crisis` (entry)  
**Intent:** Determine whether user should be self-sustained, entering Jobcenter path, or Sozialamt path.

**Graph ID remains `G1`.** Logical layers separate concerns for EP-5 — not separate graphs.

#### G1-A — Economic Detection Layer (facts only)

| Node ID | Title | Phase | Priority | Layer | Actions |
|---------|-------|-------|----------|-------|---------|
| `g1-income-assess` | Clarify income and savings situation | 1 | high | **G1-A** | Profile: work & income |
| `g1-residency-assess` | Confirm residency / protection status | 1 | critical | **G1-A** | Profile: move to Germany |

**Rule:** G1-A nodes collect **facts only**. No routing decisions.

#### G1-B — System Routing Layer (decisions only)

| Node ID | Title | Phase | Priority | Dependencies | Layer | Actions |
|---------|-------|-------|----------|--------------|-------|---------|
| `g1-route-support` | Identify correct support system | 2 | critical | g1-income-assess, g1-residency-assess | **G1-B** | Open benefits-simulator |
| `g1-jobcenter-intent` | Start Jobcenter path evaluation | 3 | high | g1-route-support | **G1-B** | External: Jobcenter finder |
| `g1-sozialamt-intent` | Start Sozialamt path evaluation | 3 | high | g1-route-support | **G1-B** | External: local Sozialamt info |

**Rule:** G1-B encodes **routing decisions**. Predicates for which intent node to elevate come from [Rule Engine R2/R3/R5](./economic-rule-engine-v1.md) — not ad-hoc planner heuristics.

#### G1-C — Activation Layer (transitions only)

| Node ID | Title | Phase | Priority | Dependencies | Layer | Actions |
|---------|-------|-------|----------|--------------|-------|---------|
| `g1-enter-system` | Enter selected support system | 4 | critical | g1-jobcenter-intent OR g1-sozialamt-intent | **G1-C** | Handoff → G2 or G6 entry nodes |

**Rule:** G1-C triggers **graph transitions** (G1 → G2 or G1 → G6). Planner must not mix detection logic here.

```text
G1-A (facts) → G1-B (route) → G1-C (activate) → G2 | G6
```

**Legacy node rename map:**

| Old ID | New ID |
|--------|--------|
| `g1-assess-income` | `g1-income-assess` |
| `g1-assess-residency` | `g1-residency-assess` |

Routing rule (normative): If R3 matched → elevate `g1-sozialamt-intent`. If R5/R2 Jobcenter track → elevate `g1-jobcenter-intent`.

---

### G2 — Jobcenter Onboarding

**States:** `unemployment_transition`, `application_pending` (Jobcenter track)  
**Intent:** Establish Jobcenter case — Anmeldung, documents, first payments.

| Node ID | Title | Phase | Priority | Dependencies | Actions |
|---------|-------|-------|----------|--------------|---------|
| `g2-registration` | Confirm registration (Anmeldung) | 1 | critical | — | Profile: where you live; LE link if blocked |
| `g2-termination-docs` | Gather employment termination proof | 1 | high | — | Profile: work & income |
| `g2-jobcenter-appointment` | Schedule / attend Jobcenter intake | 2 | critical | g2-registration | External: appointment prep |
| `g2-bank-account` | Set up account for benefit payments | 2 | high | — | Profile: work & income |
| `g2-first-payment` | Track first Bürgergeld payment timeline | 3 | medium | g2-jobcenter-appointment | Open financial-reality (gap estimate) |

---

### G3 — Active Bürgergeld Support

**State:** `benefits_jobcenter`  
**Intent:** Ongoing obligations, reporting, integration steps, stability.

| Node ID | Title | Phase | Priority | Dependencies | Actions |
|---------|-------|-------|----------|--------------|---------|
| `g3-reporting` | Monthly reporting obligations | 1 | high | — | Profile: benefits & support |
| `g3-job-search` | Job search / integration agreement | 1 | medium | — | External: Bundesagentur resources |
| `g3-income-changes` | Report income changes promptly | 2 | high | — | Profile: work & income |
| `g3-insurance` | Maintain health insurance coverage | 2 | high | — | Open healthcare-navigation |
| `g3-transition-plan` | Plan transition to employment | 3 | medium | — | Open financial-reality; G4 handoff |

---

### G4 — Employment Transition

**States:** `employment_active`, exit from `benefits_jobcenter`  
**Intent:** Job search, accepting work, benefit exit, income stabilization.

| Node ID | Title | Phase | Priority | Dependencies | Actions |
|---------|-------|-------|----------|--------------|---------|
| `g4-offer-evaluation` | Evaluate job offer vs benefits | 1 | high | — | Open financial-reality; benefits-simulator |
| `g4-notify-jobcenter` | Notify Jobcenter of employment | 2 | critical | g4-offer-evaluation | Profile: employment update |
| `g4-benefit-exit` | Complete benefit exit process | 2 | high | g4-notify-jobcenter | Profile: benefits & support |
| `g4-income-stability` | Confirm stable net income | 3 | medium | g4-benefit-exit | Open financial-reality |

---

### G5 — Financial Crisis Recovery

**State:** `financial_crisis`  
**Intent:** Emergency stabilization when no income and no active support.

| Node ID | Title | Phase | Priority | Dependencies | Actions |
|---------|-------|-------|----------|--------------|---------|
| `g5-immediate-needs` | Secure food and shelter today | 1 | critical | — | External: local crisis resources |
| `g5-system-entry` | Enter correct support system urgently | 1 | critical | — | G1 routing nodes |
| `g5-registration` | Resolve registration blockers | 2 | critical | — | Profile + LE housing nodes |
| `g5-appointment` | Get intake appointment | 2 | critical | g5-system-entry | External |
| `g5-bridge-income` | Understand bridging payments timeline | 3 | high | g5-appointment | Open financial-reality |

---

### G6 — Sozialamt Path

**States:** `benefits_sozialamt`, `application_pending` (Sozialamt track)  
**Intent:** Alternative / parallel support route — especially asylum-era and protection-status contexts.

| Node ID | Title | Phase | Priority | Dependencies | Actions |
|---------|-------|-------|----------|--------------|---------|
| `g6-status-confirm` | Confirm protection / procedure status | 1 | critical | — | Profile: move to Germany |
| `g6-sozialamt-contact` | Contact responsible Sozialamt | 1 | critical | g6-status-confirm | External: municipal finder |
| `g6-arrival-proof` | Prepare arrival / registration proof | 2 | high | — | Profile: housing |
| `g6-payment-setup` | Payment method for support | 2 | medium | g6-sozialamt-contact | Profile: work & income |
| `g6-transition-awareness` | Understand transition to Jobcenter when eligible | 3 | medium | — | Educational node → G2 link |

**Immigrant note:** Ukrainian protection status (§24) scenarios should map here or to G2 depending on declared municipal practice — fixtures EF08–EF12 capture expected v1 behavior.

---

## 5. Cross-graph transitions

```text
G5 (crisis) ──► G1 (routing) ──► G2 (Jobcenter) or G6 (Sozialamt)
G2 (onboarding) ──► G3 (active Bürgergeld)
G3 ──► G4 (employment)
G6 ──► G2 (when status shifts to SGB II eligibility)
```

Planner selects **one primary graph** from economic state; nodes from G1 may appear as **contextual** actions when in G2/G5 entry.

---

## 6. Satisfaction keys (v1.0)

| Key | Meaning |
|-----|---------|
| `income_declared` | Minimum income facts present |
| `employment_status_known` | Employment relationship declared |
| `benefits_active_jobcenter` | User declared active Bürgergeld |
| `benefits_active_sozialamt` | User declared Sozialamt support |
| `jobcenter_case_open` | Application/case in progress |
| `registration_confirmed` | Registration fact satisfied |

Satisfaction is derived from `UserContextV1` — same philosophy as LE graph satisfaction keys.

---

## 7. Versioning

| Version | Change |
|---------|--------|
| 1.0.0 | Initial G1–G6 — Germany only |

Graph IDs are stable product identifiers. Node IDs are namespaced by graph (`g2-*`).

---

## 8. Implementation target

```
packages/modules/src/economic-reality/plan/graph/
  ├── catalog.ts          # GRAPH_CATALOG_V1
  ├── types.ts
  └── index.ts
```

Mirror: `packages/modules/src/life-event/plan/graph/catalog.ts`
