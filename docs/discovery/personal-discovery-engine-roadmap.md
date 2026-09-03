---
id: personal-discovery-engine-roadmap
title: Personal Discovery Engine — Implementation Roadmap
project: Arrival Atlas
system: Arrival Atlas
type: roadmap
domain: discovery
status: active
maturity: evolving
owner: product
tags:
  - discovery
  - pde
  - epic
  - roadmap
created: 2026-08-30
updated: 2026-09-02
depends_on:
  - personal-discovery-engine-architecture
  - adr-006-personal-discovery-engine-boundaries
related:
  - personal-discovery-engine-mvp
  - discovery-domain-index
---

# Personal Discovery Engine — Implementation Roadmap

**Capability:** Personal Discovery Engine (PDE)  
**Canonical architecture:** [personal-discovery-engine-architecture.md](./personal-discovery-engine-architecture.md)  
**Domain model (E1 prerequisite):** [personal-discovery-engine-domain-model.md](./personal-discovery-engine-domain-model.md)  
**Pipeline contract:** [personal-discovery-engine-pipeline.md](./personal-discovery-engine-pipeline.md)  
**Strategy contract:** [personal-discovery-engine-strategy-contract.md](./personal-discovery-engine-strategy-contract.md)  
**MVP slice:** [personal-discovery-engine-mvp.md](./personal-discovery-engine-mvp.md)  
**Status:** Active — E1–E10 functionally closed; **E11** remains

Effort scale: **S** ≤1 sprint · **M** 1–2 sprints · **L** 2–4 sprints  
Risk: Low / Medium / High

---

## Dependency graph

```text
E1 Domain Foundation
        │
        ▼
E2 Discovery Pipeline ──────────────┐
        │                           │
        ▼                           │
E3 Verification Infrastructure      │
        │                           │
        ├──────────┬────────────────┤
        ▼          ▼                │
E4 Job Strategy   E5 Giveaway       │
        │          │                │
        └────┬─────┘                │
             ▼                      │
        E6 AI Evaluation ◄──────────┘
             │
             ▼
        E7 Persistence & History
             │
             ▼
        E8 Scheduler
             │
        ┌────┴────┐
        ▼         ▼
   E9 Discovery UI   E10 Digest / Email
        │         │
        └────┬────┘
             ▼
      E11 Production Hardening
```

MVP ships a vertical slice through **E1–E10** for Jobs + Giveaways (see MVP doc). E11 can start in parallel once E4/E5 are in use.

---

## E1 — Discovery Domain Foundation

**Objective:** Pure domain package with language-neutral types and invariants.  
**Effort:** M · **Risk:** Low  
**Spec:** [personal-discovery-engine-domain-model.md](./personal-discovery-engine-domain-model.md)

**Contains:**

- `packages/discovery/` scaffold
- types for Profile, Strategy, Candidate, Result, Verification, Evidence, Score/ScoreBreakdown, TriState, State, Digest, Run, RejectionRecord
- strategy registry interface (versioned) — aligned with [strategy contract](./personal-discovery-engine-strategy-contract.md)
- unit tests for type guards / promotion / TriState invariants

**Does not contain:** network I/O, LLM calls, UI, scheduler.

**Exit criteria:** Package builds; domain types exported; promotion and TriState invariants covered by unit tests.

---

## E2 — Discovery Pipeline

**Objective:** Orchestrate candidate collection → normalize → dedupe → filter.  
**Effort:** L · **Risk:** Medium  
**Depends on:** E1  
**Spec:** [personal-discovery-engine-pipeline.md](./personal-discovery-engine-pipeline.md)

**Contains:**

- immutable stage orchestration (`input → stage → output`)
- normalization adapters (ports)
- deduplication (canonical identity)
- deterministic filters from strategy config
- rejection retention with reason codes
- run status: SUCCESS / PARTIAL_SUCCESS / FAILED

**Exit criteria:** Fake in-memory sources produce candidates → filtered set with reasons; partial provider failure does not always abort; no silent drops.

---

## E3 — Verification Infrastructure

**Objective:** Separate verification from discovery; capture evidence.  
**Effort:** L · **Risk:** Medium  
**Depends on:** E2  

