---
id: economic-rule-engine-v1
title: Economic Rule Engine v1 — Deterministic Evaluation Contract
project: Arrival Atlas
system: Arrival Atlas
type: spec
domain: finance
status: draft
maturity: evolving
owner: engineering
tags:
  - economic-reality
  - rule-engine
  - determinism
  - ep-1
  - ep-4
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - economic-state-model
  - economic-reality-module-v1
  - platform-planning-constitution-v1
related:
  - economic-graph-catalog-v1
  - economic-classifier-fixtures
  - economic-reality-module-v1-roadmap
  - life-event-module-v2-v1.0-architecture-freeze
---

# Economic Rule Engine v1 — Deterministic Evaluation Contract

**Document type:** Execution contract — canonical deterministic layer for Economic Reality  
**Version:** 1.0.0  
**Status:** Draft — **authoritative for EP-1 and EP-4**  
**Replaces:** Informal "classifier + resolver described in prose"

This document closes the EP-4 risk: support-system routing is **not** a product discussion at implementation time — it is a **pure rule engine** with fixture proofs.

---

## 1. Position in the stack

```text
UserContextV1
        ↓
┌───────────────────────────────────────┐
│  Economic Rule Engine v1  (THIS DOC)  │  ← deterministic, single entry
│  evaluate(context) → Evaluation       │
└───────────────────────────────────────┘
        ↓
Economic Graph Catalog (G1–G6)
        ↓
Plan Resolver (EP-5) → EconomicPlanV1
```

**Three-layer deterministic system:**

| Layer | Artifact | Question |
|-------|----------|----------|
| 1 | **Rule Engine** | What state, system, graph? |
| 2 | **State Model** | What does that state *mean*? |
| 3 | **Graph System** | What actions apply? |

The **classifier** in code is a **thin wrapper** — it calls `evaluate()` and projects `EconomicEvaluationV1`. No second classification path.

---

## 2. Core contract

```typescript
type EconomicRuleEngineV1 = {
  evaluate(context: UserContextV1): EconomicEvaluationV1;
};
```

**Entry point (target):** `packages/modules/src/economic-reality/plan/rule-engine/evaluate.ts`

**Invariants:**

- Same `UserContextV1` input → identical `EconomicEvaluationV1` output (byte-stable JSON aside from `generatedAt` on plan wrapper).
- `appliedRules` MUST list every rule that was **evaluated until first match** (inclusive).
- No ML, no weighted scoring, no runtime config flags that change rule order in v1.

---

## 3. Output — `EconomicEvaluationV1`

```typescript
type EconomicEvaluationV1 = {
  economicState: EconomicStateId;
  supportSystem: SupportSystemId;
  graphId: GraphId;

  axes: EconomicAxesV1;

  confidenceScore: number; // 0.0–1.0 deterministic
  planConfidence: PlanConfidence; // derived from score — UI layer

  blockers: EconomicBlockerId[];
  appliedRules: RuleId[];
};

type EconomicAxesV1 = {
  incomeSource: IncomeSourceAxis;
  institutionalDependency: InstitutionalDependencyAxis;
};

type IncomeSourceAxis =
  | 'employment'
  | 'benefits_jobcenter'
  | 'benefits_sozialamt'
  | 'none';

type InstitutionalDependencyAxis =
  | 'independent'
  | 'semi_dependent'
  | 'fully_dependent'
  | 'transitional';

type SupportSystemId = 'jobcenter' | 'sozialamt' | 'employment_agency' | 'none';

type GraphId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';

type PlanConfidence = 'high' | 'medium' | 'low' | 'none';

type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7';

type EconomicBlockerId =
  | 'SC-REG' | 'SC-ADDR' | 'SC-INS' | 'SC-DOC'
  | 'SC-LANG' | 'SC-HH' | 'SC-STATUS' | 'SC-REPORT';
```

### 3.1 Confidence score (deterministic)

`confidenceScore` is computed from **fact completeness** after state selection — not from rule competition.

