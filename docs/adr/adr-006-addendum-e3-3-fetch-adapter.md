---
id: adr-006-addendum-e3-3-fetch-adapter
title: ADR-006 Addendum — PDE E3.3 Production Fetch Adapter
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-30
updated: 2026-08-30
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e3-1-adapter-infra
  - adr-006-addendum-e3-2-search-adapter
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E3.3 Production Fetch Adapter

**Status:** Accepted (E3.3)  
**Date:** 2026-08-30  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

Implement the first production `FetchAdapter` as ordinary HTTP(S) GET via injectable `HttpTransport`, storing successful bodies in the existing `RawContentStore` and returning `RawContentRef` only.

Factory: `createProductionFetchAdapter` / `createHttpFetchAdapter`.

## Why ordinary HTTP is enough for MVP

MVP Collect needs page/document bodies for later Parse. Most employer and listing pages are reachable over HTTPS without executing JavaScript. Ordinary fetch keeps the adapter small, testable, and free of browser automation dependencies.

## Why browser automation is deferred

Playwright/Puppeteer, CAPTCHA solving, proxy rotation, and anti-bot bypass are explicitly out of scope. They couple the engine to scraping stacks, increase cost/fragility, and are not required to prove Collect → Parse with real HTTP retrieval.

## Response limits

| Limit | Default |
|-------|---------|
| `maxResponseBytes` | 1_500_000 (~1.5 MiB) |
| Allowed content types | `text/html`, `application/xhtml+xml`, `text/plain` |
| Redirect hops | 5 (bounded; never unlimited) |

Oversized or unsupported types → `INVALID_RESPONSE` (never silent store of arbitrary binary). Response bodies never appear in diagnostics.

## Timeout / cancellation

Reuse E3.1 `executeWithTimeout` + `AbortSignal`. Mapped to FetchResult:

- `FETCH_TIMEOUT` / failureCode `TIMEOUT`
- `FETCH_CANCELLED` / failureCode `CANCELLED`

Never treated as empty successful content. No automatic retries.

## Rate limiting

`rateLimiter.acquire('fetch:http')` before each external GET. Default isolated in-memory limiter.

## Error mapping

| Condition | failureCode | FetchResult.reasonCode |
|-----------|-------------|------------------------|
| 401 | AUTH_REQUIRED | FETCH_FAILED |
| 403 / non-http scheme | POLICY_BLOCKED | FETCH_FAILED |
| 408 / timeout | TIMEOUT | FETCH_TIMEOUT |
| 429 | RATE_LIMITED | FETCH_FAILED |
| 5xx | UNAVAILABLE | FETCH_FAILED |
| other 4xx / bad type / oversized / invalid URL | INVALID_RESPONSE | FETCH_FAILED |
| transport throw | NETWORK_ERROR | FETCH_FAILED |
| abort | CANCELLED | FETCH_CANCELLED |

## Untrusted content

Fetched HTML/text is untrusted input. Adapter does not execute scripts, create Evidence, verify, upgrade SourceTrust, or modify strategy/engine policy. Extraction remains Parse.

## RawContentStore

Successful body → `store.put(ref, { body, contentType })` with `ref = raw:<sha256>`, `contentHash`, `sourceUrl`, `capturedAt` on `RawContentRef`. Candidate keeps the reference only.

## Known limitations / deferred

- No JS-rendered SPA support
- No cookie jars / authenticated sessions
- No automatic retry
- No CDN/cache layer
- Real ContentExtractor / Verify / AI remain later E3 tasks

---

## Related

- [E3.1 adapter infra](./adr-006-addendum-e3-1-adapter-infra.md)
- [E3.2 search adapter](./adr-006-addendum-e3-2-search-adapter.md)
- [Discovery README](../discovery/README.md)
