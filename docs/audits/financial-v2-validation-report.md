# Financial Reality Module v2 — Validation Report

**Date:** 14 June 2026  
**Auditor role:** Financial Systems Auditor (pre-M2 gate)  
**Engine version:** `2.0.0` / parameters `2025.1`  
**Validation path:** Legacy v1 UI adapter (`advancedTaxScenarios: true`, default) — this is what real users hit today  
**Methodology:** Code review, 24 structured scenarios, programmatic output capture, comparison against public brutto-netto calculators and documented 2025 statutory values (Regelbedarf, §11b SGB II, Minijob/Midijob thresholds)

---

## Executive Summary

Financial Reality v2 is a **material improvement** over v1 for regular employment payroll (BMF PAP Lohnsteuer, capped social contributions). However, **the production UI path does not route Minijob/Midijob income through the correct payroll branch**, causing net salary errors of **€92–€114/month (~20%)** in the €450–€556 range and meaningful errors up to €1,000 gross. This directly affects Bürgergeld top-up calculations and can **flip employment verdicts** (e.g. a €1,200 job shown as financially harmful when it is marginally beneficial under Midijob rules).

**Conservative recommendation: NOT YET SAFE for real user testing** on the current UI/adapter path. Limited internal testing may proceed only for **regular employed scenarios above the Midijob ceiling (≈€2,000 gross)** with explicit disclaimers. Do **not** open beta to Bürgergeld recipients, Minijob/Midijob workers, or self-employed users until blockers below are resolved.

| Engine | Confidence (0–100) | User-testing readiness |
|--------|-------------------:|--------------------------|
| PayrollEngine (core) | 62 | Conditional |
| PayrollEngine (via legacy UI) | 38 | **Not safe** |
| BenefitsEngine | 52 | **Not safe** |
| Comparator | 48 | **Not safe** |
| DecisionEngine | 42 | **Not safe** |

---

## 1. Assumption Review

All assumptions below apply to the **legacy adapter path** (`buildHouseholdFromLegacy` + `resolveEmploymentsForLegacyInput`), which is the only path exposed in the v1 UI today.

| # | Assumption | Location | Classification | Rationale |
|---|------------|----------|:--------------:|-----------|
| A1 | **Partner always Steuerklasse V**, age 30, no church tax | `household/index.ts` | **Risky** | Acceptable when only the applicant earns (current UI). Wrong if partner also has income; StKl III/V pairing affects withholding materially. No UI to correct. |
| A2 | **All children age = 8** (Regelbedarf Stufe 5, €390) | `household/index.ts` | **Risky** | Age 0–5 → €357; 14–17 → €471. Error up to €33/child/month on Regelbedarf. No age input in UI. |
| A3 | **Default Bundesland `BE`**, utilities = €0 | `household/index.ts` | **Risky** | KdU caps and church tax vary by state. Berlin default is a reasonable MVP placeholder but not valid for BY/BW church tax (8%) or high/low rent regions. |
| A4 | **Self-employed net = gross × 0.7** | `benefits-engine.ts` | **Unacceptable** | Real net depends on EÜR, USt, business costs, health insurance class. 0.7 is an unvalidated heuristic; can misstate income by hundreds of euros. |
| A5 | **KdU caps:** single €750, couple €950 + €150/child | `parameters/2025.ts`, `kdu.ts` | **Risky** | Documented simplification per M1 plan. Real angemessene Miete varies by Mietstufe, household size, and Heizkosten. Utilities hard-coded to €0 understates need. Rent above cap is silently truncated — user may believe full rent is covered. |
| A6 | **Church tax flat 9%** of Lohnsteuer | `parameters/2025.ts` | **Risky** | Correct for most states; **8% in Bayern and Baden-Württemberg**. No `state` input on UI despite engine support. |
| A7 | **KV Zusatzbeitrag 1.7%** (average) | `parameters/2025.ts` | **Acceptable** | Statutory average for 2025; individual Krankenkasse rates differ ±0.5 pp. Explains ~€10–€50 net deviation vs some public calculators. |
| A8 | **Kindergeld fully counted as anrechenbares Einkommen** | `buergergeld/calculator.ts` | **Risky** | Simplification. Jobcenter applies Kindergeld with child-specific rules; full deduction can under- or over-state BG for households with children by €50–€250/month. |
| A9 | **All employment typed `regular`** regardless of gross | `benefits-engine.ts` | **Unacceptable** | Minijob (≤€556) and Midijob (€556.01–€2,000) branches exist in `PayrollEngine.inferAndCalculate()` but are **never invoked** from the legacy adapter. Critical production bug. |
| A10 | **Partner never employed** | `resolveEmploymentsForLegacyInput` | **Risky** | Married households model partner as non-earning. Acceptable for MVP UI; wrong for dual-income couples. |
| A11 | **No Kinderfreibeträge in Lohnsteuer** | tax adapter | **Risky** | StKl II under-estimates net for single parents vs calculators that apply Entlastungsbetrag/Kinderfreibeträge (see S06, −7.3% vs StKl II benchmark at different gross). |
| A12 | **Bürgergeld uses gross employment for Freibeträge**, not net | `calculator.ts` | **Acceptable** | Aligns with §11b SGB II (Freibeträge on Brutto). |

