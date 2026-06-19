---
id: profile-system-v1-roadmap
title: Profile System v1 Roadmap
project: Arrival Atlas
system: Arrival Atlas
type: roadmap
domain: identity
status: active
maturity: stable
owner: system
tags:
  - profile-engine
  - user-context
  - snapshot-integration
created: 2026-06-01
updated: 2026-06-19
related:
  - profile-ux-spec
---

# User Profile System v1 — Architecture Research & Roadmap

**Date:** 2026-06-18  
**Mode:** Read-only architecture research (no implementation)  
**System:** Arrival Atlas  
**Status:** Roadmap proposal  
**Supersedes (partially):** [user-profile-engine-design.md](../identity/user-profile-engine-design.md) header status — much of UPE Phase 0–1 is now built; this document defines **Profile System v1** as the next coherent tranche.

---

## 1. Executive Summary

Arrival Atlas already has a **substantial profile foundation** that is not yet a unified "Profile System v1" product surface:

| Layer | What exists today |
|-------|-------------------|
| **Domain engine** | `@arrival-atlas/profile` — typed `ProfileDocument`, policy, merge, trace, activation |
| **Persistence** | Session-scoped `SystemState.profileRecord` (file-backed per session) |
| **API** | `POST/GET/PATCH /api/profile`, revision concurrency, `UIProfileResponse` |
| **Execution** | `resolveExecutionContext()` hydrates `AppContext.profileSlice` before governance |
| **Snapshot** | `UiSnapshot.profile` + `UiSnapshot.session` + `UiSnapshot.ftu` |
| **Web** | Reads profile via snapshot for form defaults; **no profile CRUD client** |

Profile data is **split across two stores** with different semantics:

```text
Session AppContext.userProfile     →  UI prefs (language, theme)
ProfileDocument (profileRecord)    →  Domain facts (employment, housing, …)
```

The platform is **UI READY** and **contract-driven**. Profile System v1 must evolve **without**:

- weakening the Governance Kernel
- leaking runtime internals into web
- coupling modules to UI concerns
- using profile to alter deterministic execution outcomes (constraint of this research)

**Recommendation:** Profile System v1 should be anchored as a **Dedicated User Context Layer** (`@arrival-atlas/profile` + product-contract projection types), with **session-scoped persistence in v1** and explicit boundary rules separating **UI preferences**, **domain profile**, and **execution context**.

Target maturity: a **coherent, UI-addressable user context** that modules consume through existing pipelines — not a large user database or account-centric identity platform in v1.

---

## 2. Current State Analysis

### 2.1 Profile-relevant data map

```text
Current Profile-Relevant Data
        ↓
Owners
        ↓
Consumers
```

