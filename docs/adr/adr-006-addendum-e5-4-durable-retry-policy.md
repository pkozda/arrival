---
id: adr-006-addendum-e5-4-durable-retry-policy
title: ADR-006 Addendum — PDE E5.4 Durable Retry & Failure Recovery Policy
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-31
updated: 2026-08-31
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e3-1-adapter-infra
  - adr-006-addendum-e5-2-durable-execution-queue
  - adr-006-addendum-e5-3-distributed-scheduling-lock
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E5.4 Durable Retry & Failure Recovery Policy

**Status:** Accepted (E5.4)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

Retry ownership belongs to **execution orchestration** (worker + durable queue), not adapters.

```text
Adapter (single attempt)
   ↓
AdapterFailure
   ↓
Worker catch / execution failure
   ↓
DiscoveryExecutionRetryPolicy
   ├── RETRY → queue.retry(availableAt)  // same jobId + runId
   └── NO_RETRY → queue.fail (terminal)
```

Adapters remain single-attempt operations. No retry loops in Brave, Fetch, Verify, AI, Email, or Telegram.

### Relationship to E3.1

| Layer | Abstraction | Role |
|-------|-------------|------|
| E3.1 | `RetryPolicy` / `wouldRetry` / `isRetryableAdapterFailure` | Classify whether a failure *may* be retried |
| E5.4 | `DiscoveryExecutionRetryPolicy` | Decide durable re-queue + backoff for the **job** |

Classification is centralized in `isRetryableAdapterFailure` (codes + explicit `retryable` flag). Execution policy adds attempt limits and exponential backoff.

### Attempt semantics

```text
attempt 1 = initial execution
attempt 2 = first retry
…
maxAttempts = 3 → at most three executions
```

Backoff (no jitter):

```text
delay = min(maxDelayMs, baseDelayMs * 2^(completedAttempt - 1))
```

Defaults: `maxAttempts=3`, `baseDelayMs=1000`, `maxDelayMs=60000`.

### Retryable vs non-retryable

**Retryable:** `TIMEOUT`, `NETWORK_ERROR`, `UNAVAILABLE`, `RATE_LIMITED`  
**Non-retryable:** `CANCELLED`, `AUTH_REQUIRED`, `POLICY_BLOCKED`, `INVALID_RESPONSE`, `AI_OUTPUT_INVALID`  
**UNKNOWN:** only when `failure.retryable === true`

Cancellation is never auto-retried.  
`PARTIAL_SUCCESS` / normal pipeline completion is never auto-retried (only thrown execution failures).

### Queue API

Additive:

```ts
retry(jobId, availableAt, reason, options?)
```

`RUNNING → QUEUED`, `attempt++`, future `availableAt`, claim cleared, `jobId`/`runId` preserved.

### Lease recovery vs policy retry

| Path | When | Attempt |
|------|------|---------|
| Lease recovery (`recoverExpiredClaims`) | Crash while RUNNING | `attempt++` once |
| Policy retry (`queue.retry`) | Execution completed with retryable failure | `attempt++` once |

Never both for the same transition.

### Scheduler interaction

- Retries do **not** advance `nextRunAt`
- Retries do **not** reacquire the E5.3 scheduler lock
- `runningRunId` remains set during retry wait (same run)
- Cleared only on ACK or terminal FAIL

### Idempotency

Same `runId` / `jobId` / Result identity / notification identity across retries.  
At-least-once execution remains; exactly-once is **not** claimed.

### No background timers

`availableAt` is durable queue state. Workers discover ready jobs on dequeue. No `setInterval` / cron / retry daemon.

### Configuration

```ts
createDiscoveryRuntime({
  retry: { maxAttempts, baseDelayMs, maxDelayMs },
  …
})
```

Validated at the E5.1 configuration boundary. No env reads in worker/domain code.

---

## Explicit non-goals

- PostgreSQL / Redis retry backends
- Notification retries
- Provider-specific retry algorithms
- Background retry daemons
- Auto-retry of `PARTIAL_SUCCESS`
- New pipeline stages / scoring / verification / digest changes
- UI / observability platform / auth / new strategies

---

## Consequences

- Transient infra failures can recover across process restart
- Deterministic domain outcomes stay terminal without false retries
- Queue leases (E5.2) and scheduler locks (E5.3) remain separate concerns