---

## 2. Critical Defect: Minijob/Midijob Not Applied on UI Path

`resolveEmploymentsForLegacyInput()` always sets `type: 'regular'` for employed/part-time inputs:

```110:115:packages/shared-services/src/financial/benefits/benefits-engine.ts
  employments.applicant = {
    type: 'regular',
    grossMonthly: grossIncome,
    taxClass,
    churchTax,
  };
```

`PayrollEngine.inferAndCalculate()` correctly classifies by gross but is **not called** from the adapter. Impact:

| Gross | Legacy net (wrong) | Correct net | Δ net | Δ % |
|------:|-------------------:|------------:|------:|----:|
| €450 | €357.97 | €450.00 | −€92.03 | −20.5% |
| €556 | €442.30 | €556.00 | −€113.70 | −20.4% |
| €600 | €477.30 | €486.30 | −€9.00 | −1.9% |
| €800 | €636.40 | €667.74 | −€31.34 | −4.7% |
| €1,000 | €795.50 | €821.62 | −€26.12 | −3.2% |
| €1,200 | €954.60 | €975.49 | −€20.89 | −2.1% |

**Decision impact:** Scenario S20 (unemployed → €1,200 job) reports **−€13.40/month gain** and `isJobFinanciallyBeneficial: false`. With correct Midijob payroll, total household resources rise to **+€7.49/month** — verdict **flips**. Users may decline work based on a false negative.

---

## 3. Validation Scenarios (n = 24)

Scenarios executed via `runLegacyPipeline()` (production path). Benchmarks from public 2025 brutto-netto calculators (netto-brutto-rechner.net, FinanzHelfer, rechner-brutto-netto.de) where noted. Bürgergeld benchmarks cross-checked against 2025 Regelbedarf tables (Bundesregierung / SGB II) and §11b Freibetrag structure.

**Legend — deviation risk:**
- 🟢 Low: |Δ| ≤ 3% or ≤ €30 — unlikely to change user decisions
- 🟡 Medium: 3–8% or €30–€100 — may affect marginal decisions
- 🔴 High: > 8% or > €100 — likely to change decisions
- ⚫ Critical: wrong employment class or verdict flip

### 3.1 Single employed

| ID | Scenario | Engine net | Benchmark net | Δ net | BG | Risk |
|----|----------|----------:|-------------:|------:|---:|:----:|
| S01 | StKl I €2,500 | €1,787.59 | €1,777 | +€10.59 (+0.6%) | €0 | 🟢 |
| S02 | StKl I €2,500 + church | €1,769.49 | ~€1,720 | +€49.49 (+2.9%) | €0 | 🟡 |
| S03 | StKl VI €800 (Nebenjob) | €548.32 | — | Midijob path: €579.66 | €575 | 🟡 |
| S19 | Self-employed €3,000 (×0.7) | €2,100.00 | — | No valid benchmark | €0 | ⚫ |

