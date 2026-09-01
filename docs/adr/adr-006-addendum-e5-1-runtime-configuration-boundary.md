---
id: adr-006-addendum-e5-1-runtime-configuration-boundary
title: ADR-006 Addendum — PDE E5.1 Runtime Configuration Boundary
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-31
updated: 2026-08-31
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e4-7-production-runtime-readiness
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E5.1 Runtime Configuration Boundary

**Status:** Accepted (E5.1)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

E5.1 hardens the **production runtime boundary** for embedding PDE into a real application. It does **not** add discovery semantics, stages, strategies, or new providers.

```text
load config (env map → DiscoveryProductionConfig)
        ↓
validate config (side-effect free)
        ↓
construct SQLite stores (runtime-owned)
        ↓
construct production adapters
        ↓
construct scheduler / queue / worker
        ↓
runtime ready
        ↓
close() → closed (idempotent)
```

Architectural roles remain:

```text
Strategy = what
Pipeline = when
Adapter = how
Runtime = composition / lifecycle
```

---

## Configuration boundary

### Infrastructure (env-loadable)

- Provider credentials and base URLs (`DiscoveryProductionConfig`)
- SQLite database paths
- HTTP timeouts / adapter timeout
- Optional Email (Resend) / Telegram enablement via presence of config blocks
- Injected transport / rateLimiter / rawContentStore (caller-owned when supplied)

### Application / domain (host-supplied; not from `process.env`)

- Strategy registry
- Profile store
- Engine policy
- Notification target resolution (`resolveNotificationTarget`)
- Schedule registration inputs (strategy id/version, profile id, interval)

Environment variables are read **only** by `loadDiscoveryProductionConfig(env)` at the composition boundary. **Adapters never read `process.env`.**

Supported env keys (unchanged from E3/E4):

- `BRAVE_SEARCH_API_KEY` (required)
- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL`, `OPENAI_BASE_URL` (optional)
- `BRAVE_SEARCH_BASE_URL` (optional)
- `RESEND_API_KEY` + `DISCOVERY_EMAIL_FROM` (optional pair → Email enabled)
- `RESEND_BASE_URL` (optional)
- `TELEGRAM_BOT_TOKEN` (optional → Telegram enabled)
- `TELEGRAM_BASE_URL` (optional)

---

## Startup validation

`validateDiscoveryRuntimeConfig` / `assertDiscoveryRuntimeConfig` are deterministic and perform **no network I/O**.

Validated:

- Required Brave + OpenAI credentials
- Optional Email / Telegram credentials when those blocks are present
- Valid http(s) URLs
- Positive timeout values (`*timeoutMs`, `adapterTimeoutMs`)
- Non-empty SQLite paths

Failures throw `DiscoveryConfigurationError` — **not** `PARTIAL_SUCCESS`, pipeline diagnostics, or empty discovery results.

Construction failures after validation (e.g. SQLite open) throw `DiscoveryRuntimeConstructionError` with secrets stripped from messages.

---

## Provider enablement

```ts
providers: {
  search: 'brave';
  ai: 'openai';
  email: boolean;      // production.email present
  telegram: boolean;   // production.telegram present
}
```

Optional notification providers remain independent: email-only, telegram-only, both, or neither. Discovery execution does **not** require Email or Telegram. Providers are **not** constructed when credentials are absent.

---

## Secret redaction

`redactDiscoveryProductionConfig` / `redactDiscoveryRuntimeConfig` never serialize:

- Brave API key
- OpenAI API key
- Resend API key
- Telegram bot token

Ordinary config (provider names, URLs, timeouts, DB paths) is preserved. Runtime exposes `runtime.redactedConfig()` for diagnostics.

---

## Resource ownership

| Resource | Owner |
|----------|--------|
| Runtime-created SQLite Results / Scheduler / Notifications DBs | **Runtime** (`close()`) |
| Injected `HttpTransport` / `RateLimiter` / `RawContentStore` | **Caller** |
| In-memory execution queue | Process-local (discarded; not durable) |

No hidden global singleton. No background timers or cron daemon.

---

## Runtime lifecycle

```text
createDiscoveryRuntime → ready → close() → closed
```

- `close()` is idempotent
- Runtime-owned SQLite closed exactly once
- After close, `scheduler.*`, `worker.*`, and `pipelineExecutor.execute` throw `DiscoveryRuntimeClosedError`
- Host remains pull/trigger driven: `scheduler.triggerDueRuns()` then `worker.processNext()`

---

## Explicit non-goals (E5.1)

E5.1 does **NOT** introduce:

- PostgreSQL
- Durable / distributed queue
- Distributed locking
- Cron daemon / background scheduler loop
- Notification retry system
- Observability platform
- Authentication
- UI
- New discovery strategies

---

## Consequences

- Host apps get a single explicit config + lifecycle boundary before embedding PDE
- Startup misconfiguration is distinguishable from discovery execution failures
- E1–E4 discovery behavior is unchanged
- E5.2+ may add durable queue / ops concerns without revisiting this boundary
