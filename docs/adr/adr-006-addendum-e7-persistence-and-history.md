---
id: adr-006-addendum-e7-persistence-and-history
title: ADR-006 Addendum — PDE E7 Persistence & History
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-09-01
updated: 2026-09-01
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e4-1-durable-result-persistence
  - adr-006-addendum-e4-4-notifications
  - adr-006-addendum-e5-2-durable-execution-queue
  - adr-006-addendum-e6-ai-cost-and-deduplication
  - discovery-domain-index
  - personal-discovery-engine-roadmap
---

# ADR-006 Addendum — PDE E7 Persistence & History

**Status:** Accepted (canonical roadmap E7 functional closure)  
**Date:** 2026-09-01  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Context

Canonical roadmap **E7 — Persistence & History** requires durable profiles and results, history-scoped novelty (`NEW` / `UNCHANGED` / `UPDATED`), field-level change detection, user-facing result state, and rerun behavior that does not re-notify unchanged opportunities.

Much of this was introduced incrementally across **E2** (novelty/digest), **E4.1** (SQLite `DiscoveryResult`), and **E4.4** (notification idempotency). E7 closes the remaining functional gaps:

- durable `DiscoveryProfile` persistence
- explicit result user-state transition machinery
- notification → `NOTIFIED` write-back
- structured `changedFields`
- Job salary as a material extracted field
- runtime/SQLite proofs for unchanged rerun and salary update

**Implementation epics E6.1–E6.3** (`DiscoveryService`, HTTP admin API, Bearer auth) are **not** canonical roadmap E6 or E7. They were not modified for E7 closure.

---

## Decision

Accept **canonical E7 functional closure** with the capabilities below. Defer dedicated `CandidateStore`, `DigestStore`, full pipeline `DiscoveryRun` archival, and durable raw-content archival as non-blocking for the current history-correctness loop.

### Implemented capabilities

| Area | Decision |
|------|----------|
| **Profile persistence** | SQLite `ProfileStore` via `createSqliteProfilePersistence` (`discovery_profiles` table, JSON envelope v1). Runtime owns the adapter when `profileStore` is not injected (`persistence.profilesDatabasePath`). |
| **Result persistence** | Existing E4.1 SQLite `ResultStore` / `ResultWriter` (`discovery_results`). |
| **Embedded verification/evidence** | Promoted `DiscoveryResult` records carry `verification`, `evidence`, and `score` in the persisted payload (E4.1 envelope). |
| **History-scoped novelty** | `decideNovelty` compares the current candidate against a **persisted** `DiscoveryResult` — not merely “seen this run”. |
| **UNCHANGED / SKIP_UNCHANGED** | Identical material fields → `novelty: UNCHANGED` → `buildPersistPlan` action `SKIP_UNCHANGED` (no timestamp churn). |
| **Material change detection** | Strategy-owned `NoveltyPolicy` (`materialFingerprintFields`, `materialExtractedFields`, presentation, verification status, score deltas). |
| **`changedFields`** | Structured `string[]` on `NoveltyDecision`; deterministic sorted keys (`fingerprint.*`, `extracted.*`, `presentation.*`, …). `reason` retains `MATERIAL_UPDATE:…` for compatibility. |
| **Job salary** | `JobDiscoveryStrategyV1.noveltyPolicy.materialExtractedFields: ['salary']`. Salary is **not** in `identityFingerprintFields` — salary change updates the existing result (`UPDATED`), never a new identity. Snapshot stored on `DiscoveryResult.materialFields`. |
| **User-state transitions** | `validateResultStateTransition` + `ResultStateWriter` (`createResultStateWriter`). Storage-neutral; composes `ResultStore.getById` + `ResultWriter.update`. |
| **Notification → NOTIFIED** | On successful adapter delivery only, `transitionResultsToNotified` sets `userState: NOTIFIED`. Failed/skipped/duplicate notification does not mutate result state. |
| **Restart durability** | Profile, Result, notification records, and `NOTIFIED` user state survive SQLite reopen and runtime restart. |

### Architectural distinctions

```text
Operational (E4/E5)                    Historical (E7)
─────────────────────                  ─────────────────
Scheduler schedule/run metadata   ≠    Pipeline DiscoveryRun (ephemeral per execute)
Queue execution jobs              ≠    Promoted DiscoveryResult (durable)
NotificationRecord.status=SENT    ≠    DiscoveryResult.userState=NOTIFIED
ResultLifecycleStatus (ACTIVE…)   ≠    ResultState (NEW/SEEN/NOTIFIED/…)
```

