---
id: financial-platform-readiness-audit
title: Financial Platform Readiness Audit
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: finance
status: active
maturity: stable
owner: system
tags:
  - financial-modeling
created: 2026-06-01
updated: 2026-06-19
related:
---

# Financial Platform Production-Readiness Audit

**Date:** June 2026  
**Auditor role:** Principal QA Architect / Financial Systems Auditor  
**Scope:** Profile Engine, Financial Reality, Benefits Simulator, Shared Financial Services, Policy Layer, Input Merge Pipeline, API execution paths  
**Engine version:** Financial v2 `2.0.0` / parameters `2025.1`  
**Status:** Audit only — **no implementation**

**Related prior audits:**  
`docs/audits/financial-v2-validation-report.md` (June 14, 2026),  
`docs/audits/benefits-simulator-m1-1-hardening-report.md`,  
`docs/archive/user-profile-engine/policy-layer-report.md`

---

## Executive Summary

Arrival Atlas has evolved from a prototype financial calculator into a **layered decision platform** with profile merge, policy enforcement, execution traceability, dual financial modules, and **100 automated tests** (78 unique — see §1.3). The **critical Minijob/Midijob routing defect** identified in the June 2026 validation report has been **fixed and regression-protected**. Benefits Simulator adds **12 golden scenario fixtures** with exact-value assertions.

However, **significant simplifications remain** in the benefits and household models (KdU caps, Kindergeld imputation, child ages, self-employed heuristic, default Bundesland). **Decision engine and scenario comparator have zero direct unit tests.** Financial Reality lacks golden fixtures. There is **no API integration test for Benefits Simulator** and **no end-to-end browser tests**.

### Gate verdict

| Stage | Verdict | Rationale |
|-------|:-------:|-----------|
| **Real-world user testing (general population)** | ⚠️ **Conditional** | Safe for guided alpha with disclaimers; not safe as authoritative guidance |
| **Bürgergeld / Minijob / Midijob users** | ⚠️ **Conditional** | Routing fixed; benefit model still simplified — ±€50–€250/month possible |
| **Self-employed users** | ❌ **Not safe** | 0.7× gross heuristic unvalidated |
| **Regular employed (gross ≥ €2,000, StKl I/IV)** | ✅ **Acceptable for alpha** | Payroll within ~3% of public calculators |
| **Benefits Simulator scenario exploration** | ⚠️ **Conditional** | Same engine assumptions; golden fixtures protect orchestration |

**Overall recommendation:** Proceed to **limited, supervised MVP user testing** only after completing **P0 items** in §6. Do not market outputs as Jobcenter/Finanzamt-grade advice.

---

## 1. Test Coverage Audit

### 1.1 Test inventory by package

| Package | Test files | Tests (reported) | Unique tests (est.) | Financial relevance |
|---------|------------|------------------:|----------------------:|---------------------|
| `@arrival-atlas/shared-services` | 4 | 31 | 31 | **Core** — payroll, benefits, routing, simulator |
| `@arrival-atlas/modules` | 3 | 22 | 22 | Financial Reality + Benefits Simulator |
| `@arrival-atlas/profile` | 12 | 44 | **~22** | Merge, policy, trace, resolve pipeline |
| `@arrival-atlas/api` | 2 | 3 | 3 | Profile + financial execute (1 path) |
| **Total** | **21** | **100** | **~78** | |

> **Finding F-01 (P2):** Profile package contains duplicate test directories (`engine 2/`, `policy 2/`, `trace 2/`) mirroring primary tests. Inflates count without adding coverage. Remove duplicates.

### 1.2 Component-level coverage matrix

