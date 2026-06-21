---
id: runtime-reactivity-audit-v1
title: Runtime Reactivity Audit v1
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: platform
status: active
maturity: frozen-review
owner: architecture
tags:
  - runtime-reactivity
  - state-synchronization
  - economic-reality
  - life-event
  - cache-invalidation
  - ux-bugs
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - golden-user-journeys-v1
  - economic-reality-v1-closure-spec
  - life-event-module-v2-spec
related:
  - economic-reality-system-audit-v2
  - e2e-user-journey-tests-report
  - platform-planning-constitution-v1
---

# Runtime Reactivity Audit v1

**Date:** 2026-06-21  
**Scope:** Client runtime state synchronization for Life Event v2 + Economic Reality v1  
**Method:** Static code audit — no feature implementation, no architecture redesign  
**Observed symptoms:** Action clicks with no visible UI change; blocks appearing only after refresh; module recommendations stale until reload; server plan changes not reflected in UI

---

## Executive summary

Arrival Atlas **does not use React Query or Zustand**. Runtime state is managed through:

| Layer | Mechanism |
|-------|-----------|
| Global session / profile / snapshot | `AppProvider` — `useState` + `useCallback` + generation-guarded fetches |
| Economic Reality plan | `EconomicRealityPlanProvider` — isolated `useState`, fetch-on-mount per `sessionId` |
| Action execution context | Module singleton (`action-context.ts`) |
| Economic plan cache | In-memory `Map` keyed by `deterministicHash` (`cache.ts`) |
| Life Event LE-8 runtime | Module singleton (`runtime-store.ts`) — **not wired to React** |

The reported UX bugs are **expected consequences** of this architecture, not random defects. Three structural gaps explain most symptoms:

1. **Economic Reality plan is not part of the global refresh graph** — profile mutations and `refreshSessionState()` never refetch it.
2. **Client reconciliation treats unchanged `deterministicHash` as “no update”** — even a successful refetch can return the same object reference and skip React re-render.
3. **Action execute → UI feedback only refetches when hash changes** — most single action executions append EP-12 events without changing hash, so the UI never refetches and never shows feedback.

Additionally, **all Economic Reality card types share one execute path**, while `open_module` and `update_profile` actions carry navigation `href`s that the UI ignores — clicks record server events but produce no navigation or visible state change.

---

## Architecture map (current)

```text
┌─────────────────────────────────────────────────────────────────┐
│ AppProvider (React Context)                                      │
│  • sessionId, userContext, profileInsights, lifeEventPlan        │
│  • uiSnapshot (version-gated via applySnapshotIfNewer)           │
│  • submitMutation → setUserContext + void refresh LE plan        │
│  • refreshSessionState → UC + insights + LE plan + snapshot        │
│                         ✗ NO economic plan                        │
└───────────────────────────────┬─────────────────────────────────┘
                                │ sessionId only
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ EconomicRealityPlanProvider (nested Context)                       │
│  • fetch on mount / sessionId change / manual refetch            │
│  • reconcileEconomicPlanState (hash guard + in-memory cache)      │
│  • bindEconomicActionContext (module singleton)                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ onClick
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ ActionRenderer → executeEconomicAction → trackActionExecuted     │
│  • refetch ONLY if deterministicHash changed                     │
│  • no router navigation for open_module / update_profile          │
└─────────────────────────────────────────────────────────────────┘
```

**Not present in codebase:** `invalidateQueries`, `refetchQueries`, `queryKey`, `staleTime`, `gcTime`, Zustand stores, optimistic mutation cache, cross-context subscriptions.

---

## Findings

### RR-01

**Severity:** Critical

**Location:** `apps/web/src/modules/economic-reality/ui/components/ActionRenderer.tsx`

**Observed behavior:**  
Clicking any Economic Reality card button (Intent, Action, Resource, Profile) calls `executeEconomicAction`. No navigation occurs for `open_module` or `update_profile` actions. User sees no page transition and no inline feedback beyond a possible alert on error.

**Root cause:**  
`ActionExecuteButton` is shared by all card views. It always POSTs to `/api/modules/economic-reality/action/execute`. Action templates define `href` for profile and module targets (`packages/modules/src/economic-reality/actions/node-action-catalog.ts`), but the UI never reads `action.payload.href` or calls `resolveModuleFromOpenAction` from `apps/web/src/app-shell/modules/router.ts`.

**Why refresh fixes it:**  
Full page reload does not “fix” execute behavior, but navigating manually or reloading after a **separate** profile/module flow may make it appear as if the action worked. Users often interpret reload as “the click worked after refresh.”

