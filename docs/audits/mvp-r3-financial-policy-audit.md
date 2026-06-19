---
id: mvp-r3-financial-policy-audit
title: MVP-R3 Financial Policy Audit
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: finance
status: active
maturity: stable
owner: system
tags:
  - financial-modeling
  - profile-policy
created: 2026-06-01
updated: 2026-06-19
related:
---

# MVP-R3 — Financial Reality Profile Policy Audit

**Date:** June 2026  
**Auditor role:** Principal Platform Refactoring Engineer  
**Refactor ID:** MVP-R3 (policy gate)  
**Scope:** `FINANCIAL_REALITY_POLICY`, `applyProfilePolicy()`, `buildPolicyConstrainedDocument()`, `profileSlice` exposure for `insurance` and `benefits` domains  
**Status:** Audit only — **no implementation**

**Related docs:**  
`docs/audits/mvp-r3-single-source-truth-audit.md`,  
`docs/archive/user-profile-engine/policy-layer-report.md`,  
`docs/refactors/mvp-r1-profile-merge-port.md`,  
`packages/modules/src/financial-reality/profile-context.ts`

---

## Executive Summary

Financial Reality **requires** `insurance.hasCoverage` and `benefits.daysInGermany` for `germanAdminRules` (Krankenkasse and Anmeldung obligations). After MVP-R3 module work, the module reads these from `context.profileSlice` via `resolveFinancialProfileContext()` — but **`FINANCIAL_REALITY_POLICY` excludes both `insurance` and `benefits` from `allowedFields`**, so `profileSlice` never contains them at runtime.

This is a **policy configuration gap**, not a policy-engine limitation. The policy layer fully supports exposing these domains; sibling modules already do (`healthcare-navigation` → `insurance`; `benefits-simulator` → `benefits`).

**Recommendation: A) Add `insurance` + `benefits` to `FINANCIAL_REALITY_POLICY.allowedFields`** with no additional `sensitiveFields` for the six inspected fields. All are low-sensitivity status flags; none are financial amounts. This aligns with the policy model, fixes the MVP-R3 pipeline end-to-end, and requires updating **3 existing policy tests** that currently assert exclusion.

**Option C (merge strategy only)** is **not recommended** — it bypasses `profileSlice` as the authoritative read surface and duplicates Benefits Simulator's pattern without resolving the policy intent.

---

## 1. Policy Artifacts Located

| Artifact | Path | Role |
|----------|------|------|
| `FINANCIAL_REALITY_POLICY` | `packages/profile/src/policy/module-profile-policy-registry.ts` | Module access control |
| `HEALTHCARE_NAVIGATION_POLICY` | same | Precedent — exposes `insurance` |
| `BENEFITS_SIMULATOR_POLICY` | same | Precedent — exposes `benefits` |
| `applyProfilePolicy()` | `packages/profile/src/policy/apply-profile-policy.ts` | Builds redacted `profileSlice` |
| `buildPolicyConstrainedDocument()` | same | Builds merge/shim source document |
| `pickAllowedTopLevel()` | same | Filters by `allowedFields` only |
| `redactPaths()` | same | Applies `sensitiveFields` / `redactFields` |
| Policy tests | `packages/profile/src/policy/apply-profile-policy.test.ts` | Exclusion assertions |
| Financial context resolver | `packages/modules/src/financial-reality/profile-context.ts` | Reads `profileSlice.insurance` / `.benefits` |
| Profile schema | `packages/profile/src/types/profile-document.ts` | Source field definitions |

### 1.1 Current `FINANCIAL_REALITY_POLICY`

```typescript
{
  moduleId: 'financial-reality',
  allowedFields: ['preferredLanguage', 'employment', 'household', 'housing', 'location'],
  sensitiveFields: ['employment.grossMonthlyIncome', 'housing.monthlyColdRent'],
  allowExtensions: true,
  allowedExtensions: ['financial-reality'],
}
```

**Notable absences:** `insurance`, `benefits`, `residency`, `countryOfOrigin`.

---

## 2. Policy Enforcement Trace

### 2.1 Pipeline (financial-reality execute)