- **Novelty is history-based** because `ResultStore.findByIdentity` loads the prior promoted result; `UNCHANGED` means “no material delta vs persisted snapshot”, not notification idempotency alone.
- **Digest gating** consumes `NoveltyDecision.shouldNotify`; empty digest → notification service `skipped: empty_digest` (distinct from `already_delivered`).
- **`DiscoveryProfile.enabled`** is persisted on the profile record. Scheduler `enabled` on schedule records remains the operational scheduling boundary.

### Explicitly deferred (non-blocking)

| Item | Rationale |
|------|-----------|
| **`CandidateStore`** | Rejected candidates remain run-scoped. History correctness for promoted opportunities is provided by durable `DiscoveryResult` + novelty. |
| **`DigestStore`** | Digest remains a per-run artifact. Notification idempotency (`NotificationRecord`) is durable; digest history is not required for rerun suppression. |
| **Full pipeline `DiscoveryRun` archival** | Scheduler `ScheduledRunRecord` and queue jobs provide **operational** run metadata. The pipeline `DiscoveryRun` object built during `executeDiscoveryPipeline` is not separately archived. |
| **Durable raw-content archival** | `RawContentStore` remains in-memory by default (E3.3). Fetch bodies are not persisted as part of E7. |

The MVP history loop is already satisfied by: durable profiles + results, stable result identity, novelty against persisted snapshots, digest eligibility, notification persistence, and result-state transitions.

---

## Exit criteria evidence (tests)

| Criterion | Test file |
|-----------|-----------|
| Unchanged second run → no second notification (history, not idempotency alone) | `packages/discovery/src/runtime/e7-history.test.ts` (`E7.7 unchanged second run`) |
| Salary €60k → €65k → `UPDATED` + second notification | `packages/discovery/src/runtime/e7-history.test.ts` (`E7.8 salary update`) |
| Third run unchanged salary → no third notification | `packages/discovery/src/runtime/e7-history.test.ts` (run 3 control in salary test) |
| `changedFields` semantics | `packages/discovery/src/pipeline/novelty.test.ts` (`E7.5 changedFields`, `E7.6 salary material change`) |
| Salary material but not identity | `packages/discovery/src/pipeline/novelty.test.ts` (`E7.6`) |
| Result state transition rules | `packages/discovery/src/pipeline/result-state-transition.test.ts` |
| `ResultStateWriter` persistence | `packages/discovery/src/pipeline/result-state-writer.test.ts` |
| Notification → `NOTIFIED` write-back | `packages/discovery/src/notifications/notifications.test.ts` (`E7.4 notification → NOTIFIED write-back`) |
| `NOTIFIED` survives SQLite restart | `packages/discovery/src/runtime/runtime-result-state-restart.test.ts` |
| ProfileStore persistence / reopen | `packages/discovery/src/adapters/persistence/sqlite-profile-persistence.test.ts` |
| ProfileStore runtime wiring / restart | `packages/discovery/src/runtime/runtime-profile-persistence.test.ts` |
| Result persistence / reopen | `packages/discovery/src/adapters/persistence/sqlite-result-persistence.test.ts` |
| Pipeline UNCHANGED digest exclusion (unit) | `packages/discovery/src/pipeline/digest.test.ts` (`UNCHANGED second run excludes from Digest entries`) |
| Runtime restart (results + notifications) | `packages/discovery/src/runtime/runtime-restart.test.ts` |

Baseline at closure: **513 tests green**, `tsc` green.

---

## Consequences

- **E8 (Scheduler)** may proceed; operational scheduling infrastructure (E4.2/E5) already exists. Canonical E8 exit criteria in the roadmap remain separate from E7 closure.
- **E9 (UI)** can build on `ResultStateWriter` user/ui transitions deferred to UI work; engine/notification paths are implemented.
- Future **PostgreSQL** adapters can mirror the same JSON record envelopes for profiles and results.
- Roadmap bullets listing storage for every entity type (Candidate, Digest, full Run) remain **aspirational** until explicitly scheduled; they are not required for E7 functional closure.

## Related

- [E4.1 durable Result persistence](./adr-006-addendum-e4-1-durable-result-persistence.md)
- [E4.4 notifications](./adr-006-addendum-e4-4-notifications.md)
- [Roadmap E6 AI cost & dedupe](./adr-006-addendum-e6-ai-cost-and-deduplication.md)
- [Discovery README](../discovery/README.md)