**Recommended fix:**  
Branch on action type in the renderer: `open_module` → `router.push(catalogRoute)`; `update_profile` → profile edit route from payload; `system_intent` / `external_resource` → execute or external link as appropriate. Keep execute path only for actions that are true EP-12 feedback events.

**Risk:**  
High — breaks Golden Journey GJ-01–GJ-03 user-visible action semantics.

**Evidence:**

```20:41:apps/web/src/modules/economic-reality/ui/components/ActionRenderer.tsx
function ActionExecuteButton({ actionId, labelKey }: { actionId: string; labelKey: string }) {
  // ...
  onClick={() => {
    void executeEconomicAction(actionId)
      .then((result) => trackActionExecuted(result))
```

```39:48:packages/modules/src/economic-reality/actions/node-action-catalog.ts
const economicRealityModule: ActionTemplate = {
  templateId: 'module-economic-reality',
  type: 'open_module',
  payload: {
    moduleId: 'economic-reality',
    href: '/modules/economic-reality',
  },
};
```

---

### RR-02

**Severity:** Critical

**Location:** `apps/web/src/lib/economic-reality/reconcileEconomicPlan.ts`

**Observed behavior:**  
After `refetch()`, UI can remain visually identical even when a network round-trip occurred. React components holding `state.presentation` do not re-render.

**Root cause:**  
When `incoming.meta.deterministicHash === current.deterministicHash`, `reconcileEconomicPlanState` returns the **same object reference** (`current`). `setState((prev) => reconcile(...))` then receives identical reference; React 18 bails out of re-render. This is **explicitly tested** as intended behavior.

**Why refresh fixes it:**  
Hard reload remounts `EconomicRealityPlanProvider`, resets client state to `EMPTY_*`, and hydrates fresh objects from API.

**Recommended fix:**  
On successful fetch, always hydrate into a **new object graph** (or merge execution/presentation deltas) even when hash is unchanged. Alternatively, refetch should set `loading` toggles or bump a `revision` counter to force render. Separate “identity” (hash) from “freshness” (lastFetchedAt).

**Risk:**  
High — undermines all refetch-based recovery paths.

**Evidence:**

```6:15:apps/web/src/lib/economic-reality/reconcileEconomicPlan.ts
export function reconcileEconomicPlanState(
  current: EconomicRealityClientStateV1,
  incoming: EconomicRealityPlanResponseV1
): EconomicRealityClientStateV1 {
  if (
    current.deterministicHash !== null &&
    current.deterministicHash === incoming.meta.deterministicHash
  ) {
    return current;
  }
```

```47:54:apps/web/src/lib/economic-reality/economic-reality.test.ts
  it('returns the same state reference when deterministicHash is unchanged', () => {
    const reconciled = reconcileEconomicPlanState(initial, response);
    expect(reconciled).toBe(initial);
  });
```

---

### RR-03

**Severity:** Critical

**Location:** `apps/web/src/lib/economic-reality/useEconomicFeedbackTracker.ts`, `apps/web/src/lib/economic-reality/revalidation.ts`

**Observed behavior:**  
User clicks “Start intent” or “Open resource”; API returns `200 accepted`, but Economic Reality surface does not update. No loading state, no card change, no toast (except error alert).

**Root cause:**  
`trackActionExecuted` calls `refetch()` **only when** `invalidateEconomicPlanIfHashChanged(previous, next)` is true. Most single action executions append one EP-12 event whose feedback deltas are zero (`mapEventsToFeedbackSignals` in `packages/modules/src/module-orchestration/feedback-mapper.ts`). Pipeline hash unchanged → `planChanged: false` → no refetch. Combined with RR-02, even a refetch would often no-op visually.

**Why refresh fixes it:**  
Reload fetches plan independently of hash-change gating.

**Recommended fix:**  
After successful execute, always refetch (or apply `planChanged` / execution delta from response body). Use hash change for cache **invalidation**, not for “whether to fetch.” Add optimistic UI feedback (card disabled, completion badge) independent of hash.

**Risk:**  
High — primary interaction loop on Economic Reality module page.

**Evidence:**

```54:65:apps/web/src/lib/economic-reality/useEconomicFeedbackTracker.ts
  const trackActionExecuted = useCallback(
    async (result: EconomicActionExecutionResult) => {
      if (
        invalidateEconomicPlanIfHashChanged(
          result.previousDeterministicHash,
          result.deterministicHash
        )
      ) {
        await refetch();
      }
    },
```

