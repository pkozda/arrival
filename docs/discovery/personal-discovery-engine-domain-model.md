---
id: personal-discovery-engine-domain-model
title: Personal Discovery Engine — Domain Model
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
  - domain-model
  - types
  - invariants
created: 2026-08-30
updated: 2026-08-30
depends_on:
  - personal-discovery-engine-architecture
  - adr-006-personal-discovery-engine-boundaries
related:
  - personal-discovery-engine-pipeline
  - personal-discovery-engine-strategy-contract
  - personal-discovery-engine-mvp
  - personal-discovery-engine-roadmap
  - discovery-domain-index
---

# Personal Discovery Engine — Domain Model

**Status:** Proposed  
**Audience:** Implementers of epic **E1 — Discovery Domain Foundation**  
**Role:** Authoritative definition of entities, value objects, enums, mutability, and invariants  

Parent RFC: [personal-discovery-engine-architecture.md](./personal-discovery-engine-architecture.md)  
Consumers: [pipeline](./personal-discovery-engine-pipeline.md) · [strategy contract](./personal-discovery-engine-strategy-contract.md)

This document answers *what exists in the domain*. It does not define adapter I/O or UI.

---

## 0. Design rules

1. Domain types are **language-neutral** and free of React / HTTP / LLM SDKs.
2. Prefer **immutable value objects** at stage boundaries; mutation of persisted aggregates is explicit and ownership-gated.
3. **Three-valued logic** for uncertain facts: `TRUE` | `FALSE` | `UNKNOWN` — never coerce `UNKNOWN` to “pass”.
4. **Candidate ≠ Result.** Promotion requires strategy-required verification (engine invariant; ADR-006).
5. **Extracted content ≠ Evidence.** Evidence is a retained, attributed claim used to justify verification or scoring.

---

## 1. TriState (three-valued logic)

```ts
type TriState = 'TRUE' | 'FALSE' | 'UNKNOWN';
```

| Value | Meaning | Must not imply |
|-------|---------|----------------|
| `TRUE` | Fact established by deterministic check and/or attributable evidence | — |
| `FALSE` | Fact established as not holding | — |
| `UNKNOWN` | Insufficient information | Pass, verified, or requirement satisfied |

### Invariants

- A **required** criterion evaluated as `UNKNOWN` **fails open to rejection or hold**, never to accept. Preferred default for hard requirements: treat as not satisfied for promotion to Result (strategy may choose `HOLD` vs `REJECT` — see pipeline).
- `Official source: UNKNOWN` must never become `verified`.
- `Purchase required: UNKNOWN` must never become `purchaseRequired = false`.
- `Salary: UNKNOWN` must never count as “salary requirement passed”.

Engine policy (not strategy-specific): evaluation helpers must not silently boolean-coerce `UNKNOWN`.

---

## 2. Entity overview

```text
Registry metadata (versioned, not user-owned)
  DiscoveryStrategyDescriptor
  EnginePolicy (global invariants)

User-owned aggregate
  DiscoveryProfile
        │
Runtime execution
  DiscoveryRun
        │
Working objects (per run)
  DiscoveryCandidate ──► (reject | promote)
        │
Persisted opportunity
  DiscoveryResult
        │
        ├── VerificationResult
        ├── Evidence[]
        ├── Score / ScoreBreakdown
        └── ResultState (user-facing lifecycle)
```

| Kind | Examples |
|------|----------|
| **Registry metadata** | Strategy id/version, policies bundled with a strategy version, engine policies |
| **User aggregate** | DiscoveryProfile |
| **Runtime object** | DiscoveryRun, in-flight Candidate, Digest snapshot |
| **Persisted opportunity** | DiscoveryResult + Evidence + VerificationResult + ResultState |

---

## 3. DiscoveryProfile

Declarative statement of **what the user wants found** — not a search query string.

### Conceptual fields

