# P4.1 — System State Architecture Audit

**Role:** Principal Software Architect / Staff Systems Auditor  
**Date:** June 2026  
**Scope:** Full state-management architecture after P0–P4  
**Mode:** Descriptive audit only — no code changes

---

## Executive Summary

P4 successfully eliminated `executionResult` local authority from all five module pages and introduced a pure selector + reconstruction hook layer. Module **results**, **UX cards**, and **profile-mapped form defaults** are now derived from `UiSnapshot` on active render paths.

However, the application **does not fully satisfy** the invariant that UiSnapshot is the single authoritative read model for **all** persisted user-facing state. Several parallel or legacy state authorities remain in the codebase — some inactive on the current home route, others active (language, partial form reconstruction, client-only preferences).

**Verdict: PASS WITH EXCEPTIONS**

---

## 1. State Inventory

### 1.1 Backend (Server-Side)

| Source | Type | Scope | Authoritative? | Notes |
|--------|------|-------|----------------|-------|
| **UiSnapshot** (`buildUiSnapshot`) | Read model (projection) | Per session | **Yes — intended read authority** | Aggregates profile, executions, ux, ftu, modules, version metadata |
| **ProfileDocument** (`InMemoryProfileStore`) | Write model | Per profile / session-bound | **Yes — write authority for profile fields** | Projected into `UiSnapshot.profile` at read time |
| **Execution Store** (`module-execution-store.ts`) | Write model | Per session + moduleId | **Yes — write authority for module outputs** | One entry per module per session; projected into `UiSnapshot.executions` |
| **Snapshot Version Store** (`snapshot-version-store.ts`) | Ordering metadata | Per session | **Yes — version authority** | Projected into `UiSnapshot.snapshotVersion`, `lastMutationId` |
| **Session Store** (`packages/core/src/session`) | Write model | Per session | **Yes — session authority** | Partially projected: `UiSnapshot.session`, `UiSnapshot.ftu` |
| **Execution Trace Store** (`execution-trace-store.ts`) | Debug/diagnostic | Per session + moduleId | **No — not in UiSnapshot** | Exposed via `GET /api/modules/:id/trace`; not consumed by web UI |

#### ProfileDocument

| Attribute | Detail |
|-----------|--------|
| **Ownership** | `ProfileEngine` + `InMemoryProfileStore` (`apps/api/src/profile-runtime.ts`) |
| **Lifecycle** | Created on `POST /api/profile` or profile activation after module execute; updated via `PATCH /api/profile` or activation |
| **Persistence** | In-memory; lost on API restart |
| **Writers** | `profile-activation.ts`, `routes/profile.ts`, `ProfileEngine` |
| **Readers** | `buildUiSnapshot` → `profileEngine.getProfileBySession`; direct `GET /api/profile` (API/tests only — **not used by web**) |

#### Execution Store

| Attribute | Detail |
|-----------|--------|
| **Ownership** | `apps/api/src/module-execution-store.ts` |
| **Lifecycle** | Written after successful module execute in `build-app.ts`; overwrites prior result for same `(sessionId, moduleId)` |
| **Persistence** | In-memory; lost on API restart |
| **Writers** | `storeModuleExecution()` in execute handler |
| **Readers** | `listModuleExecutionsForSession()` → `buildUiSnapshot` |

#### Session Store

| Attribute | Detail |
|-----------|--------|
| **Ownership** | `packages/core/src/session/index.ts` |
| **Lifecycle** | Created via `POST /api/sessions`; updated via `PATCH /api/sessions/:id` |
| **Persistence** | In-memory; lost on API restart |
| **Writers** | `createSession`, `updateSessionContext`, profile bind |
| **Readers** | `buildUiSnapshot`, `GET /api/sessions/:id`, `ensureSession` validation |

#### UiSnapshot (API projection)

| Attribute | Detail |
|-----------|--------|
| **Ownership** | `apps/api/src/routes/ui-snapshot.ts` |
| **Lifecycle** | Materialized on each `GET /api/ui-snapshot`; not stored independently |
| **Persistence** | None (computed read) |
| **Writers** | N/A (read-only aggregation) |
| **Readers** | Web `AppProvider` via `fetchUiSnapshot`; API tests |

