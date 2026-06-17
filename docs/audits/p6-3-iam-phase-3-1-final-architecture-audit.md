# P6.3 — IAM Phase 3.1 Final Architecture Audit

**Project:** Arrival Atlas (ArrivalOS)  
**Document Type:** Architecture Audit Report  
**Domain:** Identity & Access Management (IAM)  
**Status:** Final Audit  
**Version:** 1.0  
**Date:** June 2026  

**Baseline:** IAM Phase 3.1 implementation (Steps 1–7), 135/135 API tests passing  
**Reference documents:**

- [IAM Phase 3.1 — Boundary Stabilization & Route Hardening](../architecture/iam-phase-3-1-boundary-stabilization.md)
- [IAM Evolution Roadmap](../architecture/iam-evolution-roadmap.md)
- [P6.2 — Identity & Access Architecture Audit](./p6-2-identity-access-architecture-audit.md)

**Scope:** Read-only audit of `apps/api` IAM implementation. No code changes performed.

---

## 1. Executive Summary

IAM Phase 3.1 has successfully converted the API from a **transitional middleware model** into a **unified, route-classified security pipeline**. The core architectural goals — `ResolvedIdentity`, `RouteSecurityMap` as contract, registry read/write separation, token semantics demotion, route hardening (R1/R2/R3/R10/R12), and IAM observability — are **substantially implemented and tested**.

However, this audit finds **material gaps against the strict acceptance criteria** in the Phase 3.1 plan (§8), primarily:

1. **Handler contract drift** — downstream routes still read `request.accountContext` and `request.auth` instead of `request.identity` exclusively.
2. **Operational guardrails not wired** — `ARRIVALOS_IAM_STRICT` and `ROUTE_UNCLASSIFIED` telemetry are defined but not implemented.
3. **Web client incompatibility** — the Next.js client (`apps/web`) has flows that violate hardened route policy and will fail at runtime against the current API.
4. **Structural deviation from plan** — middleware was consolidated into `applySecurityPipeline` rather than retained as separate Fastify middleware modules (functionally equivalent, documentation/acceptance mismatch).

### Verdict

| Question | Answer |
|----------|--------|
| Is the IAM **security kernel** complete? | **Yes** — unified pipeline, full route map, no unwrapped handlers |
| Are audit findings R1, R2, R3, R10, R12 closed at the API layer? | **Yes** |
| Does implementation fully satisfy Phase 3.1 plan §8 acceptance checklist? | **No** — ~70% satisfied; remaining items are contract cleanup and ops flags |
| Can Phase 3.1 be marked **complete**? | **Conditionally yes** for backend IAM stabilization; **no** for end-to-end product readiness until web client is updated |

**Recommended status:** Mark Phase 3.1 **API-complete**, open a **Phase 3.1.1 closure track** for handler identity migration, strict-mode flag, web client alignment, and dead-code removal.

---

## 2. Audit Methodology

| Area | Method |
|------|--------|
| Identity flow | Trace `applySecurityPipeline` execution order; inspect all route handlers |
| Identity authority | Grep for `tokenPayload.accountId`, `auth.accountId`, `accountContext`, entitlement inputs |
| Route coverage | Compare `RouteSecurityMap` (21 entries) vs `securedRoute()` registrations; review `validateRouteSecurityMap` bootstrap |
| Auth bypass | Grep `verifyToken`, header parsing, direct credential checks outside `apps/api/src/auth/` |
| Legacy | Inventory `x-session-id` in API production code and web client |
| OAuth readiness | Assess `authSubject`, token issuance, claim flow vs roadmap Phase 3 target |
| Plan alignment | Map findings to Phase 3.1 plan §8 acceptance criteria and audit R1–R13 table |

---

## 3. Identity Flow Integrity

### 3.1 Target Flow (Phase 3.1 Plan)

```
Credential → ResolvedIdentity → RouteSecurity → Authorization → Session Lifecycle → Handler
```

### 3.2 Implemented Flow (`applySecurityPipeline`)

For non-public routes, the pipeline executes in this order:

| Step | Function | Layer |
|------|----------|-------|
| 1 | Route contract lock (`rule.path === routeOptions.url`) | Registration |
| 2 | `buildAuthContext()` — Bearer/cookie/`x-session-id` | Credential |
| 3 | `buildResolvedIdentity()` — loads `SystemState` | Identity |
| 4 | `emitIdentityObservabilityEvents()` — `LEGACY_USED`, `AUTH_SUBJECT_NULL` | Observability |
| 5 | `assertSessionNotRevoked()` — registry read | Authorization (revocation) |
| 6 | `enforceTokenAccountIdentity()` — token drift | Token semantics |
| 7 | `enforceRouteSecurity()` — tier evaluation | Route security |
| 8 | `applyAccountAuthorization()` — `validateAccountAccess`, registry read | Authorization |
| 9 | `applySessionLifecycle()` — register + `lastSeen` writes | Lifecycle (write) |
| 10 | Route handler | Handler |

Public / `anonymous-create` routes execute steps 1 + 7 only (no credential chain).

### 3.3 Findings

| ID | Finding | Severity | Notes |
|----|---------|----------|-------|
| **F-IF-01** | **No handler bypass of pipeline** — all 21 API routes register via `securedRoute()` → `wrapRouteWithSecurity()` → `applySecurityPipeline()` | ✅ Pass | Bootstrap `validateRouteSecurityMap()` enforces bidirectional map ↔ registration parity |
| **F-IF-02** | **Pipeline order differs slightly from plan diagram** — revocation and token drift run before tier re-check | Low | No security regression; tier check still blocks unauthenticated access |
| **F-IF-03** | **Handler-level ownership checks** on `GET/PATCH /api/sessions/:id` and `GET /api/events` via `session-ownership.ts` | ✅ Pass | Defense-in-depth beyond tier enforcement; correct for R1/R2 |
| **F-IF-04** | **`assertRouteAccountAccess()` in `session-lifecycle.ts`** re-validates account scope inside account-required handlers | Low | Duplicates pipeline authz; not a bypass but adds maintenance surface |
| **F-IF-05** | **`POST /api/sessions` handler writes to session registry** when `accountId !== null` | Medium | Registry write outside lifecycle middleware; only affects edge case of pre-linked session create; plan intended lifecycle middleware for writes on protected access |

### 3.4 Bypass Surface

**No routes execute handlers without passing through `applySecurityPipeline`.**

The only exception is the **Vitest isolation test** in `apply-route-security.test.ts`, which registers a bare `app.get('/health', ...)` on a standalone Fastify instance — not production code.

---

## 4. Identity Authority Verification

### 4.1 `SystemState.accountId` as Sole Authority

| Consumer | Source used | Compliant? |
|----------|-------------|------------|
| `buildResolvedIdentity()` | `state.accountId` → `identity.accountId` | ✅ |
| `resolveAccountFromSession()` | `state.accountId` → `AuthContext.accountId` | ✅ |
| Entitlement gating (`build-app.ts` execute) | `request.identity!.accountId` | ✅ |
| UI snapshot entitlements | `state.accountId` (post-pipeline state load) | ✅ |
| `validateAccountAccess()` | `context.accountId` from pipeline | ✅ (sourced from identity/state) |
| `toMutationActor()` | `auth.accountId` from `AuthContext` | ⚠️ Indirect — same SystemState source via `resolveAccountFromSession`, not `identity` |

### 4.2 `token.accountId` Usage

| Location | Usage | Authorization decision? |
|----------|-------|----------------------|
| `auth/token-account-semantics.ts` | Drift detection only | ❌ Not used for grants |
| `build-resolved-identity.ts` | Stored as `tokenAccountId` (informational) | ❌ |
| `enforceTokenAccountIdentity()` | Compare vs `stateAccountId`; 403 on drift | ✅ Correct — rejection only, not grant |
| Token creation (`build-app`, claim, account-session) | Snapshot at issuance | ❌ |

**No handler or entitlement path reads `tokenPayload.accountId` for ownership or module access decisions.**

### 4.3 Remaining `request.auth` / `request.accountContext` Usage