**Contains:**

- `SourceVerifier` port
- freshness checks
- official-source verification path
- Evidence capture + persistence hooks
- VerificationResult model

**Exit criteria:** Aggregator-only candidate can be discovered but rejected when strategy requires official confirmation.

---

## E4 — Job Discovery Strategy

**Objective:** Formalize the current job-search algorithm as `JobDiscoveryStrategyV1`.  
**Effort:** L · **Risk:** Medium  
**Depends on:** E3  
**Spec:** [personal-discovery-engine-strategy-contract.md](./personal-discovery-engine-strategy-contract.md) §5

**Contains:**

- strategy config (required / preferred / excluded / flexible)
- scoring dimensions for jobs
- company career verification rules
- fixtures / golden cases for common German job markets

**Exit criteria:** Documented strategy version; end-to-end dry run Job profile → verified results with evidence.

---

## E5 — Giveaway Discovery Strategy

**Objective:** Formalize free giveaway discovery as `GiveawayDiscoveryStrategyV1`.  
**Effort:** L · **Risk:** Medium  
**Depends on:** E3  
**Spec:** [personal-discovery-engine-strategy-contract.md](./personal-discovery-engine-strategy-contract.md) §6

**Contains:**

- free-participation hard requirements
- purchase-required rejection
- organizer / deadline / terms verification
- fixtures for reject / accept cases

**Exit criteria:** Purchase-required and expired campaigns rejected; free active campaigns can reach DiscoveryResult.

---

## E6 — AI Evaluation Layer

**Objective:** LLM-assisted interpretation behind a port — never sole source of truth.  
**Effort:** M · **Risk:** High (cost, injection, drift)  
**Depends on:** E2–E5 (usable once verification exists)  

**Contains:**

- `AIProvider` port
- semantic matching / classification / structured extraction
- prompt-injection hardening
- cost-aware call gating (only post-verification candidates)

**Exit criteria:** AI can reject “formally free but purchase required”; hostile page text cannot override engine authority; unit tests with mocked provider.

---

## E7 — Persistence & History

**Objective:** Durable profiles, runs, results, and user-facing state.  
**Effort:** M · **Risk:** Medium  
**Depends on:** E1–E3  
**Status:** **Functional closure complete** (see [ADR-006 addendum — E7](../adr/adr-006-addendum-e7-persistence-and-history.md))

**Contains:**

- storage for Profile / Run / Candidate / Result / Verification / Evidence / Digest
- result states: NEW · SEEN · NOTIFIED · OPENED · SAVED · DISMISSED · EXPIRED
- change detection (field-level updates)

**Implemented (functional closure):** durable Profile + Result persistence; history-scoped novelty; `changedFields`; Job salary material updates; result state transitions; notification → `NOTIFIED`; restart-safe proofs.

**Deferred by design:** `CandidateStore`, `DigestStore`, full pipeline `DiscoveryRun` archival, durable raw-content store. Operational scheduler/queue run metadata remains separate from pipeline `DiscoveryRun`.

**Exit criteria:** Rerun does not re-notify unchanged results; salary newly discovered surfaces as UPDATED. **Met** — see `packages/discovery/src/runtime/e7-history.test.ts` and `packages/discovery/src/pipeline/novelty.test.ts`.

---

## E8 — Scheduler

**Objective:** Time-based DiscoveryRuns without domain-specific knowledge.  
**Effort:** M · **Risk:** Medium  
**Depends on:** E7, E2  
**Status:** **Functional closure complete** (see [ADR-006 addendum — E8](../adr/adr-006-addendum-e8-scheduler.md))

**Contains:**

- schedule model on DiscoveryProfile
- daily runner for enabled profiles
- idempotent run keys / overlap guards

**Implemented (functional closure):** operational `DiscoveryScheduleRecord` scheduler (E4.2/E5); profile `enabled` gate (`profile_disabled`); overlap/coalescing; durable queue/locks/retry. Pull-driven — hosts call `triggerDueRuns()`.

**Architectural note:** `DiscoveryProfile.schedule` is declarative product intent. It does **not** directly drive the operational scheduler. Hosts/service may project profile intent into `DiscoveryScheduleRecord`.

