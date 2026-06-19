---
id: mvp-r3-phase3-removal-readiness
title: MVP-R3 Phase 3 Removal Readiness
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: platform
status: active
maturity: stable
owner: system
tags:
  - legacy-removal
created: 2026-06-01
updated: 2026-06-19
related:
---

# MVP-R3 Phase 3 — Legacy Context Removal Readiness Audit

**Date:** June 2026  
**Auditor role:** Principal Platform Refactoring Engineer  
**Refactor ID:** MVP-R3 Phase 3  
**Prerequisite:** Phase 1 (financial `profileSlice` policy + module reads) and Phase 2 (language migration) complete  
**Status:** Audit only — **no implementation**

**Related docs:**  
`docs/audits/mvp-r3-single-source-truth-audit.md`,  
`docs/audits/mvp-r3-runtime-legacy-read-check.md`,  
`docs/audits/mvp-r3-financial-policy-audit.md`,  
`docs/archive/user-profile-engine/policy-layer-report.md`

---

## Executive Summary

Runtime modules no longer **primarily** depend on `userProfile` or `systemState`. However, **legacy shims are still constructed on every profile-bound execute** in `context-builder.ts`, and **inbound legacy shapes are still accepted** by `AppContextSchema` and the web client.

**Verdict:**

| Question | Answer |
|----------|--------|
| Can `context-builder` stop creating `systemState`? | **Yes — now** (no runtime module consumers) |
| Can `context-builder` stop creating `userProfile`? | **Conditionally — not safely in isolation** |
| Does any production runtime module still need legacy context? | **No** (primary reads migrated); **two modules retain fallback reads** |
| Can MVP-R3 Phase 3 execute before Beta? | **Partially yes** — staged removal recommended |

**Recommended approach:** Execute Phase 3 as **three sub-phases** (3a systemState, 3b userProfile shim + fallbacks + web, 3c schema at Beta). Do **not** remove `AppContextSchema` fields in Phase 3.

---

## 1. Legacy Context Construction Audit

### 1.1 `context-builder.ts` — what it builds

| Block | Lines (approx.) | Source data | Output field |
|-------|-----------------|-------------|--------------|
| Language resolution | 48–66 | `requestOverrides.userProfile.language` → `policyDocument.preferredLanguage` | Feeds `userProfile.language` + provenance/trace |
| `userProfile` object | 68–76 | `policyDocument` + `requestOverrides.userProfile` | `context.userProfile` |
| `userProfile` provenance/trace | 78–130 | Per-field override vs profile | `dataProvenance`, trace steps |
| `location` string | 132–142 | `requestOverrides.location` or formatted `policyDocument.location` | `context.location` |
| `systemState` object | 144–160 | `policyDocument` benefits/insurance/employment + `requestOverrides.systemState` | `context.systemState` |
| `systemState` provenance | 162–167 | Partial (daysInGermany, hasCoverage only) | `dataProvenance` |
| `buildWithoutProfile` | 182–192 | Passthrough `requestOverrides` only | Raw `userProfile`, `systemState`, `location` |

### 1.2 `resolve-execution-context.ts` integration

```
requestContext (from API body.context)
        │
        └──► buildAppContext({ requestOverrides: requestContext })
```

**Critical behavior:** Inbound `userProfile` from the execute request body is treated as **override input** to the shim builder — not as the authoritative profile. `profileSlice` is built separately from `ProfileDocument` via policy and is **not** overridden by `requestContext.userProfile.language`.

**Implication:** Web sending `{ userProfile: { language: 'de' } }` on execute **does not change** `profileSlice.preferredLanguage` when a profile is bound. Phase 2 modules read `profileSlice` first, so UI language override on execute is **effectively ignored** for bound-profile sessions. Language must come from `ProfileDocument.preferredLanguage` (profile PATCH) or from the fallback path when `profileSlice` is absent.

### 1.3 Session integration

| Endpoint / function | Legacy role | Merged into execute? |
|---------------------|-------------|:--------------------:|
| `POST /api/sessions` | Stores `context.userProfile` from body | **No** |
| `GET /api/sessions/:id` | Returns stored `session.context` | **No** |
| `PATCH /api/sessions/:id` | Merges `userProfile` / `systemState` into session | **No** |
| `POST /api/modules/:id/execute` | Uses `x-session-id` for **profile binding only** | Session `context` **not read** |

Session legacy storage is **orphaned** relative to module execution. It still matters for API contract and future features, but not for current runtime module paths.

### 1.4 Inbound parsing (`AppContextSchema`)

`apps/api/src/build-app.ts` line 79:

```typescript
const rawContext = AppContextSchema.parse(body.context ?? {});
```

