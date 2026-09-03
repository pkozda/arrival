---
id: discovery-domain-index
title: Personal Discovery Engine — Domain Index
project: Arrival Atlas
system: Arrival Atlas
type: system
domain: discovery
status: active
maturity: proposed
owner: product
tags:
  - domain-index
  - discovery
  - pde
  - personal-discovery-engine
created: 2026-08-30
updated: 2026-09-02
related:
  - personal-discovery-engine-architecture
  - personal-discovery-engine-domain-model
  - personal-discovery-engine-pipeline
  - personal-discovery-engine-strategy-contract
  - personal-discovery-engine-roadmap
  - personal-discovery-engine-mvp
  - adr-006-personal-discovery-engine-boundaries
---

# Personal Discovery Engine (PDE)

Domain documentation for the **Personal Discovery Engine** — Arrival Atlas’s always-on capability for finding, verifying, ranking, and notifying users about external opportunities that match their criteria.

PDE complements existing engines:

| Capability | Question it answers |
|------------|---------------------|
| **CSR** (Current Situation Resolver) | What is happening for this user right now? |
| **MBDE** (Maximum Benefits Discovery Engine) | What support / entitlements may apply? |
| **PDE** (Personal Discovery Engine) | What external opportunities exist and deserve attention? |

## Document map

