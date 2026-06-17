# IAM Evolution Roadmap

**Project:** Arrival Atlas  
**Document Type:** Architecture Specification  
**Domain:** Identity & Access Management (IAM)  
**Status:** Proposed / Foundation Phase  
**Version:** 0.1  
**Date:** June 2026  

**Related documents:**

- [P6.2 — Identity & Access Architecture Audit](../audits/p6-2-identity-access-architecture-audit.md)
- [User Profile Engine Design](../audits/user-profile-engine-design.md)
- [P5.0 — Full System Architecture Audit](../audits/p5-0-full-system-architecture-audit.md)

---

## 1. Executive Summary

Arrival Atlas currently operates on an **Anonymous Session System** where `sessionId` is both identity and credential. This is documented in [P6.2](../audits/p6-2-identity-access-architecture-audit.md) (Identity Maturity Score: 28/100, Level 1).

This specification defines a controlled evolution path toward a **Hybrid Account-Centric IAM architecture**, enabling:

- persistent user identity
- multi-device support
- module-based authorization
- subscription and premium monetization
- safe migration from anonymous sessions

The design explicitly preserves the existing **DPSS** (Durable Persisted System State) pipeline and `SystemState` model. IAM is introduced as an **overlay above the coordinator**, not a replacement for the persistence or projection layers.

```
Current:   Browser → localStorage(sessionId) → x-session-id → API → SystemState(sessionId)

Target:    Browser → auth token → API → accountId + sessionId → SystemState (account-linked)
```

---

## 2. Current State (As-Is)

### 2.1 Identity Model

| Concept | Current implementation |
|---------|---------------------|
| User account | Does not exist |
| Authentication | Does not exist |
| `sessionId` role | Identity **and** credential **and** storage primary key |
| Authorization | Possession-based — presenter of `sessionId` receives full session scope |

### 2.2 System Characteristics

- Fully anonymous system
- Session-bound state: one `SystemState` JSON file per `sessionId` (`.arrivalos-state/{sessionId}.json`)
- All mutations flow through `SystemStateCoordinator.applyMutation()`
- UI reads via pure projection: `buildUiSnapshot(state)`
- No ownership verification
- No account linkage
- No cross-device continuity

### 2.3 Current `SystemState` Shape

```typescript
// apps/api/src/state/system-state-types.ts (simplified)
type SystemState = {
  session: Session;
  profileRecord: ProfileRecord | null;
  profileRevisions: ProfileRevision[];
  executionsByModuleId: Record<string, StoredModuleExecution[]>;
  executionTracesByModuleId: Record<string, ExecutionTrace[]>;
  events: TrackedEvent[];
  modules: SystemModuleDescriptor[];
  projectionConfig: SystemProjectionConfig;
  generatedAt: string;
  version: SnapshotVersionState;
};
```

Identity is carried only inside `session.id`. No `accountId` field exists.

### 2.4 Core Limitation

> Identity is ephemeral and non-transferable.

| Consequence | Impact |
|-------------|--------|
| No multi-device support | Each browser creates an isolated session |
| No recovery | Lost `sessionId` = lost access to state |
| No subscriptions | No stable principal to attach billing |
| No entitlement system | All modules equally accessible |
| No monetization layer | No tier or feature gating |

---

## 3. Target State (To-Be)

### 3.1 Identity Model

The system evolves to a **hybrid model**:

| Layer | Principal | Role |
|-------|-----------|------|
| **Primary identity** | `accountId` | Stable user identity across devices and sessions |
| **Secondary identity** | `sessionId` | Device/runtime execution context |
| **Authentication subject** | `authSubject` | OAuth `sub` or equivalent — binds external IdP to `accountId` |

### 3.2 Ownership Model

**Phase 1–3 (transitional):**

```
Account (1) ─── (N) Sessions
Session (1) ─── (1) SystemState file
```

Each session retains its own `SystemState` blob. Sessions linked to the same account share identity but not necessarily a merged state file during early phases.

**Phase 5 (mature):**

