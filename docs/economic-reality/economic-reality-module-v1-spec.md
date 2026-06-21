---
id: economic-reality-module-v1
title: Economic Reality Module v1.0 — Specification
project: Arrival Atlas
system: Arrival Atlas
type: spec
domain: finance
status: draft
maturity: evolving
owner: product
tags:
  - economic-reality
  - jobcenter
  - buergergeld
  - sozialamt
  - institutional-planning
  - germany
  - arr-019
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - ux-contract-v2
  - profile-mutation-model-v1
  - profile-system-p4-roadmap
  - life-event-module-v2-v1.0-architecture-freeze
related:
  - economic-reality-module-v1-roadmap
  - economic-state-model
  - economic-classifier-fixtures
  - economic-graph-catalog-v1
  - economic-rule-engine-v1
  - platform-planning-constitution-v1
  - financial-module-v2-plan
  - benefits-simulator-design
  - life-state-model
  - life-event-platform-integration-audit
---

# Economic Reality Module v1.0 — Specification

**Document type:** Module specification (business + technical)  
**Module ID (proposed):** `economic-reality`  
**Current platform module:** `financial-reality` v1.0.0 — gross/net calculator + simplified Bürgergeld gap estimate (execute-only)  
**Target:** `economic-reality` v1.0.0 — profile-aware **institutional survival planning engine** (read path)  
**Status:** Design — ready for EP-1  
**Branch track:** `arr-019` (proposed)

---

## 0. Executive Summary

**Economic Reality Module** is the **second pillar** of Arrival Atlas planning — alongside Life Event.

| Module | Question |
|--------|----------|
| **Life Event** | *What is happening in my life in Germany?* |
| **Economic Reality** | *How do I financially survive and stabilize inside the German support system right now?* |

For immigrants — including refugees with limited funds on arrival — this is not optional context. Upon arrival and recognition of protection status (or during asylum procedure), many people enter **institutional support systems**: **Jobcenter / Bürgergeld (SGB II)** or **Sozialamt** pathways (e.g. AsylbLG during asylum, Übergangsleistungen, or municipal social assistance). The platform must model these as **first-class states**, not as footnotes on a salary calculator.

### Product formula

```text
P1–P3  →  what is true              (UserContextV1)
UX-P4  →  what gaps / confidence     (ProfileInsightViewV1)
Life Event  →  what life situation    (LifeEventPlanV1)
Economic Reality  →  how to survive financially in the system  (EconomicPlanV1)
```

### Architectural insight

Life Event is an **internal life-state engine**. Economic Reality is the first module that maps **external institutional systems** (Jobcenter, Sozialamt, employment office logic) onto user context. It is **Germany-specific by design** in v1.0 — country logic is explicit, not hidden in generic enums.

### What this is

| ✅ | |
|----|---|
| **New planning module** | `id: 'economic-reality'` (proposed; see §1.1) |
| **Deterministic economic graph** | DAG over support systems + employment transitions |
| **Read-side plan** | `EconomicPlanV1` — derived, non-authoritative |
| **Dual-system awareness** | Jobcenter **and** Sozialamt as distinct support rails |
| **Life Event complement** | Consumes LE signals; does not replace LE life states |

### What this is NOT

| ❌ | |
|----|---|
| Life Event replacement | LE owns life situation; ER owns economic survival |
| Legal immigration advice | Residency rules inform eligibility flags only |
| Tax optimization / wealth planning | Out of scope |
| Housing module | Housing costs are inputs; housing workflow is separate |
| Healthcare module | Insurance is dependency reference only |
| ML / opaque scoring | Fixture-driven classification like LE-1 |

---

## 1. Module identity & relationship to `financial-reality`

### 1.1 Two modules, two jobs

| Concern | Module | Path |
|---------|--------|------|
| **Institutional survival planning** | `economic-reality` (NEW) | `GET /api/modules/economic-reality/plan` → `EconomicPlanV1` |
| **Calculation & what-if execute** | `financial-reality` (EXISTING) | `POST /api/modules/financial-reality/execute` → net income, gap estimates |

Economic graph nodes **link to** `financial-reality` and `benefits-simulator` as tools — same pattern as Life Event `open_module` actions.

### 1.2 Migration posture (v1.0)

