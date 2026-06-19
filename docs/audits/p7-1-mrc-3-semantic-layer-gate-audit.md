---
id: p7-1-mrc-3-semantic-layer-gate-audit
title: P7.1 MRC-3 Semantic Layer Gate Audit
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: core
status: active
maturity: stable
owner: system
tags:
  - mrc-3
  - semantic-layer
created: 2026-06-01
updated: 2026-06-19
related:
---

# P7.1 — MRC-3 Semantic Layer Gate Audit

**Project:** Arrival Atlas  
**Document Type:** Architecture Gate Audit  
**Domain:** Module Runtime Platform (MRC)  
**Phase:** MRC-3 — Explanation Model & Recommendation Normalization  
**Status:** Gate Review  
**Version:** 1.0  
**Date:** June 2026  

**Reference documents:**

- [Module Runtime Contract v1.0 — Specification](../core/module-runtime-contract-v1.md)
- [P7.0 — Module Runtime Architecture Audit](./p7-0-module-runtime-architecture-audit.md)
- [MRC Evolution Roadmap](../archive/module-runtime-evolution-roadmap.md)

**Scope:** Read-only validation of MRC-3 implementation. No code changes performed.

**Baseline:** MRC-1 + MRC-2 + MRC-3 implemented; 18/18 `@arrival-atlas/module-runtime` tests, 154/154 API tests passing.

---

## 1. Executive Summary

MRC-3 introduces a **wrapper-only semantic layer** that normalizes legacy module outputs into `Recommendation[]` and `ModuleExplanation` inside the `ModuleResult` envelope. The audit confirms:

- **Legacy execution is unchanged** — `globalRegistry.execute()` output (`data`) is not mutated by enrichment.
- **Default production behavior is unchanged** — both `ARRIVAL_ATLAS_MRC_ENVELOPE` and `ARRIVAL_ATLAS_MRC_EXPLANATION` default to off; API responses and DPSS writes match pre-MRC-2 semantics.
- **UI snapshot and UX orchestrator remain legacy-driven** — `buildUiSnapshot()` projects domain `result` via `getLegacyDomainResult()`; `packages/ux` post-hoc parsing is untouched.
- **Semantic derivation is bounded** — all fields trace to payload, profile slice, provenance, or merged input. No LLM or external inference.
- **Gaps exist but are non-blocking** — execution trace is not consumed; a few synthetic fallback strings appear when legacy fields are empty; flag interaction requires both envelope flags for explanation to activate.

**Gate verdict: Conditional Yes** — MRC-4 (Action Framework) may proceed after addressing two high-risk flag and confidence-stability items. No blocking defects found.

---

## 2. Architecture Validation Results

### 2.1 Runtime Pipeline (Verified)

```text
resolveExecutionContext()
  → globalRegistry.execute()          [authoritative legacy output]
  → attachModuleResultEnvelope()      [API primary path]
      → buildModuleResultEnvelope()
          → wrapLegacyExecutionResult()     [if ARRIVAL_ATLAS_MRC_ENVELOPE=true]
          → enrichModuleResultSemantics()   [if ARRIVAL_ATLAS_MRC_EXPLANATION=true]
  → DPSS MODULE_EXECUTE (result.data + optional moduleResult)
  → attachUxToExecutionResult(legacy)   [UX still reads legacy.data]
  → API response { success, data, moduleResult? }
```

Parallel shadow path (`runMrcShadowValidation`) invokes `ModuleRuntime.execute()` asynchronously in non-production — does not affect responses or DPSS.

### 2.2 Runtime Layer Checklist

| Check | Result | Evidence |
|-------|--------|----------|
| Determinism preserved for legacy output | ✅ Pass | Enrichment reads `legacy.data` after execute; no re-execution in primary path |
| No side effects in semantic layer | ✅ Pass | Normalizers are pure functions; no I/O, no DPSS/profile writes |
| Envelope only enriches, never mutates legacy | ✅ Pass | `enrichModuleResultSemantics` returns new object spread; `legacy.data` untouched (verified in tests) |
| `ARRIVAL_ATLAS_MRC_ENVELOPE` gates envelope | ✅ Pass | `buildModuleResultEnvelope` returns `undefined` when off |
| `ARRIVAL_ATLAS_MRC_EXPLANATION` gates semantics | ✅ Pass | `enrichModuleResultSemantics` no-ops when off |
| Payload is reference, not clone | ⚠️ Note | `wrapLegacyExecutionResult` sets `payload: legacy.data` (shared reference) — safe today, fragile if future code mutates `moduleResult.payload` |

---

## 3. Semantic Layer Audit

### 3.1 Input Sources (Actual vs Required)