```
ProfileDocument (full store)
        │
        ├─ getModuleProfilePolicy('financial-reality')
        │
        ├─ applyProfilePolicy()
        │     pickAllowedTopLevel(allowedFields)  ← insurance/benefits DROPPED here
        │     redactPaths(sensitiveFields)
        │     → profileSlice (module-visible context)
        │
        ├─ buildPolicyConstrainedDocument()
        │     copy allowed top-level domains only  ← insurance/benefits DROPPED here
        │     → policyDocument (merge + legacy shim source)
        │
        ├─ mergeModuleInput(policyDocument)  ← no insurance/benefits field config
        │
        └─ buildAppContext(profileSlice, policyDocument)
              → context.profileSlice (no insurance/benefits)
              → context.systemState (shim from policyDocument — also empty)
```

### 2.2 Domain trace: `insurance.*`

| Step | `insurance.hasCoverage` | `insurance.type` |
|------|-------------------------|------------------|
| **ProfileDocument** | ✅ Stored if user PATCHes profile | ✅ Stored |
| **pickAllowedTopLevel** | ❌ Excluded — not in `allowedFields` | ❌ Excluded |
| **applyProfilePolicy redaction** | N/A — domain never picked | N/A |
| **profileSlice** | ❌ Not present | ❌ Not present |
| **buildPolicyConstrainedDocument** | ❌ Not present | ❌ Not present |
| **context.systemState.insurance** (shim) | ❌ Undefined | ❌ Undefined |
| **resolveFinancialProfileContext** | Falls through to `false` default | Not read |

### 2.3 Domain trace: `benefits.*`

| Step | `daysInGermany` | `receivingBuergergeld` | `receivingAlg1` | `receivingWohngeld` |
|------|-----------------|------------------------|-----------------|---------------------|
| **ProfileDocument** | ✅ | ✅ | ✅ | ✅ |
| **pickAllowedTopLevel** | ❌ Excluded | ❌ Excluded | ❌ Excluded | ❌ Excluded |
| **profileSlice** | ❌ | ❌ | ❌ | ❌ |
| **buildPolicyConstrainedDocument** | ❌ | ❌ | ❌ | ❌ |
| **context.systemState.benefits** (shim) | ❌ Undefined | ❌ Undefined | ❌ Undefined | ❌ Undefined |
| **resolveFinancialProfileContext** | `undefined` default | Not read | Not read | Not read |

### 2.4 Observed runtime symptom

`resolve-execution-context.test.ts` and `profile.integration.test.ts` load profiles with `insurance` and `benefits`, then assert:

```typescript
expect(context.systemState?.benefits?.daysInGermany).toBeUndefined();
expect(context.systemState?.insurance?.hasCoverage).toBeUndefined();
```

These tests **document the policy gap** — data exists in `ProfileDocument` but is stripped before context construction.

---

## 3. Field Matrix

| Source field (ProfileDocument) | Sensitivity | Currently in FR `profileSlice`? | Used by Financial Reality today? | Safe to expose in `profileSlice`? | Reason |
|--------------------------------|-------------|:---------------------------------:|:--------------------------------:|:---------------------------------:|--------|
| `insurance.hasCoverage` | **Low** — boolean coverage status | **No** | **Yes** — `germanAdminRules` (`hasHealthInsurance`) | **Yes** | Not PII; required for Krankenkasse obligation rule; healthcare module already exposes full `insurance` domain with zero `sensitiveFields` |
| `insurance.type` | **Low** — enum `public \| private \| none` | **No** | **No** — not read by `profile-context.ts` | **Yes** | Non-sensitive categorical data; may support future GKV/PKV guidance; no redaction precedent needed |
| `benefits.daysInGermany` | **Low–Medium** — residency duration integer | **No** | **Yes** — `germanAdminRules` (Anmeldung `daysInGermany > 14`) | **Yes** | Required for correct admin rules; not a benefit amount; duration is operational not financial |
| `benefits.receivingBuergergeld` | **Medium** — benefits participation flag | **No** | **No** — not read today | **Yes** | Status flag only; no amount in `ProfileDocument` schema; benefits-simulator policy already exposes full `benefits` domain; `currentBuergergeldAmount` is simulator-schema-only, not in profile |
| `benefits.receivingAlg1` | **Medium** — benefits participation flag | **No** | **No** | **Yes** | Same as above; enables future ALG I / Bürgergeld transition rules |
| `benefits.receivingWohngeld` | **Medium** — benefits participation flag | **No** | **No** | **Yes** | Same; supports future housing-benefit cross-checks |

