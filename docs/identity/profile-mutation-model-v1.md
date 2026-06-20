---
id: profile-mutation-model-v1
title: Profile Mutation Model v1
project: Arrival Atlas
system: Arrival Atlas
type: spec
domain: identity
status: draft
maturity: proposed
owner: system
tags:
  - profile-engine
  - mutation-events
  - event-sourcing
  - source-of-truth
  - profile-revision
created: 2026-06-19
updated: 2026-06-19
related:
  - ux-contract-v2
  - ux-contract-v1
  - profile-system-v1-roadmap
  - profile-ux-spec
---

# Profile Mutation Model v1

**Document type:** System architecture specification (machine contract)  
**System:** Arrival Atlas  
**Version:** 1.0 (draft)  
**Status:** Proposed — implements [UX Contract v2](../ux/ux-contract-v2.md) at the profile layer; reframes Profile System P1  
**Scope:** Typed mutation requests, event log, deterministic state construction, conflict resolution, revision model, domain partitioning. **Not** UI design. **Not** HTTP route design.

**Supersedes (conceptually):** Document-centric mental model in [profile-system-v1-roadmap.md](./profile-system-v1-roadmap.md) §6 where this spec is stricter.  
**Coexists with:** Existing `ProfileDocument` / `ProfileEngine` types during migration — treated as **materialized projection**, not authority.

---

## 0. Specification Summary

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTHORITY CHAIN                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Surfaces (Home / Modules / Profile UI)                                  │
│       │ emit MutationRequest (intent only)                               │
│       ▼                                                                  │
│  Mutation Layer (validate → normalize → resolve → commit)                │
│       │ append MutationEvent to log                                      │
│       ▼                                                                  │
│  ProfileState = reduce(MutationEvent[])     ← SOURCE OF TRUTH            │
│       │ project                                                            │
│       ▼                                                                  │
│  MaterializedProfileDocument (cache)  ·  UserProfileViewV1  ·  UiSnapshot │
└─────────────────────────────────────────────────────────────────────────┘
```

**Core reframe:**

> **Profile is not edited. Profile is not a static stored object. Profile is the deterministic result of applying an ordered, validated mutation history.**

`ProfileDocument` in `@arrival-atlas/profile` is a **materialized cache** of `ProfileState` for performance and backward compatibility until full event-log persistence is complete. **Authority lives in the mutation log + reducer**, not in the document field bag.

**Guiding principle:**

> When ambiguous, prefer **deterministic state reconstruction** over **convenient in-place mutation**.

---

## 1. Core Concepts

### 1.1 Definitions

| Term | Definition |
|------|------------|
| **MutationRequest** | Uncommitted user/system intent to change facts. Ephemeral until accepted. |
| **MutationEvent** | Committed, immutable record appended after validation and conflict resolution. |
| **MutationEventLog** | Ordered append-only sequence `{ profileId, events[] }`. Authoritative store. |
| **ProfileState** | Pure function output: `reduce(initialState, events)`. Derived, never written directly. |
| **MaterializedProfileDocument** | Cached snapshot of `ProfileState` shaped as `ProfileDocument` for engine compatibility. |
| **ProfileRevision** | User-trust audit entry derived from a committed `MutationEvent` (field deltas + provenance). |
| **Domain** | Partition of facts with shared validation, sensitivity, and conflict rules. |
| **FieldPath** | Dot-path within a domain, e.g. `employment.grossMonthlyIncome`. **Not** exposed in UI payloads. |

### 1.2 Profile is NOT a document

| Document-centric (forbidden model) | Event-centric (required model) |
|-----------------------------------|--------------------------------|
| Load profile object | Load mutation history (+ optional materialized cache) |
| PATCH fields on object | Append validated `MutationEvent` |
| `revision` guards object overwrite | `revision` guards **log head** / expected parent event |
| Truth = latest document | Truth = `reduce(events)` |
| Profile UI saves document | Profile UI submits `MutationRequest` |

### 1.3 Migration note (current codebase)

Today `InMemoryProfileStore` persists `ProfileRecord.document` directly. P1 migration path:

1. Introduce `MutationEventLog` alongside existing store
2. On commit: append event **then** update materialized document from `reduce()`
3. On read: prefer `reduce(log)`; verify materialized doc matches (parity check in tests)
4. Phase out direct `deepMergeProfile(patch)` without event append

Until migration completes, every `PROFILE_UPDATE` / activation write **must** emit a equivalent `MutationEvent` record (adapter shim).

---

## 2. MutationRequest

### 2.1 Purpose

`MutationRequest` is the **sole input** to the Mutation Layer from surfaces. It is **not** a profile patch, **not** a schema object, **not** storable as authoritative state.

### 2.2 Type definition

```typescript
/** High-level operation intent (routing + UX semantics) */
type OperationIntent =
  | 'create'
  | 'update'
  | 'correct'
  | 'invalidate'
  | 'suggest_correction'
  | 'propose_update';