| Source | Used in normalizers | Used in `generateModuleExplanation` |
|--------|---------------------|-------------------------------------|
| Module output (`legacy.data`) | ✅ Primary | ✅ Summary, ruleIds, buergergeld reasoning |
| Profile slice (`runtimeContext`) | ❌ Not in per-module normalizers | ✅ Fixed field list in `profileSliceToFactors` |
| Merged input | ❌ Not in normalizers | ✅ `mergedInputToFactors` |
| Data provenance | ❌ Not in normalizers | ✅ `provenanceToFactors` |
| Execution trace | ❌ **Not used** | ❌ **Not used** |
| External / inferred | ❌ None | ⚠️ See §3.3 |

**Finding:** Execution trace is stored in DPSS but **not incorporated** into MRC-3 explanation factors. This is a spec drift item, not a hallucination risk.

### 3.2 Recommendation Normalization

#### Financial Reality (`normalizeFinancialRealityRecommendations`)

| Legacy field | Transformation | Assessment |
|--------------|----------------|------------|
| `decisions[]` | → `Recommendation` with index-based ids | ✅ Deterministic |
| `benefits.buergergeld` eligible | → Additional recommendation | ✅ Derived from output |
| `meta.confidence` | → Per-recommendation explanation confidence | ✅ Passthrough |
| `decisions[].action` | **Not mapped** | 🟡 Action strings ignored (MRC-4 surface) |

**v2 engine note:** When `decisions[]` is empty (common for v2 pipeline output), `recommendations` may be `[]` while module-level `explanation` still generates from `verdict.summary`. Semantically valid but uneven across modules.

#### Benefits Simulator (`normalizeBenefitsSimulatorRecommendations`)

| Legacy field | Transformation | Assessment |
|--------------|----------------|------------|
| `recommendations[]` | → Canonical `Recommendation` | ✅ Id preserved |
| `riskWarnings[]` | → Additional `Recommendation` entries | ✅ Severity → priority |
| `rationale` | → `ModuleExplanation` via `rationaleToExplanation` | ✅ |
| `riskWarnings[].action` | **Not mapped** | 🟡 Deferred to MRC-4 |

#### Generic modules

Returns `[]` — safe fallback, no synthetic recommendations.

### 3.3 Synthetic / Fallback Text (Hallucination Risk)

| Location | Fallback | Risk |
|----------|----------|------|
| `resolveSummary()` | `"Execution completed successfully"` | 🟡 Low — only when no summary and no recommendations |
| Bürgergeld recommendation | `"Household income may qualify..."` when `reasoning[]` empty | 🟡 Medium — text not present in module output |
| `mapFinancialPriority` / `mapBenefitsPriority` | Default `'medium'` | 🟢 Bounded default |

**Verdict:** No LLM-style hallucination. Two template strings exist when legacy fields are absent — acceptable for gate, should be documented as non-authoritative in MRC-4.

### 3.4 Confidence Handling

| Stage | Behavior |
|-------|----------|
| MRC-2 wrap | `readPayloadConfidence(payload)` → `meta.confidence` |
| MRC-3 enrich | `resolveConfidence()` may downgrade `high` → `medium` when `profileId` or `profileSlice` missing |
| Post-enrich | `meta.confidence` **overwritten** with `explanation.confidence` |

**Finding:** Enabling `ARRIVAL_ATLAS_MRC_EXPLANATION` can change `moduleResult.meta.confidence` relative to MRC-2-only envelope for the same execution. Deterministic, but **flag-dependent semantic drift** between envelope-only and envelope+explanation modes.

### 3.5 Factor Duplication

`generateModuleExplanation` concatenates:

1. Provenance factors  
2. Profile slice factors  
3. Merged input factors  
4. Bürgergeld reasoning factors  
5. **All recommendation explanation factors** (via `collectRecommendationFactors`)

Recommendation-level factors are duplicated at module level. Intentional aggregation vs noise — **medium maintainability concern**, not a correctness bug.

---

## 4. Cross-Module Consistency Report

| Dimension | Financial Reality | Benefits Simulator | Generic |
|-----------|-------------------|--------------------|---------|
| Normalizer present | ✅ | ✅ | ❌ (empty array) |
| `Recommendation` shape | ✅ Canonical | ✅ Canonical | N/A |
| Priority vocabulary | `high/medium/low` only | `critical/high/medium/low` | N/A |
| Per-item `explanation` | ✅ Always present | ✅ Always present | N/A |
| `scopeRef` usage | Bürgergeld only | scenarioId | N/A |
| Module-level `explanation` | From `verdict.summary` or fallback | From `summary` field | Generic fallback |
| Legacy `action` field use | Ignored | Ignored | N/A |

### Semantic Drift Risks

