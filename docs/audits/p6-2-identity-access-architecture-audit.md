---
id: p6-2-identity-access-architecture-audit
title: P6.2 Identity Access Architecture Audit
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: platform
status: active
maturity: stable
owner: system
tags:
  - iam
  - session-auth
created: 2026-06-01
updated: 2026-06-19
related:
---

# P6.2 — Identity & Access Architecture Audit

**Role:** Principal Identity Architect / Access Control Auditor  
**Date:** June 2026  
**Mode:** Read-only architectural analysis (NO CODE CHANGES)  
**Scope:** Identity, authentication, authorization, session management, access boundaries, account lifecycle readiness  
**Baseline:** Post-P6.1 (single-node DPSS, file-backed `SystemState`, session-based access model)

**Out of scope:** General security hardening, GDPR compliance, persistence durability, infrastructure, DPSS correctness (covered in P5.x–P6.1).

---

## 1. Executive Summary

### Identity Architecture Classification

**Anonymous Session System** with **possession-based authorization** and **no authentication layer**.

The system does not implement users, accounts, login, OAuth, or ownership verification. A server-generated `sessionId` simultaneously acts as **identity surrogate** and **sole credential**. Anyone who possesses a valid `sessionId` is treated as the session owner with full read/write authority over that `SystemState` blob.

### Identity Maturity

| Metric | Value |
|--------|-------|
| **Identity Maturity Score** | **28 / 100** |
| **Maturity Level** | **Level 1 — Anonymous Session System** |
| **Beta readiness (identity/IAM)** | **LIMITED YES** — only with external access controls and explicit anonymous-session acceptance |
| **Public deployment readiness (identity/IAM)** | **NO** |

### Primary Identity Conclusion

> **Arrival Atlas has a transport binding (`sessionId` → `SystemState`), not an identity system.** The DPSS write path is session-keyed in a way that is **compatible with future account attachment**, but the API authorization layer has **no concept of an authentication subject** and **cannot verify session ownership** beyond ID possession.

---

## 2. Identity Model Classification

### 2.1 System Classification

| Candidate Model | Applies? |
|-----------------|----------|
| Anonymous Session System | **YES — current state** |
| Pseudonymous Identity System | Partially — session is opaque but not linked to a stable pseudonym across devices |
| Authenticated User System | **NO** |
| Hybrid Identity System | **NO** (design intent only; see `user-profile-engine-design.md`) |
| Account-Based System | **NO** |

**Verdict: Anonymous Session System.**

### 2.2 Authority Table

| Concept | Current Authority |
|---------|-------------------|
| **Identity** | Opaque `sessionId` string (`sess_{timestamp}_{random}`) |
| **Credential** | Same `sessionId` — transmitted via `x-session-id` header and/or URL path |
| **Ownership** | **Unverified possession** — whoever presents the ID is accepted |
| **Session** | Server-side `SystemState` keyed by `session.id`; client holds ID in `localStorage` |
| **Account** | **Does not exist** |
| **Authentication Subject** | **Does not exist** — no `userId`, `sub`, email, or principal |
| **Authorization Subject** | `sessionId` only — no separate authz principal |

### 2.3 Explicit Answers

**Who is the user?**

There is no user in the IAM sense. The system recognizes a **session actor** — any HTTP client that presents a valid `sessionId`. In practice, the "user" is approximated by:

1. A browser profile holding `arrival_atlas_session_id` in `localStorage`
2. Whatever client can send that ID to the API

There is no binding between a session and a human, device identity, email, or OAuth subject.

**What proves that a user owns a session?**

**Nothing cryptographically or account-linked.** Proof reduces to:

- Client sends `sessionId` (header or URL)
- Server checks that a `SystemState` file exists for that ID
- If found → full access granted

No challenge-response, no signed token, no server-issued secret separate from the identifier, no binding to an authenticated principal.

---

## 3. Authentication Architecture Audit

### 3.1 Session Creation — `POST /api/sessions`