| Component | Unit tests | Integration tests | Golden fixtures | API tests | E2E |
|-----------|:----------:|:---------------:|:---------------:|:---------:|:---:|
| **PayrollEngine** | ✅ 6 | — | ✅ 4 payroll JSON | — | — |
| **LohnsteuerrechnerAdapter** | ✅ 2 | — | ✅ 1 bound | — | — |
| **Bürgergeld calculator** | ✅ 2 | — | ⚠️ 4 wide-bound | — | — |
| **Regelbedarf** | ✅ 1 | — | — | — | — |
| **Freibeträge §11b** | ✅ 1 | — | ✅ 1 bound | — | — |
| **Legacy employment routing** | ✅ 8 | — | — | — | — |
| **FinancialPipeline** | ⚠️ via adapter | — | — | — | — |
| **BenefitsEngine** | ⚠️ indirect | — | — | — | — |
| **compareScenarios** | ❌ | — | — | — | — |
| **DecisionEngine** | ❌ | — | — | — | — |
| **Financial Reality module** | ✅ 6 | — | ❌ | ⚠️ 1 smoke | — |
| **Benefits Simulator module** | ✅ 3 | — | ✅ 12 exact | ❌ | — |
| **Event transform (simulator)** | ✅ 4 | — | — | — | — |
| **Scenario grid** | ✅ 2 | — | — | — | — |
| **Input merger (financial)** | ✅ 4 | — | — | — | — |
| **Input merger (benefits-sim)** | ❌ | — | — | — | — |
| **resolveExecutionContext** | ✅ 4 | ✅ 1 | — | — | — |
| **Policy layer** | ✅ 6 | — | — | — | — |
| **Trace collector** | ✅ 3 | — | — | — | — |
| **API execute path** | — | ✅ 1 | — | partial | — |

### 1.3 Shared-services financial engine (`packages/shared-services/src/financial/`)

**Files tested:**

| File / subsystem | Tests | Depth |
|------------------|-------|-------|
| `payroll/payroll-engine.ts` | `financial.test.ts` | Minijob, Midijob, regular, classification boundaries |
| `payroll/tax-adapter.ts` | `financial.test.ts` | StKl I €2,500 range check |
| `payroll/employment-classification.ts` | `legacy-employment-routing.test.ts` | Full routing regression suite |
| `benefits/buergergeld/income-imputation.ts` | `financial.test.ts` | §11b tiers €800 |
| `benefits/buergergeld/regelbedarf.ts` | `financial.test.ts` | Married + child total range |
| `benefits/benefits-engine.ts` | indirect via pipeline | No isolated tests |
| `benefits/buergergeld/calculator.ts` | indirect | No isolated KdU cap tests |
| `scenarios/comparator.ts` | **none** | **Gap** |
| `decisions/decision-engine.ts` | **none** | **Gap** |
| `pipeline/financial-pipeline.ts` | via S20 regression | Single comparison path |
| `simulator/event-transform.ts` | 4 tests | Immutability + event types |
| `simulator/scenario-grid.ts` | 2 tests | Multi-scenario grid |
| `simulator/analysis.ts` | **none** | Warnings/recommendations untested |
| `household/index.ts` | indirect | No child-age edge tests |
| `adapters/v1-adapter.ts` | partial | Shape + compare mode |

**Fixture files:**

| Fixture | Entries | Used in tests | Tolerance |
|---------|--------:|:-------------:|-----------|
| `__fixtures__/payroll-2025.json` | 4 | 2 | Min/max ranges |
| `__fixtures__/buergergeld-2025.json` | 4 | 1–2 | **Wide bounds** (e.g. BG €1,200–€1,400) |
| `tests/fixtures/benefits-simulator-scenarios.json` | 12 | 13 | **Exact values** |

### 1.4 Financial Reality module

| Test | Coverage |
|------|----------|
| Legacy → v2 adapter mapping | Input shape, tax year |
| v2 → legacy output shape | Schema fields present |
| `proposedGrossIncome` compare | Midijob S20 path, positive gain |
| v2 execute with flag on | `meta.engineVersion`, net > 0 |
| v1 execute with flag off | Legacy path smoke |
| Output schema parse | Zod round-trip |

**Gaps:** No golden net/BG values. No tests for married, children, church tax, self-employed, or Bürgergeld recipient flows at module boundary.

### 1.5 Benefits Simulator module

| Test | Coverage |
|------|----------|
| Output contract | meta, baseline, scenarios, warnings |
| Financial-reality parity | Minijob €450 unemployed baseline |
| Immutable grid | Event transform isolation |
| Golden scenarios (×12) | Exact `totalHouseholdResources`, Bürgergeld delta, ordering, warnings |
| Determinism | Repeated run identity |

**Gaps:** No profile-merge integration test. No API-level execute test.

