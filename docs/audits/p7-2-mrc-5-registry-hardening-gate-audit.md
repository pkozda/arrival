# P7.2 — MRC-5 Registry Hardening Gate Audit

**Project:** Arrival Atlas (ArrivalOS)  
**Document Type:** Architecture Gate Audit  
**Domain:** Module Runtime Platform (MRC)  
**Phase:** MRC-5 — Registry Hardening & Contract Enforcement  
**Auditor role:** Independent Principal Runtime Architect  
**Status:** Gate Review  
**Version:** 1.0  
**Date:** June 2026  

**Reference documents:**

- [Module Runtime Contract v1.0 — Specification](../architecture/module-runtime-contract-v1-specification.md) §5
- [MRC ADL — Architecture Decision Layer v1.0](../architecture/mrc-adl-architecture-decision-layer.md)
- [Module Runtime Evolution Roadmap](../architecture/module-runtime-evolution-roadmap.md) — MRC-5
- [P7.0 — Module Runtime Architecture Audit](./p7-0-module-runtime-architecture-audit.md)

**Baseline claimed by implementation team:** MRC-5 complete; 45/45 `@arrivalos/module-runtime` tests; 155/155 API tests.

**Scope:** Read-only audit of actual implementation. No code changes performed.

---

## 1. Executive Summary

MRC-5 delivers a **parallel contract registry** (`MrcModuleContractRegistry`) with bootstrap validation, normalizer shape checks, registry freeze semantics (declared), and an execution guard on the **primary API execute path**. The implementation does **not** modify MRC-2/MRC-3/MRC-4 enrichment logic; backward compatibility for valid module executions is preserved.

However, the audit finds **material gaps between claimed “registry hardening” and actual enforcement authority**:

1. **Two registries coexist** — `globalRegistry` (core, authoritative for execute) and `MrcModuleContractRegistry` (module-runtime, authoritative for guard). They are bootstrapped from the same static list today but are **not structurally unified or cross-validated at runtime**.
2. **`freeze()` is not immutability-authoritative** — `Object.freeze()` on JavaScript `Map` instances does **not** prevent `.set()` / `.delete()`. Nested contract objects remain mutable.
3. **Registered normalizers are not the runtime execution path** — MRC-3/MRC-4 still call `normalizeRecommendations()` / `buildActionItems()` directly. Registry normalizers are validated copies, not invoked during enrichment.
4. **Guards are bypassable** — any caller of `globalRegistry.execute()` or `ModuleRuntime` without `contractRegistry` skips MRC-5 entirely.

For the **current six production modules** with synchronized bootstrap, the primary `POST /api/modules/:id/execute` path is protected. The phase is **not yet a long-term governance foundation** as specified in Contract v1.0 §5 and the MRC-5 roadmap success criteria (“New modules register through the registry only”).

**Gate verdict: PASS WITH CONDITIONS**

**Lock recommendation: LOCK MRC-5 WITH FOLLOW-UP TASKS**

---

## 2. Part 1 — Architectural Compliance

### 2.1 Intended vs Actual Architecture

| Layer | Intended | Actual | Aligned? |
|-------|----------|--------|----------|
| Bootstrap | validate → register contracts → register normalizers → freeze | `bootstrapMrcContractRegistry(allModuleRegistrations)` in `build-app.ts` | ✅ Partial |
| Execute guard | `guardModuleExecution()` before execute | Guard in `build-app.ts` before `globalRegistry.execute()` | ✅ Primary path |
| Enrichment | MRC-2 → MRC-3 → MRC-4 → seal | Unchanged in `buildModuleResultEnvelope.ts` | ✅ |
| Registry ownership | Single authoritative registry | **Dual:** `globalRegistry` + `MrcModuleContractRegistry` | ❌ |
| Normalizer registration | Registry drives runtime | Validated at bootstrap; **not used at runtime** | ❌ |

### 2.2 Bootstrap Lifecycle (Verified)

```text
buildApp()
  → ensureModulesRegistered()        // globalRegistry.register via registerAllModules
  → ensureMrcContractRegistry()      // bootstrapMrcContractRegistry + freeze()
  → ModuleRuntime({ contractRegistry })
```

`bootstrapMrcContractRegistry()`:

1. Validates each `ModuleRegistration` via `validateModuleRegistration()`
2. Registers `RegisteredModuleContract` with static `MODULE_CONTRACT_SPECS`
3. Registers recommendation/action normalizers for `financial-reality` and `benefits-simulator` only
4. Returns unfrozen registry; caller calls `freeze()`

