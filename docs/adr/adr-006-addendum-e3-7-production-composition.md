---
id: adr-006-addendum-e3-7-production-composition
title: ADR-006 Addendum — PDE E3.7 Production Adapter Composition
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-30
updated: 2026-08-30
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e3-6-ai-adapter
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E3.7 Production Adapter Composition

**Status:** Accepted (E3.7)  
**Date:** 2026-08-30  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

Add an explicit infrastructure-only composition boundary that wires the five production adapters into `AdapterPorts`:

```text
createProductionDiscoveryAdapters(config)
  → search  (Brave)
  → fetch   (HTTP)
  → extract (HTML ContentExtractor)
  → verify  (HTTP Verification)
  → ai      (OpenAI)
```

Factories reuse existing E3.2–E3.6 constructors. No provider logic is duplicated. No domain/business logic is introduced.

## Configuration boundary

Typed `DiscoveryProductionConfig` carries credentials and optional timeouts/limits.

**Provider adapters remain environment-agnostic.** Runtime configuration is resolved at the composition boundary and injected into adapters.

`loadDiscoveryProductionConfig(env, options?)` may read:

| Variable | Purpose |
|----------|---------|
| `BRAVE_SEARCH_API_KEY` | required |
| `OPENAI_API_KEY` | required |
| `OPENAI_MODEL` | optional |
| `BRAVE_SEARCH_BASE_URL` | optional |
| `OPENAI_BASE_URL` | optional |

Missing required credentials fail explicitly. Partial “production” configs are not constructed silently.

`validateDiscoveryProductionConfig` checks infrastructure shape only (keys present, URLs, positive timeouts/bytes). No network. No live credential probes. No domain criteria.

## Shared infrastructure

- One shared `HttpTransport` (injected or default fetch transport)
- One shared `RawContentStore` (injected or process-local in-memory)
- One shared `RateLimiter` (injected or process-local in-memory)

Construction performs **no network I/O**.

## Rate-limit isolation

A shared limiter instance is allowed. Keys remain provider-isolated:

```text
search:brave
fetch:http
verify:http
ai:openai
```

Default in-memory limiter is **process-local**, not durable, not distributed. Redis/DB rate limiting is out of scope for E3.7.

## Timeout / cancellation

Pipeline `signal` / `timeoutMs` continue to flow through existing adapter request contexts into E3.1 `executeWithTimeout` / `AbortSignal`. Composition does not add a second cancellation mechanism and does not convert CANCELLED/TIMEOUT into empty success.

## Secret handling

- API keys never appear in `redactDiscoveryProductionConfig`
- Adapters continue E3.1 redaction conventions for failures/diagnostics
- Composition does not serialize secrets into diagnostics

## Non-goals (E3.7)

- Scheduler, persistence backend, database, UI
- Second search/AI provider, automatic retries, distributed rate limiting
- Browser automation, observability platform, token billing
- Changes to pipeline stage order or domain semantics

## Related

- [E3.6 AI adapter](./adr-006-addendum-e3-6-ai-adapter.md)
- [Discovery README](../discovery/README.md)