| Data | Shape / location | Owner | Scope | Consumers |
|------|------------------|-------|-------|-----------|
| **UI language** | `AppContext.userProfile.language` | `@arrival-atlas/core` → `SystemState.session` | Session-persisted | Web selectors, i18n, execute context override, UiSnapshot.session |
| **Theme** | `AppContext.userProfile.uiPreferences.theme` | `@arrival-atlas/core` → session | Session-persisted | Web `AppProvider`, UiSnapshot.session |
| **Legacy session fields** | `income`, `householdSize`, `residencyStatus` in `UserProfileSchema` | `@arrival-atlas/core` | Session | Legacy; largely superseded by `ProfileDocument` |
| **Profile document** | `ProfileDocument` (employment, housing, insurance, benefits, …) | `@arrival-atlas/profile` → `SystemState.profileRecord` | Session-bound, file-persisted | Execution merge, snapshot, profile API, activation on execute |
| **Profile slice** | Policy-filtered view per module | `@arrival-atlas/profile` policy layer | Per-execution | `AppContext.profileSlice`, module runtime context |
| **Profile revisions** | `ProfileRevision[]` audit trail | `@arrival-atlas/profile` → `SystemState` | Session | Profile API, engine |
| **Execution trace** | `ExecutionTrace` (profile load, policy, merge steps) | `@arrival-atlas/profile` → `SystemState.executionTracesByModuleId` | Session / diagnostic | API trace endpoints, profile integration tests |
| **FTU / onboarding** | `{ isFirstTimeUser, step? }` projected from session heuristics | `apps/api` snapshot projection | Session heuristic | UiSnapshot.ftu, home dashboard (display only) |
| **UiSnapshot.profile** | Full `ProfileDocument \| null` | Snapshot projection engine | Read-only projection | Web form defaults, home profile panel |
| **Form defaults merge** | `mergeProfileIntoDefaults()` | `@arrival-atlas/product-contract` | Client-side read | `ContractModulePage` — shallow top-level merge only |
| **Server input merge** | Field maps + strategies in `input-merger.ts` | `@arrival-atlas/profile` | Execute-time | Module execute pipeline |
| **Profile activation** | Module input → profile patch | `apps/api/profile-activation.ts` | Write on execute | `financial-reality`, `healthcare-navigation` |
| **Explanation profile factors** | `ExplanationFactor` source `'profile'` | `@arrival-atlas/product-contract` reason-mapping | Read-only in explain output | ExplainPanel (via Explain API) |
| **Module capability** | `'requires-profile'` | Module registry metadata | Declarative | **Not enforced** by governance kernel today |

### 2.2 Dual-store diagram (today)

```text
┌─────────────────────────────────────────────────────────────────┐
│                        SystemState (per session)                 │
├──────────────────────────────┬──────────────────────────────────┤
│ session.context              │ profileRecord + profileRevisions │
│  userProfile.language        │  ProfileDocument                 │
│  userProfile.uiPreferences   │   preferredLanguage              │
│  ftu (optional, sparse)      │   employment, housing, …         │
│  profileId (link)            │   extensions{moduleId: …}        │
└──────────────┬───────────────┴──────────────────┬───────────────┘
               │                                   │
               ▼                                   ▼
        UiSnapshot.session                   UiSnapshot.profile
        (language, theme)                    (full document)
               │                                   │
               └──────────────┬────────────────────┘
                              ▼
                         apps/web
                    (selectors + form merge)
```

### 2.3 Key gaps (roadmap drivers)

1. **No unified product concept** — profile engine exists; UX and contracts treat prefs and domain profile separately.
2. **Dual language** — `session.language` vs `profile.preferredLanguage` can diverge; no sync policy.
3. **Web read-only profile** — no `fetchProfile()` / `updateProfile()` in web; writes only via module execute activation (2 modules).
4. **Shallow form prefill** — `mergeProfileIntoDefaults` does not use server-side field maps; nested profile ≠ flat schema keys.
5. **FTU is projected, not managed** — heuristic only; no onboarding mutation API or web flow.
6. **Full document in snapshot** — modules get policy-filtered slice; UI gets full document (privacy review needed for v1).
7. **Session-bound, not account-bound** — profile does not follow account claim across sessions.
8. **Governance ignores profile** — `'requires-profile'` capability is declarative only.
9. **Design doc stale** — `user-profile-engine-design.md` says "not implemented"; engine + API largely exist.

### 2.4 What works well (preserve)

- `resolveExecutionContext()` as single execution entry for profile resolution
- Module profile policies (`ModuleProfilePolicy`) with field allowlists and redaction
- `UIProfileResponse` boundary — no engine leakage to UI API
- Profile revision concurrency (`If-Match` / 428)
- Snapshot as UI read model for session + profile + executions
- Contract-driven web with no runtime imports

---

## 3. Architectural Recommendation

### 3.1 Options evaluated

#### Option 1 — Web-only profile

Store profile in browser (`localStorage` / IndexedDB); web owns hydration.