**Deferred by design:** cron daemon, timezone-aware daily slots beyond UTC projection, Redis/distributed scheduler redesign. Automatic profile-schedule projection → **E10.2**.

**Exit criteria:** Enabled profile runs on schedule; disabled profile skipped; overlapping run rejected or coalesced. **Met** — see `packages/discovery/src/scheduler/scheduler.test.ts` (`E8 profile enabled gate`) and existing E4.2/E5 scheduler tests.

---

## E9 — Discovery UI

**Objective:** Strategy-driven profile creation, criteria edit, enable/disable, results + evidence.  
**Effort:** L · **Risk:** Medium  
**Depends on:** E4 or E5, E7, E8  
**Status:** **Functional closure complete** (see [ADR-006 addendum — E9](../adr/adr-006-addendum-e9-discovery-ui.md))

**Contains:**

- “What are you looking for?” entry (Jobs / Giveaways templates)
- profile create + criteria edit (name, country, role)
- enable/disable profile
- results list with Match / Confidence / Why / Evidence / changed fields
- last-scan summary (including zero-new)
- **Run now** (manual trigger, pull-driven execution)

**Does not contain:** automatic applications or giveaway entries.

**Implemented (functional closure):**

| Slice | Delivered |
|-------|-----------|
| **E9.1** | User-facing Discovery API in `packages/discovery/src/user-api/` — profiles, results, user-state, run-summary, run-now; Bearer auth for framework-free hosts |
| **E9.2** | API gateway (`/api/modules/discovery/*`, session auth) + web module (`/modules/discovery`, Atlas HUD nav, i18n) |
| **E9.3** | Run now UI + API; profile criteria PATCH/edit; persisted `changedFields` API projection; `discovery.score.*` i18n; canonical organic Playwright journey |

**Architectural notes:**

- User API is **distinct** from E6.2/E6.3 admin API (different routes and auth).
- CSR `Profile` remains **separate** from `DiscoveryProfile`.
- Run now reuses `DiscoveryService.runNow` + `processNext()` — no cron daemon or scheduler redesign.
- `changedFields` are computed in E7 and projected through the user API; web does not recompute novelty.

**Deferred by design:** automatic `DiscoveryProfile.schedule` projection (→ **E10.2**); rich/advanced criteria editor; CandidateStore/DigestStore/full DiscoveryRun archival; module catalog/home-card work; cron/Redis.

**Exit criteria:** User can create profile, edit criteria, trigger a run, inspect evidence and changed fields, update user state, and reload with persisted state — within Atlas chrome / i18n conventions. **Met** — see verification table in [E9 ADR](../adr/adr-006-addendum-e9-discovery-ui.md).

---

## E10 — Notification & Automated Delivery

**Objective:** First automated delivery channel; attention-optimized.  
**Effort:** M · **Risk:** Medium  
**Depends on:** E7, E8, digest domain (E1)  
**Status:** **Functional closure complete** (see [ADR-006 addendum — E10](../adr/adr-006-addendum-e10-notifications.md))

**Contains:**

- digest builder from NEW / UPDATED results
- email template (attention-first copy)
- zero-result policy (skip empty emails by default)
- notification preference hooks (`emailEnabled`, `skipEmptyDigest`)
- Atlas host-triggered daily execution path

**Implemented (functional closure):**

| Slice | Delivered |
|-------|-----------|
| **E10.1** | Atlas notification wiring — composition-root recipient resolution, worker → `NotificationService` → email adapter, NOTIFIED write-back, idempotent delivery |
| **E10.2** | Profile schedule projection — `DiscoveryProfile.schedule` → operational `DiscoveryScheduleRecord`; daily cadence projected; manual/weekly non-automatic |
| **E10.3** | Atlas host tick — `executeDiscoveryHostTick()`, `POST /api/ops/discovery/trigger-due-runs`; reuses E8 `triggerDueRuns()` + queue/worker; no in-process cron |
| **E10.4** | Notification preferences — partial profile API patch + Discovery UI toggles; `skipEmptyDigest` wired to plan-builder; E7 UNCHANGED suppression preserved |

**Architectural notes:**

