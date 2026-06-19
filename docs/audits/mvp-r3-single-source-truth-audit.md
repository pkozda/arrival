---
id: mvp-r3-single-source-truth-audit
title: MVP-R3 Single Source of Truth Audit
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: identity
status: active
maturity: stable
owner: system
tags:
  - profile-engine
  - data-model
created: 2026-06-01
updated: 2026-06-19
related:
---

# MVP-R3 — Single Context Truth Audit

**Date:** June 2026  
**Auditor role:** Principal Platform Refactoring Engineer  
**Refactor ID:** MVP-R3  
**Scope:** Legacy `AppContext.userProfile` and `AppContext.systemState` vs Profile Engine (`profileSlice`, `ProfileDocument`, `dataProvenance`)  
**Status:** Audit only — **no implementation**

**Related docs:**  
`docs/audits/platform-architecture-audit.md` (MVP-R3),  
`docs/refactors/mvp-r1-profile-merge-port.md`,  
`docs/archive/user-profile-engine/policy-layer-report.md`,  
`docs/archive/user-profile-engine/runtime-unification-report.md`

---

## Executive Summary

Arrival Atlas currently operates with **intentional dual heritage** in `AppContext`: Profile Engine fields (`profileSlice`, `profileId`, `profileVersion`, `dataProvenance`) coexist with legacy shapes (`userProfile`, `systemState`). The Profile Engine **writes** legacy fields from `ProfileDocument` in `buildAppContext()`, but modules **read** them inconsistently.

**Critical finding:** `financial-reality` reads `systemState.insurance` and `systemState.benefits`, but its **module policy excludes `insurance` and `benefits` domains** from the policy-constrained document. Those `systemState` fields are therefore **always undefined** when profile is loaded — admin rules fall back to hardcoded defaults (`hasHealthInsurance: true`, `daysInGermany: 0`). This is not merely redundant data; it is **silent data loss**.

**Benefits Simulator** is already aligned with single-source truth: it ignores `context` entirely and receives all domain state via **merged input** from the profile pipeline.

**Verdict:** MVP-R3 **can and should execute before Beta**, but only in phases. Phase 1–3 (module read migration) is **MVP-safe**. Phase 4 (remove legacy fields from `AppContextSchema`) should wait until **web client and session API** stop writing `userProfile` — target Beta (BETA-R9).

---

## 1. Current State — Two Parallel Representations

### 1.1 Authoritative sources (by design)

| Representation | Owner | Populated when | Purpose |
|----------------|-------|----------------|---------|
| `ProfileDocument` | Profile Engine (store) | PATCH `/api/profile`, create/update | Full persisted user state |
| `profileSlice` | Profile Engine (policy) | `resolveExecutionContext()` | Module-visible, policy-filtered view |
| `policyDocument` | Profile Engine (policy) | `resolveExecutionContext()` | Input merge source (includes sensitive paths within allowed domains) |
| `dataProvenance` | Profile Engine (merge + context) | `resolveExecutionContext()` | Audit trail for field resolution |

### 1.2 Legacy mirrors (compatibility shims)

| Representation | Owner | Populated when | Source of truth today |
|----------------|-------|----------------|----------------------|
| `userProfile` (4 fields) | `context-builder.ts` | Profile bound + execute | **Derived** from `policyDocument` + request overrides |
| `systemState` (3 buckets) | `context-builder.ts` | Profile bound + execute | **Derived** from `policyDocument` + request overrides |
| `location` (string) | `context-builder.ts` | Profile bound + execute | **Derived** from `policyDocument.location` (formatted) |

### 1.3 Execution path (relevant to split-brain)

```
POST /api/modules/:id/execute
  body.context  ──► requestContext (legacy overrides: userProfile, systemState)
  x-session-id    ──► profile load ONLY (NOT session.context merge)
                      │
                      ▼
              resolveExecutionContext()
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
    profileSlice  mergedInput   userProfile + systemState
    (policy view) (module input) (legacy shims in AppContext)
```

