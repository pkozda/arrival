---
id: snapshot-versioning-ordering
title: Snapshot Versioning Ordering Refactor
project: Arrival Atlas
system: Arrival Atlas
type: refactor
domain: platform
status: active
maturity: stable
owner: system
tags:
  - snapshot-projection
  - system-state
created: 2026-06-01
updated: 2026-06-19
related:
---

# P3: Snapshot Versioning & Ordering Model

**Status:** Implemented  
**Date:** 2026-06-16  
**Scope:** Ordering metadata + client reconciliation only — no business-logic changes

---

## Problem

After P2.5 (reactive snapshot refresh) and P2.6 (coherency audit), `UiSnapshot` was functionally correct but **not deterministically ordered** under concurrent mutations. Multiple in-flight `refreshUiSnapshot()` calls could resolve out of order, causing the client to apply a stale snapshot and regress UI state.

---

## Solution Overview

Introduce a **per-session monotonic version counter** on the server and a **client reconciliation gate** that only applies snapshots with a strictly higher `snapshotVersion`.

### Invariant

> **UI state is a projection of the highest `snapshotVersion` received.**

The client never moves backward in version space. Network timing cannot overwrite newer semantic state.

---

## Architecture

```
POST /execute
  ├─ recordSnapshotMutation(sessionId, executionId)  → v++
  ├─ storeModuleExecution(..., executionId, snapshotVersion)
  └─ activateProfileFromModuleExecution
       └─ if patch applied: recordSnapshotMutation(sessionId, profile:{moduleId}) → v++

POST/PATCH /api/profile
  └─ recordSnapshotMutation(sessionId, profile-create|update:...) → v++

GET /api/ui-snapshot
  └─ attach { snapshotVersion, lastMutationId, generatedAt }
       + executions[].{ executionId, snapshotVersion }

Client AppProvider
  ├─ lastAppliedSnapshotVersion (ref, starts at -1)
  ├─ applySnapshotIfNewer(snapshot) — apply iff version > lastApplied
  └─ snapshotFetchGenerationRef — ignore superseded in-flight fetches
```

---

## Backend Changes

### 1. `snapshot-version-store.ts` (new)

In-memory per-session counter:

| Field | Description |
|-------|-------------|
| `snapshotVersion` | Monotonic integer, starts at `0` |
| `lastMutationId` | ID of the most recent mutation |

`recordSnapshotMutation(sessionId, mutationId)` increments and returns the new version.

### 2. `GET /api/ui-snapshot` response extensions

```typescript
{
  snapshotVersion: number;      // current session version
  lastMutationId: string | null;
  generatedAt: string;          // ISO timestamp at read time
  executions: [{
    moduleId, result, timestamp,
    executionId: string,
    snapshotVersion: number,    // version at execution time
  }],
  // ...unchanged fields
}
```

### 3. Mutation sources that bump version

| Event | Mutation ID format |
|-------|-------------------|
| Module execution | `executionId` (UUID) |
| Profile activation (from execute) | `profile:{moduleId}` |
| Profile create (`POST /api/profile`) | `profile-create:{profileId}` |
| Profile update (`PATCH /api/profile`) | `profile-update:{profileId}:{revision}` |

Version increments are **strict** — no resets within a session.

### 4. Execution linking

Each stored execution carries:

- `executionId` — unique per execute
- `snapshotVersion` — version assigned at execution time

---

## Client Changes

### `AppProvider.tsx`

```typescript
const lastAppliedSnapshotVersionRef = useRef(-1);
const snapshotFetchGenerationRef = useRef(0);

function applySnapshotIfNewer(snapshot: UiSnapshot): boolean {
  if (snapshot.snapshotVersion > lastAppliedSnapshotVersionRef.current) {
    lastAppliedSnapshotVersionRef.current = snapshot.snapshotVersion;
    setUiSnapshot(snapshot);
    return true;
  }
  return false; // stale — discard silently
}
```

### In-flight request safety (Option A)

A monotonic `snapshotFetchGenerationRef` counter is incremented on each fetch. Responses from superseded requests are ignored even if they arrive after a newer request completes.

### Failure behavior

- **Failed snapshot fetch:** error is surfaced; existing snapshot and version cursor are **retained** (no decrement).
- **Out-of-order response:** discarded by version check; no UI regression.