**S01 notes:** PAP Lohnsteuer is sound. Residual +€10.59 net vs netto-brutto-rechner.net likely due to KV Zusatzbeitrag assumption (1.7%) and missing PV Kinderloszuschlag toggle.

**S06 (single parent, see §3.3):** StKl II €2,200 → net €1,695 vs FinanzHelfer StKl II at €2,500 benchmark €1,829 — not directly comparable gross; at comparable income, engine likely **understates** net due to missing Entlastungsbetrag (A11).

### 3.2 Married employed

| ID | Scenario | Engine net | BG top-up | Total resources | Risk |
|----|----------|----------:|----------:|----------------:|:----:|
| S04 | StKl III €3,500, HH=2 | €2,655.59 | €0 | €2,655.59 | 🟢 payroll |
| S05 | StKl IV €2,800, HH=2 | €1,961.90 | €0 | €1,961.90 | 🟢 payroll |
| S18 | StKl V €1,800, HH=2 | €1,185.24 | €394 | €1,579.24 | 🟡 |
| S17 | StKl III €2,500, HH=4 (2 children) | €1,988.75 | €274 | €2,262.75 | 🟡 BG |

Partner modeled as StKl V, non-earning (A1, A10). Payroll for applicant StKl III/V via PAP is reasonable; BG top-up for S18/S17 sensitive to Kindergeld counting (A8).

### 3.3 Single parent

| ID | Scenario | Engine net | BG | Total | Risk |
|----|----------|------:|---:|------:|:----:|
| S06 | StKl II €2,200, HH=2 | €1,695.02 | €0 | €1,695.02 | 🟡 |
| S22 | Unemployed, HH=2, rent €900 | €0 | €1,603 | €1,603 | 🟡 |

**S22 breakdown:** Regelbedarf €953 (563+390) + KdU €900 (capped) − Kindergeld €250 = **€1,603**. Plausible vs simplified Jobcenter logic; real case may differ ±€100 on KdU/Kindergeld treatment.

### 3.4 Minijob

| ID | Scenario | Legacy net | Correct net | BG | Total (legacy) | Risk |
|----|----------|----------:|------------:|---:|---------------:|:----:|
| S07 | €450 employed | €357.97 | **€450.00** | €983 | €1,340.97 | ⚫ |
| S08 | €556 limit | €442.30 | **€556.00** | €895 | €1,336.90 | ⚫ |
| S23 | Compare: unemployed → €450 | gain **+€77.97** | gain **+€170.00** | — | — | ⚫ |

Understates minijob net by ~20%; comparison gain understated by **€92/month**.

### 3.5 Midijob

| ID | Scenario | Legacy net | Correct net | BG | Total (legacy) | Risk |
|----|----------|----------:|------------:|---:|---------------:|:----:|
| S09 | €600 | €477.30 | €486.30 | €855 | €1,332.30 | 🟡 |
| S10 | €800 | €636.40 | €667.74 | €675 | €1,311.40 | 🟡 |
| S11 | €1,000 | €795.50 | €821.62 | €495 | €1,290.50 | 🟡 |
| S24 | Compare: unemployed → €600 | gain +€69.30 | gain **+€78.30** | — | — | 🟡 |

Midijob Gleitzone math in core engine matches expected range (Δ ≤ €32 vs benchmarks). Legacy path still applies regular payroll — error magnitude grows toward Minijob boundary.

### 3.6 Bürgergeld recipient

| ID | Scenario | BG benefit | Expected range | Risk |
|----|----------|----------:|-----------------:|:----:|
| S12 | Unemployed single, rent €800 | €1,313 | €1,200–€1,400¹ | 🟢 |
| S13 | Unemployed single, rent €1,200 | €1,313 | User may expect > €1,313² | 🟡 |
| S14 | Employed €1,200 + top-up | €345 | Freibetrag €232 → countable €968 | 🟡 |
| S20 | Compare: → €1,200 job | gain **−€13.40**, verdict **false** | Correct path: **+€7.49**, verdict **true** | ⚫ |
| S21 | Compare: HH2 → €1,500 job | gain **−€88**, verdict **false** | Correct path: **−€75**, still false | 🟡 |

