# Financial Reality Module — Audit & v2 Implementation Plan

**Document type:** Architecture audit + technical specification  
**Module:** `financial-reality` (v1.0.0)  
**Target:** `financial-reality` v2.0.0 — Decision Engine  
**Author role:** Senior Product Architect / Senior TypeScript Engineer  
**Date:** June 2026  
**Status:** Planning only — no implementation in this document

---

## Executive Summary

The Financial Reality Module is the highest-priority MVP module in Arrive Atlas. Today it functions as a **single-person gross-to-net calculator** with a **highly simplified Bürgergeld gap estimate** and four hardcoded decision heuristics. It is architecturally well-placed inside the modular platform but **not trustworthy for real-world migrant decision support**.

This document:

1. Audits the current implementation across code, API, and UI
2. Identifies accuracy, product, and engineering weaknesses
3. Proposes a v2 architecture that transforms the module into a **household decision engine**
4. Defines schemas, services, migration path, and test strategy

**Core v2 shift:** From *"What is my net salary?"* → *"Is taking this job financially beneficial for my household, and what trade-offs should I expect?"*

---

## Part 1 — Current Implementation Audit

### 1.1 Architecture

#### Component map

```
apps/web/src/app/modules/financial-reality/page.tsx
        │ POST /api/modules/financial-reality/execute
        ▼
apps/api/src/index.ts  (generic module executor)
        ▼
packages/core/src/registry/index.ts  (Zod validate → execute → validate)
        ▼
packages/modules/src/financial-reality/index.ts  (orchestrator, ~90 LOC)
        │
        ├── calculateNetIncome()          → shared-services/calculation
        ├── calculateBuergergeldEligibility() → shared-services/calculation
        └── germanAdminRules.evaluate() → shared-services/rules (generic admin, not financial)
```

#### Architectural strengths

| Aspect | Assessment |
|--------|------------|
| Module isolation | ✅ No imports from other feature modules |
| Contract enforcement | ✅ Zod input/output schemas validated at registry boundary |
| Separation of concerns | ✅ Module orchestrates; shared-services holds math |
| Extensibility | ✅ Feature flag `advancedTaxScenarios: false` exists (unused) |
| API decoupling | ✅ Generic execute endpoint; module ID is the only coupling |

#### Architectural weaknesses

| Aspect | Issue |
|--------|-------|
| Thin orchestrator, fat assumptions | Module logic is 90 lines but delegates to inaccurate primitives |
| Calculation monolith | All financial math in one 120-line `calculation/index.ts` file |
| No domain model | No `Household`, `Person`, `Employment`, `Scenario` types |
| No decision engine | `decisions[]` built from 4 inline `if` statements |
| Rules engine mismatch | `germanAdminRules` covers Anmeldung/Krankenkasse — not SGB II income imputation |
| No versioning strategy | Same module ID; breaking schema changes would break clients |
| No confidence/ disclaimer layer | Outputs presented as definitive with no uncertainty markers |
| Context underutilized | `AppContext.userProfile.income/householdSize` never merged with input |

#### File inventory

| File | LOC (approx) | Responsibility |
|------|--------------|----------------|
| `packages/modules/src/financial-reality/index.ts` | 150 | Schemas + execute + registration |
| `packages/shared-services/src/calculation/index.ts` | 121 | Tax + Bürgergeld math |
| `apps/web/src/app/modules/financial-reality/page.tsx` | 201 | Form + result display |
| `packages/shared-services/src/normalization/index.ts` | 60 | Helpers (unused by financial module) |

---

### 1.2 Input Schema (v1)

**Source:** `FinancialRealityInputSchema` in `packages/modules/src/financial-reality/index.ts`

```typescript
{
  grossIncome: number          // positive, required — single earner only
  taxClass: 1 | 2 | 3 | 4 | 5 | 6
  churchTax: boolean           // default false
  householdSize: number        // int ≥ 1, default 1 — no age/role breakdown
  monthlyRent: number          // ≥ 0, default 0
  employmentStatus: enum       // employed | self-employed | unemployed | part-time | student
  maritalStatus: enum          // single | married | divorced | widowed
}
```

#### Input schema analysis

| Field | Used in calculation? | Used in decisions? | Gap |
|-------|---------------------|-------------------|-----|
| `grossIncome` | ✅ Net income | ✅ Low-income heuristic | Single income only |
| `taxClass` | ✅ Via multiplier hack | ❌ | Partner class not modeled |
| `churchTax` | ✅ | ❌ | `state` param exists in engine but unused |
| `householdSize` | ✅ Bürgergeld only | ❌ | Children not distinguished from adults |
| `monthlyRent` | ✅ Bürgergeld only | ✅ Rent vs net check | No KdU caps, no Nebenkosten split |
| `employmentStatus` | ❌ | ✅ Admin rules only | Not passed to tax engine |
| `maritalStatus` | ❌ | ✅ Admin rules only | No Ehegattensplitting / partner modeling |

#### Missing inputs (required for v2)

- Partner income (gross/net), partner tax class, partner employment type
- Children: count + age bands (affects Regelbedarf + Kindergeld + Freibeträge)
- Current benefit state: receiving Bürgergeld? ALG I? Wohngeld?
- Location (Bundesland, city/Mietstufe) for KdU and church tax rate
- Proposed job scenario (offer gross, hours, Minijob/Midijob/regular)
- Warm rent vs cold rent, household utility costs
- Age of primary applicant (relevant for ALG, Minijob-Rente exemptions)
- Health insurance type (GKV/PKV, voluntary vs mandatory)
- Assets snapshot (Bürgergeld Vermögensfreibeträge — simplified in MVP v2)

---

### 1.3 Output Schema (v1)

