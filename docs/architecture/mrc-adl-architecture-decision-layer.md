# MRC ADL — Architecture Decision Layer (Final)

**Project:** Arrival Atlas (ArrivalOS)  
**Document Type:** Architecture Decision Layer (ADL)  
**Domain:** Module Runtime Platform (MRC)  
**Status:** Final — authoritative for MRC-4 implementation  
**Version:** 1.0  
**Date:** June 2026  

**Supersedes:** Ambiguities identified in [P7.1 — MRC-3 Semantic Layer Gate Audit](../audits/p7-1-mrc-3-semantic-layer-gate-audit.md) (R-01 through R-12, Priority 1 items).

**Aligns with:**

- [Module Runtime Contract v1.0 — Specification](./module-runtime-contract-v1-specification.md)
- [Module Runtime Evolution Roadmap](./module-runtime-evolution-roadmap.md)
- [P7.0 — Module Runtime Architecture Audit](../audits/p7-0-module-runtime-architecture-audit.md)
- [MRC-4 — Execution Blueprint (Action Framework)](./mrc-4-action-framework-execution-blueprint.md) — derived implementation spec

**Scope:** Locks semantic and runtime contracts before MRC-4 (Action Framework). No implementation in this document.

---

## 1. Decision Summary Table

| Decision ID | Area | Decision | Rationale | Impact |
|-------------|------|----------|-----------|--------|
| **FLAG-01** | Feature flags | `ARRIVALOS_MRC_EXPLANATION=true` **implicitly enables** `ARRIVALOS_MRC_ENVELOPE`. Runtime MUST treat ENVELOPE as on whenever EXPLANATION is on. | Removes silent no-op when operators enable explanation without envelope. | MRC-4 implementers MUST apply auto-promotion at flag read time; logs SHOULD note implicit promotion. |
| **FLAG-02** | Feature flags | Default for both flags is **off** (`!== 'true'`). No partial string matching. | Preserves pre-MRC production behavior. | Default API/DPSS/snapshot unchanged. |
| **FLAG-03** | Feature flags | `ARRIVALOS_MRC_SHADOW` is diagnostic-only; never gates envelope, explanation, or actions. | Shadow compares paths; must not affect authority. | Unchanged from MRC-1. |
| **CONF-01** | Confidence | `moduleResult.meta.confidence` is the **single canonical** module-level confidence. | One authority eliminates flag-dependent drift. | `explanation.confidence` MUST equal `meta.confidence` when explanation is present. |
| **CONF-02** | Confidence | Canonical confidence is computed by a **fixed pipeline**: (1) read from payload, (2) apply profile-context downgrade rule, (3) write to `meta.confidence`, (4) mirror to `explanation.confidence`. | Deterministic, traceable, no independent heuristics per field. | MRC-3 overwrite behavior is formalized, not accidental. |
| **CONF-03** | Confidence | Profile-context downgrade: if `profileId` or `profileSlice` is absent, `high` → `medium`. No other automatic downgrades. | Bounded transform already in MRC-3; locks scope. | Prevents future hidden downgrade rules. |
| **PRIO-01** | Priority | `Recommendation.priority` is authoritative for recommendation ordering within the envelope. | Recommendations are first-class MRC-3 output. | UX/snapshot MUST NOT re-derive recommendation priority from legacy shapes when envelope is consumed. |
| **PRIO-02** | Priority | `ActionItem.priority` (MRC-4) is authoritative for action ordering within the envelope. It is **independent** of `Recommendation.priority` unless explicitly linked via `recommendationId`. | Actions and recommendations serve different UX roles. | MRC-4 mapper MUST NOT copy recommendation priority blindly. |
| **ACT-01** | Actions | **Primary authority** for structured actions is `moduleResult.actions[]`, derived in the runtime wrapper from **legacy domain action fields** (`decisions[].action`, `riskWarnings[].action`, and module-specific equivalents). | Legacy module output remains authoritative; wrapper only normalizes. | MRC-4 implements normalizers; modules unchanged. |
| **ACT-02** | Actions | `Recommendation` objects do **not** produce `ActionItem` entries unless a legacy `action` field (or future explicit `actionRef`) exists on the source record. | Prevents inferring actions from recommendation text. | No synthetic actions from recommendations alone. |
| **ACT-03** | Actions | UX orchestrator output is **not** an input to `moduleResult.actions[]`. | Breaks circular dependency between post-hoc UX and envelope. | Two parallel systems until MRC-6. |
| **UX-01** | UX boundary | Until MRC-6: `uxSnapshot.actionCards` authority remains **`buildUXActionPlan(legacy domain results)`**. | Snapshot/UI not yet migrated. | MRC-4 does not switch snapshot source. |
| **UX-02** | UX boundary | From MRC-4 onward: API clients with envelope enabled MUST treat `moduleResult.actions[]` as authoritative for **per-module** actions; MUST NOT merge UX orchestrator output into `moduleResult`. | Clear consumer contract for new integrations. | Web client unchanged until MRC-6. |
| **UX-03** | UX boundary | Cross-module aggregation (priority signals, attention layer) remains UX orchestrator responsibility until MRC-6. | Orchestrator's unique value is multi-module ranking. | Envelope actions are per-execution, not cross-module. |
| **TRC-01** | Execution trace | Execution trace is an **optional enrichment source** for `ModuleExplanation.factors` only. It is **never required** for envelope validity. | Trace is diagnostic infrastructure; absence must not block execute. | MRC-3 may omit trace; MRC-4 MAY add trace-derived factors. |
| **TRC-02** | Execution trace | Only these trace step types MAY be promoted to explanation factors: `PROFILE_LOADED`, `POLICY_APPLIED`, `FIELD_REDACTED`, `MERGE_DECISION`, `INPUT_OVERRIDE`. | Prevents unbounded trace dumping into user explanations. | `ENGINE_STEP` and validation steps remain diagnostic-only. |
| **TRC-03** | Execution trace | Trace MUST NOT be used to compute confidence, priority, or actions. | Keeps semantics derived from module output + profile context. | Audit trail only for explanation factors. |
| **TXT-01** | Fallback text | Runtime-generated fallback strings are **non-authoritative** and MUST be marked `source: 'default'` on all derived `ExplanationFactor` entries. | Distinguishes synthetic from module-emitted text. | UI MAY display with reduced prominence; MUST NOT treat as module verdict. |
| **TXT-02** | Fallback text | Fallback text is permitted **only** when the corresponding legacy field is absent or empty. If legacy provides text, fallback MUST NOT be used. | Deterministic precedence. | Eliminates override of real module output. |
| **TXT-03** | Fallback text | When any `ExplanationFactor` has `source: 'default'`, module-level confidence MUST NOT exceed `medium`. | Caps authority of synthetic content. | Applies to generic success summary and Bürgergeld template. |
| **MEM-01** | Immutability | After envelope **seal** (see §6), `moduleResult` is **logically immutable**. No runtime layer MAY mutate any field. | Prevents reference-sharing bugs from becoming data corruption. | Applies to payload, recommendations, explanation, actions. |
| **MEM-02** | Immutability | At envelope seal, `moduleResult.payload` MUST be **structurally isolated** from `legacy.data` (deep clone or deep freeze of a clone). `legacy.data` and API `data` remain the same reference to each other. | Breaks shared-mutation risk while preserving legacy API contract. | MRC-4 implementation requirement; aligns with P7.1 R-05. |
| **MEM-03** | Immutability | Consumers of `moduleResult` MUST treat all envelope fields as read-only. Mutation is undefined behavior. | Consumer-side contract. | API clients, DPSS readers, snapshot (future). |
| **LEG-01** | Legacy | `StoredModuleExecution.result` (legacy domain) remains the **persistence primary** for backward compatibility. | DPSS schema frozen. | `moduleResult` is additive optional field. |
| **LEG-02** | Legacy | UI snapshot `executions[].result` remains legacy domain until **MRC-6**. | Phased migration. | MRC-4 does not change projection. |
| **LEG-03** | Legacy | `resolveExecutionResult()` on read MUST NOT re-run MRC-3/MRC-4 enrichment on stored legacy-only records. | Frozen-at-write semantics. | Old sessions get MRC-2-shaped envelope at most. |
| **DUAL-01** | DPSS | When envelope is enabled at write time, DPSS stores `result`, `legacyResult` (same as `result`), and `moduleResult` (full sealed envelope). | Dual-write already implemented. | `moduleResult` is authoritative for envelope consumers; `result` for legacy. |
| **SCOPE-01** | Module coverage | MRC-4 action normalizers are **required** for `financial-reality` and `benefits-simulator`; **optional** for other modules (empty `actions[]` is valid). | Matches MRC-3 normalizer scope. | Product may expand coverage later without contract change. |

