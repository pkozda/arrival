---
id: adr-006-addendum-e4-5-production-email-notifications
title: ADR-006 Addendum — PDE E4.5 Production Email Notifications
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-31
updated: 2026-08-31
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e4-4-notifications
  - adr-006-addendum-e3-7-production-composition
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E4.5 Production Email Notifications

**Status:** Accepted (E4.5)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

Implement the first production `NotificationAdapter` for **transactional email via Resend** (`POST https://api.resend.com/emails`) using the existing `HttpTransport` — no vendor SDK.

Factories:

- `createProductionEmailNotificationAdapter` / `createResendEmailNotificationAdapter`
- `createProductionEmailNotificationAdapterFromConfig` (optional wiring from `DiscoveryProductionConfig`)

Provider id: `resend`  
Rate-limit key: `notification:email:resend` (isolated from search/fetch/verify/ai)

## Why Resend

- Simple HTTPS JSON API — same transport pattern as Brave / OpenAI
- API-key Bearer auth; no SDK required
- Provider request/response types stay inside `adapters/notifications/email/`
- No existing email provider was configured in the repository

## Behind NotificationAdapter

```text
DiscoveryDigest → NotificationPlan → NotificationPayload
        ↓
NotificationAdapter.send (E4.4 contract)
        ↓
renderDiscoveryEmail(payload)  → subject / text / html
        ↓
Resend HTTP POST via HttpTransport
        ↓
NotificationDeliveryResult
```

Email-specific concepts do **not** enter the discovery domain model.

## Configuration boundary

```ts
createProductionEmailNotificationAdapter({
  apiKey,        // required — composition root
  from,          // required verified sender identity
  baseUrl?,      // default https://api.resend.com/emails
  transport?,
  rateLimiter?,
  timeoutMs?,    // default 15s; request.timeoutMs wins
})
```

Env (composition root only):

```text
RESEND_API_KEY
DISCOVERY_EMAIL_FROM
RESEND_BASE_URL   # optional
```

Adapters never read `process.env`.  
`loadDiscoveryProductionConfig` / `validateDiscoveryProductionConfig` / `redactDiscoveryProductionConfig` treat `email` as **optional** — pipeline AdapterPorts do not require it. When either email env var is present, both API key and from are required.

`createProductionDiscoveryAdapters` remains pipeline-only (search/fetch/extract/verify/ai). Notifications are composed separately so the worker/pipeline stay unaware of Resend.

## Rendering boundary

`renderDiscoveryEmail(payload)` consumes **only** `NotificationPayload`:

- deterministic subject from novelty counts (NEW / UPDATED)
- plain-text and HTML from the same payload
- digest ordering preserved
- no ResultStore, candidates, scoring, verification, AI, or network

Current payload items expose `resultId`, rank, novelty, priority — not source URLs. Links are rendered only when a safe `http(s)` URL is already present in payload-derived fields (`safeHttpUrl`).

## Security model

- All dynamic HTML values are escaped (`escapeHtml`)
- Notification content is treated as untrusted
- API keys never appear in failure messages, redacted config, or notification records
- Tests assert XSS/injection escaping and secret redaction

## Timeout / cancellation / rate limiting

Reuses E3.1:

- `executeWithTimeout` + `AbortSignal`
- `RateLimiter` with key `notification:email:resend`
- No automatic retries

## Error mapping

| Provider / infra | NotificationFailureCode |
|------------------|-------------------------|
| invalid recipient / empty payload | `INVALID_REQUEST` |
| HTTP 400/422 | `INVALID_REQUEST` |
| HTTP 401 | `AUTH_REQUIRED` |
| HTTP 403 | `POLICY_BLOCKED` |
| HTTP 408 / timeout | `TIMEOUT` |
| HTTP 429 / rate limiter | `RATE_LIMITED` |
| HTTP 5xx | `UNAVAILABLE` |
| network | `NETWORK_ERROR` |
| abort | `CANCELLED` |
| malformed 2xx | `INVALID_RESPONSE` |

Success requires HTTP 2xx **and** a Resend body containing a non-empty `id`.

## Idempotency remains E4.4

The email adapter only delivers.  
`createDiscoveryNotificationService` owns identity, `already_delivered`, and `PENDING → SENT | FAILED`.

## Notification failure ≠ discovery failure

Preserved from E4.4: provider failure → `NotificationRecord = FAILED`; discovery run stays `SUCCESS` / `PARTIAL_SUCCESS`.

## Deferred

- Automatic retries / provider failover
- Telegram, push, SMS, Slack
- Open/click tracking, templates DB, unsubscribe UI
- AI-generated copy/subjects
- Multiple email providers

## Consequences

- Composition root can swap fake vs Resend adapter without changing worker/pipeline
- E4.6+ can add other channels behind the same `NotificationAdapter` port