| | |
|---|---|
| **Advantages** | Fast UI iteration; no API changes |
| **Disadvantages** | Breaks single source of truth; modules already consume server profile; violates UI Ready boundary (web becomes state owner); no cross-tab/server consistency |
| **Migration** | Low locally, high platform cost — diverges from existing `@arrival-atlas/profile` |
| **Contract compatibility** | Poor — execution expects server profile |
| **Scalability** | Poor for multi-device, account linking, audit |

**Verdict:** ❌ Reject — incompatible with current architecture.

---

#### Option 2 — Session Profile Layer

Extend `AppContext` / session mutations as the only profile store; fold domain fields into session context.

| | |
|---|---|
| **Advantages** | Single session API; already used for language/theme |
| **Disadvantages** | Conflates ephemeral prefs with versioned domain document; loses revision audit; `@arrival-atlas/profile` engine becomes redundant; schema sprawl in `@arrival-atlas/core` |
| **Migration** | High — reverse existing profile engine investment |
| **Contract compatibility** | Breaks `UIProfileResponse`, policy layer, merge strategies |
| **Scalability** | Poor — session JSON is not a profile domain model |

**Verdict:** ❌ Reject — regresses UPE architecture.

---

#### Option 3 — Product Contract Profile Layer

Define `UserProfileV1` only in `@arrival-atlas/product-contract`; snapshot and web consume it; engine adapts.

| | |
|---|---|
| **Advantages** | UI-safe types; aligns with UI Ready Gate; clear web boundary |
| **Disadvantages** | Product-contract should describe product views, not own persistence; duplicates `@arrival-atlas/profile` domain; risks contract bloat |
| **Migration** | Medium — projection mappers from engine → contract |
| **Contract compatibility** | Good for UI; needs careful separation from internal engine types |
| **Scalability** | Good for UI; engine remains separate concern |

**Verdict:** ⚠️ Partial — correct for **UI-facing projection types**, wrong as **ownership** layer.

---

#### Option 4 — Dedicated User Context Layer (recommended)

Keep `@arrival-atlas/profile` as domain owner; add **product-contract projections** for UI; coordinate via `SystemState` mutations and snapshot engine.

```text
@arrival-atlas/profile          ← domain owner (document, policy, merge, trace)
        ↓
apps/api/state              ← persistence coordinator (session-bound v1)
        ↓
@arrival-atlas/product-contract ← UI-safe projections (UserProfileView, SessionPrefsView)
        ↓
apps/web                    ← consumer only
```

| | |
|---|---|
| **Advantages** | Preserves kernel boundaries; reuses built engine; UI gets stable types; modules unchanged; explain/snapshot can project subsets |
| **Disadvantages** | Requires projection discipline; dual language must be resolved explicitly |
| **Migration** | Low-to-medium — mostly wiring + web client + projection types |
| **Contract compatibility** | Excellent — extends product-contract without changing ModuleUIProjection |
| **Scalability** | Strong path to account-bound profile (Phase P6+) without rewriting UI |

**Verdict:** ✅ **Recommend Option 4**

---

## 4. Recommended Profile Ownership Model

### 4.1 Ownership rules

| Concern | Owner | Rationale |
|---------|-------|-----------|
| Profile schema & validation | `@arrival-atlas/profile` | Domain authority |
| Module field access policy | `@arrival-atlas/profile` policy registry | Privacy minimization |
| Input merge & activation | `@arrival-atlas/profile` + `apps/api` mutations | Execution-adjacent, not UI |
| Persistence | `apps/api/state` (`SystemStateCoordinator`) | Single mutation pipeline |
| UI read model | Snapshot projection + optional `GET /api/profile` | UI Ready pattern |
| UI write model | `PATCH /api/profile`, `PATCH /api/sessions/:id` | Separate prefs vs domain patches |
| UI types | `@arrival-atlas/product-contract` (projections) | Web import boundary |
| Execution context | `resolveExecutionContext()` | Already canonical |

### 4.2 v1 persistence scope

**Profile System v1 = session-scoped, anonymous-first.**