¹ Matches golden fixture bounds (`benefitMin: 1200, benefitMax: 1400`).  
² KdU capped at €750 — rent €1,200 treated same as €800; user not informed cap applied.

**§11b Freibetrag check:** Engine €212 on €800 gross — matches statutory formula (€100 + 20%×€420 + 10%×€280).

### 3.7 Household with children

| ID | Scenario | BG | Breakdown | Risk |
|----|----------|---:|-----------|:----:|
| S15 | HH=3 unemployed, rent €1,100 | €1,893 | Need €2,393 − Kindergeld €500 | 🟡 |
| S16 | HH=3 employed €2,000 | €125 | Small top-up | 🟡 |

**Note:** `householdSize: 3` with `maritalStatus: single` → **1 adult + 2 children** (not 1 adult + 1 child). Kindergeld €500 fully deducted (A8).

---

## 4. Benchmark Comparison Summary

### 4.1 Payroll (regular employment, core engine)

| Metric | Observation |
|--------|-------------|
| **Lohnsteuer (PAP)** | Aligns with BMF tables for StKl I at €2,500 (LSt ~€206 vs public ~€187–€206) |
| **Social contributions** | BBMG caps applied (KV €5,512.50, RV €7,550 monthly 2025) |
| **Typical net deviation** | +0.6% to +2.9% for StKl I at mid incomes without church; within KV rate variance |
| **StKl II single parent** | Likely −5% to −8% vs calculators with Entlastungsbetrag |
| **StKl VI** | PAP handles; legacy path may mis-classify Midijob band as regular StKl VI |

### 4.2 Bürgergeld

| Component | Engine | Reference 2025 | Match |
|-----------|--------|----------------|:-----:|
| Regelbedarf Stufe 1 | €563 | €563 | ✅ |
| Regelbedarf Stufe 5 (age 6–13) | €390 | €390 | ✅ |
| Kindergeld | €250/child | €250 | ✅ |
| §11b Freibeträge | 3-tier | SGB II §11b Abs. 2 | ✅ |
| KdU | Simplified caps | Local Mietstufen tables | ❌ |
| Kindergeld anrechnung | Full gross count | Partial / child-specific | ⚠️ |

### 4.3 Automated test coverage

16 Vitest tests pass. Golden fixtures use **wide bounds** (e.g. BG €1,200–€1,400) that mask KdU and Kindergeld simplifications. **No oracle tests** against BMF API or Jobcenter calculators (deferred in M1).

---

## 5. Deviation Metrics

### 5.1 Net salary deviation (legacy UI path)

| Income band | Scenarios | Median \|Δ net\| vs correct engine | Max \|Δ net\| | Classification |
|-------------|-----------|-------------------------------------|---------------|----------------|
| Minijob (≤ €556) | S07, S08, S23 | **€102** | €114 | **Unacceptable** |
| Midijob (€557–€2,000) | S09–S11, S14, S24 | €26 | €92 | **Risky** |
| Regular (≥ €2,001) | S01, S04, S06 | €10 | €134 (StKl II) | **Acceptable–Risky** |
| Self-employed | S19 | unbounded | — | **Unacceptable** |

### 5.2 Benefit deviation

| Scenario type | Typical \|Δ\| vs simplified reference | Decision impact |
|---------------|---------------------------------------|-----------------|
| Unemployed, rent ≤ cap | ≤ €50 | Low |
| Unemployed, rent > cap | Up to €450 need unmet | **High** — user believes rent is covered |
| Employed + BG (low gross) | €20–€115/month net error cascades to BG | **High** |
| Families with children | €50–€250 from Kindergeld treatment | **Medium–High** |

