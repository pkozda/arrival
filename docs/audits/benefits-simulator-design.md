# Benefits Simulator Module — Product & Architecture Design

**Document type:** Product specification + architecture proposal  
**Module (proposed):** `benefits-simulator` v1.0.0  
**Author role:** Product Manager / System Architect  
**Date:** June 2026  
**Status:** Proposal — **not implemented**  
**Related docs:**  
`docs/CURRENT_STATE.md`, `docs/audits/financial-module-v2-plan.md`, `docs/audits/user-profile-engine-design.md`, `docs/audits/user-profile-engine-ui-contract-report.md`

---

## Executive Summary

Arrive Atlas helps migrants make **financial decisions** in Germany. The existing **Financial Reality Module** answers: *"What is my net income, and is this one job offer worth taking?"*

A proposed **Benefits Simulator Module** answers a complementary question: *"What happens to my household finances and benefits if my life situation changes?"*

This document analyzes overlap with Financial Reality, defines clear product boundaries, and proposes a module that **reuses the Financial v2 engine** (`@arrivalos/shared-services/financial`) without duplicating calculation logic. The simulator is scenario-centric (unemployment, part-time, Minijob, Midijob, children, rent, household composition) and output-centric (financial impact, benefit deltas, risk warnings, recommendations).

**Recommendation:** Add `benefits-simulator` as a **sixth module** — not a replacement for Financial Reality. Share the v2 pipeline; specialize inputs (multi-event scenarios) and outputs (benefit transition analysis).

---

## 1. Architecture Context

### 1.1 Current platform layers

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer                                                    │
│  Next.js module pages · GET/PATCH /api/profile              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  API Layer (Fastify)                                         │
│  POST /api/modules/:id/execute · GET /api/modules/:id/trace │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  Profile Engine (@arrivalos/profile)                         │
│  resolveExecutionContext() → policy · merge · trace           │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  Module Registry (@arrivalos/core)                           │
│  Module.execute(input, context) — Zod-validated contract    │
└────────────────────────────┬────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  financial-reality    healthcare-nav      (5 modules today)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Shared Services (@arrivalos/shared-services/financial)      │
│  financialPipeline · benefitsEngine · payrollEngine          │
│  Bürgergeld · Minijob/Midijob · scenario comparator          │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Financial v2 capabilities already built

| Capability | Location | Reusable by Simulator? |
|------------|----------|------------------------|
| Household model (`FinancialPerson`, roles, ages) | `financial/types` | ✅ Direct |
| Employment types (none, minijob, midijob, regular, self-employed) | `financial/types` | ✅ Direct |
| Payroll engine (Brutto/Netto, Gleitzone) | `financial/payroll` | ✅ Direct |
| Bürgergeld (Regelbedarf, KdU, Freibeträge §11b) | `financial/benefits/buergergeld` | ✅ Direct |
| Kindergeld (child count × rate) | `financial/benefits` | ✅ Direct |
| Scenario evaluation | `benefitsEngine.evaluateScenario()` | ✅ Direct |
| Baseline vs proposed comparison | `compareScenarios()` | ✅ Extend to N scenarios |
| Decision heuristics | `decisionEngine` | ⚠️ Partial — simulator needs transition-specific rules |
| Legacy flat adapter | `adaptLegacyInputToV2()` | ❌ Too limited for simulator |

### 1.3 Profile Engine integration (Phase 1.9)

| Mechanism | Role for Simulator |
|-----------|-------------------|
| `GET/PATCH /api/profile` | UI loads/saves household, employment, housing, benefits |
| `resolveExecutionContext()` | Hydrates module input from profile + request overrides |
| Module profile policy | Controls which profile fields merge into execution |
| Execution trace | Backend-only; not exposed on profile API |

---

## 2. Overlap & Differentiation Analysis

### 2.1 Financial Reality vs Benefits Simulator