**Source:** `FinancialRealityOutputSchema`

```typescript
{
  income: {
    gross, net, deductions: { incomeTax, solidaritySurcharge, churchTax, socialContributions },
    effectiveTaxRate
  },
  benefits: {
    buergergeld: { eligible, estimatedBenefit, reasoning[] }
  },
  decisions: [{ title, description, priority, action? }],
  adminRules: string[]   // generic admin rules, not financial-specific
}
```

#### Output schema analysis

| Present | Missing for decision engine |
|---------|----------------------------|
| Single-scenario net breakdown | Scenario comparison (before/after job) |
| Binary Bürgergeld eligible | Partial benefit reduction amount (Mehrbedarf, Freibeträge) |
| Priority-tagged decisions | Structured verdict: `isJobFinanciallyBeneficial` |
| Text reasoning array | Numeric `householdDelta`, `effectiveMarginalGain` |
| — | Benefit reduction breakdown (which benefits, how much) |
| — | Expected administrative changes (Jobcenter Meldepflichten) |
| — | Confidence level + legal disclaimer |
| — | Calculation trace (explainability) |
| — | Per-person attribution in household |

---

### 1.4 Calculation Engine Dependencies

The module depends on exactly **two functions** from `@arrivalos/shared-services`:

#### `calculateNetIncome(input: TaxCalculationInput)`

**Location:** `packages/shared-services/src/calculation/index.ts:60`

**Input interface:**
```typescript
{ grossIncome, taxClass, churchTax?, state? }
```

**Dependencies:** None external. Pure in-process math.

**Internal constants (hardcoded):**
- Social rates: health 7.3%, pension 9.3%, unemployment 1.3%, care 1.7%
- Tax class multipliers: `{1:1.0, 2:0.85, 3:0.7, 4:1.0, 5:1.3, 6:1.5}`
- EStG piecewise formula with thresholds: €11,604 / €17,005 / €66,760 / €277,825
- Solidarity threshold: €18,130 annual tax
- Church tax: 9% of income tax

#### `calculateBuergergeldEligibility(netIncome, householdSize, rent)`

**Location:** `packages/shared-services/src/calculation/index.ts:94`

**Internal constants:**
- Single Regelsatz: **€563/month for every household member**
- Need = `regelsatz × householdSize + rent`
- Gap = `need - netIncome`

#### `germanAdminRules.evaluate(ruleData)`

**Location:** `packages/shared-services/src/rules/index.ts`

**Financial relevance:** Low. Only `jobcenter-low-income` rule touches finances (net < €1200 + unemployed/part-time). Rules are generic platform rules, not SGB II-specific.

#### Dependency graph (current)

```
financial-reality/execute()
    │
    ├─► calculateNetIncome()        ← NO external data, NO year versioning
    ├─► calculateBuergergeldEligibility()  ← NO SGB II Freibeträge
    └─► germanAdminRules              ← NOT financial rules engine
```

**Critical finding:** The normalization helpers in `shared-services/normalization` are **not used** by the financial module despite being available.

---

### 1.5 Tax Calculation Accuracy Audit

**Verdict: ⚠️ Directional only — errors of €50–300+/month plausible for common cases.**

#### Methodology review

| Component | Current approach | Correct approach (Germany 2025/2026) | Severity |
|-----------|-----------------|----------------------------------------|----------|
| **Lohnsteuer** | EStG formula + tax class multiplier on taxable base | BMF **Programmablaufpläne (PAP)** per Steuerklasse; Lohnsteuer lookup tables | 🔴 Critical |
| **Steuerklasse** | Arbitrary multipliers (0.7–1.5) | Each class has distinct PAP; III/V and IV/IV factor pairing | 🔴 Critical |
| **Solidaritätszuschlag** | 5.5% if income tax > €18,130 | Full exemption rules post-2021; 11/17 progression zone | 🟡 Medium |
| **Kirchensteuer** | Flat 9% | 9% (most states) or 8% (BY/BW) | 🟡 Medium |
| **KV/PV/RV/AV** | Flat % of gross, no caps | Beitragsbemessungsgrenzen (KV ~€5,175/mo, RV ~€7,550/mo 2025); split employee/employer | 🔴 Critical |
| **Pflegeversicherung** | Flat 1.7% | 1.7% + 0.6% childless surcharge (23+); Saxony split differs | 🟡 Medium |
| **Minijob (≤€538)** | Mentioned in decision text only | Pauschalabgaben: employer flat; employee often 0 RV if opted out | 🔴 Critical |
| **Midijob (€538.01–€2,000)** | Mentioned in decision text only | Gleitzone reduced employee contributions (Übergangsbereich) | 🔴 Critical |
| **Kindergeld/Freibeträge** | Not modeled | Kinderfreibetrag affects Lohnsteuer; Kindergeld €250/child | 🔴 Critical |
| **Tax year** | Hardcoded 2024-ish Grundfreibetrag | Must be versioned annually (2025: €12,096 Grundfreibetrag) | 🟡 Medium |
| **`state` parameter** | Declared but **never used** | Required for church tax rate + PV rules | 🟡 Medium |

#### Example deviation estimate

| Scenario | v1 output (approx) | Expected order of magnitude | Risk |
|----------|-------------------|----------------------------|------|
| €2,500 gross, StKl I, no church | Net ~€1,639 | Net ~€1,580–1,680 (depends on KV Zusatzbeitrag) | Medium |
| €556 gross Minijob | Full social deductions applied | Near €556 net (if RV opted out) | 🔴 High |
| €1,200 gross Midijob | Full social deductions | Higher net due to Gleitzone | 🔴 High |
| €4,500 gross, StKl III | Same multiplier as StKl I with 0.7 hack | Significantly different PAP | 🔴 High |
| Married, 2 children | householdSize=4 → €2,252 Regelsatz | Regelbedarf varies: ~€563 + ~€506 + child rates | 🔴 High |