```
Account (1) ─── (N) Sessions
Account (1) ─── (1) canonical SystemState aggregate (or account-indexed primary state)
```

Long-term consolidation strategy (single vs. sharded state per account) is deferred to Phase 5 planning. Early phases optimize for **additive compatibility**, not state merging.

### 3.3 `SystemState` Evolution

**Current (implicit keying):**

```
SystemState {
  session: { id: sessionId, ... }
  profileRecord, executions, traces, events, ...
}
```

**Phase 1 (additive field):**

```typescript
type SystemState = {
  accountId: string | null;   // NEW — null for anonymous sessions
  session: Session;
  // ... existing fields unchanged
};
```

**Phase 5 (target reference model):**

```typescript
type SystemState = {
  accountId: string | null;
  session: Session;
  linkedSessionIds?: string[];  // optional index for multi-device (Phase 5)
  // ... existing fields unchanged
};
```

> **Rule:** `sessionId` remains the **mutation key** and file key through Phase 1–4. `accountId` is metadata and authorization scope, not an immediate storage partition key.

### 3.4 Target IAM Stack

```
┌─────────────────────────────────────────┐
│  Identity Providers (OAuth / email)      │  Phase 3+
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  Authentication Middleware               │  Phase 3+
│  (token validation, authSubject)         │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  Authorization & Entitlements            │  Phase 4+
│  (account ownership, module gates)       │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  SystemStateCoordinator (DPSS)           │  Existing — preserved
│  applyMutation() → FilePersistedStore      │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  buildUiSnapshot(state) [pure]           │  Existing — preserved
└─────────────────────────────────────────┘
```

---

## 4. Architecture Principles

### 4.1 Backward Compatibility First

All changes must:

- preserve existing anonymous session flows
- avoid breaking current API consumers
- allow progressive adoption per phase

### 4.2 Identity Separation Principle

> **session ≠ identity**

| Term | Meaning |
|------|---------|
| **Session** | Execution context, device binding, mutation scope |
| **Account** | Stable user identity, entitlements, billing, recovery |

`sessionId` must cease to function as a credential in later phases. It becomes an internal runtime handle.

### 4.3 Additive Evolution Only

Phases 1–2 impose **no destructive changes**:

- no removal of session-based access
- no forced authentication
- no migration requirements for existing anonymous users

### 4.4 DPSS Preservation

`SystemState` remains the **core persistence unit**. The coordinator remains the **sole write path**.

IAM is:

> an overlay, not a replacement

Forbidden in early phases:

- bypassing `SystemStateCoordinator` for profile or execution writes
- splitting write authority across IAM store and `SystemState` without a defined sync model
- replacing file-backed persistence with a database as a prerequisite for IAM

### 4.5 Fail-Closed Authorization (Phase 3+)

Once authentication is introduced for a route class:

- missing or invalid credentials → deny
- session not owned by authenticated account → deny
- insufficient entitlement → deny

Anonymous access remains only on explicitly allowlisted paths.

---

## 5. Evolution Phases

### Phase 1 — Identity Foundation

**Goal:** Introduce the account concept without affecting existing system behavior.

**Changes:**

| Deliverable | Description |
|-------------|-------------|
| Account domain model | `Account` entity: `id`, `createdAt`, `status`, optional `authSubject` (null in Phase 1) |
| Account persistence | File-based store parallel to `SystemState` (e.g. `.arrivalos-accounts/{accountId}.json`) — consistent with DPSS approach |
| `SystemState` augmentation | `accountId: null` default on all new and existing sessions |
| Account index (optional) | Lightweight map `sessionId → accountId` for lookup |
| Coordinator mutation | New mutation type: `ACCOUNT_CREATE` (internal only in Phase 1) |

**Non-changes:**

- No authentication required
- No UX changes
- No new public routes (or read-only diagnostics only)
- Anonymous `POST /api/sessions` unchanged

**Outcome:**

- System is **account-aware**
- Data model ready for claim and auth layers
- Zero impact on current users