### 3.1 Fields NOT in ProfileDocument (out of scope)

| Field | Notes |
|-------|-------|
| `benefits.currentBuergergeldAmount` | Listed in `BENEFITS_SIMULATOR_POLICY.sensitiveFields` but **does not exist** in `ProfileDocumentSchema` — simulator input only. Not relevant to financial-reality policy expansion. |

---

## 4. Policy Model Compliance Analysis

### 4.1 Would exposing `insurance` + `benefits` violate the policy model?

**No.** The model is explicitly designed for per-module `allowedFields` gating:

| Principle | Assessment |
|-----------|------------|
| Top-level domain allowlisting | ✅ Standard — same mechanism as healthcare and benefits-simulator |
| Sensitive field redaction | ✅ Unaffected — current FR `sensitiveFields` only target employment income and housing rent |
| Extension isolation | ✅ Unaffected — `allowedExtensions: ['financial-reality']` unchanged |
| Dual-document pattern | ✅ Preserved — `profileSlice` (redacted view) vs `policyDocument` (merge source) |

Adding domains is **the intended use** of the policy registry, not a bypass.

### 4.2 Would it leak sensitive information?

| Risk | Assessment |
|------|------------|
| Income/rent leakage via new domains | **No** — separate domains; existing `sensitiveFields` unchanged |
| Benefits **amount** leakage | **No** — `ProfileDocument.benefits` has no amount fields |
| `profileSlice` visible to module only | Context travels with execute; API response returns module `data`, not full `context` — exposure surface unchanged vs healthcare |
| UI profile API | **Unaffected** — `GET /api/profile` returns full `UIProfileDocument` regardless of module policy |
| Privacy regression vs redacted employment | **No regression** — insurance/benefits flags are **less sensitive** than redacted gross income |

**Contrast (existing issue, not introduced by this change):** `userProfile.income` legacy shim still populates from `policyDocument.employment.grossMonthlyIncome` while `profileSlice` redacts it. That is a separate MVP-R3 legacy-shim problem.

### 4.3 Would it conflict with redaction rules?

**No conflict** for the six inspected fields — none are listed in `FINANCIAL_REALITY_POLICY.sensitiveFields` or `redactFields`.

If only subset exposure is desired (Option B), the policy engine supports:

```typescript
allowedFields: [..., 'insurance', 'benefits'],
sensitiveFields: [
  ...,
  'insurance.type',                    // redact if unused
  'benefits.receivingBuergergeld',     // redact if unused
  'benefits.receivingAlg1',
  'benefits.receivingWohngeld',
],
```

`redactPaths()` removes dot-paths from the **picked** domain copy before `profileSlice` assignment. `buildPolicyConstrainedDocument()` does **not** apply `sensitiveFields` (only `redactFields`) — merge would still see full nested data if domain is allowed.

### 4.4 Cross-module policy comparison

| Module | `insurance` in slice | `benefits` in slice | `sensitiveFields` on these domains |
|--------|:--------------------:|:-------------------:|-------------------------------------|
| `financial-reality` (today) | ❌ | ❌ | N/A — excluded |
| `healthcare-navigation` | ✅ full | ❌ | none |
| `benefits-simulator` | ❌ | ✅ full | `benefits.currentBuergergeldAmount` (schema-only field) |

Financial Reality needing **both** domains is **more restrictive than healthcare** (insurance only) and **complementary to benefits-simulator** (benefits only). No policy contradiction.

---

## 5. Financial Reality Consumption Map

| Field | Read by `profile-context.ts` | Read by `germanAdminRules` | In `MODULE_INPUT_CONFIG` |
|-------|:------------------------------:|:--------------------------:|:------------------------:|
| `insurance.hasCoverage` | ✅ | ✅ `hasHealthInsurance` | ❌ |
| `insurance.type` | ❌ | ❌ | ❌ |
| `benefits.daysInGermany` | ✅ | ✅ `daysInGermany` | ❌ |
| `benefits.receivingBuergergeld` | ❌ | ❌ | ❌ |
| `benefits.receivingAlg1` | ❌ | ❌ | ❌ |
| `benefits.receivingWohngeld` | ❌ | ❌ | ❌ |