| Dimension | Financial Reality | Benefits Simulator |
|-----------|-------------------|-------------------|
| **Primary question** | "What do I earn net, and is *this job* worth it?" | "What happens if my *situation changes*?" |
| **User mental model** | Calculator + single offer comparison | Life-event what-if planner |
| **Scenario count** | 1 baseline + 0–1 proposed | 1 baseline + 1–8 change scenarios |
| **Input shape** | Flat legacy (grossIncome, householdSize) | Structured household + explicit events |
| **Employment modeling** | Inferred Minijob/Midijob from gross | User selects employment type per scenario |
| **Children** | Inferred from `householdSize − adults` (age 8 default) | Explicit children with ages |
| **Rent modeling** | Single `monthlyRent` | Baseline rent + per-scenario rent override |
| **Output emphasis** | Net income breakdown, single verdict | Benefit deltas, transition risks, multi-scenario grid |
| **Typical user** | Job seeker evaluating one offer | Benefit recipient planning life change |
| **Complexity** | Low — fast first answer | Medium — deliberate exploration |

### 2.2 Overlap map

```
                    Financial Reality          Benefits Simulator
                    ─────────────────          ──────────────────
Tax / payroll           ████████████              ████████████  (shared engine)
Bürgergeld calc         ████████████              ████████████  (shared engine)
Single job compare      ████████████              ████░░░░░░░░  (subset)
Multi-event scenarios   ░░░░░░░░░░░░              ████████████  (simulator-only)
Household composition   ████░░░░░░░░              ████████████  (simulator richer)
Risk / transition warn  ████░░░░░░░░              ████████████  (simulator focus)
Admin rules (Anmeldung) ████████████              ░░░░░░░░░░░░  (financial only)
Brutto-Netto UI focus   ████████████              ████░░░░░░░░  (secondary in sim)
```

**Conclusion:** ~70% of calculation logic is shared. ~30% is product-specific (multi-scenario orchestration, transition semantics, risk taxonomy). **Do not fork the math.**

### 2.3 Duplication risks & mitigations

| Risk | Mitigation |
|------|------------|
| Copy-paste Bürgergeld logic in new module | Module calls `benefitsEngine` / `financialPipeline` only |
| Duplicate decision strings | Extract shared decision templates to `shared-services/financial/decisions/`; simulator adds transition-specific IDs |
| Duplicate household builder | Add `buildHouseholdFromSimulatorInput()` in shared-services; both modules use it |
| Duplicate profile merge config | Register `benefits-simulator` in `MODULE_INPUT_CONFIG` + policy registry |
| UI form duplication | Shared `<HouseholdForm>` component in web (future); distinct scenario picker UX |
| Two modules answering same question | Product copy + routing: Financial Reality = "Quick check"; Simulator = "Explore changes" |

### 2.4 What Financial Reality should NOT absorb

Adding full multi-scenario life-event modeling to Financial Reality would:

- Break its "quick answer" UX contract
- Inflate an already-complex output schema
- Conflate job-offer comparison with benefit-transition planning

Keep Financial Reality as the **entry point**; Benefits Simulator as the **depth layer**.

---

## 3. Product Specification

### 3.1 Problem statement

Migrants on or near social benefits face opaque trade-offs:

- Taking a Minijob may reduce Bürgergeld — but by how much?
- Losing employment triggers ALG I vs Bürgergeld pathways — what is the income gap?
- A new child changes Regelbedarf and Kindergeld — net effect?
- Rent increases affect KdU — will benefits cover it?
- Part-time work vs full unemployment — marginal retention rate?

Today, Financial Reality partially addresses job-offer comparison but cannot model **arbitrary life transitions** with explicit household structure.

### 3.2 Target users

| Persona | Scenario |
|---------|----------|
| **Benefit recipient** | Currently on Bürgergeld; considering part-time or Minijob |
| **Job loser** | Employed → unemployment transition |
| **Growing family** | Planning for child; needs household impact |
| **Renter under pressure** | Landlord increases rent; needs benefit/housing impact |
| **Couple household** | Partner employment changes; Bedarfsgemeinschaft effects |

### 3.3 User stories

| ID | Story | Acceptance |
|----|-------|------------|
| BS-01 | As a user on Bürgergeld, I want to see what happens if I take a €450 Minijob | Scenario shows Bürgergeld reduction, net household delta, Freibetrag applied |
| BS-02 | As an employed migrant, I want to model job loss | Unemployment scenario: net income → 0, Bürgergeld eligibility estimate |
| BS-03 | As a parent, I want to add a child and see benefit changes | Regelbedarf + Kindergeld delta vs baseline |
| BS-04 | As a tenant, I want to model rent increase | KdU / total need change; warning if countable income unchanged |
| BS-05 | As a part-time worker, I want to compare vs unemployment | Two scenarios side-by-side with recommendation |
| BS-06 | As a user, I want risk warnings before acting | Critical flags: Meldepflicht, benefit cliff, net household loss |
| BS-07 | As a returning user, I want my profile pre-filled | Profile merge via `resolveExecutionContext()` |