---

## 2. Final Flag Semantics

### 2.1 Flag Definitions

| Flag | Environment variable | When `true` | When absent or not `true` |
|------|---------------------|-------------|---------------------------|
| Envelope | `ARRIVALOS_MRC_ENVELOPE` | Runtime produces `ModuleResult` envelope; API attaches `moduleResult`; DPSS dual-writes `moduleResult`. | No envelope. API returns `{ success, data }` only. DPSS stores `result` only. |
| Explanation | `ARRIVALOS_MRC_EXPLANATION` | Runtime enriches sealed envelope with `recommendations[]` and `explanation` per MRC-3 rules. | No semantic enrichment. Envelope contains `meta` + `payload` only (MRC-2 shape). |
| Shadow | `ARRIVALOS_MRC_SHADOW` | Non-production parallel `ModuleRuntime.execute()` for comparison logging. | Shadow off in production default. |

### 2.2 Dependency Rule (FLAG-01 — Normative)

```text
effectiveEnvelope =
  ARRIVALOS_MRC_ENVELOPE === 'true'
  OR ARRIVALOS_MRC_EXPLANATION === 'true'

effectiveExplanation =
  ARRIVALOS_MRC_EXPLANATION === 'true'
  AND effectiveEnvelope === true   // always true when explanation is true
```

