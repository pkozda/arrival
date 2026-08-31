---
id: personal-discovery-engine-pipeline
title: Personal Discovery Engine — Pipeline Contract
project: Arrival Atlas
system: Arrival Atlas
type: spec
domain: discovery
status: proposed
maturity: evolving
owner: product
tags:
  - discovery
  - pde
  - pipeline
  - rejection
  - ai-gate
created: 2026-08-30
updated: 2026-08-30
depends_on:
  - personal-discovery-engine-domain-model
  - personal-discovery-engine-architecture
  - adr-006-personal-discovery-engine-boundaries
related:
  - personal-discovery-engine-strategy-contract
  - personal-discovery-engine-mvp
  - personal-discovery-engine-roadmap
  - discovery-domain-index
---

# Personal Discovery Engine — Pipeline Contract

**Status:** Proposed  
**Audience:** Implementers of epic **E2 — Discovery Pipeline** (and E3/E6 stage adapters)  
**Depends on:** [Domain model](./personal-discovery-engine-domain-model.md)

This document formalizes **how** a DiscoveryRun executes. Strategies declare **what** rules apply; the pipeline and adapters perform I/O.

---

## 1. Goals

1. Deterministic stage order with clear inputs/outputs.
2. **Immutable stage style:** each stage returns new data; no shared mutable bag.
3. Every rejection carries a **reason code** (explainability, metrics, strategy tuning).
4. **AI runs only after** cheap deterministic work and required verification steps.
5. Partial failures are first-class (`PARTIAL_SUCCESS`).

---

## 2. Immutability model

**Recommended (required for E2):**

```text
input
  ↓
stage(input, context) → output
  ↓
next stage
```

**Forbidden:**

```text
sharedCandidate.mutate()
stage2(sharedCandidate)
```

### Stage function shape

```ts
type StageResult<T> =
  | { ok: true; value: T }
  | { ok: false; rejection: RejectionRecord };

interface PipelineContext {
  run: DiscoveryRun;
  profile: DiscoveryProfile;
  strategy: DiscoveryStrategyDescriptor;
  enginePolicy: EnginePolicy;
  adapters: AdapterPorts;
}
```

Stages that operate on lists return **new arrays**; rejected items are moved to a `rejected[]` collection with reasons — never deleted silently.

```ts
interface PipelineBatch {
  active: DiscoveryCandidate[];
  rejected: Array<{ candidate: DiscoveryCandidate; rejection: RejectionRecord }>;
}
```

---

## 3. Canonical stage order

```text
0. ResolveStrategy + SnapshotCriteria
1. BuildQueries          (strategy)
2. Search / Discover     (adapters → RawCandidate[])
3. Collect / Fetch       (optional deepen)
4. Parse
5. Normalize             (strategy.normalize)
6. Deduplicate           (strategy.deduplicationPolicy)
7. Deterministic Filter  (strategy.filter — cheap)
8. Verify                (strategy.verificationPolicy + adapters)
9. AI Evaluate           (strategy.aiEvaluationPolicy — gated)
10. Score                (strategy.scoringPolicy)
11. Novelty / State      (engine + persistence)
12. Persist + Promote
13. Digest (optional, post-run)
```

Product shorthand:

```text
Search → Collect → Normalize → Deduplicate → Filter
  → Verify → AI → Score → Persist
```

---

## 4. Stage contracts

### 0 — ResolveStrategy + SnapshotCriteria

**In:** `profileId`  
**Out:** `PipelineContext` with frozen `criteriaSnapshot`, resolved `strategyVersion`  
**Fail:** invalid criteria → Run `FAILED` (no candidates)

### 1 — BuildQueries

**In:** criteria + strategy  
**Out:** `DiscoveryQuery[]` (opaque to engine; adapter-understood)  
**Owner:** Strategy (`buildQueries`)

### 2 — Search / Discover

**In:** queries  
**Out:** `RawCandidate[]` appended as `DiscoveryCandidate` at stage `DISCOVERED`  
**Owner:** Search adapters  
**Failure:** one provider down → continue; record diagnostic; may end `PARTIAL_SUCCESS`

### 3 — Collect / Fetch

**In:** candidates needing page bodies  
**Out:** candidates with `raw` refs populated  
**Owner:** PageFetcher adapter

### 4 — Parse

**In:** raw content  
**Out:** updated `extracted` facts (still not Evidence)  
**Owner:** ContentExtractor adapter

### 5 — Normalize

**In:** candidate + strategy  
**Out:** normalized identity + fields  
**Owner:** Strategy (`normalize`)

### 6 — Deduplicate

**In:** batch  
**Out:** survivors + `REJECTED_DUPLICATE` (or merge into canonical)  
**Owner:** Strategy dedupe policy + engine identity helpers

### 7 — Deterministic Filter

**In:** normalized candidate + criteria  
**Out:** pass or rejection reason  
**Owner:** Strategy (`filter`)  
**Rule:** hard failures → reject codes; **never** low match scores

### 8 — Verify

**In:** survivors  
**Out:** `VerificationResult` + Evidence ids; reject on FAIL / required UNKNOWN  
**Owner:** Verification adapters driven by strategy `verificationPolicy`  
**AI:** **not invoked here** for inventing facts