```ts
interface DiscoveryProfile {
  id: string;                    // immutable after create
  userId: string;                // immutable after create

  name: string;                  // mutable

  strategyId: string;            // immutable after create (change = new profile or explicit migrate)
  strategyVersion: string;       // mutable only via controlled upgrade path

  criteria: DiscoveryCriteria;   // mutable (versioned snapshot on each Run)
  schedule: DiscoverySchedule;   // mutable
  notification: NotificationPreferences; // mutable

  enabled: boolean;              // mutable

  createdAt: string;             // immutable
  updatedAt: string;             // system-maintained
}
```

### Mutability

| Field | Immutable? | Notes |
|-------|------------|--------|
| `id`, `userId` | Yes | Identity |
| `strategyId` | Yes after create | Switching strategy type is a new profile (MVP) |
| `strategyVersion` | Controlled | Bumped when user opts into strategy upgrade; each Run records the version used |
| `name`, `criteria`, `schedule`, `notification`, `enabled` | Mutable | Criteria snapshotted onto Run at start |
| `createdAt` | Yes | |
| `updatedAt` | System | |

### Invariants

- Profile always references a registered `(strategyId, strategyVersion)` that existed at last save.
- Disabling a profile skips scheduling; it does not delete Results.
- Criteria validation is strategy-owned (`validateCriteria`); invalid criteria cannot start a Run.

---

## 4. DiscoveryCriteria

Typed buckets (architecture §7):

```ts
interface DiscoveryCriteria {
  required: Criterion[];
  preferred: Criterion[];
  excluded: Criterion[];
  flexible: Criterion[];
}
```

`Criterion` is strategy-defined structured data (not free-form prompt text as the source of truth). Free-form notes may exist as optional annotations but cannot replace structured required/excluded rules.

---

## 5. DiscoveryStrategy (registry metadata)

A **versioned domain configuration** — not a runtime “god object” that searches the web.

```ts
interface DiscoveryStrategyDescriptor {
  id: string;           // e.g. 'job-discovery'
  version: string;      // e.g. '1'
  displayKey: string;   // i18n key for UI label

  /** Declarative policies — see strategy-contract.md */
  verificationPolicy: VerificationPolicy;
  scoringPolicy: ScoringPolicy;
  freshnessPolicy: FreshnessPolicy;
  deduplicationPolicy: DeduplicationPolicy;
  aiEvaluationPolicy: AiEvaluationPolicy;
}
```

| Question | Answer |
|----------|--------|
| Runtime object? | **No** — registry metadata + pure functions / policy objects |
| Who executes I/O? | **Pipeline + adapters** |
| Who owns domain rules? | **Strategy version** |

Changing strategy rules requires a **new version** (`JobDiscoveryStrategyV2`), not silent mutation of V1 behavior for historical Runs.

Full contract: [personal-discovery-engine-strategy-contract.md](./personal-discovery-engine-strategy-contract.md).

---

## 6. DiscoveryRun (runtime)

One execution of the pipeline for one profile snapshot.

```ts
interface DiscoveryRun {
  id: string;
  profileId: string;
  strategyId: string;
  strategyVersion: string;
  criteriaSnapshot: DiscoveryCriteria;

  startedAt: string;
  finishedAt?: string;

  status: DiscoveryRunStatus;

  stats: {
    candidatesFound: number;
    candidatesRejected: number;
    candidatesVerified: number;
    resultsCreated: number;
    resultsUpdated: number;
  };

  /** Structured failure / partial info for observability */
  diagnostics?: RunDiagnostic[];
}

type DiscoveryRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'CANCELLED';
```

### Invariants

- `criteriaSnapshot` is frozen at run start (profile edits mid-run do not affect this Run).
- `strategyVersion` on the Run is the version actually executed.
- Partial adapter failures may yield `PARTIAL_SUCCESS` without discarding successful Results from the same Run.

---

## 7. DiscoveryCandidate

Something the system **found** but does **not** trust as a recommendation.

