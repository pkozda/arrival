---
id: runtime-consistency-contract-v1
title: Runtime Consistency Contract v1
project: Arrival Atlas
system: Arrival Atlas
type: specification
domain: platform
status: active
maturity: frozen
owner: architecture
tags:
  - runtime-consistency
  - domain-sync-graph
  - state-synchronization
  - failure-model
  - behavioral-contract
  - client-runtime
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - platform-planning-constitution-v1
  - golden-user-journeys-v1
related:
  - runtime-reactivity-audit-v1
  - economic-reality-v1-closure-spec
  - module-runtime-contract-v1
---

# Runtime Consistency Contract v1

**Document type:** Platform behavioral contract — not an implementation guide  
**Version:** 1.0.0  
**Status:** Active / Frozen  
**Audience:** Architecture, engineering, QA, audit reviewers

---

## Metadata

| Field | Value |
|-------|-------|
| **ID** | `runtime-consistency-contract-v1` |
| **Model generation** | Runtime Consistency Model v2 |
| **Project** | Arrival Atlas |
| **Domain** | Platform / Client Runtime |
| **Maturity** | Frozen |
| **Owner** | Architecture |
| **Created** | 2026-06-21 |
| **Updated** | 2026-06-21 |

---

## Purpose

This document formalizes **Runtime Consistency Model v2** as a platform-level behavioral contract.

It defines how the client runtime synchronizes multi-domain session state after reactive events — profile mutations, economic action execution, and explicit session refresh requests — without scope explosion, without silent partial updates, and with deterministic outcomes.

This contract governs **observable and enforceable behavior**:

- which domains participate in a sync cycle
- in what order they are resolved
- how edge semantics affect execution when upstream domains fail
- when the UI may commit new state versus retain prior state
- when the runtime enters a degraded consistency posture

This contract intentionally does **not** prescribe:

- React component structure
- fetch client libraries
- file layout or module names
- internal caching implementation details beyond the behavioral rules below

Any compliant implementation must produce the same sync plans, execution decisions, commit outcomes, and UI-visible consistency status for the same inputs.

---

## 1. Formal definitions

### 1.1 Domain

A **Domain** is a named partition of client session state with a single authoritative resolution boundary.

| Domain | Observable responsibility |
|--------|---------------------------|
| `PROFILE` | User context and profile-derived insight views |
| `LIFE_EVENT` | Life Event plan projection |
| `ECONOMIC` | Economic Reality client plan projection |
| `SNAPSHOT` | UI snapshot projection |

A Domain is the atomic unit of sync planning, execution, failure attribution, and commit eligibility.

Domains are declared in the **Domain Sync Graph**. The graph is the sole authority for which domains exist and how they relate.

---

### 1.2 SyncEvent

A **SyncEvent** is an externally observable trigger that initiates one **SyncExecution** cycle.

| SyncEvent | Meaning | Initial domain seed |
|-----------|---------|---------------------|
| `PROFILE_MUTATED` | Profile state changed and a new authoritative user context is available | `PROFILE` |
| `ECONOMIC_ACTION_EXECUTED` | An economic action completed and economic projection may have changed | `ECONOMIC` |
| `SESSION_SYNC_REQUESTED` | Explicit refresh requested | Depends on requested scope (see §2.3) |

`SESSION_SYNC_REQUESTED` accepts a legacy **SyncScope**:

| SyncScope | Initial domain seed |
|-----------|---------------------|
| `PROFILE` | `PROFILE` |
| `ECONOMIC` | `ECONOMIC` |
| `FULL` | All domains in the graph |

A SyncEvent does not directly name the full set of domains to resolve. Initial seeds are expanded through graph traversal (§2).

---

### 1.3 SyncEdge and EdgeSemantics

A **SyncEdge** is a directed relationship between two domains:

```text
SyncEdge := (from: Domain, to: Domain, reason: EdgeSemantics)
```

**EdgeSemantics** define how downstream execution must behave when the upstream domain fails.

| EdgeSemantics | Meaning | Upstream failure behavior |
|---------------|---------|---------------------------|
| `cascade` | Downstream should be considered for sync when upstream is in scope | Does **not** block downstream execution |
| `dependency` | Downstream requires upstream resolution to succeed | **Blocks** downstream execution |
| `invalidate` | Downstream state is invalid if upstream failed | **Blocks** downstream execution |
| `recompute` | Downstream is derived from upstream and may be recomputed | Does **not** fetch; uses cached state only (§5.3) |