### 1.6 Profile merge pipeline

| Test | Coverage |
|------|----------|
| `mergeModuleInput` financial-reality | input > override > profile > default |
| `resolveExecutionContext` | Profile load, merge, policy redaction, trace |
| `profile.integration.test.ts` | End-to-end profile → financial merge |
| `benefits-simulator-input-merge.ts` | **No dedicated tests** |

**Gap F-02 (P1):** Benefits Simulator profile pre-fill from `mergeBenefitsSimulatorInputFromProfile()` is untested. Risk of silent wrong household/employment inference.

### 1.7 API execution paths

| Path | Tested | Assertions |
|------|:------:|------------|
| `POST /api/modules/financial-reality/execute` + profile | ✅ | gross 2500, net > 1700, override 3000 |
| `GET /api/modules/financial-reality/trace` | ✅ | MERGE_DECISION steps |
| `POST /api/modules/benefits-simulator/execute` | ❌ | — |
| `GET /api/profile` UI contract | ✅ | Boundary keys |
| Policy on execute | indirect | Trace steps only |
| Error paths (422, 428) | partial | PATCH 428 only |

---

## 2. Financial Risk Areas

### 2.1 Status of June 2026 critical defect (A9)

**Original issue:** `resolveEmploymentsForLegacyInput()` forced `type: 'regular'` for all gross incomes.

**Current state:** **FIXED.** `buildApplicantEmploymentFromGross()` classifies Minijob/Midijob/regular. Protected by:

- `legacy-employment-routing.test.ts` — 8 routing tests
- S07–S11 payroll outcome tests
- S20 decision safety regression (verdict must be positive for €1,200 Midijob)

**Residual risk:** Classification is **inferred from gross only** — user cannot explicitly declare employment type on Financial Reality flat form. Benefits Simulator allows explicit `minijob`/`midijob` events (lower risk).

### 2.2 Remaining calculation risks

| ID | Risk | Severity | Affected users | Test protection |
|----|------|----------|----------------|---------------|
| R-01 | **KdU simplified caps** — rent above cap silently truncated | High | High-rent cities | None |
| R-02 | **Kindergeld fully counted** as anrechenbares Einkommen | Medium | Parents on Bürgergeld | None |
| R-03 | **Children default age 8** in legacy household builder | Medium | All child households | None |
| R-04 | **Self-employed net = gross × 0.7** | Critical | Self-employed | None; UI allows input |
| R-05 | **Default Bundesland BE**, utilities €0 | Medium | Non-Berlin users | None |
| R-06 | **Church tax 9% flat** (not 8% BY/BW) | Low–Med | Bavaria/BW | None |
| R-07 | **StKl II missing Entlastungsbetrag** | Medium | Single parents | None |
| R-08 | **Partner StKl V fixed**, non-earning | Medium | Dual-income couples | Partial (S09/S10 golden) |
| R-09 | **Decision verdict sensitivity** near zero gain | High | Marginal employment | S20 only |
| R-10 | **v1 engine path** when `advancedTaxScenarios: false` | Medium | Legacy fallback | Smoke only |
| R-11 | **Profile → household inference** for benefits-sim | Medium | Profile-first users | None |
| R-12 | **Wide-bound BG fixtures** mask regressions | Medium | All BG users | Masks R-01/R-02 |

### 2.3 Scenario comparison risks

| Risk | Description | Protected? |
|------|-------------|:----------:|
| Verdict flip near threshold | ±€10 gain changes `isJobFinanciallyBeneficial` | S20 only |
| `effectiveGainFromWork` sign errors | Comparator uses `deltaTotalResources` | Parity test (1 scenario) |
| Multi-scenario best/worst | Benefits Simulator `comparisonSummary` | 12 golden |
| Benefit cliff false negative | Employment reduces BG but net household up | S02 golden (partial) |
| Bürgergeld exit not modeled | Income rise → eligibility lost entirely | **Not tested** |

### 2.4 Profile merge risks

| Risk | Scenario | Protected? |
|------|----------|:----------:|
| Wrong precedence | Override should beat profile | ✅ |
| Missing profile fields | Defaults to employed, gross 0 | ✅ |
| Policy redaction vs merge | Income in merge but redacted in slice | ✅ |
| Sensitive field leak to slice | grossMonthlyIncome hidden | ✅ |
| Benefits-sim household build | Children ages from profile | ❌ |
| Employment type inference on merge | Minijob from €450 gross | ❌ |
| Session without profile | Empty simulator scenarios array | ❌ |

