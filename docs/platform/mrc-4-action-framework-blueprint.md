---
id: mrc-4-action-framework-blueprint
title: MRC-4 Action Framework Execution Blueprint
project: Arrival Atlas
system: Arrival Atlas
type: system
domain: platform
status: active
maturity: stable
owner: system
tags:
  - action-framework
  - mrc-4
  - execution-pipeline
created: 2026-06-01
updated: 2026-06-19
related:
  - mrc-adl
---

# MRC-4 — Execution Blueprint (Action Framework Layer)

**Project:** Arrival Atlas  
**Layer:** Module Runtime Platform (MRC)  
**Phase:** MRC-4 — Action Framework  
**Type:** Execution Specification (Production Contract)  
**Status:** Authoritative Runtime Blueprint  
**Version:** 1.0  
**Date:** June 2026  

**Supersedes in execution scope:** Nothing — **extends** MRC-3 semantic enrichment pipeline (does not replace it).

**Bound by:** [MRC ADL — Architecture Decision Layer](../core/mrc-adl.md) — all constraints inherited. On conflict, ADL wins.

**Aligns with:**

- [Module Runtime Contract v1.0 — Specification](../core/module-runtime-contract-v1.md) §3.5, §3.9
- [P7.1 — MRC-3 Semantic Layer Gate Audit](../audits/p7-1-mrc-3-semantic-layer-gate-audit.md)

---

## 0. Review Notes (P7.1 / ADL Alignment)

The draft blueprint was reviewed against ADL v1.0 and the existing MRC-3 pipeline. The following corrections were applied before lock:

| Issue in draft | Resolution in this document |
|----------------|----------------------------|
| Actions gated on `effectiveEnvelope` only | **Corrected:** actions require `effectiveExplanation` (ADL §2.5) |
| `ActionSourceSet` aggregated financial + benefits in one pass | **Corrected:** per-`moduleId` switch (one module per execution) |
| `ActionItem` used `label`, `module`, `source` | **Corrected:** contract fields `title`, `description`, `target`, `recommendationId` |
| `ActionKind` included `verify`, `upload` | **Corrected:** contract enum + ADL `custom` fallback |
| Benefits omitted `recommendations[].action` | **Corrected:** included per ADL §4.2 |
| Injection "on sealed envelope" | **Corrected:** actions added **before** seal; seal is final step |
| MEM-02 only on `actions[]` | **Corrected:** seal applies payload isolation + frozen `actions` |
| `trace?: ExecutionTrace[]` | **Corrected:** `trace?: ExecutionTrace` (singular; not used by MRC-4) |

---

## 1. Purpose

MRC-4 introduces a deterministic **Action Framework** layer that converts legacy module domain outputs into:

```typescript
actions: readonly ActionItem[]
```

inside the `ModuleResult` envelope.

MRC-4 does **NOT**:

- modify module `execute()` business logic
- modify MRC-3 recommendation or explanation derivation rules
- modify DPSS schema (`result` remains legacy primary)
- modify UI snapshot projection or UX orchestrator
- introduce inference beyond fixed string-pattern mapping
- consume UX orchestrator output (ADL ACT-03)
- use execution trace for action derivation (ADL TRC-03)

MRC-4 **only formalizes** what modules already expressed in legacy `action` fields.

---

## 2. Execution Entry Contract

### 2.1 Input (from upstream pipeline)

```typescript
type Mrc4Input = {
  legacy: ModuleExecutionResult;       // authoritative domain output
  envelope: ModuleResult;                // post-MRC-2 wrap; post-MRC-3 if explanation on
  runtimeContext?: ModuleRuntimeContext;
  mergedInput?: Record<string, unknown>;
  trace?: ExecutionTrace;                // present but IGNORED by MRC-4
  moduleId: string;
};
```

Environment flags (read via runtime config helpers):

| Flag | Variable |
|------|----------|
| `ENVELOPE` | `ARRIVAL_ATLAS_MRC_ENVELOPE === 'true'` |
| `EXPLANATION` | `ARRIVAL_ATLAS_MRC_EXPLANATION === 'true'` |

### 2.2 Effective Mode Resolution (MANDATORY FIRST STEP)

