---
id: p5-0-full-system-architecture-audit
title: P5.0 Full System Architecture Audit
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: platform
status: active
maturity: stable
owner: system
tags:
  - system-design
created: 2026-06-01
updated: 2026-06-19
related:
---

# P5.0 — Full System Architecture Audit

**Role:** Principal Systems Architect / Distributed Systems Auditor  
**Date:** June 2026  
**Mode:** Read-only deep architecture audit (NO CODE CHANGES)  
**Scope:** Entire repository — frontend, backend, shared core  
**Baseline:** Post-P4.4 (snapshot-driven language, theme, UX, module reconstruction)

---

## 1. Executive Summary

### System Status: **PARTIAL**

The Arrival Atlas web application has achieved **strong UI-layer unification** under `UiSnapshot` after P0–P4.4. The frontend treats `UiSnapshot` as the authoritative read model for persisted user-visible state: module results, profile-mapped form defaults, UX cards, language, and theme.

However, at the **system level**, `UiSnapshot` is **not** a single source-of-truth state model. It is a **computed aggregate projection** assembled at read time from **five independent in-memory write stores**. Multiple API surfaces bypass the snapshot entirely. Several domains are incomplete in the projection. All server state is ephemeral.

### Primary Architectural Conclusion

> **UiSnapshot is a UI consistency layer and read-model aggregator — not a system-wide canonical state store.**

The system implements a **multi-store write model + snapshot read model** pattern (CQRS-lite), not a unified state machine. P3–P4 successfully made the **client** deterministic relative to the snapshot; they did not collapse backend write authority into one model.

### Biggest Systemic Risk

**Ephemeral multi-store backend + incomplete projection.** A client holding a valid `sessionId` in localStorage after API restart receives an empty or default snapshot while believing it has persistent state. Concurrent writes can produce version/content skew because `snapshotVersion` does not cover all mutating paths (session PATCH).

---

## 2. Primary Audit Question — Explicit Answer

### Is UiSnapshot a true system-wide projection of a single source-of-truth state model?

**Answer: NO — PARTIAL at the UI boundary only.**

| Layer | Verdict |
|-------|---------|
| **Web UI (post-P4)** | UiSnapshot is authoritative for rendered persisted state ✅ |
| **Backend system** | Multiple independent write stores; snapshot is derived, not canonical ❌ |
| **Cross-device / restart** | Snapshot does not reconstruct full system truth ❌ |
| **Alternative API consumers** | Can read/write outside snapshot pipeline ❌ |

**Evidence:** `buildUiSnapshot()` reads from `getSession()`, `profileEngine`, `listModuleExecutionsForSession()`, `getSnapshotVersionState()`, and `globalRegistry` — five distinct sources (`apps/api/src/routes/ui-snapshot.ts:122–172`). No single persisted `UiSnapshot` entity exists.

---

## 3. State Ownership Graph

### DOMAIN: Profile

```
WRITER:       ProfileEngine (InMemoryProfileStore)
              — POST/PATCH /api/profile
              — activateProfileFromModuleExecution() on execute
READ MODEL:   ProfileDocument (internal)
PROJECTION:   UiSnapshot.profile
CONSISTENCY:  Strong within ProfileEngine; eventual relative to snapshot refresh
VIOLATIONS:   GET /api/profile returns profile outside snapshot (tests/tools only on web)
              profile.preferredLanguage participates in snapshot.session.language fallback
              (dual derivation inside projection — ui-snapshot.ts:58–62)
```

### DOMAIN: Session

```
WRITER:       packages/core/src/session (Map)
              — POST /api/sessions, PATCH /api/sessions/:id
READ MODEL:   Session.context (internal)
PROJECTION:   UiSnapshot.session (language, uiPreferences), UiSnapshot.ftu
CONSISTENCY:  Last-write-wins on shallow merge
VIOLATIONS:   PATCH /api/sessions does NOT increment snapshotVersion
              sessionId persisted in client localStorage outside snapshot
              GET /api/sessions/:id bypasses snapshot
```

### DOMAIN: Execution (module output)