Allowed edge semantics in v1: `cascade`, `dependency`, `invalidate`, `recompute`.

An edge's semantics are part of the contract. Structural graph membership alone is insufficient; every edge must declare its semantics explicitly.

---

### 1.4 SyncPlan

A **SyncPlan** is the ordered list of domains to resolve in one SyncExecution.

Construction rules (normative):

1. **Seed** — Map the SyncEvent to one or more initial domains (§1.2).
2. **Expand** — Repeatedly add all domains reachable from the current set via any graph edge until fixed point.
3. **Order** — Produce a deterministic topological ordering of the expanded domain set.
4. **Annotate** — Each plan step records the domain and the set of incoming edge semantics that justified its inclusion.

**SyncPlan ordering invariants:**

- Order must be a valid topological sort of the expanded subgraph.
- When multiple domains are eligible at the same depth, tie-break using the canonical domain precedence:  
  `PROFILE` → `LIFE_EVENT` → `ECONOMIC` → `SNAPSHOT`.
- For the same `(SyncEvent, graph, currentState)` input, the resulting SyncPlan must be identical across replays.

**Canonical v1 plans (reference behavior):**

| SyncEvent / scope | Resulting domain order |
|-------------------|------------------------|
| `PROFILE_MUTATED` | `PROFILE`, `LIFE_EVENT`, `ECONOMIC`, `SNAPSHOT` |
| `ECONOMIC_ACTION_EXECUTED` | `ECONOMIC`, `SNAPSHOT` |
| `SESSION_SYNC_REQUESTED` / `PROFILE` | `PROFILE`, `LIFE_EVENT`, `ECONOMIC`, `SNAPSHOT` |
| `SESSION_SYNC_REQUESTED` / `ECONOMIC` | `ECONOMIC`, `SNAPSHOT` |
| `SESSION_SYNC_REQUESTED` / `FULL` | `PROFILE`, `LIFE_EVENT`, `ECONOMIC`, `SNAPSHOT` |

The annotated plan is authoritative for failure semantics; the domain order alone is sufficient for replay equivalence tests.

---

### 1.5 DomainSyncResult

A **DomainSyncResult** records the outcome of resolving one domain within a SyncExecution.

| Field | Meaning |
|-------|---------|
| `domain` | Domain being resolved |
| `status` | `success`, `failed`, or `skipped` |
| `error` | Human-observable failure or skip explanation when applicable |
| `skipReason` | Present when `status = skipped` |
| `usedCachedSnapshot` | Present when resolution used cached state instead of fetch |

**Status semantics:**

| Status | Observable meaning |
|--------|-------------------|
| `success` | Domain resolved successfully; payload is eligible for commit |
| `failed` | Domain resolution failed; payload must not be committed |
| `skipped` | Domain was not fetched due to graph semantics or fallback policy |

A SyncExecution produces one DomainSyncResult per step in the SyncPlan, in plan order.

---

### 1.6 ConsistencyPolicy

**ConsistencyPolicy** is the commit gate evaluated after all planned domain steps complete.

| Policy | Meaning |
|--------|---------|
| `satisfied` | All required domains resolved successfully, or were legitimately skipped under recompute cache rules (§5.3) |
| `degraded` | At least one domain failed, or was blocked/skipped in a way that prevents a coherent multi-domain commit |

ConsistencyPolicy is evaluated from the full set of DomainSyncResults. It is not inferred from individual fetch HTTP status codes alone.

---

### 1.7 SyncExecution

A **SyncExecution** is one complete reactive cycle from SyncEvent ingestion through final commit decision.

Phases:

1. **Plan** — Construct SyncPlan from `(SyncEvent, graph, currentState)`.
2. **Execute** — Resolve each domain in plan order under failure-aware rules (§4–§5).
3. **Evaluate** — Derive ConsistencyPolicy from DomainSyncResults.
4. **Commit** — Apply exactly one atomic commit decision (§6).

At most one SyncExecution's final commit may be visible per completed cycle.

---

### 1.8 CurrentState

**CurrentState** is the runtime's known sync posture at plan construction time.

Minimum v1 surface:

| Field | Meaning |
|-------|---------|
| `syncedDomains` | Domains whose last committed resolution is considered current |