#### Steuerklasse multiplier problem (fundamental flaw)

The current code applies a multiplier to the **annual gross** before running the Einkommensteuer formula:

```typescript
// packages/shared-services/src/calculation/index.ts:41-43
const multiplier = TAX_CLASS_MULTIPLIERS[taxClass] ?? 1.0;
const taxableBase = annualGross * multiplier;
```

This is **not how Lohnsteuer works**. Steuerklasse affects withholding via discrete BMF tables, not a linear scaling of the tax base. Steuerklasse VI (second job) applies full rates without Grundfreibetrag — the multiplier approach understates this case.

---

### 1.6 Bürgergeld Calculation Accuracy Audit

**Verdict: 🔴 Not compliant with SGB II — suitable for demo only.**

#### Current formula

```
need = €563 × householdSize + monthlyRent
gap  = need - netIncome
eligible = gap > 0
estimatedBenefit = gap
```

#### SGB II requirements vs implementation

| Rule | Legal reality (SGB II / Regelbedarf) | Current implementation | Gap |
|------|----------------------------------------|------------------------|-----|
| **Regelbedarf** | Tiered by role: single adult, partner, children by age (RB Stufe 1–6) | Flat €563 × N | 🔴 Critical |
| **KdU (housing)** | Actual costs capped by local **Mietstufen** tables | Full rent passed through | 🔴 Critical |
| **Income imputation** | Freibeträge: €100 + 20% of excess for Erwerbseinkommen; separate rules for ALG | Full net income counted | 🔴 Critical |
| **Partner income** | Bedarfsgemeinschaft — combined household assessment | Single `netIncome` | 🔴 Critical |
| **Kindergeld** | Counted as income (with exemptions) | Not modeled | 🔴 Critical |
| **Vermögen** | Freibeträge (e.g. €40,000 per BG member) | Not modeled | 🟡 Medium (v2 phase 2) |
| **Mehrbedarf** | Pregnancy, disability, decarbonization etc. | Not modeled | 🟡 Medium |
| **ALG I transition** | Different pathway from Arbeitslosengeld | Not modeled | 🟡 Medium |
| **Wohngeld exclusion** | Interaction with other benefits | Not modeled | 🟡 Medium |

#### 2025 Regelbedarf reference (approximate, for planning)

| Person type | Monthly Regelbedarf (2025) |
|-------------|---------------------------|
| Single adult (RB Stufe 1) | ~€563 |
| Adult in Bedarfsgemeinschaft (RB Stufe 2) | ~€506 |
| Adult 18–24 at parents (RB Stufe 3) | ~€451 |
| Child 14–17 (RB Stufe 4) | ~€471 |
| Child 6–13 (RB Stufe 5) | ~€390 |
| Child 0–5 (RB Stufe 6) | ~€357 |

Using `householdSize × 563` **overstates need** for couples and **misstates** all child compositions.

#### Income Freibetrag (critical missing logic)

For Erwerbseinkommen imputed to Bürgergeld (§ 11b SGB II simplified):

- First **€100** of gross employment income: **not counted**
- **20%** of gross between €100 and €1,000: **not counted**
- Additional tiers up to €1,200 (with conditions)

This means **working can be financially beneficial** even when gross exceeds the gap — v1 cannot model this, causing false "don't work" implications.

---

### 1.7 UI Flow Audit

**Location:** `apps/web/src/app/modules/financial-reality/page.tsx`

#### Current user flow

```
1. User lands on /modules/financial-reality
2. Single-page form (7 fields) with defaults (€2500 gross, StKl 1, 1 person, €800 rent)
3. Submit → POST execute → loading state
4. Results panel shows:
   - Income breakdown (5 stats)
   - Bürgergeld eligibility (boolean + reasoning bullets)
   - Decisions list (if any)
5. No scenario comparison, no save, no step-by-step wizard
```

#### UI strengths

- Clean two-column layout (form | results)
- Uses shared `ModuleLayout`, `ResultPanel`, i18n for chrome
- Error handling for API failures
- Session ID passed via header

#### UI gaps

| Gap | Impact |
|-----|--------|
| No household builder | Cannot add partner/children |
| No scenario mode | Cannot compare "current" vs "job offer" |
| No Minijob/Midijob toggle | User cannot indicate employment type |
| Hardcoded English labels | Form labels not i18n (`"Gross monthly income"`) |
| Duplicated `FinancialResult` type | Not imported from shared package; drift risk |
| Fixed two-column grid | Breaks on mobile (no responsive override) |
| No explainability UI | User cannot inspect calculation steps |
| No disclaimer | Legal risk for financial guidance |
| Results imply precision | `"Potentially eligible — ~€X/month"` without confidence |
| `AppContext.userProfile` ignored | Re-entry friction; household not pre-filled |

---

### 1.8 API Contract Audit

#### Endpoint

```
POST /api/modules/financial-reality/execute
Headers: Content-Type: application/json, x-session-id?: string
Body: { input: FinancialRealityInput, context?: AppContext }
```

#### Response (success)

```json
{
  "moduleId": "financial-reality",
  "version": "1.0.0",
  "success": true,
  "data": { /* FinancialRealityOutput */ },
  "executedAt": "ISO-8601"
}
```

#### Response (validation failure)

```
HTTP 422
{ "moduleId", "version", "success": false, "error": "Zod message", "executedAt" }
```

#### API contract gaps