```
WRITER:       module-execution-store.ts (Map per session+moduleId)
              — POST /api/modules/:id/execute (on success)
READ MODEL:   StoredModuleExecution (internal)
PROJECTION:   UiSnapshot.executions[]
CONSISTENCY:  Last-write-wins per moduleId (one slot per module)
VIOLATIONS:   Execution inputs NOT stored — not in projection
              execution-trace-store written in parallel, NOT in snapshot
              POST /execute response includes immediate result+UX (bypass until refresh)
```

### DOMAIN: UX

```
WRITER:       Derived at snapshot build time from execution outputs
              — buildUxSnapshot(collectUxModuleOutputs(executions))
READ MODEL:   packages/ux orchestrator (stateless transform)
PROJECTION:   UiSnapshot.uxSnapshot
CONSISTENCY:  Deterministic given same execution outputs
VIOLATIONS:   POST /execute attachUxToExecutionResult returns ephemeral UX
              UX summary in getModuleUx synthesizes from action titles (fidelity gap)
              benefits-simulator in UX_SOURCES but may not be in registry UX path
```

### DOMAIN: Language

```
WRITER:       session.context.userProfile.language (PATCH)
              profile.preferredLanguage (profile activation / PATCH profile)
READ MODEL:   Session + Profile (dual)
PROJECTION:   UiSnapshot.session.language (resolveLanguage merges both)
CONSISTENCY:  Snapshot-gated on client (P4.3); force-apply on PATCH (no version bump)
VIOLATIONS:   Internal projection dual-source: session OR profile fallback
              i18n translations fetched separately (/api/i18n/:lang) — static bundles
```

### DOMAIN: Theme

```
WRITER:       session.context.userProfile.uiPreferences.theme (PATCH)
READ MODEL:   Session.context
PROJECTION:   UiSnapshot.session.uiPreferences.theme
CONSISTENCY:  Snapshot-gated on client (P4.4); force-apply on PATCH
VIOLATIONS:   PATCH does not bump snapshotVersion
              'system' theme resolved via OS preference (client-side, not in snapshot)
```

### DOMAIN: FTU

```
WRITER:       session.context.ftu OR derived heuristic (no web write path active)
READ MODEL:   Session.context
PROJECTION:   UiSnapshot.ftu
CONSISTENCY:  Read-only on web; inferred from profile+execution count if no meta
VIOLATIONS:   No client write path after FtuHomeExperience removal
              FTU state cannot be advanced from current UI
```

### DOMAIN: Module input

```
WRITER:       Transient — form POST body on execute only
              Partial persistence via profile-activation (subset of fields)
READ MODEL:   None (inputs not stored as first-class domain)
PROJECTION:   Partial via UiSnapshot.profile + schema defaults in selectors
CONSISTENCY:  Weak — taxClass, situation, query, etc. NOT reconstructible
VIOLATIONS:   Module input is NOT a snapshot domain; selectors fabricate defaults
```

### DOMAIN: Module output

```
WRITER:       module-execution-store (on execute)
READ MODEL:   StoredModuleExecution
PROJECTION:   UiSnapshot.executions[].result
CONSISTENCY:  Snapshot-gated on client (P3+P4)
VIOLATIONS:   One execution per moduleId — history lost
```

### DOMAIN: Snapshot versioning

```
WRITER:       snapshot-version-store.ts (recordSnapshotMutation)
READ MODEL:   snapshotVersionBySession Map
PROJECTION:   UiSnapshot.snapshotVersion, lastMutationId
CONSISTENCY:  Monotonic per session when mutated
VIOLATIONS:   Not incremented on session PATCH (language/theme)
              Separate from actual store mutations — can drift from content
              Not persisted — resets on API restart
```

---

## 4. Domain Map Table