---

### 1.2 Frontend (Client-Side)

| Source | Type | Scope | Authoritative? | Notes |
|--------|------|-------|----------------|-------|
| **AppProvider `uiSnapshot`** | Snapshot cache | App-wide | **Yes — client read authority** | Gated by `applySnapshotIfNewer` (P3) |
| **Selector layer** | Pure projection | Per module | **Derived — not independent** | `getModuleUIState` etc. |
| **ux-store** | Client module singleton | Browser tab | **Legacy parallel authority (currently unwritten)** | No active writers after P4; still read by legacy components |
| **ftu.ts (localStorage)** | Client FTU state | Browser | **Parallel authority (inactive route)** | Used only by unmounted `FtuHomeExperience` |
| **React `useState`** | Transient / cache | Component | **Mixed** — see §2 |
| **localStorage** | Client persistence | Browser | **Mixed** — see §9 |

#### AppProvider state breakdown

| Field | Authoritative? | Role |
|-------|----------------|------|
| `uiSnapshot` | **Yes** (when applied) | Canonical client copy of server read model |
| `lastAppliedSnapshotVersionRef` | **Yes** (ordering gate) | P3 monotonic apply cursor |
| `sessionId` | Infrastructure | Durable session identity (P0); mirrors server session key |
| `language` | **Parallel (active)** | UI language; **not synced from `uiSnapshot.session.language`** |
| `theme` | Client-only UI chrome | Not in UiSnapshot |
| `translations` | i18n cache | Fetched from `/api/i18n/:lang`; not in UiSnapshot |
| `uiSnapshotLoading` | Transient | Fetch lifecycle |
| `uiSnapshotError` | Transient | Error display |

---

## 2. Hidden Sources of Truth Audit — `useState` Classification

Repository search: all `useState` occurrences in `apps/web/src`.

### Valid — Transient UI / Infrastructure

| File | State | Classification |
|------|-------|----------------|
| `AppProvider.tsx:46` | `uiSnapshotLoading` | Transient fetch state |
| `AppProvider.tsx:47` | `uiSnapshotError` | Transient error display |
| `AppProvider.tsx:44` | `sessionId` | Session infrastructure (null until `ensureSession`) |
| `AppProvider.tsx:48` | `translations` | i18n fetch cache |
| `AppProvider.tsx:42-43` | `language`, `theme` | UI preferences (see exceptions below) |
| All 5 module pages | `loading` | In-flight execute indicator |
| All 5 module pages | `error` | Execute error display |
| `Header.tsx:57` | `menuOpen` | Navigation UI |
| `ExploreModulesSection.tsx:28` | `expanded` | Collapse/expand UI |

### Valid — Snapshot Cache (Not Duplicate Business Authority)

| File | State | Classification |
|------|-------|----------------|
| `AppProvider.tsx:45` | `uiSnapshot` | **Canonical client holder** of server read model; writes gated by P3 version check |

### Invalid / Exception — Business-Adjacent Parallel State

| File | State | Issue | Severity |
|------|-------|-------|----------|
| `AppProvider.tsx:42` | `language` | User-facing preference also embedded in execute `context.userProfile.language` and available in `uiSnapshot.session.language`, but **not read from snapshot** on load | P1 |
| `AppProvider.tsx:43` | `theme` | User-facing; persisted in `localStorage` only; not in UiSnapshot | P3 (acceptable UI chrome) |

### Removed Anti-patterns (P4 — Confirmed Absent)

| Pattern | Status |
|---------|--------|
| `useState(executionResult)` | **Removed** from all 5 module pages |
| `setExecutionResult` | **Removed** |
| Local module result storage | **Removed** |

**Evidence:** Grep for `executionResult` / `setExecutionResult` in `apps/web` returns zero module page matches.

---

## 3. Snapshot Bypass Audit

### Approved read path (module pages)

