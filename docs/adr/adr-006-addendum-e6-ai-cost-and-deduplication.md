---
id: adr-006-addendum-e6-ai-cost-and-deduplication
title: ADR-006 Addendum — PDE Roadmap E6 AI Cost & Deduplication
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-31
updated: 2026-08-31
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e3-6-ai-adapter
  - adr-006-addendum-e5-5-observability
  - discovery-domain-index
  - personal-discovery-engine-roadmap
---

# ADR-006 Addendum — PDE Roadmap E6 AI Cost & Deduplication

**Status:** Accepted (canonical roadmap E6 closure)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Context

Canonical roadmap **E6 — AI Evaluation Layer** requires cost-aware call gating for post-verification candidates. Implementation epics **E6.1–E6.3** (service / HTTP / auth) are **not** this layer; AI was already delivered as E2.4 gate + E3.6 OpenAI adapter.

Remaining gaps vs the roadmap audit were:

- estimated token budget
- AI evaluation deduplication
- (optional) evaluation tiers / per-profile budget

---

## Decision

Close roadmap E6 by extending the existing AI gate with **provider-neutral cost accounting** and **run-scoped evaluation dedupe**.

### Cost policy (additive on `EnginePolicy`)

| Field | Role |
|-------|------|
| `maxAiEvaluationsPerRun` | Existing call-count budget |
| `maxEstimatedAiInputTokensPerRun?` | Optional estimated input-token budget |
| `maxEstimatedAiOutputTokensPerRun?` | Optional estimated output-token budget |

Resolved via `resolveAiCostPolicy` → `AiCostPolicy` (`maxEvaluationsPerRun` + optional token caps).

### Why accounting is **estimated**

- No provider billing API dependency
- No OpenAI-specific pricing tables
- Tokens are derived deterministically from structured JSON payload size (`ceil(utf8Length / 4)`)
- Missing metadata never invents usage; provider failures consume **no** token budget
- Pre-call output reserve uses a task-count heuristic so gates can block before I/O

### Budget skip semantics

Exhausted count/token budget → diagnostic skip (`AI_BUDGET_EXHAUSTED` / `AI_TOKEN_BUDGET_EXHAUSTED`), **not** `AI_ADAPTER_FAILED`. Candidate continues without fabricated evaluation.

### Fingerprint

`computeAiEvaluationFingerprint` hashes stable material:

- strategy id/version
- candidate identity
- criteria
- verification summary
- allowed tasks / rejectOn
- extracted fields
- evidence IDs

Excludes runId, jobId, timestamps, and random IDs.

### Deduplication scope — **run-scoped**

`AiEvaluationCache` (`createInMemoryAiEvaluationCache`) lives on `PipelineContext` for one DiscoveryRun.

- Same fingerprint within a run → reuse evaluation, no provider call, no second budget consume (`AI_ALREADY_EVALUATED` / `SKIPPED_ALREADY_EVALUATED`)
- Invalid / incompatible cached evaluation → evaluate again
- OpenAI adapter remains unaware of dedupe
- Cross-run / restart persistence is **not** required to close roadmap E6; durable AI memory remains deferred operational hardening

### Why evaluation tiers are not introduced

Call-count + estimated token budgets + fingerprint dedupe already provide cost-aware gating without a second provider, alternate endpoints, or pricing system. Tiers would be ceremony without payoff in the current single-adapter design.

### Why per-profile budget is deferred

Stable `profileId` exists, but a correct per-profile budget needs durable counters across runs/restarts. That is operational hardening beyond the minimal E6 closure; per-run budgets remain the enforced control.

### Authority unchanged

AI still cannot change verification, invent evidence/URLs, modify identity, or promote. Page text remains `untrustedExtractedContent`. Budget/dedupe metadata cannot bypass `validateAiEvaluation` or Verify PASS.

### Explicitly still deferred

- LLM as primary content extractor
- Embeddings / vector semantic index
- Multi-provider AI fallback
- Live LLM tests
- Cross-run persistent AI evaluation store
- Per-profile durable AI budgets
- Evaluation pricing tiers

`RELEVANCE` / `EXTRACT` remain LLM-assisted interpretation of already-extracted, post-verification material — sufficient for the current E6 contract once cost/dedupe controls exist.

### Telemetry (E5.5)

Additive events: `ai.gate.skipped`, `ai.evaluation.started`, `ai.evaluation.completed`, `ai.evaluation.deduplicated`, `ai.budget.exhausted`. No prompts, HTML, secrets, or raw model bodies.

---

## Consequences

- Roadmap E6 can be marked **COMPLETE** for the AI Evaluation Layer as defined in `personal-discovery-engine-roadmap`
- Implementation E6.1–E6.3 remain separate application/HTTP concerns
- Operators may tighten token caps without changing adapters
- Cross-run dedupe / profile budgets may be added later without changing `AiAdapter`

---

## Related

- [E3.6 AI adapter](./adr-006-addendum-e3-6-ai-adapter.md)
- [E5.5 observability](./adr-006-addendum-e5-5-observability.md)
- [Discovery README](../discovery/README.md)
- [Roadmap](../discovery/personal-discovery-engine-roadmap.md)