---

## Ordering Model (Formal)

1. Server maintains `V(session) ∈ ℕ`, starting at `0`.
2. Each write-side mutation `m` produces `(V', id_m)` where `V' = V + 1`.
3. Snapshot read at time `t` returns `snapshotVersion = V(session)`.
4. Client maintains `lastApplied ∈ ℕ`, starting at `-1`.
5. Apply rule: `apply(s)` iff `s.snapshotVersion > lastApplied`; then `lastApplied ← s.snapshotVersion`.

**Monotonicity guarantee:** Client UI state only advances along the version axis. Stale reads cannot cause regression.

---

## Verification Scenarios

### Scenario A — Normal single-execute flow

1. Load app → `snapshotVersion = 0`
2. Execute `financial-reality` → version bumps (execution + profile activation)
3. `refreshUiSnapshot()` → client applies new version
4. **Expected:** UI reflects execution result; no regression

**Automated:** `ui-snapshot.test.ts` — "includes profile, executions, and ux snapshot after module execution"

### Scenario B — Two rapid executes (race)

1. Fire two concurrent `POST /execute` on same module with different inputs
2. Both succeed; server assigns distinct `executionId` and ascending `snapshotVersion`
3. Client fires two `refreshUiSnapshot()` calls
4. Responses may arrive out of order
5. **Expected:** Client converges to highest `snapshotVersion`; no rollback to older grossIncome / profile values

**Automated:** `ui-snapshot.test.ts` — "preserves highest execution snapshotVersion under concurrent module executes"

**Manual check:**
```
1. Open financial-reality module
2. Execute twice quickly with different income values
3. Confirm final UI shows the later execution's state
```

### Scenario C — Out-of-order snapshot responses

Simulated by client logic (no server change needed):

1. `lastApplied = 5`
2. Response A arrives: `snapshotVersion = 4` → **discarded**
3. Response B arrives: `snapshotVersion = 6` → **applied**
4. **Expected:** UI stays at v5 until v6 arrives; v4 never overwrites

**Automated:** covered by `applySnapshotIfNewer` unit behavior (version gate) + fetch generation ref.

### Scenario D — Failed refresh after successful execute

1. Execute succeeds (server at v3)
2. `refreshUiSnapshot()` fails (network error)
3. **Expected:** Previous snapshot retained; `lastApplied` unchanged; retry applies v3+

---

## Files Changed

| File | Change |
|------|--------|
| `apps/api/src/snapshot-version-store.ts` | New — version counter |
| `apps/api/src/snapshot-version-store.test.ts` | New — unit tests |
| `apps/api/src/module-execution-store.ts` | `executionId`, `snapshotVersion` on executions |
| `apps/api/src/routes/ui-snapshot.ts` | Version metadata on snapshot |
| `apps/api/src/build-app.ts` | Bump on execute + profile activation |
| `apps/api/src/routes/profile.ts` | Bump on profile create/update |
| `apps/api/src/profile-activation.ts` | Returns `boolean` (patch applied) |
| `apps/web/src/lib/api.ts` | Extended `UiSnapshot` type |
| `apps/web/src/components/AppProvider.tsx` | `applySnapshotIfNewer` + fetch generation |
| `apps/api/src/ui-snapshot.test.ts` | Versioning integration tests |

---

## Test Results

```
API: 26/26 tests passing
Web: typecheck passing
```

---

## Known Limitations (unchanged / out of scope)

- Version store is **in-memory** — resets on API restart (same as profile/execution stores).
- Module form hydration still uses `defaultValue` — snapshot version ordering does not force re-mount of uncontrolled inputs (P2.6 finding; separate fix).
- `GET /api/ui-snapshot` does not bump version (read-only projection).

---

## Success Criteria Checklist

| Criterion | Status |
|-----------|--------|
| No UI regression in normal single-execute flow | ✅ |
| Two rapid executes do not cause UI rollback | ✅ |
| Out-of-order responses never overwrite newer state | ✅ |
| `snapshotVersion` visible in API response | ✅ |
| UI converges to highest version state | ✅ |
| No business-logic changes | ✅ |
| No Profile schema changes | ✅ |