```ts
interface DiscoveryCandidate {
  id: string;                    // run-local or durable pre-result id
  runId: string;

  identity: CandidateIdentity;

  source: SourceRef;
  discoveredAt: string;

  raw: RawContentRef;            // pointer / hash to stored raw payload
  extracted: ExtractedFacts;     // structured guesses — NOT evidence

  /** Pipeline bookkeeping */
  stage: CandidateStage;
  rejection?: RejectionRecord;   // set if rejected; never silently dropped
}

type CandidateStage =
  | 'DISCOVERED'
  | 'NORMALIZED'
  | 'DEDUPLICATED'
  | 'FILTERED'
  | 'VERIFYING'
  | 'AI_EVALUATING'
  | 'SCORED'
  | 'REJECTED'
  | 'PROMOTED';
```

### Identity

```ts
interface CandidateIdentity {
  /** Prefer stable external ids when available */
  externalIds: Record<string, string>;  // e.g. { jobId, companySlug }
  canonicalUrl?: string;
  /** Strategy-defined semantic fingerprint input */
  fingerprintMaterial: Record<string, string | number | boolean | null>;
}
```

Deduplication uses strategy `deduplicationPolicy` over `CandidateIdentity` (architecture §17). Multiple source URLs may map to one canonical identity.

### When can a Candidate become a Result?

All of the following:

1. Not rejected by deterministic filters (hard requirements / exclusions).
2. Strategy-required verification checks are `TRUE` (not `UNKNOWN` where required).
3. Engine invariant: required verification satisfied (ADR-006).
4. Scoring completed; confidence meets strategy minimum **or** strategy explicitly allows provisional hold (MVP: no provisional Results in digests).
5. Pipeline emits a promotion record → persistence creates/updates `DiscoveryResult`.

If any required check is `FALSE` or required-`UNKNOWN` → **reject or hold**, never promote.

---

## 8. ExtractedFacts vs Evidence

### ExtractedFacts

Structured fields parsed or inferred during collection/normalization/AI extraction.

- May be incomplete (`UNKNOWN` fields).
- May be wrong.
- **Must not** alone justify user-facing trust claims.

### Evidence

Attributed, retained justification for a verification or score input.

```ts
interface Evidence {
  id: string;
  type: EvidenceType;
  sourceUrl: string;
  statement: string;       // human-readable claim
  capturedAt: string;
  /** Optional content hash / excerpt ref — never “AI said so” without source */
  contentRef?: string;
}

type EvidenceType =
  | 'OFFICIAL_SOURCE'
  | 'CURRENT_PAGE'
  | 'TERMS'
  | 'LOCATION'
  | 'SALARY'
  | 'DEADLINE'
  | 'EMPLOYMENT_TYPE'
  | 'PARTICIPATION_REQUIREMENT'
  | 'OTHER';
```

### Invariants

- AI may **propose** evidence candidates from fetched pages; persistence of Evidence requires a real `sourceUrl` / content ref from adapters.
- AI must not create Evidence with fabricated URLs (ADR-006).
- Digests that claim “active on employer site” must cite Evidence of type `OFFICIAL_SOURCE` or `CURRENT_PAGE` as required by strategy.

---

## 9. VerificationResult

```ts
interface VerificationResult {
  status: VerificationStatus;
  sourceTrust: SourceTrust;
  freshness: FreshnessStatus;
  checks: VerificationCheck[];
  verifiedAt: string;
  evidenceIds: string[];
}

type VerificationStatus = 'PASS' | 'FAIL' | 'UNKNOWN';

type SourceTrust =
  | 'OFFICIAL'
  | 'ESTABLISHED_THIRD_PARTY'
  | 'AGGREGATOR'
  | 'COMMUNITY'
  | 'UNKNOWN';

type FreshnessStatus =
  | 'CURRENT'
  | 'STALE'
  | 'EXPIRED'
  | 'UNKNOWN';

interface VerificationCheck {
  id: string;                 // e.g. 'official_page_exists'
  outcome: TriState;          // TRUE | FALSE | UNKNOWN
  required: boolean;
  detail?: string;
  evidenceIds?: string[];
}
```

