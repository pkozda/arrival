# arr-036 — Personal Discovery Engine (PDE) · E1–E4 complete

**Branch:** `arr-036`  
**Tracks:** Personal Discovery Engine foundation — domain · immutable pipeline · production adapters · durable persistence · scheduler · queue · notifications · runtime readiness  
**Base:** `develop` (post arr-035)

Ships Arrival Atlas’s third engine beside CSR and MBDE: the **Personal Discovery Engine** — find, verify, rank, and notify users about external opportunities that match their criteria.

This PR delivers **E1 through E4** of the PDE roadmap as a self-contained package (`@arrival-atlas/discovery`) with design docs and ADR-006 addenda. It does **not** wire PDE into the web UI, CSR, or MBDE.

1. **E1 — Domain / API contract** — TriState, strategies, queries, Results, digests, promotion invariants.
2. **E2.1–E2.8 — Immutable pipeline** — Resolve → Search → Collect → Parse → Normalize → Dedup → Filter → Verify → AI → Score → Novelty → Persist/Promote → Digest.
3. **E3.1–E3.8 — Production adapters** — Brave Search · HTTP Fetch · HTML Extract · HTTP Verify · OpenAI AI · composition · deterministic smoke gate.
4. **E4.1–E4.7 — Runtime spine** — SQLite Results · scheduler · in-memory queue + worker · notification service · Resend email · Telegram · `createDiscoveryRuntime` readiness gate.

**Product verdict:** Arrival Atlas can now run a **criteria → discovery → verification → ranking → notification** loop in process, with durable Results/schedules/notification idempotency, without fabricating unverified opportunities or coupling discovery to CSR/MBDE. UI, durable queue, PostgreSQL, and retries remain deferred (E5+).

**Diff vs `develop` (working tree):** new package `packages/discovery/` (~250 TS files) · `docs/discovery/` (architecture · domain · pipeline · strategy · roadmap · MVP) · ADR-006 + 16 addenda · monorepo workspace wiring · `.env.example` provider placeholders · **329** discovery package tests green · CSR/MBDE untouched.

---

# Part 1 — Architecture (source of truth)

## Engine placement

| Capability | Question |
|------------|----------|
| **CSR** | What is happening for this user right now? |
| **MBDE** | What support / entitlements may apply? |
| **PDE** | What external opportunities exist and deserve attention? |

PDE must **not** invent entitlement truth (MBDE) or situation authority (CSR). Found ≠ verified; only promoted Results enter digests/notifications.

## End-to-end runtime

```text
Schedule
   ↓
Scheduler                    (when — enqueue only)
   ↓
Execution Queue              (in-memory; not durable)
   ↓
Worker
   ↓
executeDiscoveryPipeline     (how — immutable stages)
   ↓
Production adapters          (Brave · Fetch · Extract · Verify · AI)
   ↓
Persist + Digest             (SQLite Results)
   ↓
Notification Service         (digest-authoritative eligibility)
   ↓
Email (Resend) / Telegram    (NotificationAdapter)
```

Composition root: `createDiscoveryRuntime(...)` (E4.7). Pull/trigger lifecycle only — **no cron / background daemon**.

## Package

| Package | Role |
|---------|------|
| `@arrival-atlas/discovery` | Domain types · pipeline · adapters · scheduler · queue · notifications · runtime |

Workspace: root `package.json` / lockfile include discovery in `build` and `test`. Dependency: `better-sqlite3` (Results · scheduler · notification stores).

---

# Part 2 — E1 · Domain / API contract

## Delivered

- Domain types: Profile · Criteria · Candidate · Evidence · Verification · Score · Novelty · Result · Digest · Run
- TriState + coercion ban helpers
- Strategy registry + stub strategies: `JobDiscoveryStrategyV1`, `GiveawayDiscoveryStrategyV1`
- Promotion / evidence / score / verification-status invariants
- ADR-006 boundaries + E1 API spike addendum