**Gap:** Bootstrap reads `allModuleRegistrations` — not `globalRegistry.list()`. No assertion that both registries contain the same module set.

### 2.3 Execution Guard Placement (Verified)

| Path | Guard? | Notes |
|------|--------|-------|
| `POST /api/modules/:id/execute` | ✅ | `guardModuleExecution(contractRegistry, id)` before execute |
| `ModuleRuntime.execute()` with `contractRegistry` | ✅ | Fail-fast before registry execute |
| `ModuleRuntime.execute()` without `contractRegistry` | ❌ | Used in unit tests |
| `globalRegistry.execute()` direct | ❌ | Used in tests, could be used by future code |
| `packages/core` `executeModule()` | ❌ | No guard |
| MRC shadow path | ✅ | Uses `moduleRuntime` from `buildApp` with `contractRegistry` |

### 2.4 Architectural Questions — Answers

| Question | Answer |
|----------|--------|
| Is implementation aligned with intended architecture? | **Partially** — guard placement correct on primary path; registry model diverges |
| Hidden runtime paths bypassing validation? | **Yes** — direct `globalRegistry.execute()`, optional `contractRegistry` |
| Can modules execute without successful registration? | **Yes** — if bypassing guard; **No** — on guarded API path if not in contract registry |
| Can modules execute after failed validation? | **No** on API path if bootstrap threw; **Yes** via unguarded paths |
| Can execution occur before freeze? | **No** on API path — guard rejects unfrozen registry |
| Capability inspection support? | **Stub** — `getCapabilities()` returns static spec; empty profile fields |

---

## 3. Part 2 — Contract Enforcement

### 3.1 `validateModuleRegistration()` — Completeness

**Validated today:**

| Field | Validated |
|-------|-----------|
| `moduleId` kebab-case | ✅ |
| semver `version` | ✅ |
| duplicate id (when `existingIds` passed) | ✅ |
| `module.id === registration.id` | ✅ |
| `execute()` is function | ✅ |
| `inputSchema` / `outputSchema` present | ✅ |
| non-empty `name` | ✅ |

**Not validated (Contract v1.0 / roadmap gaps):**

| Field / rule | Status |
|--------------|--------|
| `runtimeContractVersion === '1.0'` on module | ❌ Not checked on registration |
| `enabled` / `featureFlags` shape | ❌ |
| Capabilities match actual module output | ❌ |
| Forbidden dependencies (UX, DPSS, trace) | ❌ No static or runtime check |
| Determinism / side-effect freedom | ❌ |
| Registration synced with `globalRegistry` | ❌ |
| `description` non-empty | ❌ Optional de facto |

**Invalid registrations that still pass:** Any module with valid id/semver/schemas/execute passes — including modules that violate R-SE-* or R-DET-* rules. Structural validation only.

### 3.2 Contract Shape Validation

| Shape | Validated | Exhaustive? |
|-------|-----------|---------------|
| `ActionItem` | ✅ At normalizer registration | Partial — id regex may reject valid `benefits-recommendation-N` patterns if record name invalid |
| `Recommendation` | ✅ | Partial |
| `ModuleExplanation` | ✅ summary, confidence, factors array | **No** — `ExplanationFactor` fields not validated |
| `ModuleResult` | ❌ | Not part of MRC-5 |

**Malformed structures that can survive:** Explanation factors with invalid `source`, missing `id`/`label`, empty factors array — all pass if parent array exists.

**Determinism of validation errors:** ✅ Stable ordered error arrays for same input.

### 3.3 Normalizer Validation

**At registration (`validateRecommendationNormalizer` / `validateActionNormalizer`):**

- ✅ Must be function
- ✅ Must return array
- ✅ Must not throw on sample payloads (errors collected, not propagated)
- ✅ Mutation check via `JSON.stringify` before/after (weak for undefined/key order; sufficient for plain JSON payloads)
- ✅ Output shape validation on **2 fixed sample payloads per module**

**Runtime gaps:**

| Question | Answer |
|----------|--------|
| Can normalizer mutate inputs? | Detected only on samples at registration; **not monitored at runtime** |
| Can normalizer return malformed objects at runtime? | **Yes** — only sample payloads validated |
| Are runtime normalizers fully protected? | **No** — execution uses direct imports, not registry lookups |

**Critical architectural note:** Registry stores validated normalizer functions but `enrichModuleResultSemantics()` and `enrichModuleResultActions()` never read from the registry. MRC-5 validates a **mirror** of production normalizers.