### PASS / FAIL / UNKNOWN

| Status | Rule |
|--------|------|
| **PASS** | Every `required` check has `outcome === TRUE` |
| **FAIL** | Any `required` check has `outcome === FALSE` |
| **UNKNOWN** | No required `FALSE`, but at least one required check is `UNKNOWN` |

### Invariants

- `PASS` is the only status that may promote to Result when strategy requires verification.
- `UNKNOWN` verification status ≠ PASS.
- Aggregator-only discovery with required official check still `UNKNOWN` or `FAIL` until official check is `TRUE`.

---

## 10. Score

Scores justify ranking and explainability. MVP needs **at least** two headline numbers plus a breakdown.

```ts
interface Score {
  /** 0–100: fit to user criteria / profile intent */
  matchScore: number;
  /** 0–100: trustworthiness of our conclusion */
  confidenceScore: number;
  breakdown: ScoreBreakdown;
  scoredAt: string;
  strategyVersion: string;
}

interface ScoreBreakdown {
  dimensions: ScoreDimension[];
}

interface ScoreDimension {
  id: string;           // e.g. 'role', 'location', 'freshness', 'deadline_urgency'
  labelKey: string;     // i18n
  value: number;        // 0–100 or strategy-defined scale
  weight: number;       // strategy-defined
  triStateInputs?: Record<string, TriState>;
}
```

### Why both match and confidence?

```text
Match 98 · Confidence 61  → strong fit, weak trust → not top notify
Match 87 · Confidence 100 · deadline tomorrow → may outrank higher match
```

### Ranking formula

**Not fixed in the domain model.** Engine provides scoring **primitives** (dimensions, TriState inputs, clamps). Strategy `scoringPolicy` defines how dimensions combine into `matchScore`, `confidenceScore`, and final rank order.

Architecture wording (corrected): final ranking combines strategy-defined relevance, confidence, freshness, novelty, and opportunity value — **not** a mandated `Match × Confidence × …` product.

### Invariants

- Hard requirement failures never appear as low match scores; they are **rejections**.
- `confidenceScore` must not increase without new Evidence / deterministic checks.

---

## 11. DiscoveryResult

Promoted, persisted opportunity presented to the user (subject to ResultState).

```ts
interface DiscoveryResult {
  id: string;
  profileId: string;
  strategyId: string;
  strategyVersion: string;

  identity: CandidateIdentity;     // stable across runs
  canonicalPresentation: ResultPresentation;

  verification: VerificationResult;
  evidence: Evidence[];
  score: Score;

  lifecycle: ResultLifecycleStatus;  // opportunity freshness lifecycle
  userState: ResultState;            // user-facing attention state

  firstSeenAt: string;
  lastVerifiedAt: string;
  lastChangedAt: string;
}

type ResultLifecycleStatus =
  | 'ACTIVE'
  | 'UPDATED'
  | 'EXPIRED'
  | 'REMOVED';
```

### Invariants

- Creating a Result requires a prior Candidate promotion in some Run (audit link recommended: `promotedFromCandidateId` / `runId`).
- Updating fields (e.g. salary discovered) sets lifecycle toward `UPDATED` and refreshes `lastChangedAt`.
- User dismissals do not delete Evidence history.

---

## 12. ResultState (user-facing)

```ts
type ResultState =
  | 'NEW'
  | 'SEEN'
  | 'NOTIFIED'
  | 'OPENED'
  | 'SAVED'
  | 'DISMISSED'
  | 'EXPIRED';
```

MVP **does** distinguish these states — they are required for novelty and notification policy.

### Who may transition