| Document | Role |
|----------|------|
| [personal-discovery-engine-architecture.md](./personal-discovery-engine-architecture.md) | Architecture & product design RFC (overview) |
| [personal-discovery-engine-domain-model.md](./personal-discovery-engine-domain-model.md) | **E1 prerequisite** — entities, TriState, mutability, invariants |
| [personal-discovery-engine-pipeline.md](./personal-discovery-engine-pipeline.md) | Immutable stages, rejection reasons, AI gate |
| [personal-discovery-engine-strategy-contract.md](./personal-discovery-engine-strategy-contract.md) | Declarative strategy vs pipeline; engine vs strategy policy |
| [personal-discovery-engine-roadmap.md](./personal-discovery-engine-roadmap.md) | Implementation epics E1–E11 |
| [personal-discovery-engine-mvp.md](./personal-discovery-engine-mvp.md) | MVP scope, non-goals, acceptance loop |
| [ADR-006 — PDE boundaries](../adr/adr-006-personal-discovery-engine-boundaries.md) | Engine invariants (expand after domain/pipeline/strategy stabilize) |
| [ADR-006 addendum — E1 API spike](../adr/adr-006-addendum-e1-api-spike.md) | Resolved strategy typing, rank(), DiscoveryQuery, normalize() |
| [ADR-006 addendum — E3.1 adapter infra](../adr/adr-006-addendum-e3-1-adapter-infra.md) | Timeout/cancel/retry/rate-limit adapter boundaries |
| [ADR-006 addendum — E3.2 search adapter](../adr/adr-006-addendum-e3-2-search-adapter.md) | Brave SearchAdapter (first real provider) |
| [ADR-006 addendum — E3.3 fetch adapter](../adr/adr-006-addendum-e3-3-fetch-adapter.md) | HTTP FetchAdapter + RawContentStore |
| [ADR-006 addendum — E3.4 content extractor](../adr/adr-006-addendum-e3-4-content-extractor.md) | Deterministic HTML/text ContentExtractor |
| [ADR-006 addendum — E3.5 verification adapter](../adr/adr-006-addendum-e3-5-verification-adapter.md) | Policy-driven VerificationAdapter + Evidence |
| [ADR-006 addendum — E3.6 AI adapter](../adr/adr-006-addendum-e3-6-ai-adapter.md) | Production AiAdapter (OpenAI Chat Completions) |
| [ADR-006 addendum — E3.7 production composition](../adr/adr-006-addendum-e3-7-production-composition.md) | Production AdapterPorts composition + runtime config |
| [ADR-006 addendum — E3.8 smoke hardening](../adr/adr-006-addendum-e3-8-production-smoke-hardening.md) | Final E3 readiness gate (deterministic smoke) |
| [ADR-006 addendum — E4.1 durable persistence](../adr/adr-006-addendum-e4-1-durable-result-persistence.md) | SQLite ResultStore/ResultWriter (E4.1) |
| [ADR-006 addendum — E4.2 scheduler](../adr/adr-006-addendum-e4-2-scheduler.md) | Recurring discovery run scheduler (E4.2) |
| [ADR-006 addendum — E4.3 execution queue](../adr/adr-006-addendum-e4-3-execution-queue.md) | Scheduler → queue → worker handoff (E4.3) |
| [ADR-006 addendum — E4.4 notifications](../adr/adr-006-addendum-e4-4-notifications.md) | Digest-driven notification boundary (E4.4) |
| [ADR-006 addendum — E4.5 production email](../adr/adr-006-addendum-e4-5-production-email-notifications.md) | Resend email NotificationAdapter (E4.5) |
| [ADR-006 addendum — E4.6 Telegram](../adr/adr-006-addendum-e4-6-telegram-notification.md) | Telegram Bot API NotificationAdapter (E4.6) |
| [ADR-006 addendum — E4.7 runtime readiness](../adr/adr-006-addendum-e4-7-production-runtime-readiness.md) | Production runtime composition + E4 gate (E4.7) |
| [ADR-006 addendum — E5.1 runtime configuration](../adr/adr-006-addendum-e5-1-runtime-configuration-boundary.md) | Runtime config boundary, validation, redaction, lifecycle (E5.1) |
| [ADR-006 addendum — E5.2 durable execution queue](../adr/adr-006-addendum-e5-2-durable-execution-queue.md) | Durable SQLite queue + crash recovery (E5.2) |
| [ADR-006 addendum — E5.3 scheduling lock](../adr/adr-006-addendum-e5-3-distributed-scheduling-lock.md) | Distributed-safe scheduler locking (E5.3) |
| [ADR-006 addendum — E5.4 durable retry](../adr/adr-006-addendum-e5-4-durable-retry-policy.md) | Durable execution retry & failure recovery (E5.4) |
| [ADR-006 addendum — E5.5 observability](../adr/adr-006-addendum-e5-5-observability.md) | Provider-neutral operational telemetry (E5.5) |
| [ADR-006 addendum — E5.6 operational health](../adr/adr-006-addendum-e5-6-operational-health.md) | Operational health & runtime control (E5.6) |
| [ADR-006 addendum — E6.1 application boundary](../adr/adr-006-addendum-e6-1-production-application-boundary.md) | Production application/service boundary (E6.1) |
| [ADR-006 addendum — E6.2 HTTP admin API](../adr/adr-006-addendum-e6-2-http-admin-api-boundary.md) | HTTP / admin API boundary (E6.2) |
| [ADR-006 addendum — E6.3 HTTP authn/authz](../adr/adr-006-addendum-e6-3-http-authn-authz.md) | HTTP admin authentication & authorization (E6.3) |
| [ADR-006 addendum — roadmap E6 AI cost & dedupe](../adr/adr-006-addendum-e6-ai-cost-and-deduplication.md) | Canonical roadmap E6 AI cost/dedupe closure |
| [ADR-006 addendum — E7 persistence & history](../adr/adr-006-addendum-e7-persistence-and-history.md) | Canonical roadmap E7 persistence & history closure |
| [ADR-006 addendum — E8 scheduler](../adr/adr-006-addendum-e8-scheduler.md) | Canonical roadmap E8 scheduler closure |
| [ADR-006 addendum — E9 Discovery UI](../adr/adr-006-addendum-e9-discovery-ui.md) | Canonical roadmap E9 Discovery UI closure |
| [ADR-006 addendum — E10 notifications](../adr/adr-006-addendum-e10-notifications.md) | Canonical roadmap E10 notifications & automated delivery closure |

## Package