| Gap | Notes |
|-----|-------|
| No schema introspection | Clients cannot discover fields; no `GET .../schema` |
| No `mode` parameter | Cannot request `quick` vs `full` vs `compare` analysis |
| No calculation year | Rules hardcoded; API doesn't accept `taxYear: 2025` |
| Version in response only | Same module ID for breaking changes |
| No idempotency key | Scenario replays not trackable |
| Input in body flat fallback | API accepts `body.input ?? body` — ambiguous contract |
| No rate limiting | Financial endpoint open to abuse |

---

### 1.9 Tests Audit

**Finding: 🔴 Zero tests exist for the Financial Reality Module.**

| Scope | Test files | Coverage |
|-------|-----------|----------|
| `packages/modules/src/financial-reality/` | 0 | 0% |
| `packages/shared-services/src/calculation/` | 0 | 0% |
| `apps/web/.../financial-reality/page.tsx` | 0 | 0% |
| API integration (financial execute) | 0 | 0% |

The `@arrivalos/core` package.json references Jest but no test files exist. **No golden fixtures, no regression suite, no property-based tests.**

This is the single highest engineering risk for a financial decision module.

---

## Part 2 — Weaknesses Summary

### Accuracy (Product Trust)

1. Lohnsteuer uses invalid Steuerklasse multiplier approach
2. Bürgergeld ignores SGB II Freibeträge — **cannot answer "is work worth it?"**
3. Household modeling is `householdSize` integer — no Bedarfsgemeinschaft
4. Minijob/Midijob referenced in copy but not calculated
5. No annual parameter versioning (2024 tax constants in 2026)

### Product (Decision Support)

6. Single scenario only — no job-offer comparison
7. No structured verdict (`isJobFinanciallyBeneficial`)
8. No benefit reduction breakdown
9. No "what to expect at Jobcenter" action plan tied to numbers
10. Outputs English-only in decision strings

### Engineering

11. Monolithic calculation file — not extensible for v2 rules
12. No shared types between backend and frontend
13. Normalization helpers unused
14. Admin rules engine wrong abstraction for SGB II
15. No tests, no CI gate

### Legal / UX

16. No disclaimer or confidence scoring
17. Results overstate precision (e.g. exact € benefit amounts)
18. migrant-specific edge cases missing (Aufenthalt, restricted work, SGB II eligibility for non-EU)

---

## Part 3 — Proposed v2 Architecture

### 3.1 Design principles

1. **Decision-first outputs** — every response answers a user question, not just numbers
2. **Household as first-class domain** — Bedarfsgemeinschaft, not headcount
3. **Scenario-native** — minimum two scenarios: `baseline` vs `proposed`
4. **Explainability** — every figure has a traceable `CalculationStep`
5. **Versioned legal parameters** — tax year + rule set ID in every response
6. **Honest uncertainty** — confidence levels + disclaimers mandatory
7. **Progressive disclosure** — `quick` mode for estimates, `full` for detail

### 3.2 Target architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Financial Reality Module v2                     │
│                         (orchestrator)                           │
├─────────────────────────────────────────────────────────────────┤
│  Input Validator → Scenario Builder → Decision Pipeline → Output  │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────┼────────┬────────────────┬──────────────────┐
    ▼        ▼        ▼                ▼                  ▼
┌────────┐ ┌──────────────┐ ┌─────────────────┐ ┌───────────────┐
│Household│ │ PayrollEngine│ │ BenefitsEngine  │ │ ScenarioEngine│
│ Model  │ │ (Brutto→Netto)│ │ (SGB II, ALG,  │ │ (compare A/B) │
│        │ │ Minijob/Midijob│ │  Wohngeld stub)│ │               │
└────────┘ └──────────────┘ └─────────────────┘ └───────────────┘
             │                │                    │
             └────────────────┼────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │ DecisionEngine   │
                    │ (rules + ranking)│
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ ParameterRegistry│
                    │ (2025, 2026, …)  │
                    └──────────────────┘
```

### 3.3 Package structure (proposed)

```
packages/shared-services/src/
  financial/
    parameters/
      2025.ts              # Regelbedarf, BBMG, Minijobgrenze, PAP tables
      2026.ts
      index.ts             # getParameters(year)
    household/
      types.ts             # Household, Person, Child, Employment
      builder.ts           # construct Bedarfsgemeinschaft
    payroll/
      lohnsteuer-pap.ts    # BMF PAP implementation
      social-contributions.ts
      minijob.ts
      midijob.ts           # Gleitzone
      net-income.ts        # orchestrates payroll
    benefits/
      buergergeld/
        regelbedarf.ts
        kdu.ts             # simplified Mietstufen lookup
        income-imputation.ts  # §11b Freibeträge
        calculator.ts
      alg-stub.ts          # phase 2
    scenarios/
      comparator.ts
      types.ts
    trace/
      calculation-step.ts  # explainability

packages/modules/src/financial-reality/
  index.ts                 # registration v2.0.0
  schema/
    input.v2.ts
    output.v2.ts
  engine/
    pipeline.ts            # main execute pipeline
    decision-engine.ts
  content/
    decisions/             # i18n decision templates (en, de, ru, ua)
  v1/                      # deprecated shim (optional, during migration)
    index.ts
```

### 3.4 Decision pipeline (v2 execute flow)

```
1. Parse & validate FinancialRealityInputV2
2. Build Household from members[]
3. Load ParameterRegistry for taxYear + ruleSetVersion
4. For each scenario in [baseline, proposed, ...]:
   a. Classify employment type (none | minijob | midijob | regular | self-employed)
   b. Run PayrollEngine per earning member
   c. Aggregate household gross/net
   d. Run BenefitsEngine (Bürgergeld with Freibeträge, current vs projected)
   e. Compute total household resources
