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
updated: 2026-08-30
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

## Package

| Package | Status |
|---------|--------|
| `@arrival-atlas/discovery` | **E1–E4 complete**: domain + pipeline + production adapters + durable Results + scheduler + queue + notifications (Email + Telegram) + **runtime composition (E4.7)**. |

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

**Active (E4 complete)** — `@arrival-atlas/discovery` implements E1 through **E4.7 Production Runtime Readiness**:

* `createDiscoveryRuntime` wires scheduler → queue → worker → production pipeline → notifications
* Durable SQLite: Results, schedules/runs, notification idempotency
* In-memory execution queue (jobs **not** durable — intentional E4.3 limitation)
* `createProductionEmailNotificationAdapter` (Resend) + `createProductionTelegramNotificationAdapter`
* Channel router selects provider; pipeline remains provider-agnostic
* Pull/trigger lifecycle only — no cron / background daemon
* Notification / provider / worker failures isolated from discovery success semantics
* Deferred to E5+: PostgreSQL, durable queue, distributed locking, UI, retries, push, observability platform

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