- Single delivery path: Profile → schedule → host tick → pipeline → digest → `NotificationService` → email → SENT → NOTIFIED.
- No second scheduler, DigestStore, or notification redesign.
- Recipient resolution at Atlas composition root (env/test override today; account email deferred).
- UI still shows last-scan / zero-new summary when email is skipped (E9 run summary surfaces).

**Deferred by design:** account-linked recipient email; unsubscribe / List-Unsubscribe headers; localized email templates; self-serve daily/weekly schedule UI; weekly operational recurrence.

**Outside E10:** production platform cron configuration; Resend/sender deployment.

**Exit criteria:** Non-empty digest email only when warrants attention; UI still shows last scan stats when email skipped; user can persist notification preferences. **Met** — see verification table in [E10 ADR](../adr/adr-006-addendum-e10-notifications.md).
---

## E11 — Production Hardening

**Objective:** Operate safely at cost and abuse boundaries.  
**Effort:** L · **Risk:** High  
**Depends on:** E6–E10 in use  

**Contains:**

- observability dashboards / structured run logs
- retries · rate limiting · cost budgets
- security review of fetch + AI paths
- partial-failure playbooks
- strategy version migration notes

**Exit criteria:** Run cost/latency/rejection reasons queryable; injection regression tests green; rate limits documented.

### E11.1 — Atlas ops health (complete)

- `GET /api/ops/discovery/health` — `ops-token-required` (`ARRIVAL_ATLAS_OPS_TOKEN`); exposes E5.6 `DiscoveryRuntimeHealth` via execution runtime (no SQLite reads in route). Host-global; ordinary accounts rejected.

### H3 — Ops security & delivery boundary (complete)

- Host-global ops (`trigger-due-runs`, `health`) require `ARRIVAL_ATLAS_OPS_TOKEN` (Bearer or `x-arrival-ops-token`); fail-closed when unset.
- `DISCOVERY_NOTIFICATION_EMAIL` remains single-tenant / personal Atlas fallback only; disabled when `ARRIVAL_ATLAS_MULTI_USER=true`. Never exposed to clients.
- Run diagnostics remain `account-required` + ownership-scoped.

### E11.2 — Run diagnostics (complete — with deferred metrics)

- `GET /api/ops/discovery/runs/:runId/diagnostics` — `account-required`; run ownership via profile → `userId`; foreign runs return **404**.
- Reuses `DiscoveryService.getRunDiagnostics()` → durable `ScheduledRunRecord`, result promotion counts (`promotedFromRunId`), notification status (`findByRunId`).
- **Exposed:** run identity, status, trigger, timestamps, skip/error, result novelty counts (new/updated from persisted results), notification status/channel/failure code, configured AI evaluation budget (`maxEvaluations`).
- **Not exposed:** emails, tokens, API keys, raw discovery content, filesystem/DB paths, stack traces, notification payload/recipient.
- **Deferred (not durably persisted today):** per-run pipeline stage counts (collected/validated/rejected), rejection-reason histograms, per-run AI evaluation usage, unchanged-result counts, notification SKIPPED when no notification record was written.

---

## Suggested delivery order for MVP

| Wave | Epics | Outcome |
|------|-------|---------|
| 1 | E1 → E2 → E3 | Domain + pipeline + verification |
| 2 | E4 + E5 (parallel) | Two strategies |
| 3 | E6 + E7 | AI + history |
| 4 | E8 → E9 → E10 | Automation + UI + email |
| 5 | E11 | Harden |

---

## Out of roadmap (explicitly deferred)

- Mobile push
- Learning-to-rank / collaborative filtering
- Social sharing
- Dozens of discovery categories at once
- Autonomous applications or giveaway participation
- Merging PDE digests into Journey Guide / Certainty UI (future product epic)

---

## Related

- [Architecture RFC](./personal-discovery-engine-architecture.md)
- [Domain model](./personal-discovery-engine-domain-model.md)
- [Pipeline](./personal-discovery-engine-pipeline.md)
- [Strategy contract](./personal-discovery-engine-strategy-contract.md)
- [MVP](./personal-discovery-engine-mvp.md)
- [ADR-006](../adr/adr-006-personal-discovery-engine-boundaries.md)
