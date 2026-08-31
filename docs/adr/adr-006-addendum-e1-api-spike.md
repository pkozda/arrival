---
id: adr-006-addendum-e1-api-spike
title: ADR-006 Addendum — PDE E1 API Spike Decisions
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-30
updated: 2026-08-30
related:
  - adr-006-personal-discovery-engine-boundaries
  - personal-discovery-engine-strategy-contract
  - personal-discovery-engine-domain-model
  - personal-discovery-engine-pipeline
---

# ADR-006 Addendum — PDE E1 API Spike Decisions

**Status:** Accepted (E1 spike)  
**Date:** 2026-08-30  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

This addendum records the four API decisions deferred in the Strategy Contract §11. It does not rewrite the architecture RFC.

---

## Decision 1 — Strategy typing

**Decision:** Keep a **shared `DiscoveryCriteria` envelope** for Profile/Run/pipeline, and keep **`DiscoveryStrategy<TCriteria, TRaw, TNormalized>` generics** for strategy modules. Registry and pipeline use the erased `DiscoveryStrategyModule` bound to the shared envelope + `RawCandidatePayload` + `NormalizedCandidateData`.

**Rationale:** Pipeline must stay strategy-agnostic; Profiles must persist criteria without strategy-private schemas. Generics still give strategy authors type-safe narrowings inside their modules without forcing the engine to know Job vs Giveaway field sets.

**Rejected:** Fully opaque `payload: unknown` per strategy (weakens shared validation/UI schema path); fully non-generic strategy with only `unknown` methods (loses authoring safety); deep per-strategy criteria unions in the engine (couples engine to every future category).

**Consequence:** Strategies validate/interpret Criterion keys they own. Future housing strategies add keys + a new module; engine types stay stable.

---

## Decision 2 — Ranking ownership

**Decision:** `rank(score, context)` lives on **`ScoringPolicy`** (strategy-owned, pure). Engine does not implement a global `Match × Confidence × …` formula.

**Rationale:** Architecture requires strategy-defined ranking; giveaways may boost deadline urgency over raw match. Placing `rank` on the policy object is the smallest surface the pipeline can call without knowing strategy internals.

**Rejected:** Separately registered rank function ids (extra indirection for E1); engine-owned ranking formula; rank on `DiscoveryStrategy` root separate from scoring thresholds (splits related concerns).

**Consequence:** Headline `matchScore` / `confidenceScore` remain distinct; notify thresholds stay on the same policy; E4/E5 may replace stub `rank` bodies without engine changes.

---

## Decision 3 — `DiscoveryQuery`

**Decision:** Adapter-neutral descriptor with `id`, `intent`, `text`, optional `locale`, `geography`, `constraints`, `priority`, `metadata`. No HTTP/SDK/provider types.

**Rationale:** `buildQueries()` must express semantic intent only. Search adapters map queries to vendors outside the domain package.

**Rejected:** Embedding Google/Bing/Tavily/SerpAPI types; passing `Request`/`Axios` configs; provider-specific response shapes on the query object.

**Consequence:** Adapters may ignore unknown constraints; strategies must not put secrets or vendor keys in `metadata`.

---

## Decision 4 — `normalize()` return type

**Decision:** `normalize(raw, ctx)` returns **`NormalizedCandidateData`** (identity + extracted + optional sourceHints) — a **patch/DTO**, not a full `DiscoveryCandidate`.

**Rationale:** Engine owns candidate lifecycle (`id`, `runId`, `stage`, rejection, filter flags). Strategies own interpretation of raw hits. Immutable pipeline stages apply normalize output into a new candidate object (E2).

**Rejected:** Returning a complete `DiscoveryCandidate` (forces strategies to invent lifecycle fields); mutating a shared candidate bag; tying `DiscoveryCandidate` to vendor raw types.

**Consequence:** E2 pipeline must merge `NormalizedCandidateData` into candidates; strategies remain easy to unit-test with plain raw payloads.

---

## Implementation pointer

Code: `packages/discovery/` (`@arrival-atlas/discovery`).  
Strategy contract updated to match these decisions.