### 3.4 Non-goals (v1)

| Non-goal | Reason |
|----------|--------|
| ALG I duration / contribution calculation | Phase 2 — requires employment history |
| Wohngeld full calculator | Separate benefit domain; cross-link only |
| Vermögensprüfung (assets test) | Needs asset input schema |
| Legal case management / document upload | Out of platform scope |
| Multi-year projections | v1 is monthly steady-state only |
| Partner consent / Bedarfsgemeinschaft legal determination | Estimate only; disclaimer required |

### 3.5 Success metrics

| Metric | Target |
|--------|--------|
| Scenario evaluation latency | < 500ms (in-memory, no LLM) |
| Shared engine reuse | 100% of benefit/payroll math via shared-services |
| Profile pre-fill rate | ≥ 80% of fields from profile when bound |
| User comprehension | Outputs include plain-language summary per scenario |
| Safety | Every response includes disclaimer + confidence level |

---

## 4. User Workflows

### 4.1 Primary workflow — Life change exploration

```
┌──────────────┐     ┌─────────────────────┐     ┌──────────────────────┐
│ Profile      │     │ Benefits Simulator  │     │ Results              │
│ (optional)   │────►│ Pick baseline state │────►│ Scenario comparison  │
│ GET /profile │     │ Add 1–N change events│     │ Benefit deltas       │
└──────────────┘     └─────────────────────┘     │ Risk warnings        │
                                                    │ Recommendations      │
                                                    └──────────────────────┘
```

**Steps:**

1. User opens Benefits Simulator (or arrives from Financial Reality CTA)
2. Baseline auto-filled from profile: employment, household, rent, current benefits
3. User adds change event(s): e.g. "Unemployment", "Minijob €450", "Child age 0", "Rent +€150"
4. Execute → module runs baseline + each event as isolated scenario
5. Results: comparison table, highlight best/worst, risk warnings, next actions

### 4.2 Entry paths

| Entry | Behavior |
|-------|----------|
| Home module card | Empty baseline; profile merge if session bound |
| Financial Reality result CTA | Pre-load baseline from last financial execute input (via profile, not cross-module import) |
| Life Event module | Deep-link with event type hint (`?event=job-loss`) |
| Profile-first onboarding | After PATCH profile, suggest simulator if `benefits.receivingBuergergeld` |

### 4.3 Workflow comparison

```
Financial Reality path:
  Profile → Financial Reality → "Take €2,500 job?" → Verdict yes/no → Done

Benefits Simulator path:
  Profile → Simulator → Baseline (employed €2,500)
                      → + Scenario A: Unemployment
                      → + Scenario B: Minijob €450
                      → + Scenario C: Part-time €1,200
                      → Compare all → Recommend Scenario B with warnings
```

---

## 5. Architecture Proposal

### 5.1 Module placement

```
packages/modules/src/benefits-simulator/
  index.ts              # Module registration + execute
  schema.ts             # Zod input/output (or inline in index.ts)
  adapter.ts            # SimulatorInput → FinancialEngineInput[]
  simulator-orchestrator.ts  # Multi-scenario runner (thin)
  benefits-simulator.test.ts
```

**Dependency rule:** Module imports only `@arrivalos/core` and `@arrivalos/shared-services`. No imports from `financial-reality`.

### 5.2 Shared service extension (minimal)

Add to `@arrivalos/shared-services/financial`:

| Addition | Purpose |
|----------|---------|
| `runScenarioGrid(input: SimulatorEngineInput)` | Evaluate baseline + N scenarios; return sorted results |
| `buildHouseholdFromSimulatorInput()` | Map simulator household → `HouseholdInput` |
| `buildEmploymentFromEvent()` | Map event type + params → `Employment` |
| `SimulatorDecisionEngine` (or extend `DecisionEngine`) | Transition-specific warnings |