> **Finding S-01:** Session-stored `userProfile` / `systemState` (`createSession`, `updateSessionContext`) are **not merged** into module execution. Only `sessionId` binds profile. Legacy session context is **orphaned** for execute — but web still **writes** `userProfile.language` on every request.

---

## 2. Complete Usage Inventory

### 2.1 `context.systemState` — READ sites (runtime modules)

| File | Line(s) | Field accessed | Purpose | Classification | Replacement profile field | Migration difficulty |
|------|---------|----------------|---------|----------------|---------------------------|---------------------|
| `packages/modules/src/financial-reality/index.ts` | 110–111 | `insurance.hasCoverage` | `germanAdminRules` → Krankenkasse rule | **Blocked** (policy gap) | `profile.insurance.hasCoverage` | **High** — policy must add `insurance` to financial-reality allowedFields |
| `packages/modules/src/financial-reality/index.ts` | 110–111 | `benefits.daysInGermany` | `germanAdminRules` → Anmeldung rule | **Blocked** (policy gap) | `profile.benefits.daysInGermany` | **High** — policy must add `benefits` to financial-reality allowedFields |
| `packages/modules/src/financial-reality/index.ts` | 193–194 | `insurance.hasCoverage` | Same (v2 path) | **Blocked** | `profile.insurance.hasCoverage` | **High** |
| `packages/modules/src/financial-reality/index.ts` | 193–194 | `benefits.daysInGermany` | Same (v2 path) | **Blocked** | `profile.benefits.daysInGermany` | **High** |

**Modules reading `systemState`:** **1** — `financial-reality` only.

**Modules ignoring `systemState`:** `benefits-simulator`, `healthcare-navigation`, `system-translation`, `life-event`, `grocery-optimization`.

---

### 2.2 `context.systemState` — WRITE / PROPAGATE sites

| File | Line(s) | Operation | Classification | Notes |
|------|---------|-----------|----------------|-------|
| `packages/profile/src/engine/context-builder.ts` | 144–160 | Build `systemState` from `policyDocument` | Requires adapter | Only includes domains present in policy-constrained doc |
| `packages/profile/src/engine/context-builder.ts` | 150, 155 | Merge `requestOverrides.systemState.*` | Safe (override path) | Client can inject legacy overrides |
| `packages/profile/src/engine/context-builder.ts` | 163–166 | Provenance for `daysInGermany`, `hasCoverage` | N/A | Writer-side |
| `packages/profile/src/engine/context-builder.ts` | 190 | Passthrough when no profile | Safe | No profile bound |
| `packages/core/src/session/index.ts` | 38–40 | Shallow merge into session | Requires adapter | Session persistence of legacy shape |
| `packages/core/src/types/index.ts` | 15–21, 36 | Schema definition | N/A | Contract surface |

---

### 2.3 `context.userProfile` — READ sites (runtime modules)

| File | Line(s) | Field accessed | Purpose | Classification | Replacement profile field | Migration difficulty |
|------|---------|----------------|---------|----------------|---------------------------|---------------------|
| `packages/modules/src/healthcare-navigation/index.ts` | 217 | `language` | Localize scenario text | **Safe** | `profileSlice.preferredLanguage` | **Low** |
| `packages/modules/src/system-translation/index.ts` | 41 | `language` | Translation lookup language | **Safe** | `profileSlice.preferredLanguage` | **Low** |

**Modules reading `userProfile`:** **2** — `healthcare-navigation`, `system-translation`.

**Modules ignoring `userProfile`:** `financial-reality`, `benefits-simulator`, `life-event`, `grocery-optimization`.

---

### 2.4 `context.userProfile` — WRITE / PROPAGATE sites