### 2.5 Silent regression vectors

| Vector | Likelihood | Impact |
|--------|------------|--------|
| Parameter file change (`2025.ts`) | Medium | All calculations shift |
| Comparator formula change | Medium | Verdict flips |
| Decision engine threshold (`gain > 10`) | Low | Borderline users |
| Event transform mutation bug | Low | Fixed by immutability tests |
| Duplicate test dirs mask missing new tests | Medium | False confidence |
| No CI gate on golden fixtures | High | Undetected drift |

---

## 3. Golden Fixture Coverage Evaluation

### 3.1 Benefits Simulator golden scenarios (12) — protected ✅

| Fixture ID | Real-life scenario | Key assertions |
|------------|-------------------|----------------|
| S01 | Employed → unemployment (Bürgergeld rise) | BG delta +1363, resources drop |
| S02 | Unemployed → Minijob €450 | BG −280, net gain +170, warnings |
| S03 | Unemployed → Midijob €800 | BG −588, gain +79.74 |
| S04 | Full-time → part-time €1,200 | BG +395, resources drop |
| S05 | Child addition (employed) | No resource change (employed covers need) |
| S06 | Child removal (on Bürgergeld) | BG −165 |
| S07 | Rent increase €800→€1000 | BG +25 |
| S08 | Rent decrease €1000→€800 | BG −25 |
| S09 | Partner job loss | Resources −1185 |
| S10 | Partner job gain | Resources +1276, legal warning |
| S11 | Dual unemployment | BG +2012 |
| S12 | Dual Minijob optimization | Two scenarios, same outcome |

### 3.2 Scenario coverage map vs user personas

| Persona / scenario | Benefits Simulator golden | Financial Reality golden | Shared fixtures |
|--------------------|:-------------------------:|:------------------------:|:---------------:|
| Single unemployed | ✅ S01 (inverse), S02, S03 | ⚠️ indirect S12 | ✅ wide bound |
| Single employed regular | ✅ S01 baseline | ⚠️ stkl1-2500 range | ✅ |
| Single parent | ❌ | ❌ S06 StKl II N/A | ❌ |
| Married couple | ✅ S09, S10, S11, S12 | ❌ | ⚠️ couple fixture |
| Married + children | ❌ explicit | ❌ | ⚠️ HH=3 |
| Minijob transition | ✅ S02 | ✅ S07 routing | ✅ minijob-450 |
| Midijob transition | ✅ S03 | ✅ S09–S11 routing | ✅ midijob-1000 |
| Part-time change | ✅ S04 | ❌ | ❌ |
| Partner employment change | ✅ S09, S10 | ❌ | ❌ |
| Rent increase | ✅ S07 | ❌ | ❌ |
| Rent decrease | ✅ S08 | ❌ | ❌ |
| Bürgergeld exit (income ends eligibility) | ❌ | ❌ | ❌ |
| Benefit cliff (work not worth it) | ⚠️ partial S04 | ❌ | ❌ |
| Self-employed | ❌ | ❌ | ❌ |
| StKl II / church tax | ❌ | ❌ | ❌ |
| ALG I recipient | ❌ | ❌ | ❌ |
| Wohngeld crossover | ❌ | ❌ | ❌ |
| Bundesland ≠ BE | ❌ | ❌ | ❌ |
| Child age bands (0–5, 14–17) | ❌ | ❌ | ❌ |

**Coverage score:** ~55% of critical German benefit scenarios have golden protection (up from ~15% pre-Simulator M1.1).

### 3.3 June 2026 validation scenarios (S01–S24) — automation status

| Scenario band | Manual validation (June) | Now automated |
|---------------|:------------------------:|:-------------:|
| S01–S06 Single/married employed | ✅ documented | ⚠️ partial (ranges only) |
| S07–S11 Minijob/Midijob | ✅ documented | ✅ routing + payroll tests |
| S12–S16 Bürgergeld recipient | ✅ documented | ⚠️ wide bounds only |
| S17–S18 Married + children BG | ✅ documented | ❌ |
| S19 Self-employed | ✅ documented | ❌ |
| S20–S24 Compare verdicts | ✅ documented | ✅ S20 regression; S23/S24 partial |