- **Do not** fold calculator logic into the planner in EP-1.
- **Do** register `economic-reality` as a new catalog module with plan API.
- **Later (v1.1+):** Consolidate naming/branding in UI ("Financial & economic reality") if product chooses a single surface.

See [financial-module-v2-plan.md](../finance/financial-module-v2-plan.md) for calculator/decision-engine evolution — orthogonal to this spec.

---

## 2. Purpose & scope boundary

### 2.1 Purpose

Explain and operationalize the user's **economic survival and support system** in Germany:

- Jobcenter / **Bürgergeld** (SGB II) onboarding, obligations, transitions
- **Sozialamt** and asylum-era support pathways (AsylbLG, municipal Sozialhilfe edges)
- Employment ↔ unemployment transitions
- Income stability classification
- Benefits activation and reporting flows
- Administrative **dependency** links (registration, insurance, residence) — not legal advice
- Financial risk states: gap, stable, supported, blocked

**North-star question:**

> *"How do I financially survive and stabilize in Germany right now — and which system am I in?"*

### 2.2 In scope

| Area | v1.0 coverage |
|------|----------------|
| Economic state classification (E1–E7) | ✅ |
| Support system resolver (Jobcenter vs Sozialamt vs none) | ✅ |
| Graph catalog G1–G6 | ✅ |
| `EconomicPlanV1` read API | ✅ |
| Module page + optional Home secondary card | ✅ |
| Life Event integration (read LE signals) | ✅ |
| Refugee / protection-status routing heuristics | ✅ (eligibility flags, not legal determinations) |

### 2.3 Out of scope

| Area | Owner |
|------|-------|
| Life situation planning | `life-event` |
| Housing search / lease workflows | Future housing module |
| Healthcare navigation detail | `healthcare-navigation` |
| Detailed benefit amount simulation | `benefits-simulator` |
| Tax / investment planning | — |
| Legal status determination | User + advisors; platform stores **declared** facts only |

---

## 3. Position in architecture

```text
UserContextV1  ← authoritative facts
ProfileInsightViewV1  ← optional gaps (employment, benefits domains)
LifeEventPlanV1  ← optional life-state signals (NOT authoritative for ER)
        │
        ▼
economic-reality module v1
  classifyEconomicState()
  resolveSupportSystem()
  buildEconomicPlan()
        │
        ├── GET /api/modules/economic-reality/plan  → EconomicPlanV1
        └── (future) POST execute for calculators — delegates to financial-reality / benefits-simulator
        │
        ▼
Home (secondary to Life Event) + /modules/economic-reality
```

### 3.1 Integration with Life Event

**Inputs from Life Event** (signals, not commands):

| LE life state / signal | ER use |
|------------------------|--------|
| `economic_setup_pending` | Boost ER classification priority; select G1/G5 entry |
| `benefits_exploration` | Route to support system resolver |
| Employment / insurance secondary conditions | Blocker hints in ER graph |
| Plan node satisfaction keys | Optional cross-check (v1.1+) |

**Outputs to Life Event** (EP-8 optional, LE-8 style):

| ER event | LE consumer |
|----------|-------------|
| Support system activated (Jobcenter / Sozialamt) | Soften `economic_setup_pending` reasoning |
| Employment transition completed | Update stability secondary |
| Financial crisis detected | Elevate urgency in LE overlay (advisory only) |

Per [platform integration audit](../audits/life-event-platform-integration-audit.md): cross-module signals must not create a second planner on Home — ER plan stays on ER surfaces unless platform authority contract is updated.

### 3.2 Design principles

| ID | Principle |
|----|-----------|
| **P1** | **Dual-system awareness** — Jobcenter and Sozialamt are distinct institutional rails, not collapsed into "on benefits" |
| **P2** | **No LE replacement** — ER never classifies `arrival_unregistered`; it classifies economic survival mode |
| **P3** | **Support system is first-class state** — "In Jobcenter system" is as important as "employed" |
| **P4** | **Deterministic classification** — fixture-driven; no heuristic drift |
| **P5** | **Country explicit** — `jurisdiction: 'DE'` on rulesets; v2 may add country packs |
| **P6** | **Immigrant-first** — Refugee/protection pathways are core fixtures, not edge cases |

---

## 4. Core pipeline (deterministic three-layer system)