| Domain | Writer | Read Model | Projection | Consistency | Risk |
|--------|--------|------------|------------|-------------|------|
| Profile | ProfileEngine | ProfileDocument | `snapshot.profile` | Strong (engine) / Eventual (UI) | P1 |
| Session | core/session Map | Session.context | `snapshot.session`, `snapshot.ftu` | Last-write-wins | P1 |
| Execution output | module-execution-store | StoredModuleExecution | `snapshot.executions` | Last-write-wins per module | P1 |
| Execution input | None (ephemeral) | — | Partial via profile + defaults | Weak | P1 |
| UX | Derived (buildUxSnapshot) | Stateless transform | `snapshot.uxSnapshot` | Deterministic rebuild | P2 |
| Language | Session (+ profile fallback) | Dual internal | `snapshot.session.language` | Snapshot-gated client | P2 |
| Theme | Session uiPreferences | Session.context | `snapshot.session.uiPreferences` | Snapshot-gated client | P2 |
| FTU | Session / heuristic | Session.context | `snapshot.ftu` | Static on web | P3 |
| Version metadata | snapshot-version-store | Version Map | `snapshot.snapshotVersion` | Monotonic (partial coverage) | P1 |
| Execution trace | execution-trace-store | Trace | **Not projected** | Independent | P2 |
| Events | core/events | Event log | **Not projected** | Independent | P3 |
| i18n bundles | Static API | `/api/i18n/:lang` | **Not in snapshot** | Static | P3 |
| Module catalog | globalRegistry | Module metadata | `snapshot.modules` | Static per deploy | P3 |

---

## 5. Write Path Audit

| Mutation Entry Point | Stores Mutated | snapshotVersion++? | Bypasses Snapshot Pipeline? |
|---------------------|----------------|--------------------|-----------------------------|
| `POST /api/modules/:id/execute` | execution store, profile (optional), version (1–2×), trace, session (bind) | ✅ execution + optional profile | Execute response returned directly to client |
| `POST /api/profile` | profile store, session bind, version | ✅ profile-create | Response is profile DTO |
| `PATCH /api/profile` | profile store, version | ✅ profile-update | Response is profile DTO |
| `PATCH /api/sessions/:id` | session store | ❌ **No** | Response is raw session |
| `POST /api/sessions` | session store | ❌ (starts at 0) | Response is raw session |
| `activateProfileFromModuleExecution` | profile store, session (profileId) | Via caller only | Internal — no snapshot until GET |
| `buildUiSnapshot` | None (read-only) | N/A | N/A |

### Multi-store execute chain (implicit write fan-out)

```
POST /execute
  → resolveExecutionContext (reads profile)
  → storeExecutionTrace
  → globalRegistry.execute
  → recordSnapshotMutation + storeModuleExecution
  → activateProfileFromModuleExecution (profile + session bind)
  → recordSnapshotMutation (if profile patched)
  → attachUxToExecutionResult (response-only UX)
```

**Side effects outside domain boundary:** Execution triggers profile mutation (P1 coupling). Trace stored independently of snapshot.

---

## 6. Read Model Integrity

### Is UiSnapshot fully self-sufficient?

**No.** Missing or external:

| Data | In Snapshot? | Alternative Source |
|------|-------------|-------------------|
| Module execution results | ✅ | — |
| Profile (full document) | ✅ | GET /api/profile |
| UX action cards | ✅ (derived) | POST /execute response (ephemeral) |
| Language / theme | ✅ | PATCH session (no version) |
| Module inputs (full) | ❌ Partial | Schema defaults in selectors |
| Execution history (multi) | ❌ | One per moduleId only |
| Execution traces | ❌ | GET /api/modules/:id/trace |
| Events | ❌ | GET /api/events |
| i18n strings | ❌ | GET /api/i18n/:lang |
| Module list | ✅ | GET /api/modules (duplicate) |

### Frontend bypass audit (post-P4)

| Surface | Bypasses Selectors? | Bypasses Snapshot? | Status |
|---------|--------------------|--------------------|--------|
| Module pages | ❌ useModuleSnapshot | ❌ | ✅ Compliant |
| Home page | ❌ uses global UX selectors | ❌ | ✅ Compliant |
| AppProvider language/theme | ❌ getSessionLanguage/getThemePreference | ❌ | ✅ Compliant |
| Translations cache | N/A | ✅ static i18n | Acceptable (non-user state) |
| sessionId localStorage | N/A | ✅ identity bootstrap | P2 debt |
| executeModule response | Ignored for persistence | Transient until refresh | ✅ Compliant |