**Finding F-03 (P1):** The 24-scenario validation matrix from June 2026 is **not fully encoded** as automated golden fixtures for Financial Reality.

---

## 4. Testing Maturity Assessment

Ratings: **1** = ad hoc · **2** = developing · **3** = adequate · **4** = strong · **5** = production-grade

| Dimension | Rating | Evidence |
|-----------|:------:|----------|
| **Unit testing** | **3** | Payroll, routing, Freibeträge, event transforms well covered; decision/comparator gaps |
| **Integration testing** | **2** | Profile→financial path; no benefits-sim API; no full pipeline golden for Financial Reality |
| **Financial regression protection** | **3** | Minijob fix locked; 12 simulator goldens; wide bounds elsewhere |
| **Module-level testing** | **3** | Both modules have contract tests; Financial Reality lacks value assertions |
| **API testing** | **2** | One happy-path financial execute; no error matrix; no benefits-sim |
| **End-to-end testing** | **1** | No Playwright/Cypress; no browser-level flows |

### Maturity summary

```
Unit          ████████░░  3/5
Integration   █████░░░░░  2/5
Regression    ███████░░░  3/5
Module        ███████░░░  3/5
API           █████░░░░░  2/5
E2E           ██░░░░░░░░  1/5
─────────────────────────────
Overall       ██████░░░░  2.3/5
```

**Not yet production-grade** for unsupervised real-world financial guidance. **Adequate for supervised alpha** with P0 mitigations.

---

## 5. Assumption Register (current)

| # | Assumption | Status since June audit | User-testing impact |
|---|------------|-------------------------|---------------------|
| A1 | Partner StKl V, non-earning | Unchanged | Medium |
| A2 | Children age 8 default | Unchanged | Medium |
| A3 | Bundesland BE default | Unchanged | Medium |
| A4 | Self-employed × 0.7 | Unchanged | **Critical** |
| A5 | KdU caps, silent truncate | Unchanged | High |
| A6 | Church tax 9% flat | Unchanged | Low–Med |
| A7 | KV Zusatzbeitrag 1.7% | Acceptable | Low |
| A8 | Kindergeld full imputation | Unchanged | Medium |
| A9 | Minijob/Midijob routing | **✅ Fixed** | Was critical |
| A10 | Partner never employed (legacy) | Partial — Simulator S09/S10 | Medium |
| A11 | StKl II Entlastungsbetrag missing | Unchanged | Medium |
| A12 | Freibeträge on gross | Correct per §11b | OK |

---

## 6. Prioritized Roadmap

### P0 — Must fix before MVP user testing

| ID | Item | Risk addressed | Effort |
|----|------|----------------|--------|
| P0-1 | **Mandatory disclaimer** in all financial module outputs + UI banner | Legal/reputational | 0.5 day |
| P0-2 | **Block or hard-warn self-employed** path (R-04) | Critical misguidance | 0.5 day |
| P0-3 | **Surface KdU cap applied** in output when rent > cap (R-01) | User trust | 1 day |
| P0-4 | **Encode June S01–S24 matrix** as `financial-reality-golden-scenarios.json` with exact net/BG for key scenarios | Silent regression | 2–3 days |
| P0-5 | **Add `compareScenarios` + `decisionEngine` unit tests** including verdict boundary (±€10) | Verdict flips | 1–2 days |
| P0-6 | **API integration test** for `benefits-simulator/execute` with profile merge | Pipeline gap | 1 day |
| P0-7 | **Test `benefits-simulator-input-merge.ts`** — children, employment inference, empty scenarios | Profile merge R-11 | 1 day |
| P0-8 | **Remove duplicate profile test dirs** (`engine 2/`, etc.) | False confidence F-01 | 0.5 day |
| P0-9 | **Document excluded user cohorts** in UI (self-employed, ALG I, Wohngeld) | Scope clarity | 0.5 day |

### P1 — Should fix before public beta

