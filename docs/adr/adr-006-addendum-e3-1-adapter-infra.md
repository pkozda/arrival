---
id: adr-006-addendum-e3-1-adapter-infra
title: ADR-006 Addendum — PDE E3.1 Adapter Infrastructure Boundaries
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-30
updated: 2026-08-30
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e1-api-spike
  - personal-discovery-engine-architecture
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E3.1 Adapter Infrastructure Boundaries

**Status:** Accepted (E3.1)  
**Date:** 2026-08-30  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

This addendum records infrastructure boundaries for production adapters. It does not introduce real HTTP, LLM, or database providers.

---

## Decision 1 — Adapter owns HOW (timeout, cancel, retry, rate limit)

**Decision:** Timeout, cancellation (`AbortSignal`), retry policy, and rate limiting are **adapter/infrastructure concerns**. Strategies must not fetch, call HTTP/LLM/DB, implement retries, or know provider quotas.

**Consequence:** `AdapterContext` may carry optional `signal` / `timeoutMs` / metadata. Helpers live under `adapter-infra/`. Pipeline stage order and promotion gates are unchanged.

---

## Decision 2 — Adapter failure ≠ candidate rejection

**Decision:** Introduce adapter-neutral `AdapterFailureCode` / `AdapterFailure` / `AdapterFailureError`. Pipeline decides whether a failure becomes rejection, diagnostic, partial success, or continuation. No new `DiscoveryRunStatus` values.

**Codes:** `TIMEOUT`, `CANCELLED`, `UNAVAILABLE`, `RATE_LIMITED`, `INVALID_RESPONSE`, `NETWORK_ERROR`, `AUTH_REQUIRED`, `POLICY_BLOCKED`, `UNKNOWN`.

---

## Decision 3 — Diagnostics reuse StageDiagnostic

**Decision:** Adapter lifecycle events (`start` / `success` / `failure` / `timeout` / `cancelled`) map into existing `StageDiagnostic` (optional `operation`, `attempt`). No second diagnostics system. Messages must not contain secrets, cookies, or auth headers.

---

## Decision 4 — External content remains untrusted

**Decision:** Fetched content is untrusted input. Adapters preserve real source attribution (`sourceUrl` / `RawContentRef` / Evidence). Empty or fabricated URLs cannot become attributable evidence. Page text must not modify strategy/policy or bypass verification.

---

## Decision 5 — Retry / rate-limit boundaries without implementation creep

**Decision:** Export `RetryPolicy` + `wouldRetry` and `RateLimiter` + in-memory fake. **E3.1 does not implement automatic retry loops** or distributed rate limiting. `NO_RETRY` is the default posture.

---

## Consequences

### Positive

- Real providers (E3.2+) can plug in without changing domain/pipeline semantics
- Cancellation and timeout are distinguishable from success and ordinary errors
- Strategy remains declarative WHAT

### Negative / costs

- Optional fields on `AdapterContext` / requests must be threaded carefully
- Retry loops still deferred — operators must not assume auto-retry yet

### Forbidden

- Real network / LLM / DB dependencies in E3.1
- Provider SDK types in domain public API
- Strategy-owned retries or rate limits
- Treating timeout/cancel as successful empty results

---

## Related

- [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)
- [E1 API spike addendum](./adr-006-addendum-e1-api-spike.md)
- [Discovery README](../discovery/README.md)