| File | Usage | Risk |
|------|-------|------|
| `routes/profile.ts` | `request.accountContext!.sessionId` (4×), `request.auth` for `toMutationActor` | **Medium** — violates plan §6.1 "handlers MUST use `request.identity` only" |
| `routes/ui-snapshot.ts` | `request.accountContext!.sessionId` | **Medium** |
| `routes/session-lifecycle.ts` | `request.accountContext` for account-required routes | **Medium** |
| `routes/account.ts` | `request.auth!.sessionId` for claim | **Medium** |
| `build-app.ts` | `request.auth!.sessionId`, `request.identity!.accountId` | **Low** — mixed; identity used for entitlements |
| `apply-route-security.ts` | Sets both; `auth.accountId` fallback in `applyAccountAuthorization` | **Low** — fallback equals identity when state exists |

| ID | Finding | Severity | Recommendation |
|----|---------|----------|----------------|
| **F-IA-01** | Handlers predominantly use `accountContext`/`auth`, not `identity` | **High** (contract) | Migrate handlers to `request.identity!`; deprecate `accountContext` reads |
| **F-IA-02** | `applyAccountAuthorization` uses `request.identity?.accountId ?? auth.accountId` | **Low** | Remove fallback; require identity |
| **F-IA-03** | `toMutationActor(auth)` uses `auth.accountId` not `identity.accountId` | **Low** | Accept `ResolvedIdentity` or read from identity in handlers |
| **F-IA-04** | Entitlement and ownership decisions correctly avoid token payload | ✅ Pass | Maintain; add lint rule |

---

## 5. Route Coverage Audit

### 5.1 Route Inventory

**RouteSecurityMap entries:** 21  
**securedRoute registrations:** 21 (via `build-app.ts` + route modules)  
**Bootstrap validation:** `validateRouteSecurityMap(RouteSecurityMap, registeredRoutes)` at end of `buildApp()`

| Route | Tier | Wrapped? | In map? |
|-------|------|----------|---------|
| `GET /health` | public | ✅ | ✅ |
| `GET /api/modules` | public | ✅ | ✅ |
| `GET /api/modules/:id` | public | ✅ | ✅ |
| `GET /api/i18n/languages` | public | ✅ | ✅ |
| `GET /api/i18n/:lang` | public | ✅ | ✅ |
| `POST /api/sessions` | anonymous-create | ✅ | ✅ |
| `GET /api/sessions/:id` | credential-required | ✅ | ✅ |
| `PATCH /api/sessions/:id` | credential-required | ✅ | ✅ |
| `GET /api/events` | credential-required | ✅ | ✅ |
| `GET /api/modules/:id/trace` | credential-required | ✅ | ✅ |
| `POST /api/modules/:id/execute` | credential-required | ✅ | ✅ |
| `GET /api/ui-snapshot` | credential-required | ✅ | ✅ |
| `POST/GET/PATCH /api/profile` | credential-required | ✅ | ✅ |
| `GET /api/profile/revisions` | credential-required | ✅ | ✅ |
| `POST /api/account/claim` | credential-required | ✅ | ✅ |
| `GET/POST /api/accounts/:id/sessions` | account-required | ✅ | ✅ |
| `POST /api/accounts/:id/sessions/revoke-all` | account-required | ✅ | ✅ |
| `POST /api/sessions/:id/revoke` | account-required | ✅ | ✅ |

### 5.2 Exceptions

| ID | Finding | Severity |
|----|---------|----------|
| **F-RC-01** | **No unwrapped production routes** | ✅ Pass |
| **F-RC-02** | **`ARRIVALOS_IAM_STRICT` env flag not implemented** — plan §7 requires runtime strict mode with `ROUTE_UNCLASSIFIED` event | **Medium** | Only bootstrap-time map validation exists; runtime unclassified routes throw `UnclassifiedRouteError` only on contract mismatch, not on missing map entry at request time |
| **F-RC-03** | **`credential-optional` tier removed** (execute hardened) | ✅ Pass | Aligns with R12 closure |
| **F-RC-04** | Fastify `@fastify/cors` may register OPTIONS handlers excluded from map tracking | **Low** | HEAD/OPTIONS explicitly skipped in `onRoute` hook — acceptable |

---

## 6. Authentication Bypass Audit

### 6.1 `verifyToken` Call Sites

| Location | Context | Outside auth layer? |
|----------|---------|-------------------|
| `auth/auth.context.ts` | `buildAuthContext()` pipeline entry | ✅ Auth layer |
| `auth/auth.token.service.ts` | Service implementation | ✅ Auth layer |
| `auth/auth.test.ts` | Unit tests | ✅ Tests |
| `account-claim.service.ts` | Token **creation** only | ✅ Not verification |
| `account-session.service.ts` | Token **creation** only | ✅ Not verification |
| `build-app.ts` | Token **creation** on session create | ✅ Not verification |