Inbound requests **must** still validate if clients send `userProfile` / `systemState`. Removing shim **construction** does not remove **acceptance** until Phase 4 schema change.

---

## 2. Dependency Matrix

### 2.1 `userProfile` fields

| Legacy field | Remaining consumer | Consumer type | Runtime? | Can remove shim now? |
|--------------|-------------------|---------------|:--------:|:--------------------:|
| `userProfile.language` | `healthcare-navigation` (fallback in `resolveHealthcareNavigationLanguage`) | Module | Yes | **No** — fallback + Case B tests |
| `userProfile.language` | `system-translation` (fallback in `resolveSystemTranslationLanguage`) | Module | Yes | **No** — fallback + Case B tests |
| `userProfile.language` | `context-builder` (override input via `requestOverrides`) | Platform | Yes | **No** — web sends on every execute |
| `userProfile.language` | `AppContextSchema.parse` (inbound) | API | Yes | **No** — schema Phase 4 |
| `userProfile.language` | Web module pages + `AppProvider` (execute + session create) | Client | Yes | **No** — Beta blocker |
| `userProfile.language` | `session/index.ts` (merge on PATCH) | Session | Yes | **No** — Beta blocker |
| `userProfile.residencyStatus` | None (module/runtime) | — | No | **Yes** — shim only |
| `userProfile.income` | `profile.integration.test.ts`, `resolve-execution-context.test.ts` | Test | No | **Yes** — shim only; **should remove** (privacy leak) |
| `userProfile.householdSize` | None (module/runtime) | — | No | **Yes** — shim only |

### 2.2 `systemState` fields

| Legacy field | Remaining consumer | Consumer type | Runtime? | Can remove shim now? |
|--------------|-------------------|---------------|:--------:|:--------------------:|
| `systemState.insurance.*` | None | — | No | **Yes** |
| `systemState.benefits.*` | None | — | No | **Yes** |
| `systemState.employmentStatus` | None | — | No | **Yes** |
| `systemState` (inbound) | `AppContextSchema.parse` | API | Yes | **No** — Phase 4 |
| `systemState` (storage) | `session/index.ts` | Session | Yes | **No** — Phase 4 |

### 2.3 `location` string shim

| Field | Remaining consumer | Consumer type | Runtime? | Can remove now? |
|-------|-------------------|---------------|:--------:|:---------------:|
| `context.location` (formatted string) | None (modules) | — | No | **Yes** — `profileSlice.location` + input merge |
| `context.location` (override) | `context-builder` inbound `requestOverrides.location` | Platform | Yes | **No** — until override path redesigned |

### 2.4 Legacy provenance / trace paths

| Provenance field prefix | Produced by | Consumed by | Can rename/remove now? |
|-------------------------|-------------|-------------|:----------------------:|
| `userProfile.language` | `context-builder` | Tests, `dataProvenance` on context | After shim removal |
| `userProfile.income` | `context-builder` | Tests | **Yes** — replace with `profileSlice` or drop |
| `userProfile.residencyStatus` | `context-builder` | None | **Yes** |
| `userProfile.householdSize` | `context-builder` | None | **Yes** |
| `systemState.benefits.daysInGermany` | `context-builder` | None | **Yes** |
| `systemState.insurance.hasCoverage` | `context-builder` | None | **Yes** |
| `context.userProfile.*` (trace) | `context-builder` | Trace API | After shim removal |
| `context.location` (trace) | `context-builder` | Trace API | Low priority |

---

## 3. Removal Readiness Classification

### 3.1 Safe now

| Item | Rationale |
|------|-----------|
| Stop building `systemState` in `context-builder` | Zero runtime module readers after Phase 1 |
| Stop populating `userProfile.income` | Privacy leak vs redacted `profileSlice`; no module consumer |
| Stop populating `userProfile.residencyStatus`, `userProfile.householdSize` | No module consumers |
| Stop building top-level `location` string | No module reads `context.location`; healthcare uses input merge + `profileSlice.location` |
| Remove `systemState.*` provenance entries | No downstream consumers |

### 3.2 Safe after test updates

| Item | Tests affected |
|------|----------------|
| Remove `userProfile.income` assertions | `resolve-execution-context.test.ts`, `profile.integration.test.ts` (+ duplicates) |
| Remove `userProfile.income` provenance expectations | Same |
| Update trace expectations (`context.userProfile.*` → `profileSlice.*`) | Profile trace tests |
| Phase 2 module Case B tests | Must be removed or rewritten when fallback removed |

### 3.3 Beta blocker (coordinate before full shim removal)