| From → To | Actor |
|-----------|--------|
| → `NEW` | Engine on create / meaningful update reset policy |
| `NEW` → `NOTIFIED` | Notification adapter after successful digest send |
| `NEW`/`NOTIFIED` → `SEEN` | UI when result appears in in-app list (optional if NOTIFIED implies seen) |
| `*` → `OPENED` | UI on user open |
| `*` → `SAVED` / `DISMISSED` | User explicit action |
| `*` → `EXPIRED` | Engine freshness job / verification recheck |
| `DISMISSED` → `NEW` | **Forbidden** unless strategy defines “resurrect on major change” (post-MVP; default no) |

### Invariants

- Scheduler / digest builder notify primarily on `NEW` (and configured `UPDATED` lifecycle), not on `DISMISSED` / `EXPIRED`.
- Engine may set `EXPIRED`; users may not set `EXPIRED` manually (they use `DISMISSED`).
- AI adapters never change `ResultState`.

---

## 13. RejectionRecord

Rejected candidates are **retained for the Run** (and optionally durable diagnostics).

```ts
interface RejectionRecord {
  reasonCode: RejectionReasonCode;
  message?: string;
  atStage: CandidateStage;
  at: string;
  details?: Record<string, string | number | boolean | null>;
}
```

Canonical reason codes (extensible per strategy with prefixed codes):

```ts
type RejectionReasonCode =
  | 'REJECTED_LOCATION'
  | 'REJECTED_SALARY'
  | 'REJECTED_EXCLUDED_ROLE'
  | 'REJECTED_PURCHASE_REQUIRED'
  | 'REJECTED_EXPIRED'
  | 'REJECTED_NO_OFFICIAL_SOURCE'
  | 'REJECTED_LOW_CONFIDENCE'
  | 'REJECTED_DETERMINISTIC_FILTER'
  | 'REJECTED_VERIFICATION_FAIL'
  | 'REJECTED_VERIFICATION_UNKNOWN'
  | 'REJECTED_DUPLICATE'
  | 'REJECTED_SECURITY_POLICY'
  | 'REJECTED_OTHER';
```

Full stage placement: [pipeline](./personal-discovery-engine-pipeline.md).

---

## 14. Digest

Presentation-independent domain output (architecture §25). References Result ids + summary counts; does not embed raw HTML from sources.

Implemented as `DiscoveryDigest` with `DigestEntry[]` (resultId, rank, rankValue, novelty, userState, lifecycle, shouldNotify) and run-scoped `DigestSummary`. Built by `buildDiscoveryDigest` / Digest pipeline stage after Persist + Promote. Empty digests are valid. Notification channels consume Digests later — Digest is not a renderer.

---

## 15. EnginePolicy vs Strategy policy

| Layer | Examples |
|-------|----------|
| **EnginePolicy** (global) | Found ≠ verified; AI cannot fabricate evidence; external content untrusted; TriState rules; candidate cannot become result without required verification; cost/safety gates |
| **Strategy policy** | Official source required (jobs); purchase required → reject (giveaways); scoring weights; freshness cadence; dedupe fingerprint fields |

ADR-006 owns EnginePolicy. Strategy contract owns strategy policies.

---

## 16. Package sketch (E1)

```text
packages/discovery/
  types/
    tri-state.ts
    profile.ts
    strategy.ts
    candidate.ts
    result.ts
    verification.ts
    evidence.ts
    score.ts
    state.ts
    rejection.ts
    run.ts
    digest.ts
  invariants/
    promotion.ts
    tri-state.ts
  index.ts
```

No adapters in E1.

---

## 17. Open points (explicitly deferred)

- Exact DB schema / Postgres tables
- Whether rejected candidates are durable beyond Run TTL
- Provisional Results with `UNKNOWN` verification (forbidden in MVP digests)
- Cross-profile global opportunity graph

---

## Related

- [Architecture RFC](./personal-discovery-engine-architecture.md)
- [Pipeline contract](./personal-discovery-engine-pipeline.md)
- [Strategy contract](./personal-discovery-engine-strategy-contract.md)
- [MVP](./personal-discovery-engine-mvp.md)
- [ADR-006](../adr/adr-006-personal-discovery-engine-boundaries.md)