| Package | Status |
|---------|--------|
| `@arrival-atlas/discovery` | **E1–E10** canonical functional closure (engine + user API + notification delivery). |
| `@arrival-atlas/web` | Discovery module at `/modules/discovery` (E9.2/E9.3 + E10.4 notification preferences). |
| `@arrival-atlas/api` | Session-scoped gateway + ops host tick + notification wiring (E9.2/E10.1–E10.3). |

## Canonical E10 status

**Canonical E10 functional closure: COMPLETE**

> Automated email delivery from NEW / UPDATED digests, default empty-email suppression, user notification preferences (`emailEnabled`, `skipEmptyDigest`), profile schedule projection for daily cadence, and Atlas host-triggered execution (`POST /api/ops/discovery/trigger-due-runs`) — reusing E8 scheduler and E4 notification stack without a second scheduler or DigestStore.

See [ADR-006 addendum — E10 notifications](../adr/adr-006-addendum-e10-notifications.md).

### E10 capabilities (summary)

| Area | Delivered |
|------|-----------|
| **Notification wiring** | Composition-root recipient resolution → worker → `NotificationService` → email adapter → SENT → NOTIFIED |
| **Schedule projection** | `DiscoveryProfile.schedule` → operational schedule; daily projected; manual/weekly non-automatic |
| **Host tick** | `executeDiscoveryHostTick()`; external scheduler invokes ops HTTP with `ARRIVAL_ATLAS_OPS_TOKEN` |
| **Ops auth (H3)** | Host-global health + trigger-due-runs require ops token; ordinary accounts rejected |
| **Notification email** | Personal email preferred; `DISCOVERY_NOTIFICATION_EMAIL` is single-tenant fallback only (disabled when `ARRIVAL_ATLAS_MULTI_USER=true`) |
| **Preferences** | Profile API partial patch + UI toggles for `emailEnabled` / `skipEmptyDigest` |
| **Novelty** | E7 preserved — NEW/UPDATED notify; UNCHANGED suppressed even when `skipEmptyDigest=false` |

### E10 explicit deferrals

- Account-linked recipient email (env/test override at composition root today)
- Unsubscribe / List-Unsubscribe infrastructure beyond `emailEnabled`
- Localized email templates (web i18n localized; email English)
- Self-serve schedule UI (projection via API; UI defaults to manual cadence)
- Weekly operational recurrence
- Production platform cron / Resend deployment (outside E10 code)

## Canonical E9 status

**Canonical E9 functional closure: COMPLETE**

> User-facing Discovery API (E9.1), web UI + gateway (E9.2), and functional closure (E9.3: Run now, profile edit, `changedFields` projection, score i18n, canonical Playwright) are implemented and verified. CSR `Profile` remains separate from `DiscoveryProfile`. E6 admin API remains separate from the user API.

See [ADR-006 addendum — E9 Discovery UI](../adr/adr-006-addendum-e9-discovery-ui.md).

### E9 capabilities (summary)

| Area | Delivered |
|------|-----------|
| **Profiles** | Create (Jobs/Giveaways templates), edit criteria, enable/disable |
| **Runs** | Run now (pull-driven via `DiscoveryService`); last-run summary |
| **Results** | List/detail with verification, evidence, score breakdown, novelty/changed fields |
| **User state** | SEEN / OPENED / SAVED / DISMISSED via E7 transition rules |
| **i18n** | en, de, ru, ua — including `discovery.score.*` keys |
| **E2E** | Canonical organic journey (`e2e-discovery-canonical-journey.spec.ts`) |

### E9 explicit deferrals

- Rich/advanced criteria editor beyond current templates
- CandidateStore, DigestStore, full DiscoveryRun archival
- Module catalog / home-card (HUD nav only)
- Automatic applications or giveaway entries

## Canonical E8 status

**Canonical E8 functional closure: COMPLETE**

> Operational scheduling is implemented via `DiscoveryScheduleRecord` (E4.2/E5). `DiscoveryProfile.schedule` is declarative product intent and does not directly drive the scheduler. Automatic daily/timezone projection, cron daemons, and Redis remain deferred.