`CurrentState` is an input to plan construction and replay. Future contract revisions may use it to prune unnecessary work; v1 plan outputs must remain stable regardless of `syncedDomains` contents.

---

## 2. Domain Sync Graph

### 2.1 Graph structure

A **Domain Sync Graph** comprises:

- a finite set of declared domains
- a finite set of directed SyncEdges, each with EdgeSemantics

The graph is static within a contract version. Dynamic scope explosion via hardcoded orchestration branches is forbidden.

### 2.2 Canonical v1 graph

```text
PROFILE ──cascade──► ECONOMIC
PROFILE ──cascade──► LIFE_EVENT
LIFE_EVENT ──dependency──► ECONOMIC
ECONOMIC ──recompute──► SNAPSHOT
```

### 2.3 Graph invariants (normative)

**G1 — SNAPSHOT is terminal**  
`SNAPSHOT` has no outgoing edges. No domain may depend on a state change propagated beyond `SNAPSHOT` within the same graph.

**G2 — No cascade cycles**  
The subgraph containing only `cascade` edges must be acyclic. Cascade expansion must always terminate.

**G3 — Dependency and invalidate are blocking semantics**  
If domain *A* fails and an incoming edge `A → B` has semantics `dependency` or `invalidate`, domain *B* must not be fetched.

**G4 — ECONOMIC reachability**  
`ECONOMIC` must be reachable from `PROFILE` or `LIFE_EVENT` by at least one path in every valid graph revision. Economic projection must never be an orphaned island.

**G5 — Semantic explicitness**  
Every edge must declare exactly one EdgeSemantics. Implicit cascade behavior is not permitted in the graph definition.

**G6 — Expansion is edge-driven only**  
SyncPlan expansion adds a domain *only* when it is the `to` endpoint of an edge whose `from` domain is already in the expanded set. No domain may enter a plan without graph justification.

---

## 3. SyncPlan construction rules

### 3.1 Determinism

Given identical inputs:

```text
(SyncEvent, Domain Sync Graph, CurrentState)
```

the platform must produce:

- the same domain order
- the same per-step edge semantics annotation
- the same execution decisions under identical downstream fetch outcomes

### 3.2 Expansion algorithm (behavioral)

1. Start from the event's initial domain seed set.
2. Until no new domains are added:
   - For every edge `(from → to)`, if `from` is in the set and `to` is not, add `to`.
3. Topologically sort the expanded set using graph edges and canonical tie-breaking (§1.4).
4. Attach incoming edge semantics to each step.

### 3.3 Scope compatibility

Legacy SyncScope values are entry-point aliases only. They must not bypass graph expansion.

- `PROFILE` scope is not a promise to sync only profile payloads; it is a promise to start from `PROFILE` and honor downstream graph semantics.
- `FULL` scope is not a special hardcoded fetch bundle; it is a promise to include all declared domains as seeds before expansion.

---

## 4. Execution invariants

### 4.1 Sequential resolution

Domains in a SyncPlan are resolved **sequentially** in plan order. Parallel domain resolution within a single SyncExecution is not permitted if it could observably violate ordering or failure gating.

### 4.2 Execution decision rules

Before resolving domain *D*, evaluate all incoming edges to *D* whose upstream domains have already completed:

| Incoming edge semantics | Upstream `failed` | Required behavior |
|-------------------------|-------------------|-------------------|
| `cascade` | yes | Proceed with resolution of *D* |
| `dependency` | yes | Skip *D*; record blocked skip |
| `invalidate` | yes | Skip *D*; record invalidation skip |
| `recompute` | yes | Skip fetch; apply cached fallback rules (§5.3) |
| any | upstream `success` or legitimately skipped under recompute cache | Proceed |

Skipped domains due to blocking semantics must not trigger fetch.

### 4.3 Loading posture

When a SyncExecution begins, all domains in the plan must enter a loading posture together.

When a SyncExecution completes, loading posture for planned domains must clear together as part of the final commit decision.

Users must not observe a mixed state where some planned domains appear refreshed while others remain indefinitely loading after cycle completion.

### 4.4 Consistency status (observable)

The runtime exposes a consistency status distinct from per-domain loading:

| Status | Observable meaning |
|--------|-------------------|
| `idle` | No active session sync obligation |
| `syncing` | SyncExecution in progress |
| `consistent` | Last completed cycle had `ConsistencyPolicy = satisfied` |
| `degraded` | Last completed cycle had `ConsistencyPolicy = degraded` |
| `invalid` | SyncExecution aborted by catastrophic error before policy evaluation |

---

## 5. Failure model

### 5.1 Failure is recorded, never silently dropped

Every failed or skipped domain resolution must produce a DomainSyncResult with an observable error or skip reason. Failures must not be converted into empty successful payloads.

### 5.2 Dependency and invalidate failures

If domain *A* fails:

- Any domain *B* connected by `dependency` or `invalidate` from *A* must be skipped without fetch.
- The skip must be attributed to upstream failure, not to an independent fetch error.

### 5.3 Cascade failures

If domain *A* fails:

- Any domain *B* connected only by `cascade` from *A* may still be resolved.
- Cascade failure does not, by itself, authorize blocking downstream domains.

### 5.4 Recompute failures and cached fallback

If domain *A* fails and domain *B* is connected by `recompute` from *A*:

- *B* must **not** be fetched.
- The runtime must attempt to retain the last successfully committed state for *B* from the **domain cache**.
- If cached state exists:
  - *B* is recorded as `skipped` with `usedCachedSnapshot = true`
  - This skip does not, by itself, force `degraded` policy
- If cached state does not exist:
  - *B* is recorded as `skipped` without a valid cached fallback
  - Policy must evaluate to `degraded`

**Recompute invariant:** A `recompute` edge never authorizes a network fetch on upstream failure. Fetch is permitted only when all upstream domains required by incoming edges completed successfully.

### 5.5 Policy evaluation

`ConsistencyPolicy = satisfied` only when:

- every planned domain is `success`, **or**
- a domain is `skipped` solely due to `recompute` cache fallback with a valid cached snapshot

`ConsistencyPolicy = degraded` when:

- any domain is `failed`, or
- any domain is `skipped` due to `dependency`, `invalidate`, or recompute without cache

---

## 6. Commit invariants

### 6.1 Single atomic commit per SyncExecution

Each completed SyncExecution must produce exactly **one** final commit decision.

Intermediate per-domain commits that mutate user-visible session state are forbidden.

### 6.2 All-or-nothing domain commit under satisfied policy

When `ConsistencyPolicy = satisfied`:

- All successful domain payloads from the cycle must be committed together.
- Partial domain payload commit is forbidden.

When `ConsistencyPolicy = degraded`:

- New domain payloads from the failed cycle must **not** be committed.
- Previously committed state must remain visible.
- Loading and error surfaces may update to reflect the degraded cycle.

### 6.3 commitStateTransaction rules

The atomic commit operation must obey:

| Rule | Requirement |
|------|-------------|
| **C1 — Policy gate** | Domain payloads commit only when `ConsistencyPolicy = satisfied` |
| **C2 — Atomicity** | One commit invocation per SyncExecution terminus |
| **C3 — Clone safety** | Committed payloads must not share live mutable references with fetch buffers |
| **C4 — Revision integrity** | Profile head revision advances only on satisfied commits that include an authoritative profile mutation seed |
| **C5 — Snapshot monotonicity** | Snapshot version must not regress relative to the last applied committed snapshot |
| **C6 — Error surfacing** | Domain-level errors from the cycle must be observable even when policy is degraded |

### 6.4 Domain cache rules

The runtime maintains a **domain cache** of last successfully committed payloads per domain.

| Rule | Requirement |
|------|-------------|
| **K1 — Success only** | Cache updates occur only after a `satisfied` commit that included a successful resolution for that domain |
| **K2 — No partial cache write** | Failed or degraded cycles must not overwrite cached domain payloads |
| **K3 — Recompute source** | Cached payloads are the only authorized source for recompute fallback |
| **K4 — Session boundary** | Cache must be cleared when the session ends or session identity changes |

---

## 7. Sync replay model

A SyncExecution must be **replayable** from:

```text
(SyncEvent, CurrentState, Domain Sync Graph)
```

plus the external fetch outcomes that would have been observed during the original cycle.

Replay guarantees:

1. **Plan replay** — The SyncPlan is a pure function of event, graph, and current state.
2. **Decision replay** — Execution gating decisions are a pure function of the plan, graph, edge semantics, and ordered upstream DomainSyncResults.
3. **Policy replay** — ConsistencyPolicy is a pure function of the full DomainSyncResult vector.
4. **Commit replay** — Given the same policy and payloads, commit eligibility is identical.