| ID | Item | Risk addressed | Effort |
|----|------|----------------|--------|
| P1-1 | Narrow Bürgergeld fixture bounds to ±€30 | R-12 | 1 day |
| P1-2 | Child age input in profile + household builder | R-03 | 2–3 days |
| P1-3 | Bundesland selector in profile | R-05, R-06 | 1–2 days |
| P1-4 | Bürgergeld exit + benefit cliff golden scenarios | Missing coverage | 2 days |
| P1-5 | Single parent (StKl II) golden scenario | R-07 | 1–2 days |
| P1-6 | `simulator/analysis.ts` tests for warning taxonomy | Warning regressions | 1 day |
| P1-7 | Financial Reality API test matrix (422, unemployed, compare) | API gaps | 1–2 days |
| P1-8 | CI gate: golden fixtures must pass on every PR | Process | 0.5 day |
| P1-9 | Revisit Kindergeld imputation (A8) with documented simplification flag | BG accuracy | 3–5 days |

### P2 — Future improvements

| ID | Item |
|----|------|
| P2-1 | BMF Lohnsteuer oracle integration tests |
| P2-2 | Full Mietstufen KdU tables |
| P2-3 | Wohngeld module or cross-link |
| P2-4 | ALG I duration and transition modeling |
| P2-5 | Partner income + StKl optimization |
| P2-6 | Playwright E2E: profile → simulate → results |
| P2-7 | Property-based tests for event transform composition |
| P2-8 | System Understanding Engine bridge (explain warnings) |

---

## 7. Minimum Testing Baseline Before Real Users

The following **must be true** before exposing the platform to real migrants (even supervised beta):

### 7.1 Automated test gates (CI)

| Gate | Threshold |
|------|-----------|
| All existing tests pass | 100% (no duplicates counted twice after P0-8) |
| Golden fixtures pass | 12 Benefits Simulator + ≥12 Financial Reality (new P0-4) |
| No untested financial subsystems | comparator + decisionEngine covered (P0-5) |
| API smoke | financial-reality + benefits-simulator execute with profile |

### 7.2 Scenario oracle minimum (24 + 6)

**From existing June matrix (must automate):** S01, S07, S08, S12, S14, S20, S23, S24  
**From Benefits Simulator goldens (done):** S02, S03, S07–S12  
**Additional required before beta:**

| # | Scenario | Why |
|---|----------|-----|
| G-25 | Bürgergeld exit — employed €2,500, BG → 0 | Eligibility loss |
| G-26 | Benefit cliff — unemployed → €200 Minijob, net household down | False work incentive |
| G-27 | Single parent StKl II €2,200 | Tax accuracy |
| G-28 | Rent €1,200 with KdU cap surfaced | Cap transparency |
| G-29 | Profile-merge → financial execute API | Full pipeline |
| G-30 | Profile-merge → benefits-sim execute API | Full pipeline |

### 7.3 Product safety minimum

| Requirement | Status |
|-------------|--------|
| Disclaimer on every financial output | ⚠️ Partial (meta.disclaimer exists; UI enforcement needed) |
| Confidence level displayed | ✅ meta.confidence |
| Self-employed blocked or flagged | ❌ Required P0-2 |
| KdU cap visible when applied | ❌ Required P0-3 |
| Excluded cohorts documented in UI | ❌ Required P0-9 |
| Supervised testing protocol | ❌ Organizational — not technical |

### 7.4 Accuracy targets (supervised alpha)

| Metric | Target | Current (est.) |
|--------|--------|----------------|
| Regular payroll net deviation | ≤ 3% vs public calculator | ~0.6–2.9% ✅ |
| Minijob net | = gross (no RV) | ✅ exact |
| Midijob net | ≤ €35 vs engine oracle | ✅ within range |
| Bürgergeld top-up | ≤ €100 vs simplified model | ⚠️ unverified band |
| Verdict correctness (compare) | No false negatives on S20-class | ✅ regression |
| Scenario grid determinism | 100% repeatability | ✅ tested |

---

## 8. Engine Confidence Scores (updated)