**Minimum policy change for current code:** expose at least `insurance.hasCoverage` and `benefits.daysInGermany` via `profileSlice`.

**Minimum domain change:** add top-level `insurance` and `benefits` to `allowedFields` (domain-level allowlisting only — no per-field allowlist without redaction).

---

## 6. Test Impact Analysis

### 6.1 Tests that would require updates if policy expands

| Test file | Test | Current assertion | After policy change |
|-----------|------|-------------------|---------------------|
| `apply-profile-policy.test.ts` | `excludes unrelated top-level fields` | `slice.insurance` / `slice.benefits` undefined | **Update** — expect defined |
| `apply-profile-policy.test.ts` | `financial module cannot see healthcare-only domains` | `slice.insurance` undefined | **Update or remove** — insurance no longer healthcare-only |
| `apply-profile-policy.test.ts` | `buildPolicyConstrainedDocument retains...` | `doc.insurance` undefined | **Update** — expect defined |
| `profile.integration.test.ts` | financial module integration | `systemState` insurance/benefits undefined | **Update** — expect populated via shim (until legacy removed) |
| `resolve-execution-context.test.ts` | (no explicit insurance/benefits asserts) | — | **Add** — assert `profileSlice.insurance` / `.benefits` |

### 6.2 Tests that would benefit (no breakage)

| Test file | Test | Effect |
|-----------|------|--------|
| `financial-reality/profile-context.test.ts` | unit tests with manual `profileSlice` | Unchanged |
| `financial-reality/financial-reality.test.ts` | `evaluates admin rules from profileSlice` | Today uses **manually injected** `profileSlice` in context — would also pass via real pipeline after policy fix |
| `financial-reality/financial-reality.test.ts` | integration via `resolveExecutionContext` | **New test recommended** — end-to-end Anmeldung rule with bound profile |

### 6.3 Tests that should NOT break

| Area | Reason |
|------|--------|
| Healthcare policy isolation | Healthcare slice still excludes employment/housing — separate policy |
| Benefits-simulator policy | Independent policy registry entry |
| UI profile contract tests | UI returns full document, not policy slice |
| Sensitive field redaction (income, rent) | `sensitiveFields` unchanged |

---

## 7. Options Evaluation

### Option A — Add `insurance` + `benefits` to `FINANCIAL_REALITY_POLICY`

```typescript
allowedFields: [
  'preferredLanguage', 'employment', 'household', 'housing', 'location',
  'insurance', 'benefits',
],
```

| Dimension | Assessment |
|-----------|------------|
| **Pros** | Minimal change; matches sibling modules; fixes MVP-R3 pipeline; all 6 fields safe; enables future admin rules on benefits flags |
| **Cons** | Exposes 4 fields Financial Reality does not read today (acceptable — low sensitivity) |
| **Migration cost** | **Low** — 1 policy object + ~3 test updates + 1 integration test |
| **Operational complexity** | **Low** |

### Option B — Add domains with selective `sensitiveFields` redaction

```typescript
allowedFields: [..., 'insurance', 'benefits'],
sensitiveFields: [
  'employment.grossMonthlyIncome', 'housing.monthlyColdRent',
  'insurance.type',
  'benefits.receivingBuergergeld', 'benefits.receivingAlg1', 'benefits.receivingWohngeld',
],
```

| Dimension | Assessment |
|-----------|------------|
| **Pros** | Least privilege in `profileSlice` — only `hasCoverage` + `daysInGermany` visible to module |
| **Cons** | `buildPolicyConstrainedDocument` still copies full domains for merge (sensitiveFields not applied there); asymmetry may confuse; future rule needing `receivingBuergergeld` requires policy change |
| **Migration cost** | **Low–Medium** |
| **Operational complexity** | **Medium** — two different redaction surfaces to reason about |

### Option C — Keep policy unchanged; route via merge strategy

| Dimension | Assessment |
|-----------|------------|
| **Pros** | No policy test changes |
| **Cons** | Requires new `financial-reality` merge strategy (MVP-R1 pattern); data not in `profileSlice`; contradicts MVP-R3 single-source goal; `MODULE_INPUT_CONFIG` has no insurance/benefits fields today; admin rules read `context`, not `input` |
| **Migration cost** | **Medium** — new merge strategy + input schema or side-channel |
| **Operational complexity** | **High** — third hydration path alongside slice and legacy shim |