- Profile survives reload **within the same sessionId** (already true with localStorage session + file persistence).
- Account linking and cross-session profile porting are **explicitly out of v1**.
- PostgreSQL / multi-device sync deferred to v2+.

### 4.3 Language unification policy (required decision in P1)

| Field | v1 canonical owner | Rule |
|-------|-------------------|------|
| UI i18n language | `ProfileDocument.preferredLanguage` | **Source of truth** |
| `session.userProfile.language` | Session projection | **Mirror** of profile preferredLanguage on read; PATCH session language updates profile preferredLanguage |

Theme remains **session-only** in v1 (UI chrome, not domain fact).

---

## 5. Boundary Rules

### 5.1 Governance Kernel — **MUST remain profile-independent**

| Question | Answer |
|----------|--------|
| Should profile affect execution authorization? | **No** in v1 — `authorizeExecution()` validates module registration, input schema, normalizer bindings only |
| Should profile affect execution results? | **No** (research constraint) — profile may **hydrate input defaults** before execute; it must not change module algorithms, scoring, or recommendation generation logic |
| Future (post-v1)? | Optional **declarative gate**: block execute if `'requires-profile'` and profile missing — authorization only, not outcome mutation |

**Rule:** Profile enters the pipeline **before** `authorizeExecution()` via `resolveExecutionContext()`. Governance kernel types stay free of profile fields.

---

### 5.2 Product Contract Layer

| Surface | Profile interaction in v1 | How |
|---------|---------------------------|-----|
| `ModuleUIProjection` | **No change** | Execution output unchanged by profile |
| `ModuleExplanationView` | **Read-only consumption** | Existing `'profile'` explanation factors stay; no new profile fields in explain shape |
| `UiSnapshot` | **Extend projection typing** | Replace loose `Record<string, unknown>` with `UserProfileView` projection; add optional `profileSummary` |
| `ContractSnapshot` | **No change** | Module input schema independent of user |
| Snapshot aggregation | **Optional filter** | Dashboard ordering may use profile **metadata flags**, not domain inference |

**Rule:** Product contract **projects** profile; it does not **own** profile storage.

---

### 5.3 Explainability Layer

| Question | Answer |
|----------|--------|
| Should explanation verbosity be profile-driven? | **Optional in P3** — e.g. `explanationDepth: 'brief' \| 'standard'` affects **UI rendering only**, not Explain API output shape |
| Should Explain API change? | **No** in v1 — same `ModuleExplanationView`; UI chooses how much to show |
| Profile factors in explanations | **Already supported** — keep as read-only semantic enrichment from execution |

**Rule:** Explain API remains ADL-compliant and profile-agnostic; UI personalizes **presentation**, not reasoning generation.

---

### 5.4 UI Layer

| Area | Profile-driven in v1? | Notes |
|------|----------------------|-------|
| Navigation module list | **Optional P4** | Order by `preferredModuleCategories`, not hardcoded |
| Category grouping | **No change** | Categories from `PublicModuleContract.metadata.category` |
| Capability visibility | **No change** | Capabilities from contract, not profile |
| Dashboard sections | **Optional P4** | Hide empty sections; FTU-aware home layout |
| Form defaults | **Yes P2** | Improved merge via shared field-map projection |
| Onboarding / FTU | **Yes P2–P4** | Explicit FTU state mutations |
| Theme / density | **Yes P1** | Session prefs via existing PATCH session |

**Rule:** UI consumes **projections and flags**; never imports `@arrival-atlas/profile` engine types.

---

### 5.5 Module SDK

| Question | Answer |
|----------|--------|
| Should module authors be aware of profiles? | **Yes — declaratively only** |
| How? | Existing `'requires-profile'` capability + merge strategy registration + policy registry entry |
| Should modules read raw profile? | **No** — only `context.profileSlice` after policy |
| Should modules write profile? | **Via activation maps only** — not direct store access |

**Rule:** SDK exposes **registration hooks** (policy, merge strategy, activation map); modules never bypass engine.

---

## 6. UserProfileV1 Proposal

