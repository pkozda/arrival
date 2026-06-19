---
id: snapshot-driven-ui-reconstruction
title: Snapshot Driven UI Reconstruction
project: Arrival Atlas
system: Arrival Atlas
type: refactor
domain: platform
status: active
maturity: stable
owner: system
tags:
  - snapshot-projection
  - contract-driven-ui
created: 2026-06-01
updated: 2026-06-19
related:
---

# P4: Snapshot-Driven UI Reconstruction Layer

**Status:** Implemented  
**Date:** 2026-06-16  
**Scope:** Frontend only — no backend, persistence, or Profile schema changes

---

## Problem

After P3, snapshot ordering was deterministic, but module pages still used a **split-brain UI model**:

```
UI = f(localState, snapshot fragments, implicit defaults)
```

Each module page stored `executionResult` in `useState`, making the client an independent source of truth for rendered results. Concurrent refresh + local state caused potential divergence from `UiSnapshot`.

---

## Solution

Introduce a **pure selector layer** and **`useSnapshotReconstruction` hook** so that:

```
UI = f(UiSnapshot(snapshotVersion))
```

Local state is limited to transient UX: `loading`, `error`, and in-flight indicators.

### Invariant

> Any visible UI state after render must be derivable from `UiSnapshot` alone.

---

## Architecture

```
AppProvider (uiSnapshot + snapshotVersion)
        │
        ▼
useSnapshotReconstruction(moduleId)
        │
        ├── getModuleUIState(snapshot, moduleId)
        │     ├── getModuleExecution()
        │     ├── getModuleInputDefaults()
        │     └── getModuleUx()
        │
        ▼
Module Page: snapshot → selector → render
```

---

## New Files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/snapshot/types.ts` | `ModuleUIState`, `ModuleUIStatus`, `SnapshotReconstruction` |
| `apps/web/src/lib/snapshot/selectors/get-module-execution.ts` | Latest execution for module |
| `apps/web/src/lib/snapshot/selectors/get-module-input-defaults.ts` | Form defaults from profile + schema |
| `apps/web/src/lib/snapshot/selectors/module-input-defaults.ts` | Per-module default builders |
| `apps/web/src/lib/snapshot/selectors/get-module-ux.ts` | UX cards filtered by `source` |
| `apps/web/src/lib/snapshot/selectors/get-module-ui-state.ts` | Full deterministic UI state |
| `apps/web/src/lib/snapshot/to-module-result.ts` | Adapter for `ModuleResultRenderer` |
| `apps/web/src/lib/snapshot/useSnapshotReconstruction.ts` | React hook (`useModuleSnapshot` alias) |
| `apps/web/src/lib/snapshot/index.ts` | Barrel export |

---

## Selector API

### `getModuleExecution(snapshot, moduleId)`

Returns the latest execution entry for a module (sorted by timestamp).

### `getModuleInputDefaults(snapshot, moduleId)`

Reconstructs form defaults:

1. `snapshot.profile` (module-relevant fields)
2. Schema defaults (module-specific fallbacks)

### `getModuleUIState(snapshot, moduleId)`

```typescript
{
  input: Record<string, unknown>;
  result: unknown | null;
  ux: UxPayload | null;
  status: 'idle' | 'executed' | 'partial';
  executionId: string | null;
  snapshotVersion: number;
}
```

**Status rules:**

| Status | Condition |
|--------|-----------|
| `idle` | No execution, no relevant profile fields |
| `partial` | Profile has module-relevant fields, no execution |
| `executed` | Execution result present in snapshot |

### `useSnapshotReconstruction(moduleId)`

Returns `ModuleUIState` plus:

- `isStale: boolean` — `uiSnapshotLoading && snapshot !== null` (refresh in flight)

---

## Module Page Migration

All 5 module pages migrated:

- `financial-reality`
- `healthcare-navigation`
- `life-event`
- `grocery-optimization`
- `system-translation`

### Before

```typescript
const [executionResult, setExecutionResult] = useState<ModuleResult | null>(null);
const result = executionResult?.data ?? null;
// ...
setExecutionResult(res);
recordModuleUx(moduleId, res);
```

### After

```typescript
const uiState = useModuleSnapshot('financial-reality');
const result = uiState.result as FinancialResult | null;
const moduleResult = toModuleResult('financial-reality', uiState);
// ...
await refreshUiSnapshot(); // no local result storage
```

### Form remounting

Forms use `key={moduleId-${uiState.snapshotVersion}}` so uncontrolled `defaultValue` fields reconstruct when snapshot version advances (profile hydration after execute).

---

## State Source Matrix

| State | Source |
|-------|--------|
| Form defaults | `getModuleInputDefaults` → profile + schema |
| Execution result | `snapshot.executions[]` |
| UX action cards | `snapshot.uxSnapshot.actionCards` (filtered by `source`) |
| Loading | Local `useState` only |
| Errors | Local `useState` only |
| Persisted state | `UiSnapshot` only |

---

## P3 + P4 Combined Rules

1. Client applies only snapshots with `snapshotVersion > lastApplied` (P3)
2. Module UI derives entirely from applied snapshot (P4)
3. During refresh: `isStale` suppresses mixed old/new rendering
4. On execute failure: snapshot result retained (no local clear)

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Missing profile | Schema defaults used |
| Missing execution | `status: idle`, `result: null` |
| Partial profile | `status: partial`, form hydrated from profile |
| Network lag during refresh | `isStale` → loading panel, no local result merge |
| Page reload | Full reconstruction from snapshot (execution results restored) |

---

## Removed Anti-patterns

- `executionResult` / `setExecutionResult` in all module pages ✅
- `recordModuleUx()` from module pages (UX now from snapshot) ✅
- Direct `uiSnapshot?.profile` field reads in module pages ✅

**Note:** `ux-store` remains for legacy global UX panels (`GlobalUxPanel`, etc.) — out of P4 scope.

---

## Success Criteria

| Criterion | Status |
|-----------|--------|
| UI reconstructible from snapshot only | ✅ |
| No local result authority | ✅ |
| `executionResult` not required for correctness | ✅ |
| No mixed old execution + new profile | ✅ |
| Same snapshot → same UI | ✅ |
| At least 1 module fully snapshot-driven | ✅ (all 5) |
| Selectors compute full UI state | ✅ |
| `snapshotVersion` determines rendering outcome | ✅ |

---

## Verification

```bash
npm run typecheck --workspace=apps/web   # ✅ passing
```

**Manual scenarios:**

1. Execute financial-reality → result appears after snapshot refresh
2. Reload page → result still visible (from snapshot, not local state)
3. Rapid double execute → P3 version gate + snapshot-only result
4. Profile fields hydrate form after execute (form remount on version bump)

---

## Known Limitations

- Forms remain **uncontrolled** (`defaultValue`) — remount via `key` is the reconstruction mechanism
- Module input fields not stored in snapshot (only profile-mapped fields persist)
- `ux-store` global panels not yet snapshot-driven (future work)
- `system-translation` query field resets on snapshot version bump (no profile mapping)

---

## Non-goals (unchanged)

- No backend changes
- No controlled input migration
- No WebSocket sync (P5)
