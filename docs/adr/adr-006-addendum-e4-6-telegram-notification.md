---
id: adr-006-addendum-e4-6-telegram-notification
title: ADR-006 Addendum — PDE E4.6 Telegram Notification Adapter
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
  - adr-006-addendum-e4-5-production-email-notifications
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E4.6 Telegram Notification Adapter

**Status:** Accepted (E4.6)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

Implement a production `NotificationAdapter` for **Telegram Bot API** `sendMessage` using the existing `HttpTransport` — no Telegram SDK.

Factories:

- `createProductionTelegramNotificationAdapter` / `createTelegramNotificationAdapter`
- `createProductionTelegramNotificationAdapterFromConfig` (returns `null` when unset)

Provider id: `telegram`  
Rate-limit key: `notification:telegram`

## Bot API endpoint

```text
POST ${baseUrl}/bot<TOKEN>/sendMessage
```

Default `baseUrl`: `https://api.telegram.org`

Request body (provider-private):

```json
{
  "chat_id": "<recipient.address>",
  "text": "<rendered plain text>",
  "disable_web_page_preview": true
}
```

Success requires HTTP 2xx **and** envelope `{ "ok": true, "result": ... }`.  
`{ "ok": false, ... }` is never treated as successful delivery.

## Configuration boundary

```ts
telegram?: {
  botToken: string;
  baseUrl?: string;
  timeoutMs?: number;
}
```

Env (composition root only):

```text
TELEGRAM_BOT_TOKEN=
TELEGRAM_BASE_URL=   # optional
```

Adapters never read `process.env`.  
Telegram is **optional** — pipeline `createProductionDiscoveryAdapters` remains unaware. Wire at composition root with `createDiscoveryNotificationService`.

## Recipient mapping

No domain model change.

| Domain field | Telegram |
|--------------|----------|
| `recipient.address` | `chat_id` (numeric id, including negative group ids, or `@username`) |
| `recipient.userId` | Arrival Atlas user id (unchanged; not sent to Telegram) |
| `channel` | must be `TELEGRAM` |

Invalid / missing address → `INVALID_REQUEST` (no network call).

## Rendering

`renderDiscoveryTelegram(payload)`:

- **Plain text only** (no Markdown/HTML parse mode — avoids injection)
- Digest item order preserved
- Control characters stripped from dynamic fields
- No fabricated URLs; no ResultStore / scoring / eligibility

## Message size policy

Telegram limit: **4096** characters (`TELEGRAM_MAX_MESSAGE_LENGTH`).

If over limit: truncate deterministically (prefer line boundary) and append `\n…[truncated]`.  
Do **not** split into multiple messages (notification contract is single delivery).

## Failure mapping

| Condition | NotificationFailureCode |
|-----------|-------------------------|
| wrong channel / bad chat id / empty items | `INVALID_REQUEST` |
| HTTP 400/422 | `INVALID_REQUEST` |
| HTTP 401 | `AUTH_REQUIRED` |
| HTTP 403 | `POLICY_BLOCKED` |
| HTTP 429 / rate limiter | `RATE_LIMITED` |
| HTTP 5xx | `UNAVAILABLE` |
| network | `NETWORK_ERROR` |
| timeout | `TIMEOUT` |
| cancel | `CANCELLED` |
| malformed / ok:false | `INVALID_RESPONSE` |

Bot tokens are stripped from failure messages and redacted in config views.

## Timeout / cancellation / rate limiting

Reuses E3.1 `executeWithTimeout`, `AbortSignal`, and `RateLimiter`.  
No automatic retries.

## Idempotency

Owned exclusively by E4.4 `createDiscoveryNotificationService`.  
Telegram adapter only delivers.

## Notification failure ≠ discovery failure

Unchanged from E4.4/E4.5.

## Deferred

- Multi-message splitting
- Inline keyboards / rich media
- Telegram MarkdownV2 / HTML parse modes
- Automatic retries
- Push / other channels beyond email + Telegram

## Consequences

Composition root can choose Email, Telegram, or fake adapters without changing worker/pipeline/Digest semantics.