/** Strict mutation type (machine enforcement) */
type FactMutationType =
  | 'fact.create'
  | 'fact.update'
  | 'fact.correct'
  | 'fact.invalidate'
  | 'fact.suggest_correction'
  | 'fact.propose_update';

type PrefMutationType = 'pref.update';
type OnboardingMutationType = 'onboarding.update';

type MutationType = FactMutationType | PrefMutationType | OnboardingMutationType;

/** Product-facing domain partition (not engine schema keys in payload) */
type ProfileDomainSlug =
  | 'move'           // residency, countryOfOrigin, arrival
  | 'housing'        // location + rent
  | 'household'
  | 'employment'
  | 'income'         // sub-domain of employment for sensitivity routing
  | 'insurance'
  | 'benefits'
  | 'language';      // preferredLanguage (synced with session)

type MutationSource =
  | { kind: 'module'; moduleId: string; executionId?: string }
  | { kind: 'profile_ui'; domainSlug: ProfileDomainSlug }
  | { kind: 'system'; reason: SystemMutationReason }
  | { kind: 'header'; prefField: 'language' | 'theme' | 'uiDensity' };

type SystemMutationReason =
  | 'migration'
  | 'staleness_invalidate'
  | 'language_sync'
  | 'onboarding_progress';

/** Domain-safe payload — human field IDs mapped server-side to FieldPath */
type DomainFactPayload = {
  /** Map of domainFieldId → value. IDs are product-contract enum, not Zod paths. */
  fields: Record<string, unknown>;
};

type MutationRequest = {
  /** Unique idempotency key (client-generated UUID) */
  requestId: string;

  /** Strict mutation classifier */
  type: MutationType;

  /** Semantic intent (must be consistent with type — see §2.3) */
  intent: OperationIntent;

  /** Target domain (required for fact.* except batch module activation) */
  domain: ProfileDomainSlug | null;

  /** Fact values or pref values — never raw ProfilePatch */
  payload: DomainFactPayload | PrefPayload | OnboardingPayload;

  /** Initiator attribution */
  source: MutationSource;

  /** Optional confidence for module-originated inferred writes (0–1). Manual input = 1. */
  confidence: number;

  /** ISO-8601 client timestamp (informational; server assigns committedAt) */
  timestamp: string;

  /** If true, Mutation Layer MUST NOT commit without explicit confirm flag on resubmit */
  userConfirmationRequired: boolean;

  /** Required for correct/invalidate/propose_update when targeting existing head */
  expectedHeadRevision?: number;

  /** Required on confirmation resubmit after propose_update */
  confirmsProposalId?: string;
};

type PrefPayload = {
  field: 'language' | 'theme' | 'uiDensity';
  value: unknown;
};