```text
UserContextV1
        ↓
Economic Rule Engine v1          ← R1–R7, FIRST MATCH WINS (see economic-rule-engine-v1.md)
        ↓ EconomicEvaluationV1
Economic Graph (G1–G6)           ← graphId from evaluation — pure mapping
        ↓
Plan Resolver (EP-5)
        ↓
EconomicPlanV1
```

**Governance:** [Platform Planning Constitution v1](../platform/platform-planning-constitution-v1.md) — dual authority, single Home composition.

| Layer | Artifact | EP phase |
|-------|----------|----------|
| Rule Engine | `evaluateEconomicRules()` | **EP-1** (core) |
| Graph catalog | `GRAPH_CATALOG_V1` | EP-2–EP-3 |
| Planner | `buildEconomicPlan()` | EP-5 |
| API | `GET /api/modules/economic-reality/plan` | EP-6 |
| UI | Module + Home secondary card | EP-7 |

**Code location (target):** `packages/modules/src/economic-reality/plan/`

> **EP-4 is not a separate resolver** — it is the R3/R4 Sozialamt vs Jobcenter rules inside the rule engine.

---

## 5. Inputs

### 5.1 Primary input

`UserContextV1` — same authoritative read path as Life Event (`buildEconomicPlanFromState` at API boundary).

### 5.2 Derived signals (from profile domains)

| Signal | Source domain(s) | ER use |
|--------|------------------|--------|
| `employmentStatus` | `employment` | E2/E3/E4 routing |
| `incomeLevel` / stability | `income`, `employment` | E1 vs E7 |
| `residencyType` | `migration` | Sozialamt vs Jobcenter resolver |
| `protectionStatus` | `migration` | Refugee / subsidiary protection / asylum procedure |
| `benefitEnrollment` | `benefits` | E4/E5/E6 |
| `householdComposition` | `household` | Needs assessment context |
| `registrationStatus` | `housing`, `migration` | Jobcenter onboarding blockers |
| `healthInsuranceStatus` | `healthInsurance` | Dependency blocker (linked) |

### 5.3 Optional overlays

| Overlay | Source | Rule |
|---------|--------|------|
| P4 missing context | `ProfileInsightViewV1` | Hints only — cannot override economic state |
| Life Event plan | `LifeEventPlanV1` | Visibility + links only — **cannot override rule engine** (Constitution B1/B2) |

---

## 6. Outputs — `EconomicPlanV1`

### 6.1 Schema (conceptual v1.0)

```typescript
type EconomicPlanV1 = {
  schemaVersion: '1.0.0';
  generatedAt: string; // ISO-8601

  reasoning: {
    economicState: EconomicStateId;
    economicStateLabel: string;
    supportSystem: SupportSystemId;
    axes: EconomicAxesV1;
    planConfidence: 'high' | 'medium' | 'low' | 'none';
    confidenceScore: number; // 0–1 from rule engine
    appliedRules: RuleId[];
    whyThisState: string;
  };

  currentFocus: EconomicPlanNode | null;
  nextBestActions: EconomicPlanNode[];
  activeBlocks: EconomicPlanNode[];
  timeline: EconomicPlanNode[];

  transitions: EconomicStateTransition[]; // advisory, from state model
};
```

### 6.2 Supporting types

```typescript
type EconomicStateId =
  | 'self_sustained'           // E1
  | 'employment_active'        // E2
  | 'unemployment_transition'  // E3
  | 'benefits_jobcenter'       // E4
  | 'benefits_sozialamt'       // E5
  | 'application_pending'      // E6
  | 'financial_crisis';        // E7

type SupportSystemId = 'jobcenter' | 'sozialamt' | 'employment_agency' | 'none';

type EconomicPlanNode = {
  id: string;
  title: string;
  description: string;
  category: 'income' | 'benefits' | 'employment' | 'admin' | 'reporting';
  priority: 'critical' | 'high' | 'medium' | 'low';
  phase: number;
  rationale: string;
  satisfactionKey?: string;
  blockedByNodeIds: string[];
  actions: EconomicActionRef[];
};

type EconomicActionRef =
  | { kind: 'open_module'; moduleId: string; href: string; label: string }
  | { kind: 'correct_in_profile'; profileMirrorSlug: string; href: string; label: string }
  | { kind: 'external_resource'; href: string; label: string }; // official info only

type EconomicStateTransition = {
  from: EconomicStateId;
  to: EconomicStateId;
  trigger: string; // plain language
  userVisible: boolean;
};
```