```text
UiSnapshot (AppProvider)
   ↓
getModuleUIState / useSnapshotReconstruction
   ↓
Module page render
```

### Bypasses discovered

| Location | Pattern | Bypass type | Severity |
|----------|---------|-------------|----------|
| `apps/web/src/app/page.tsx:68` | `<HomeSnapshotRenderer snapshot={uiSnapshot} />` | Reads `uiSnapshot` **directly**, bypasses selector layer | P2 — same source, no selector |
| `apps/web/src/components/home/HomeSnapshotRenderer.tsx` | Direct field access: `profile`, `executions`, `uxSnapshot`, `ftu` | Aggregate home render without selectors | P2 |
| `AppProvider.tsx:42` | `language` state | Persisted user preference not from snapshot | P1 |
| `GlobalUxPanel`, `ProfileInsightBannerFromStore`, `ProfileSurfacePanelFromStore`, `UxAttentionLayer`, `ExploreModulesSection` | `buildGlobalUxPlan()` → `ux-store` | **Alternate UX read path** bypassing `uiSnapshot.uxSnapshot` | P1 (legacy; see §7) |
| `FtuHomeExperience.tsx` | `ftu.ts` localStorage + ux-store | Dual FTU + UX authority | P2 (component **not mounted**) |
| `apps/web/src/lib/api.ts` | `fetchUiSnapshot` | Direct fetch — **approved** (only AppProvider calls it) | None |
| `GET /api/profile` | — | **Not called from web** | None — no client bypass |

### Not a bypass

| Location | Reason |
|----------|--------|
| `executeModule()` in module pages | Write path only; result not stored locally; `refreshUiSnapshot()` follows |
| `ensureSession()` / `localStorage` sessionId | Identity bootstrap, not business state |
| `fetchTranslations(language)` | Static i18n bundle, not user state |

---

## 4. Snapshot Version Compliance Audit

### AppProvider (`apps/web/src/components/AppProvider.tsx`)

```typescript
// Lines 53-59
if (snapshot.snapshotVersion > lastAppliedSnapshotVersionRef.current) {
  lastAppliedSnapshotVersionRef.current = snapshot.snapshotVersion;
  setUiSnapshot(snapshot);
}
```

- Strict monotonic apply: `>` not `>=`
- Initial cursor `-1` allows version `0` on first load
- Failed fetch: retains prior snapshot and cursor (lines 132-133)
- In-flight safety: `snapshotFetchGenerationRef` discards superseded responses (lines 117-127)

### useSnapshotReconstruction

- Recomputes from `uiSnapshot` via `useMemo`; **no independent version cache**
- `isStale = uiSnapshotLoading && uiSnapshot !== null` — blocks mixed render during refresh
- `snapshotVersion` used for form `key` remount, not as render gate (gate is upstream in AppProvider)

### Selectors

- Pass through `snapshot?.snapshotVersion ?? 0`; do not enforce ordering (correct — enforcement belongs in AppProvider)

### Module pages

- `ResultPanel loading={loading || uiState.isStale}` — prevents showing stale result during snapshot refresh
- Form `key={moduleId-${uiState.snapshotVersion}}` — ties reconstruction to applied version

---

### Q1: Can stale data still be rendered after a newer snapshot has been applied?

**On module pages: No** (under normal P3 operation).

Evidence:
- AppProvider rejects `snapshotVersion <= lastApplied`
- Module pages mask result panel during `isStale`

**On home page: Partially.**

Evidence:
- `page.tsx` shows `uiSnapshot` while `uiSnapshotLoading` may be true (lines 64-68)
- No `isStale` guard on home — during refresh, **previous snapshot remains visible** until replace (not a rollback to older version, but a lag window)
- This is **stale-in-time**, not **stale-in-version** (P3 prevents version regression)

---

### Q2: Can any component cache snapshot-derived data independently?

| Component | Independent cache? | Evidence |
|-----------|-------------------|----------|
| `useSnapshotReconstruction` | No | `useMemo` keyed on `uiSnapshot` reference |
| `ux-store` | **Yes — module-level singleton** | `apps/web/src/lib/ux-store.ts` lines 8-11; survives re-renders |
| `ftu.ts` | **Yes — module-level + localStorage** | `cachedClientSnapshot` line 59 |
| `AppProvider uiSnapshot` | Yes — intentional canonical cache | Version-gated |