type OnboardingPayload = {
  action: 'dismiss_checklist' | 'complete_step' | 'mark_completed';
  stepId?: string;
};
```

### 2.3 Intent ↔ type consistency (enforceable)

| `type` | Required `intent` | `userConfirmationRequired` default |
|--------|-------------------|-------------------------------------|
| `fact.create` | `create` | `false` (module submit) |
| `fact.update` | `update` | `false` (module submit) |
| `fact.correct` | `correct` | `true` |
| `fact.invalidate` | `invalidate` | `true` |
| `fact.suggest_correction` | `suggest_correction` | `true` (never commits) |
| `fact.propose_update` | `propose_update` | `true` |
| `pref.update` | `update` | `false` |
| `onboarding.update` | `update` | `false` |

Mismatch → **reject** at validation (400, human-safe error).

### 2.4 Payload rules

| Rule ID | Statement |
|---------|-----------|
| **P1** | Payload MUST use `DomainFactPayload.fields` with **domain field IDs** from product-contract registry |
| **P2** | Payload MUST NOT contain schema paths (`employment.grossMonthlyIncome`) |
| **P3** | Payload MUST NOT contain scenario field IDs (see §5 scenario blocklist) |
| **P4** | Payload MUST NOT contain full profile objects or `ProfilePatch` |
| **P5** | Normalization maps `domainFieldId → FieldPath` inside Mutation Layer only |

---

## 3. Mutation Types (Strict)

### 3.1 Fact-level mutations

| Type | Semantics | Allowed sources | Persistence | Snapshot update |
|------|-----------|-----------------|-------------|-----------------|
| **`fact.create`** | First write of field(s) previously absent in `ProfileState` | Module (`kind: module`) | Permanent (event log) | Immediate |
| **`fact.update`** | Replace existing field value(s) from module capture | Module | Permanent | Immediate |
| **`fact.correct`** | User correction without full module re-run | Profile UI | Permanent | Immediate |
| **`fact.invalidate`** | Clear field(s) to absent; mark unknown | Profile UI, System | Permanent | Immediate |

### 3.2 Meta mutations (non-authoritative until promoted)

| Type | Semantics | Allowed sources | Persistence | Snapshot update |
|------|-----------|-----------------|-------------|-----------------|
| **`fact.suggest_correction`** | Client draft while Profile edit form is dirty | Profile UI | **Ephemeral** (client memory only; never appended to log) | None |
| **`fact.propose_update`** | Module/system proposes change requiring confirm | Module, System | **Ephemeral** (pending proposal store, TTL 24h) | None until promoted |

**Promotion rules:**

```text
fact.suggest_correction  ──[Save + confirm]──►  fact.correct (MutationRequest)
fact.propose_update      ──[User accepts]──────►  fact.update | fact.correct (same payload)
```

Meta mutations **never** appear in `MutationEventLog`.

### 3.3 Non-profile mutations (session plane)

| Type | Domain store | Notes |
|------|--------------|-------|
| `pref.update` | Session `userProfile` | Not part of `ProfileState` reducer; parallel commit |
| `onboarding.update` | Session / onboarding projection | Does not alter domain facts |

### 3.4 Source authorization matrix

| Type | Module | Profile UI | System | Header/Home |
|------|--------|------------|--------|-------------|
| `fact.create` | ✅ | ❌ | ❌ | ❌ |
| `fact.update` | ✅ | ❌ | ❌ | ❌ |
| `fact.correct` | ❌ | ✅ | ❌ | ❌ |
| `fact.invalidate` | ❌ | ✅ | ✅ | ❌ |
| `fact.suggest_correction` | ❌ | ✅ (client only) | ❌ | ❌ |
| `fact.propose_update` | ✅ | ❌ | ✅ | ❌ |
| `pref.update` | ❌ | ✅ | ✅ | ✅ |
| `onboarding.update` | ❌ | ❌ | ✅ | ✅ (dismiss only) |

---

## 4. Conflict Resolution Model

### 4.1 Principles

| Principle | Rule |
|-----------|------|
| **No blind last-write-wins** | Recency alone does **not** determine outcome |
| **Class precedence** | Mutation **class** beats timestamp within competing writes |
| **Field atomicity** | Conflicts resolved at **FieldPath** granularity, not domain blob |
| **Explicit correction wins** | User `fact.correct` beats module `fact.update` for same field |
| **Determinism** | Same event log → same `ProfileState` always |

### 4.2 Precedence ladder (highest wins)

```text
Priority 4 (highest)  fact.correct          — explicit user correction
Priority 3            fact.invalidate       — explicit user/system clear
Priority 2            fact.update           — module execute (user just submitted)
Priority 1            fact.create           — first-time field introduction
Priority 0 (lowest)   materialized backfill — migration shim only
```

When two events share the same priority for the same field, **later `committedAt` wins** (total order tie-break).

### 4.3 Conflict scenarios

#### Module vs Module (same field)

| Condition | Resolution |
|-----------|------------|
| Same field, two modules, both `fact.update` | Higher precedence class; if equal → later `committedAt` |
| Same execution, multiple mapped fields | Single compound event; atomic commit |
| Overlapping domains (rent in financial-reality + benefits-simulator) | Field ownership registry (§5) determines valid writer; second module maps to same FieldPath → normal precedence rules |

**Example:** `housing.monthlyColdRent` written by `financial-reality` then `benefits-simulator` → both valid; later execution wins (Priority 2 tie-break by time).

#### Module vs Profile correction

| Condition | Resolution |
|-----------|------------|
| Module `fact.update` then Profile `fact.correct` on same field | **Correction wins** (Priority 4 > 2) |
| Profile `fact.correct` then Module `fact.update` | **Module wins** (Priority 2 < 4? NO — correction is 4, update is 2) → **Module update wins only if user re-submitted module after correction** i.e. new event with later timestamp AND user intent |

**Clarification (normative):** After `fact.correct`, a subsequent module execute producing `fact.update` **supersedes** correction because the user explicitly re-entered data in decision context. Precedence equal (2 vs 4): **class still wins** — so module execute must emit `fact.update` which is Priority 2, correction is 4. Correction always wins **until** a new module `fact.update` arrives — then we compare: **new module update is Priority 2, but correction is 4**. 

Wait, I need to fix this logic. The user said correction should win over stale module data, but module re-execute with new submit should win.

The resolution:
- Compare by **event order** when classes differ:
  - fact.correct (4) beats older fact.update (2)
  - newer fact.update (2) after fact.correct — the **newer** fact.update does NOT beat fact.correct by class alone

Actually re-read UX v2:
- fact.correct wins over older module activation
- Module re-execute wins over older stored value (user just submitted)

So the model should be:
- For each field, the **effective value** is from the **highest precedence event that applies**, but if a **lower precedence event has a strictly later committedAt AND is from module execute after the correction**, it supersedes?

Better model: **Stack by field with precedence, then timestamp within same precedence only**

Actually simpler deterministic rule:

**Effective value for field F** = value from event E where:
1. E targets F
2. E is not invalidated by a later invalidate on F
3. Sort events by: `(precedence DESC, committedAt DESC, sequence DESC)`
4. Take first

So fact.correct (4) at T1 beats fact.update (2) at T0.
fact.update (2) at T2 beats fact.correct (4) at T1? That would mean module beats correction if later — which matches "user re-ran module".

So **same precedence ladder but later timestamp can override higher precedence?** User said "likely NO in pure form" for last-write-wins.

UX v2 says:
- fact.correct wins over older module activation  
- Module re-execute wins over older stored value

So correction beats OLD module update, but NEW module execute beats OLD correction. That's **recency within competing user actions**, not pure class precedence.

**Revised model — two-tier:**

**Tier A — Class gate:** `fact.invalidate` and `fact.correct` cannot be silently overridden by `fact.update` **from the same module without new user submit** (same executionId forbidden to flip).

**Tier B — Temporal ordering:** Among events of **equal user intent level** OR when a **new module execution** occurs after a correction, later `committedAt` wins.

| Event A | Event B | Winner |
|---------|---------|--------|
| `fact.update` (module X, t=1) | `fact.correct` (t=2) | **correct** |
| `fact.correct` (t=1) | `fact.update` (module X, t=2, new executionId) | **update** |
| `fact.update` (module X, t=1) | `fact.update` (module Y, t=2) | **update Y** (tie precedence, later time) |
| `fact.correct` (t=1) | `fact.correct` (t=2, expectedRevision mismatch) | **reject B** (revision conflict) |

#### Correction vs Correction

| Condition | Resolution |
|-----------|------------|
| Sequential corrections, valid `expectedHeadRevision` | Append; later correction wins on overlapping fields |
| Concurrent corrections, revision mismatch | **Reject** second with `REVISION_CONFLICT`; client must refresh |
| Correction on stale head | **Reject** — no merge |

### 4.4 Conflict resolution function (spec)

```typescript
type ConflictDecision =
  | { outcome: 'accept'; event: MutationEvent }
  | { outcome: 'reject'; code: 'REVISION_CONFLICT' | 'UNAUTHORIZED_SOURCE' | 'SCENARIO_FIELD' | 'VALIDATION_FAILED' }
  | { outcome: 'defer'; proposalId: string }; // fact.propose_update path