### 5.3 Decision impact risk

| Pattern | Example | Severity |
|---------|---------|:--------:|
| Verdict flip (job beneficial ↔ harmful) | S20: −€13 legacy vs +€7 correct | **Critical** |
| Material gain understatement | S23: +€78 vs +€170 for Minijob | **Critical** |
| False precision on self-employed | S19: €2,100 net from €3,000 gross | **Critical** |
| KdU cap silent truncation | S13: €1,200 rent → same BG as €800 | **High** |
| Church tax wrong state | BY/BW users | **Medium** |

---

## 6. Engine Confidence Scores

Scores are **conservative** and reflect the **legacy UI path** unless noted. Scale: 0 = do not use; 100 = production-grade for financial guidance.

### 6.1 PayrollEngine — **38 / 100** (UI path) · **62 / 100** (core `inferAndCalculate`)

| Factor | Score impact |
|--------|--------------|
| BMF PAP Lohnsteuer integration | +25 |
| Social contributions + BBMG | +15 |
| Minijob/Midijob logic exists but not wired to UI | −30 |
| Missing Kinderfreibeträge / Entlastungsbetrag | −10 |
| Church tax state blindness | −5 |
| Self-employed stub | −15 |

**Core engine alone** would score ~62 — usable for regular employment sensitivity analysis with disclaimers.

### 6.2 BenefitsEngine — **52 / 100**

| Factor | Score impact |
|--------|--------------|
| Correct 2025 Regelbedarf tiers | +20 |
| §11b Freibeträge implemented correctly | +15 |
| Simplified KdU caps (no Mietstufen, no utilities) | −15 |
| Kindergeld full income imputation | −10 |
| Depends on incorrect payroll net for low earners | −8 |

### 6.3 Comparator — **48 / 100**

| Factor | Score impact |
|--------|--------------|
| Sound math (`totalHouseholdResources` delta) | +20 |
| Correct benefit delta decomposition | +10 |
| Garbage-in from payroll misclassification | −25 |
| No confidence interval or assumption flags | −7 |

Logic is fine; **inputs are not trustworthy** for low-income comparisons.

### 6.4 DecisionEngine — **42 / 100**

| Factor | Score impact |
|--------|--------------|
| Verdict derived transparently from comparison | +15 |
| Ranked decisions + expectedChanges skeleton | +10 |
| False negatives on employment (S20) | −20 |
| No uncertainty propagation | −10 |
| Self-employed and KdU cap not surfaced as blockers | −8 |
| i18n / legal disclaimers not implemented (M2) | −5 |

---

## 7. Recommendations

### 7.1 Overall gate (pre-M2)

| Stage | Verdict | Conditions |
|-------|:-------:|------------|
| **Real user testing** | ❌ **Not yet safe** | Fix A9 (Minijob/Midijob routing) first; add prominent disclaimers |
| **Closed beta** | ❌ **Not yet safe** | Same blockers; Bürgergeld and low-income users must be excluded |
| **Internal alpha** | ⚠️ **Conditional** | Only StKl I/IV regular employment, gross ≥ €2,000, no BG, no children, no church tax in BY/BW |

### 7.2 Blockers (must fix before any user testing)

1. **Wire `inferAndCalculate()` or auto-classify employment type** in `resolveEmploymentsForLegacyInput()` (A9).
2. **Surface KdU cap** in output when `housing.coldRent > capApplied` (A5).
3. **Disable or hard-block self-employed path** in UI until EÜR stub is replaced (A4).
4. **Add mandatory disclaimer** that outputs are estimates, not Jobcenter/Finanzamt advice.

### 7.3 High priority (before beta)

5. Collect **Bundesland** (church tax 8% vs 9%, future KdU).
6. Child **age bands** instead of fixed age 8 (A2).
7. Revisit **Kindergeld imputation** against SGB II child-benefit rules (A8).
8. Add **StKl II Entlastungsbetrag** / Kinderfreibeträge to tax adapter (A11).
9. Expand golden tests with **narrow tolerances** for Minijob/Midijob and comparison verdicts.

