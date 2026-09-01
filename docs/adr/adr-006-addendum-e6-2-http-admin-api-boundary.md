---
id: adr-006-addendum-e6-2-http-admin-api-boundary
title: ADR-006 Addendum — PDE E6.2 HTTP / Admin API Boundary
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-31
updated: 2026-08-31
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e6-1-production-application-boundary
  - adr-006-addendum-e5-6-operational-health
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E6.2 HTTP / Admin API Boundary

**Status:** Accepted (E6.2)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

E6.2 adds a **thin, replaceable HTTP admin adapter** over `DiscoveryService`.

```text
HTTP Request
     ↓
createDiscoveryHttpHandler (framework-free)
     ↓
DiscoveryService
     ↓
DiscoveryRuntime → Scheduler → Queue → Worker → Pipeline
```

**HTTP is an adapter, not a domain layer.** Handlers perform structural validation and status mapping only.

> **Security:** E6.2 is an **unauthenticated** administrative boundary and **MUST NOT** be exposed publicly without an authentication/authorization layer (deferred).

---

## Technology

No HTTP framework existed in the monorepo. E6.2 uses:

1. Transport-neutral `DiscoveryHttpRequest` / `DiscoveryHttpResponse` + `createDiscoveryHttpHandler`
2. Optional `createDiscoveryHttpServer` on Node `node:http`

This keeps the adapter replaceable (Hono/Express later) without coupling discovery domain to a framework.

---

## Endpoints

| Method | Path | Service |
|--------|------|---------|
| GET | `/health` | `getHealth()` |
| GET | `/status` | lifecycle + health + providers (no DB paths/secrets) |
| GET | `/schedules` | `listSchedules()` |
| POST | `/schedules` | `registerSchedule()` |
| POST | `/schedules/:id/enable` | `enableSchedule()` |
| POST | `/schedules/:id/disable` | `disableSchedule()` |
| POST | `/schedules/:id/run` | `runNow()` → **202 Accepted** (async enqueue) |
| GET | `/runs/:runId` | `getRun()` |
| POST | `/worker/process-next` | `processNext()` (optional; pull-driven hosts) |

`POST .../run` never executes the pipeline and never waits for completion.

---

## HTTP status mapping

| Condition | Status |
|-----------|-------:|
| Successful health/status/read | 200 |
| Schedule created | 201 |
| Manual run enqueued | 202 |
| Invalid / malformed JSON | 400 |
| Missing schedule/run | 404 |
| already_running / lock_contended / duplicate | 409 |
| Service not started / stopped / runtime closed | 503 |
| Unexpected | 500 |

---

## Request ID

- Header: `x-request-id`
- Accept inbound when well-formed; otherwise generate UUID
- Echoed on every response
- HTTP-level correlation only — does not replace `scheduleId` / `runId` / `jobId`

---

## Lifecycle

- Mutations require a ready service → otherwise 503
- `GET /health` / `GET /status` work before start / after stop with structured `UNAVAILABLE` when the service provides it
- No auto-restart

---

## Explicitly deferred

Authentication, authorization, UI, cron, PostgreSQL, Redis, OpenTelemetry exporters, public multi-tenant APIs.

---

## Non-goals

- Discovery/business logic in handlers
- Direct pipeline / DB / provider access
- Changing E1–E6.1 semantics
- CSR / MBDE changes