function resolveConflict(
  currentState: ProfileState,
  headRevision: number,
  request: MutationRequest,
  fieldOwnership: FieldOwnershipRegistry
): ConflictDecision;
```

**Merge is not PATCH merge.** Merge = **append accepted event** + **re-reduce**. No in-place field blending.

---

## 5. Domain Partitioning Model

### 5.1 Domain registry

Domains are **product partitions**, not 1:1 with `ProfileDocument` top-level keys.

| Domain slug | FieldPaths (authoritative) | Mutable | Read-only derived | Confirmation | Sensitive |
|-------------|---------------------------|---------|-------------------|--------------|-----------|
| **`move`** | `countryOfOrigin`, `residency.status`, `residency.arrivedAt` | ✅ | — | `arrivedAt` optional | Medium |
| **`housing`** | `location.bundesland`, `location.city`, `housing.monthlyColdRent`, `housing.monthlyUtilities` | ✅ | — | rent > 0 | **High** (rent) |
| **`household`** | `household.size`, `household.maritalStatus`, `household.children` | ✅ | — | children array | Medium |
| **`employment`** | `employment.status`, `employment.taxClass`, `employment.churchTax` | ✅ | — | status change | Medium |
| **`income`** | `employment.grossMonthlyIncome` | ✅ | — | always | **High** |
| **`insurance`** | `insurance.type`, `insurance.hasCoverage` | ✅ | — | type selection | Medium |
| **`benefits`** | `benefits.receivingBuergergeld`, `benefits.receivingAlg1`, `benefits.receivingWohngeld`, `benefits.daysInGermany` | ✅ | — | receiving flags | **High** |
| **`language`** | `preferredLanguage` | ✅ | — | no | Low |

**Read-only derived (never mutated directly):**

| Derived field | Source |
|---------------|--------|
| Domain completeness flags | Computed from `ProfileState` |
| Provenance strings | Computed from last event per domain |
| `completeness.score` | Reducer metadata projection |
| Module extension blobs | Written only via module activation maps to `extensions.{moduleId}` |

### 5.2 Field ownership (cross-module writes)

| FieldPath | Primary module writer | Secondary allowed |
|-----------|----------------------|-------------------|
| `employment.grossMonthlyIncome` | `financial-reality` | — |
| `employment.status` | `financial-reality` | — |
| `housing.monthlyColdRent` | `financial-reality` | `benefits-simulator` |
| `household.size` | `financial-reality` | `benefits-simulator` |
| `insurance.*` | `healthcare-navigation` | — |
| `benefits.*` | `benefits-simulator` | — |

Secondary writers produce `fact.update` with same validation rules; conflict resolved by §4.

### 5.3 Scenario blocklist (never in ProfileState)

These field IDs MUST be rejected if present in any `MutationRequest.payload`:

```typescript
const SCENARIO_FIELD_BLOCKLIST = [
  'proposedGrossIncome',
  'proposedRent',
  'hypotheticalHouseholdSize',
  'scenarioComparisonMode',
  'whatIfTaxClass',
] as const;
```

Module execution may use these in **execution input**; they MUST NOT appear in activation maps or Profile correction payloads.

### 5.4 Sensitive domain rules

| Rule | Enforcement |
|------|-------------|
| **S1** | `income`, `benefits`, `housing` mutations require `userConfirmationRequired: true` for Profile UI |
| **S2** | Sensitive fields never appear in Home projection (UX v1) |
| **S3** | Revision reason for sensitive fields uses generic copy in UI: *"You updated your situation"* |

---

## 6. Profile State Construction

### 6.1 Reducer model

```typescript
type ProfileState = {
  schemaVersion: '1.0.0';
  fields: Map<FieldPath, FieldValue>; // sparse field store
  meta: {
    headRevision: number;
    lastEventId: string;
    domainProvenance: Record<ProfileDomainSlug, ProvenanceEntry | null>;
  };
};

