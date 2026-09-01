---
id: adr-006-addendum-e6-3-http-authn-authz
title: ADR-006 Addendum — PDE E6.3 HTTP Admin Authentication & Authorization
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-31
updated: 2026-08-31
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e6-2-http-admin-api-boundary
  - adr-006-addendum-e5-1-runtime-configuration-boundary
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E6.3 HTTP Admin Authentication & Authorization

**Status:** Accepted (E6.3)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

E6.3 adds a **provider-neutral authentication and authorization boundary** to the E6.2 HTTP admin adapter only.

```text
HTTP request
  → request-id
  → route policy
  → authenticate (Bearer)
  → authorize (permission)
  → validate / handler
  → DiscoveryService
```

Auth is **not** part of `DiscoveryService`, `DiscoveryRuntime`, or discovery domain types. Programmatic service use remains unauthenticated.

---

## Authentication

Port: `DiscoveryAuthenticator.authenticate({ authorizationHeader })`.

Supported scheme: `Authorization: Bearer <token>` only.

Test/prod-simple implementation: `createStaticTokenAuthenticator` (timing-safe compare; fail closed on malformed headers).

Missing/invalid/malformed credentials → **401** + `WWW-Authenticate: Bearer` with generic message (no distinction).

---

## Authorization

Permissions:

- `discovery:read`
- `discovery:run`
- `discovery:schedule:write`
- `discovery:worker:process`

| Endpoint | Access |
|----------|--------|
| `GET /health` | **public** |
| `GET /status`, `GET /schedules`, `GET /runs/:id` | `discovery:read` |
| `POST /schedules`, enable/disable | `discovery:schedule:write` |
| `POST /schedules/:id/run` | `discovery:run` |
| `POST /worker/process-next` | `discovery:worker:process` |

Authenticated but lacking permission → **403 Forbidden** (generic).

---

## Configuration

Composition-root env map (handlers never read `process.env`):

- `DISCOVERY_ADMIN_TOKEN` — bearer mode (min 16 chars)
- `DISCOVERY_ADMIN_AUTH_MODE=unauthenticated` — **explicit** open mode for local/tests only

Secure default for production HTTP composition: token required unless open mode is explicit.

`createDiscoveryHttpHandler` requires either:

- `authenticator`, or
- `allowUnauthenticated: true` (explicit; cannot be confused with production)

Token values are never exposed via `/status`, redacted auth config, errors, or telemetry.

---

## Non-goals

OAuth/OIDC, Keycloak/Auth0/Cognito, passwords, sessions, JWT libraries, user DB, UI login, rate limiting, Redis/Postgres auth stores.

---

## Consequences

### Positive

- Protected admin mutations cannot run anonymously when authenticator is wired
- Domain/runtime remain transport-independent

### Compatibility

- E6.2 tests/hosts must pass `allowUnauthenticated: true` or supply an authenticator