| Question | Finding |
|----------|---------|
| Who may create sessions? | **Anyone** — unauthenticated, no API key |
| Are sessions authenticated? | **No** — creation is anonymous |
| Can sessions be abused? | **Yes** — unlimited creation; no rate limit; each creates a persisted `SystemState` file |
| Is session creation rate-limited? | **No** |
| Is session creation auditable? | **Partial** — `SystemState` is created; no operator-facing audit log of creator IP, user agent, or principal |

**Flow:**

```
Browser (no credential)
  → POST /api/sessions { context }
  → SystemStateCoordinator.applyMutation(SESSION_CREATE)
  → FilePersistedSystemStateStore.save()
  → { sessionId, context } returned
  → Client writes sessionId to localStorage
```

**Evidence:** `apps/api/src/build-app.ts:156–167`, `apps/web/src/lib/api.ts:134–186`

### 3.2 Session Validation

| Aspect | Implementation |
|--------|----------------|
| **Validity check** | `getState(sessionId)` → file exists and parses as JSON |
| **Trust assumption** | Presenter of `sessionId` is the legitimate owner |
| **Replay resistance** | **None** — same ID works indefinitely |
| **Fixation resistance** | **Weak-positive** — default client creates its own session via `ensureSession()`; no server-side fixation defense if attacker can write victim `localStorage` |

**Client validation** (`ensureSession`):

1. Read `localStorage` sessionId
2. `GET /api/sessions/:id` — if 200, reuse
3. Else create new session and persist

**Server validation:** existence only — no freshness, no signature, no binding check.

### 3.3 Session Lifecycle

| Capability | Present? | Evidence |
|------------|----------|----------|
| **Creation** | **YES** | `SESSION_CREATE` mutation; `POST /api/sessions` |
| **Expiration** | **NO** | `lastActiveAt` updated on mutation; no TTL enforcement or cleanup |
| **Rotation** | **NO** | ID immutable for life of session |
| **Revocation** | **NO** (API) | `PersistedSystemStateStore.delete()` exists; no HTTP endpoint |
| **Suspension** | **NO** | |
| **Device binding** | **NO** | |
| **Ownership transfer** | **NO** | |
| **Recovery** | **NO** | Lost `sessionId` = new anonymous session; prior state unrecoverable by user |

### 3.4 Session Lifecycle Diagram

```
                    ┌─────────────────────────────────────┐
                    │         POST /api/sessions          │
                    │         (unauthenticated)           │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │   sessionId generated + persisted   │
                    │   client stores in localStorage     │
                    └─────────────────┬───────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
   ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
   │ GET/PATCH    │           │ x-session-id │           │ ?sessionId=  │
   │ /sessions/:id│           │ routes       │           │ /api/events  │
   │ (URL only)   │           │              │           │              │
   └──────┬───────┘           └──────┬───────┘           └──────┬───────┘
          │                           │                           │
          └───────────────────────────┼───────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │   getState(sessionId) → authorize   │
                    │   (possession = full access)        │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
         ┌────────────────────┐              ┌────────────────────┐
         │  Mutations forever │              │  No terminal state │
         │  (no expiry)       │              │  (no revoke API)   │
         └────────────────────┘              └────────────────────┘

   MISSING TRANSITIONS: expire · rotate · revoke · recover · claim → account
```

---

## 4. Authorization Model Audit

### 4.1 Effective Access Model

**Possession-based access control (PBAC):** knowledge or control of `sessionId` grants complete session scope.

There is no separation between:

- **Authentication** (who are you?)
- **Authorization** (what may you do?)

The system conflates both into a single opaque identifier.

### 4.2 Route Authorization Matrix