## Invariants (non-negotiable)

- Hard requirements reject before ranking
- AI interprets only — never verifies / fabricates Evidence
- Aggregator search hits are not OFFICIAL employer trust
- Attention > volume; empty digests skip notification by default

---

# Part 3 — E2 · Immutable pipeline

## Canonical stage order

```text
resolve_snapshot → build_queries → search → collect → parse → normalize
→ deduplicate → filter → verify → ai_evaluate → score → novelty_state
→ persist_promote → digest
```

`CANONICAL_STAGE_ORDER` must not be reordered by strategies or adapters.

## Stage highlights

| Stage | Behavior |
|-------|----------|
| Collect / Parse | Fetch + extract; RawContentStore; no invented page content |
| Verify | Policy-driven checks → Evidence; gate before AI |
| AI evaluate | Gate after PASS verification; failure → no fake evaluation |
| Score / Novelty | Strategy-owned ranking; `shouldNotify` consumed later |
| Persist / Promote | ResultWriter; identity uniqueness |
| Digest | Eligibility from novelty + safety; presentation-independent |

Pipeline ports (Search / Fetch / Extract / Verify / AI) stay adapter-neutral until E3.

---

# Part 4 — E3 · Production adapters

## Adapters (HttpTransport; no vendor SDKs in domain)

| Epic | Adapter | Provider |
|------|---------|----------|
| E3.1 | Timeout · cancel · retry boundary · rate limiter | Infrastructure only |
| E3.2 | SearchAdapter | Brave Search |
| E3.3 | FetchAdapter | HTTP + RawContentStore |
| E3.4 | ContentExtractor | Deterministic HTML/text |
| E3.5 | VerificationAdapter | Policy + Evidence |
| E3.6 | AiAdapter | OpenAI Chat Completions JSON |
| E3.7 | `createProductionDiscoveryAdapters` | Composition + config load/validate/redact |
| E3.8 | Production smoke | Deterministic full-pipeline gate |

## Configuration boundary

Adapters **never** read `process.env`. Composition root loads:

```text
BRAVE_SEARCH_API_KEY
OPENAI_API_KEY · OPENAI_MODEL · OPENAI_BASE_URL
RESEND_API_KEY · DISCOVERY_EMAIL_FROM
TELEGRAM_BOT_TOKEN
```

(`/.env.example` documents placeholders; no real secrets committed.)

## Smoke rule

Strict injected `HttpTransport` — unregistered calls throw `UNEXPECTED_NETWORK_REQUEST`. No real Brave / OpenAI / email / Telegram in CI.

---

# Part 5 — E4 · Runtime spine

## E4.1 — Durable Results

- SQLite via `better-sqlite3`
- `ResultStore` / `ResultWriter` ports preserved
- Schema-v1 serialization; identity key uniqueness
- Survives process restart

## E4.2 — Scheduler

- `createDiscoveryScheduler` — fixed-interval recurrence
- `nextRunAt` advances from **scheduled slot** (not finish time)
- Missed intervals coalesce to **one** run
- Process-local overlap via `runningRunId`
- `triggerNow` does **not** advance `nextRunAt`
- Scheduler enqueues only (after E4.3) — no pipeline logic

## E4.3 — Execution queue

```text
Scheduler → Queue → Worker → createPipelineRunExecutor → pipeline
```

- Storage-neutral `DiscoveryExecutionQueue` + in-memory FIFO
- `jobId` ≠ `runId`
- Duplicate `runId` enqueue rejected
- Worker failure isolation; no auto-retries
- **Queue jobs are not durable** (documented recovery gap)

## E4.4 — Notifications

- Digest is **authoritative** eligibility (no re-score / re-verify)
- `createDiscoveryNotificationService` + SQLite notification store
- Idempotency: `(profileId, digestId, channel, recipient)`
- Lifecycle: `PENDING → SENT | FAILED`
- Notification failure **does not** fail discovery run

