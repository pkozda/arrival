---
id: iam-phase-3-1-boundary-stabilization
title: IAM Phase 3.1 Boundary Stabilization
project: Arrival Atlas
system: Arrival Atlas
type: system
domain: platform
status: active
maturity: stable
owner: system
tags:
  - iam
  - session-auth
  - security-boundary
created: 2026-06-01
updated: 2026-06-19
related:
  - iam-evolution-roadmap
---

# IAM Phase 3.1 — Boundary Stabilization & Route Hardening

**Project:** Arrival Atlas  
**Document Type:** Implementation Plan  
**Domain:** Identity & Access Management (IAM)  
**Status:** Proposed  
**Version:** 0.1  
**Date:** June 2026  

**Baseline:** Phase 3 Authentication Core complete (93/93 API tests passing)  
**Input:** Post-Phase IAM Architecture Audit (findings R1–R13)  
**Prerequisite phases (already shipped):** Phase 1 Account Foundation, Phase 2 Account Claim, Phase 4 Entitlements, Phase 5 Multi-Device Sessions  

**Related documents:**

- [IAM Evolution Roadmap](../platform/iam-evolution-roadmap.md)
- [P6.2 — Identity & Access Architecture Audit](../audits/p6-2-identity-access-architecture-audit.md)

---

## 1. Executive Summary

Phase 3.1 is a **stabilization layer**, not a feature expansion. It converts IAM from a working transitional system into a **defined, auditable boundary** before OAuth and production scaling.

The post-Phase audit concluded that DPSS is structurally sound but IAM exhibits **boundary drift**: unclassified routes, registry writes on the authz read path, dual credential modes with inconsistent semantics, and multiple partial sources of truth for identity fields.

Phase 3.1 addresses the highest-severity audit findings (R1–R4, R7, R10) and establishes contracts that **Phase 4 entitlements already depend on** — ensuring entitlement gating remains deterministic as OAuth is introduced later.

> **Note on phase numbering:** Entitlements (roadmap Phase 4) are already implemented. Phase 3.1 stabilizes the identity/auth boundary **before OAuth (roadmap Phase 3 completion)** and before entitlements logic is extended (billing, tier changes, admin grants).

---

## 2. Fit Assessment — Plan vs Audit vs Codebase

### 2.1 Audit Finding Coverage

| Audit ID | Finding | Phase 3.1 response | Coverage |
|----------|---------|-------------------|----------|
| **R1** | `GET/PATCH /api/sessions/:id` unauthenticated | Reclassify + secure (`token-required` or `session-possession` with credential) | **Full** |
| **R2** | `GET /api/events?sessionId=` leaks without auth | Reclassify as `token-required` | **Full** |
| **R3** | `GET /api/modules/:id/trace` — no registry revocation | Full auth chain + lifecycle split; revocation read in authz | **Full** |
| **R4** | Legacy `x-session-id` bypasses token semantics | Retained temporarily; drift logging + tier enforcement roadmap | **Partial** (deprecation is Phase 3.2+) |
| **R5** | Pre-claim tokens valid after claim | `token.accountId` demoted; `SystemState` is authority; drift log on mismatch | **Partial** (stale anonymous token still allowed by design until re-issue policy) |
| **R6** | `authSubject` triplication | `ResolvedIdentity` as downstream contract; canonical rules documented | **Partial** (Account record still unused — OK for 3.1) |
| **R7** | Registry backfill in `assertActiveSession` | Split read (authz) vs write (lifecycle middleware) | **Full** |
| **R8** | Claim is possession-only | Out of scope (OAuth) | **N/A** |
| **R9** | Default auth secret in code | Out of scope (ops/config) | **N/A** |
| **R10** | 400 vs 401 ambiguity | Error normalization to 401 for missing auth | **Full** (breaking for legacy tests/clients) |
| **R11** | Token TTL without revocation store | Session registry read in authz; token crypto-valid until `exp` | **Unchanged** (acceptable for 3.1) |
| **R12** | Anonymous execute without session bypasses entitlements | Plan classifies execute as `token-required` — **behavior change** | **Full** (intentional policy fix) |
| **R13** | Multi-store non-transactional consistency | Out of scope | **N/A** |

### 2.2 Architectural Alignment