**No unauthorized `verifyToken()` calls outside `apps/api/src/auth/`.**

### 6.2 Direct Header / Credential Parsing

| Location | Purpose | Bypass? |
|----------|---------|---------|
| `auth/auth.context.ts` | Bearer, cookie, `x-session-id` extraction | ✅ Canonical — only entry point |
| `apply-route-security.ts` | `hasAuthCredential()` helper | ✅ Used for detection only; no auth decisions outside pipeline |
| Route handlers | None read raw auth headers | ✅ Pass |

### 6.3 Secondary Auth Checks in Handlers

| Location | Check | Assessment |
|----------|-------|------------|
| `session-lifecycle.ts` | `assertRouteAccountAccess()` | Supplementary — runs after pipeline for account-required tier |
| `session-ownership.ts` | Session ID param vs identity | Required for R1/R2 — not a bypass |
| `session-lifecycle.ts` revoke | Compares `caller.accountId` vs target state | Post-pipeline ownership — correct |

| ID | Finding | Severity |
|----|---------|----------|
| **F-AB-01** | No auth bypass paths identified in API production code | ✅ Pass |
| **F-AB-02** | `assertActiveSession()` remains in `session-registry.service.ts` with auto-register + write behavior but is **dead code** (no callers in `src/`) | **Medium** | Remove or mark `@deprecated` to prevent R7 regression |

---

## 7. Legacy Compatibility Audit

### 7.1 Production `x-session-id` Usage (API)

| Location | Classification | Phase 3.2 action |
|----------|----------------|------------------|
| `auth/auth.context.ts` — `extractLegacySessionId()` | **Required** | Replace with token-only after client migration |
| `apply-route-security.ts` — `hasAuthCredential()` | **Compatibility** | Remove when legacy header deprecated |
| `emitIdentityObservabilityEvents()` — triggers `LEGACY_USED` | **Required** (telemetry) | Keep until legacy removed |

All test files use `x-session-id` for integration testing — expected.

### 7.2 Web Client (`apps/web/src/lib/api.ts`)

| Function | Behavior | Classification | Issue |
|----------|----------|----------------|-------|
| `executeModule()` | Sends `x-session-id` when available | **Compatibility** | OK if session always ensured |
| `fetchUiSnapshot()` | Sends `x-session-id` | **Compatibility** | OK |
| `createSession()` | Discards issued `token`; stores only `sessionId` | **Compatibility debt** | Should persist Bearer token |
| `isSessionValid()` | `GET /api/sessions/:id` **without credential** | **Broken** | Will receive **401** after R1 hardening |
| `updateSessionLanguage()` / `updateSessionTheme()` | `PATCH /api/sessions/:id` **without credential** | **Broken** | Will receive **401** after R1 hardening |
| `ensureSession()` | Depends on broken `isSessionValid()` | **Broken** | May recreate sessions unnecessarily |

| ID | Finding | Severity | Recommendation |
|----|---------|----------|----------------|
| **F-LC-01** | API correctly supports legacy header with telemetry | ✅ Pass (R4 partial) | Plan-aligned |
| **F-LC-02** | Web client not updated for hardened session routes | **Critical** (product) | Phase 3.1.1 — add credentials to session GET/PATCH; store and send token |
| **F-LC-03** | Web client never adopts server-issued token | **High** | Roadmap Phase 3 client target not met |

---

## 8. OAuth Readiness Audit

### 8.1 Current Capabilities

| Capability | Status | Notes |
|------------|--------|-------|
| `authSubject` in token payload | ✅ Implemented | `resolveAuthSubject(accountId)` → `account:{id}` |
| `authSubject` in `ResolvedIdentity` | ✅ Token path only | `null` for legacy — logged via `AUTH_SUBJECT_NULL` |
| External IdP integration | ❌ Not present | No OAuth/OIDC provider adapters |
| Account claim with auth subject | ⚠️ Partial | Claim is session-possession based (R8 — out of scope) |
| Token cookies (`arrival_auth`) | ✅ Supported | Pipeline reads cookie as Bearer equivalent |
| Session registry + revocation | ✅ Implemented | Read in pipeline; write in lifecycle |
| Fail-closed route tiers | ✅ Implemented | Public / anonymous-create / credential / account |
| Legacy credential removal path | ⚠️ Telemetry only | `LEGACY_USED` emitted; header still accepted |