| File | Line(s) | Field / operation | Classification | Replacement | Migration difficulty |
|------|---------|-------------------|----------------|-------------|---------------------|
| `packages/profile/src/engine/context-builder.ts` | 48–66 | `language` | Requires adapter | `profileSlice.preferredLanguage` | Low |
| `packages/profile/src/engine/context-builder.ts` | 68–76 | Build `userProfile` object | Requires adapter | Derive from profileSlice | Medium |
| `packages/profile/src/engine/context-builder.ts` | 71 | `residencyStatus` | Requires adapter | `profile.residency.status` (enum vs free string) | Medium |
| `packages/profile/src/engine/context-builder.ts` | 73 | `income` | Requires adapter | `profile.employment.grossMonthlyIncome` — **privacy conflict** with redacted slice | High |
| `packages/profile/src/engine/context-builder.ts` | 75 | `householdSize` | Safe | `profile.household.size` | Low |
| `packages/profile/src/engine/context-builder.ts` | 78–130 | Provenance + trace for userProfile fields | N/A | Update provenance field names | Medium |
| `packages/profile/src/engine/context-builder.ts` | 188 | Passthrough when no profile | Safe | — | Low |
| `packages/core/src/session/index.ts` | 35–37 | Session merge | Requires adapter | Stop storing; use profile API | Medium |
| `packages/core/src/types/index.ts` | 6–13, 34 | Schema | N/A | Deprecate in Phase 4 | — |

---

### 2.5 Client / API consumers (legacy writers)

| File | Line(s) | Legacy usage | Classification | Migration difficulty |
|------|---------|--------------|----------------|---------------------|
| `apps/web/src/components/AppProvider.tsx` | 45 | `createSession({ userProfile: { language } })` | Requires adapter | **Medium** — bind language via profile PATCH or pass `preferredLanguage` in execute context |
| `apps/web/src/app/modules/financial-reality/page.tsx` | 63 | Execute context `{ userProfile: { language } }` | Requires adapter | **Low** — use profile or `profileSlice` path |
| `apps/web/src/app/modules/healthcare-navigation/page.tsx` | 52 | Same | Requires adapter | Low |
| `apps/web/src/app/modules/system-translation/page.tsx` | 39 | Same | Requires adapter | Low |
| `apps/web/src/app/modules/grocery-optimization/page.tsx` | 55 | Same | Requires adapter | Low |
| `apps/web/src/app/modules/life-event/page.tsx` | 61 | Same | Requires adapter | Low |
| `apps/api/src/build-app.ts` | 134–136 | `createSession` accepts full `AppContext` | Requires adapter | Medium |
| `apps/api/src/build-app.ts` | 151–152 | `PATCH /api/sessions/:id` merges legacy context | Requires adapter | Medium |
| `apps/api/src/routes/profile.ts` | 40 | `updateSessionContext({ profileId })` only | Safe | Already profile-centric |

---

### 2.6 Test assertions (legacy expectations)

| File | Line(s) | Asserts | Action in MVP-R3 |
|------|---------|---------|------------------|
| `packages/profile/src/engine/resolve-execution-context.test.ts` | 50, 68 | `userProfile.income`, provenance `userProfile.income` | Update in Phase 1–3 |
| `packages/profile/src/profile.integration.test.ts` | 47–49 | `userProfile.income`; `systemState` undefined for benefits/insurance | **Documents the bug** — update when policy fixed |
| `apps/api/src/profile-ui-contract.test.ts` | 24 | Session create with `userProfile.language` | Update in Phase 4 |
| `apps/api/src/profile.integration.test.ts` | 18 | Same | Update in Phase 4 |

> Duplicate directories (`engine 2/`, `profile.integration.test 2.ts`) mirror the same assertions — remove during hygiene pass; not separate migration work.

---

## 3. Priority Module Analysis

### 3.1 Financial Reality