---

## 4. Part 3 — Freeze & Immutability

### 4.1 `registry.freeze()` Implementation

```typescript
this.frozen = true;
Object.freeze(this.modules);
Object.freeze(this.recommendationNormalizers);
Object.freeze(this.actionNormalizers);
```

### 4.2 Verified JavaScript Behavior

`Object.freeze()` on a `Map` **does not block** `.set()` or `.delete()`. Verified: frozen Map size increases after `.set()`.

### 4.3 Post-Freeze Mutability Assessment

| Operation | Blocked? |
|-----------|----------|
| `registerModuleContract()` when `frozen=true` | ✅ Returns error |
| `Map.set()` on frozen Map | ❌ **Still possible** |
| Mutate `RegisteredModuleContract.spec` in place | ❌ **Still possible** |
| Replace normalizer function via Map.set | ❌ **Still possible** |
| `frozen` flag bypass via new registry instance | N/A — new instance not used in production |

**Verdict:** Freeze is **flag-gated**, not **structurally authoritative**. The `frozen` boolean prevents API methods from returning success, but does not enforce immutability against intentional or accidental mutation.

---

## 5. Part 4 — Execution Guards

### 5.1 `guardModuleExecution()` — Verified Checks

1. Registry must be frozen
2. Module must exist in contract registry
3. Required recommendation normalizer present (per spec)
4. Required action normalizer present (per spec)
5. `validateRegistrations()` passes globally

**Not checked:**

- Module enabled in `globalRegistry`
- Module version match between registries
- Core registry registration existence
- Capability entitlement alignment

### 5.2 Fail-Fast Behavior

On guard failure, API returns HTTP 422 with `{ success: false, error: string }` — **does not execute module**, **does not write DPSS**, **does not enrich**. ✅

### 5.3 Bypass Surface

| Bypass | Severity | Production exposure |
|--------|----------|---------------------|
| Direct `globalRegistry.execute()` | High | Low today; high for future contributors |
| `ModuleRuntime` without `contractRegistry` | Medium | Tests only |
| Unguarded code paths | High | P7.0 noted API still calls `globalRegistry` directly by design |

**Shadow runtime:** Uses guarded `ModuleRuntime` — does not bypass. ✅

**Determinism:** Guard outcome deterministic for same registry state and moduleId. ✅

---

## 6. Part 5 — Backward Compatibility

### 6.1 MRC-2 / MRC-3 / MRC-4 Unchanged

Audited files — **no modifications** in MRC-5 PR scope to:

- `wrapLegacyExecutionResult.ts`
- `enrichModuleResult.ts`
- `enrichModuleResultActions.ts`
- `buildActionItems.ts`
- `normalizeRecommendations.ts`
- `sealModuleResult.ts`

### 6.2 Semantic Impact

For modules passing guard, execution results are **bit-identical** to pre-MRC-5 behavior (guard is pre-execute gate only).

Registry metadata (`getCapabilities`) is **not consumed** by enrichment pipeline — no semantic influence. ✅

### 6.3 Compatibility Verdict

**PASS** — MRC-5 does not alter runtime output shapes or enrichment logic for successful executions.

---

## 7. Part 6 — ADL Compliance

| ADL area | Compliant? | Evidence |
|----------|------------|----------|
| FLAG rules | ✅ | No new flags introduced |
| CONF rules | ✅ | Confidence pipeline untouched |
| ACT rules | ✅ | Action derivation untouched |
| MEM rules | ✅ | Payload seal untouched |
| UX rules | ✅ | No UX/snapshot/orchestrator integration |
| LEG rules | ✅ | DPSS schema unchanged; legacy `result` primary |

**ADL verdict:** ✅ No ADL violations introduced by MRC-5.

---

## 8. Part 7 — Security & Failure Analysis