---

### Q3: Can snapshotVersion be ignored anywhere?

| Location | Ignores version? | Impact |
|----------|-----------------|--------|
| `HomeSnapshotRenderer` | Does not read `snapshotVersion` | Renders whatever AppProvider holds; safe if AppProvider gate holds |
| Legacy UX components | Do not use `snapshotVersion` | Read empty `ux-store` instead — irrelevant on active route |
| Selectors | Read version but don't gate | Correct separation |
| `language` / `theme` | Not versioned | Independent of snapshot lifecycle |

---

## 5. Selector Layer Purity Audit

Inspected: `apps/web/src/lib/snapshot/selectors/*`

| File | Pure? | Notes |
|------|-------|-------|
| `get-module-execution.ts` | ✅ | Filter + last-element selection |
| `get-module-input-defaults.ts` | ✅ | Delegates to profile + schema defaults |
| `module-input-defaults.ts` | ✅ | Static builder map |
| `get-module-ux.ts` | ✅ | Filters `uxSnapshot.actionCards` by `source` |
| `get-module-ui-state.ts` | ✅ | Composes pure selectors |

**Violations: None.**

- No fetch, side effects, mutations, writes, or module-level caching in selectors
- All functions are `input → output`

**Fidelity note (not a purity violation):** `getModuleUx` synthesizes `summary` by joining action titles; the original execute-time UX summary string is not stored in UiSnapshot.

---

## 6. Module Reconstruction Audit

| Module | Result Source | UX Source | Form Source | Compliant |
|--------|---------------|-----------|-------------|-----------|
| **financial-reality** | `uiState.result` ← `getModuleExecution` → `snapshot.executions` | `getModuleUx` → `snapshot.uxSnapshot.actionCards` | `getModuleInputDefaults` → profile + schema | **Yes** |
| **healthcare-navigation** | Same | Same | Same | **Yes** |
| **grocery-optimization** | Same | Same | Same | **Yes** |
| **life-event** | Same | Same | Same | **Yes** |
| **system-translation** | Same | Same | Same | **Yes** |

### Evidence per module

All five pages follow identical pattern:

```typescript
const uiState = useModuleSnapshot('<moduleId>');
const result = uiState.result as <Type> | null;
const moduleResult = toModuleResult('<moduleId>', uiState);
// No executionResult useState
await refreshUiSnapshot(); // on success only
```

### Partial compliance gaps (form reconstruction)

| Module | Fields NOT in snapshot/profile | Impact on reload |
|--------|-------------------------------|------------------|
| financial-reality | `taxClass`, `churchTax` (not in profile-activation patch) | Revert to schema defaults |
| healthcare-navigation | `situation`, `urgency` | Revert to schema defaults |
| life-event | `event`, `timeline`, checkboxes | Revert to schema defaults |
| grocery-optimization | `monthlyBudget` | Revert to 300 |
| system-translation | `query`, `mode` | Revert to empty / search |

Profile-mapped fields **do** reconstruct (e.g. `grossIncome`, `hasInsurance`, `householdSize`).

---

## 7. UX Store Audit (High Priority)

### Does ux-store still contain business state?

**Structurally yes; operationally no on active routes.**

After P4, `recordModuleUx()` is **not called** from any module page. Grep confirms the only definition is in `ux-store.ts` itself.

The store remains a **capable** parallel authority:

```typescript
// apps/web/src/lib/ux-store.ts
let state: UxStoreState = { byModule: {}, lastUpdated: {} };
```

### Is ux-store authoritative for anything visible?

**On the current active home route (`page.tsx` → `HomeSnapshotRenderer`): No.**

- `FtuHomeExperience` (which mounts `GlobalUxPanel`, `UxAttentionLayer`, etc.) is **not imported or rendered anywhere** except its own file
- Home reads UX from `snapshot.uxSnapshot` directly in `HomeSnapshotRenderer`