Corollary: For successful paths with no fetch failures, a sequence of SyncEvents must produce deterministic final UI state independent of timing, scheduling, or concurrent event ordering beyond the runtime's serial ingestion queue.

---

## 8. Extension rule

Adding a new domain to the platform must require **only**:

1. A new node in the Domain Sync Graph
2. One or more declared SyncEdges with explicit EdgeSemantics
3. An addition to this contract identifying the domain's observable responsibility and any new invariants

Adding a new domain must **not** require modification of:

- the sync execution engine's control flow
- the orchestration model's serial ingestion semantics
- commit atomicity rules

Domain-specific resolution behavior is registered against the domain name; the engine remains graph-driven.

Violations of this rule constitute contract drift and must be remediated before the new domain is considered platform-governed.

---

## 9. Relationship to existing specifications

### 9.1 Golden User Journeys v1

[Golden User Journeys v1](../testing/golden-user-journeys-v1.md) defines user-visible outcomes that must survive internal refactors.

This contract is the **runtime synchronization substrate** for those journeys:

- Profile correction journeys depend on `PROFILE_MUTATED` expanding to dependent domains without manual full-scope refresh.
- Economic action journeys depend on `ECONOMIC_ACTION_EXECUTED` reaching `SNAPSHOT` through `recompute` semantics.
- Determinism requirements in Golden Journeys are preserved by the replay model (§7).

A change that passes module-level tests but violates this contract may still break Golden Journeys.

### 9.2 Runtime Reactivity Audit v1

[Runtime Reactivity Audit v1](../audits/runtime-reactivity-audit-v1.md) documented pre-consolidation gaps: fragmented refresh graphs, stale economic state, and silent non-updates.

This contract encodes the structural remedies as enforceable rules:

- graph-driven propagation instead of ad hoc refetch
- serial SyncExecution with atomic commit
- explicit failure and degraded posture instead of silent partial staleness

Audit findings labeled as reactive consistency defects should be evaluated against §4–§6 of this document.

### 9.3 Economic Reality v1 Closure Spec

[Economic Reality v1 Closure Spec](../economic-reality/economic-reality-v1-closure-spec.md) defines deterministic server-side economic projection and `deterministicHash` semantics.

This contract does not alter economic computation. It governs **when** the client may replace its economic projection and **when** it must withhold commit to avoid inconsistent cross-domain UI.

`deterministicHash` remains the client authority for economic identity across action execution; satisfied commits must preserve hash semantics already established by the closure spec.

---

## 10. Conformance checklist

An implementation is conformant when all of the following hold:

- [ ] SyncPlans match canonical v1 outputs for reference events (§1.4)
- [ ] Graph invariants G1–G6 are satisfied (§2.3)
- [ ] No per-domain user-visible commit mid-cycle (§6.1)
- [ ] `degraded` cycles do not mutate committed domain payloads (§6.2)
- [ ] `recompute` never fetches on upstream failure (§5.4)
- [ ] Domain cache updates only on satisfied successful resolution (§6.4)
- [ ] Replay inputs produce identical plans and decisions (§7)
- [ ] New domains are added via graph + contract only (§8)

---

## 11. Non-goals (v1)

The following are explicitly out of scope for this contract version:

- Server-side projection orchestration
- Cross-tab synchronization
- Offline mutation queues
- Background polling intervals
- Retry/backoff policy (may be added in v2 as an extension without changing plan determinism)
- Partial degraded commits ("best effort refresh")

---

## 12. Versioning

| Version | Meaning |
|---------|---------|
| **Contract v1** | Initial frozen behavioral contract for Runtime Consistency Model v2 |
| **Model v2** | Graph-driven sync with edge semantics and failure-aware execution |

Breaking changes to SyncPlan outputs, policy rules, or commit invariants require a new contract version and explicit migration notes.

---

## Document control

| Field | Value |
|-------|-------|
| **Status** | Active / Frozen |
| **Supersedes** | Informal Runtime Consistency Model v1 scope mapping |
| **Enforcement** | E2E golden journeys, runtime unit contract tests, architecture review |
| **Next review trigger** | New domain added to client runtime, or degraded-state UX contract defined |