```text
effectiveEnvelope =
  ENVELOPE === true
  OR EXPLANATION === true          // ADL FLAG-01 implicit promotion

effectiveExplanation =
  EXPLANATION === true

effectiveActions =
  effectiveExplanation === true    // ADL §2.5 — no separate ACTIONS flag
```

**Gate rules:**

| Condition | MRC-4 behavior |
|-----------|----------------|
| `effectiveActions === false` | **STOP** — return envelope unchanged (no `actions` field added) |
| `effectiveEnvelope === false` | **STOP** — return `undefined` envelope (caller handles MRC-0) |
| `legacy.success !== true` or `legacy.data` absent | **STOP** — return envelope unchanged |
| `envelope.status !== 'success'` | **STOP** — return envelope unchanged |

> **Important:** `ENVELOPE=true` + `EXPLANATION=false` (MRC-2 mode) produces an envelope **without** `actions`. Actions are semantic enrichment at the same layer as recommendations (ADL §2.5).

---

## 3. Pipeline Position (Normative Order)

MRC-4 is the **last enrichment step** before envelope seal:

```text
globalRegistry.execute()
  → wrapLegacyExecutionResult()           // MRC-2
  → enrichModuleResultSemantics()         // MRC-3 (if effectiveExplanation)
  → enrichModuleResultActions()           // MRC-4 (if effectiveActions)  ← this blueprint
  → sealModuleResult()                    // MEM-01 / MEM-02
  → persist / respond
```

MRC-4 MUST NOT run before MRC-3 when `effectiveExplanation` is true (recommendations must exist first for `recommendationId` linking).

---

## 4. MRC-4 Execution Pipeline

### STEP 0 — Preconditions

- `legacy.data` MUST exist and MUST be treated as **immutable input**
- No mutation of `legacy.data`, `envelope.payload`, `envelope.recommendations`, or `envelope.explanation`
- `moduleId` MUST match the executed module (single-module scope)

### STEP 1 — Extract Action Sources (per module)

Dispatch by `moduleId` (same pattern as `normalizeRecommendations`):

```typescript
function extractActionSources(moduleId: string, payload: unknown): ActionSource[]
```

#### 1.1 `financial-reality`

```text
sources =
  legacy.data.decisions[]
    .filter(d => typeof d.action === 'string' && d.action.trim() !== '')
    .map((d, index) => ({
      sourceModule: 'financial-reality',
      sourceRecord: 'decisions',
      sourceId: typeof d.id === 'string' ? d.id : `financial-decision-${index}`,
      rawAction: d.action,
      priority: d.priority ?? 'medium',
      title: d.title,
      description: d.description,
      target: d.target,
    }))
```

#### 1.2 `benefits-simulator`

Two legacy arrays (ADL §4.2):

```text
from riskWarnings[]:
  filter(w => typeof w.action === 'string' && w.action.trim() !== '')
  sourceId = w.id ?? `benefits-risk-${index}`
  priority = mapSeverity(w.severity)   // critical → high at envelope boundary

from recommendations[]:
  filter(r => typeof r.action === 'string' && r.action.trim() !== '')
  sourceId = r.id ?? `benefits-recommendation-${index}`
  priority = r.priority ?? 'medium'
```

#### 1.3 Other modules

```text
if module has registered action normalizer:
  sources = moduleNormalizer.extractActionSources(payload)
else:
  sources = []
```

**Forbidden:** synthesizing sources from `Recommendation[]` objects that lack a corresponding legacy `action` field (ADL ACT-02).

### STEP 2 — Construct `ActionItem[]`

For each `ActionSource`:

```typescript
type ActionItem = {
  id: string;
  kind: ActionKind;
  title: string;
  description: string;
  priority: RecommendationPriority;
  target?: string;
  recommendationId?: string;
};

type ActionKind =
  | 'apply'
  | 'contact'
  | 'collect-documents'
  | 'schedule'
  | 'custom';   // ADL §4.4 — permitted when pattern table has no match
```

#### 2.1 Deterministic ID

```text
id = `${moduleId}:${sourceRecord}:${sourceId}`
```

No UUIDs. No timestamps. No randomness.

#### 2.2 Kind mapping (strict pattern table)

Case-insensitive substring match on `rawAction` (first match wins):