5. ScenarioEngine.compare(baseline, proposed):
   - deltaNet, deltaBenefits, effectiveGain
   - marginalEffectiveRate (€ kept per € earned)
6. DecisionEngine.evaluate(comparison, household):
   - Generate verdict + ranked decisions + expectedChanges
7. Attach calculationTrace + disclaimer + confidence
8. Validate & return FinancialRealityOutputV2
```

---

## Part 4 — Technical Specification (v2)

### 4.1 Module metadata

```typescript
{
  id: 'financial-reality',        // same ID, semver bump
  version: '2.0.0',
  featureFlags: {
    advancedTaxScenarios: true,
    wohngeldInteraction: false,   // phase 2
    vermoegenCheck: false,        // phase 3
  }
}
```

### 4.2 Input schema v2

```typescript
const PersonSchema = z.object({
  id: z.string(),
  role: z.enum(['applicant', 'partner', 'child']),
  age: z.number().int().min(0).max(120),
  taxClass: z.union([z.literal(1), ..., z.literal(6)]).optional(),
  churchTax: z.boolean().default(false),
});

const EmploymentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('none'),
  }),
  z.object({
    type: z.literal('minijob'),
    grossMonthly: z.number().min(0).max(538),  // 2025 Minijobgrenze — from params
  }),
  z.object({
    type: z.literal('midijob'),
    grossMonthly: z.number().min(538.01).max(2000),
  }),
  z.object({
    type: z.literal('regular'),
    grossMonthly: z.number().positive(),
    taxClass: z.union([z.literal(1), ..., z.literal(6)]),
    churchTax: z.boolean().default(false),
    hoursPerWeek: z.number().positive().optional(),
  }),
  z.object({
    type: z.literal('self-employed'),
    netMonthlyEstimate: z.number().nonnegative(),
  }),
]);

const ScenarioSchema = z.object({
  id: z.string(),
  label: z.string(),
  employments: z.record(z.string(), EmploymentSchema),  // personId → employment
});

const FinancialRealityInputV2Schema = z.object({
  mode: z.enum(['quick', 'full', 'compare']).default('compare'),

  // Household
  members: z.array(PersonSchema).min(1).max(10),
  housing: z.object({
    coldRent: z.number().nonnegative(),
    utilities: z.number().nonnegative().default(0),  // Nebenkosten/heating
    bundesland: z.string().length(2),                 // e.g. "BE", "BY"
    cityMietstufe: z.number().int().min(1).max(7).optional(),
  }),

  // Scenarios (minimum baseline; proposed optional in quick mode)
  baseline: ScenarioSchema,
  proposed: ScenarioSchema.optional(),

  // Current state
  currentBenefits: z.object({
    receivingBuergergeld: z.boolean().default(false),
    receivingAlg1: z.boolean().default(false),
    currentBuergergeldAmount: z.number().nonnegative().optional(),
  }).default({}),

  // Calculation config
  taxYear: z.number().int().default(2025),
  ruleSetVersion: z.string().default('2025.1'),
});
```

#### Quick mode simplification

For `mode: 'quick'`, allow flattened input (backward compatible adapter):

```typescript
// Adapter maps v1-style input → v2 household + single scenario
{ grossIncome, taxClass, householdSize, monthlyRent, ... }
  → members: [{ role: 'applicant', age: 30, taxClass }],
     housing: { coldRent: monthlyRent, bundesland: 'BE' },
     baseline: { employments: { applicant: { type: 'regular', grossMonthly } } }