---

### Phase 2 — Account Claim Mechanism

**Goal:** Bind anonymous sessions to accounts without invalidating existing sessions.

**New capability:**

```
POST /api/account/claim
```

**Request (conceptual):**

```json
{
  "sessionId": "sess_...",
  "claimToken": "optional-one-time-token"
}
```

**Behavior:**

1. Validate `sessionId` exists and `SystemState.accountId` is `null`
2. Create `accountId` (or accept pre-created account)
3. Set `SystemState.accountId = accountId`
4. Write account index: `sessionId → accountId`
5. Emit `ACCOUNT_CLAIM` event in `SystemState.events`

**Authorization (Phase 2):**

- Claim requires proof of session possession (same as today: `x-session-id` header)
- Future Phase 3 replaces possession proof with authenticated subject

**Edge cases:**

| Case | Policy |
|------|--------|
| Session already claimed | `409 Conflict` |
| Session not found | `404` |
| Duplicate claim attempts | Idempotent return of existing `accountId` |
| Orphan sessions (never claimed) | Retained indefinitely in Phase 2; TTL policy in Phase 5 |

**Outcome:**

- First step toward real identity
- Backward-compatible migration path established
- Aligns with `user-profile-engine-design.md` §7.4 guest upgrade intent

---

### Phase 3 — Authentication Layer Introduction

**Goal:** Introduce verified identity and server-issued session tokens.

**Features:**

| Feature | Description |
|---------|-------------|
| OAuth / OIDC | Google, Microsoft, GitHub, Apple, Keycloak, Auth0 |
| Email magic link | Optional secondary provider |
| `authSubject` | Stable IdP subject bound to `accountId` |
| Server session tokens | HttpOnly secure cookies or short-lived JWT |
| Ownership validation | `session.accountId === auth.accountId` on all scoped routes |

**API changes:**

| Route class | Phase 3 behavior |
|-------------|------------------|
| `POST /api/sessions` | Creates session; if authenticated, auto-links to `accountId` |
| `GET/PATCH /api/sessions/:id` | Requires auth; validates account ownership |
| Profile / snapshot / execute | Requires auth **or** anonymous allowlist (configurable) |
| `POST /api/account/claim` | Requires authenticated `authSubject`; binds session to auth account |

**Client changes:**

- Replace bare `localStorage(sessionId)` as credential with server-issued token
- `sessionId` may remain in client for convenience but is **not** the security boundary

**Outcome:**

- Session theft no longer equals permanent account takeover (revocable tokens)
- Cross-device login becomes possible via shared `accountId`

---

### Phase 4 — Authorization & Entitlements Layer

**Goal:** Enable monetization and module-level access control.

**Introduced concepts:**

```typescript
type AccountEntitlements = {
  tier: 'free' | 'premium' | 'enterprise';
  modules: string[];           // allowed module IDs
  features: Record<string, string[]>;  // moduleId → feature flags
  expiresAt?: string;          // subscription expiry
};
```

**Module access model:**

Each module registers:

| Attribute | Example |
|-----------|---------|
| `visibility` | `public` \| `private` \| `beta` |
| `access` | `free` \| `premium` \| `restricted` |
| `features` | `{ free: [...], premium: [...] }` |

**Enforcement point:**

```
POST /api/modules/:id/execute
  → auth middleware (account resolved)
  → entitlement check (module + feature)
  → SystemStateCoordinator.applyMutation(MODULE_EXECUTE)
```

**Example — Profile module:**

| Tier | Capability |
|------|------------|
| Free | Basic profile view and edit |
| Premium | Analytics, insights, revision export |

**Outcome:**

- Structural support for subscriptions
- Module gates without breaking DPSS write path

---

### Phase 5 — Multi-Device & Advanced IAM

**Goal:** Full identity platform capabilities.

**Features:**