```42:47:packages/modules/src/module-orchestration/feedback-mapper.ts
export function mapEventsToFeedbackSignals(
  events: readonly EconomicRealityEventV1[]
): EconomicFeedbackSignalsV1 {
  if (events.length === 0) {
    return { ...EMPTY_ECONOMIC_FEEDBACK_SIGNALS };
  }
```

`MODULE_ENTERED` events are not mapped to feedback signals at all — `trackModuleEntered` almost never triggers invalidation.

---

### RR-04

**Severity:** Major

**Location:** `apps/web/src/components/AppProvider.tsx`

**Observed behavior:**  
User updates profile (employment, income, benefits). Life Event plan may update, but Economic Reality home card and module page show pre-mutation planning posture until full page refresh.

**Root cause:**  
`submitMutation` and `refreshSessionState` refresh `userContext`, `profileInsights`, `lifeEventPlan`, and `uiSnapshot` — but **never** call Economic Reality `refetch`. `EconomicRealityPlanProvider` only reloads on `sessionId` change (`useEffect([load])` where `load` depends on `sessionId` only).

**Why refresh fixes it:**  
Remount triggers initial `fetchEconomicPlan` with updated server `UserContext` → new `deterministicHash` (GJ-04 contract).

**Recommended fix:**  
Expose `invalidateEconomicPlan` from `EconomicRealityPlanProvider` and invoke from `submitMutation` / `refreshSessionState`. Subscribe to `profileHeadRevision` or `userContext.revision` as invalidation signal.

**Risk:**  
High for GJ-04 crisis recovery UX; breaks server/client plan parity.

**Evidence:**

```448:461:apps/web/src/components/AppProvider.tsx
  const submitMutation = useCallback(
    async (request: MutationRequest) => {
      const result = await submitMutationRequest(request, sessionId);
      setUserContext(result.userContext);
      setProfileHeadRevision(result.revision);
      void refreshProfileInsights();
      void refreshLifeEventPlan();
      return result;
    },
```

```308:310:apps/web/src/components/AppProvider.tsx
  const refreshSessionState = useCallback(async () => {
    await Promise.all([refreshUserContext(), refreshProfileInsights(), refreshLifeEventPlan(), refreshUiSnapshot()]);
  }, [...]);
```

```71:73:apps/web/src/lib/economic-reality/useEconomicRealityPlan.tsx
  useEffect(() => {
    void load();
  }, [load]);
```

---

### RR-05

**Severity:** Major

**Location:** `apps/web/src/components/AppProvider.tsx` — `submitMutation`

**Observed behavior:**  
Home priority actions, module execution panels, and `hasExecutedModule`-based suggestions stay stale after mutations submitted **only** through `submitMutation` (not via `refreshSessionState`).

**Root cause:**  
`submitMutation` updates `userContext` synchronously but does **not** call `refreshUiSnapshot()`. Snapshot-driven UI (`HomeSnapshotRenderer`, `useModuleSnapshot`, `ContractModulePage` form keys) depends on `uiSnapshot.snapshotVersion` and `executions[]`.

**Why refresh fixes it:**  
Initial mount effect re-fetches full session state including snapshot.

**Recommended fix:**  
Add `void refreshUiSnapshot()` to `submitMutation`, or unify all post-mutation refresh through `refreshSessionState()`.

**Risk:**  
Medium — affects home module suggestions and calculator result panels.

**Evidence:**

```448:459:apps/web/src/components/AppProvider.tsx
      setUserContext(result.userContext);
      setProfileHeadRevision(result.revision);
      void refreshProfileInsights();
      void refreshLifeEventPlan();
      // refreshUiSnapshot NOT called
```

---

### RR-06

**Severity:** Major

**Location:** `apps/web/src/components/AppProvider.tsx` — `applySnapshotIfNewer`

**Observed behavior:**  
Occasionally `refreshUiSnapshot()` appears to do nothing; UI keeps older snapshot data.

**Root cause:**  
`applySnapshotIfNewer` only calls `setUiSnapshot` when `snapshot.snapshotVersion > lastAppliedSnapshotVersionRef`. If server returns same or lower version (coordinator cache lag, concurrent mutations, error path), client silently retains stale snapshot. `lastAppliedSnapshotVersionRef` is reset only on `resetUserData` / `loadDemoPreset`.

**Why refresh fixes it:**  
Full reload resets `lastAppliedSnapshotVersionRef` to `-1` indirectly via remount... Actually remount resets ref to -1 on new AppProvider instance. Yes.