| Concern | Current behavior | Single-source gap |
|---------|------------------|-------------------|
| Module input | ✅ From `mergedInput` via `MODULE_INPUT_CONFIG` + profile | Aligned |
| Admin rules (`germanAdminRules`) | ❌ Reads `context.systemState` | **Misaligned** — fields never populated under current policy |
| `profileSlice` | Has `employment`, `household`, `housing` (gross redacted) | Not read by module |
| `userProfile.income` | Populated in context | Module does not read it; input merge uses profile directly |
| Default fallbacks | `hasCoverage ?? true`, `daysInGermany ?? 0` | **Masks missing data** — Anmeldung rule never fires for profile-bound users |

**Root cause:** `FINANCIAL_REALITY_POLICY.allowedFields` = `['preferredLanguage', 'employment', 'household', 'housing', 'location']` — **excludes `insurance` and `benefits`**. `buildPolicyConstrainedDocument()` therefore omits those domains, and `systemState` shims are empty.

**Recommended read path after MVP-R3:**

```
Option A (preferred): profileSlice.insurance / profileSlice.benefits
  → requires policy expansion

Option B: pass rule context fields via mergedInput extension
  → requires adapter in input-merger or module merge strategy

Option C: read from household.currentBenefits in merged v2 input
  → partial — no daysInGermany in pipeline input today
```

---

### 3.2 Benefits Simulator

| Concern | Current behavior | Single-source gap |
|---------|------------------|-------------------|
| `context` parameter | `_context` — **ignored** | ✅ None |
| Domain state | `merge-strategy` → `mergedInput` | ✅ Single source via profile |
| `systemState` / `userProfile` | Not used | ✅ Clean |

**Status:** **Reference implementation** for MVP-R3. No module changes required beyond ensuring merge strategy remains the sole hydration path.

---

### 3.3 Healthcare Navigation

| Concern | Current behavior | Single-source gap |
|---------|------------------|-------------------|
| Insurance fields | ✅ Input merge from `profile.insurance` | Aligned |
| Language | ❌ `context.userProfile.language` | Should use `profileSlice.preferredLanguage` |
| `systemState` | Not read | ✅ |
| Policy | Includes `insurance`, `location`, `residency` | Aligned |

**Migration:** Replace one line (language read). **Low risk.**

---

## 4. Migration Matrix

### 4.1 Legacy → Profile field mapping

| Legacy field | Profile field | profileSlice available? | Policy (financial-reality) | Status | Phase |
|--------------|---------------|:-----------------------:|:--------------------------:|--------|:-----:|
| `userProfile.language` | `preferredLanguage` | ✅ Always | ✅ | **Safe** | 1 |
| `userProfile.residencyStatus` | `residency.status` | ⚠️ Module-dependent | ❌ Not in FR policy | **Requires adapter** (enum vs string) | 2 |
| `userProfile.income` | `employment.grossMonthlyIncome` | ⚠️ Redacted in slice for FR | ✅ In policyDocument for merge | **Requires review** — redundant with mergedInput; privacy leak in legacy shim | 2 |
| `userProfile.householdSize` | `household.size` | ✅ When allowed | ✅ | **Safe** | 1 |
| `systemState.insurance.hasCoverage` | `insurance.hasCoverage` | ❌ FR policy excludes | ❌ | **Blocked** until policy updated | 1 |
| `systemState.insurance.type` | `insurance.type` | ❌ FR policy excludes | ❌ | **Blocked** until policy updated | 1 |
| `systemState.benefits.daysInGermany` | `benefits.daysInGermany` | ❌ FR policy excludes | ❌ | **Blocked** until policy updated | 1 |
| `systemState.benefits.receivingBuergergeld` | `benefits.receivingBuergergeld` | ❌ FR policy excludes | ❌ | **Blocked** (unused by modules today) | 2 |
| `systemState.benefits.receivingAlg1` | `benefits.receivingAlg1` | ❌ FR policy excludes | ❌ | **Blocked** (unused) | 3 |
| `systemState.benefits.receivingWohngeld` | `benefits.receivingWohngeld` | ❌ FR policy excludes | ❌ | **Blocked** (unused) | 3 |
| `systemState.employmentStatus` | `employment.status` | ✅ Partial | ✅ | **Requires adapter** — shape `{ status }` vs flat enum | 2 |
| `context.location` (string) | `location.city` + `location.bundesland` | ✅ Structured in slice | ✅ | **Requires adapter** — format/parse; no module reads today | 3 |