| Pattern | `kind` |
|---------|--------|
| `apply`, `request`, `submit` (excluding document context) | `apply` |
| `contact`, `call`, `reach` | `contact` |
| `upload`, `provide`, `document`, `collect` | `collect-documents` |
| `schedule`, `book`, `appointment` | `schedule` |
| no match | `custom` |

No NLP. No ML. No external rules engine.

#### 2.3 Title and description

```text
title   = source.title   ?? normalizeTitle(rawAction)
description = source.description ?? rawAction
target  = source.target  ?? undefined
```

`normalizeTitle(rawAction)` = trim + capitalize first character; used only when legacy title absent.

#### 2.4 Priority resolution

```text
resolvePriority(p):
  'critical' → 'high'
  'high'     → 'high'
  'medium'   → 'medium'
  'low'      → 'low'
  else       → 'medium'
```

Action priority is **independent** of linked recommendation priority unless source record has no explicit priority and `recommendationId` is set — then use linked recommendation priority (ADL §3.4).

#### 2.5 Recommendation linking

```text
recommendationId = sourceId
  IF envelope.recommendations contains item with id === sourceId
  ELSE undefined
```

MUST NOT create actions solely to match recommendations without legacy `action` field.

### STEP 3 — Deduplication (mandatory)

Deduplicate by composite key:

```text
key = `${kind}:${title}:${description}:${sourceId}`
```

Rules:

- Keep first occurrence in extraction order
- On key collision with different priority: keep **higher** priority (`high` > `medium` > `low`)

### STEP 4 — Stable sort

```text
sort actions by:
  1. priority DESC   (high → medium → low)
  2. id ASC
```

Sort is **within single module execution** — no cross-module sort (one module per call).

### STEP 5 — Envelope assignment (pre-seal)

```typescript
envelope = {
  ...envelope,
  actions,   // readonly array; may be empty
};
```

### STEP 6 — Seal (MEM-01 / MEM-02)

`sealModuleResult(envelope)` MUST:

1. **Deep-clone** `envelope.payload` (structural isolation from `legacy.data` / API `data`)
2. **Deep-clone** `envelope.actions` (no shared references)
3. Deep-clone `envelope.recommendations` and `envelope.explanation` if present (defensive; already spread in MRC-3)
4. Mark envelope logically immutable — no further mutation

After seal:

```text
assert noMutation(legacy.data)
assert envelope.payload !== legacy.data   // reference inequality
assert isDeterministic(actions)
```

---

## 5. Non-Affected Fields (Strict Guarantee)

MRC-4 MUST NOT modify:

| Field / system | Status |
|----------------|--------|
| `moduleResult.meta` (including `confidence`) | Unchanged |
| `moduleResult.recommendations` | Unchanged |
| `moduleResult.explanation` | Unchanged |
| `legacy.data` / API `data` | Unchanged |
| DPSS `result` | Unchanged |
| UX snapshot / `buildUXActionPlan` | Unchanged |
| Execution trace | Not read |

MRC-4 MAY only **add** `actions` and (via seal) **replace** `payload` with an isolated clone.

---

## 6. Empty State Rules

| Condition | Result |
|-----------|--------|
| No legacy `action` fields | `actions: []` — **valid** |
| Module without action normalizer | `actions: []` — **valid** |
| `effectiveActions === false` | `actions` field **omitted** (not empty array) |

No synthetic actions. No fallback generation. No inference from recommendation text alone.

---

## 7. Cross-Module Consistency Contract

Each execution handles **one** `moduleId`. Normalizer registration:

| Module | Legacy action sources | Required |
|--------|----------------------|----------|
| `financial-reality` | `decisions[].action` | Yes |
| `benefits-simulator` | `riskWarnings[].action`, `recommendations[].action` | Yes |
| All others | — | Optional (`[]` valid) |

All modules use identical `ActionItem` shape, ID rules, kind table, dedup, and sort — only extraction differs.

---

## 8. Failure Modes (Strict)

| Condition | Behavior |
|-----------|----------|
| Action source missing required extractable `rawAction` | DROP entry — no error |
| Malformed source object | DROP entry — no error |
| Unknown kind pattern | `kind: 'custom'` — preserve `rawAction` in `description` |
| Missing module normalizer | `actions: []` |
| Duplicate keys after dedup | Merge per §STEP 3 |

MRC-4 MUST NOT throw on individual action mapping failures. Execute response MUST NOT fail because action normalization failed.

---