### 7.4 Acceptable deferrals (M2+)

- Full Mietstufen KdU tables
- Wohngeld
- Partner income and StKl optimization
- BMF API oracle integration tests

---

## 8. Conclusion

The v2 **core payroll math for regular employment is credible** (+0.6% to +3% vs public calculators for standard StKl I cases). The **benefits engine skeleton** implements the right 2025 parameters and §11b structure at a simplified level.

However, **the adapter layer that serves real users today introduces unacceptable errors** for the exact population most likely to rely on Arrive Atlas: low-wage and Bürgergeld-adjacent households. A ~€92/month net error on Minijob income, combined with verdict flips on employment decisions, creates **material risk of harmful financial guidance**.

**Do not proceed to M2 user-facing features on this path without fixing Minijob/Midijob routing and adding safety guardrails.** Re-run this validation suite after the fix; target PayrollEngine (UI path) ≥ 70 and Comparator ≥ 65 before reopening the user-testing gate.

---

## Appendix A — Scenario Input Matrix

<details>
<summary>Full inputs (click to expand)</summary>

| ID | gross | StKl | church | HH | rent | status | marital | proposed |
|----|------:|-----:|:------:|---:|-----:|--------|---------|--------:|
| S01 | 2500 | 1 | no | 1 | 800 | employed | single | — |
| S02 | 2500 | 1 | yes | 1 | 800 | employed | single | — |
| S03 | 800 | 6 | no | 1 | 600 | employed | single | — |
| S04 | 3500 | 3 | no | 2 | 1200 | employed | married | — |
| S05 | 2800 | 4 | no | 2 | 1000 | employed | married | — |
| S06 | 2200 | 2 | no | 2 | 900 | employed | single | — |
| S07 | 450 | 1 | no | 1 | 700 | employed | single | — |
| S08 | 556 | 1 | no | 1 | 700 | employed | single | — |
| S09 | 600 | 1 | no | 1 | 700 | employed | single | — |
| S10 | 800 | 1 | no | 1 | 700 | employed | single | — |
| S11 | 1000 | 1 | no | 1 | 700 | employed | single | — |
| S12 | 0 | 1 | no | 1 | 800 | unemployed | single | — |
| S13 | 0 | 1 | no | 1 | 1200 | unemployed | single | — |
| S14 | 1200 | 1 | no | 1 | 800 | employed | single | — |
| S15 | 0 | 1 | no | 3 | 1100 | unemployed | single | — |
| S16 | 2000 | 2 | no | 3 | 1100 | employed | single | — |
| S17 | 2500 | 3 | no | 4 | 1400 | employed | married | — |
| S18 | 1800 | 5 | no | 2 | 950 | employed | married | — |
| S19 | 3000 | 1 | no | 1 | 900 | self-employed | single | — |
| S20 | 0 | 1 | no | 1 | 800 | unemployed | single | 1200 |
| S21 | 0 | 1 | no | 2 | 950 | unemployed | married | 1500 |
| S22 | 0 | 2 | no | 2 | 900 | unemployed | single | — |
| S23 | 0 | 1 | no | 1 | 700 | unemployed | single | 450 |
| S24 | 0 | 1 | no | 1 | 700 | unemployed | single | 600 |

</details>

## Appendix B — References

- BMF Lohnsteuer Programmablaufpläne 2025 (via `lohnsteuerrechner`)
- SGB II §11b Abs. 2 (Erwerbsfreibeträge 2025: €100 Grundfreibetrag, 20%/10% tiers)
- Regelbedarfsstufen 2025 (Stufe 1 €563, Stufe 5 €390)
- Minijob-Grenze 2025: €556; Midijob Obergrenze: €2,000
- Golden fixtures: `packages/shared-services/src/financial/__fixtures__/`
- Implementation report: `docs/audits/financial-module-v2-implementation-report.md`

---

*This report is an internal audit artifact. It does not constitute legal or tax advice.*
