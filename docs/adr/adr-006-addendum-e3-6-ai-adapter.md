---
id: adr-006-addendum-e3-6-ai-adapter
title: ADR-006 Addendum — PDE E3.6 Production AI Adapter
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-30
updated: 2026-08-30
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e3-5-verification-adapter
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E3.6 Production AI Adapter

**Status:** Accepted (E3.6)  
**Date:** 2026-08-30  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

Implement the first production `AiAdapter` against **OpenAI Chat Completions** (`POST /v1/chat/completions`) with `response_format: json_object`.

Factories: `createProductionAiAdapter` / `createOpenAiAdapter`.

Provider id: `openai` (rate-limit key `ai:openai`).

## Why OpenAI

- Native HTTPS JSON API — same `HttpTransport` pattern as Brave (E3.2) and Fetch (E3.3); no SDK
- Structured JSON responses fit existing `AiEvaluation` / `validateAiEvaluation` (E2.4)
- Composition-root API key (`apiKey` on config); adapter never reads `process.env`
- Single provider only — no multi-provider fallback in E3.6

## HTTP integration

- Reuses `HttpTransport` with `method: 'POST'` and `body`
- Default `baseUrl`: `https://api.openai.com/v1/chat/completions`
- Default model: `gpt-4o-mini` (overridable via config)
- Authorization: `Bearer <apiKey>` header only — never logged into diagnostics or domain objects

## Configuration boundary

```ts
createProductionAiAdapter({
  apiKey,           // required; from composition root
  model?,           // default gpt-4o-mini
  baseUrl?,         // default OpenAI chat completions URL
  transport?,       // injected HttpTransport (tests use mock)
  rateLimiter?,     // E3.1 RateLimiter
  timeoutMs?,       // default / override; request.timeoutMs wins
})
```

Provider-specific request/response shapes stay inside `adapters/ai/http-ai-adapter.ts`.

## Input boundary (unchanged E2.4)

Model receives only:

- identity (canonical URL + fingerprint material)
- verification summary (status/trust/freshness/checks — no mutation path)
- evidence id/type/statement (no source URLs in the trusted evidence list sent for reference)
- criteria
- allowedTasks / rejectOn / knownEvidenceIds
- **untrustedExtractedContent** — extracted page fields with an explicit UNTRUSTED warning

No secrets, run internals, ResultStore, or diagnostics.

## Untrusted-content boundary

Trusted system prompt + structured evaluation input are separated from extracted page text. Page text is nested under `untrustedExtractedContent` and must not override evaluation instructions. E3.6 tests the boundary (prompt-injection-like extracted text); it does not build a general injection detector.

## Output validation

1. Parse OpenAI envelope → JSON `tasks` array (`parseProviderResponse`)
2. Domain validate via existing `validateAiEvaluation` (allowed tasks, enums, confidence 0–1, evidence IDs, forbidden detail keys, rejectOn)

Invalid → `AI_OUTPUT_INVALID` (never a fabricated success). Malformed HTTP JSON / missing content also maps to `AI_OUTPUT_INVALID`.

## Evidence safety

AI may only reference `knownEvidenceIds` from the request. Fabricated IDs fail validation. Adapter does not create Evidence or mutate `VerificationResult`.

## Timeout / cancellation / rate limiting

- E3.1 `executeWithTimeout` + `AbortSignal`
- Timeout → `AI_TIMEOUT`; abort → `AI_CANCELLED`
- `rateLimiter.acquire('ai:openai')` before the HTTP call
- **No automatic retries**

## Error mapping

| Condition | AiAdapter reason |
|-----------|------------------|
| 401 / 403 / 429 / 5xx / network | `AI_ADAPTER_FAILED` (via AdapterFailure codes AUTH_REQUIRED, POLICY_BLOCKED, RATE_LIMITED, UNAVAILABLE, NETWORK_ERROR) |
| timeout | `AI_TIMEOUT` |
| abort | `AI_CANCELLED` |
| malformed / invalid structured output | `AI_OUTPUT_INVALID` |

Messages redact API-key-like substrings.

## Pipeline semantics

E2.4 AI gate unchanged: AI only after verification PASS; engine/strategy disable, budget, and empty tasks skip the adapter; adapter failure → candidate continues without AI.

## Test strategy

Injected `createMockHttpTransport` only — **no real LLM network calls**. Unit coverage for success, invalid output, evidence/forbidden fields, untrusted boundary, timeout/cancel/HTTP failures, rate limiter. Pipeline integration: Verify PASS → production AiAdapter → Score.

## Known limitations

- Single provider (OpenAI); no streaming, tool-calling, or embeddings
- No persistent AI memory / multi-turn conversation
- Model quality depends on OpenAI; validation rejects bad structure but cannot guarantee semantic correctness
- Default model may change over time via config

## Domain changes (additive)

- `AiEvaluationFailure.reasonCode` includes `AI_OUTPUT_INVALID`
- Optional `rejectOn` on `AiEvaluationRequest` for adapter-side validation parity with the gate
- `HttpRequest.body` for POST (shared with fetch transport)

---

## Related

- [E3.5 verification adapter](./adr-006-addendum-e3-5-verification-adapter.md)
- [Discovery README](../discovery/README.md)