### 6.1 Design principles

- **Minimal** — solve coherence, UI access, form prefill, onboarding state
- **Anonymous-first** — session-bound persistence
- **Projection-first** — UI never sees engine internals or policy documents
- **Explicit split** — prefs vs domain vs onboarding

### 6.2 Proposed types (product-contract projections)

```typescript
/** UI-safe session preferences (chrome only) */
type SessionPreferencesV1 = {
  theme: 'light' | 'dark' | 'system';
  uiDensity?: 'comfortable' | 'compact';   // v1 optional, default comfortable
};

/** Onboarding state (product-facing, not heuristic-only) */
type OnboardingStateV1 = {
  status: 'new' | 'in-progress' | 'completed';
  currentStep?: number;
  completedSteps?: number[];
};

/** Domain profile summary for UI (subset of ProfileDocument) */
type UserProfileViewV1 = {
  schemaVersion: '1.0.0';
  preferredLanguage: SupportedLanguage;
  completeness: {
    score: number;           // 0–100, computed server-side
    missingDomains: string[]; // e.g. ['employment', 'housing']
  };
  domains: {
    location?: { bundesland?: string; city?: string };
    residency?: { status?: string };
    household?: { size?: number; maritalStatus?: string };
    employment?: { status?: string; grossMonthlyIncome?: number };
    housing?: { monthlyColdRent?: number };
    insurance?: { type?: string; hasCoverage?: boolean };
    benefits?: { receivingBuergergeld?: boolean; daysInGermany?: number };
  };
  /** Never include policy, slice, trace, or raw extensions in v1 UI view */
};

/** Aggregated user context for UI consumption */
type UserContextV1 = {
  sessionPreferences: SessionPreferencesV1;
  onboarding: OnboardingStateV1;
  profile: UserProfileViewV1 | null;
  personalization?: {
    preferredModuleCategories?: string[];
    explanationDepth?: 'brief' | 'standard';
  };
};
```

### 6.3 In v1 scope

| Feature | Include | Rationale |
|---------|---------|-----------|
| `preferredLanguage` unification | ✅ | Fixes dual-language bug |
| Theme / uiDensity | ✅ | Already partial; formalize in projection |
| Onboarding state (explicit) | ✅ | Replace heuristic-only FTU |
| Profile completeness indicator | ✅ | Drives onboarding without changing execution |
| Web profile read/write client | ✅ | Closes persistence gap |
| Schema-aware form prefill | ✅ | Shared field maps from profile engine |
| `preferredModuleCategories` | ✅ optional P4 | Lightweight personalization |
| `explanationDepth` (UI-only) | ✅ optional P3 | Presentation toggle |
| Profile activation expansion | ✅ optional P2 | More modules write-back via maps |

### 6.4 Explicitly NOT in v1

| Feature | Defer | Reason |
|---------|-------|--------|
| Account-bound profile / PostgreSQL | v2+ | Identity scope expansion |
| Cross-device sync | v2+ | Requires account store |
| Profile-driven execution outcomes | Never (constraint) | Violates deterministic kernel |
| Profile-driven recommendation ranking | v2+ | Behavioral personalization |
| Notification preferences / push | v2+ | Infrastructure not present |
| Full profile editor UI (all domains) | v2+ | Start with onboarding + module forms |
| OAuth / identity provider | v2+ | Out of scope |
| Governance profile enforcement | v1.5 optional | Authorization gate only |
| Module-specific profile UI components | Never | Violates contract-driven UI |

---

## 7. Impact Analysis