## E4.5 — Email (Resend)

- `createProductionEmailNotificationAdapter`
- Deterministic HTML + plain text; HTML escaping
- Rate key: `notification:email:resend`

## E4.6 — Telegram

- `createProductionTelegramNotificationAdapter`
- Plain text; 4096 truncation; `recipient.address` → `chat_id`
- Rate key: `notification:telegram`

## E4.7 — Runtime readiness

- `createDiscoveryRuntime` wires persistence + adapters + scheduler + queue + worker + notifications
- Channel router for EMAIL / TELEGRAM
- Idempotent `close()` for SQLite resources
- Integration suites: happy path · failure isolation · restart

**E4 status: complete.**

---

# Part 6 — Documentation map

| Area | Paths |
|------|-------|
| Domain index | [`docs/discovery/README.md`](../discovery/README.md) |
| Design | architecture · domain-model · pipeline · strategy-contract · roadmap · MVP |
| ADR-006 | boundaries + E1 · E3.1–E3.8 · E4.1–E4.7 addenda |
| Decisions index | [`docs/decisions/README.md`](../decisions/README.md) |

---

# Part 7 — Architecture compliance

| Rule | Status |
|------|--------|
| CSR untouched | ✓ |
| MBDE untouched | ✓ |
| Canonical pipeline stage order unchanged after E2 | ✓ |
| Adapters never read `process.env` | ✓ |
| No real provider network in automated tests | ✓ |
| Digest authoritative for notifications | ✓ |
| Notification failure ≠ discovery failure | ✓ |
| Queue durability limitation explicit | ✓ |
| Secrets redacted in config / failures | ✓ |
| No UI / durable queue / PostgreSQL / retries in E4 | ✓ |

---

## Known limitations / deferred (E5+)

- In-memory queue loses jobs on restart (schedule lock may remain set)
- No durable / distributed queue or locking
- No notification automatic retries
- No push / Slack / WhatsApp
- No PostgreSQL migration
- No PDE UI / user-facing scheduling
- No observability platform
- No web wiring of `createDiscoveryRuntime` into API/apps yet

---

## Test plan

### Unit / integration (required)

```bash
npm run build -w @arrival-atlas/discovery
npm test -w @arrival-atlas/discovery
```

Expected:

```text
Test Files  35 passed
Tests       329 passed
```

### Optional monorepo regression

```bash
npm run build
npm test
```

Confirm CSR / MBDE / web packages still green; discovery workspace included.

### Manual / operator smoke (optional; not CI)

- [ ] Load production config with fake transport only — no accidental live keys in tests
- [ ] Runtime happy path: register schedule → `triggerDueRuns` → `worker.processNext` → Result + SENT notification
- [ ] Restart with same SQLite paths → schedules / Results / notification idempotency survive; queue empty
- [ ] Telegram vs Email channel selection via `resolveNotificationTarget`
- [ ] Provider 503 → NotificationRecord FAILED; DiscoveryRun still SUCCESS

### Security spot checks

- [ ] Redacted config never contains Brave / OpenAI / Resend / Telegram secrets
- [ ] Failure messages never echo bearer tokens / bot tokens
- [ ] Default Job verification does not promote Brave AGGREGATOR → OFFICIAL from page text alone

---

## Related docs

- [docs/discovery/README.md](../discovery/README.md) — PDE domain index
- [ADR-006](../adr/adr-006-personal-discovery-engine-boundaries.md) — engine boundaries
- [ADR-006 E4.7](../adr/adr-006-addendum-e4-7-production-runtime-readiness.md) — runtime readiness / E4 complete
- [arr-035-pr-description.md](./arr-035-pr-description.md) — Runtime localization (prior)
- [arr-034-pr-description.md](./arr-034-pr-description.md) — Welcome · Certainty · CSR
- [arr-033-pr-description.md](./arr-033-pr-description.md) — MBDE foundation