**Recommended fix:**  
On explicit `refreshUiSnapshot`, accept `>=` with deep equality check, or always set when `force: true`. Reset version ref on session change.

**Risk:**  
Medium — intermittent stale home / module panels.

**Evidence:**

```151:158:apps/web/src/components/AppProvider.tsx
  const applySnapshotIfNewer = useCallback((snapshot: UiSnapshot): boolean => {
    if (snapshot.snapshotVersion > lastAppliedSnapshotVersionRef.current) {
      lastAppliedSnapshotVersionRef.current = snapshot.snapshotVersion;
      setUiSnapshot(snapshot);
      return true;
    }
    return false;
  }, []);
```

---

### RR-07

**Severity:** Major

**Location:** `apps/web/src/lib/situation-utils.ts`, `apps/web/src/components/home/HomeSnapshotRenderer.tsx`

**Observed behavior:**  
Module recommendations on home do not reflect Life Event catalog routing (e.g. economic-reality CRISIS entry). Updating life plan does not change suggested modules unless profile heuristics change.

**Root cause:**  
`HomeSnapshotRenderer` builds `moduleSuggestions` via `suggestModules(snapshot, modules, profile)` — a **profile-gap heuristic**, not `suggestEconomicModulesFromLifePlan` (`life-event-bridge.ts`). The catalog bridge is used in tests only, not production home UI.

**Why refresh fixes it:**  
Reload re-fetches `lifeEventPlan` and `userContext`; if profile gaps changed, heuristics output changes. Catalog-backed recommendations were never wired.

**Recommended fix:**  
Merge catalog-backed suggestions from `lifeEventPlan` into home view model (`buildHomePlanViewModelV2`) per platform constitution. Invalidate when `lifeEventPlan` or `userContext` changes.

**Risk:**  
Medium — cross-module discovery does not match closed architecture.

**Evidence:**

```171:174:apps/web/src/components/home/HomeSnapshotRenderer.tsx
  const moduleSuggestions = useMemo(
    () => suggestModules(snapshot, modules, profile),
    [snapshot, modules, profile]
  );
```

```4:8:apps/web/src/lib/module-orchestration/life-event-bridge.ts
export function suggestEconomicModulesFromLifePlan(plan: LifeEventPlanV1) {
  return suggestModulesForLifeContext({
    lifeStateId: plan.currentLifeState,
    nodeIds: plan.nextBestActions.map((action) => action.id),
  });
}
```

---

### RR-08

**Severity:** Minor

**Location:** `apps/web/src/lib/economic-reality/cache.ts`

**Observed behavior:**  
Switching between contexts that produce the same `deterministicHash` always shows cached client state instantly; no network validation.

**Root cause:**  
In-memory `Map` keyed **only** by `deterministicHash`. Session identity is not part of the key. `reconcileEconomicPlanState` returns cache hit before hydration.

**Why refresh fixes it:**  
Reload clears module state (Map is process-lifetime; actually **survives** hot reload in dev). Full browser refresh clears JS heap — cache empty.

**Recommended fix:**  
Cache key: `${sessionId}:${deterministicHash}`. Clear cache on session change and profile mutation.

**Risk:**  
Low in single-session SPA; higher in session switch without reload.

**Evidence:**

```5:12:apps/web/src/lib/economic-reality/cache.ts
export function buildEconomicPlanCacheKey(deterministicHash: string): string {
  return `economic-plan:${deterministicHash}`;
}
```

---

### RR-09

**Severity:** Major

**Location:** `apps/web/src/lib/economic-reality/action-context.ts`

**Observed behavior:**  
Action execute uses stale `deterministicHash` if context binding races with plan refetch. User receives `E_STALE_ACTION_SET` alert.

**Root cause:**  
`activeContext` is a module-level mutable variable, not React state. Updated in `useEffect` after render when `state.deterministicHash` changes. Rapid clicks or concurrent refetch can execute against old hash.

**Why refresh fixes it:**  
Reload re-binds context from fresh plan.

**Recommended fix:**  
Pass `deterministicHash` and `actionSet` directly to execute handler from current render closure, or use ref synced synchronously during render (not effect).

**Risk:**  
Medium — 409 errors under fast interaction.

**Evidence:**

```9:16:apps/web/src/lib/economic-reality/action-context.ts
let activeContext: EconomicActionExecutionContext | null = null;

export function bindEconomicActionContext(context: EconomicActionExecutionContext | null): void {
  activeContext = context;
}
```

