---
id: adr-006-personal-discovery-engine-boundaries
title: ADR-006 — Personal Discovery Engine Boundaries
project: Arrival Atlas
system: Arrival Atlas
status: proposed
maturity: evolving
owner: engineering
created: 2026-08-30
updated: 2026-08-30
related:
  - personal-discovery-engine-architecture
  - personal-discovery-engine-roadmap
  - personal-discovery-engine-mvp
  - discovery-domain-index
---

# ADR-006 — Personal Discovery Engine Boundaries

**Status:** Proposed  
**Date:** 2026-08-30

---

## Context

Arrival Atlas is adding a **Personal Discovery Engine (PDE)** for continuous external opportunity discovery (jobs, giveaways, later housing and more).

Without hard boundaries, implementation tends to:

- treat search hits as recommendations;
- let LLMs invent or “confirm” facts without retrieval;
- trust aggregators as final authority;
- optimize for result volume and notification spam;
- couple domain logic to a single job board or scraping stack;
- conflate PDE with MBDE (entitlements) or CSR (current situation).

Canonical design: [personal-discovery-engine-architecture.md](../discovery/personal-discovery-engine-architecture.md).

---

## Decision

### 1. Found ≠ verified

A `DiscoveryCandidate` is never a user-facing recommendation. Only a `DiscoveryResult` that passed strategy-required verification may be ranked into digests / notifications.

### 2. AI interprets; AI does not fabricate evidence

Deterministic infrastructure establishes facts (HTTP reachability, page presence, dates when parsed deterministically, official URL checks). AI may classify, extract, and score **against captured evidence**. AI output alone is insufficient for `VerificationResult` success when the strategy requires source checks.

### 3. Aggregators discover; authorities verify (when required)

When a strategy declares official-source verification (e.g. JobDiscoveryStrategyV1), aggregator pages may contribute candidates but cannot alone accept a final result.

### 4. Optimize for attention, not volume

Hard requirements reject before ranking. Digests and email prioritize novelty + trust. Zero-result days should usually **not** send email.

### 5. Strategy ≠ prompt

Strategies are versioned domain configuration (filters, verification, scoring, freshness, dedupe). Prompts are an adapter detail under `AIProvider`, not the strategy identity.

### 6. PDE is a separate capability

| Engine | Owns |
|--------|------|
| CSR | Current situation resolution |
| MBDE | Benefit / entitlement opportunity graph |
| PDE | External opportunity discovery against user criteria |

PDE must not subsume MBDE eligibility logic or CSR situation authority. Shared **User Context** is the integration point.

### 7. Domain package boundary

Core types and pure logic live in `packages/discovery/`. Search, fetch, AI, persistence, scheduler, and notification are adapters. UI remains strategy-driven presentation of domain digests/results.

---

## Consequences

### Positive

- Trustworthy notifications with inspectable evidence
- Replaceable search / AI vendors without rewriting domain rules
- Clear epic sequencing (foundation → pipeline → verify → strategies → AI → persist → schedule → UI → email)
- Aligns with Arrival Atlas certainty / explainability culture

### Negative / costs

- More pipeline stages than a naive “search API”
- Official verification increases latency and failure modes (mitigated by PARTIAL_SUCCESS)
- Evidence storage and observability are mandatory, not optional polish

### Forbidden patterns

- Surfacing unverified candidates in digests
- Scoring purchase-required giveaways as low match instead of REJECTED
- Letting page text override system instructions
- Sending “0 results” email as the default empty-day behavior
- Embedding employer-site HTML fetch logic inside React components as “the engine”

---

## Status notes

**Proposed** until first implementation epic (E1) lands and the team accepts this ADR in review. Supersession requires a new ADR.

**Expansion deferred:** After [domain model](../discovery/personal-discovery-engine-domain-model.md), [pipeline](../discovery/personal-discovery-engine-pipeline.md), and [strategy contract](../discovery/personal-discovery-engine-strategy-contract.md) stabilize, revisit this ADR to promote additional engine decisions (e.g. TriState coercion ban, immutable pipeline stages, rejection retention) if they deserve standalone decision records — rather than expanding ADR-006 prematurely.

---

## Related

- [Architecture RFC](../discovery/personal-discovery-engine-architecture.md)
- [Domain model](../discovery/personal-discovery-engine-domain-model.md)
- [Pipeline](../discovery/personal-discovery-engine-pipeline.md)
- [Strategy contract](../discovery/personal-discovery-engine-strategy-contract.md)
- [Roadmap](../discovery/personal-discovery-engine-roadmap.md)
- [MVP](../discovery/personal-discovery-engine-mvp.md)
- [Domain index](../discovery/README.md)