| Item | Blocker |
|------|---------|
| Remove entire `userProfile` shim | Web sends `userProfile.language` on all 5 module execute calls |
| Remove `userProfile.language` module fallbacks | Unbound-profile executes rely on `buildWithoutProfile` passthrough |
| Remove `AppContextSchema.userProfile` | Breaking API contract for `POST /api/modules/:id/execute` body |
| Session API `userProfile` merge | `POST/PATCH /api/sessions` |
| `AppProvider` `createSession({ userProfile })` | Session bootstrap |

### 3.4 Cannot remove (still required by production path)

| Item | Why |
|------|-----|
| `AppContextSchema` legacy fields (Phase 3 scope) | Inbound validation until Phase 4 — **schema removal is separate** |
| `buildWithoutProfile` passthrough | Sessions without bound profile + web execute payloads |
| Module `userProfile.language` fallback | Until web migrates and unbound-profile story is defined |

---

## 4. Context-Builder Simplification Evaluation

### 4.1 Blocks that can be removed

| Block | Removable in Phase 3? | Preconditions |
|-------|:---------------------:|---------------|
| `systemState` construction (lines 144–167) | ✅ **Yes** | Test/provenance cleanup only |
| `userProfile.income` population | ✅ **Yes** | Update 2–4 tests |
| `userProfile.residencyStatus`, `householdSize` | ✅ **Yes** | None |
| `location` string formatting | ✅ **Yes** | No module dependency |
| Full `userProfile` object | ⚠️ **Staged** | Module fallback removal + web migration |
| `buildWithoutProfile` legacy passthrough | ❌ **Phase 4** | Web + schema |

### 4.2 Proposed simplified `buildAppContext` (target state)

```
buildAppContext():
  return {
    sessionId,
    profileId,
    profileVersion,
    profileSchemaVersion,
    profileSlice,        // authoritative module view
    dataProvenance,      // profileSlice.* + merge provenance only
  }
```

**Estimated LOC reduction:** ~120 lines removed from `context-builder.ts` (65% of file).

### 4.3 Files affected by full Phase 3 implementation

| Package | Files | Impact |
|---------|-------|--------|
| `@arrival-atlas/profile` | `context-builder.ts`, `resolve-execution-context.test.ts`, `profile.integration.test.ts` | High |
| `@arrival-atlas/modules` | `healthcare-navigation/index.ts`, `system-translation/index.ts`, both `*.test.ts` | Medium — remove fallbacks |
| `@arrival-atlas/core` | `types/index.ts` | **Phase 4 only** |
| `apps/web` | 6 files (AppProvider + 5 module pages) | **Phase 3b/4** — stop sending `userProfile` |
| `apps/api` | `build-app.ts`, session routes, 2 API tests | Low (inbound parse unchanged in 3a) |
| `packages/core` | `session/index.ts` | **Phase 4** |

### 4.4 Test impact estimate

| Suite | Tests to update | New tests |
|-------|----------------:|----------:|
| `@arrival-atlas/profile` | 4–6 | 0–2 (profileSlice provenance) |
| `@arrival-atlas/modules` | 4 (Phase 2 Case B) | 0 |
| `@arrival-atlas/api` | 2 (session seed) | 0 |
| **Total** | **~10–12** | **0–2** |

### 4.5 API impact

| Surface | Phase 3a (systemState only) | Phase 3b (userProfile shim) | Phase 4 (schema) |
|---------|:---------------------------:|:---------------------------:|:----------------:|
| `POST /api/modules/:id/execute` response | Unchanged (returns module result, not context) | Unchanged | May reject legacy body fields |
| `GET /api/modules/:id/trace` | Trace field names change if provenance renamed | Same | Same |
| `POST /api/sessions` | Unchanged | Unchanged | Breaking if schema tightens |
| External API consumers | None known | Low risk if clients only send, never read context | Medium |

---

## 5. Privacy Issue — Must Address in Phase 3

| Field | `profileSlice` (financial-reality) | `userProfile` shim | Policy intent |
|-------|-----------------------------------|-------------------|---------------|
| `employment.grossMonthlyIncome` | **Redacted** | Exposed as `userProfile.income` | Violated |

Removing `userProfile.income` from context-builder is **not optional** for policy coherence. This can ship in Phase 3a without waiting for web migration.

---

## 6. Recommended Removal Order

### Phase 3a — Low risk (can ship immediately)

| Step | Action |
|------|--------|
| 3a.1 | Remove `systemState` construction + provenance from `context-builder.ts` |
| 3a.2 | Remove `userProfile.income`, `residencyStatus`, `householdSize` from shim (or entire fields except language if keeping partial shim) |
| 3a.3 | Remove `location` string shim (keep `profileSlice.location`) |
| 3a.4 | Update profile integration + resolve tests |
| 3a.5 | Verify no module regression (43 module tests) |

**Effort:** ~0.5–1 day  
**Risk:** Low

