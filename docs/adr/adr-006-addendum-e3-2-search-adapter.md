---
id: adr-006-addendum-e3-2-search-adapter
title: ADR-006 Addendum — PDE E3.2 First Real Search Adapter
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
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E3.2 First Real Search Adapter

**Status:** Accepted (E3.2)  
**Date:** 2026-08-30  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## 1. Selected provider

**Brave Search API** (`GET /res/v1/web/search`).

Factory: `createProductionSearchAdapter` / `createBraveSearchAdapter`.

## 2. Why Brave

Repository inspection found **no** existing search provider config, HTTP client package, or CSE/Bing/SerpAPI wiring (`.env.example` has no search keys).

Brave was chosen as the smallest viable production web search API for E3.2:

- single credential (`X-Subscription-Token`);
- JSON over HTTPS — no vendor SDK;
- works with Node 20+ native `fetch`;
- injectable `HttpTransport` for tests (no real network in CI);
- strategy-agnostic web/site search fits `DiscoveryQuery`.

## 3. Configuration boundary

```ts
ProductionSearchAdapterConfig {
  apiKey: string;       // resolved by composition root — adapter does not read process.env
  baseUrl?: string;
  timeoutMs?: number;
  maxResults?: number;  // capped at Brave max 20
  rateLimiter?: RateLimiter;
  transport?: HttpTransport;
}
```

Suggested env at app root (not read inside domain): `BRAVE_SEARCH_API_KEY`.

## 4. Query mapping

```text
DiscoveryQuery → Brave q / count / country / search_lang
```

- `text` → `q`
- `geography.countryCode` → `country`
- `locale` → `search_lang` (2-letter)
- `intent: site_search` + `constraints.site` → adapter appends `site:` in Brave query string only (not a domain field)

No `googleCseId` / vendor syntax on `DiscoveryQuery`.

## 5. Error mapping

| Condition | Code |
|-----------|------|
| Missing API key / HTTP 401 | `AUTH_REQUIRED` |
| HTTP 403 | `POLICY_BLOCKED` |
| HTTP 429 | `RATE_LIMITED` |
| HTTP 5xx | `UNAVAILABLE` |
| Transport throw | `NETWORK_ERROR` |
| Timeout | `TIMEOUT` |
| AbortSignal | `CANCELLED` |
| Non-JSON / bad shape | `INVALID_RESPONSE` |

Partial query success → `PartialSearchError` (existing pipeline semantics).  
Provider failure ≠ empty successful search.

## 6. Source-trust handling

Mapped hits use `SourceTrust.AGGREGATOR` (`label: brave-search`).

Search result ≠ official employer source. Official verification remains Verify stage / strategy policy.

## 7. Rate-limit behavior

`rateLimiter.acquire('search:brave')` before each provider call. Default: isolated in-memory limiter. No distributed limiting. No auto-retry (E3.1 boundary).

## 8. Provider types outside domain

Brave response types live only inside `adapters/search/brave-search-adapter.ts`. Public API exports factory + config + `HttpTransport` — not Brave SDK/response interfaces. Strategies/pipeline/invariants unchanged.

## 9. Known limitations

- Single provider only
- No automatic pagination beyond `maxResults`
- No provider-side ranking reinterpretation
- Malformed entries skipped with diagnostics via `PartialSearchError` when mixed with valid hits
- Live Brave calls are composition-root / ops concern — unit tests always mock transport

## 10. Deliberately deferred

StepStone/Indeed, employer scrape, real Fetch/Verify/AI adapters, job-specific search adapters, scheduler, notifications, DB, UI (later E3/E4).

---

## Related

- [E3.1 adapter infra](./adr-006-addendum-e3-1-adapter-infra.md)
- [Discovery README](../discovery/README.md)