| Condition | Score cap |
|-----------|-----------|
| All required facts for matched rule present | `1.0` |
| One required fact missing | `0.7` |
| Two or more required facts missing | `0.4` |
| `SC-STATUS` active (residency unclear) | max `0.5` |

**`planConfidence` mapping (fixed):**

| Score range | `planConfidence` |
|-------------|------------------|
| `≥ 0.85` | `high` |
| `≥ 0.60` | `medium` |
| `≥ 0.30` | `low` |
| `< 0.30` | `none` |

> **Adaptation note:** Life Event uses categorical `planConfidence` only. ER keeps **numeric `confidenceScore` for rule tests** and exposes **mapped `planConfidence`** for UI parity with LE wireframes.

---

## 4. Rule execution model

### 4.1 Hard law — FIRST MATCH WINS

Rules execute **top-down**. The first rule whose **predicate** is `true` sets `economicState`, `supportSystem`, `graphId`, and `axes`. Lower rules are **not evaluated**.

```text
R1 → R2 → R3 → R4 → R5 → R6 → R7
         ↑
    first match stops execution
```

**Forbidden in v1:**

- Score blending across rules
- "Confidence voting" between E4 and E5
- Life Event plan overriding rule output (see [Platform Planning Constitution](../platform/platform-planning-constitution-v1.md))

### 4.2 Rule table

| Rule | `RuleId` | State | `supportSystem` | `graphId` | Predicate (summary) |
|------|----------|-------|-----------------|-----------|---------------------|
| Crisis override | **R1** | `financial_crisis` (E7) | `none` | **G5** | No adequate income **AND** no active support **AND** no pending application |
| Application pending | **R2** | `application_pending` (E6) | `jobcenter` \| `sozialamt` | **G2** or **G6** | Support application/case started; no stable payments yet |
| Sozialamt eligibility | **R3** | `benefits_sozialamt` (E5) | `sozialamt` | **G6** | Active Sozialamt-path support **OR** asylum/protection rail requires Sozialamt per facts |
| Jobcenter eligibility | **R4** | `benefits_jobcenter` (E4) | `jobcenter` | **G3** | Active Bürgergeld / Jobcenter case with payments or confirmed enrollment |
| Unemployment transition | **R5** | `unemployment_transition` (E3) | `none` | **G2** | Job loss / unemployed; no active benefit; not in crisis (income bridge or pending path exists) |
| Employment active | **R6** | `employment_active` (E2) | `none` \| `jobcenter` | **G4** | Active employment relationship (includes benefit exit in progress) |
| Fallback self-sustained | **R7** | `self_sustained` (E1) | `none` | **G1** | Stable declared income; no public subsistence support |

### 4.3 Predicate detail (normative)

#### R1 — Crisis (`financial_crisis`)

```text
incomeSignal ∈ { none, unknown, insufficient }
AND benefitSignal ∈ { none, inactive }
AND applicationSignal ∈ { none }
```

→ `axes.incomeSource = none`, `axes.institutionalDependency = transitional`

#### R2 — Application pending

```text
applicationSignal ∈ { started, appointment_scheduled, documents_pending }
AND paymentSignal ∈ { none, not_yet_received }
```

`supportSystem` sub-resolution (still deterministic, first match inside R2):

```text
1. if sozialamtApplicationSignal → supportSystem = sozialamt, graphId = G6
2. else if jobcenterApplicationSignal → supportSystem = jobcenter, graphId = G2
3. else supportSystem = none, graphId = G1  // intent declared but rail unknown
```

#### R3 — Sozialamt active

```text
sozialamtSupportSignal = active
OR (asylumProcedureSignal AND NOT jobcenterEligibleSignal)
OR (protectionStatusSignal ∈ { section_24, subsidiary_protection } AND sozialamtPrimarySignal)
```

#### R4 — Jobcenter active

```text
jobcenterSupportSignal = active
OR buergergeldSignal = receiving
```

#### R5 — Unemployment transition

```text
employmentSignal ∈ { recently_ended, unemployed }
AND NOT R1..R4 matched
```

#### R6 — Employment active

```text
employmentSignal = employed
AND NOT R1..R5 matched
```