| Principle | Current state | Phase 3.1 target | Aligns? |
|-----------|---------------|------------------|---------|
| DPSS sole write path | ✅ Coordinator only | Unchanged | ✅ |
| Account = identity anchor | `SystemState.accountId` | Explicit in `ResolvedIdentity` contract | ✅ |
| Session = device runtime | `sessionId` keys DPSS | Unchanged | ✅ |
| Token = credential | HMAC bearer + legacy header | Token demoted to credential only; state is authority | ✅ |
| Entitlements unchanged | Gated by `accountId` | Authz reads `request.identity.accountId` only | ✅ |
| Read/write separation | Registry writes in authz | Lifecycle middleware owns writes | ✅ |

### 2.3 Adjustments Required vs Draft Plan

The draft plan is **architecturally sound** but needs these corrections when implemented against the current codebase:

1. **`buildResolvedIdentity` must be async** — `systemStateCoordinator.getState()` is async; the draft pseudocode uses synchronous `loadSystemState`.

2. **Route map is incomplete** — the draft lists ~10 routes; the API currently exposes **22 route patterns** (see §6.3). Unclassified route enforcement requires full inventory.

3. **`POST /api/sessions` tier** — should be `public` (creates identity), not `session-possession` (no prior session required).

4. **`POST /api/account/claim` tier** — not `account-scoped` (account does not exist yet). Correct tier: `token-required` or new tier `session-authenticated` (valid credential + existing session; `accountId` may be null).

5. **`POST /api/modules/:id/execute`** — reclassifying as strict `token-required` **removes anonymous ephemeral execute** (currently allowed and tested). This is a deliberate policy change (fixes R12); document and update tests.

6. **`IdentitySource: 'session'`** — reserved for future server-initiated or internal resolution; today only `token` and `legacy` are produced. Avoid a third live path until needed.

7. **Revocation check stays in authz (read-only)** — `session-lifecycle` middleware writes `lastSeen`; authz **reads** registry status and returns 403 if revoked. Do not move revocation checks to lifecycle.

8. **Fastify route keys** — enforcement must normalize `req.routeOptions.url` or registered path templates (`/api/sessions/:id`), not raw URLs with substituted IDs.

---

## 3. Objective

Phase 3.1 enforces:

- **Single identity resolution contract** (`ResolvedIdentity`)
- **Strict route security classification** with dev/test hard-fail on unclassified routes
- **Removal of IAM side effects from auth/authz read path**
- **Elimination of token/session semantic ambiguity** (`token.accountId` informational only)
- **Closure of unauthenticated route surface** (audit R1–R4)

---

## 4. Scope

### 4.1 In Scope

| Layer | Work |
|-------|------|
| **Identity** | `ResolvedIdentity` type + `buildResolvedIdentity()` |
| **Middleware** | Split auth (read) / authz (read) / session-lifecycle (write) |
| **Routing** | `RouteSecurityTier` + `RouteSecurityMap` + runtime enforcement |
| **Session registry** | Read/write service split |
| **Token semantics** | `token.accountId` demoted; drift detection only |
| **Observability** | `IAMEventType` structured drift logging |
| **Errors** | Normalize missing auth to 401 |

### 4.2 Out of Scope

- OAuth / external IdP integration
- RBAC / roles
- Database migration
- Entitlement logic changes (tier rules, module lists, billing)
- Frontend changes beyond header compatibility
- Legacy header removal (logged in 3.1; deprecated in 3.2+)
- Token revocation store / `jti` blocklist
- Transactional consistency across file stores (R13)

---

## 5. Target Architecture (After Phase 3.1)

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ auth.middleware (READ ONLY)                                  │
│   buildAuthContext() → buildResolvedIdentity()               │
│   • verify token OR resolve legacy session                   │
│   • load SystemState → accountId (authority)                 │
│   • token.accountId drift check → 403 + IAM_DRIFT log        │
│   • attach request.identity                                  │
│   NO registry writes                                         │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ enforceRouteSecurity() (READ ONLY)                           │
│   • lookup RouteSecurityMap[method + routeTemplate]          │
│   • UNCLASSIFIED → hard fail (dev/test) + IAM event          │
│   • tier validation vs request.identity                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ authz.middleware (READ ONLY)                                 │
│   • validateAccountAccess (x-account-id scoping)             │
│   • read registry: if accountId → status must be 'active'    │
│   • attach request.accountContext (compat shim → identity)   │
│   NO registerSession / NO lastSeen writes                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ session-lifecycle.middleware (WRITE ONLY)                    │
│   • only on protected routes after auth + authz success      │
│   • if accountId: ensureSessionRegistered + updateLastSeen     │
│   • emit registry events                                     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Route handler                                                │
│   • entitlementService (Phase 4 — unchanged logic)           │
│   • systemStateCoordinator.applyMutation({ actor })          │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Core Deliverables