```75:86:apps/web/src/lib/economic-reality/useEconomicRealityPlan.tsx
  useEffect(() => {
    if (sessionId && state.deterministicHash && state.actionSet) {
      bindEconomicActionContext({ ... });
    }
  }, [sessionId, state.deterministicHash, state.actionSet]);
```

---

### RR-10

**Severity:** Major

**Location:** `apps/web/src/lib/life-event/runtime/runtime-store.ts`

**Observed behavior:**  
LE-8 runtime effects (`RuntimeCrossModuleFeedback`) never appear in UI during normal flows.

**Root cause:**  
`processModuleRuntimeEvent` is never called from production web code. `runtime-store` is a module singleton outside React. Only `resetRuntimeSessionState` is invoked from dev/demo reset.

**Why refresh fixes it:**  
Does not fix — feature is effectively dormant in UI.

**Recommended fix:**  
Wire module execute / action callbacks to `processModuleRuntimeEvent` and lift effects into React state, or remove dead surface until integrated.

**Risk:**  
Low for current UX; medium for LE-8 architecture claims.

**Evidence:**

```11:14:apps/web/src/lib/life-event/runtime/runtime-store.ts
let activeSessionState: RuntimeSessionState = createRuntimeSessionState();

export function getRuntimeSessionState(): RuntimeSessionState {
  return activeSessionState;
}
```

Grep: `processModuleRuntimeEvent` appears only in `runtime-engine.test.ts`, not in `apps/web/src/components` or pages.

---

### RR-11

**Severity:** Minor

**Location:** `apps/web/src/lib/economic-reality/useEconomicRealityPlan.tsx`

**Observed behavior:**  
Rapid `sessionId` changes can apply economic plan from an older request.

**Root cause:**  
`load()` has no in-flight generation guard (unlike `AppProvider` fetch helpers using `*FetchGenerationRef`).

**Why refresh fixes it:**  
Single session stable after reload.

**Recommended fix:**  
Add request generation counter or `AbortController` to `load()`.

**Risk:**  
Low except during dev reset / demo preset switch.

**Evidence:**

```31:57:apps/web/src/lib/economic-reality/useEconomicRealityPlan.tsx
  const load = useCallback(async () => {
    // no requestId / abort guard
    const response = await fetchEconomicPlan(sessionId);
    setState((prev) => reconcileEconomicPlanState(prev, response));
  }, [sessionId]);
```

---

### RR-12

**Severity:** Minor

**Location:** `apps/web/src/lib/economic-reality/client.ts`, `apps/web/src/lib/life-event-plan/client.ts`

**Observed behavior:**  
Potential browser HTTP cache serving stale GET plans (environment-dependent).

**Root cause:**  
`fetch()` calls omit `cache: 'no-store'`. If API sends cache-friendly headers, browser may reuse response.

**Why refresh fixes it:**  
Hard reload may bypass cache depending on headers.

**Recommended fix:**  
Add `cache: 'no-store'` to all plan and snapshot GET clients.

**Risk:**  
Low with default API headers; elevated behind CDNs.

**Evidence:**

```14:16:apps/web/src/lib/economic-reality/client.ts
  const res = await fetch(`${API_URL}/api/modules/economic-reality/plan`, {
    headers: buildAuthHeaders({ sessionId }),
  });
```

---

### RR-13

**Severity:** Minor

**Location:** `apps/web/src/components/profile/DomainMutationEditor.tsx`

**Observed behavior:**  
Draft form may show stale values if `userContext` updates externally while editor is open.

**Root cause:**  
`initialDraft` from `useMemo([section, profile])` seeds `useState(initialDraft)` once; no `useEffect` resync when `profile` changes.

**Why refresh fixes it:**  
Remount re-seeds draft.

**Recommended fix:**  
Reset draft when `profileHeadRevision` changes.

**Risk:**  
Low — profile editor edge case.

---

### RR-14

**Severity:** Minor

**Location:** `apps/web/src/components/AppProvider.tsx` — module catalog fetch

**Observed behavior:**  
Module catalog loaded once on mount; never refreshed after mutations or demo preset.

**Root cause:**  
`useEffect([], fetchModuleCatalog)` — empty deps by design.

**Why refresh fixes it:**  
Reload re-fetches catalog.

**Recommended fix:**  
Acceptable if catalog is static; otherwise tie to session bootstrap.

**Risk:**  
Low — catalog is relatively static.

---

## Symptom → root cause matrix