| Route | Method | Identity Required | Authorization Required | Authorization Subject | Mechanism | Access Scope | Risk |
|-------|--------|-------------------|------------------------|----------------------|-----------|--------------|------|
| `/health` | GET | None | None | — | Public | Service metadata | LOW |
| `/api/modules` | GET | None | None | — | Public | Module catalog | LOW |
| `/api/modules/:id` | GET | None | None | — | Public | Module metadata | LOW |
| `/api/modules/:id/execute` | POST | Optional | Possession (if header) | `sessionId` | `x-session-id` | Execute module; persist if session present | **HIGH** |
| `/api/modules/:id/trace` | GET | `sessionId` | Possession | `sessionId` | `x-session-id` | Latest execution trace | **HIGH** |
| `/api/profile` | POST | `sessionId` | Possession | `sessionId` | `x-session-id` | Create profile on session | **HIGH** |
| `/api/profile` | GET | `sessionId` | Possession | `sessionId` | `x-session-id` | Full profile read | **HIGH** |
| `/api/profile` | PATCH | `sessionId` | Possession + revision | `sessionId` | `x-session-id` + `If-Match` | Profile write (optimistic lock) | **HIGH** |
| `/api/profile/revisions` | GET | `sessionId` | Possession | `sessionId` | `x-session-id` | Full revision history | **HIGH** |
| `/api/ui-snapshot` | GET | `sessionId` | Possession | `sessionId` | `x-session-id` | Full projected state | **HIGH** |
| `/api/sessions` | POST | None | None | — | Public | Create session | MEDIUM |
| `/api/sessions/:id` | GET | **None** | **None** | `sessionId` (URL) | ID in path | Read session context | **CRITICAL** |
| `/api/sessions/:id` | PATCH | **None** | **None** | `sessionId` (URL) | ID in path | Modify session context | **CRITICAL** |
| `/api/i18n/languages` | GET | None | None | — | Public | Language list | LOW |
| `/api/i18n/:lang` | GET | None | None | — | Public | Translations | LOW |
| `/api/events` | GET | Optional | Possession (if query) | `sessionId` | `?sessionId=` | Session events | **HIGH** |

### 4.3 Authorization Inconsistencies

| Pattern | Routes | Issue |
|---------|--------|-------|
| **Header-only** | Profile, snapshot, trace | Requires `x-session-id` but no ownership proof |
| **URL-only** | `GET/PATCH /api/sessions/:id` | No header; any client with ID can read/write |
| **Optional identity** | Execute (no header), events (no query) | Anonymous execution allowed; persistence skipped |
| **Revision lock** | `PATCH /api/profile` | Prevents concurrent write races; **not** an authz control |

**Effective model:** Single flat scope per `sessionId` — no roles, no ACL, no resource-level policy beyond existence check.

---

## 5. Session Ownership Analysis

### 5.1 Does the system know who owns a session?

**No.**

The system knows:

- That `sessionId` **X** maps to `SystemState` file **X.json**
- That mutations tagged with **X** update that file

The system does **not** know:

- Which human owns **X**
- Which device created **X**
- Whether the current requester is the original creator
- Any recoverable identity anchor if **X** is lost

### 5.2 Ownership Proof — Current Model

```
Ownership claim := present(sessionId)
Ownership verify := exists(SystemState[sessionId])
```

### 5.3 Ownership Property Evaluation

| Property | Assessment |
|----------|------------|
| **Theft resistance** | **LOW** — stolen ID grants permanent full access; no detection or invalidation |
| **Replay resistance** | **NONE** — ID reusable forever |
| **Sharing resistance** | **NONE** — intentional or accidental sharing is indistinguishable from legitimate use |
| **Recovery capability** | **NONE** — no email, no account, no recovery token |

### 5.4 Loss of sessionId

| Event | Outcome |
|-------|---------|
| User clears `localStorage` | `ensureSession()` creates **new** session; prior profile/executions orphaned on server |
| User switches browser/device | New session; no continuity |
| User loses device | No recovery path |
| Attacker obtains sessionId | Indistinguishable from owner; full takeover |

**Can ownership ever be recovered if sessionId is lost?**

**No.** Recovery would require a separate identity anchor (account, email, OAuth `sub`) that does not exist today.

---

## 6. Identity Threat Model

