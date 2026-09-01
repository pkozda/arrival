# arr-037 — Personal Discovery Engine (PDE) · E5–E7 complete

**Branch:** `arr-037`  
**Tracks:** Personal Discovery Engine production hardening — durable queue · scheduling locks · retry · telemetry · health · AI cost control · service/HTTP/admin · persistence & history  
**Base:** `develop` (post arr-036 / merge #34)

Extends `@arrival-atlas/discovery` from **E4 runtime readiness** to **canonical E5–E7 closure**: production-grade orchestration, operator surfaces, AI cost governance, and history-correct persistence without re-notifying unchanged opportunities.

This PR does **not** wire PDE into the web UI, CSR, or MBDE. It does **not** add PostgreSQL, Redis, cron daemons, or PDE user-facing UI (E9).

1. **E5.1–E5.6 — Production runtime** — explicit config boundary · durable SQLite queue · scheduler locks · durable retry · provider-neutral telemetry · operational health.
2. **Canonical E6 — AI Evaluation Layer** — token-budget gating · run-scoped AI evaluation dedupe · fingerprint cache.
3. **E6.1–E6.3 — Application / HTTP / auth** (implementation epics, distinct from canonical roadmap numbering) — `DiscoveryService` · framework-free HTTP admin API · Bearer authn + permission authz.
4. **Canonical E7 — Persistence & History** — durable ProfileStore · result state transitions · `changedFields` · Job salary material updates · notification → `NOTIFIED` · restart-safe history proofs.

**Product verdict:** A host can run discovery on a schedule with **crash-safe queue recovery**, inspect **redacted health**, operate via an **authenticated admin HTTP API**, and rely on **history-based novelty** so unchanged jobs are not re-notified while material salary updates surface as `UPDATED` with a second notification.

**Diff vs `develop` (working tree):** ~90+ files in `packages/discovery/` + `docs/` · **11** new ADR-006 addenda (E5.1–E5.6 · E6 AI · E6.1–E6.3 · E7) · discovery package **513** tests green (51 files; up from 329) · CSR/MBDE untouched.

---

# Part 1 — Architecture (source of truth)

## Engine placement (unchanged)

| Capability | Question |
|------------|----------|
| **CSR** | What is happening for this user right now? |
| **MBDE** | What support / entitlements may apply? |
| **PDE** | What external opportunities exist and deserve attention? |

## End-to-end runtime (post-E5)

```text
Host / operator
   ↓
DiscoveryService (E6.1)          lifecycle · runNow · registerSchedule
   ↓
createDiscoveryHttpHandler (E6.2/E6.3)   optional Bearer-protected admin API
   ↓
DiscoveryRuntime (E4.7 + E5)
   ├── RuntimeConfig (E5.1)      validation · redaction · close()
   ├── Scheduler + SchedulerLock (E5.3)
   ├── Durable SQLite Queue (E5.2) + RetryPolicy (E5.4)
   ├── Worker → executeDiscoveryPipeline
   ├── ProfileStore (E7.1) + ResultStore (E4.1)
   ├── Telemetry (E5.5) + getHealth() (E5.6)
   └── NotificationService → Email / Telegram
```

Pull/trigger lifecycle only — **no cron / background daemon**.

## Architectural distinctions (E7)

```text
Operational (E4/E5)                    Historical (E7)
─────────────────────                  ─────────────────
Scheduler schedule/run metadata   ≠    Pipeline DiscoveryRun (ephemeral per execute)
Queue execution jobs              ≠    Promoted DiscoveryResult (durable)
NotificationRecord.status=SENT    ≠    DiscoveryResult.userState=NOTIFIED
ResultLifecycleStatus (ACTIVE…)   ≠    ResultState (NEW/SEEN/NOTIFIED/…)
```

Novelty is **history-based**: `decideNovelty` compares against persisted `DiscoveryResult` snapshots, not merely in-run dedupe.

## Package

| Package | Role |
|---------|------|
| `@arrival-atlas/discovery` | Domain · pipeline · adapters · scheduler · durable queue · notifications · runtime · service · HTTP · telemetry · health |

---

# Part 2 — E5 · Production runtime

## E5.1 — Runtime configuration boundary

- Explicit `DiscoveryRuntimeConfig` — infrastructure vs application concerns separated
- Env loading stays in composition root; adapters never read `process.env`
- Side-effect-free startup validation; provider enablement gates
- Secret redaction in config snapshots and error messages
- Deterministic `close()` / `DiscoveryRuntimeClosedError`

**ADR:** [adr-006-addendum-e5-1-runtime-configuration-boundary.md](../adr/adr-006-addendum-e5-1-runtime-configuration-boundary.md)

## E5.2 — Durable execution queue

- SQLite-backed `DiscoveryExecutionQueue` (production default)
- At-least-once delivery; claim leases + `recoverExpiredClaims` on startup
- `createInMemoryExecutionQueue()` retained for unit tests
- Duplicate safety: Result identity + notification idempotency

```text
Schedule → Scheduler → Durable Queue → Worker → Pipeline → Persist + Digest → Notifications
```

**ADR:** [adr-006-addendum-e5-2-durable-execution-queue.md](../adr/adr-006-addendum-e5-2-durable-execution-queue.md)

## E5.3 — Distributed scheduling lock

- `SchedulerLock` port — schedule → run creation / enqueue only
- Distinct from queue job leases (E5.2)
- Lock contention is non-fatal (`lock_contended`); leases expire
- SQLite `createSqliteSchedulerLock`; in-memory fake for tests

**ADR:** [adr-006-addendum-e5-3-distributed-scheduling-lock.md](../adr/adr-006-addendum-e5-3-distributed-scheduling-lock.md)

## E5.4 — Durable retry policy

- Retry ownership: worker + queue, **not** adapters
- `DiscoveryExecutionRetryPolicy` → `queue.retry(availableAt)` or terminal `fail`
- Adapters remain single-attempt (Brave, Fetch, Verify, AI, Email, Telegram)
- No background retry timers

**ADR:** [adr-006-addendum-e5-4-durable-retry-policy.md](../adr/adr-006-addendum-e5-4-durable-retry-policy.md)

## E5.5 — Observability / telemetry

- Provider-neutral `DiscoveryTelemetry.emit(DiscoveryTelemetryEvent)`
- Side-channel only — never affects eligibility, scoring, novelty, or notifications
- No vendor SDK (OpenTelemetry, Sentry, etc.) in this epic
- Sanitized observations; in-memory fake for tests

**ADR:** [adr-006-addendum-e5-5-observability.md](../adr/adr-006-addendum-e5-5-observability.md)

## E5.6 — Operational health

- `runtime.getHealth()` → typed `DiscoveryRuntimeHealth` (redacted)
- Read-mostly inspection: queue · schedules · runs · locks · config · observations
- Does not mutate discovery state or change decisions

**ADR:** [adr-006-addendum-e5-6-operational-health.md](../adr/adr-006-addendum-e5-6-operational-health.md)

**E5 status: complete.**

---

# Part 3 — Canonical E6 · AI Evaluation Layer

Closes roadmap **E6 — AI Evaluation Layer** (not the E6.1–E6.3 implementation epics).

| Capability | Behavior |
|------------|----------|
| Token budgets | Optional `maxEstimatedAiInputTokensPerRun` / `maxEstimatedAiOutputTokensPerRun` on `EnginePolicy` |
| Call-count budget | Existing `maxAiEvaluationsPerRun` |
| Evaluation dedupe | Run-scoped fingerprint cache — same candidate not re-evaluated in one run |
| Gate integration | `ai-gate.ts` enforces budgets before adapter call |

**ADR:** [adr-006-addendum-e6-ai-cost-and-deduplication.md](../adr/adr-006-addendum-e6-ai-cost-and-deduplication.md)

**Canonical E6 status: complete.**

---

# Part 4 — E6.1–E6.3 · Service / HTTP / auth (implementation epics)

> **Naming note:** E6.1–E6.3 are **implementation epics** for operator surfaces. They are **not** canonical roadmap E6 (AI Evaluation Layer).

## E6.1 — DiscoveryService

```text
Host → DiscoveryService → DiscoveryRuntime
```

- Lifecycle: `start()` / `stop()` / `runNow()` / `registerSchedule()` / `listSchedules()` / `processNext()`
- Orchestration only — no discovery business logic
- Startup recovers expired queue claims + scheduler locks

**ADR:** [adr-006-addendum-e6-1-production-application-boundary.md](../adr/adr-006-addendum-e6-1-production-application-boundary.md)

## E6.2 — HTTP admin API

Framework-free `createDiscoveryHttpHandler(service)` — no Express/Fastify dependency.

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/health` | Runtime health (E5.6) |
| `GET` | `/status` | Service lifecycle |
| `GET` | `/schedules` | List schedules |
| `POST` | `/schedules` | Register schedule |
| `POST` | `/schedules/:id/enable` | Enable schedule |
| `POST` | `/schedules/:id/disable` | Disable schedule |
| `POST` | `/schedules/:id/run` | Manual trigger (`runNow`) |
| `GET` | `/runs/:runId` | Run metadata |
| `POST` | `/worker/process-next` | Pull-driven worker step (optional) |

**ADR:** [adr-006-addendum-e6-2-http-admin-api-boundary.md](../adr/adr-006-addendum-e6-2-http-admin-api-boundary.md)

## E6.3 — HTTP authn / authz

```text
request-id → route policy → Bearer authenticate → permission authorize → handler
```

- `DiscoveryAuthenticator` — `Authorization: Bearer <token>` only
- `DiscoveryAuthorizer` — permission-set policy per route
- `createStaticTokenAuthenticator` for single-token deployments
- `allowUnauthenticated: true` for local/tests only
- Auth at HTTP boundary only — `DiscoveryService` programmatic API remains unauthenticated

**ADR:** [adr-006-addendum-e6-3-http-authn-authz.md](../adr/adr-006-addendum-e6-3-http-authn-authz.md)

**E6.1–E6.3 status: complete.**

---

# Part 5 — Canonical E7 · Persistence & History

## Implemented

| Area | Delivery |
|------|----------|
| **Profile persistence** | SQLite `ProfileStore` (`discovery_profiles`); runtime-owned when not injected |
| **Result persistence** | E4.1 SQLite `ResultStore` / `ResultWriter` (unchanged port) |
| **Verification / evidence** | Embedded in promoted `DiscoveryResult` envelope |
| **Novelty** | History-scoped `NEW` / `UNCHANGED` / `UPDATED`; `SKIP_UNCHANGED` |
| **`changedFields`** | Deterministic sorted structured keys on `NoveltyDecision` |
| **Job salary** | `materialExtractedFields: ['salary']` — updates existing identity, not new row |
| **User-state transitions** | `validateResultStateTransition` + `ResultStateWriter` |
| **Notification → NOTIFIED** | Successful delivery only; failed/skipped/duplicate does not mutate |
| **Restart durability** | Profiles, results, `NOTIFIED`, notification idempotency survive reopen |

## Exit criteria (proven)

| Scenario | Test file |
|----------|-----------|
| Unchanged second run → no second notification | `runtime/e7-history.test.ts` (E7.7) |
| Salary €60k → €65k → `UPDATED` + second notification | `runtime/e7-history.test.ts` (E7.8) |
| Unchanged €65k third run → no third notification | `runtime/e7-history.test.ts` (run 3) |
| `changedFields` + salary material | `pipeline/novelty.test.ts` (E7.5, E7.6) |
| State transition rules | `pipeline/result-state-transition.test.ts` |
| `ResultStateWriter` + SQLite reopen | `pipeline/result-state-writer.test.ts` |
| Notification → `NOTIFIED` | `notifications/notifications.test.ts` (E7.4) |
| `NOTIFIED` survives restart | `runtime/runtime-result-state-restart.test.ts` |
| Profile persistence | `adapters/persistence/sqlite-profile-persistence.test.ts`, `runtime/runtime-profile-persistence.test.ts` |

## Explicitly deferred (by design)

| Item | Why deferred |
|------|--------------|
| `CandidateStore` | Rejected candidates remain run-scoped; history loop uses durable Results |
| `DigestStore` | Digest per-run; notification idempotency is durable |
| Full pipeline `DiscoveryRun` archival | Operational run metadata via scheduler/queue suffices |
| Durable raw-content store | `RawContentStore` in-memory by default (E3.3) |

**Canonical E7 functional closure: COMPLETE**

**ADR:** [adr-006-addendum-e7-persistence-and-history.md](../adr/adr-006-addendum-e7-persistence-and-history.md)

---

# Part 6 — Documentation map

| Area | Paths |
|------|-------|
| Domain index | [`docs/discovery/README.md`](../discovery/README.md) |
| Roadmap (E7 status) | [`docs/discovery/personal-discovery-engine-roadmap.md`](../discovery/personal-discovery-engine-roadmap.md) |
| ADR-006 addenda | E5.1–E5.6 · E6 AI · E6.1–E6.3 · E7 (11 new) |
| Decisions index | [`docs/decisions/README.md`](../decisions/README.md) |

---

# Part 7 — Architecture compliance

| Rule | Status |
|------|--------|
| CSR untouched | ✓ |
| MBDE untouched | ✓ |
| Canonical pipeline stage order unchanged | ✓ |
| Adapters never read `process.env` | ✓ |
| No real provider network in automated tests | ✓ |
| Digest authoritative for notifications | ✓ |
| Notification failure ≠ discovery failure | ✓ |
| Queue at-least-once + idempotent Results/notifications | ✓ |
| Scheduler lock ≠ queue lease | ✓ |
| Retry at worker/queue layer only | ✓ |
| Telemetry/health side-channel only | ✓ |
| HTTP auth at adapter boundary only | ✓ |
| Secrets redacted in config / failures | ✓ |
| Novelty history-based against persisted Results | ✓ |
| E7 deferred stores not claimed as implemented | ✓ |

---

## Known limitations / deferred (E8+)

- No cron / background scheduler daemon (pull/trigger hosts only)
- No PostgreSQL / Redis migration
- No `CandidateStore` / `DigestStore` / full `DiscoveryRun` archival
- No durable raw-content store by default
- No PDE user-facing UI (E9)
- No observability vendor SDK wiring (telemetry port only)
- No notification automatic retries beyond queue retry for execution failures
- No push / Slack / WhatsApp channels
- No web app wiring of `DiscoveryService` / HTTP handler into Next.js API routes yet

---

## Test plan

### Unit / integration (required)

```bash
npm run build -w @arrival-atlas/discovery
npm test -w @arrival-atlas/discovery
```

Expected:

```text
Test Files  51 passed
Tests       513 passed
```

### Optional monorepo regression

```bash
npm run build
npm test
```

Confirm CSR / MBDE / web packages still green.

### Manual / operator smoke (optional; not CI)

- [ ] `DiscoveryService.start()` → recover queue claims + scheduler locks → `getHealth()` returns structured snapshot
- [ ] Durable queue: enqueue → crash before ack → restart → `recoverExpiredClaims` → worker re-processes (at-least-once)
- [ ] Scheduler lock: two instances `triggerDueRuns` → one `lock_contended`, one enqueues
- [ ] Retry: transient pipeline failure → `queue.retry` with `availableAt`; terminal failure → `fail`
- [ ] HTTP admin with Bearer token: `POST /schedules` → `POST /schedules/:id/run` → `POST /worker/process-next` → `GET /runs/:id`
- [ ] HTTP without token → 401; wrong permission → 403
- [ ] E7 history: two runs unchanged → one notification; salary update → `UPDATED` + second notification; third unchanged → no third notification
- [ ] Restart with same SQLite paths → profiles · results · `NOTIFIED` · notification idempotency survive

### Security spot checks

- [ ] Redacted config / health never contains API keys or admin tokens
- [ ] HTTP error responses never echo Bearer tokens
- [ ] `allowUnauthenticated` not used in production config
- [ ] Default Job verification does not promote aggregator → OFFICIAL from page text alone

---

## Related docs

- [docs/discovery/README.md](../discovery/README.md) — PDE domain index (E7 closure status)
- [ADR-006](../adr/adr-006-personal-discovery-engine-boundaries.md) — engine boundaries
- [ADR-006 E7](../adr/adr-006-addendum-e7-persistence-and-history.md) — persistence & history closure
- [arr-036-pr-description.md](./arr-036-pr-description.md) — E1–E4 foundation (prior)
- [arr-035-pr-description.md](./arr-035-pr-description.md) — Runtime localization (prior)