### 6.1 Resolved Identity Contract

**File:** `apps/api/src/auth/resolved-identity.ts`

```typescript
export type IdentitySource = 'token' | 'legacy';

export type ResolvedIdentity = {
  sessionId: string;
  accountId: string | null;
  authSubject: string | null;
  source: IdentitySource;
  verified: boolean;
};
```

**File:** `apps/api/src/auth/build-resolved-identity.ts`

```typescript
export async function buildResolvedIdentity(
  authContext: AuthContext,
  state: SystemState | null
): Promise<ResolvedIdentity>;
```

**Resolution rules:**

| Field | Authority |
|-------|-----------|
| `sessionId` | Credential (token payload or legacy header), confirmed against `state.session.id` |
| `accountId` | **`SystemState.accountId` only** — never token payload |
| `authSubject` | Token payload when `source === 'token'`; `null` for legacy (logged as `AUTH_SUBJECT_NULL` if account claimed) |
| `verified` | `true` iff state exists and `state.session.id === sessionId` |
| `source` | `'token'` if Bearer/cookie; `'legacy'` if `x-session-id` fallback |

**Hard rule:** Downstream code MUST use `request.identity` only. No `request.auth`, no raw headers, no `authTokenService.verifyToken()` outside auth layer.

`request.accountContext` may remain as a **deprecated compat shim** mapping from `ResolvedIdentity` during migration; remove in Phase 3.2.

---

### 6.2 Middleware Refactor

#### 6.2.1 `auth.middleware.ts` (reformed)

| Before | After |
|--------|-------|
| Sets `request.auth` | Sets `request.identity` via `buildResolvedIdentity` |
| Token `accountId` used for mismatch when non-null | Drift detection only; `SystemState.accountId` is authority |
| 400 on missing credential | **401** on missing credential (tier permitting) |

**Prohibited:** registry writes, `lastSeen`, session registration.

#### 6.2.2 `authz.middleware.ts` (read-only)

Responsibilities:

- Route tier validation (or delegate to `enforceRouteSecurity`)
- `validateAccountAccess(identity, x-account-id)`
- **Read** registry: if `identity.accountId !== null` → `getSessionRecord()`; if `status === 'revoked'` → 403

**Prohibited:** `registerSession`, `updateLastSeen`, event append.

Replace `assertActiveSession()` with `getSessionRecord()` + explicit 403. Auto-backfill moves to lifecycle middleware only.

#### 6.2.3 `session-lifecycle.middleware.ts` (new, write-only)

Runs **after** auth + authz success on protected routes.

```typescript
// apps/api/src/sessions/session-lifecycle.service.ts
export async function ensureSessionRegistered(
  accountId: string,
  sessionId: string,
  metadata?: SessionRegistrationMetadata
): Promise<AccountSession>;

export async function touchSessionLastSeen(
  sessionId: string,
  accountId: string
): Promise<void>;
```

Trigger: `identity.accountId !== null` and registry read in authz did not find record OR found active record (update `lastSeen`).

Emit `IAMEventType.REGISTRY_BACKFILL` when registration occurs on first protected access.

---

### 6.3 Route Security Classification

**File:** `apps/api/src/routing/route-security.ts`

```typescript
export type RouteSecurityTier =
  | 'public'                  // no credential
  | 'anonymous-create'        // creates session (POST /api/sessions)
  | 'credential-optional'     // auth enforced only if credential present (deprecated; remove in 3.2)
  | 'credential-required'     // token OR legacy header; verified session
  | 'account-required';       // credential + identity.accountId !== null
```

> **Naming note:** Draft used `token-required` and `session-possession`. Implementation uses `credential-required` because legacy `x-session-id` remains supported in 3.1. Tier name reflects *verified session*, not token-only.

#### Complete Route Map (current API surface)