| ID | Risk | Severity | Impact | Likelihood | Recommended fix |
|----|------|----------|--------|------------|-----------------|
| R-01 | `Object.freeze(Map)` does not immutably lock registry | **High** | Registry poisoning after “freeze” | Medium (requires code bug or malicious plugin) | Replace with frozen snapshot + read-only interface; or seal maps via closure |
| R-02 | Dual registry drift (`globalRegistry` vs contract registry) | **High** | Module executes without contract or contract without execute | Low today (static list); **High** when adding modules | Bootstrap cross-validation; single registration API |
| R-03 | Normalizers validated but not invoked from registry | **High** | False confidence — swapped normalizer at runtime undetected | Medium | Route MRC-3/4 through registry normalizer lookup |
| R-04 | Guard bypass via direct `globalRegistry.execute()` | **High** | Unvalidated execution | Medium in development | Mandatory guard wrapper; MRC-7 contract test |
| R-05 | Core `ModuleRegistry` not frozen | **Medium** | Late `register()` / `setEnabled()` after bootstrap | Low | Freeze core registry post-bootstrap (MRC-5 roadmap) |
| R-06 | Normalizer validation uses 2 samples only | **Medium** | Malformed output on unseen payloads | Medium | Expand golden fixtures; optional runtime assertion behind dev flag |
| R-07 | `JSON.stringify` mutation detection | **Low** | Misses subtle mutations | Low | Use `structuredClone` equality |
| R-08 | Bootstrap order: modules before contract | **Low** | Theoretical race in multi-init | Very low | Single init function |
| R-09 | Startup throw on bootstrap failure | **Low** (positive) | Process fails to start | N/A | Keep — fail-fast is correct |
| R-10 | `getCapabilities()` stub | **Medium** | Incorrect discovery/entitlement alignment | Medium | Populate from module metadata (MRC-6/7) |

**Critical:** None for current six-module static deployment **if bootstrap succeeds**.

---

## 9. Part 8 — Missing Requirements

### 9.1 Roadmap MRC-5 (not implemented)

| Requirement | Status |
|-------------|--------|
| Module discovery via unified registry | Partial — stub capabilities |
| Version management | ❌ Not implemented |
| “New modules register through registry only” | ❌ Dual registration paths |
| Freeze `globalRegistry` after bootstrap | ❌ Only contract registry flagged |
| `validateRegistrations()` checks capabilities vs output | ❌ |

### 9.2 Contract v1.0 §5 (partially implemented)

| Requirement | Status |
|-------------|--------|
| `ModuleRegistry` interface with `validateRegistrations()` | Partial — separate class, not core registry |
| `getCapabilities()` | Stub |
| Registry frozen after bootstrap | Declared, not structurally enforced |
| Capability/output alignment | ❌ |

### 9.3 Validation gaps (future failure points)

- No `ModuleResult` envelope validation
- No `ExplanationFactor` deep validation
- No runtime normalizer output check post-enrichment
- No forbidden-import enforcement
- No module determinism tests at registration

### 9.4 Deferred appropriately to MRC-6 / MRC-7

- Snapshot integration of contract registry
- Contract tests forbidding direct `globalRegistry.execute()` at API boundary
- Governance test suite (R-DET, R-SE, R-OUT rules)
- Full capability-driven profile policy alignment

---

## 10. Findings Summary

### Critical

None identified for current production configuration with synchronized static module list.

### High

| ID | Finding |
|----|---------|
| H-01 | Registry `freeze()` uses `Object.freeze(Map)` — **does not prevent mutation** |
| H-02 | Dual registry architecture — contract registry is not authoritative for module code registration |
| H-03 | Validated normalizers are not wired into MRC-3/MRC-4 execution path |
| H-04 | Execution guard bypassable outside primary API path |

### Medium

| ID | Finding |
|----|---------|
| M-01 | `validateModuleRegistration()` omits contract-version and capability/output alignment |
| M-02 | Normalizer validation limited to two sample payloads |
| M-03 | `getCapabilities()` returns empty profile field requirements |
| M-04 | No bootstrap cross-check between `globalRegistry` and contract registry |
| M-05 | `ExplanationFactor` / `ModuleResult` not validated |
| M-06 | Core registry remains mutable after bootstrap |

### Low

| ID | Finding |
|----|---------|
| L-01 | `validateModuleRegistrationBatch()` exported but unused in bootstrap |
| L-02 | `ModuleRegistryCapabilitiesExtension` interface not integrated with core registry |
| L-03 | Mutation detection via JSON serialization is approximate |

---

## 11. Compliance Matrix