### 8.2 Roadmap Phase 3 Gap Analysis

| Roadmap requirement | Phase 3.1 state |
|---------------------|-----------------|
| Replace `localStorage(sessionId)` as credential | **Not started** (web) |
| `POST /api/account/claim` requires authenticated `authSubject` | **Not met** — possession-based |
| OAuth / OIDC providers | **Not met** — deferred |
| Revocable tokens vs session theft | **Partial** — registry revocation works for claimed sessions; anonymous sessions still possession-based |

| ID | Finding | Severity |
|----|---------|----------|
| **F-OA-01** | IAM **pipeline architecture** is OAuth-ready — external subject can populate `authSubject` without route changes | ✅ Positive |
| **F-OA-02** | Claim flow still possession-only; roadmap Phase 3 expects auth-bound claim | **Medium** | Planned for OAuth phase |
| **F-OA-03** | Legacy header blocks full OAuth transition | **Medium** | Phase 3.2 deprecation track |

**OAuth readiness score:** **Infrastructure: 7/10** | **Product integration: 3/10**

---

## 9. Observability & Plan Deviations

### 9.1 IAM Events

| Event (plan) | Implemented | Notes |
|--------------|-------------|-------|
| `TOKEN_MISMATCH` | ⚠️ Renamed | Emits `TOKEN_ACCOUNT_DRIFT_DETECTED` instead |
| `LEGACY_USED` | ✅ | On `authMode === 'session'` |
| `REGISTRY_BACKFILL` | ⚠️ Partial | Only logged when `NODE_ENV !== 'production'` |
| `AUTH_SUBJECT_NULL` | ✅ | Claimed + legacy |
| `ROUTE_UNCLASSIFIED` | ❌ Not emitted | No runtime strict mode |

Additional events not in plan: `TOKEN_ACCOUNT_IGNORED` — useful, keep.

### 9.2 Middleware Architecture Deviation

| Plan | Implementation |
|------|----------------|
| Separate `auth.middleware`, `authz.middleware`, `session-lifecycle.middleware` | **Consolidated** into `apply-route-security.ts` |
| `auth.middleware.ts` sets identity | **`auth.middleware.ts` contains only `toMutationActor()`** |

Functionally equivalent pipeline; **documentation and §8 checklist items referencing middleware files are not literally satisfied**.

### 9.3 Error Normalization (R10)

| Case | Plan | Implementation |
|------|------|----------------|
| Missing credential (protected) | 401 | ✅ `authentication_required` |
| Legacy `missing_credential` (400) | Deprecated | Still in `auth-error-mapper.ts`; unused by pipeline |

---

## 10. Audit Finding Remediation Matrix

| ID | Finding | Severity | Recommended fix | Phase |
|----|---------|----------|-----------------|-------|
| F-LC-02 | Web client session GET/PATCH without credentials | **Critical** | Add `x-session-id` or Bearer to all session routes in `apps/web` | 3.1.1 |
| F-IA-01 | Handlers use `accountContext`/`auth` not `identity` | **High** | Migrate to `request.identity`; remove compat shim reads | 3.1.1 |
| F-LC-03 | Web ignores issued token | **High** | Store token; prefer Bearer/cookie | 3.2 |
| F-RC-02 | `ARRIVALOS_IAM_STRICT` not implemented | **Medium** | Runtime map lookup + `ROUTE_UNCLASSIFIED` event | 3.1.1 |
| F-AB-02 | Dead `assertActiveSession()` with writes | **Medium** | Delete or hard-deprecate | 3.1.1 |
| F-IF-05 | Registry write in `POST /api/sessions` handler | **Medium** | Move to lifecycle service or document as create exception | 3.2 |
| F-OA-02 | Possession-only claim | **Medium** | OAuth phase | 4.x |
| F-IA-02 | `auth.accountId` fallback in pipeline | **Low** | Use identity only | 3.1.1 |
| F-IF-04 | Duplicate account checks in handlers | **Low** | Consolidate or document | 3.2 |
| F-RC-04 | OPTIONS routes untracked | **Low** | Accept or add explicit public tier | — |