**Rules:**

1. `ARRIVALOS_MRC_EXPLANATION=true` **without** `ARRIVALOS_MRC_ENVELOPE=true` → runtime MUST set `effectiveEnvelope = true` (implicit promotion).
2. `ARRIVALOS_MRC_EXPLANATION=true` with `ARRIVALOS_MRC_ENVELOPE=false` is **not an error**; it is a valid operator intent meaning "envelope + explanation".
3. `ARRIVALOS_MRC_ENVELOPE=true` with `ARRIVALOS_MRC_EXPLANATION=false` → envelope without recommendations/explanation (MRC-2 mode).
4. Both false → MRC-0 legacy mode.

### 2.3 Runtime Enforcement vs Documentation

| Rule | Enforcement |
|------|-------------|
| Implicit ENVELOPE when EXPLANATION on | **Runtime enforced** — flag reader MUST implement §2.2 |
| Default off | **Runtime enforced** — strict `=== 'true'` check |
| Shadow isolation | **Runtime enforced** — shadow path MUST NOT write to DPSS or alter response |
| Operator logging on implicit promotion | **SHOULD** log once per process: `MRC: EXPLANATION enabled; ENVELOPE implicitly enabled` |

Documentation alone is **insufficient** for FLAG-01. MRC-4 PR MUST update flag reader to enforce implicit promotion if not already present.

### 2.4 Flag Interaction Matrix (Final)

| ENVELOPE | EXPLANATION | Effective behavior |
|----------|-------------|-------------------|
| off | off | Legacy only |
| on | off | MRC-2 envelope (`meta` + `payload`) |
| off | on | MRC-3 full (implicit envelope promotion) |
| on | on | MRC-3 full |

### 2.5 MRC-4 Flag Extension (Predeclared)