---

## 7. Consistency Model Classification

| Subsystem | Model | Notes |
|-----------|-------|-------|
| ProfileEngine | **Strong** (in-process) | Revision-checked updates |
| Session store | **Last-write-wins** | Shallow merge |
| Execution store | **Last-write-wins** | Per moduleId slot |
| Snapshot version | **Monotonic counter** | Partial mutation coverage |
| buildUiSnapshot | **Deterministic rebuild** | Same stores → same snapshot (except generatedAt) |
| Client snapshot apply (P3) | **Snapshot-gated** | `version > lastApplied` |
| Client preference PATCH (P4.3/4) | **Force-apply** | Bypasses version gate intentionally |
| Cross-tab | **No sync** | Independent fetches |
| API restart | **Total loss** | All server stores cleared |

### Mismatches

| Expectation | Reality |
|-------------|---------|
| "All mutations bump version" | Session PATCH does not |
| "Version reflects all state changes" | Version counter separate from store content |
| "Snapshot is canonical" | Five stores are canonical; snapshot is view |

---

## 8. Snapshot System Audit (Core)

### snapshotVersion semantics

- Per-session monotonic integer starting at 0
- Incremented by `recordSnapshotMutation()` on: execute, profile activation (conditional), profile create/update
- **Not** incremented on: session PATCH, session create, failed executes

### Ordering guarantees

| Layer | Guarantee |
|-------|-----------|
| Server version counter | Strictly increasing per mutation call |
| Execution store | Timestamp sort; one entry per module |
| Client apply (P3) | Only strictly newer versions applied (except force-apply paths) |
| Concurrent executes | Both succeed; version assigns order; last module slot wins |

### Race conditions

**Server-side:** Concurrent executes on same module — last `storeModuleExecution` wins; both version bumps occur; snapshot reflects final slot.

**Client-side:** P3 `snapshotFetchGenerationRef` + `applySnapshotIfNewer` prevents out-of-order snapshot regression. P4.3/4 `applySnapshot` force-apply for preference changes where version unchanged.

### Determinism

Given identical underlying store state, `buildUiSnapshot` produces identical domain content except:
- `generatedAt` (always `new Date().toISOString()`)
- Module list order (registry list order — stable)

**Can two identical snapshots differ?** Only in `generatedAt` timestamp.

**Can snapshotVersion drift from state?** Yes — session PATCH mutates session store without version increment; snapshot content changes at same version.

---

## 9. Domain Boundary Integrity

| Boundary | Status | Evidence |
|----------|--------|----------|
| ProfileEngine vs ExecutionEngine | ⚠️ Coupled | `activateProfileFromModuleExecution` in execute handler |
| UX vs Execution | ✅ Isolated | UX derived from outputs at read time |
| Session vs Profile | ⚠️ Conflated | `profileId` in session; language fallback merges profile |
| Snapshot vs Trace | ❌ Split | Traces written but not projected |
| Snapshot vs Events | ❌ Split | Events independent |

**UX logic in domain?** Module business logic in `packages/modules`; UX normalization in `packages/ux` — clean separation. Profile activation maps inputs in API layer (orchestration, not domain module).

---

## 10. Persistence & Recovery Model

| State | Storage | Page Reload | Browser Restart | API Restart | New Device |
|-------|---------|-------------|-----------------|-------------|------------|
| sessionId | localStorage | ✅ | ✅ | ✅ (if API alive) | ❌ |
| Profile | InMemoryProfileStore | ✅ via snapshot | ✅ via snapshot | ❌ **LOST** | ❌ |
| Executions | InMemory Map | ✅ via snapshot | ✅ via snapshot | ❌ **LOST** | ❌ |
| snapshotVersion | InMemory Map | ✅ via snapshot | ✅ via snapshot | ❌ **RESET to 0** | ❌ |
| Session context | InMemory Map | ✅ via snapshot | ✅ via snapshot | ❌ **LOST** | ❌ |
| Translations | Client cache | Re-fetch | Re-fetch | Re-fetch | Re-fetch |
| Theme (resolved) | Derived | ✅ | ✅ | Default until snapshot | ❌ |