| Package / area | Impact | Classification | Notes |
|----------------|--------|----------------|-------|
| **`apps/web`** | Profile CRUD client, onboarding components, improved form merge, UserContext hook | **Required** | Primary v1 deliverable |
| **`apps/api`** | Snapshot projection updates, onboarding mutations, language sync | **Required** | Coordinator + routes |
| **`packages/product-contract`** | `UserProfileViewV1`, `UserContextV1`, typed UiSnapshot profile | **Required** | Projection types only |
| **`packages/profile`** | Completeness calculator, field-map export for web merge, onboarding patch helpers | **Optional** | Small additive helpers |
| **Snapshot layer** (`snapshot-projection-engine`) | Project `UserContextV1`, explicit FTU from mutations | **Required** | Read model |
| **Explain layer** | None | **Should not change** | UI presentation only in P3 |
| **`packages/observability`** | Profile completeness metrics (ops) | **Optional** | Passive counts |
| **`packages/module-sdk`** | Document `'requires-profile'` registration pattern | **Optional** | Docs + examples |
| **`packages/module-runtime` / governance** | Profile gate enforcement | **Should not change** in v1 | Optional v1.5 |
| **`packages/modules`** | More activation maps | **Optional** | Per-module |
| **`packages/core`** | Deprecate legacy `UserProfile` income/household fields | **Optional** | Cleanup |
| **`packages/ui-contract`** | None | **Should not change** | Branding/i18n only |

### 7.1 File-level hotspots (estimated)

| Path | Likely touch |
|------|--------------|
| `apps/web/src/lib/api.ts` | Add profile client functions |
| `apps/web/src/components/ContractModulePage.tsx` | Schema-aware merge |
| `apps/web/src/components/AppProvider.tsx` | UserContext from snapshot |
| `apps/web/src/components/home/HomeSnapshotRenderer.tsx` | Onboarding-aware layout |
| `apps/api/src/state/snapshot-projection-engine.ts` | UserContext projection |
| `apps/api/src/routes/profile.ts` | Completeness in response (optional) |
| `apps/api/src/state/system-mutation-types.ts` | `ONBOARDING_UPDATE` mutation |
| `packages/product-contract/src/ui/` | New UserContext types |
| `packages/product-contract/src/schema/` | Shared merge helper or re-export field maps |
| `packages/profile/src/engine/input-merger.ts` | Export field map registry for web |

---

## 8. Migration Risks

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | Dual language divergence during migration | Medium | P1 sync policy + tests |
| R2 | Full profile in snapshot exposes sensitive fields to UI | Medium | P1 `UserProfileViewV1` subset projection |
| R3 | Shallow merge fix breaks existing forms | Medium | Golden tests per module schema |
| R4 | Onboarding mutations conflict with FTU heuristic | Low | P2: heuristic fallback until mutation written |
| R5 | Web profile writes bypass revision concurrency | Medium | Reuse `If-Match` pattern from profile API |
| R6 | Scope creep into account-bound profile | High | Hard v1 scope gate in roadmap |
| R7 | Profile starts influencing execution outcomes | High | Architecture review gate per phase |
| R8 | `@arrival-atlas/core` UserProfile schema drift | Low | Deprecation path in P5 |
| R9 | Duplicate `packages/profile/src/* 2/` confusion | Low | Cleanup chore parallel to P0 |

---

## 9. Detailed Phased Roadmap

### Phase P0 — Architecture Foundations

**Goal:** Align documentation, types, and boundaries before feature work.

| Item | Deliverable |
|------|-------------|
| P0.1 | Update stale UPE design doc status; link this roadmap |
| P0.2 | ADR: language canonical owner, theme session-only, profile execution boundary |
| P0.3 | Define `UserContextV1` / `UserProfileViewV1` in product-contract (types only) |
| P0.4 | Inventory legacy `UserProfile` fields vs `ProfileDocument` — deprecation list |

**Affected packages:** `docs/`, `packages/product-contract` (types)  
**Risks:** None — documentation only  
**Success criteria:** Boundary ADR approved; types compile; no runtime changes

---

### Phase P1 — User Context Contract

**Goal:** Stable UI-facing user context projection in snapshot and profile API.