```

### 4.3 Output schema v2

```typescript
const FinancialRealityOutputV2Schema = z.object({
  meta: z.object({
    moduleVersion: z.string(),
    taxYear: z.number(),
    ruleSetVersion: z.string(),
    mode: z.enum(['quick', 'full', 'compare']),
    confidence: z.enum(['high', 'medium', 'low']),
    disclaimer: z.string(),
    calculatedAt: z.string(),
  }),

  // Core verdict — answers the user's primary question
  verdict: z.object({
    isJobFinanciallyBeneficial: z.boolean().nullable(),  // null if no proposed scenario
    summary: z.string(),                                  // i18n key or resolved string
    householdDeltaMonthly: z.number().nullable(),         // proposed - baseline total
    effectiveGainFromWork: z.number().nullable(),         // after benefit reductions
    marginalRetentionRate: z.number().nullable(),         // % of gross raise kept
  }),

  scenarios: z.array(z.object({
    id: z.string(),
    label: z.string(),
    household: z.object({
      totalGross: z.number(),
      totalNet: z.number(),
      totalDeductions: z.object({
        incomeTax: z.number(),
        solidaritySurcharge: z.number(),
        churchTax: z.number(),
        socialContributions: z.number(),
      }),
      members: z.array(z.object({
        personId: z.string(),
        role: z.string(),
        employmentType: z.string(),
        gross: z.number(),
        net: z.number(),
        deductions: z.record(z.number()),
      })),
    }),
    benefits: z.object({
      buergergeld: z.object({
        eligible: z.boolean(),
        grossNeed: z.number(),           // Regelbedarf + KdU
        countableIncome: z.number(),     // after Freibeträge
        netBenefit: z.number(),
        breakdown: z.object({
          regelbedarf: z.number(),
          kdu: z.number(),
          incomeImputation: z.number(),
          freibetragApplied: z.number(),
        }),
        reasoning: z.array(z.string()),
      }),
      kindergeld: z.number().default(0),  // informational
    }),
    totalHouseholdResources: z.number(),  // net + benefits
  })),

  comparison: z.object({
    baselineId: z.string(),
    proposedId: z.string().optional(),
    deltaTotalResources: z.number().nullable(),
    deltaNetEmployment: z.number().nullable(),
    deltaBuergergeld: z.number().nullable(),
    benefitReductions: z.array(z.object({
      benefit: z.string(),
      before: z.number(),
      after: z.number(),
      delta: z.number(),
    })),
  }).optional(),

  decisions: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    category: z.enum(['employment', 'benefits', 'tax', 'housing', 'administrative']),
    action: z.string().optional(),
    institution: z.string().optional(),   // Jobcenter, Finanzamt
  })),

  expectedChanges: z.array(z.object({
    trigger: z.string(),                  // "Starting employment"
    obligations: z.array(z.string()),     // Meldepflicht, Vorlage Pflichtenheft
    timeline: z.string().optional(),
  })),

  calculationTrace: z.array(z.object({
    step: z.string(),
    formula: z.string().optional(),
    inputs: z.record(z.unknown()),
    output: z.number(),
    legalReference: z.string().optional(),  // "§ 11b SGB II"
  })).optional(),  // only in mode: 'full'
});
```

### 4.4 Required capabilities — mapping

| Required capability | v2 component | Phase |
|--------------------|--------------|-------|
| Brutto → Netto | `PayrollEngine` + PAP tables | Phase 1 |
| Bürgergeld comparison | `BenefitsEngine.buergergeld` × 2 scenarios | Phase 1 |
| Effective gain from employment | `ScenarioEngine.effectiveGainFromWork` | Phase 1 |
| Household-level calculations | `Household` model + aggregation | Phase 1 |
| Partner income impact | Multi-member `employments` map | Phase 1 |
| Child impact | Regelbedarf by age + Kindergeld | Phase 1 |
| Rent impact | `KdU` with Mietstufen cap (simplified) | Phase 1 |
| Tax class impact | Per-person PAP | Phase 1 |
| Minijob / Midijob | `minijob.ts`, `midijob.ts` | Phase 1 |
| Scenario comparison | `ScenarioEngine.compare` | Phase 1 |
| Wohngeld interaction | Stub + flag | Phase 2 |
| ALG I transition | Stub | Phase 2 |
| Vermögen check | Flag off | Phase 3 |

### 4.5 Decision engine rules (v2)

Decision engine evaluates **after** numeric pipeline. Example rules:

| Rule ID | Condition | Decision output |
|---------|-----------|-----------------|
| `WORK_NET_POSITIVE` | effectiveGainFromWork > 0 | "Taking this job improves household finances by €X/month" |
| `WORK_NET_NEGATIVE` | effectiveGainFromWork ≤ 0 | "Warning: job may not improve finances due to benefit reduction" |
| `BURGERGELD_PARTIAL_REDUCTION` | deltaBuergergeld < 0 but > -grossNeed | "Bürgergeld reduces but work still increases total resources" |
| `MINIJOB_OPTIMAL` | proposed is minijob && preserves full BG | "Minijob may preserve full Bürgergeld — verify RV opt-out" |
| `MIDJOB_TRANSITION` | midijob range | "Midijob zone — contributions reduced, check exact Gleitzone calc" |
| `RENT_KDU_CAP` | rent > local cap | "Rent may exceed KdU cap — Nebenkosten may not be fully covered" |
| `STKL_OPTIMIZATION` | married + suboptimal classes | "Review Steuerklasse combination with Finanzamt" |
| `JOB_CENTER_DUTY` | proposed employment + receiving BG | Expected change: Meldepflicht 2-weeks, Einkommensnachweise |

Rules stored as data (JSON/YAML) initially; migrate to rules engine v2 later.

### 4.6 Parameter registry

All legal constants externalized:

```typescript
interface FinancialParameterSet {
  year: number;
  version: string;
  grundfreibetrag: number;
  minijobGrenze: number;
  midijobObergrenze: number;
  regelbedarf: Record<'stufe1'|'stufe2'|'stufe3'|'stufe4'|'stufe5'|'stufe6', number>;
  kindergeld: number;
  bbmgKv: number;
  bbmgRv: number;
  socialRates: { kv: number; pv: number; rv: number; av: number };
  buergergeldFreibetraege: {
    grundbetrag: 100;
    tier1Rate: 0.20;
    tier1Limit: 1000;
    // ...
  };
  papTables: Record<TaxClass, PapTable>;  // or reference to bundled JSON
}
```

**Source of truth:** BMF PAP (annual), Bundesregierung Regelbedarfsstufen, SGB II Freibetrag thresholds.

### 4.7 Payroll engine — Minijob & Midijob (spec)

#### Minijob (2025: ≤ €538/month)

```
IF gross ≤ minijobGrenze:
  employeeRV = member optedIntoRv ? calculateRv(gross) : 0
  employeeKvPv = 0 (if geringfügig, employer pays flat)
  net ≈ gross - employeeRV
  employerPauschale = not shown to user (optional info)
```

#### Midijob (Gleitzone €538.01 – €2,000)

```
reducedAssessment = f(gross)  // BEMA Gleitzone formula
contributions = reducedAssessment × combinedRate
net = gross - contributions - lohnsteuer(reducedAssessment)
```

Implement BEMA official formula, not linear interpolation.

### 4.8 Bürgergeld engine — income imputation (spec)

```
countableIncome = 0
for each earning member:
  if employment:
    freibetrag = 100 + max(0, min(gross - 100, 900)) × 0.20 + ...
    countableIncome += gross - freibetrag
  if alg1: apply ALG imputation rules (phase 2)

countableIncome += kindergeld - kindergeldFreibetrag (if applicable)

netBenefit = max(0, grossNeed - countableIncome)
```

### 4.9 Scenario comparison — core formulas

```
effectiveGainFromWork =
  proposed.totalHouseholdResources - baseline.totalHouseholdResources