**Do not** duplicate `calculateBuergergeld`, `payrollEngine`, or `compareScenarios`.

### 5.3 Multi-scenario orchestration

```typescript
// Conceptual flow inside module execute()
const baseline = benefitsEngine.evaluateScenario(baselineScenario, household, params);

const scenarioResults = input.scenarios.map((s) =>
  benefitsEngine.evaluateScenario(
    applyEventToScenario(baselineScenario, s),
    applyEventToHousehold(household, s),
    params
  )
);

const comparisons = scenarioResults.map((r) =>
  compareScenarios(baseline, r)
);

const { warnings, recommendations } = simulatorDecisionEngine.evaluate({
  baseline,
  scenarios: scenarioResults,
  comparisons,
  currentBenefits: household.currentBenefits,
});
```

Each **event** mutates either:

- `employments` (unemployment, part-time, minijob, midijob, full employment)
- `household.members` (add/remove child, partner)
- `housing.coldRent` (rent change)
- `currentBenefits` (start/stop Bürgergeld — informational)

Events are **composable within a scenario** but v1 limits to **one primary event per scenario** to keep UX simple.

### 5.4 Event catalog (v1)

| Event type | Mutates | Example params |
|------------|---------|----------------|
| `unemployment` | Applicant employment → `none` | — |
| `employment` | Applicant employment → `regular` | `grossMonthly`, `taxClass`, `hoursPerWeek?` |
| `part-time-employment` | Applicant employment → `regular` | `grossMonthly`, `hoursPerWeek` (≤ 30) |
| `minijob` | Applicant employment → `minijob` | `grossMonthly` (≤ 556) |
| `midijob` | Applicant employment → `midijob` | `grossMonthly`, `taxClass` |
| `child-added` | Add child member | `age` |
| `child-removed` | Remove child by index | `childIndex` |
| `rent-change` | `housing.coldRent` | `newColdRent` |
| `partner-employment-change` | Partner employment | `employment` object |
| `household-size-change` | Rebuild members | `adults`, `children[]` |

### 5.5 Confidence & disclaimer

Reuse Financial v2 meta pattern:

- `confidence: 'high' | 'medium' | 'low'` — lower if missing Bundesland, child ages defaulted, or ALG I state unknown
- Fixed disclaimer: decision support, not legal advice; Meldepflicht reminder

---

## 6. Module Contract

### 6.1 Registration

```typescript
export const benefitsSimulatorRegistration: ModuleRegistration = {
  id: 'benefits-simulator',
  name: 'Benefits Simulator',
  version: '1.0.0',
  description: 'Model life changes — unemployment, employment types, children, rent — and see benefit impact',
  enabled: true,
  featureFlags: {
    multiScenario: true,
    maxScenarios: 8,
  },
  module: benefitsSimulatorModule,
};
```

### 6.2 Module interface (unchanged platform contract)

```typescript
interface Module<BenefitsSimulatorInput, BenefitsSimulatorOutput> {
  id: 'benefits-simulator';
  inputSchema: ZodSchema;
  outputSchema: ZodSchema;
  execute(input: BenefitsSimulatorInput, context: AppContext): Promise<BenefitsSimulatorOutput>;
}
```

### 6.3 Context usage

| AppContext field | Usage |
|------------------|-------|
| `userProfile.language` | Localize output strings (Phase 2) |
| `systemState.benefits.receivingBuergergeld` | Default `currentBenefits` if not in input |
| `systemState.benefits.daysInGermany` | Admin rule context (informational) |
| `systemState.insurance.hasCoverage` | Future: GKV/PKV impact |
| `profileSlice` | **Not read directly** — use merged input from pipeline |
| `dataProvenance` | Informational in API response only |

---

## 7. Input / Output Schema

### 7.1 Input schema