| Item | Deliverable |
|------|-------------|
| P1.1 | Snapshot projects `userContext: UserContextV1` (or extends UiSnapshot) |
| P1.2 | `UserProfileViewV1` replaces loose `UiSnapshot.profile` typing |
| P1.3 | Language sync: PATCH session language ↔ `profile.preferredLanguage` |
| P1.4 | Web: `fetchProfile`, `updateProfile`, `updateSessionPreferences` clients |
| P1.5 | Web: consume typed `userContext` in AppProvider |

**Affected packages:** `apps/api`, `packages/product-contract`, `apps/web`  
**Risks:** R1, R2, R5  
**Success criteria:**

- Web reads/writes profile via API with revision headers
- Single effective language across session + profile
- Snapshot contains typed UserContext; web has zero `Record<string, unknown>` profile access
- All existing tests green; new contract projection tests

---

### Phase P2 — Snapshot & Form Integration

**Goal:** Reliable form prefill and profile write-back without execution semantics change.

| Item | Deliverable |
|------|-------------|
| P2.1 | Export module field maps from `@arrival-atlas/profile` for web merge |
| P2.2 | Replace shallow `mergeProfileIntoDefaults` with schema-aware merge in product-contract |
| P2.3 | Explicit onboarding mutations (`ONBOARDING_UPDATE`) — replace heuristic-only FTU |
| P2.4 | Profile completeness scoring in snapshot projection |
| P2.5 | Expand profile activation maps (1–2 additional modules) |

**Affected packages:** `apps/api`, `packages/profile`, `packages/product-contract`, `apps/web`  
**Risks:** R3, R4  
**Success criteria:**

- Module forms prefill from nested profile via field maps (financial-reality golden test)
- FTU state writable and readable from web
- Completeness score visible in snapshot
- Execute/explain outputs unchanged (regression suite)

---

### Phase P3 — Explain Presentation Personalization

**Goal:** UI adapts explain presentation; Explain API unchanged.

| Item | Deliverable |
|------|-------------|
| P3.1 | Add `personalization.explanationDepth` to UserContext |
| P3.2 | ExplainPanel respects depth — brief hides per-item detail, standard shows all |
| P3.3 | Session preference PATCH for explanation depth |

**Affected packages:** `apps/web`, `apps/api` (session mutation), `packages/product-contract`  
**Risks:** R7 (must be UI-only)  
**Success criteria:**

- Explain API responses identical across depth settings
- UI rendering differs; boundary tests prove no API shape change
- `explain-ui-boundary.test.ts` still green

---

### Phase P4 — UI Personalization

**Goal:** Dashboard and navigation adapt to user context without module-specific code.

| Item | Deliverable |
|------|-------------|
| P4.1 | Onboarding-aware home layout (FTU → guided empty states) |
| P4.2 | Optional category ordering via `preferredModuleCategories` |
| P4.3 | Profile completeness prompts (non-blocking banners) |
| P4.4 | Hide snapshot recommendation/action sections when profile prefs indicate minimal dashboard |

**Affected packages:** `apps/web`, `apps/api` (projection)  
**Risks:** R6 scope creep  
**Success criteria:**

- No hardcoded module logic added
- Category navigation still contract-driven
- Onboarding flow completable end-to-end in web

---

### Phase P5 — Hardening & Future Expansion Gate

**Goal:** Close debt; prepare v2 account-bound profile without implementing it.

| Item | Deliverable |
|------|-------------|
| P5.1 | Deprecate legacy `UserProfile.income/householdSize` in `@arrival-atlas/core` |
| P5.2 | Optional: governance `'requires-profile'` authorization gate (no outcome change) |
| P5.3 | Ops: profile completeness + onboarding funnel metrics (observability) |
| P5.4 | v2 RFC: account-bound profile, PostgreSQL, cross-session porting |
| P5.5 | Cleanup duplicate `packages/profile/src/* 2/` trees |

**Affected packages:** all (light touches), `docs/identity/ or docs/platform/ or docs/finance/`  
**Risks:** R8  
**Success criteria:**