type FieldValue = {
  value: unknown;
  setByEventId: string;
  setAt: string; // committedAt
  source: MutationSource;
};

type ProvenanceEntry = {
  source: MutationSource;
  committedAt: string;
  mutationType: FactMutationType;
};

const INITIAL_PROFILE_STATE: ProfileState = {
  schemaVersion: '1.0.0',
  fields: new Map(),
  meta: { headRevision: 0, lastEventId: '', domainProvenance: {} },
};

function reduceProfileState(
  state: ProfileState,
  event: MutationEvent
): ProfileState;
```

### 6.2 MutationEvent (committed)

```typescript
type MutationEvent = {
  eventId: string;
  mutationId: string; // == requestId for idempotency trace
  profileId: string;
  type: MutationType;
  intent: OperationIntent;
  domain: ProfileDomainSlug | null;
  /** Resolved FieldPath → value deltas (after normalization) */
  fieldDeltas: FieldDelta[];
  source: MutationSource;
  confidence: number;
  precedence: 0 | 1 | 2 | 3 | 4;
  committedAt: string; // server clock
  sequence: number; // monotonic per profileId
  revision: number; // == headRevision after apply
  reason: string; // human-readable audit line
};

type FieldDelta = {
  path: FieldPath;
  before: unknown | null;
  after: unknown | null;
  operation: 'set' | 'clear';
};
```

### 6.3 Reducer algorithm (deterministic)

```text
reduce(state, eventsOrdered):
  for each event in eventsOrdered (by sequence ASC):
    for each delta in event.fieldDeltas:
      if delta.operation == 'clear':
        state.fields.delete(delta.path)
      else:
        state.fields.set(delta.path, {
          value: delta.after,
          setByEventId: event.eventId,
          setAt: event.committedAt,
          source: event.source,
        })
    state.meta.headRevision = event.revision
    state.meta.lastEventId = event.eventId
    update domainProvenance for affected domains
  return state