`ARRIVALOS_MRC_ACTIONS` is **not introduced** in this ADL. Actions are produced whenever `effectiveExplanation === true` (i.e., explanation flag on) in MRC-4. Rationale: actions are semantic enrichment at the same layer as recommendations; splitting a third flag adds complexity without backward-compat benefit. If a future phase requires action-only mode, a new ADL revision is required.

---

## 3. Canonical Data Authority Model

### 3.1 Authority Hierarchy

```text
Layer 0 — Module domain output (legacy.data / payload source)
    ↓ read-only input to wrapper
Layer 1 — Runtime wrapper (normalizers, enrichers)
    ↓ produces sealed ModuleResult
Layer 2 — Persistence (DPSS moduleResult frozen at write)
    ↓
Layer 3a — API consumers (moduleResult authoritative when present)
Layer 3b — UI snapshot (legacy result authoritative until MRC-6)
Layer 3c — UX orchestrator (legacy result authoritative until MRC-6)
```

**Module domain output is always authoritative for facts.** The wrapper MAY normalize shape; it MUST NOT invent domain facts.

### 3.2 Field-Level Authority

| Field | Canonical source | Wins when conflict |
|-------|------------------|-------------------|
| `moduleResult.meta.confidence` | Runtime confidence pipeline (CONF-01, CONF-02) | **Always wins** over payload `meta.confidence` when envelope present |
| `explanation.confidence` | MUST equal `moduleResult.meta.confidence` | `meta.confidence` wins; `explanation.confidence` is a mirror, not independent |
| `recommendations[].priority` | Normalizer mapping from legacy priority/severity fields | Wins over any duplicate priority in legacy payload for envelope consumers |
| `recommendations[].explanation.confidence` | Per-item: from legacy item confidence if present, else `meta.confidence` | Item-level legacy wins; else meta |
| `actions[].priority` (MRC-4) | Normalizer mapping from legacy `action` metadata or explicit priority on source record | Wins within envelope; independent of recommendation priority |
| `uxSnapshot.actionCards[].priority` | UX orchestrator (`buildUXActionPlan`) | Wins for snapshot UX until MRC-6; **does not override** `moduleResult.actions[]` |
| Domain facts in `payload` | Legacy module `execute()` output | Wrapper MUST NOT alter numeric outcomes, eligibility booleans, or verdicts |

### 3.3 Confidence Pipeline (Normative)

```text
step1 = readPayloadConfidence(payload)           // high | medium | low from domain
step2 = if (profileId missing OR profileSlice missing)
          AND step1 === 'high'
        then 'medium' else step1
step3 = if any explanation factor has source === 'default'
        then min(step2, 'medium')                  // TXT-03: cannot exceed medium
        else step2
moduleResult.meta.confidence = step3
if (explanation present) explanation.confidence = step3
```

**Conflict resolution:** There is no situation where `explanation.confidence` and `meta.confidence` may differ when both are present. If implementation produces a mismatch, that is a **contract violation**.

### 3.4 Priority Conflict Resolution

| Conflict | Resolution |
|----------|------------|
| `Recommendation.priority` vs legacy `decisions[].priority` | Envelope `Recommendation.priority` wins for envelope consumers; legacy field unchanged in `payload` |
| `ActionItem.priority` vs `Recommendation.priority` | Independent unless `ActionItem.recommendationId` is set; then action priority defaults to linked recommendation priority only when action source record has no explicit priority |
| `uxSnapshot.actionCards` vs `moduleResult.actions` | **No conflict resolution** — they serve different surfaces (§4, §7). Consumers MUST NOT merge or deduplicate across layers until MRC-6 defines a unified projection |
| `critical` (Benefits) vs `high` (Financial) priority vocabularies | Normalizers MUST map to canonical `RecommendationPriority` enum; `critical` maps to `high` at envelope boundary |

---

## 4. Action Framework Boundary (MRC-4 Predefinition)

### 4.1 Primary Authority