---

## 11. Phase 3.1 Acceptance Criteria Scorecard

Reference: [iam-phase-3-1-boundary-stabilization.md §8](../architecture/iam-phase-3-1-boundary-stabilization.md)

### Identity

| Criterion | Status |
|-----------|--------|
| All downstream handlers use `request.identity` | ❌ **Partial** — 4 route modules still use `accountContext`/`auth` |
| No `verifyToken()` outside auth layer | ✅ |
| `accountId` in handlers from SystemState-backed identity | ✅ for entitlements; ⚠️ mixed accessor paths |

### Middleware / Registry

| Criterion | Status |
|-----------|--------|
| Auth/authz contain zero registry writes | ✅ in pipeline authz path |
| Registry writes in lifecycle service | ✅ `applySessionLifecycle` |
| `assertActiveSession` auto-register removed from authz | ✅ No runtime callers; ⚠️ dead code remains |

### Routing

| Criterion | Status |
|-----------|--------|
| 100% routes in `RouteSecurityMap` | ✅ 21/21 |
| Unclassified route hard fail with `ARRIVALOS_IAM_STRICT` | ❌ Flag not implemented |
| Tier attached at registration | ✅ `requireRouteSecurityRule()` |

### Security Fixes

| Criterion | Status |
|-----------|--------|
| R1 — sessions/:id require credential + ownership | ✅ |
| R2 — events require credential + ownership | ✅ |
| R3 — trace full pipeline + revocation | ✅ |
| R4 — legacy emits `LEGACY_USED` | ✅ |

### Token Semantics

| Criterion | Status |
|-----------|--------|
| `token.accountId` not used for entitlement/ownership | ✅ |
| Drift → 403 + event | ✅ (event name differs from plan) |

### Regression

| Criterion | Status |
|-----------|--------|
| Tests passing | ✅ 135/135 |
| DPSS unchanged | ✅ |
| Entitlement rules unchanged | ✅ |

**Scorecard: 14/18 fully met, 3 partial, 1 not met**

---

## 12. Original Audit Findings (R1–R13) — Final Disposition

| ID | Disposition after Phase 3.1 |
|----|----------------------------|
| **R1** | ✅ **Closed** |
| **R2** | ✅ **Closed** |
| **R3** | ✅ **Closed** |
| **R4** | ⚠️ **Partial** — legacy supported with telemetry; removal deferred |
| **R5** | ⚠️ **Partial** — pre-claim tokens still valid; drift logged |
| **R6** | ⚠️ **Partial** — `ResolvedIdentity` exists; handler migration incomplete |
| **R7** | ✅ **Closed** — pipeline split; dead code remains |
| **R8** | N/A |
| **R9** | N/A |
| **R10** | ✅ **Closed** |
| **R11** | Unchanged (acceptable) |
| **R12** | ✅ **Closed** |
| **R13** | N/A |

---

## 13. Conclusion

### Is IAM Phase 3.1 complete?

**For the API security kernel: yes, with documented cleanup debt.**

The implementation delivers a **defined, auditable IAM boundary** that the Phase 3.1 plan set out to achieve:

- Single pipeline entry point (`applySecurityPipeline`)
- Complete route classification (21/21)
- SystemState-backed identity authority for entitlements
- Critical audit remediations (R1, R2, R3, R10, R12) verified in code and tests
- Registry read/write separation in the hot path
- IAM drift telemetry for legacy and token semantics

**For strict plan completion and product readiness: not yet.**

Remaining work is **contract enforcement and client alignment**, not fundamental architecture:

1. Migrate handlers to `request.identity` exclusively
2. Fix web client broken session validation and PATCH flows (**Critical**)
3. Implement `ARRIVALOS_IAM_STRICT` runtime guard
4. Remove dead `assertActiveSession()` 
5. Align event naming with plan (`TOKEN_MISMATCH`) or update plan docs

### Recommended next phase

**Phase 3.1.1 — Contract Closure & Client Alignment** (1–2 sprints)  
Then proceed to **Phase 3.2 — Legacy Credential Deprecation** per roadmap.

---

## 14. Document History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | June 2026 | Final architecture audit post Phase 3.1 Steps 1–7 |