| Feature | Description |
|---------|-------------|
| Multi-device session sync | New device login → new `sessionId` linked to same `accountId` |
| Session revocation | Per-device and global revoke |
| Login history | Auth events per account |
| Device registry | Trusted device list |
| Account recovery | Email/OAuth-based recovery flows |
| Anonymous session TTL | Expire unclaimed sessions (e.g. 90 days inactive) |
| State consolidation (optional) | Account-primary `SystemState` with session shards |

**Outcome:**

- Identity Maturity Level 4 target (Multi-Device Identity Platform)
- Production-grade IAM suitable for public deployment

---

## 6. Module Monetization Model

Modules become first-class IAM-controlled entities.

### 6.1 Module IAM Metadata

```typescript
type ModuleIamPolicy = {
  moduleId: string;
  visibility: 'public' | 'private' | 'beta';
  defaultAccess: 'free' | 'premium' | 'restricted';
  features: {
    [featureId: string]: {
      access: 'free' | 'premium' | 'restricted';
      description: string;
    };
  };
};
```

### 6.2 Enforcement Layers

| Layer | Checks |
|-------|--------|
| **Route** | Is module enabled in registry? |
| **Entitlement** | Does `account.tier` permit module? |
| **Feature** | Does requested feature require premium? |
| **Projection** | `UiSnapshot.modules` filtered by entitlements (read path) |

### 6.3 Snapshot Integration

`buildUiSnapshot(state)` receives entitlement context:

- modules list filtered by account tier
- UX cards may include upgrade prompts for gated features
- No entitlement data stored inside `SystemState` — resolved at projection time from account store

---

## 7. Migration Strategy

### 7.1 Strategy Type: Hybrid Evolution

```
anonymous sessions  →  account claim (Phase 2)
                    →  authenticated sessions (Phase 3)
                    →  entitlements (Phase 4)
                    →  multi-device platform (Phase 5)
```

### 7.2 Migration Rules

| Rule | Phase |
|------|-------|
| No existing session invalidated | Phase 1–2 |
| `accountId` defaults to `null` | Phase 1 |
| Claim is explicit user action | Phase 2 |
| Authentication optional until public deploy gate | Phase 3 |
| Never merge two profiles without user confirmation | All phases |

### 7.3 Data Migration Matrix

| Asset | Phase 1 | Phase 2 (claim) | Phase 3 (auth) |
|-------|---------|-----------------|----------------|
| `SystemState` blob | `accountId: null` added | `accountId` set | ownership validated |
| Profile + revisions | Unchanged | Moves with session | Scoped to account |
| Execution history | Unchanged | Moves with session | Scoped to account |
| Client `localStorage` | Unchanged | Optional claim UX | Token replaces raw `sessionId` |

---

## 8. Key Design Decisions

### 8.1 Session Persistence

- Remains file-based (`SystemState`) in Phases 1–4
- Database (`DATABASE_URL` in `.env.example`) is **not** a Phase 1–3 prerequisite
- Account store mirrors `SystemState` file-backed pattern for operational consistency

### 8.2 Identity Introduction

- Account layer is **additive**
- No forced login at start
- Public deployment gate requires Phase 3 minimum (per P6.2)

### 8.3 Ownership Model Progression

| Phase | Ownership model |
|-------|-----------------|
| Current | Implicit — session possession |
| Phase 1 | Latent — `accountId` field exists but unused |
| Phase 2 | Claimed — session bound to account on user action |
| Phase 3+ | Explicit — `authSubject` verifies account ownership |

### 8.4 Route Authorization Consistency

Phase 3 must eliminate the current split where:

- profile routes use `x-session-id` header
- session routes use URL path only with **no credential**

All session-scoped routes converge on: **authenticated subject + session ownership check**.

---

## 9. Risks & Constraints

### 9.1 Identity Split Complexity

**Risk:** `sessionId` / `accountId` divergence; inconsistent authorization state across routes.

**Mitigation:**

- Single authorization middleware (Phase 3+)
- `sessionId → accountId` index as source of truth for ownership
- Coordinator rejects mutations where `session.accountId !== auth.accountId`

### 9.2 Migration Edge Cases

