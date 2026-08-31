---
id: personal-discovery-engine-strategy-contract
title: Personal Discovery Engine — Strategy Contract
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
  - strategy
  - contract
  - jobs
  - giveaways
created: 2026-08-30
updated: 2026-08-30
depends_on:
  - personal-discovery-engine-domain-model
  - personal-discovery-engine-pipeline
  - personal-discovery-engine-architecture
  - adr-006-personal-discovery-engine-boundaries
related:
  - personal-discovery-engine-mvp
  - personal-discovery-engine-roadmap
  - discovery-domain-index
---

# Personal Discovery Engine — Strategy Contract

**Status:** Proposed (API not frozen until E1/E4 review)  
**Audience:** Authors of `JobDiscoveryStrategyV1`, `GiveawayDiscoveryStrategyV1`, and future strategies  
**Depends on:** [Domain model](./personal-discovery-engine-domain-model.md) · [Pipeline](./personal-discovery-engine-pipeline.md)

This document turns hand-operated discovery algorithms into **declarative, versioned strategies** that the pipeline executes.

---

## 1. Core separation

```text
Strategy
   │  declares rules / policies / pure transforms
   ▼
Pipeline
   │  orchestrates stages in order
   ├── Search Adapter
   ├── Fetch Adapter
   ├── Verification Adapter
   ├── AI Adapter
   └── Persistence Adapter
```

### Architectural error (forbidden)

```ts
class JobDiscoveryStrategy {
  async runEverything() {
    searchGoogle();
    scrapeStepstone();
    callOpenAI();
    // ...
  }
}
```

A strategy must **not** own I/O orchestration. It must not embed vendor SDKs.

### Correct mental model

> Strategy says **what must be true and how to interpret candidates**.  
> Pipeline says **when stages run**.  
> Adapters say **how to talk to the outside world**.

Adding `HousingStrategyV1` must not rewrite the engine — only register a new strategy descriptor + policies + pure functions.

---

## 2. Engine policy vs strategy policy

| | **EnginePolicy** (global) | **Strategy policy** (per strategy version) |
|--|---------------------------|--------------------------------------------|
| Owner | ADR-006 + engine package | Strategy registry |
| Examples | Found ≠ verified; AI cannot fabricate evidence; external content untrusted; TriState coercion ban; cost/AI safety defaults | Official source required; purchase-required → reject; scoring weights; fingerprint fields; freshness cadence |
| Change process | ADR / engine release | New strategy **version** |

Strategies **may not** weaken engine invariants (e.g. cannot set “aggregator alone is enough” if engine requires verification when policy says official required — the strategy chooses whether official is required; if it sets required, engine enforces PASS rules).

---

## 3. Strategy interface (E1 resolved)

```ts
interface DiscoveryStrategy<
  TCriteria extends DiscoveryCriteria = DiscoveryCriteria,
  TRaw extends RawCandidatePayload = RawCandidatePayload,
  TNormalized extends NormalizedCandidateData = NormalizedCandidateData,
> {
  id: string;
  version: string;

  validateCriteria(criteria: TCriteria): ValidationResult;
  buildQueries(criteria: TCriteria): DiscoveryQuery[];
  /** Returns NormalizedCandidateData patch — not a full DiscoveryCandidate */
  normalize(raw: TRaw, ctx: NormalizeContext): TNormalized;
  filter(candidate: TNormalized, criteria: TCriteria): FilterResult;

  verificationPolicy: VerificationPolicy;
  scoringPolicy: ScoringPolicy; // includes pure rank(score, context)
  freshnessPolicy: FreshnessPolicy;
  deduplicationPolicy: DeduplicationPolicy;
  aiEvaluationPolicy: AiEvaluationPolicy;
}
```

Registry / pipeline use erased `DiscoveryStrategyModule` (shared envelope bounds). See [ADR-006 addendum](../adr/adr-006-addendum-e1-api-spike.md).

### Pure vs effectful

| Method / field | Effectful? |
|----------------|------------|
| `validateCriteria` | No |
| `buildQueries` | No (returns query descriptors only) |
| `normalize` | No |
| `filter` | No |
| `scoringPolicy.rank` | No |
| `*Policy` objects | Declarative data + pure evaluators |

All network/AI/DB effects stay in adapters invoked by the pipeline.

---

## 4. Policy object shapes (draft)

### VerificationPolicy

```ts
interface VerificationPolicy {
  /** If true, VerificationStatus must be PASS before promotion */
  requireVerificationPass: boolean;

  requiredChecks: Array<{
    id: string;
    /** UNKNOWN on a required check → reject/hold per pipeline */
    allowUnknown: false; // MVP: required checks disallow UNKNOWN as pass
  }>;

  /** e.g. jobs: official employer site */
  requireOfficialSource: boolean;

  acceptedSourceTrustForDiscovery: SourceTrust[]; // where candidates may originate
}
```

### ScoringPolicy

```ts
interface ScoringPolicy {
  dimensions: Array<{
    id: string;
    weight: number;
    /** How this dimension is computed — pure function id or inline rules */
  }>;

  /** Minimum confidence to promote / notify — strategy-defined */
  minConfidenceToNotify: number;
  minMatchToNotify: number;

  /**
   * Ranking is strategy-defined. Engine supplies ScoreBreakdown primitives.
   * Do NOT assume Match * Confidence * … as the global formula.
   */
  rank(scores: Score, context: RankContext): number;
}
```