### 4.2 Classification summary

| Classification | Count (runtime module reads) | Items |
|----------------|------------------------------:|-------|
| **Safe migration** | 3 | `userProfile.language` (×2 modules), `userProfile.householdSize` (unused read) |
| **Requires adapter** | 4 | `residencyStatus`, `income` shim, `employmentStatus` shape, `location` string |
| **Blocked** | 4 | `systemState.insurance.*`, `systemState.benefits.daysInGermany` for financial-reality (policy gap) |

---

## 5. Redundant AppContext Data Assessment

### 5.1 Fields redundant when Profile Engine is authoritative

| AppContext field | Redundant with | Still needed today? | Removal impact |
|------------------|----------------|:-------------------:|----------------|
| `userProfile.language` | `profileSlice.preferredLanguage` | Yes — 2 modules + web | **Medium** — update 2 modules + 6 web call sites |
| `userProfile.residencyStatus` | `profileSlice.residency.status` | No module reads | **Low** — shim removal only |
| `userProfile.income` | `mergedInput.grossIncome` / profile employment | No module reads | **Low** — but tests assert it; privacy concern while present |
| `userProfile.householdSize` | `mergedInput.householdSize` / profile household | No module reads | **Low** |
| `systemState.insurance` | `profileSlice.insurance` | Yes — financial-reality (broken) | **High** — fix read path first |
| `systemState.benefits` | `profileSlice.benefits` | Yes — financial-reality (broken) | **High** — fix read path first |
| `systemState.employmentStatus` | `profileSlice.employment.status` | No module reads | **Low** |
| `location` (top-level string) | `profileSlice.location` | No module reads | **Low** |

### 5.2 Non-redundant AppContext fields (keep)

| Field | Role |
|-------|------|
| `profileSlice` | Policy-filtered module view — **target read surface** |
| `profileId`, `profileVersion`, `profileSchemaVersion` | Profile binding metadata |
| `sessionId` | Runtime correlation |
| `dataProvenance` | Audit trail |
| `inputOverrides` (via request, not stored on AppContext schema) | Ephemeral execute overrides |

### 5.3 Privacy inconsistency (must fix in MVP-R3)

| Field | profileSlice (financial-reality) | Legacy shim | Issue |
|-------|----------------------------------|-------------|-------|
| Gross income | **Redacted** (`FIELD_REDACTED`) | `userProfile.income` **populated** | Legacy shim leaks sensitive field module policy redacts from slice |

This violates the policy layer intent documented in Phase 1.7. Retiring `userProfile.income` is not optional for a coherent security model.

---

## 6. Proposed Deprecation Sequence

### Phase 1 — Read profile first, fallback to legacy (MVP)

**Goal:** Modules prefer `profileSlice` / `mergedInput`; legacy fields remain populated for compatibility.

| Step | Action | Owner |
|------|--------|-------|
| 1.1 | Expand `FINANCIAL_REALITY_POLICY.allowedFields` to include `insurance`, `benefits` | Profile policy |
| 1.2 | Update `financial-reality` to read `context.profileSlice?.insurance?.hasCoverage` and `context.profileSlice?.benefits?.daysInGermany` with fallback to `systemState` | Module |
| 1.3 | Update `healthcare-navigation` and `system-translation` to read `profileSlice.preferredLanguage` with fallback to `userProfile.language` | Modules |
| 1.4 | Add regression tests: profile with `daysInGermany: 90` → Anmeldung rule fires | Module test |
| 1.5 | Stop populating `userProfile.income` in context-builder OR redact consistently | Profile engine |