| Route | Tier | Notes |
|-------|------|-------|
| `GET /health` | `public` | |
| `GET /api/modules` | `public` | Module catalog |
| `GET /api/modules/:id` | `public` | Module metadata |
| `GET /api/i18n/languages` | `public` | |
| `GET /api/i18n/:lang` | `public` | |
| `POST /api/sessions` | `anonymous-create` | Issues token; no prior auth |
| `GET /api/sessions/:id` | `credential-required` | **R1 fix** |
| `PATCH /api/sessions/:id` | `credential-required` | **R1 fix** |
| `GET /api/events` | `credential-required` | **R2 fix** — requires `sessionId` query + credential |
| `GET /api/modules/:id/trace` | `credential-required` | **R3 fix** — add authz + lifecycle |
| `POST /api/modules/:id/execute` | `credential-required` | **R12 fix** — removes anonymous ephemeral path |
| `GET /api/ui-snapshot` | `credential-required` | |
| `POST /api/profile` | `credential-required` | |
| `GET /api/profile` | `credential-required` | |
| `PATCH /api/profile` | `credential-required` | |
| `GET /api/profile/revisions` | `credential-required` | |
| `POST /api/account/claim` | `credential-required` | Session exists; accountId may be null |
| `GET /api/accounts/:id/sessions` | `account-required` | |
| `POST /api/accounts/:id/sessions` | `account-required` | |
| `POST /api/accounts/:id/sessions/revoke-all` | `account-required` | |
| `POST /api/sessions/:id/revoke` | `account-required` | Caller must own account |

**File:** `apps/api/src/routing/enforce-route-security.ts`

```typescript
export function enforceRouteSecurity(
  request: FastifyRequest,
  identity: ResolvedIdentity | undefined
): void;
```

**Hard rule:** In `NODE_ENV=test` and `ARRIVAL_ATLAS_IAM_STRICT=true` (dev), unclassified routes throw `UNCLASSIFIED_ROUTE` and fail the request. Emit `IAMEventType.ROUTE_UNCLASSIFIED`.

Route registration in `build-app.ts` should attach tier metadata at definition time to avoid path normalization bugs.

---

### 6.4 Token Semantics Fix

| | Before (Phase 3) | After (Phase 3.1) |
|---|------------------|-------------------|
| `token.accountId` | Partial validation authority | **Informational snapshot only** |
| `SystemState.accountId` | Primary for entitlements | **Sole authority** for ownership + entitlements |
| Mismatch handling | 403 when token.accountId ≠ null and ≠ state | 403 + `IAMEventType.TOKEN_MISMATCH` |
| Pre-claim token after claim | Allowed (token.accountId null) | Still allowed; new token issued on claim — log `LEGACY_USED` / drift if stale token used |

```typescript
// auth layer only — drift detection, not ownership
if (
  tokenPayload.accountId !== null &&
  tokenPayload.accountId !== state.accountId
) {
  emitIAMEvent(IAMEventType.TOKEN_MISMATCH, { sessionId, tokenAccountId, stateAccountId });
  return 403;
}
```

---

### 6.5 Error Normalization

| Case | HTTP | Body |
|------|------|------|
| Missing credential (protected route) | **401** | `{ error: 'Authentication required' }` |
| Invalid / tampered token | **401** | `{ error: 'Invalid authentication token' }` |
| Expired token | **401** | `{ error: 'Invalid authentication token' }` |
| Session not found | **404** | `{ error: 'Session not found' }` |
| Revoked session | **403** | `{ error: 'Session revoked' }` |
| Account mismatch / forbidden | **403** | `{ error: 'Account access forbidden' }` |
| Unclassified route (strict mode) | **500** | `{ error: 'Route security misconfiguration' }` |

**Migration impact:** Existing tests expecting `400` + `'X-Session-Id header is required'` must be updated. Frontend should treat 401 uniformly as unauthenticated.

---

### 6.6 IAM Drift Observability

**File:** `apps/api/src/observability/iam-events.ts`

```typescript
export enum IAMEventType {
  TOKEN_MISMATCH = 'token_mismatch',
  LEGACY_USED = 'legacy_used',
  REGISTRY_BACKFILL = 'registry_backfill',
  AUTH_SUBJECT_NULL = 'auth_subject_null',
  ROUTE_UNCLASSIFIED = 'route_unclassified',
}
```

| Event | When |
|-------|------|
| `TOKEN_MISMATCH` | Token `accountId` ≠ `SystemState.accountId` |
| `LEGACY_USED` | Request authenticated via `x-session-id` |
| `REGISTRY_BACKFILL` | Lifecycle middleware registers missing session |
| `AUTH_SUBJECT_NULL` | Claimed account accessed with legacy credential |
| `ROUTE_UNCLASSIFIED` | Route missing from `RouteSecurityMap` in strict mode |

Initial implementation: structured `request.log.warn({ iamEvent, ... })`. External sink (Datadog, etc.) is out of scope.