Product contract packaging: `packages/product-contract/src/economic-reality/` (mirror `life-event` plan types).

---

## 7. Germany-specific institutional model (v1.0)

### 7.1 Why two support systems matter

Many immigrants — **including Ukrainian refugees with protection status** — experience:

1. **Early arrival / procedure:** Support via **Sozialamt** (e.g. AsylbLG while in asylum procedure, or municipal arrangements).
2. **After status stabilization:** Transition toward **Jobcenter** and **Bürgergeld** (SGB II) when eligible and employable.
3. **Employment path:** Exit from benefits toward declared income — with reporting obligations.

Collapsing this into "user receives social help" loses the actions users must take (different offices, documents, timelines).

### 7.2 Resolver logic (conceptual)

```text
residencyType + protectionStatus + employmentStatus + benefitSignals
        ↓
┌───────────────────┬────────────────────┬─────────────────┐
│ Sozialamt path    │ Jobcenter path     │ Self-sustained  │
│ (E5, G6)          │ (E4, G2–G3)        │ (E1–E2, G4)     │
└───────────────────┴────────────────────┴─────────────────┘
        ↓
application_pending (E6) when intent declared but system not active
        ↓
financial_crisis (E7) when no income AND no active/pending support
```

**Disclaimer (product copy):** Atlas explains likely pathways based on **your declared situation** — not a legal eligibility determination.

### 7.3 Linked administrative dependencies

ER nodes may be **blocked** by life-admin facts (registration, address, insurance) without duplicating LE graphs — via `blockedByNodeIds` + `satisfactionKey` alignment with LE where practical.

---

## 8. UI surfaces (EP-7)

| Surface | Priority vs LE | Content |
|---------|----------------|---------|
| `/modules/economic-reality` | Primary module home | Full plan wireframe (mirror LE-3) |
| Home card | **Secondary** to Life Event | Compact "Your economic situation" when ER state ≠ self_sustained OR user pinned module |
| Profile hints | Via P4 | Employment/benefits gaps link into ER module |

Do **not** compete with Life Event for Home hero until platform planning authority contract is resolved (ARR-018).

---

## 9. Success criteria (v1.0 complete)

| # | Criterion |
|---|-----------|
| 1 | User can see **which system** they are in (Jobcenter / Sozialamt / work / none / pending) |
| 2 | User can see **where money/support is expected to come from** at a high level |
| 3 | Classifier is **deterministic** — fixtures EF01–EF24 pass golden tests |
| 4 | `EconomicPlanV1` API returns stable shape validated by product-contract |
| 5 | Integration with LE does **not duplicate** life-state classification |
| 6 | Refugee / protection scenarios covered in fixtures (not only employed expat cases) |
| 7 | Module links to `financial-reality` / `benefits-simulator` for calculations |

---

## 10. Non-goals (v1.0)

- Replacing `financial-reality` execute endpoint
- LE-8 runtime wiring (EP-8 optional backlog)
- Multi-country support packs
- Automated document upload / official form submission
- Real-time sync with Jobcenter portals

---

## 11. Related documents

| Document | Role |
|----------|------|
| [economic-state-model.md](./economic-state-model.md) | Canonical E1–E7 states |
| [economic-graph-catalog-v1.md](./economic-graph-catalog-v1.md) | G1–G6 graphs |
| [economic-classifier-fixtures.md](./economic-classifier-fixtures.md) | Golden scenarios EF01–EF24 |
| [economic-rule-engine-v1.md](./economic-rule-engine-v1.md) | Deterministic R1–R7 contract |
| [platform-planning-constitution-v1.md](../platform/platform-planning-constitution-v1.md) | LE ↔ ER governance |
| [economic-reality-module-v1-roadmap.md](./economic-reality-module-v1-roadmap.md) | EP-1–EP-8 phases |
| [life-state-model.md](../life-events/life-state-model.md) | LE boundary reference |
| [life-event-module-v2-v1.0-architecture-freeze.md](../life-events/life-event-module-v2-v1.0-architecture-freeze.md) | LE integration constraints |