### 9 — AI Evaluate

**In:** candidates with VerificationStatus appropriate for AI (see §6)  
**Out:** refined `extracted` / suggested score inputs / optional reject  
**Owner:** AI adapter under strategy `aiEvaluationPolicy` + engine AI safety policy

### 10 — Score

**In:** candidate + verification + strategy scoring policy  
**Out:** `Score` with breakdown  
**Owner:** Strategy scoring policy using engine primitives

### 11 — Novelty / State

**In:** scored candidates vs persisted Results  
**Out:** create / update / skip notify decisions  
**Owner:** Engine + persistence

### 12 — Persist + Promote

**In:** promotion-eligible candidates  
**Out:** `DiscoveryResult` records  
**Invariant:** promotion rules from domain model §7 / ADR-006

---

## 5. Rejection reasons

### Placement

| Reason code | Typical stage |
|-------------|---------------|
| `REJECTED_LOCATION` | Filter |
| `REJECTED_SALARY` | Filter |
| `REJECTED_EXCLUDED_ROLE` | Filter |
| `REJECTED_PURCHASE_REQUIRED` | Filter or AI (if only detectable semantically) or Verify |
| `REJECTED_EXPIRED` | Filter or Verify (freshness) |
| `REJECTED_NO_OFFICIAL_SOURCE` | Verify |
| `REJECTED_VERIFICATION_FAIL` | Verify |
| `REJECTED_VERIFICATION_UNKNOWN` | Verify (required check UNKNOWN) |
| `REJECTED_LOW_CONFIDENCE` | Score |
| `REJECTED_DUPLICATE` | Deduplicate |
| `REJECTED_DETERMINISTIC_FILTER` | Filter (generic) |
| `REJECTED_SECURITY_POLICY` | Engine policy any stage |
| `REJECTED_OTHER` | Last resort |

Strategies may add **prefixed** codes (`job.REJECTED_SENIORITY_MISMATCH`) but must map to a base code for engine metrics.

### Fate of rejected candidates

```text
candidate
  ↓
rejected
  ↓
reason (+ stage + timestamp + details)
```

**Minimum retention:** for the lifetime of the DiscoveryRun (in-memory / run log).  
**Recommended MVP:** persist rejection summaries on the Run for debugging and strategy metrics (`run.stats.candidatesRejected`, sample reasons).

Silent drop is a **contract violation**.

---

## 6. AI gate (formal)

AI evaluation **may run only if**:

1. Candidate passed deterministic filter (stage 7).
2. Required verification steps for this strategy have been **attempted**.
3. Engine cost policy allows another AI call in this Run.
4. Strategy `aiEvaluationPolicy` marks the candidate as eligible (e.g. verification PASS, or PASS with specific UNKNOWN optional fields).

AI evaluation **must not**:

- run on raw unfiltered search hits;
- replace verification HTTP/page checks;
- fabricate Evidence URLs;
- promote a candidate by itself.

If AI detects purchase-required / excluded semantics → emit rejection (`REJECTED_PURCHASE_REQUIRED` / strategy code), do not soft-score.

```text
cheap filters
      ↓
verification (facts)
      ↓
AI (interpretation)   ← only here
      ↓
score
```

---

## 7. Hold vs reject

| Outcome | Meaning | User-facing |
|---------|---------|-------------|
| **Reject** | Terminal for this Run’s promotion path | Not in digest |
| **Hold** | Insufficient info (`UNKNOWN`); may retry next Run | Not in digest (MVP) |

MVP: treat required-`UNKNOWN` as `REJECTED_VERIFICATION_UNKNOWN` (or Hold stored only in diagnostics). Do not create Results for holds.

---

## 8. Run status mapping

| Condition | Status |
|-----------|--------|
| All critical adapters OK, pipeline completed | `SUCCESS` |
| Some search/fetch adapters failed; some Results produced | `PARTIAL_SUCCESS` |
| Criteria invalid / strategy missing / total abort | `FAILED` |
| Cancelled by operator | `CANCELLED` |

---

## 9. Observability hooks (per stage)

Each stage should emit structured events:

```text
runId, stage, candidateId?, durationMs, outcome, reasonCode?, adapter?, costUnits?
```

Enough to answer architecture §36 questions without re-running blind.

---

## 10. What the pipeline does **not** know

- Job board HTML structure details (adapters)
- Giveaway “is this a scam” proprietary heuristics beyond strategy policy
- Email template rendering (notification adapter)
- CSR / MBDE internals (only User Context ports if injected later)

---

## 11. Consistency with ranking

Pipeline **Score** stage produces `Score` / `ScoreBreakdown`.  
**Final ordering** for digests is strategy-defined using those primitives — not a hardcoded engine product formula.

---

## Related

- [Domain model](./personal-discovery-engine-domain-model.md)
- [Strategy contract](./personal-discovery-engine-strategy-contract.md)
- [Architecture RFC](./personal-discovery-engine-architecture.md)
- [Roadmap E2/E3/E6](./personal-discovery-engine-roadmap.md)
- [ADR-006](../adr/adr-006-personal-discovery-engine-boundaries.md)