### Phase 3b — Coordinated (pre-Beta, requires web)

| Step | Action |
|------|--------|
| 3b.1 | Web: stop sending `{ userProfile: { language } }` on execute; rely on profile `preferredLanguage` |
| 3b.2 | Web: migrate `AppProvider` session create (store `profileId` only or empty context) |
| 3b.3 | Remove `userProfile.language` fallback from healthcare + system-translation |
| 3b.4 | Remove remaining `userProfile` construction from `context-builder` |
| 3b.5 | Rename provenance/trace fields to `profileSlice.*` namespace |
| 3b.6 | Update Phase 2 Case B tests (remove or replace with profile-bound scenarios) |

**Effort:** ~2–3 days  
**Risk:** Medium — language override behavior changes for unbound sessions

### Phase 3c — Beta (BETA-R9)

| Step | Action |
|------|--------|
| 3c.1 | Remove `userProfile`, `systemState` from `AppContextSchema` |
| 3c.2 | Simplify `session/index.ts` — store `profileId` metadata only |
| 3c.3 | Remove `UserProfileSchema`, `SystemStateSchema` exports |
| 3c.4 | API major version or migration note |

**Effort:** ~3–5 days  
**Risk:** High (breaking)

---

## 7. Risk Assessment

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|:----------:|:------:|------------|
| R3-01 | Removing `userProfile` shim breaks web language on execute | High | Medium | Web migration in 3b; document that language comes from profile |
| R3-02 | Unbound-profile executes lose language without fallback | Medium | Medium | Default `en` in modules; or require session profile binding |
| R3-03 | Provenance/trace field rename breaks trace consumers | Low | Low | No external trace consumers documented |
| R3-04 | Premature schema removal breaks API clients | Medium | High | Defer to Phase 3c / Beta |
| R3-05 | `userProfile.income` removal breaks tests only | Certain | Low | Update 4 test files |
| R3-06 | Inbound `userProfile` override silently ignored today | **Already true** for bound profiles | Low | Document; fix in 3b |

---

## 8. Success Criteria Answers

### 8.1 Can `context-builder` stop creating `userProfile`?

**Not entirely in one step.**

| Sub-field / aspect | Can stop now? |
|--------------------|:-------------:|
| `userProfile.income` | ✅ Yes |
| `userProfile.residencyStatus`, `householdSize` | ✅ Yes |
| `userProfile.language` (full object removal) | ❌ No — needs 3b (module fallback + web) |

### 8.2 Can `context-builder` stop creating `systemState`?

**Yes — immediately.** No runtime module, platform execute path, or test depends on the **output** shim (tests previously asserted absence when policy excluded domains; now `profileSlice` is authoritative).

### 8.3 Does any production code still need legacy context?

| Layer | Needs legacy? | Details |
|-------|:-------------:|---------|
| Runtime modules (primary) | **No** | Migrated in Phase 1–2 |
| Runtime modules (fallback) | **Yes** | 2 modules, `userProfile.language` only |
| Profile platform (`context-builder`) | **Yes** | Still constructs shims |
| API (inbound parse) | **Yes** | `AppContextSchema` accepts legacy |
| Web client | **Yes** | Sends `userProfile` on execute + session |
| Session store | **Yes** | Persists legacy (unused on execute) |

**No production module needs legacy as primary source.** Legacy is still **written and sent**, not **read for core logic** (except fallbacks).

### 8.4 Can MVP-R3 Phase 3 execute before Beta?

| Sub-phase | Before Beta? | Recommendation |
|-----------|:------------:|----------------|
| **3a** — `systemState` + income leak + dead shim fields | ✅ **Yes — now** | Ship as next PR |
| **3b** — full `userProfile` shim removal + fallbacks + web | ✅ **Yes — pre-Beta** | Required for MVP-R3 completion |
| **3c** — schema + session API | ⚠️ **Beta (BETA-R9)** | Do not bundle with 3a/3b |

**Answer:** **Phase 3 can begin before Beta** with 3a immediately. **Full MVP-R3 completion** (zero legacy shims in context-builder, zero module fallbacks) is achievable **before Beta** if 3b includes web migration. **Schema removal** should remain Beta.

---

## 9. Brutal Bottom Line

The platform has won the **read path** battle. It has not won the **write path** war.

`context-builder.ts` still manufactures a parallel profile reality on every execute — including a **policy-violating income leak** — while modules correctly read `profileSlice`. Removing `systemState` is free. Removing `userProfile` requires admitting that the web client still speaks legacy and either migrating it or accepting that Phase 2 fallbacks are not yet removable.

**Do Phase 3a this week. Schedule 3b with frontend. Leave 3c for Beta.**

---

*End of audit. No implementation proposed.*