**If legacy home were re-enabled: Yes — blocking violation.**

Components that would read empty or stale ux-store:

| Component | Read path |
|-----------|-----------|
| `GlobalUxPanel` | `buildGlobalUxPlan()` → `getAllUxByModule()` |
| `UxAttentionLayer` | `buildAttentionFocus()` → ux-store |
| `ProfileInsightBannerFromStore` | `buildGlobalUxPlan()` |
| `ProfileSurfacePanelFromStore` | `buildGlobalUxPlan()` |
| `ExploreModulesSection` | `hasGlobalUx()` → ux-store |

### Can UX be reconstructed from UiSnapshot without ux-store?

**Yes.**

Evidence:
- Module pages: `getModuleUx()` filters `snapshot.uxSnapshot.actionCards` by `source`
- Home: `HomeSnapshotRenderer` renders `uxSnapshot.actionCards`, `prioritySignals`, `attentionLayer` directly
- Server builds `uxSnapshot` from execution outputs in `buildUxSnapshot()` (`apps/api/src/ux-integration.ts`)

### Is ux-store now redundant?

**For module pages: Yes — fully redundant.**

**For legacy global UX components: Yes — redundant but still wired (dead code path on current home).**

**Risk:** Any future reintroduction of `recordModuleUx()` would immediately recreate split-brain UX without snapshot version governance.

---

## 8. Page Reload Reconstruction Audit

### Scenario trace

1. User executes `financial-reality`
2. Profile activation writes mapped fields
3. `refreshUiSnapshot()` applies newer `snapshotVersion`
4. Browser reload
5. Navigate to `/modules/financial-reality`

### Reconstruction matrix

| UI Element | Reconstructed? | Source |
|------------|----------------|--------|
| Session identity | ✅ | `localStorage` → `ensureSession` → same server session (if API alive) |
| Execution result panel | ✅ | `UiSnapshot.executions[financial-reality].result` |
| Module UX action cards | ✅ | `UiSnapshot.uxSnapshot.actionCards` (filtered by source) |
| Profile-mapped form fields | ✅ | `getModuleInputDefaults` → `snapshot.profile` |
| Non-profile form fields (taxClass, situation, etc.) | ❌ | Schema defaults only |
| Home profile section | ✅ | `HomeSnapshotRenderer` → `snapshot.profile` |
| Home action cards | ✅ | `snapshot.uxSnapshot` |
| Home FTU indicator | ✅ | `snapshot.ftu` (server-derived) |
| Global UX panels (legacy) | ❌ | ux-store empty; components not mounted |
| Client FTU wizard state | ❌ (inactive) | `localStorage` `arrival_atlas_ftu_v1` — not used on active home |
| UI language | ❌ | Resets to AppProvider default `'en'`; ignores `snapshot.session.language` |
| Theme | ✅ (client-only) | `localStorage` `arrivalos-theme` |

---

## 9. Persistence Boundary Audit

| State | Page Reload | Browser Restart | API Restart | New Device |
|-------|-------------|-----------------|-------------|------------|
| Session ID (`localStorage`) | ✅ | ✅ | ✅ (if session exists in API memory) | ❌ |
| ProfileDocument | ✅ via snapshot | ✅ via snapshot | ❌ lost | ❌ |
| Module execution results | ✅ via snapshot | ✅ via snapshot | ❌ lost | ❌ |
| snapshotVersion counter | ✅ via snapshot | ✅ via snapshot | ❌ resets to 0 | ❌ |
| uxSnapshot (action cards) | ✅ via snapshot | ✅ via snapshot | ❌ lost | ❌ |
| ux-store (client) | ❌ | ❌ | N/A | ❌ |
| FTU localStorage | ✅ | ✅ | N/A | ❌ |
| Theme localStorage | ✅ | ✅ | N/A | ❌ |
| UI language (React) | ❌ resets | ❌ resets | N/A | ❌ |
| Execution traces | N/A (not in UI) | N/A | ❌ lost | ❌ |