marginalRetentionRate =
  effectiveGainFromWork / (proposed.totalGross - baseline.totalGross)

isJobFinanciallyBeneficial =
  effectiveGainFromWork > 0
```

When `effectiveGainFromWork ≈ 0` within tolerance (€10), verdict = `marginal` with low confidence.

---

## Part 5 — Migration Plan

### 5.1 Strategy: In-place semver with adapter

**Recommended:** Bump module to `2.0.0` under same ID `financial-reality`. Provide **v1→v2 input adapter** for backward compatibility during transition.

| Approach | Pros | Cons |
|----------|------|------|
| Same ID, v2 schema + adapter | Single module in registry; clean UX | Breaking output for existing UI |
| New ID `financial-reality-v2` | Parallel run | Registry clutter, split traffic |
| Feature flag `useV2Engine` | Gradual rollout | Complexity in one file |

**Decision:** Same ID + semver 2.0.0 + `mode: 'quick'` adapter preserving v1-like input shape.

### 5.2 Migration phases

#### Phase M0 — Preparation (no user-visible change)
- [ ] Add `packages/shared-services/src/financial/` structure
- [ ] Add ParameterRegistry 2025
- [ ] Add test fixtures from official examples (BMF, Jobcenter leaflets)
- [ ] Keep v1 engine running

#### Phase M1 — Engine behind flag
- [ ] Implement PayrollEngine with PAP
- [ ] Implement BenefitsEngine with Freibeträge
- [ ] Feature flag `advancedTaxScenarios: true` switches to v2 pipeline
- [ ] API returns v2 output schema when flag on

#### Phase M2 — UI migration
- [ ] New multi-step UI: Household → Current state → Job offer → Comparison
- [ ] Keep `mode: 'quick'` single-form for simple cases
- [ ] Shared types package or OpenAPI codegen for frontend

#### Phase M3 — v1 deprecation
- [ ] Remove v1 calculation functions (or move to `v1/` shim)
- [ ] Remove adapter after analytics show zero v1-style calls
- [ ] Update documentation

### 5.3 Backward compatibility adapter

```typescript
function adaptV1Input(input: FinancialRealityInputV1): FinancialRealityInputV2 {
  return {
    mode: 'quick',
    members: buildMembersFromHouseholdSize(input.householdSize, input.maritalStatus),
    housing: { coldRent: input.monthlyRent, utilities: 0, bundesland: 'BE' },
    baseline: {
      id: 'current',
      label: 'Current',
      employments: {
        applicant: {
          type: 'regular',
          grossMonthly: input.grossIncome,
          taxClass: input.taxClass,
          churchTax: input.churchTax,
        },
      },
    },
    taxYear: 2025,
    ruleSetVersion: '2025.1',
  };
}
```

### 5.4 Data migration

No persistent user data exists today (in-memory sessions). **No database migration required** for MVP v2.

Future: store household profiles in PostgreSQL — schema designed in Phase 2.

---

## Part 6 — Implementation Plan (Phased)

### Phase 1 — Trustworthy calculations (3–4 weeks)

**Goal:** Accurate Brutto/Netto + Bürgergeld with Freibeträge for single and couple households.

| Week | Deliverable |
|------|-------------|
| 1 | ParameterRegistry 2025; PAP Lohnsteuer; 20 golden tests from BMF examples |
| 2 | Minijob + Midijob engines; social contribution BBMG caps |
| 3 | Bürgergeld Regelbedarf tiers + §11b Freibeträge + KdU simplified |
| 4 | Scenario comparator; v2 output schema; adapter for v1 input |

**Exit criteria:**
- 95% of golden tests within €5/month of reference values
- `effectiveGainFromWork` correct for 10 Jobcenter-style scenarios
- Zero v1 multiplier tax code in hot path

### Phase 2 — Decision engine + UI (2–3 weeks)

**Goal:** Answer the four user questions in plain language.

| Deliverable |
|-------------|
| DecisionEngine with 15+ rules |
| `expectedChanges[]` for Jobcenter obligations |
| i18n decision templates (EN, DE, RU, UA) |
| Multi-step UI with scenario comparison view |
| Disclaimer + confidence on every response |
| Mobile-responsive layout |

**Exit criteria:**
- User can compare "on Bürgergeld" vs "accept €1,200 job" and see clear verdict
- All decision strings localized

### Phase 3 — Hardening (2 weeks)

**Goal:** Production-grade quality.

| Deliverable |
|-------------|
| 100+ unit tests, 20 integration tests |
| `GET /api/modules/financial-reality/schema` |
| Calculation trace in `full` mode |
| CI gate: financial tests block merge |
| Legal review checklist document |

### Phase 4 — Extended benefits (ongoing)

- Wohngeld interaction
- ALG I → Bürgergeld transitions
- Vermögensprüfung
- City-specific Mietstufen database
- Python rules microservice (if complexity exceeds TS maintainability)

---

## Part 7 — Test Strategy

### 7.1 Golden fixtures (mandatory)

Source reference values from:
- BMF Lohnsteuer-PAP official test cases
- Jobcenter example calculations (SGB II Freibeträge)
- Known Minijob/Midijob examples from Minijob-Zentrale

```typescript
// packages/shared-services/src/financial/__fixtures__/payroll-2025.json
[
  {
    "id": "stkl1-2500",
    "input": { "gross": 2500, "taxClass": 1, "churchTax": false },
    "expected": { "net": 1634, "tolerance": 5 }
  }
]
```

### 7.2 Test pyramid

| Layer | Count target | Tool |
|-------|-------------|------|
| Unit (payroll, benefits, scenarios) | 120+ | Vitest |
| Module integration (execute pipeline) | 30+ | Vitest |
| API (POST execute) | 15+ | Fastify inject |
| UI component | 10+ | React Testing Library |
| E2E (happy path compare flow) | 3+ | Playwright (phase 2) |

### 7.3 Property-based tests

- Net income always ≤ gross
- Increasing gross never decreases net (monotonicity, holding class constant)
- effectiveGainFromWork = delta resources
- Bürgergeld benefit never exceeds grossNeed

### 7.4 Regression gate

```yaml
# .github/workflows/financial.yml
- run: npm run test -w @arrivalos/shared-services -- financial
- run: npm run test -w @arrivalos/modules -- financial-reality
```

---

## Part 8 — UI Specification (v2)

### 8.1 Flow: Compare mode (primary)

```
Step 1: Your household
  - Add members (you, partner, children with ages)
  - Bundesland + rent