### 6.1 Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ ACTOR: Anonymous Internet User                                    │
│ Surface: POST /api/sessions, POST /api/modules/*/execute (no hdr) │
└────────────────────────────┬─────────────────────────────────────┘
                             │ create sessions, anonymous execute
┌────────────────────────────▼─────────────────────────────────────┐
│ ACTOR: Session Holder (legitimate browser)                        │
│ Credential: sessionId in localStorage + x-session-id              │
└────────────────────────────┬─────────────────────────────────────┘
                             │ full session scope
┌────────────────────────────▼─────────────────────────────────────┐
│ ACTOR: Session Thief (possesses stolen sessionId)                 │
│ Indistinguishable from Session Holder at API layer                │
└────────────────────────────┬─────────────────────────────────────┘
                             │ same access as holder
┌────────────────────────────▼─────────────────────────────────────┐
│ TRUST BOUNDARY: API (no auth middleware)                          │
│ Authorization subject = sessionId possession only                 │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│ ACTOR: Host Operator (filesystem access)                          │
│ Can read/write any SystemState file directly                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│ SystemState(sessionId) → .arrival-atlas-state/{sessionId}.json       │
└──────────────────────────────────────────────────────────────────┘

FUTURE (not implemented):
┌──────────────────────────────────────────────────────────────────┐
│ ACTOR: Authenticated User (OAuth subject / accountId)           │
│ Expected: sessions scoped to account; ownership verified            │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Actor Capability Matrix

| Actor | Read Access | Write Access | Escalation | Impersonation |
|-------|-------------|--------------|------------|---------------|
| **Anonymous Internet User** | Public routes only | Create sessions; execute modules (no persist) | Create unlimited sessions / disk fill | **No** cross-session without ID |
| **Session Holder** | Full own `SystemState` via API | Full own session (profile, execute, patch) | **No** role escalation (no roles exist) | **No** other sessions without their ID |
| **Session Thief** | Same as holder if ID stolen | Same as holder | Same as holder | **Full** impersonation of victim session |
| **Host Operator** | All state files | All state files | Direct file edit bypasses API | **Full** impersonation of any session |
| **Future Authenticated User** (expected) | Own account's sessions | Own account's sessions | Depends on future RBAC | Should be prevented by account binding |

### 6.3 Identity-Specific Attack Paths

| Attack | Preconditions | Identity impact |
|--------|---------------|-----------------|
| **Session hijack** | Obtain `sessionId` | Complete identity takeover for that session |
| **IDOR on session routes** | Know/guess `sessionId` | `GET/PATCH /api/sessions/:id` — no header required |
| **Cross-device orphaning** | User switches device | New identity (new session); old state abandoned |
| **Operator impersonation** | Filesystem access | Read/write any user's state |

---

## 7. Multi-Device Identity Readiness

### 7.1 Requirement

User starts on laptop → continues on phone → continues on tablet.

### 7.2 Current Capability

| Capability | Supported? | Notes |
|------------|------------|-------|
| Multiple devices | **NO** | Each device gets independent `localStorage` session |
| Multiple browsers | **NO** | Same — isolated storage per browser profile |
| Session synchronization | **NO** | No shared account or sync mechanism |
| Device revocation | **NO** | No device registry |
| Login history | **NO** | |
| Trusted devices | **NO** | |

### 7.3 Without Redesign?

**No.** Current architecture binds state to a single opaque `sessionId` held locally. Multi-device requires at minimum:

1. **Stable identity anchor** (account / OAuth `sub`)
2. **Session-to-account linkage** in `SystemState` or separate index
3. **Authenticated session establishment** on each device
4. **Optional:** multiple concurrent session tokens per account with per-device revocation

### 7.4 Required Architectural Changes (Conceptual)

| Layer | Change |
|-------|--------|
| **Identity** | Introduce `accountId` / `userId` as primary principal |
| **Session** | Demote `sessionId` to device/session instance; link to account |
| **Client** | Replace bare `localStorage` ID with auth token flow |
| **API** | Auth middleware; resolve `sessionId` only after account verification |
| **Authorization** | Verify `session.accountId === auth.subject` on every mutation |

**DPSS compatibility:** `SystemState` can gain an `accountId` field without breaking projection — session remains the mutation key initially.

---

## 8. Account Migration Readiness

### 8.1 Target Flow

```
Anonymous user (sessionId A, SystemState A)
       ↓
Creates account (OAuth / email)
       ↓
Existing SystemState retained
       ↓
Future sessions linked to account
```

### 8.2 Migration Viability by Asset

| Asset | Migratable? | Blockers |
|-------|-------------|----------|
| **Session → account link** | **YES (architecturally)** | Add `accountId` to `SystemState` or sidecar index; no field exists today |
| **Profile ownership** | **YES** | `profileRecord` already session-scoped; re-scope to account on claim |
| **Execution history** | **YES** | Lives in `executionsByModuleId` inside `SystemState` — moves with session claim |
| **Execution traces** | **YES** | Same blob |
| **Profile revisions** | **YES** | Same blob |
| **Snapshot continuity** | **PARTIAL** | `buildUiSnapshot(state)` pure — works if state preserved; client must adopt post-claim session/token |
| **Events** | **YES** | In-state; no external identity |

### 8.3 Structural Enablers (Already Present)

| Enabler | Evidence |
|---------|----------|
| Session-keyed `SystemState` blob | Single file per session — atomic claim target |
| Coordinator-only writes | Clear mutation point for `ACCOUNT_CLAIM` future mutation |
| `profileId` in session context | Precedent for foreign-key-style binding |
| Design doc intent | `user-profile-engine-design.md` §7.4 Guest → `POST /api/profile/claim` |

### 8.4 Blockers

| Blocker | Severity |
|---------|----------|
| No `accountId` / `userId` in `SystemState` | **HIGH** |
| No claim / link API or mutation type | **HIGH** |
| No authentication subject to claim against | **HIGH** |
| Client assumes `localStorage` sessionId is permanent identity | **MEDIUM** |
| Session routes lack header auth pattern — claim flow would need new middleware | **MEDIUM** |
| Multiple anonymous sessions per future account — merge policy undefined | **MEDIUM** |

**Verdict:** **SystemState is structurally attachable to a future account**, but **no identity layer exists to perform the attachment**.

---

## 9. OAuth / External Identity Readiness

### 9.1 Assumed Future Providers

Google, Microsoft, GitHub, Apple, Keycloak, Auth0

### 9.2 Compatibility Assessment

OAuth/OIDC produces an authenticated **subject** (`sub`) and optionally email, name, and tokens. Current architecture accepts only **sessionId** with no validation pipeline — OAuth must sit **in front of** or **alongside** session creation, not replace `SystemState` keying immediately.

### 9.3 Component Reusability Matrix

| Component | Reusable | Requires Refactor |
|-----------|----------|-------------------|
| `SystemState` blob structure | **YES** | Add `accountId`, optional `authProvider`, `authSubject` |
| `SystemStateCoordinator` mutation pipeline | **YES** | New mutations: `ACCOUNT_LINK`, `SESSION_REVOKE`; authz gate before `applyMutation` |
| `FilePersistedSystemStateStore` | **YES** | Optional account-index file or DB later |
| `buildUiSnapshot()` projection | **YES** | May expose account-linked metadata |
| `POST /api/sessions` | **NO** | Must require auth or issue signed session bound to `sub` |
| `GET/PATCH /api/sessions/:id` | **NO** | Must verify authenticated subject owns session |
| Profile routes (`x-session-id`) | **PARTIAL** | Header pattern reusable; must validate session belongs to auth subject |
| `AppProvider` + `ensureSession()` | **NO** | Replace with OAuth callback + token/session bootstrap |
| `localStorage` sessionId | **NO** | Replace with HttpOnly cookie or secure token storage |
| `AppContextSchema` | **PARTIAL** | May carry `profileId`; needs `accountId` / `authSubject` |
| CORS configuration | **YES** | Add OAuth redirect origins |
| Module execute path | **PARTIAL** | Session binding logic reusable after auth middleware |

### 9.4 Integration Pattern (Architectural)

```
OAuth Provider
     ↓
Auth Middleware (JWT/session cookie validation)
     ↓
Resolve accountId + issue/validate server session
     ↓
SystemStateCoordinator (sessionId scoped to account)
     ↓
Existing DPSS pipeline
```

**What must change:** Everything above the coordinator that establishes **who** is calling. **What can remain:** Coordinator, projection engine, mutation appliers, file store (interim).

---

## 10. Access Control Boundary Audit

### 10.1 Trust Boundaries

```
Browser
  ↓  [sessionId in localStorage — NOT verified by server]
Frontend (Next.js)
  ↓  [x-session-id header — asserted, not proven]
API (Fastify)
  ↓  [sessionId → getState — existence check only]
SystemStateCoordinator
  ↓  [per-session write lock — no identity check]
FilePersistedSystemStateStore
  ↓  [filesystem — no identity layer]
.arrival-atlas-state/*.json
```

### 10.2 Boundary Analysis

| Boundary | Identity Asserted? | Identity Verified? | Authorization Enforced? | Ownership Validated? |
|----------|-------------------|--------------------|-------------------------|----------------------|
| **Browser → localStorage** | Client writes `sessionId` | **NO** | N/A | **NO** |
| **Frontend → API** | `x-session-id` header | **NO** | Possession only | **NO** |
| **API → Coordinator** | `sessionId` from route/header | **NO** | Existence check | **NO** |
| **Coordinator → Store** | `state.session.id` | **NO** | Implicit (writer holds ID) | **NO** |
| **Store → Filesystem** | Filename from `sessionId` | **NO** | OS file permissions only | **NO** |

### 10.3 Assumed-but-Never-Verified

| Assumption | Reality |
|------------|---------|
| "This request belongs to the user who created the session" | **Never verified** |
| "`x-session-id` holder is the session owner" | **Equated without proof** |
| "Session ID in URL matches rightful caller" | **Not checked** on `GET/PATCH /api/sessions/:id` |
| "localStorage sessionId is secret" | **Not secret** — readable by XSS, extensions, same-origin scripts |

**Critical gap:** Identity is **assumed at the browser** and **re-asserted at the API**, but **never verified at any trust boundary**.

---

## 11. Production Identity Gap Analysis

**Target:** Public Internet Deployment

| Requirement | Status | Gap Severity |
|-------------|--------|--------------|
| Authentication | **FAIL** | **CRITICAL** |
| Account ownership | **FAIL** | **CRITICAL** |
| Session ownership verification | **FAIL** | **CRITICAL** |
| Session recovery | **FAIL** | **HIGH** |
| Multi-device access | **FAIL** | **HIGH** |
| Account deletion | **FAIL** | **HIGH** |
| Session revocation | **FAIL** | **HIGH** |
| Session expiration | **FAIL** | **HIGH** |
| Audit trail (who did what) | **PARTIAL** | **HIGH** — in-state `changedBy: user\|module`; no auth subject |
| OAuth / federated login | **FAIL** | **HIGH** |
| Consistent route authorization | **FAIL** | **HIGH** — URL vs header split |
| Role / permission model | **FAIL** | **MEDIUM** — may not be needed for v1 |
| Device management | **FAIL** | **MEDIUM** |
| Anonymous → account upgrade | **FAIL** | **MEDIUM** — structurally feasible, not implemented |

**Gates passed: 0 / 13 mandatory identity requirements**

---

## 12. Architectural Migration Strategy Evaluation

*Architectural comparison only — no implementation proposals.*

### Option A — Anonymous Sessions → Accounts

| Dimension | Assessment |
|-----------|------------|
| **Architectural complexity** | **MEDIUM** — additive `accountId`, claim flow, auth middleware |
| **Migration risk** | **MEDIUM** — existing anonymous sessions need claim window or orphan policy |
| **User friction** | **LOW initially** — anonymous first matches current UX |
| **Long-term maintainability** | **HIGH** — aligns with `user-profile-engine-design.md` intent |
| **DPSS fit** | **Strong** — `SystemState` claim is a single mutation |

**Recommended evolutionary path** for Arrival Atlas given current architecture and design docs.

### Option B — Accounts Required From Day One

| Dimension | Assessment |
|-----------|------------|
| **Architectural complexity** | **HIGH** — full IAM before launch |
| **Migration risk** | **LOW** — no anonymous debt |
| **User friction** | **HIGH** — login wall before any value |
| **Long-term maintainability** | **HIGH** — simpler runtime model |
| **DPSS fit** | **Neutral** — requires auth before any `SESSION_CREATE` |

Viable for greenfield public launch; **poor fit for retrofit** without discarding current anonymous flows.

### Option C — Hybrid (Anonymous + Authenticated)

| Dimension | Assessment |
|-----------|------------|
| **Architectural complexity** | **HIGH** — two identity modes, claim flow, dual authz paths |
| **Migration risk** | **MEDIUM–HIGH** — edge cases at claim boundary |
| **User friction** | **LOW** — best UX progression |
| **Long-term maintainability** | **MEDIUM** — permanent complexity unless anonymous path deprecated |
| **DPSS fit** | **Strong** — matches stated G4 in design doc |

**Best product fit**; requires disciplined authz middleware to prevent anonymous sessions from accessing account-scoped resources post-login.

### Strategy Recommendation

**Option C (Hybrid) implemented via Option A sequencing:**

1. Introduce auth subject and account entity
2. Add claim mutation linking existing `SystemState` to account
3. Require authentication for new sessions on public deployment
4. Deprecate unauthenticated `GET/PATCH /api/sessions/:id`

---

## 13. Identity Maturity Score

### 13.1 Area Scores (0–10)

| Area | Score | Rationale |
|------|-------|-----------|
| **Authentication** | 1 | No login, OAuth, or token validation |
| **Authorization** | 2 | Possession-only; inconsistent route guards |
| **Session Ownership** | 1 | No verification, recovery, or binding |
| **Session Lifecycle** | 2 | Creation only; no expire/revoke/rotate |
| **Multi-Device Support** | 0 | Not possible without new identity anchor |
| **Recovery** | 0 | Lost sessionId = lost access |
| **Account Readiness** | 4 | DPSS blob migratable; no account model |
| **OAuth Readiness** | 3 | Clean insertion point above coordinator; client/API need overhaul |
| **Auditability** | 4 | Profile revisions + events; no auth subject in audit |
| **Operational Identity Security** | 2 | No rate limits, session admin APIs, or IAM ops |

### 13.2 Composite Score

**Identity Maturity Score: 28 / 100**

Calculation: average of area scores (19/10 × 10 ≈ 19 raw) adjusted upward for structural migration readiness (+9): **~28**.

### 13.3 Maturity Level Classification

| Level | Description | Fit |
|-------|-------------|-----|
| **Level 0** — No Identity Model | | No — session model exists |
| **Level 1** — Anonymous Session System | | **CURRENT** |
| **Level 2** — Basic User Accounts | | Not reached |
| **Level 3** — Production Authentication | | Not reached |
| **Level 4** — Multi-Device Identity Platform | | Not reached |
| **Level 5** — Enterprise IAM Ready | | Not reached |

**Achieved: Level 1 — Anonymous Session System**

---

## 14. Final Questions — Explicit Answers

### 1. What is the actual identity model of Arrival Atlas today?

**Anonymous Session System.** A server-issued `sessionId` is the sole principal. There is no user account, authentication subject, or ownership verification. Identity is equated with session persistence key.

### 2. Is sessionId functioning as an identifier, a credential, or both?

**Both.**

| Role | Function |
|------|----------|
| **Identifier** | Primary key for `SystemState` storage and all mutations |
| **Credential** | Presented on each request to prove access; no separate secret |

This dual use is an IAM anti-pattern at production scale: compromising the identifier compromises the credential.

### 3. Can the current architecture safely evolve into authenticated accounts?

**Yes, architecturally — with bounded migration risk.**

Enablers: session-keyed `SystemState` blob, coordinator mutation pipeline, design doc claim intent. Required: authentication layer above API, `accountId` binding, authorization middleware, client auth flow replacement. **DPSS core can remain.**

**Not safe to evolve without adding an auth layer** — current routes would remain IDOR-vulnerable during transition unless gated.

### 4. What are the three largest identity architecture risks?

1. **sessionId as dual identifier + credential** — theft equals permanent full takeover with no detection or revocation
2. **No ownership verification at any trust boundary** — API cannot distinguish holder from thief; session routes don't even require header consistency
3. **No identity anchor for recovery or multi-device** — every device/browser is a new anonymous actor; users cannot reclaim state

### 5. Is Arrival Atlas ready for a 100-user external beta from an identity and access perspective?

**LIMITED YES.**

Acceptable only if:

- Beta users understand there are **no accounts** and **no recovery**
- Access is **invite-gated** or front-door protected (VPN, Cloudflare Access, etc.)
- Operators accept **total session compromise** if `sessionId` leaks
- Privacy notice states session-based anonymous identity

**NO** for open signup or self-service public beta without authentication.

### 6. What identity maturity level does the system currently achieve?

**Level 1 — Anonymous Session System** (score 28/100).

### 7. What is the minimum identity architecture required before public deployment?

| # | Minimum requirement |
|---|---------------------|
| 1 | **Authenticated subject** (OAuth/OIDC or equivalent) distinct from `sessionId` |
| 2 | **Session ownership verification** — every session-scoped route validates `session.accountId === auth.subject` |
| 3 | **Server-issued session tokens** — HttpOnly cookie or short-lived JWT; `sessionId` alone must not be sufficient |
| 4 | **Session lifecycle controls** — expiration, revocation, rotation |
| 5 | **Account-scoped data model** — `accountId` on `SystemState` or equivalent index |
| 6 | **Account deletion** — unlink and erase state by auth subject |
| 7 | **Consistent authorization** — eliminate URL-only session access (`GET/PATCH /api/sessions/:id`) |
| 8 | **Anonymous → account claim path** (if hybrid) — or disallow anonymous sessions on public deploy |

---

## 15. Success Criteria Checklist

| Criterion | Met? |
|-----------|------|
| Identity architecture classified precisely | ✅ Anonymous Session System |
| Authentication separated from authorization | ✅ Documented conflation and gaps |
| Ownership gaps identified | ✅ No verification at any boundary |
| Account migration viability assessed | ✅ Structurally viable; blockers listed |
| OAuth readiness assessed | ✅ Insertion point above coordinator |
| Multi-device readiness assessed | ✅ Not supported without redesign |
| Maturity score provided | ✅ 28/100, Level 1 |
| Production-readiness verdict provided | ✅ NO (public); LIMITED YES (closed beta) |
| Scope limited to identity/IAM | ✅ |

---

## 16. References (Evidence)

| Artifact | Path |
|----------|------|
| Session ID generation | `apps/api/src/state/system-state-apply.ts` |
| Session routes (no auth) | `apps/api/src/build-app.ts` |
| Profile routes (header possession) | `apps/api/src/routes/profile.ts` |
| Snapshot routes | `apps/api/src/routes/ui-snapshot.ts` |
| Client session bootstrap | `apps/web/src/lib/api.ts`, `apps/web/src/components/AppProvider.tsx` |
| Mutation types (no account mutations) | `apps/api/src/state/system-mutation-types.ts` |
| SystemState shape (no accountId) | `apps/api/src/state/system-state-types.ts` |
| Future design intent | `docs/identity/user-profile-engine-design.md` §7.4 |
| Prior security audit | P6.1 (session threat model, route matrix) |

---

*End of P6.2 Identity & Access Architecture Audit*