```typescript
const EmploymentEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('unemployment') }),
  z.object({
    type: z.literal('employment'),
    grossMonthly: z.number().nonnegative(),
    taxClass: TaxClassSchema,
    churchTax: z.boolean().default(false),
    hoursPerWeek: z.number().positive().max(80).optional(),
  }),
  z.object({
    type: z.literal('part-time-employment'),
    grossMonthly: z.number().nonnegative(),
    taxClass: TaxClassSchema,
    churchTax: z.boolean().default(false),
    hoursPerWeek: z.number().positive().max(30),
  }),
  z.object({
    type: z.literal('minijob'),
    grossMonthly: z.number().nonnegative().max(556),
    rvOptIn: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('midijob'),
    grossMonthly: z.number().nonnegative(),
    taxClass: TaxClassSchema,
    churchTax: z.boolean().default(false),
  }),
]);

const HouseholdChangeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('child-added'), age: z.number().int().min(0).max(25) }),
  z.object({ type: z.literal('child-removed'), childIndex: z.number().int().min(0) }),
  z.object({
    type: z.literal('household-composition'),
    maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']),
    children: z.array(z.object({ age: z.number().int().min(0).max(25) })).max(10),
  }),
]);

const HousingEventSchema = z.object({
  type: z.literal('rent-change'),
  newColdRent: z.number().nonnegative(),
  newUtilities: z.number().nonnegative().optional(),
});

const SimulatorEventSchema = z.discriminatedUnion('type', [
  ...EmploymentEventSchema options,
  ...HouseholdChangeEventSchema options,
  HousingEventSchema,
]);

const SimulatorScenarioSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  events: z.array(SimulatorEventSchema).min(1).max(3),
});

const PersonSchema = z.object({
  id: z.string(),
  role: z.enum(['applicant', 'partner', 'child']),
  age: z.number().int().min(0).max(120),
  taxClass: TaxClassSchema.optional(),
  churchTax: z.boolean().optional(),
});

const BenefitsSimulatorInputSchema = z.object({
  // Baseline household (required)
  household: z.object({
    members: z.array(PersonSchema).min(1).max(12),
    housing: z.object({
      coldRent: z.number().nonnegative(),
      utilities: z.number().nonnegative().default(0),
      bundesland: z.string().length(2).default('BE'),
      cityMietstufe: z.number().int().min(1).max(7).optional(),
    }),
    currentBenefits: z.object({
      receivingBuergergeld: z.boolean().optional(),
      receivingAlg1: z.boolean().optional(),
      currentBuergergeldAmount: z.number().nonnegative().optional(),
    }).optional(),
  }),

  // Baseline employment per adult (required)
  baselineEmployments: z.record(z.string(), EmploymentSchema),

  // Change scenarios (1–8)
  scenarios: z.array(SimulatorScenarioSchema).min(1).max(8),

  taxYear: z.number().int().default(2025),
});
```

#### Profile merge defaults (via InputMerger)

When profile is bound, pre-fill:

| Input field | Profile source |
|-------------|----------------|
| `household.members` | Derived from `household.size`, `maritalStatus`, `household.children` |
| `household.housing.coldRent` | `housing.monthlyColdRent` |
| `household.housing.utilities` | `housing.monthlyUtilities` |
| `household.housing.bundesland` | `location.bundesland` |
| `baselineEmployments.applicant` | From `employment` + gross → inferred type |
| `household.currentBenefits` | `benefits.*` |

### 7.2 Output schema

```typescript
const ScenarioSummarySchema = z.object({
  id: z.string(),
  label: z.string(),
  eventsApplied: z.array(z.string()),

  financialImpact: z.object({
    totalGross: z.number(),
    totalNet: z.number(),
    totalHouseholdResources: z.number(),
    deltaFromBaseline: z.number(),
  }),

  benefitChanges: z.object({
    buergergeld: z.object({
      before: z.number(),
      after: z.number(),
      delta: z.number(),
      eligible: z.boolean(),
      breakdown: z.object({
        regelbedarf: z.number(),
        kdu: z.number(),
        freibetragApplied: z.number(),
        kindergeld: z.number(),
      }),
    }),
    kindergeld: z.object({
      before: z.number(),
      after: z.number(),
      delta: z.number(),
    }),
  }),

  effectiveGainFromWork: z.number().nullable(),
  marginalRetentionRate: z.number().nullable(),
});

const RiskWarningSchema = z.object({
  id: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  title: z.string(),
  description: z.string(),
  category: z.enum(['benefits', 'employment', 'housing', 'legal', 'financial']),
  action: z.string().optional(),
  institution: z.string().optional(),
});

const RecommendationSchema = z.object({
  id: z.string(),
  scenarioId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  rationale: z.string(),
});

const BenefitsSimulatorOutputSchema = z.object({
  meta: z.object({
    engineVersion: z.string(),
    taxYear: z.number(),
    ruleSetVersion: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
    disclaimer: z.string(),
    calculatedAt: z.string(),
    scenarioCount: z.number(),
  }),

  baseline: ScenarioSummarySchema,

  scenarios: z.array(ScenarioSummarySchema),

  comparison: z.object({
    bestScenarioId: z.string().nullable(),
    worstScenarioId: z.string().nullable(),
    maxHouseholdResources: z.number(),
    minHouseholdResources: z.number(),
    spread: z.number(),
  }),

  riskWarnings: z.array(RiskWarningSchema),

  recommendations: z.array(RecommendationSchema),

  summary: z.string(),
});
```