**Verdict:** Option C is architecturally regressive. Option A is the correct default; Option B is valid if least-privilege is a hard requirement.

---

## 8. Risk Assessment

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|:----------:|:------:|------------|
| P-01 | Policy change does not fix runtime until tests/deploy | Low | Medium | Add `resolveExecutionContext` integration test |
| P-02 | Benefits flags in slice enable module scope creep | Low | Low | Module only reads two fields today; code review |
| P-03 | Existing exclusion tests fail on policy update | Certain | Low | Update 3 tests as part of same PR |
| P-04 | `buildPolicyConstrainedDocument` exposes benefits flags to merge path | Low | Low | Merge does not map them today; no leakage to output |
| P-05 | Cross-module data visibility concern (financial sees insurance) | Low | Low | Healthcare already sees insurance; financial needs it for rules |
| P-06 | Option B redaction bypass via policyDocument | Medium if Option B | Low | Document dual-document semantics; not a new issue |

**Overall risk of Option A:** **Low**

---

## 9. Recommendation

### Primary recommendation: **A) Add `insurance` + `benefits` to `FINANCIAL_REALITY_POLICY`**

**Proposed policy (audit reference — not implemented):**

```typescript
export const FINANCIAL_REALITY_POLICY: ModuleProfilePolicy = {
  moduleId: 'financial-reality',
  allowedFields: [
    'preferredLanguage',
    'employment',
    'household',
    'housing',
    'location',
    'insurance',
    'benefits',
  ],
  sensitiveFields: [
    'employment.grossMonthlyIncome',
    'housing.monthlyColdRent',
  ],
  allowExtensions: true,
  allowedExtensions: ['financial-reality'],
};
```

**Rationale:**

1. **Fixes the MVP-R3 gap** — `resolveFinancialProfileContext()` reads `profileSlice`; policy must populate it.
2. **All six inspected fields are safe** — status flags and duration, not financial amounts.
3. **Consistent with policy model** — same pattern as healthcare and benefits-simulator.
4. **No new architecture** — no merge strategy, no `ruleContext`, no schema changes.
5. **Low test churn** — 3 policy tests + 1 integration test update.

### Alternative (if least privilege required): **B) Option A + redact unused nested fields**

Only choose B if product/legal requires Financial Reality module context to exclude benefits participation flags. Functionally, Option A is sufficient for MVP.

### Do not choose: **C) Merge strategy routing**

Conflicts with MVP-R3 direction and duplicates hydration logic without fixing `profileSlice` authority.

---

## 10. Implementation Checklist (for future PR — not this audit)

| # | Task | Package |
|---|------|---------|
| 1 | Add `insurance`, `benefits` to `FINANCIAL_REALITY_POLICY.allowedFields` | `@arrival-atlas/profile` |
| 2 | Update `apply-profile-policy.test.ts` exclusion assertions | `@arrival-atlas/profile` |
| 3 | Update `profile.integration.test.ts` — expect `profileSlice.insurance/benefits` populated | `@arrival-atlas/profile` |
| 4 | Add `resolveExecutionContext` test: `daysInGermany: 90` → `profileSlice.benefits` | `@arrival-atlas/profile` |
| 5 | Add financial-reality E2E via pipeline: Anmeldung rule without manual `profileSlice` injection | `@arrival-atlas/modules` |
| 6 | Verify trace records `FIELD_ALLOWED` for `insurance`, `benefits` | `@arrival-atlas/profile` |

---

## 11. Success Criteria Answers

| Question | Answer |
|----------|--------|
| Can `insurance` and `benefits` be safely exposed via `profileSlice`? | **Yes** — all six fields are low/medium sensitivity status data; no schema amounts |
| Does exposure violate the policy model? | **No** |
| Does exposure leak sensitive data? | **No** — less sensitive than already-redacted income/rent |
| Does exposure conflict with redaction rules? | **No** — unless Option B adds new redactions |
| What blocks today? | **`allowedFields` omission only** — intentional exclusion, now obsolete given admin rule requirements |
| Recommended path? | **Option A** |

---

*End of audit. No implementation proposed.*