If `jobcenterReportingSignal` while employed → `supportSystem = jobcenter` (reporting obligation), still E2 + G4.

#### R7 — Fallback

```text
Default when R1..R6 false
AND incomeSignal = stable
```

### 4.4 Graph selector (pure mapping)

After rule match, `graphId` is **fully determined** by the rule table. No secondary graph selection logic in EP-5.

| State | Default `graphId` | Exception |
|-------|-------------------|-----------|
| E1 | G1 | G1 maintenance variant |
| E2 | G4 | — |
| E3 | G2 | — |
| E4 | G3 | — |
| E5 | G6 | — |
| E6 | G2 or G6 | R2 sub-resolution |
| E7 | G5 | — |

---

## 5. Axes projection (system-centric lens)

Each rule sets **both** primary state and composite axes. Employment is **not** the central axis — **institutional dependency** is.

| State | `incomeSource` | `institutionalDependency` |
|-------|----------------|---------------------------|
| E1 `self_sustained` | `none` or `employment` | `independent` |
| E2 `employment_active` | `employment` | `independent` or `semi_dependent` |
| E3 `unemployment_transition` | `none` | `transitional` |
| E4 `benefits_jobcenter` | `benefits_jobcenter` | `fully_dependent` |
| E5 `benefits_sozialamt` | `benefits_sozialamt` | `fully_dependent` |
| E6 `application_pending` | `none` | `transitional` |
| E7 `financial_crisis` | `none` | `transitional` |

Axes are **outputs** of the rule engine — not a parallel classifier.

---

## 6. Blockers

Blockers are **facts**, not rules. Evaluated **after** state selection; they do not change `economicState`.

| Blocker | Condition |
|---------|-----------|
| `SC-REG` | Registration not confirmed |
| `SC-ADDR` | No stable address |
| `SC-INS` | Insurance gap |
| `SC-DOC` | Benefit documents missing |
| `SC-LANG` | Language barrier declared |
| `SC-HH` | Household incomplete |
| `SC-STATUS` | Residency/protection unclear |
| `SC-REPORT` | Reporting overdue (E4) |

---

## 7. Implementation layout (EP-1)

```text
packages/modules/src/economic-reality/plan/
  rule-engine/
    evaluate.ts           # EconomicRuleEngineV1 entry
    rules/
      r1-crisis.ts … r7-self-sustained.ts
    predicates/           # fact extractors from UserContextV1
    graph-map.ts          # pure state+rule → graphId
    confidence.ts         # score + planConfidence mapping
    types.ts
  classifier.ts           # thin: evaluate() wrapper
  build-economic-plan.ts  # EP-5: graph + evaluation → plan
```

### EP-1 deliverables (revised)

| Before | After |
|--------|-------|
| Classifier skeleton | **Rule engine** + thin classifier wrapper |
| Informal resolver | **R1–R7** with fixture proofs |
| Graph selection in planner | **Pure mapping** in rule engine output |

---

## 8. Golden test contract

Every fixture EF01–EF24 MUST assert:

```typescript
const evaluation = evaluateEconomicRules(userContext);

expect(evaluation.economicState).toBe('...');
expect(evaluation.supportSystem).toBe('...');
expect(evaluation.graphId).toBe('G...');
expect(evaluation.appliedRules).toEqual(['R1']); // example: single terminating rule
expect(evaluation.axes).toEqual({ incomeSource: '...', institutionalDependency: '...' });
```

**`appliedRules` format:** ordered list from R1 through the **first matching** rule, inclusive. Non-matching rules above the winner are listed as evaluated-only if implementation traces them; minimum bar: include the winning rule id.

---

## 9. Related documents

| Document | Role |
|----------|------|
| [economic-state-model.md](./economic-state-model.md) | Semantic meaning of E1–E7 + axes |
| [economic-graph-catalog-v1.md](./economic-graph-catalog-v1.md) | Graph node definitions |
| [platform-planning-constitution-v1.md](../platform/platform-planning-constitution-v1.md) | LE ↔ ER authority |
| [economic-classifier-fixtures.md](./economic-classifier-fixtures.md) | EF01–EF24 |