### 7.3 Example output (abbreviated)

```json
{
  "meta": {
    "engineVersion": "2.0.0",
    "taxYear": 2025,
    "confidence": "medium",
    "disclaimer": "Decision support only — verify with Jobcenter.",
    "scenarioCount": 2
  },
  "baseline": {
    "id": "baseline",
    "label": "Current situation",
    "financialImpact": { "totalNet": 1800, "totalHouseholdResources": 2100, "deltaFromBaseline": 0 },
    "benefitChanges": { "buergergeld": { "after": 300, "delta": 0 } }
  },
  "scenarios": [
    {
      "id": "minijob-450",
      "label": "Minijob €450",
      "financialImpact": { "totalNet": 450, "totalHouseholdResources": 2280, "deltaFromBaseline": 180 },
      "benefitChanges": { "buergergeld": { "before": 300, "after": 180, "delta": -120 } },
      "effectiveGainFromWork": 180,
      "marginalRetentionRate": 0.4
    }
  ],
  "riskWarnings": [
    {
      "id": "MELDEPFLICHT",
      "severity": "high",
      "title": "Income must be reported to Jobcenter",
      "category": "legal",
      "action": "Report within 2 weeks of first payment"
    }
  ],
  "recommendations": [
    {
      "id": "MINIJOB_VIABLE",
      "scenarioId": "minijob-450",
      "title": "Minijob improves household resources",
      "priority": "high",
      "rationale": "Net household gain €180/month despite Bürgergeld reduction"
    }
  ],
  "summary": "Minijob €450 appears financially beneficial (+€180/month household resources)."
}
```

---

## 8. Integration Strategy

### 8.1 Profile Engine

#### Module profile policy (new)

```typescript
export const BENEFITS_SIMULATOR_POLICY: ModuleProfilePolicy = {
  moduleId: 'benefits-simulator',
  allowedFields: [
    'preferredLanguage',
    'employment',
    'household',
    'housing',
    'location',
    'benefits',
  ],
  sensitiveFields: [
    'employment.grossMonthlyIncome',
    'housing.monthlyColdRent',
    'benefits.currentBuergergeldAmount',
  ],
  allowExtensions: true,
  allowedExtensions: ['benefits-simulator'],
};
```

#### Input merger registration

Add `benefits-simulator` entry to `MODULE_INPUT_CONFIG` in `packages/profile/src/engine/input-merger.ts` mapping profile fields to simulator baseline defaults.

**No changes** to `resolveExecutionContext()` pipeline structure — only registry entries.

### 8.2 API

| Endpoint | Change |
|----------|--------|
| `POST /api/modules/benefits-simulator/execute` | Auto via registry — no API code change |
| `GET /api/modules/benefits-simulator/trace` | Auto — execution trace stored per session |
| `GET /api/profile` | Unchanged — UI reads full profile |
| `GET /api/modules` | Lists new module after registration |

### 8.3 Module registration

1. Create `packages/modules/src/benefits-simulator/index.ts`
2. Add to `allModuleRegistrations` in `packages/modules/src/index.ts`
3. Export schemas for web client typing

### 8.4 Web UI (future — out of scope for engine)

| Component | Purpose |
|-----------|---------|
| `apps/web/src/app/modules/benefits-simulator/page.tsx` | Module page |
| Baseline summary card | Show profile-merged household |
| Event builder | Add scenario events from catalog |
| Scenario comparison table | Render `scenarios[]` + deltas |
| Risk panel | `riskWarnings` with severity styling |