**`moduleResult.actions[]` is the sole authoritative structured action list for envelope-enabled API consumers.**

### 4.2 Derivation Order (Deterministic)

For each module execution, the runtime wrapper builds `actions[]` in this order:

```text
1. Legacy domain action fields (PRIMARY)
   - financial-reality: decisions[].action (when present and non-empty)
   - benefits-simulator: riskWarnings[].action, recommendations[].action (when present)
   - other modules: module-specific legacy action fields if defined in normalizer

2. Empty list (FALLBACK)
   - when no legacy action fields exist or module has no action normalizer
```

**Explicitly excluded as sources:**

| Source | Status |
|--------|--------|
| (a) `decisions[].action` | ✅ Primary for financial-reality |
| (b) `riskWarnings[].action` | ✅ Primary for benefits-simulator |
| (c) Derived from `Recommendation` alone (no legacy action field) | ❌ Forbidden (ACT-02) |
| (d) UX orchestrator (`buildUXActionPlan`) | ❌ Forbidden as input (ACT-03) |

### 4.3 ActionItem Shape (Contract Reference)

MRC-4 MUST conform to `ActionItem` in Module Runtime Contract v1.0. Minimum required fields per item:

- `id` — stable, derived from legacy id or deterministic index
- `kind` — mapped from legacy action string via fixed lookup table (no NLP)
- `label` — from legacy action text or linked recommendation title
- `priority` — from legacy metadata or normalizer default (`medium`)
- `recommendationId` — optional link when action originated from a decision/warning with known id

### 4.4 Fallback Rules

| Condition | Result |
|-----------|--------|
| Module has action normalizer + legacy action fields | `actions[]` populated |
| Module has action normalizer + no legacy action fields | `actions[]` = `[]` |
| Module has no action normalizer | `actions[]` = `[]` (omitted or empty; both valid) |
| Legacy action string unrecognized by kind mapper | Include action with `kind: 'custom'`, preserve raw string in `label` |

### 4.5 Relationship to Recommendations

- A `Recommendation` and an `ActionItem` MAY reference the same underlying legacy record.
- They MUST be produced by separate normalizer passes (recommendations first, actions second).
- Action normalizer MUST NOT create actions for recommendations that lack an `action` field.

---

## 5. Execution Trace Policy

### 5.1 Classification

| Phase | Trace role |
|-------|------------|
| MRC-1 / MRC-2 | Ignored by envelope |
| MRC-3 | Optional enrichment source for explanation factors |
| MRC-4 | Optional enrichment source for explanation factors (unchanged) |
| MRC-6+ | May feed snapshot audit views; not user-primary narrative |

Execution trace is **never** a required input to envelope production. An execution with an empty trace MUST still produce a valid `ModuleResult`.

### 5.2 Permitted Trace → Explanation Mapping (TRC-02)

When trace is used, factors MUST be derived only from:

| Step type | Factor label | `source` value |
|-----------|--------------|----------------|
| `PROFILE_LOADED` | Profile | `profile` |
| `POLICY_APPLIED` | Policy | `rule` |
| `FIELD_REDACTED` | Redacted field name | `profile` |
| `MERGE_DECISION` | Field + merge source | `input` or `profile` |
| `INPUT_OVERRIDE` | Field + override | `input` |

### 5.3 Forbidden Trace Usage (TRC-03)

- MUST NOT derive `meta.confidence` from trace
- MUST NOT derive `Recommendation.priority` from trace
- MUST NOT derive `ActionItem` content from trace
- MUST NOT include `ENGINE_STEP`, `INPUT_VALIDATED`, `OUTPUT_VALIDATED` in user-facing `ModuleExplanation`

### 5.4 MRC-4 Inclusion

MRC-4 MAY add trace-derived factors to `ModuleExplanation` using §5.2 rules. MRC-4 MUST NOT add a separate `traceExplanation` field. Trace contribution is indistinguishable from other factors in `explanation.factors[]`.

---

## 6. Mutation & Immutability Contract