| ID | Risk | Severity |
|----|------|----------|
| SD-1 | Financial Reality v2 often produces empty `decisions[]` → sparse recommendations vs Benefits Simulator | 🟡 Medium |
| SD-2 | `adminRules` stored as raw strings in `ruleIds` vs normalized ids like `buergergeld_eligible` | 🟡 Medium |
| SD-3 | Benefits `recommendations[]` + `riskWarnings[]` merged into one list — potential duplicate `id` if schemas collide | 🟡 Medium |
| SD-4 | Four other registered modules have no normalizer — envelope explanation exists but recommendations always `[]` | 🟠 High (product consistency) |

---

## 5. Compatibility Check

### 5.1 DPSS

| Aspect | Status | Notes |
|--------|--------|-------|
| `StoredModuleExecution.result` | ✅ Unchanged when envelope off | Still raw domain object |
| Dual-write when envelope on | ✅ | `legacyResult` + `moduleResult` stored |
| `moduleResult` includes MRC-3 fields when both flags on at write time | ✅ | Frozen at persistence time |
| Structural schema change | ✅ None required | Optional fields only |
| Old sessions without `moduleResult` | ✅ | `resolveExecutionResult()` adapts via `legacyDomainToModuleResult` (MRC-2 shape only, no MRC-3 re-normalization) |

### 5.2 UI Snapshot

| Aspect | Status | Notes |
|--------|--------|-------|
| `executions[].result` | ✅ Legacy domain | `getLegacyDomainResult(entry)` |
| `resolveExecutionResult` in projection | ❌ Not used | Stored `moduleResult` not projected to UI — by design |
| UX orchestrator input | ✅ Legacy | `buildUXActionPlan` receives domain `result` |
| Web client | ✅ Unchanged | Reads snapshot domain shapes |

### 5.3 API Layer

| Mode | Response shape | Breaking? |
|------|----------------|-----------|
| Flags off (default) | `{ success, data, ... }` only | ✅ No |
| `ENVELOPE=true` | Adds `moduleResult` with `payload`, `meta` | ✅ Additive |
| `ENVELOPE=true` + `EXPLANATION=true` | Adds `recommendations`, `explanation` inside `moduleResult` | ✅ Additive |
| `data` vs `moduleResult.payload` | Same reference when envelope on | ⚠️ Theoretical coupling |

`buildExecuteApiResponse` spreads legacy first, attaches `moduleResult` — no field renames, no HTTP semantic changes.

---

## 6. Risk Register

| ID | Category | Risk | Severity | MRC-4 impact |
|----|----------|------|----------|--------------|
| R-01 | Flags | `ARRIVAL_ATLAS_MRC_EXPLANATION` has **no effect** without `ARRIVAL_ATLAS_MRC_ENVELOPE` | 🟠 High | Operators may think explanation is on when it is not |
| R-02 | Semantic | `meta.confidence` changes when explanation flag enabled | 🟠 High | Action priority logic must not assume stable confidence across flag combos |
| R-03 | Coverage | 4/6 modules have no recommendation normalizer | 🟠 High | MRC-4 actions uneven across module catalog |
| R-04 | Trace | Execution trace not used in explanation factors | 🟡 Medium | Auditability gap vs specification intent |
| R-05 | Copy | `payload` shares reference with `data` | 🟡 Medium | Mutation leak if MRC-4 mutates envelope in place |
| R-06 | Templates | Synthetic summary / Bürgergeld description when legacy empty | 🟡 Medium | Must not surface as authoritative in UI |
| R-07 | Duplication | Module explanation factors duplicate recommendation factors | 🟡 Medium | UI noise if all factors displayed |
| R-08 | ruleIds | `adminRules` free-text in `ruleIds` | 🟡 Medium | Action template mapping fragile |
| R-09 | Performance | Shadow `ModuleRuntime.execute()` doubles work in dev/test | 🟢 Safe | Production shadow off by default |
| R-10 | Performance | Enrichment is O(n) over recommendations/factors per request | 🟢 Safe | Negligible vs module execute cost |
| R-11 | Dual-layer | UX orchestrator + MRC recommendations coexist | 🟡 Medium | MRC-4 must define which source is authoritative |
| R-12 | Persistence | Stored `moduleResult` frozen without MRC-3 if flags off at write, on at read | 🟢 Safe | Re-normalization not attempted on read (consistent) |

**Blocking (🔴):** None identified.

---

## 7. MRC-4 Readiness Assessment

### 7.1 Is the system ready for Action Framework (MRC-4)?

**Verdict: Conditional Yes**

MRC-3 provides the necessary semantic primitives (`Recommendation`, `ModuleExplanation`, `ExplanationFactor`) and a working normalization boundary. MRC-4 can introduce `ActionItem[]` as an additional envelope field derived from:

- Legacy `decisions[].action` (Financial Reality)
- Legacy `riskWarnings[].action` (Benefits Simulator)
- Future mapping from `Recommendation` → `ActionKind`

…without modifying module domain logic, provided the conditional fixes below are addressed.

### 7.2 Unstable Semantic Assumptions (Stabilize Before MRC-4)

1. **Flag contract** — Document and optionally enforce: `EXPLANATION` implies `ENVELOPE`, or auto-enable envelope when explanation is requested.
2. **Confidence authority** — Decide whether `meta.confidence` or `explanation.confidence` is canonical when both exist; avoid silent overwrite surprises.
3. **Action source of truth** — MRC-4 must declare whether actions come from normalized `Recommendation`, legacy action strings, or UX orchestrator (today: UX still wins in snapshot).
4. **Module coverage** — At minimum, define generic action extraction or explicitly scope MRC-4 to Financial Reality + Benefits Simulator initially.

### 7.3 What Can Proceed Without Stabilization

- Adding `ActionItem[]` to envelope in wrapper layer (same pattern as MRC-3)
- Mapping existing legacy `action` string fields to `ActionKind` enum
- Contract tests forbidding action emission from module packages
- Keeping `actions` out of UI snapshot until MRC-6

---

## 8. Required Fixes (Prioritized)

No 🔴 blocking fixes required for gate passage.

### Priority 1 — Before MRC-4 implementation starts

| # | Fix | Type | Effort |
|---|-----|------|--------|
| 1 | Document flag dependency: `ARRIVAL_ATLAS_MRC_EXPLANATION` requires `ARRIVAL_ATLAS_MRC_ENVELOPE=true` | Docs / optional runtime warning | Low |
| 2 | Document `meta.confidence` overwrite behavior when explanation enabled | Docs | Low |
| 3 | Define MRC-4 action authority: envelope `actions[]` vs legacy UX orchestrator | Architecture decision | Low |

### Priority 2 — During MRC-4 (recommended)

| # | Fix | Type | Effort |
|---|-----|------|--------|
| 4 | Map `decisions[].action` and `riskWarnings[].action` → `ActionItem[]` in wrapper | Implementation | Medium |
| 5 | Clone `payload` in `wrapLegacyExecutionResult` (defensive) | Implementation | Low |
| 6 | Add execution trace steps to explanation factors (PROFILE_LOADED, MERGE_DECISION) | Implementation | Medium |

### Priority 3 — Technical debt (non-gating)

| # | Fix | Type | Effort |
|---|-----|------|--------|
| 7 | Normalizers for healthcare-navigation, life-event, etc. | Implementation | Medium |
| 8 | Deduplicate module-level vs recommendation-level factors | Refactor | Low |
| 9 | Normalize `adminRules` → stable `ruleIds` | Refactor | Medium |
| 10 | Remove or gate synthetic Bürgergeld fallback text | Refactor | Low |

---

## 9. Test Coverage Assessment

| Area | Covered? | Gap |
|------|----------|-----|
| Legacy payload unchanged | ✅ `module-explanation.test.ts` | — |
| Financial decisions → Recommendation | ✅ `normalize-recommendations.test.ts` | Not against live v2 engine output |
| Benefits riskWarnings → Recommendation | ✅ | — |
| Explanation always generated | ✅ | Allows empty recommendations |
| Determinism | ✅ Benefits simulator | Financial uses stripCalculatedAt for timestamps |
| API dual response | ✅ `module-result-envelope.test.ts` | — |
| Flag interaction (EXPLANATION without ENVELOPE) | ❌ | Should add negative test |
| Golden legacy output regression | ✅ Partial | Via stripCalculatedAt equality |

---

## 10. Gate Decision

| Criterion | Pass? |
|-----------|-------|
| Deterministic | ✅ |
| Non-invasive to legacy execution | ✅ |
| Backward compatible (default flags off) | ✅ |
| DPSS / snapshot / API safe | ✅ |
| Semantic layer bounded to known inputs | ✅ (with noted template exceptions) |
| Ready for MRC-4 extension | ✅ Conditional |

### Final Verdict

**MRC-3 GATE: PASS (Conditional)**

The semantic layer is safe to keep in production behind feature flags and safe to extend toward MRC-4. Proceed with Action Framework implementation after Priority 1 documentation/decisions. No code changes required to clear this gate.

---

## 11. Sign-Off Checklist

- [x] Runtime wrapper audited — no legacy mutation
- [x] Semantic derivation traced to input sources
- [x] Cross-module consistency assessed
- [x] DPSS / snapshot / API backward compatibility verified
- [x] Risk register produced
- [x] MRC-4 readiness verdict issued
- [ ] Priority 1 items acknowledged by team (operational)