## 9. Execution Guarantees

MRC-4 guarantees:

- **Determinism** — identical `(legacy.data, moduleId, envelope.recommendations)` → identical `actions[]`
- **No inference** — only legacy `action` fields and explicit metadata on source records
- **No side effects** — pure function; no I/O, DPSS, profile, or network
- **No UX dependency** — orchestrator is not an input (ADL ACT-03)
- **No legacy mutation** — `legacy.data` bit-identical after pipeline
- **Stable ordering** — independent of wall-clock time and trace step order
- **Idempotence** — re-running on same inputs yields same output

---

## 10. Integration Summary

| Phase | Envelope contribution |
|-------|----------------------|
| MRC-2 | `meta`, `payload` shell |
| MRC-3 | `recommendations`, `explanation` (if `effectiveExplanation`) |
| **MRC-4** | **`actions`** (if `effectiveActions`) |
| Seal | Payload isolation + immutability |
| MRC-5+ | Registry hardening (future; no MRC-4 changes) |

### API response (when fully enabled)

```typescript
{
  success: true,
  data: legacy.data,              // unchanged reference
  moduleResult: {
    status: 'success',
    meta: { ... },
    payload: { ... },             // sealed clone ≠ data reference
    recommendations: [ ... ],
    explanation: { ... },
    actions: [ ... ],             // MRC-4
  }
}
```

### DPSS write

When envelope enabled at execute time, `moduleResult` persisted includes `actions` if `effectiveActions` was true at write time. Frozen-at-write (ADL LEG-03) — no re-normalization on read.

---

## 11. Contract Assertions (must-pass invariants)

At end of `buildModuleResultEnvelope` + seal:

```text
INVARIANT-01: legacy.data is referentially and structurally unchanged
INVARIANT-02: envelope.meta === pre-MRC-4 meta (deep equal)
INVARIANT-03: envelope.recommendations unchanged if present
INVARIANT-04: envelope.explanation unchanged if present
INVARIANT-05: envelope.payload !== legacy.data (post-seal reference inequality)
INVARIANT-06: actions omitted when effectiveActions false
INVARIANT-07: every ActionItem.id is deterministic per §2.1
INVARIANT-08: no ActionItem exists without legacy action field provenance
INVARIANT-09: no trace input consumed
INVARIANT-10: sort order stable across repeated runs
```

---

## 12. Implementation Checklist (MRC-4 PR)

- [ ] `effectiveActions` gated on `effectiveExplanation` only
- [ ] FLAG-01 implicit envelope promotion in flag reader
- [ ] `enrichModuleResultActions()` after `enrichModuleResultSemantics()`
- [ ] `sealModuleResult()` with MEM-02 payload clone
- [ ] Action normalizers: `financial-reality`, `benefits-simulator`
- [ ] `ActionItem` type in `@arrival-atlas/module-runtime` (replace `actions?: unknown`)
- [ ] Contract tests for INVARIANT-01 through INVARIANT-10
- [ ] API test: `EXPLANATION=true` → `moduleResult.actions` present (may be `[]`)
- [ ] API test: `ENVELOPE=true`, `EXPLANATION=false` → no `actions` field
- [ ] Snapshot test unchanged: `executions[].result` still legacy domain

---

## 13. Forbidden Behaviors (inherits ADL §8)

MRC-4 implementers MUST NOT:

- Add `ARRIVAL_ATLAS_MRC_ACTIONS` flag without ADL revision
- Produce actions in MRC-2-only mode
- Read `buildUXActionPlan` output
- Derive actions from `Recommendation` without legacy `action` on source record
- Mutate any pre-MRC-4 envelope field except adding `actions` and sealing `payload`
- Use execution trace in action extraction
- Throw on mapping failure

---

## 14. Final Statement

MRC-4 is a **pure structural translation layer**:

> It does not decide what should be done — it only formalizes what the module already decided in legacy `action` fields.

The runtime wrapper owns the envelope. Modules remain authoritative for domain facts. UX orchestrator continues in parallel until MRC-6.

---

## 15. Document Authority

This blueprint is the **authoritative execution specification** for MRC-4 implementation. It is subordinate to the [MRC ADL](../core/mrc-adl.md) and supersedes informal drafts.

Amendments require version bump (1.1+) and gate review.

**Status: Locked — ready for implementation.**