| User report | Primary issues |
|-------------|----------------|
| Click action, no visible change | RR-01, RR-03, RR-02 |
| Block appears only after refresh | RR-04, RR-05, RR-02 |
| Module recommendations update after reload only | RR-07, RR-05 |
| API state changes, UI stale | RR-04, RR-05, RR-02 |
| Server plan / hash changed, UI not reacting | RR-04, RR-02, RR-03 |

---

## React Query / Zustand search results

| Search target | Result |
|---------------|--------|
| `invalidateQueries` / `refetchQueries` / `queryClient` | **Not found** |
| `queryKey` / `staleTime` / `gcTime` | **Not found** |
| `zustand` / `create(` store | **Not found** |
| Custom invalidation | `invalidateEconomicPlanIfHashChanged` — hash-only, economic plan only |
| Custom cache | `economicPlanCache` Map in `cache.ts` |

---

# Runtime Reactivity Score

| Category | Score | Notes |
|----------|-------|-------|
| **Query invalidation** | 2 / 10 | No unified invalidation layer; hash-gated refetch only for ER actions |
| **Store synchronization** | 4 / 10 | `AppProvider` coordinates LE + snapshot partially; ER plan isolated |
| **Cache correctness** | 3 / 10 | Hash identity conflated with freshness; reference-equality bail-out |
| **Mutation flow** | 4 / 10 | `submitMutation` chain incomplete; fire-and-forget async refreshes |
| **Routing** | 4 / 10 | Catalog router exists but ER `ActionRenderer` bypasses it |
| **Hydration** | 7 / 10 | `hydrateEconomicPlan` correct; undermined by reconcile short-circuit |
| **UI projection** | 6 / 10 | `adaptPresentationToUi` is pure and correct; inputs often stale |

**Overall runtime reactivity:** **4 / 10** — server determinism is sound; client propagation is not.

---

# Patch Plan

## P1 — Restore visible action feedback (stop the bleeding)

| ID | Action |
|----|--------|
| RR-01 | Split `ActionRenderer` execute vs navigate by `action.type` |
| RR-03 | Always refetch plan after successful execute; use `planChanged` for UI delta |
| RR-02 | Never return same reference from reconcile on explicit fetch |

**Exit criteria:** Clicking ER intent/resource shows feedback; profile/module cards navigate.

## P2 — Unify post-mutation refresh graph

| ID | Action |
|----|--------|
| RR-04 | Wire `refreshEconomicPlan()` into `submitMutation` + `refreshSessionState` |
| RR-05 | Add `refreshUiSnapshot()` to `submitMutation` |
| RR-09 | Pass action context from render closure, not effect-bound singleton |

**Exit criteria:** GJ-04 profile stabilization updates ER UI without reload.

## P3 — Home & catalog coherence

| ID | Action |
|----|--------|
| RR-07 | Integrate `suggestEconomicModulesFromLifePlan` into home view model |
| RR-06 | Harden snapshot version application on forced refresh |

**Exit criteria:** Home module suggestions track life event catalog.

## P4 — Hardening & cleanup

| ID | Action |
|----|--------|
| RR-08 | Session-scope cache keys; clear on mutation |
| RR-11 | Request generation guard on ER `load()` |
| RR-12 | `cache: 'no-store'` on plan clients |
| RR-10 | Wire or remove LE-8 runtime UI path |
| RR-13 | Profile editor draft resync |
| RR-14 | Document static catalog policy |

**Exit criteria:** No stale closure races in dev reset; defensive fetch semantics.

---

## Testing recommendations (audit-only)

Add runtime reactivity tests (not in scope of this audit):

1. **Mutation → ER refetch** — profile update changes ER presentation without reload  
2. **Action execute → UI feedback** — click shows state change even when hash unchanged  
3. **Reconcile freshness** — two identical hashes from network still produce renderable update when `forceRefresh`  
4. **submitMutation snapshot** — `snapshotVersion` increments client-side after mutation  

Reference contracts: [Golden User Journeys v1](../testing/golden-user-journeys-v1.md), especially GJ-04.

---

## Architectural note

This audit does **not** recommend adopting React Query or Zustand as a prerequisite. The minimum fix path is **completing the refresh graph** and **separating hash identity from UI freshness** within the existing Context architecture. A unified data layer (TanStack Query or equivalent) would reduce recurrence risk but is a separate decision.

---

**Auditor conclusion:** Observed UX bugs are systematic synchronization gaps, not isolated component defects. Economic Reality v1 server closure remains valid; client runtime propagation is **not** closure-ready for interactive use until P1–P2 are addressed.
