---
id: adr-006-addendum-e5-5-observability
title: ADR-006 Addendum — PDE E5.5 Observability & Operational Telemetry
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-31
updated: 2026-08-31
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e5-1-runtime-configuration-boundary
  - adr-006-addendum-e5-2-durable-execution-queue
  - adr-006-addendum-e5-3-distributed-scheduling-lock
  - adr-006-addendum-e5-4-durable-retry-policy
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E5.5 Observability & Operational Telemetry

**Status:** Accepted (E5.5)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

E5.5 introduces a **provider-neutral structured telemetry boundary** for the Discovery runtime.

```text
Discovery Runtime
      ↓
DiscoveryTelemetry.emit(DiscoveryTelemetryEvent)
      ↓
provider-neutral boundary
      ↓
future OpenTelemetry / Sentry / etc. (composition only)
```

Telemetry is **side-channel only**. It is never a source of truth for scheduling, queue, retry, pipeline, scoring, novelty, promotion, or notification eligibility.

No vendor SDK (OpenTelemetry, Sentry, Datadog, Prometheus client, CloudWatch, Grafana) is introduced in E5.5. Metrics backends and distributed tracing are deferred to a future composition/infrastructure task.

---

## Port & event model

### Port

```ts
interface DiscoveryTelemetry {
  emit(event: DiscoveryTelemetryEvent): void | Promise<void>;
}
```

### Envelope

Every event carries:

- `eventId` (injectable generator for deterministic tests)
- `eventName` (typed discriminated names)
- `category` (derived from name prefix)
- `occurredAt` (from injectable `Clock`)
- optional correlation: `runId`, `jobId`, `scheduleId`, `profileId`, `strategyId`, `attempt`, `runtimeInstanceId`
- optional `durationMs`
- optional sanitized `attributes`

### Categories / names

`runtime` · `scheduler` · `queue` · `worker` · `pipeline` · `adapter` · `retry` · `persistence` · `notification`

Examples: `runtime.created`, `scheduler.lock_contended`, `queue.retried`, `worker.retry_scheduled`, `pipeline.partial_success`, `adapter.timeout`, `notification.sent`.

There is no primary `emit(string, any)` contract.

---

## Correlation

Reuse existing identifiers along the operational path:

```text
scheduleId → runId → jobId → attempt → pipeline → adapters → persistence → notification
```

No new tracing system is introduced in E5.5.

---

## Failure isolation

Emission is best-effort via `safeEmit` / `createTelemetryEmitter`.

A broken telemetry provider must **not**:

- fail a run
- reject candidates
- trigger or suppress retries
- block queue ACK
- prevent notifications
- change scheduler / lock decisions

Telemetry failures are swallowed at the emit boundary.

---

## Secret-safety boundary

`sanitizeTelemetryAttributes` + existing `sanitizeAdapterDiagnosticMessage` / `sanitizeRuntimeErrorMessage`:

- Drop forbidden keys (`apiKey`, `Authorization`, `prompt`, `rawHtml`, tokens, …)
- Redact known config secrets
- Truncate oversized string blobs

Telemetry must never emit API keys, bot tokens, Authorization headers, raw HTML/page content, AI prompts/raw responses, or recipient secrets.

---

## Runtime integration

`createDiscoveryRuntime({ telemetry?, telemetryEventIdGenerator? })`:

- Optional; default is no-op
- Emits `runtime.created` / `runtime.closed` (`close()` remains idempotent)
- Wires emitter into scheduler, queue wrap, worker, pipeline executor, result writer wrap, notification service
- Adapter ports are wrapped for `adapter.*` events without changing adapter contracts

Test sink: `createInMemoryDiscoveryTelemetry()` (`events` / `eventsByName` / `clear`).

---

## Relationship to E5.1–E5.4

| Epic | Role relative to telemetry |
|------|----------------------------|
| E5.1 | Config/lifecycle; secrets for redaction; optional telemetry on runtime |
| E5.2 | Queue lifecycle events (`enqueued` / `claimed` / `acked` / `failed` / `recovered`) |
| E5.3 | Scheduler lock contention / skip / enqueue events (lock remains SoT) |
| E5.4 | Retry decision events (`retry.scheduled` / `exhausted` / `not_allowed`) |
| E5.5 | Observability contract + instrumentation (this addendum) |

---

## Consequences

### Positive

- Operational visibility without vendor lock-in
- Deterministic tests via clock + event ID injection
- Clear secret-safety and failure isolation

### Deferred

- OpenTelemetry / Sentry / metrics backends
- Full histogram/counter aggregation inside domain
- Distributed trace spans as a first-class model

### Non-goals

- Changing discovery semantics
- Making telemetry required for successful execution
- CSR / MBDE changes