### FreshnessPolicy

```ts
interface FreshnessPolicy {
  reverifyEvery: 'EVERY_RUN' | 'DAILY' | 'ON_NOTIFY';
  expireWhen: Array<'DEADLINE_PASSED' | 'PAGE_GONE' | 'MARKED_CLOSED'>;
}
```

### DeduplicationPolicy

```ts
interface DeduplicationPolicy {
  fingerprintFields: string[];
  preferSourceTrust: SourceTrust[]; // tie-break when merging
}
```

### AiEvaluationPolicy

```ts
interface AiEvaluationPolicy {
  enabled: boolean;
  /** Only after verification attempted / passed per pipeline gate */
  tasks: Array<'CLASSIFY' | 'EXTRACT' | 'RELEVANCE' | 'PURCHASE_REQUIREMENT' | 'SENIORITY'>;
  rejectOn: RejectionReasonCode[]; // reasons AI is allowed to emit
}
```

---

## 5. JobDiscoveryStrategyV1 (intent)

Maps the current manual job algorithm into strategy terms.

| Concern | Strategy rule |
|---------|----------------|
| Required | Active vacancy; employment type; tech/domain; geography |
| Verification | `requireOfficialSource: true` — aggregator insufficient for PASS |
| Filter rejects | Excluded roles (e.g. Team Lead), wrong country, expired |
| AI | Seniority / role / tech relevance / location semantics |
| Scoring dimensions | role, technology, location, seniority, employment, salary, freshness, source confidence |
| Ranking | Strategy `rank()` — may boost urgency; **not** mandated product formula |

---

## 6. GiveawayDiscoveryStrategyV1 (intent)

| Concern | Strategy rule |
|---------|----------------|
| Required | Germany (or configured); free participation; identifiable organizer; active window |
| Hard reject | Purchase required (`TRUE`); paid lottery; unclear organizer; expired |
| TriState | `purchaseRequired: UNKNOWN` → cannot PASS free-entry requirement |
| Verification | Organizer, campaign page, deadline, terms, free participation confirmed |
| AI | Detect “formally free but buy product” → `REJECTED_PURCHASE_REQUIRED` |
| Ranking | Deadline urgency and prize value may dominate raw match |

---

## 7. Criteria UI coupling

UI is **strategy-driven**: the strategy exposes a criteria schema (JSON Schema or equivalent) for forms. The engine does not hardcode Job vs Giveaway fields.

```text
Strategy.criteriaSchema → UI renderer → DiscoveryCriteria → validateCriteria
```

---

## 8. Versioning rules

1. Behavioral change ⇒ new `version` string.
2. Runs store `strategyVersion` permanently for audit.
3. Profiles pin a version; upgrades are explicit.
4. Do not mutate V1 semantics in place to “fix” scores.

---

## 9. Testing contract

Each strategy version ships with:

| Test type | Examples |
|-----------|----------|
| Criteria validation | Missing required country → error |
| Filter fixtures | Excluded role → `REJECTED_EXCLUDED_ROLE` |
| Verification fixtures | Aggregator-only + requireOfficial → not PASS |
| TriState fixtures | `purchaseRequired: UNKNOWN` → not free-entry PASS |
| Scoring fixtures | High match / low confidence → below notify threshold |
| Golden files | Anonymized HTML fixtures for normalize/filter |

Pipeline integration tests use **fake adapters**; strategy unit tests need **no network**.

---

## 10. Registration

```ts
interface StrategyRegistry {
  get(id: string, version: string): DiscoveryStrategyDescriptor;
  listLatest(): DiscoveryStrategyDescriptor[];
}
```

MVP registers:

```text
job-discovery@1
giveaway-discovery@1
```

---

## 11. E1 API decisions (resolved)

Resolved in the E1 spike and recorded in [ADR-006 addendum](../adr/adr-006-addendum-e1-api-spike.md):

1. **Typing:** shared `DiscoveryCriteria` envelope + strategy generics; registry uses erased `DiscoveryStrategyModule`.
2. **Ranking:** `ScoringPolicy.rank(score, context)` — strategy-owned, pure.
3. **Queries:** adapter-neutral `DiscoveryQuery` (no vendor/HTTP types).
4. **Normalize:** returns `NormalizedCandidateData` patch; pipeline owns `DiscoveryCandidate` lifecycle.

Implementation: `@arrival-atlas/discovery` (`packages/discovery/`).

---

## Related

- [Domain model](./personal-discovery-engine-domain-model.md)
- [Pipeline contract](./personal-discovery-engine-pipeline.md)
- [Architecture RFC](./personal-discovery-engine-architecture.md)
- [MVP](./personal-discovery-engine-mvp.md)
- [Roadmap E1/E4/E5](./personal-discovery-engine-roadmap.md)
- [ADR-006](../adr/adr-006-personal-discovery-engine-boundaries.md)
- [ADR-006 addendum — E1 API spike](../adr/adr-006-addendum-e1-api-spike.md)