| Edge case | Policy (TBD in Phase 2 spec) |
|-----------|------------------------------|
| Orphan sessions | Retain; optional TTL in Phase 5 |
| Unclaimed data | User must explicitly claim |
| Duplicate accounts | One `authSubject` → one `accountId` |
| Multi-session per account | Allowed; no auto-merge of `SystemState` blobs |

### 9.3 Security Model Transition

| | Current | Target |
|--|---------|--------|
| Model | Possession-based (`sessionId` = credential) | Token-based authenticated identity |
| Cross-session access | Trivial if ID known | Prevented by account binding |
| Recovery | None | OAuth / email recovery (Phase 5) |

### 9.4 DPSS Constraints

- IAM mutations that modify `SystemState` must use existing mutation types or registered extensions (`ACCOUNT_CLAIM`, etc.)
- Account store writes must not race with coordinator session writes — use coordinator orchestration or post-mutation hooks

---

## 10. Success Criteria

IAM evolution is considered successful when:

| Criterion | Target phase |
|-----------|--------------|
| Account layer exists | Phase 1 |
| `sessionId` is no longer identity | Phase 3 |
| Modules can be gated by entitlement | Phase 4 |
| Users persist across devices | Phase 5 |
| Monetization structurally supported | Phase 4 |
| Identity Maturity Score ≥ 70 | Phase 5 |
| Public deployment IAM gate passed | Phase 3 minimum |

---

## 11. Phase 1 — Implementation Scope

**Status:** Next step — proceed with Phase 1 implementation.

### 11.1 Minimal Deliverables

| # | Deliverable |
|---|-------------|
| 1 | `Account` domain model and types |
| 2 | File-based account persistence layer (`.arrivalos-accounts/`) |
| 3 | `SystemState.accountId: string \| null` augmentation |
| 4 | `ACCOUNT_CREATE` internal mutation (no public API yet) |
| 5 | Migration-safe defaults: all existing sessions load with `accountId: null` |
| 6 | Tests: account store round-trip; `SystemState` backward compatibility on load |

### 11.2 Explicit Non-Goals (Phase 1)

- No authentication or OAuth
- No public account API routes
- No client UX changes
- No entitlement or billing logic
- No breaking changes to session system
- No database introduction

### 11.3 Acceptance Criteria

- All existing API tests pass unchanged
- New sessions persist with `accountId: null`
- Legacy `SystemState` files without `accountId` load correctly (default `null`)
- Coordinator remains sole write path for `SystemState`
- `buildUiSnapshot()` behavior unchanged for anonymous sessions

---

## 12. Appendix — Phase Summary Table

| Phase | Name | Auth required | Public API changes | Identity level |
|-------|------|---------------|-------------------|----------------|
| **0** | Current | No | — | Level 1 — Anonymous Session |
| **1** | Identity Foundation | No | None | Level 1+ (account-aware) |
| **2** | Account Claim | No (possession) | `POST /api/account/claim` | Level 1+ → 2 |
| **3** | Authentication | Yes (scoped) | OAuth, token cookies | Level 3 — Production Auth |
| **4** | Entitlements | Yes | Module gates | Level 3+ |
| **5** | Multi-Device IAM | Yes | Device mgmt, recovery | Level 4 — Multi-Device Platform |

---

## 13. References

| Document | Relevance |
|----------|-----------|
| [P6.2 Identity & Access Architecture Audit](../audits/p6-2-identity-access-architecture-audit.md) | As-is analysis, gap matrix, migration options |
| [User Profile Engine Design](../audits/user-profile-engine-design.md) | Guest profile, claim flow, future PostgreSQL schema |
| `apps/api/src/state/system-state-coordinator.ts` | Sole write path — IAM hooks attach here |
| `apps/api/src/state/system-state-types.ts` | `SystemState` shape to augment |
| `apps/api/src/state/persisted-system-state-store.ts` | File persistence pattern for account store |

---

*End of IAM Evolution Roadmap v0.1*