### After API restart

Client has `sessionId` in localStorage → `isSessionValid` may return 404 → `ensureSession` creates **new** session with default language/theme — **silent state loss**.

### Does UiSnapshot reconstruct full system state?

**No.** It reconstructs **UI-visible subset** only. Traces, events, execution inputs, execution history per module, and pre-restart version lineage are not recoverable.

---

## 11. Frontend State Purity (Post-P4)

| Check | Status | Evidence |
|-------|--------|----------|
| No local business authority | ✅ | No executionResult, no ux-store |
| Language from snapshot | ✅ | `getSessionLanguage(uiSnapshot)` |
| Theme from snapshot | ✅ | `getThemePreference(uiSnapshot)` |
| Module state from selectors | ✅ | `useModuleSnapshot` |
| Transient state only | ✅ | loading, error, menuOpen, translations cache |
| localStorage business state | ✅ None | sessionId only (identity) |
| Singleton stores | ✅ None | ux-store removed (P4.2) |
| OS theme for 'system' | ⚠️ | `useSyncExternalStore` on prefers-color-scheme — environmental, not business |

---

## 12. Snapshot Contract Stability

| Aspect | Assessment |
|--------|------------|
| Typed schema (web) | `UiSnapshot` interface in `api.ts` |
| Typed schema (api) | Duplicate `UiSnapshot` in `ui-snapshot.ts` |
| schemaVersion field | ❌ **Missing** — no contract versioning |
| Backward compatibility | Implicit; no migration strategy |
| Error fallback snapshot | Synthetic snapshot on build failure (version 0) — masks errors |
| Dual type definitions | Web + API types can drift |

**Risk:** Snapshot is an evolving implicit contract between `buildUiSnapshot` and client selectors without explicit schema version.

---

## 13. Hidden System Coupling

```
execute → profile activation → session.profileId bind
execute → trace store (parallel, invisible to UI)
execute → version bump → execution store (ordering metadata on execution)
session.language PATCH → snapshot content change WITHOUT version bump
resolveLanguage → reads profile.preferredLanguage as fallback
profile activation → may set preferredLanguage from execute context language
selectors → fabricate module input defaults not from any store
attachUxToExecutionResult → UX in HTTP response decoupled from snapshot until refresh
ensureSession → creates new session with hardcoded defaults if stored session invalid
```

**Circular dependency risk:** Low — unidirectional execute→profile. Language flows session→execute context→profile activation preferredLanguage→snapshot language fallback.

---

## 14. Critical Violations (Ranked)

### P0 — System Correctness

| ID | Violation | Impact |
|----|-----------|--------|
| P0-1 | **All server state in-memory** | API restart = total user state loss; client sessionId orphan | 
| P0-2 | **Silent session recreation on invalid stored sessionId** | User believes state persists; receives empty snapshot on new session |

### P1 — Architecture Inconsistency

| ID | Violation | Impact |
|----|-----------|--------|
| P1-1 | **Multi-store write model, not unified SSOT** | UiSnapshot is view, not truth |
| P1-2 | **Session PATCH bypasses snapshotVersion** | Version/content skew; requires client force-apply |
| P1-3 | **Module inputs not in projection** | Reload loses unmapped form fields |
| P1-4 | **Execution→profile side effect in execute handler** | Hidden write chain; cross-domain coupling |
| P1-5 | **Dual language source in projection** | session.language vs profile.preferredLanguage |
| P1-6 | **One execution slot per module** | Re-execute overwrites; no history in snapshot |

### P2 — Design Debt

| ID | Violation | Impact |
|----|-----------|--------|
| P2-1 | Execution trace store not projected | Debug API invisible to UI model |
| P2-2 | Duplicate UiSnapshot type definitions | Contract drift risk |
| P2-3 | Uncontrolled forms + key remount | In-session DOM/snapshot divergence |
| P2-4 | GET /api/profile, /trace, /events parallel APIs | Alternative read paths for tooling/future |
| P2-5 | buildUiSnapshot error fallback | Returns fake empty snapshot |