**Critical dependency:** All server-side persisted user state requires **both** client sessionId in localStorage **and** API process continuity.

---

## 10. Architectural Invariant Validation

> **UiSnapshot is the single authoritative read model for all persisted user-facing state.**

### Verdict: **PASS WITH EXCEPTIONS**

### Where P4 succeeded

- Module execution results: **fully snapshot-driven** on all 5 module pages
- Module UX rendering: **snapshot-driven** via selectors
- Profile-mapped form hydration: **selector-driven** with version-keyed remount
- P3 version gate: **prevents client snapshot regression**
- No `executionResult` local authority remains

### Documented exceptions

| # | Exception | Active on prod route? | Blocks invariant? |
|---|-----------|----------------------|-------------------|
| E1 | `language` in AppProvider not sourced from `uiSnapshot.session.language` | **Yes** | Partial — user-facing, affects execute context |
| E2 | `ux-store` parallel architecture (legacy components) | **No** (unmounted) | Latent — re-enable would break invariant |
| E3 | `ftu.ts` localStorage parallel to `snapshot.ftu` | **No** (unmounted) | Latent |
| E4 | Home reads snapshot directly, not via selectors | **Yes** | No — same read model, different access pattern |
| E5 | Partial form reconstruction (non-profile fields) | **Yes** | Partial — results restore, some inputs do not |
| E6 | `theme` in localStorage only | **Yes** | No — UI chrome, not business state |
| E7 | UX summary fidelity — synthesized from action titles, not stored summary | **Yes** | Minor display difference |

### Not FAIL because

- No active component renders **module business results** from local state
- No active component reads **profile data** outside UiSnapshot on web
- Primary user journeys (module execute → refresh → reload) reconstruct results from snapshot

---

## Remaining Architectural Debt

### P0 — Critical

*None identified on active render paths.*  
Legacy ux-store path would be P0 **if re-mounted without migration**.

---

### P1 — High

#### D1: Parallel UX authority (`ux-store`) — latent split-brain

| | |
|---|---|
| **Description** | `ux-store` + `ux-aggregator` form a complete parallel UX read model. P4 removed writes but left read infrastructure and unmounted components. |
| **Impact** | Re-enabling `FtuHomeExperience` or calling `recordModuleUx()` bypasses UiSnapshot and P3 versioning for UX. |
| **Evidence** | `apps/web/src/lib/ux-store.ts`; `GlobalUxPanel.tsx`, `UxAttentionLayer.tsx`, `ProfileInsightBannerFromStore.tsx` |
| **Remediation complexity** | Medium — delete or rewire legacy components to read `uiSnapshot.uxSnapshot` via selectors |

#### D2: Language state not snapshot-sourced

| | |
|---|---|
| **Description** | `AppProvider.language` defaults to `'en'` and is never initialized from `uiSnapshot.session.language` or `profile.preferredLanguage`. |
| **Impact** | After reload, UI language may diverge from session/profile language used in module execute context. |
| **Evidence** | `AppProvider.tsx:42, 71-75, 141-143`; snapshot carries `session.language` (`ui-snapshot.ts:55-59`) |
| **Remediation complexity** | Low — hydrate language from first applied snapshot |

#### D3: Incomplete form field persistence → incomplete reconstruction

| | |
|---|---|
| **Description** | Profile activation maps subset of module inputs. Selectors fall back to schema defaults for unmapped fields. |
| **Impact** | After reload, execution **results** restore but **form inputs** for unmapped fields reset — violates full "UI reconstructible from snapshot" for those fields. |
| **Evidence** | `profile-activation.ts` (no taxClass/churchTax); `module-input-defaults.ts` static fallbacks |
| **Remediation complexity** | Medium — extend activation mapping or store execution inputs server-side |

---

### P2 — Medium

#### D4: Home bypasses selector layer

| | |
|---|---|
| **Description** | `HomeSnapshotRenderer` accesses snapshot fields directly instead of shared selectors. |
| **Impact** | Architectural inconsistency; duplicate field-access logic if snapshot shape evolves. |
| **Evidence** | `apps/web/src/app/page.tsx:68`; `HomeSnapshotRenderer.tsx:135-228` |
| **Remediation complexity** | Low — introduce home selectors |