**Estimated effort:** 2–3 days  
**Risk:** Low — additive reads with fallback

---

### Phase 2 — Emit warnings on legacy access (MVP hardening)

**Goal:** Detect remaining legacy consumers before removal.

| Step | Action |
|------|--------|
| 2.1 | Add dev-only `warnLegacyContextAccess(moduleId, field)` in module execute wrapper or context proxy |
| 2.2 | Log when `systemState` / `userProfile` read paths used after profileSlice available |
| 2.3 | Update tests to assert `profileSlice` reads, not legacy shims |
| 2.4 | Document deprecated fields in `AppContext` JSDoc / OpenAPI |

**Estimated effort:** 1 day  
**Risk:** Low — observability only

---

### Phase 3 — Remove legacy reads (pre-Beta)

**Goal:** Zero module reads of `systemState` or `userProfile`.

| Step | Action |
|------|--------|
| 3.1 | Remove fallback branches from financial-reality, healthcare, system-translation |
| 3.2 | Remove `userProfile` / `systemState` construction from `context-builder.ts` |
| 3.3 | Update provenance field names to `profileSlice.*` namespace |
| 3.4 | Update all profile/API tests |

**Estimated effort:** 2 days  
**Risk:** Medium — breaking for external clients sending legacy overrides in `body.context`

---

### Phase 4 — Remove legacy fields from AppContext (Beta — BETA-R9)

**Goal:** Schema cleanup; single context shape.

| Step | Action |
|------|--------|
| 4.1 | Remove `userProfile`, `systemState` from `AppContextSchema` |
| 4.2 | Remove `UserProfileSchema`, `SystemStateSchema` or mark deprecated exports |
| 4.3 | Update web: stop sending `{ userProfile: { language } }`; use profile PATCH for language |
| 4.4 | Update session API: store `profileId` only, not legacy context blobs |
| 4.5 | Migration note for any third-party API consumers |

**Estimated effort:** 3–5 days (includes web + session refactor)  
**Risk:** **High** — API breaking change; requires version bump or feature flag

---

## 7. Risk Assessment

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|:----------:|:------:|------------|
| R-01 | Financial-reality admin rules silently wrong today | **Certain** | **High** | Phase 1 policy + read fix |
| R-02 | Removing `userProfile.income` breaks undocumented clients | Low | Medium | Phase 1 fallback, Phase 2 warnings |
| R-03 | Policy expansion exposes benefits/insurance to financial module unnecessarily | Low | Low | Already intended — rules need this data |
| R-04 | `profileSlice` redaction vs admin rules needing sensitive fields | Medium | Medium | Use policyDocument internally for rules, not exposed slice — or explicit `ruleContext` in merge |
| R-05 | Web language override bypasses profile | Medium | Low | Phase 4: language only via profile PATCH |
| R-06 | Session legacy context misleads developers | Medium | Medium | Document S-01; simplify session model in Phase 4 |
| R-07 | Phase 4 breaks API contract | High if rushed | High | Gate on Beta; semver major |

**Overall MVP-R3 execution risk (Phases 1–3):** **Low–Medium**  
**Overall platform risk if MVP-R3 deferred:** **High** — financial-reality admin guidance is wrong for profile-bound users

---

## 8. Recommended Execution Order