```

**Ordering rules:**

| Rule | Statement |
|------|-----------|
| **O1** | Events totally ordered by `sequence` (integer, gapless per profileId) |
| **O2** | `committedAt` is informational; `sequence` is authoritative for replay |
| **O3** | Replay from empty state MUST equal replay from materialized cache verified state |

### 6.4 Idempotency rules

| Rule | Statement |
|------|-----------|
| **I1** | Same `requestId` submitted twice → second returns **same** `MutationEvent` reference; no duplicate append |
| **I2** | Reducer is pure: `reduce(s, [e])` identical regardless of materialized cache |
| **I3** | `expectedHeadRevision` mismatch → reject without append (optimistic concurrency) |
| **I4** | Invalid events never partially append (atomic commit per request) |

### 6.5 Snapshot derivation

```typescript
function projectProfileState(state: ProfileState): MaterializedProfileDocument;
function projectUserProfileView(state: ProfileState): UserProfileViewV1;
function projectDomainMirror(state: ProfileState, domain: ProfileDomainSlug): DomainView;
```

| Projection | Consumer | Rules |
|------------|----------|-------|
| `MaterializedProfileDocument` | Profile engine, API store | Nested object shape matching `ProfileDocumentSchema` |
| `UserProfileViewV1` | Web AppProvider | Subset only; no extensions policy internals |
| `DomainView` | Profile mirror UI | Plain-language labels applied in UI layer |
| `SituationHeadline` | Home | Aggregated; no sensitive scalars |

**UiSnapshot.profile** MUST be derived from `UserProfileViewV1`, never from raw engine document in web.

---

## 7. Revision Model

### 7.1 ProfileRevision (trust layer)

Extends existing `ProfileRevision` concept with **field-level audit**:

```typescript
type ProfileRevision = {
  id: string;
  profileId: string;
  revision: number; // matches ProfileState.meta.headRevision
  mutationId: string; // links to MutationEvent.mutationId
  eventId: string;
  domain: ProfileDomainSlug | null;
  /** Field-level audit (internal paths — not UI) */
  deltas: Array<{
    path: FieldPath;
    before: unknown | null;
    after: unknown | null;
  }>;
  source: MutationSource;
  reason: string; // human-readable: "Updated when you used Financial Reality"
  mutationType: MutationType;
  committedAt: string;
};
```

### 7.2 Reason strings (generation rules)

| Source | Reason template |
|--------|-----------------|
| Module execute | `Updated when you used {moduleTitle}` |
| Profile correction | `You updated this in Your situation` |
| System invalidate | `Marked as unknown — {systemReason}` |
| Migration | `Background update` (no UI surface) |

**Forbidden in reason:** schema paths, revision IDs, mutation type enums.

### 7.3 UI exposure

| Data | UI may show |
|------|-------------|
| `reason` | ✅ plain language |
| `committedAt` | ✅ relative date |
| `source.kind` | ✅ mapped to tool title |
| `deltas`, `path`, `mutationId` | ❌ internal only |

---

## 8. Mutation Lifecycle

### 8.1 Pipeline (normative)

```text
┌────────────┐
│ 1. User    │  Surface collects input (module form / profile edit / header)
│    action  │
└─────┬──────┘
      ▼
┌────────────┐
│ 2. Mutation│  Client builds MutationRequest (requestId, type, domain, payload, source)
│    Request │
└─────┬──────┘
      ▼
┌────────────┐
│ 3. Validate│  WHERE: Mutation Layer — API coordinator
│    layer   │  CHECK: source auth matrix, intent↔type, scenario blocklist,
│            │        domain field registry, value types, expectedHeadRevision
└─────┬──────┘
      ▼
┌────────────┐
│ 4. Normal- │  WHERE: Mutation Layer — domain field mapper
│    ization │  MAP: domainFieldId → FieldPath; coerce types; drop unknown fields
└─────┬──────┘
      ▼