See [ADR-006 addendum — E8 scheduler](../adr/adr-006-addendum-e8-scheduler.md).

## Canonical E7 status

**Canonical E7 functional closure: COMPLETE**

> CandidateStore, DigestStore, and full DiscoveryRun archival remain deferred by design and are not required for the current E7 functional closure.

See [ADR-006 addendum — E7 persistence & history](../adr/adr-006-addendum-e7-persistence-and-history.md).

## Reading order (design → implement)

```text
Architecture (overview)
     ↓
Domain Model          ← do this before E1 code
     ↓
Pipeline Contract
     ↓
Strategy Contract
     ↓
MVP + Roadmap
     ↓
ADR-006 (engine invariants; further ADRs as needed)
```

## Status

**Active (E10)** — `@arrival-atlas/discovery` implements E1 through **canonical E10 functional closure** (automated email delivery + notification preferences):

* **E10.1** Atlas notification wiring (recipient resolution, worker delivery, NOTIFIED write-back)
* **E10.2** Profile schedule projection (declarative schedule → operational scheduler record)
* **E10.3** Atlas host tick (`executeDiscoveryHostTick`, ops HTTP endpoint)
* **E10.4** Notification preferences UI/API (`emailEnabled`, `skipEmptyDigest`)
* Pull-driven execution via existing E8 scheduler / E4 queue — no in-process cron daemon
* CSR `Profile` separate from `DiscoveryProfile`; E6 admin API separate from user API

Prior closures:

* **E9** — Discovery UI (profiles, Run now, criteria edit, results, user state)
* **E8** — operational scheduler, profile enabled gate, pull-driven `triggerDueRuns()`
* **E7** — durable profiles/results, history-scoped novelty, `changedFields`, user-state transitions

**Next epic:** E11 Production Hardening.

## Initial strategies

1. **Job Discovery** (`JobDiscoveryStrategyV1`)
2. **Giveaway / Prize Discovery** (`GiveawayDiscoveryStrategyV1`)

Future strategy categories (post-MVP): housing, benefits/support programs, education, events, travel, grants, custom strategies.

## Consistency review (2026-08-30)

Cross-check after domain / pipeline / strategy docs landed:

| Topic | Architecture | Domain | Pipeline | Strategy | MVP / Roadmap | ADR-006 |
|-------|--------------|--------|----------|----------|---------------|---------|
| Found ≠ verified | ✓ | ✓ promotion rules | ✓ promote stage | ✓ cannot weaken | ✓ acceptance | ✓ |
| AI after verify | ✓ | ✓ | ✓ AI gate §6 | ✓ aiEvaluationPolicy | ✓ funnel | ✓ |
| Aggregator vs official | ✓ | ✓ SourceTrust | ✓ rejection codes | ✓ requireOfficialSource | ✓ | ✓ |
| Attention > volume | ✓ | ✓ ResultState | ✓ reject≠low score | ✓ rank strategy-defined | ✓ zero-email | ✓ |
| Ranking formula | ✓ **not fixed product** | ✓ ScoreBreakdown | ✓ score stage | ✓ `rank()` on strategy | ✓ aligned | n/a |
| TriState UNKNOWN | overview only | ✓ canonical | ✓ UNKNOWN reject/hold | ✓ allowUnknown:false on required | ✓ fixtures | deferred ADR note |
| Immutable stages | implied | n/a | ✓ required | pure methods | E2 exit | deferred ADR note |
| Rejection retention | implied | ✓ RejectionRecord | ✓ required | filter reasons | E2 exit | deferred ADR note |
| Engine vs strategy policy | §43 / adapters | ✓ §15 | ✓ | ✓ §2 | ✓ | ✓ engine only |

**Next ADR work (later):** promote TriState coercion ban, immutable pipeline stages, and rejection-retention into ADR-006 or satellite ADRs once E1 spike confirms API shapes.
