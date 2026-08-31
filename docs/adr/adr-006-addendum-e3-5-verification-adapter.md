---
id: adr-006-addendum-e3-5-verification-adapter
title: ADR-006 Addendum — PDE E3.5 Production Verification Adapter
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-30
updated: 2026-08-30
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e3-4-content-extractor
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E3.5 Production Verification Adapter

**Status:** Accepted (E3.5)  
**Date:** 2026-08-30  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

Implement the first production `VerificationAdapter` as a **policy-driven, deterministic** verifier over stored raw content (optional HTTP for missing bodies).

Factory: `createProductionVerificationAdapter` / `createHttpVerificationAdapter`.

## Responsibilities

- Execute checks declared by `VerificationPolicy.requiredChecks` (+ `official_source` when `requireOfficialSource`)
- Produce attributable `Evidence` for TRUE checks
- Prefer `RawContentStore` content; optional injected `HttpTransport` only when body missing
- Derive status via check outcomes (`deriveVerificationStatus` / pipeline `finalizeVerificationResult`)

## Policy-driven checks

Supported check ids (others → UNKNOWN):

| Check | Behavior |
|-------|----------|
| `official_source` | TRUE only if `source.trust === OFFICIAL` + attributable URL + readable page; AGGREGATOR/COMMUNITY → UNKNOWN (no silent upgrade) |
| `current_page` / `page_exists` | Page body available / closed language / HTTP errors |
| `free_participation` | Explicit free → TRUE; explicit purchase → FALSE; absence → UNKNOWN |
| `purchase_requirement` | Inverse of free language |
| `deadline_valid` | Comparable future deadline → TRUE; past/closed → FALSE; missing → UNKNOWN |
| `salary` / `location` / `employmentType` | TRUE only if extracted value appears in attributable page body |

## Evidence attribution

Evidence requires real `https?://` `sourceUrl` (never fabricated / AI URLs). Statements describe source content only. Pipeline still validates via `finalizeVerificationResult`.

## Official-source semantics

```text
aggregator ≠ official
```

E3.5 does **not** discover employer career sites via search. Insufficient evidence → UNKNOWN rather than PASS.

## Freshness

Uses `FreshnessPolicy.expireWhen` when provided on `VerificationRequest` (wired from strategy). Distinguishes CURRENT / EXPIRED / UNKNOWN. `capturedAt` ≠ publishedAt.

## Rate limit / timeout / errors

- `rateLimiter.acquire('verify:http')` before optional HTTP
- E3.1 `executeWithTimeout` / AbortSignal → `VERIFY_TIMEOUT` / `VERIFY_CANCELLED`
- 401/403/429/5xx/network mapped to adapter-neutral failures; no retries; no secrets in messages

## Why AI / browser are excluded

Verification must remain attributable and deterministic. AI remains E2.4 (after PASS). Browser automation deferred with E3.3.

## Known limitations

- No official-site discovery from aggregators
- No JS-rendered pages / login / CAPTCHA
- No multi-page crawl
- Conservative UNKNOWN preferred over false PASS

## Domain change

Optional `freshnessPolicy` on `VerificationRequest` (passed from Verify stage). No new ports beyond existing `HttpTransport`.

---

## Related

- [E3.4 content extractor](./adr-006-addendum-e3-4-content-extractor.md)
- [Discovery README](../discovery/README.md)