┌────────────┐
│ 5. Conflict│  WHERE: Mutation Layer — conflict resolver (§4)
│    resolve │  INPUT: current ProfileState, headRevision, request
└─────┬──────┘
      ▼
┌────────────┐
│ 6. Commit  │  WHERE: Profile store — append-only
│    to log  │  WRITE: MutationEvent; ProfileRevision; increment sequence + revision
└─────┬──────┘
      ▼
┌────────────┐
│ 7. Recompute│ WHERE: Profile engine reducer
│    snapshot │  reduce(log) → ProfileState → materialize ProfileDocument
└─────┬──────┘
      ▼
┌────────────┐
│ 8. Project │  WHERE: Snapshot projection engine
│    UiSnap  │  snapshotVersion++; UserProfileViewV1; Home/Profile inputs
└─────┬──────┘
      ▼
┌────────────┐
│ 9. UI      │  WHERE: Web read plane
│    refresh │  AppProvider fetch/apply snapshot; Profile returns to read mode
└────────────┘
```

### 8.2 Stage ownership

| Stage | Owner package | Must not happen in |
|-------|---------------|-------------------|
| Validate | `apps/api` Mutation Layer | Web client, Profile UI |
| Normalize | `apps/api` + `product-contract` field registry | Web client |
| Conflict resolve | `apps/api` + `@arrival-atlas/profile` policy | Web client |
| Commit | `@arrival-atlas/profile` store port | Direct document merge without event |
| Reduce | `@arrival-atlas/profile` engine | UI |
| Project | `apps/api` snapshot-projection-engine | Web |

### 8.3 Module execute path (compound)

Module submission produces **one or more** `MutationEvent`s bundled in single atomic transaction:

```text
MODULE_EXECUTE
  → runtime result (ephemeral)
  → activation map → MutationRequest(type: fact.create|update, ...)
  → same pipeline §8.1
  → profileActivated: true|false