| Order | Work item | Depends on | Target gate |
|:-----:|-----------|------------|-------------|
| 1 | Expand financial-reality policy (`insurance`, `benefits`) | — | MVP Phase 1 |
| 2 | Fix financial-reality reads (`profileSlice` + fallback) | #1 | MVP Phase 1 |
| 3 | Add Anmeldung / Krankenkasse regression tests | #2 | MVP Phase 1 |
| 4 | Migrate healthcare + system-translation language read | — | MVP Phase 1 |
| 5 | Redact or remove `userProfile.income` shim | Policy review | MVP Phase 1 |
| 6 | Legacy access warnings | #2–4 | MVP Phase 2 |
| 7 | Remove legacy reads in modules | #6 stable | Pre-Beta Phase 3 |
| 8 | Remove context-builder shims | #7 | Pre-Beta Phase 3 |
| 9 | Web + session + schema cleanup | #8 | Beta Phase 4 |

**Parallel-safe:** Steps 4 and 1–2 can proceed in parallel after policy decision on #1.

---

## 9. Success Criteria Answers

### 9.1 Which modules still depend on `systemState`?

| Module | Depends? | Fields | Notes |
|--------|:--------:|--------|-------|
| `financial-reality` | **Yes** | `insurance.hasCoverage`, `benefits.daysInGermany` | Only production consumer |
| `benefits-simulator` | No | — | Context ignored |
| `healthcare-navigation` | No | — | Insurance via merged input |
| `system-translation` | No | — | — |
| `life-event` | No | — | — |
| `grocery-optimization` | No | — | — |

### 9.2 Which modules still depend on `userProfile`?

| Module | Depends? | Fields | Notes |
|--------|:--------:|--------|-------|
| `healthcare-navigation` | **Yes** | `language` | |
| `system-translation` | **Yes** | `language` | |
| `financial-reality` | No | — | |
| `benefits-simulator` | No | — | |
| `life-event` | No | — | |
| `grocery-optimization` | No | — | |

**Non-module consumers:** Web client (6 call sites), session API, context-builder (writer), tests.

### 9.3 What blocks complete retirement of legacy AppContext fields?

| Blocker | Severity | Resolves in |
|---------|:--------:|-------------|
| `financial-reality` reads `systemState` + policy excludes insurance/benefits | **Critical** | Phase 1 |
| 2 modules read `userProfile.language` | Medium | Phase 1 |
| Web sends `userProfile` on every execute | Medium | Phase 4 |
| Session API accepts/stores legacy context | Medium | Phase 4 |
| `userProfile.income` privacy leak vs policy redaction | High | Phase 1 |
| `AppContextSchema` still exports legacy types | Low | Phase 4 |
| Tests assert legacy field shapes | Low | Phases 1–3 |

### 9.4 Can MVP-R3 execute before Beta?

| Phase | Before Beta? | Rationale |
|-------|:------------:|-----------|
| **Phase 1** (read profile first) | ✅ **Yes — required for MVP** | Fixes silent admin-rule bug; 3 module touch points |
| **Phase 2** (warnings) | ✅ Yes | Low cost, high observability |
| **Phase 3** (remove legacy reads) | ✅ Yes — recommended pre-Beta | 3 modules + context-builder; no schema break |
| **Phase 4** (remove schema fields) | ⚠️ **Beta (BETA-R9)** | API + web breaking; aligns with platform audit |

**Answer:** **Yes.** MVP-R3 Phases 1–3 should complete **before Beta**. Phase 4 aligns with BETA-R9 and should not block MVP user testing if Phases 1–3 ship.

---

## 10. Brutal Honesty — Current State Grade

| Dimension | Grade | Comment |
|-----------|:-----:|---------|
| Single source of truth | **D** | Two parallel representations actively maintained |
| Module consistency | **C-** | Benefits Simulator clean; Financial Reality broken for profile-bound rules |
| Policy alignment | **D+** | Policy excludes domains modules need via legacy path |
| Privacy coherence | **C** | profileSlice redacts income; userProfile.income does not |
| Migration readiness | **B** | Small blast radius — only 3 modules read legacy fields |

The platform **claims** Profile Engine authority but **still ships legacy mirrors that lie** about insurance and benefits for the most important financial module. MVP-R3 is not polish — it is a **correctness fix**.

---

*End of audit. No implementation proposed.*