#### D5: Dual FTU models (server snapshot vs client localStorage)

| | |
|---|---|
| **Description** | `snapshot.ftu` (server session context) and `ftu.ts` localStorage (`arrival_atlas_ftu_v1`) represent overlapping concerns. |
| **Impact** | If FTU home is re-enabled, FTU state could diverge from snapshot. |
| **Evidence** | `ui-snapshot.ts:79-98`; `ftu.ts:8-98`; `FtuHomeExperience.tsx` (unmounted) |
| **Remediation complexity** | Medium — consolidate to snapshot-only FTU |

#### D6: Home page lacks `isStale` guard during snapshot refresh

| | |
|---|---|
| **Description** | Module pages use `isStale`; home shows prior snapshot while refresh in flight. |
| **Impact** | Brief display of pre-refresh home state (not version regression). |
| **Evidence** | `page.tsx:64-68` vs module `ResultPanel loading={loading \|\| uiState.isStale}` |
| **Remediation complexity** | Low |

#### D7: Uncontrolled form reconstruction depends on remount key

| | |
|---|---|
| **Description** | Form defaults only apply on mount via `key={snapshotVersion}`. Without controlled inputs, in-session edits persist in DOM until remount. |
| **Impact** | If snapshot version doesn't bump (no-op refresh), form may show stale DOM values despite updated profile in snapshot. |
| **Evidence** | Module page form `key` pattern; P4 known limitation |
| **Remediation complexity** | High — controlled inputs or explicit reset (deferred by design) |

---

### P3 — Low

#### D8: Dead code — legacy home UX stack

| | |
|---|---|
| **Description** | `FtuHomeExperience`, ux-store consumers, `ftu.ts` wizard — complete alternate home architecture, unmounted. |
| **Impact** | Maintenance burden, audit noise, reintroduction risk. |
| **Evidence** | Grep: `FtuHomeExperience` only referenced in its own file |
| **Remediation complexity** | Low — remove or archive |

#### D9: UX summary synthesis vs stored summary

| | |
|---|---|
| **Description** | `getModuleUx` builds summary from action titles; original orchestrator summary not in snapshot. |
| **Impact** | Minor UX copy difference vs immediate post-execute response. |
| **Evidence** | `get-module-ux.ts:26-28` |
| **Remediation complexity** | Low — store per-module UX summary in snapshot if needed |

#### D10: Execution trace store outside read model

| | |
|---|---|
| **Description** | Traces persisted server-side but not projected into UiSnapshot. |
| **Impact** | None currently (UI doesn't consume); future debug UI would bypass snapshot. |
| **Evidence** | `execution-trace-store.ts`; `GET /api/modules/:id/trace` |
| **Remediation complexity** | Low — include in snapshot if UI needs it |

#### D11: All server state in-memory

| | |
|---|---|
| **Description** | Sessions, profiles, executions, versions lost on API restart. |
| **Impact** | Snapshot read model empty after restart despite client sessionId persisting. |
| **Evidence** | `InMemoryProfileStore`, `Map`-based stores |
| **Remediation complexity** | High — persistence layer (known pre-P4 debt) |

---

## Conclusion

**P4 achieved its core goal for module pages:** execution results and UX are no longer locally authoritative; the selector + reconstruction layer makes module UI a deterministic function of `UiSnapshot`.

**The full system invariant is not yet strictly true** due to:

1. Active **language** parallel state
2. **Partial form reconstruction** for non-profile fields
3. **Legacy ux-store / FTU** architecture still present (inactive but dangerous if re-enabled)

For the **primary module interaction loop** (execute → profile activation → snapshot refresh → render/reload), UiSnapshot governs persisted visible state correctly and P3 prevents version regression.

**Recommended next architectural focus (informational only):** retire ux-store read paths, hydrate language from snapshot, extend input persistence or document explicit non-persisted fields.

---

*Audit performed by static code analysis and repository search. No runtime tests executed.*