### 6.1 Envelope Lifecycle

```text
legacy = globalRegistry.execute(...)
envelope = wrap(envelope)           // creates ModuleResult shell
envelope = enrich(envelope)         // adds recommendations, explanation, actions
envelope = seal(envelope)           // MEM-01 / MEM-02 applied
→ persist, respond, never mutate
```

**Seal point:** Immediately after the last enrichment step (`enrichModuleResultSemantics` in MRC-3; action enrichment in MRC-4).

### 6.2 Payload Reference Safety (MEM-01, MEM-02)

| Artifact | Relationship to `legacy.data` | Rule |
|----------|------------------------------|------|
| API `data` | Same reference as `legacy.data` | Unchanged legacy contract |
| `moduleResult.payload` (pre-seal) | MAY share reference during construction | Implementation detail |
| `moduleResult.payload` (post-seal) | MUST NOT share mutable reference with `data` | Structural isolation required |
| DPSS `result` | Same as `legacy.data` | Unchanged |
| DPSS `moduleResult` | Sealed copy | Independent of subsequent in-memory mutation of `data` |

**Structural isolation** means: deep clone sufficient for JSON-serializable domain objects, OR deep freeze of a clone. Shallow copy alone is insufficient.

### 6.3 Post-Seal Prohibitions

After seal, the following MUST NOT occur in any runtime, API, DPSS, or projection layer:

- Assignment to any property of `moduleResult` or nested objects
- Push/splice/pop on `recommendations`, `actions`, or `factors` arrays
- In-place modification of `payload` fields

Re-enrichment of a stored envelope on read is forbidden (LEG-03).

### 6.4 Consumer Obligations (MEM-03)

API clients, tests, and future snapshot projections MUST NOT mutate received `moduleResult`. Defensive copying on the consumer side is permitted but not required.

---

## 7. Legacy System Compatibility Rules

### 7.1 Phased Authority Timeline

| Phase | `executions[].result` (snapshot) | `uxSnapshot.actionCards` | `moduleResult` (API) |
|-------|----------------------------------|--------------------------|----------------------|
| MRC-0 – MRC-3 (current) | Legacy domain | UX orchestrator | Optional; no actions |
| MRC-4 | Legacy domain | UX orchestrator | Adds `actions[]`; authoritative for API |
| MRC-6 | **ModuleResult-projected** (future ADL) | **Derived from envelope** (future ADL) | Authoritative |

### 7.2 UX Orchestrator Role After MRC-4

| Responsibility | Owner until MRC-6 | Owner at MRC-6 |
|----------------|-------------------|----------------|
| Per-module action cards in snapshot | UX orchestrator (legacy input) | Snapshot projection from `moduleResult.actions` |
| Cross-module priority ranking | UX orchestrator | Snapshot aggregation layer |
| Attention layer / priority signals | UX orchestrator | Snapshot aggregation layer |
| API execute response UX attachment | `attachUxToExecutionResult(legacy)` | Unchanged until API UX ADL revision |

**MRC-4 does not deprecate, modify, or replace the UX orchestrator.** It runs in parallel on the legacy path.

### 7.3 Snapshot Projection Authority

| Field | Authority (MRC-4 era) |
|-------|----------------------|
| `UiSnapshot.executions[].result` | `getLegacyDomainResult(entry)` — legacy domain |
| `UiSnapshot.executions[].moduleResult` | **Not projected** in MRC-4 |
| `UiSnapshot.uxSnapshot` | UX orchestrator output from legacy domain results |

### 7.4 Deprecation Strategy

| Component | Deprecation status |
|-----------|-------------------|
| Legacy domain `result` in DPSS | **Not deprecated** — remains persistence primary |
| UX orchestrator | **Soft deprecation** — frozen feature set; no new action sources added after MRC-4; full replacement scheduled MRC-6 |
| Post-hoc action parsing in `packages/ux` | No new module-specific parsers after MRC-4; existing parsers maintained until MRC-6 |
| `decisions[].action` in domain payload | **Not deprecated** — remains source for action normalizer |