- Profile System v1 sign-off audit
- v2 RFC approved or deferred with explicit non-goals
- 439+ tests green; new profile UI integration tests

---

### Roadmap timeline (suggested)

```text
P0  Architecture foundations     (1 sprint)
P1  User Context Contract         (1–2 sprints)  ← blocking
P2  Snapshot & Form Integration   (1–2 sprints)
P3  Explain presentation          (0.5 sprint)   ← parallel after P1
P4  UI Personalization            (1 sprint)
P5  Hardening & v2 gate            (0.5 sprint)
```

---

## 10. Final Recommendation

### What Profile System v1 should be

Profile System v1 is **not a new database or identity platform**. It is the **productization of existing profile infrastructure** into a coherent, UI-addressable **User Context Layer** that:

1. Unifies language and formalizes session preferences
2. Exposes typed, privacy-aware profile projections to the contract-driven web
3. Enables reliable form prefill and explicit onboarding state
4. Supports light UI personalization without touching execution semantics
5. Preserves all UI Ready Gate guarantees

### Architectural placement

**Option 4 — Dedicated User Context Layer** with:

- **Domain owner:** `@arrival-atlas/profile`
- **Persistence coordinator:** `apps/api/state`
- **UI projections:** `@arrival-atlas/product-contract`
- **Consumer:** `apps/web` (read/write via API only)

### What must remain profile-independent

| Layer | Independence rule |
|-------|-------------------|
| Governance Kernel | No profile fields in authorization types |
| Module algorithms | Profile hydrates input; does not change scoring logic |
| ModuleUIProjection | Output shape unchanged |
| ModuleExplanationView | API output unchanged; UI may trim presentation |
| Explain API | No profile query params in v1 |
| Module SDK | Declarative registration only |

### Recommended starting point

**Begin with Phase P1 (User Context Contract)** — highest signal, lowest risk:

- Typed snapshot projection
- Web profile client
- Language unification

This unlocks P2 form integration and all subsequent UI personalization without backend architecture churn.

### Success statement

| Milestone | Platform state |
|-----------|----------------|
| **Today** | Profile engine exists; UI reads snapshot opportunistically; dual-store friction |
| **After P1** | Coherent UserContext contract; web can read/write profile safely |
| **After P2** | Forms prefilled reliably; onboarding explicit |
| **After P4** | Personalized contract-driven UI without module-specific code |
| **After P5** | Profile System v1 complete; v2 account scope ready to design |

---

## Appendix A — Related Documents

| Document | Relevance |
|----------|-----------|
| [user-profile-engine-design.md](../identity/user-profile-engine-design.md) | Original UPE proposal (partially implemented) |
| [user-profile-engine-runtime-unification-report.md](../archive/user-profile-engine/runtime-unification-report.md) | `resolveExecutionContext()` |
| [user-profile-engine-policy-layer-report.md](../archive/user-profile-engine/policy-layer-report.md) | Module profile policies |
| [user-profile-engine-ui-contract-report.md](../archive/user-profile-engine/ui-contract-report.md) | `UIProfileResponse` |
| [ui-architecture-audit.md](../audits/ui-architecture-audit.md) | Web scalability; shallow merge gap |
| [ui-ready-gate-audit.md](../audits/ui-ready-gate-audit.md) | Boundary guarantees to preserve |
| [roadmap-vs-current-state.md](../platform/roadmap-vs-current-state.md) | Platform phase completion status |

---

## Appendix B — Research Method

Read-only exploration across:

- `packages/profile/` — engine, policy, merge, trace, API types
- `packages/core/` — `AppContext`, `UserProfileSchema`
- `packages/product-contract/` — UiSnapshot, schema defaults, explain mapping
- `apps/api/` — profile routes, snapshot projection, activation, SystemState
- `apps/web/` — AppProvider, selectors, ContractModulePage, HomeSnapshotRenderer
- `packages/module-runtime/governance/` — authorization boundary
- Existing audits and integration tests

**No code was modified during this research.**