Add module card on home page; link from Financial Reality: *"Explore more scenarios → Benefits Simulator"*

### 8.5 Cross-module coordination (no imports)

| Pattern | Implementation |
|---------|----------------|
| Shared profile | Both modules read same profile via merge |
| Suggested next step | UI-level navigation CTA, not module import |
| Saved scenarios | Profile extension namespace `benefits-simulator.savedScenarios` (optional v1.1) |
| Event bus (future) | `module.completed` event → UI routes to simulator |

### 8.6 Implementation phases

| Phase | Scope | Effort |
|-------|-------|--------|
| **BS-M0** | Shared `runScenarioGrid` + adapter in shared-services | 3–5 days |
| **BS-M1** | Module shell + schemas + tests + registry | 2–3 days |
| **BS-M2** | Profile policy + input merger | 1 day |
| **BS-M3** | Web UI page (basic) | 3–4 days |
| **BS-M4** | Localized output strings | 2 days |
| **BS-M5** | Validation fixtures (10+ scenarios) | 2–3 days |

**Total estimate:** ~2–3 weeks for MVP module (engine + API + basic UI).

### 8.7 Test strategy

| Layer | Tests |
|-------|-------|
| Shared adapter | Employment event → `Employment` type mapping |
| Scenario grid | Baseline + 3 events → deterministic ordering |
| Module execute | Zod round-trip; golden files per event type |
| Profile merge | Session profile → simulator input pre-fill |
| Boundary | Simulator output excludes internal engine types |
| Regression | Minijob/Midijob scenarios match financial v2 comparator |

---

## 9. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| User confusion vs Financial Reality | Medium | Medium | Clear naming, entry CTAs, doc/tooltips |
| Calculation drift between modules | Low | High | Single shared engine; shared test fixtures |
| Over-promising accuracy | Medium | High | Confidence levels + disclaimer; validation audit |
| Complex household input UX | Medium | Medium | Profile pre-fill; progressive disclosure |
| ALG I users get wrong guidance | Medium | High | Flag `receivingAlg1`; show "consult Jobcenter" warning |
| Scope creep (Wohngeld, ALG I calc) | High | Medium | Strict v1 non-goals; extension namespace for v2 |

---

## 10. Decision Summary

| Question | Decision |
|----------|----------|
| New module or extend Financial Reality? | **New module** `benefits-simulator` |
| Share calculation engine? | **Yes** — `@arrivalos/shared-services/financial` |
| Duplicate Bürgergeld/payroll code? | **No** |
| Profile integration? | Policy + input merger; same pattern as financial-reality |
| Trace integration? | Automatic via existing execute pipeline |
| UI profile API changes? | **None** |

---

## 11. Appendix — Module Comparison Matrix

| Feature | financial-reality | benefits-simulator |
|---------|:-----------------:|:------------------:|
| Brutto/Netto breakdown | ✅ Primary | ⚠️ Per scenario |
| Bürgergeld estimate | ✅ | ✅ |
| Single job compare | ✅ | ⚠️ One event type |
| Multi-scenario grid | ❌ | ✅ |
| Unemployment modeling | ⚠️ Via proposedGross=0 | ✅ First-class |
| Minijob/Midijob explicit | ⚠️ Inferred | ✅ User-selected |
| Children with ages | ❌ | ✅ |
| Rent change scenario | ❌ | ✅ |
| Partner employment | ❌ | ✅ |
| Risk warnings | ⚠️ Decisions | ✅ Severity taxonomy |
| Admin rules (Anmeldung) | ✅ | ❌ |
| Profile merge | ✅ | ✅ |
| Execution trace | ✅ | ✅ |

---

## Verdict

The Benefits Simulator fills a **defined product gap** left by Financial Reality: **multi-event benefit transition planning** for migrants navigating unemployment, flexible employment, family, and housing changes.

Architecturally, it fits cleanly into Arrive Atlas as a sixth module that **composes** the existing Financial v2 engine rather than duplicating it. The Profile Engine, policy layer, and trace system require **registry-only** integration — no pipeline changes.

**Recommended next step:** Approve this design, implement BS-M0 (shared scenario grid) and BS-M1 (module shell) behind a feature flag, then validate against the same 24-scenario fixture set used for Financial v2 validation.