| Requirement | Source | Status | Notes |
|-------------|--------|--------|-------|
| Bootstrap validation | MRC-5 spec | ✅ Partial | Structural module validation |
| Register contracts | MRC-5 spec | ✅ | Static `MODULE_CONTRACT_SPECS` |
| Register normalizers | MRC-5 spec | ✅ | financial + benefits only |
| Freeze registry | MRC-5 spec | ⚠️ Conditional | Flag-only freeze |
| Execution guard | MRC-5 spec | ✅ | Primary API path |
| Fail-fast invalid modules | MRC-5 spec | ✅ | On guarded path |
| No MRC-2/3/4 changes | ADL | ✅ | Verified |
| No UX/DPSS/snapshot changes | ADL | ✅ | Verified |
| Unified ModuleRegistry | Roadmap | ❌ | Parallel registry |
| Version management | Roadmap | ❌ | Not implemented |
| Registry-only registration | Roadmap | ❌ | Dual path |
| Capability inspection | Contract §5 | ⚠️ Partial | Stub |
| Normalizer runtime enforcement | MRC-5 prompt | ❌ | Validation-only mirror |
| Immutable post-freeze | MRC-5 prompt | ❌ | Map freeze ineffective |
| Forbidden dependency detection | MRC-5 prompt | ❌ | Not implemented |
| ModuleResult shape validation | Contract | ❌ | Deferred |

---

## 12. Readiness Scores

| Dimension | Score (0–100) | Rationale |
|-----------|---------------|-----------|
| Architecture | **58** | Dual registry; normalizers disconnected from runtime |
| Contract Enforcement | **55** | Structural validation only; sample-bound normalizers |
| Immutability | **32** | `Object.freeze(Map)` ineffective; nested objects mutable |
| Runtime Safety | **72** | Primary API path guarded; bypass surfaces remain |
| Backward Compatibility | **95** | No semantic changes to enrichment |
| Operational Readiness | **68** | Startup bootstrap + fail-fast; incomplete governance |
| **Overall** | **63** | Safe for current scope; not foundation-grade |

---

## 13. Recommended Fixes (Prioritized)

### Before treating MRC-5 as governance foundation (P1)

1. **Replace Map freeze** with closure-sealed read-only registry or immutable snapshot returned from `freeze()` (no mutable Map exposure).
2. **Cross-validate** `globalRegistry.list()` and contract registry module sets at bootstrap — throw on mismatch.
3. **Wire enrichment** to invoke normalizers via registry lookup (or formally document registry as validation-only until MRC-7).
4. **Add MRC-7 contract test** — API must not call unguarded `globalRegistry.execute()`.

### During MRC-6 / MRC-7 (P2)

5. Extend `validateModuleRegistration()` with `runtimeContractVersion` and capability rules.
6. Expand normalizer golden fixtures to full module fixture corpus.
7. Deep-validate `ExplanationFactor` and optional post-enrichment envelope assertion (dev-only).
8. Freeze core `ModuleRegistry` after bootstrap.

### Documentation (P1, no code)

9. Document dual-registry model and guard bypass paths in architecture spec.
10. Clarify MRC-5 scope: **validation firewall at bootstrap + API guard**, not unified registry replacement.

---

## 14. Gate Verdict

### Decision: **PASS WITH CONDITIONS**

MRC-5 is **acceptable to lock** for the current production module catalog because:

- Primary execute path is guarded
- Bootstrap fail-fast prevents startup with invalid financial/benefits normalizers
- MRC-2/3/4 semantics are unchanged
- ADL constraints are respected

MRC-5 is **not acceptable as the long-term runtime governance foundation** without P1 fixes.

### Lock Recommendation: **LOCK MRC-5 WITH FOLLOW-UP TASKS**

| Action | Required before MRC-6? |
|--------|------------------------|
| Lock MRC-5 code as phase baseline | ✅ Yes |
| P1 immutability + dual-registry sync | ✅ Yes |
| P1 normalizer wiring or explicit validation-only ADL amendment | ✅ Yes |
| P2 full Contract §5 compliance | Recommended during MRC-7 |

---

## 15. Sign-Off Checklist

- [x] Architecture pipeline verified
- [x] Contract enforcement reviewed
- [x] Freeze immutability tested (Map behavior confirmed)
- [x] Execution guard placement mapped
- [x] Backward compatibility confirmed
- [x] ADL compliance confirmed
- [x] Risk register produced
- [x] Gate verdict issued
- [ ] P1 follow-up tasks tracked for MRC-6 gate

---

## 16. Final Statement

MRC-5 successfully introduces a **deterministic validation and guard layer** without contaminating MRC-2/MRC-3/MRC-4 semantics. The implementation team’s test claims are credible for the audited scope.

Strict assessment: the phase **partially fulfills** the MRC-5 roadmap and PR prompt. Registry hardening is **real but incomplete** — particularly immutability, registry unification, and runtime normalizer authority.

**Do not treat “freeze” or “registry” as fully authoritative until P1 fixes land.**