### P3 — Cleanup

| ID | Violation | Impact |
|----|-----------|--------|
| P3-1 | FTU in snapshot but no write path on web | Dead projection domain |
| P3-2 | No snapshot schemaVersion | Migration friction |
| P3-3 | i18n outside snapshot | Acceptable — static content |
| P3-4 | generatedAt non-deterministic | Minor testing/replay friction |

---

## 15. Snapshot System Verdict

### Is UiSnapshot a true system-wide projection model?

## **PARTIAL — NO for system-wide; YES for web UI layer**

**Why NO (system-wide):**

1. **Five independent write stores** feed the projection — no canonical persisted snapshot or event log.
2. **Alternative read/write APIs** exist outside the snapshot pipeline.
3. **Incomplete projection** — module inputs, traces, events, execution history absent.
4. **Ephemeral persistence** — projection source data lost on restart.
5. **Version metadata incomplete** — not all mutations covered.

**Why YES (UI layer):**

1. Web app routes **all persisted visible state** through snapshot + selectors (P4).
2. P3 prevents client snapshot regression.
3. P4.3/4 unify language and theme under snapshot.session.
4. Module pages derive results exclusively from `snapshot.executions`.
5. UX derived exclusively from `snapshot.uxSnapshot`.

---

## 16. System Health Score

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| State consistency (UI) | 82 | 25% | 20.5 |
| State consistency (backend) | 48 | 20% | 9.6 |
| Coupling level | 55 | 15% | 8.3 |
| Persistence stability | 20 | 20% | 4.0 |
| Projection correctness | 68 | 10% | 6.8 |
| Boundary integrity | 62 | 10% | 6.2 |

### **Overall: 55 / 100**

**Interpretation:** Strong frontend architectural discipline post-P4; backend remains a prototype-grade multi-store system with a well-designed but incomplete read projection. Suitable for MVP/demo; not production-grade unified state architecture.

---

## 17. Architectural Diagram

### Current (Actual)

```text
┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐
│ Session Map │  │ Profile Store│  │ Execution Store │  │ Version Store    │
└──────┬──────┘  └──────┬───────┘  └────────┬────────┘  └────────┬─────────┘
       │                │                    │                     │
       └────────────────┴────────────────────┴─────────────────────┘
                                    │
                          buildUiSnapshot()  ← read-time aggregate
                                    │
                              UiSnapshot
                                    │
                    ┌───────────────┴───────────────┐
                    │ P3 version gate               │
                    │ P4 selectors                  │
                    └───────────────┬───────────────┘
                                    │
                               Web UI

Parallel (not in snapshot): Trace Store, Events, i18n, GET /api/profile
Client-only: sessionId localStorage, translations cache, OS theme resolution
```

### Target Implied by P4 (Achieved on Web)

```text
UI = f(UiSnapshot)
```

### Actual System Truth

```text
UiSnapshot = f(sessionStore, profileStore, executionStore, versionStore, registry)
UI = f(UiSnapshot) + transient(local)
```

---

## 18. Final Goal Answer

> **"Is this system actually unified under UiSnapshot, or only appears unified in the UI layer?"**

**It appears unified in the UI layer and genuinely is unified there** — after P4, the web client does not maintain parallel business state authorities.

**It is not unified at the system level.** The backend is a **multi-store architecture** where UiSnapshot is a **read-model projector**, not the single source of truth. Persistence is ephemeral. The projection is incomplete for module inputs and auxiliary domains. Version metadata does not cover all mutation paths.

**Truth model classification:** **CQRS-lite with in-memory write models and a composite snapshot read model** — not a unified state machine.

---

## 19. Audit Success Criteria

| Criterion | Met? |
|-----------|------|
| Every state domain classified | ✅ |
| Every write path identified | ✅ |
| Snapshot system fully evaluated | ✅ |
| Hidden coupling exposed | ✅ |
| System-level correctness explicitly answered | ✅ |

---

*Audit performed by static analysis of repository source. No runtime tests executed. Evidence citations reference file paths and line ranges as of June 2026 post-P4.4.*