No breaking removal before MRC-6.

---

## 8. Forbidden Behaviors

### 8.1 Modules MUST NOT

- Emit `ModuleResult`, `Recommendation`, `ActionItem`, or `ModuleExplanation` shapes directly (wrapper owns envelope)
- Perform I/O, DPSS writes, profile mutations, or entitlement checks inside `execute()`
- Call external inference services (LLM, remote rules) inside `execute()`
- Depend on `ExecutionTrace` content inside `execute()`
- Assume `moduleResult` exists in any consumer

### 8.2 Runtime MUST NOT

- Mutate `legacy.data` / API `data` during envelope construction or after seal
- Re-run enrichment when reading stored DPSS executions (LEG-03)
- Produce `explanation` or `actions` when `effectiveEnvelope` is false
- Treat UX orchestrator output as input to normalizers
- Invent domain facts (eligibility, amounts, verdicts) not present in payload
- Use execution trace for confidence, priority, or action derivation (TRC-03)
- Create `ActionItem` entries from `Recommendation` objects that lack a legacy `action` field (ACT-02)
- Allow `explanation.confidence` to differ from `meta.confidence` (CONF-01)

### 8.3 UX Layer MUST NOT (after MRC-4)

- Be consumed as a source for `moduleResult.actions[]` (ACT-03)
- Override `moduleResult` fields on API responses
- Write back into DPSS or module execution results
- Become a required dependency for envelope production

### 8.4 UI / Snapshot MUST NOT (until MRC-6)

- Read `moduleResult` from DPSS for rendering (not yet projected)
- Treat runtime fallback text (`source: 'default'`) as module verdict
- Merge `uxSnapshot.actionCards` with `moduleResult.actions` into a single authoritative list

### 8.5 API Consumers MUST NOT (when envelope enabled)

- Assume `data` and `moduleResult.payload` remain reference-equal after seal (MEM-02)
- Use `explanation.confidence` when `meta.confidence` is present (use `meta` only)

---

## 9. MRC-4 Implementation Checklist (Derived from ADL)

Implementers MUST satisfy before MRC-4 gate:

- [ ] FLAG-01: implicit ENVELOPE promotion when EXPLANATION on
- [ ] CONF-01: `explanation.confidence` mirrors `meta.confidence`
- [ ] CONF-02 / TXT-03: confidence pipeline includes default-factor cap
- [ ] MEM-02: structural isolation of `payload` at seal
- [ ] ACT-01: action normalizers for financial-reality and benefits-simulator
- [ ] ACT-02: no recommendation-only action synthesis
- [ ] TRC-01: trace remains optional; if used, only §5.2 step types
- [ ] TXT-01: fallback factors marked `source: 'default'`
- [ ] UX-01: snapshot and orchestrator unchanged
- [ ] Contract tests for all §8 forbidden behaviors

---

## 10. Document Authority

This ADL is the **final authority** for MRC-4 implementation. Where this document conflicts with:

- P7.1 audit recommendations labeled "documentation only" → this ADL supersedes
- Module Runtime Contract v1.0 ambiguous sections → this ADL supersedes for MRC-3/MRC-4 era
- Existing implementation that violates §6 (payload sharing) → implementation MUST conform by MRC-4 seal

Amendments require a new ADL revision (v1.1+) and gate review; MRC-4 MUST NOT ship with open ADL conflicts.

---

## 11. Sign-Off

| Decision area | Status |
|---------------|--------|
| FLAG-01 — ENVELOPE/EXPLANATION dependency | ✅ Locked |
| CONF-01 — confidence authority | ✅ Locked |
| ACT-01 — action source of truth | ✅ Locked |
| UX-01 — orchestrator boundary | ✅ Locked |
| TRC-01 — execution trace policy | ✅ Locked |
| TXT-01 — synthetic fallback policy | ✅ Locked |
| MEM-01 — payload immutability | ✅ Locked |

**MRC-4 may proceed.**
