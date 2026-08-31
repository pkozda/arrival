---
id: adr-006-addendum-e3-8-production-smoke-hardening
title: ADR-006 Addendum — PDE E3.8 Production Smoke & Contract Hardening
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-30
updated: 2026-08-30
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e3-7-production-composition
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E3.8 Production Smoke & Contract Hardening

**Status:** Accepted (E3.8)  
**Date:** 2026-08-30  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

E3.8 is the **final E3 readiness gate**. It adds deterministic production-composition smoke coverage and contract hardening. It does **not** add providers, stages, scheduler, database, or real persistence.

## Smoke architecture

```text
createProductionDiscoveryAdapters(config)
        ↓  (injected HttpTransport + in-memory stores)
executeDiscoveryPipeline(...)
        ↓
ResolveStrategy → … → Digest
```

All five production adapters (Brave, HTTP Fetch, HTML Extract, HTTP Verify, OpenAI) participate. Fakes are allowed only at infrastructure boundaries (transport, rate limiter, in-memory ResultStore / RawContentStore).

**No real network / LLM / DB** in the automated suite. A strict smoke transport throws `UNEXPECTED_NETWORK_REQUEST` for unregistered calls.

Real external credentials and live provider execution remain intentionally outside CI.

## Brave trust vs promotion

Production Brave Search tags every hit as `AGGREGATOR` (search engine ≠ official employer). Default Job strategy requires `official_source` with `allowUnknown: false`, so live Brave hits correctly do **not** auto-promote.

E3.8 happy-path smoke therefore uses the real Job strategy module with a **smoke-only verificationPolicy** requiring `current_page` (not inventing OFFICIAL trust). A separate hardening test confirms default Job verification never promotes AGGREGATOR→OFFICIAL from page text alone.

## Coverage

| Path | Expectation |
|------|-------------|
| Happy path | SUCCESS → PROMOTED → Result → Digest |
| AI failure | PARTIAL_SUCCESS; no fake AI success; score/persist may continue |
| Fatal search | Explicit failure diagnostic; zero fabricated candidates |
| Cancel | AbortSignal → ADAPTER_CANCELLED semantics; no fake Result |
| Timeout | ADAPTER_TIMEOUT; single attempt; no retry |

## Configuration / secrets

Production configuration remains outside adapters (`loadDiscoveryProductionConfig` / `validateDiscoveryProductionConfig` / `redactDiscoveryProductionConfig`). API keys must not appear in diagnostics, errors, or redacted config.

## E3 completeness

E3 production adapters + composition are complete and deterministic-testable. E3 does **not** include:

- scheduler
- database / durable ResultStore
- queues / UI / browser automation
- observability platform

## Related

- [E3.7 production composition](./adr-006-addendum-e3-7-production-composition.md)
- [Discovery README](../discovery/README.md)