```

Scenario-only fields filtered **before** MutationRequest construction.

---

## 9. System Guarantees (Invariants)

| ID | Invariant |
|----|-----------|
| **G1** | `ProfileState === reduce(INITIAL, events)` for all profiles |
| **G2** | Materialized document equals `projectProfileState(reduce(events))` (parity) |
| **G3** | Every committed fact mutation appends exactly one `ProfileRevision` |
| **G4** | `fact.suggest_correction` never appears in event log |
| **G5** | Scenario blocklist fields never appear in event log |
| **G6** | No code path writes `ProfileDocument` without appending `MutationEvent` (post-migration) |
| **G7** | Profile UI never calls store/updateProfile directly |
| **G8** | Home never constructs fact `MutationRequest` |
| **G9** | Idempotent retry with same `requestId` does not double-apply |
| **G10** | Conflict resolution is deterministic: same inputs → same accept/reject |
| **G11** | No dual-write: module activation and profile correction use same pipeline |
| **G12** | Governance kernel outcomes unchanged by profile mutations (hydration only) |

---

## 10. UI Implications (Consequences Only)

| Surface | Consequence of this model |
|---------|---------------------------|
| **Profile UI** | Renders `projectDomainMirror(ProfileState)` — read-only projection. Edit mode builds `MutationRequest`, not patch. |
| **UX-P3** | Section save = submit `fact.correct` with `userConfirmationRequired: true`. Draft = client-side `fact.suggest_correction` only. |
| **Modules** | Submit = module runtime → activation → `fact.create/update` events. Scenario fields stay in execute payload. |
| **Home** | Reads `SituationHeadline` + completeness from snapshot projection. Zero mutation construction. |
| **Explain panel** | May reference profile factors from execution trace; never reads mutation log directly. |

---

## 11. Hard Constraints

| ID | Constraint |
|----|------------|
| **C1** | Profile cannot be edited directly without Mutation Layer |
| **C2** | No raw `ProfileDocument` mutation outside reducer + materialize step |
| **C3** | No schema paths in `MutationRequest.payload` |
| **C4** | No scenario state in Profile event log |
| **C5** | No bypass of validation layer (including module activation maps) |
| **C6** | All committed changes produce `ProfileRevision` |
| **C7** | No client-side conflict resolution or merge |
| **C8** | `fact.correct` requires `expectedHeadRevision` |
| **C9** | Meta mutations cannot append to log without promotion |
| **C10** | UX Contract v1 leak rules apply to all projections |

---

## 12. Implementation Mapping (Profile System P1)

| P1 deliverable | This spec section |
|----------------|-------------------|
| `MutationRequest` / `MutationEvent` types in product-contract | §2, §6.2 |
| Domain field ID registry | §2.4, §5 |
| `submitMutation()` web client | §8.1 step 2 |
| API Mutation Layer coordinator | §8.1 steps 3–6 |
| Event log store port | §1.3, §6 |
| `UserProfileViewV1` projection | §6.5 |
| Revision API for trust UI | §7 |
| Migration shim from `ProfileRecord.document` | §1.3 |

**Replaces in P1 framing:** "Web profile read/write client" → **"Web mutation submit client"**.

---

## 13. Violation Scenarios

### V1 — Direct document PATCH

```typescript
// ❌ FORBIDDEN
await profileEngine.updateProfile(id, { employment: { grossMonthlyIncome: 3000 } }, rev);
// without MutationEvent append
```

**Impact:** Breaks G6, G1; audit trail lie; non-replayable state.

---

### V2 — Profile UI sends ProfilePatch

```typescript
// ❌ FORBIDDEN — web client
fetch('/api/profile', { body: JSON.stringify({ patch: { housing: { ... } } }) });
```

**Required:**

```typescript
submitMutation({
  type: 'fact.correct',
  intent: 'correct',
  domain: 'housing',
  payload: { fields: { monthlyRent: 850 } },
  source: { kind: 'profile_ui', domainSlug: 'housing' },
  userConfirmationRequired: true,
  expectedHeadRevision: 12,
});
```

---

### V3 — Scenario field in activation map

```typescript
// ❌ FORBIDDEN — module activation
{ proposedGrossIncome: input.proposedGrossIncome } → ProfilePatch
```

**Impact:** Violates G5, C4; poisons ProfileState with hypotheticals.

---

### V4 — Client-side merge after correction

```typescript
// ❌ FORBIDDEN — web
setLocalProfile({ ...profile, employment: { ...profile.employment, status: 'student' } });
```

**Impact:** Split-brain vs server ProfileState; violates C7.

---

### V5 — Blind last-write-wins resolver

```typescript
// ❌ FORBIDDEN
function resolve(a, b) { return a.timestamp > b.timestamp ? a : b; }
```

**Impact:** User correction silently lost; violates §4.1.

---

### V6 — suggest_correction appended to log

```typescript
// ❌ FORBIDDEN
eventLog.append({ type: 'fact.suggest_correction', ... });
```

**Impact:** Draft state persisted; violates G4.

---

### V7 — Schema path in payload

```typescript
// ❌ FORBIDDEN
payload: { fields: { 'employment.grossMonthlyIncome': 3200 } }
```

**Required:** `payload: { fields: { grossMonthlyIncome: 3200 } }` with domain `income`.

---

### V8 — Home initiates fact mutation

```typescript
// ❌ FORBIDDEN — onboarding card
submitMutation({ type: 'fact.create', domain: 'housing', ... });
```

**Allowed:** `onboarding.update` only.

---

### V9 — Dual-write module + profile without coordinator

```typescript
// ❌ FORBIDDEN — race
Promise.all([
  executeModule(...),      // writes via activation
  submitFactCorrection(...), // parallel, no revision guard
]);
```

**Impact:** Undefined field state; violates G11.

---

### V10 — Rebuild non-determinism

```typescript
// ❌ FORBIDDEN — reducer uses Date.now() or random defaults
if (!field.value) field.value = Math.random();
```

**Impact:** G1 broken; audit untrustworthy.

---

## 14. Acceptance (Self-Check)

Profile Mutation Model v1 is satisfied when:

1. ☐ Profile defined as `reduce(MutationEvent[])` (§1, §6)
2. ☐ `MutationRequest` typed and source-authorization enforced (§2, §3)
3. ☐ Conflict rules deterministic and not pure LWW (§4)
4. ☐ Domain partitioning + scenario blocklist defined (§5)
5. ☐ Revision model with field deltas + human reason (§7)
6. ☐ Lifecycle stages owned by named layers (§8)
7. ☐ Invariants G1–G12 testable (§9)
8. ☐ Product-contract types published (§12)
9. ☐ Migration shim documented for current ProfileDocument store (§1.3)

---

## 15. Canonical Principle

> **Facts are events. Profile is memory. Surfaces remember nothing authoritative — they only propose changes.**

```text
MutationRequest  →  validate  →  MutationEvent  →  reduce  →  ProfileState  →  project  →  UI
```

**Read reality:** projections.  
**Change reality:** events only.