Step 2: Current situation
  - Current employment per adult (or "not working")
  - Currently receiving Bürgergeld? (Y/N + amount)

Step 3: Job offer (optional)
  - Gross salary OR Minijob/Midijob toggle
  - Tax class

Step 4: Results
  ┌─────────────────────────────────────────┐
  │ VERDICT: Yes — €247/month better off    │
  │ [confidence: medium]                    │
  ├─────────────────────────────────────────┤
  │ Side-by-side: Current | With job        │
  │ Total resources: €1,412 → €1,659        │
  │ Bürgergeld: €890 → €643 (-€247)         │
  │ Net salary: €0 → €1,016                 │
  ├─────────────────────────────────────────┤
  │ What changes:                           │
  │ • Report income to Jobcenter within 2w  │
  │ • Submit Gehaltsabrechnungen monthly    │
  ├─────────────────────────────────────────┤
  │ Decisions (ranked)                      │
  └─────────────────────────────────────────┘
```

### 8.2 Flow: Quick mode (legacy/simple)

Single form → simplified verdict. Maps to v1 UX but uses v2 engine.

---

## Part 9 — API Changes (v2)

### New optional endpoints

```
GET  /api/modules/financial-reality/schema
     → JSON Schema derived from FinancialRealityInputV2Schema

POST /api/modules/financial-reality/execute
     Body: { input: FinancialRealityInputV2, context?, options?: { includeTrace: boolean } }
     Response: FinancialRealityOutputV2 wrapped in ModuleExecutionResult
```

### Response meta (always present)

```json
{
  "meta": {
    "confidence": "medium",
    "disclaimer": "This is decision support, not legal or tax advice. Verify with Jobcenter/Finanzamt.",
    "ruleSetVersion": "2025.1"
  }
}
```

---

## Part 10 — Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PAP implementation errors | Medium | High | Golden tests against BMF; annual update process |
| User trusts wrong verdict | Medium | Critical | Confidence + disclaimer; never show false precision |
| Mietstufen data incomplete | High | Medium | Start with Bundesland averages; label as estimate |
| Scope creep (Wohngeld, ALG) | High | Medium | Phase gates; stubs with `confidence: low` |
| Non-EU migrant eligibility edge cases | Medium | High | Add `residencyStatus` gating rules; defer ineligible scenarios |
| Annual law changes break calc | Certain | Medium | ParameterRegistry versioning; automated update alerts |

---

## Part 11 — Open Questions (for product decision)

1. **Eligibility gating:** Should module refuse Bürgergeld calc for users with `residencyStatus: tourist` or show info-only mode?
2. **Mietstufen data source:** Manual CSV per city vs third-party API vs user-entered cap?
3. **PKV vs GKV:** Include private insurance impact on net (PKV doesn't reduce gross the same way)?
4. **Self-employed depth:** Full EÜR estimate or netMonthlyEstimate input only for v2?
5. **Werkstudent / Aufstockung:** In scope for Phase 1 or Phase 2?
6. **Legal review:** Required before public launch? Who signs off on disclaimer text?

---

## Part 12 — Success Metrics (v2)

| Metric | v1 baseline | v2 target |
|--------|------------|-----------|
| Payroll accuracy (within €5) | Unknown (~70% est.) | ≥ 95% of golden fixtures |
| Bürgergeld Freibetrag modeled | ❌ | ✅ |
| Scenario comparison | ❌ | ✅ |
| Verdict provided | ❌ | 100% of compare mode |
| Test coverage (financial code) | 0% | ≥ 85% |
| Localized decisions | 0% | 4 languages |
| User can answer "is job worth it?" | No | Yes |

---

## Appendix A — v1 Code References

| Item | Location |
|------|----------|
| Module execute | `packages/modules/src/financial-reality/index.ts:63-141` |
| Tax multipliers | `packages/shared-services/src/calculation/index.ts:32-38` |
| Bürgergeld formula | `packages/shared-services/src/calculation/index.ts:94-120` |
| UI form | `apps/web/src/app/modules/financial-reality/page.tsx:81-127` |
| API execute | `apps/api/src/index.ts:57-78` |
| Registry validation | `packages/core/src/registry/index.ts:105-113` |

## Appendix B — Immediate Pre-Implementation Checklist

Before writing v2 code:

- [ ] Product sign-off on v2 input/output schemas (Section 4.2, 4.3)
- [ ] Collect 20 BMF PAP reference test vectors
- [ ] Collect 10 SGB II Freibetrag worked examples
- [ ] Decide Mietstufen MVP approach (Open Question #2)
- [ ] Approve disclaimer text (EN + DE minimum)
- [ ] Create `docs/audits/financial-module-v2-plan.md` review ticket

---

*End of document. Implementation must not begin until schemas and golden fixtures are approved.*