---

## 7. Migration Strategy

| Step | Mode | Actions |
|------|------|---------|
| **1 — Shadow** | Safe | Introduce `ResolvedIdentity`; populate alongside `request.auth`; log deltas |
| **2 — Registry split** | Safe | Extract lifecycle service; dual-path (old `assertActiveSession` delegates to read + write) |
| **3 — Route audit** | Dev | Enable `ARRIVAL_ATLAS_IAM_STRICT`; log/fix unclassified routes |
| **4 — Enforcement** | Test | Full middleware chain; update tests; 401 normalization |
| **5 — Harden** | Prod | Enable strict classification; monitor `IAMEventType` rates |

Recommended flag:

```
ARRIVAL_ATLAS_IAM_STRICT=true   # dev/test: unclassified routes fail
ARRIVAL_ATLAS_IAM_STRICT=false  # prod: log only until confidence (short window)
```

---

## 8. Acceptance Criteria (Strict)

Phase 3.1 is complete **only if:**

### Identity

- [ ] All downstream handlers use `request.identity` (`ResolvedIdentity`)
- [ ] No `authTokenService.verifyToken()` outside `apps/api/src/auth/`
- [ ] `accountId` in handlers always sourced from `identity.accountId` (SystemState-backed)

### Middleware

- [ ] `auth.middleware` and `authz.middleware` contain **zero** registry or session store writes
- [ ] Registry writes isolated in `session-lifecycle.middleware` + `session-lifecycle.service`
- [ ] `assertActiveSession` auto-register path removed from authz

### Routing

- [ ] 100% of registered API routes classified in `RouteSecurityMap`
- [ ] Unclassified route → hard fail when `ARRIVAL_ATLAS_IAM_STRICT=true`
- [ ] Route tier attached at registration time (not inferred from raw URL)

### Security fixes (R1–R4)

- [ ] `GET/PATCH /api/sessions/:id` require verified credential
- [ ] `GET /api/events` requires credential matching `sessionId` query
- [ ] `GET /api/modules/:id/trace` uses full chain including registry revocation read
- [ ] Legacy path usage emits `LEGACY_USED` (deprecation signal)

### Token semantics

- [ ] `token.accountId` not used for entitlement or ownership decisions
- [ ] Drift mismatch emits `TOKEN_MISMATCH` and returns 403

### Drift observability

- [ ] IAM events emitted for legacy auth, token mismatch, registry backfill, unclassified routes

### Regression

- [ ] All existing tests updated and passing (expect 401 migration, execute behavior change)
- [ ] DPSS coordinator behavior unchanged
- [ ] Entitlement rules unchanged

---

## 9. Test Plan

| Area | Tests to add/update |
|------|---------------------|
| `buildResolvedIdentity` | token vs legacy; state missing; accountId from state not token |
| Route enforcement | each tier; unclassified route fails in strict mode |
| R1 | sessions/:id without credential → 401 |
| R2 | events without credential → 401 |
| R3 | trace on revoked session → 403 |
| Registry split | authz does not write; lifecycle writes on first access |
| Token drift | mismatched token.accountId → 403 + event |
| Error codes | missing auth → 401 (not 400) |
| Execute | anonymous without credential → 401 (policy change) |

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking web client (401 vs 400) | Coordinate frontend; legacy header still works |
| Anonymous execute removal | Document; optional `credential-optional` tier only if product rejects R12 fix |
| Fastify route key mismatch | Register tier in route `config` at definition |
| Dual middleware during migration | Shadow mode step 1; feature flag |
| Increased latency (extra registry read + lifecycle write) | Acceptable; writes moved off hot read path in authz |

---

## 11. Outcome

After Phase 3.1, IAM becomes:

| Property | State |
|----------|-------|
| Identity resolution | **Deterministic** — single contract, single authority |
| Layering | **Strict** — read vs write separated |
| Route surface | **Fully classified and auditable** |
| Entitlements input | **Stable** — `identity.accountId` always from SystemState |
| OAuth readiness | **Improved** — external subject can slot into `authSubject` without route drift |

Phase 3.1 does not add user-visible features. It converts IAM from a **working system** into a **defined system** — reducing the risk that OAuth, billing, and multi-device scaling amplify existing boundary ambiguity.

---

## 12. Document History

| Version | Date | Change |
|---------|------|--------|
| 0.1 | June 2026 | Initial plan — aligned with post-Phase IAM audit and current API surface |