| Engine | June 2026 | Current | Δ | Notes |
|--------|----------:|--------:|:-:|-------|
| PayrollEngine (core) | 62 | **72** | +10 | Routing fixed |
| PayrollEngine (UI/legacy path) | 38 | **68** | +30 | A9 resolved |
| BenefitsEngine | 52 | **58** | +6 | Same simplifications |
| Comparator | 48 | **52** | +4 | S20 only; still under-tested |
| DecisionEngine | 42 | **48** | +6 | Threshold untested |
| Benefits Simulator orchestration | — | **75** | new | 12 goldens |
| Profile merge (financial) | — | **70** | new | 4 merger tests + integration |
| Profile merge (benefits-sim) | — | **40** | new | **Untested** |

---

## 9. Architecture Strengths (ready for alpha)

| Strength | Benefit |
|----------|---------|
| Single financial engine shared by both modules | No calculation drift between modules |
| Minijob/Midijob regression suite | Critical path protected |
| Policy + trace + merge pipeline | Auditable, explainable execution |
| Benefits Simulator golden fixtures | Exact-value regression for life transitions |
| Module contract validation (Zod) | API shape safety |
| Immutable event transforms | Deterministic multi-scenario |

---

## 10. Conclusion

The Arrival Atlas financial platform has **crossed a critical threshold**: the Minijob/Midijob routing defect that blocked user testing in June 2026 is **fixed and regression-locked**, and Benefits Simulator adds **production-quality golden scenario protection** for life-transition modeling.

The platform is **not yet safe for unsupervised, authoritative financial guidance** due to:

1. Unvalidated self-employed path  
2. Silent KdU cap truncation  
3. Simplified Bürgergeld model (Kindergeld, child ages, regional variation)  
4. Missing automated coverage for decision engine, comparator, and Financial Reality golden values  
5. No benefits-simulator API or profile-merge tests  
6. No end-to-end user journey tests  

### Final gate recommendation

| Cohort | Proceed? | Conditions |
|--------|:--------:|------------|
| Internal team + advisors | ✅ Yes | Document assumptions |
| Supervised migrant alpha (10–20 users) | ⚠️ After P0 | Disclaimers, cohort exclusions, feedback protocol |
| Public beta | ❌ After P0 + P1 | Narrow fixtures, KdU transparency, child ages |
| Unsupervised production | ❌ | P2 + external audit |

**Complete P0 items (est. 8–10 engineering days), then re-run golden suite and update this audit before opening supervised MVP testing.**

---

## Appendix A — Test file reference

| Path | Tests |
|------|------:|
| `packages/shared-services/src/financial/financial.test.ts` | 10 |
| `packages/shared-services/src/financial/legacy-employment-routing.test.ts` | 15 |
| `packages/shared-services/src/financial/simulator/event-transform.test.ts` | 4 |
| `packages/shared-services/src/financial/simulator/scenario-grid.test.ts` | 2 |
| `packages/modules/src/financial-reality/financial-reality.test.ts` | 6 |
| `packages/modules/src/benefits-simulator/benefits-simulator.test.ts` | 3 |
| `packages/modules/src/benefits-simulator/golden-scenarios.test.ts` | 13 |
| `packages/profile/src/engine/input-merger.test.ts` | 4 |
| `packages/profile/src/engine/resolve-execution-context.test.ts` | 4 |
| `packages/profile/src/profile.integration.test.ts` | 1 |
| `apps/api/src/profile.integration.test.ts` | 1 |

## Appendix B — Suggested `financial-reality-golden-scenarios.json` structure

```json
{
  "version": "1.0.0",
  "taxYear": 2025,
  "fixtures": [
    {
      "id": "FR-S01-stkl1-2500",
      "input": { "grossIncome": 2500, "taxClass": 1, "..." },
      "expect": {
        "net": 1787.59,
        "buergergeld": 0,
        "verdict": null
      }
    }
  ]
}
```

Encode net/BG to 2 decimal places; run via `financialRealityModule.execute()` in CI.

---

## Appendix C — References

- `docs/audits/financial-v2-validation-report.md` — June 2026 pre-M2 gate (A9 blocker since resolved)
- `docs/audits/benefits-simulator-m1-1-hardening-report.md` — 12 golden scenarios
- `tests/fixtures/benefits-simulator-scenarios.json` — exact-value fixtures
- `packages/shared-services/src/financial/__fixtures__/` — wide-bound payroll/Bürgergeld fixtures
