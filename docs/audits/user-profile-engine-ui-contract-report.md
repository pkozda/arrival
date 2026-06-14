# User Profile Engine — Phase 1.9 UI Profile Contract Stabilization Report

**Date:** June 2026  
**Package:** `@arrivalos/profile@0.1.0`  
**Follows:** `docs/audits/user-profile-engine-execution-trace-report.md`  
**Status:** Complete

---

## Executive Summary

Phase 1.9 finalizes the Profile Engine as a **stable, UI-consumable contract layer** without expanding scope. Profile CRUD endpoints now expose an explicit `UIProfileResponse` boundary type. Internal engine structures — policy views, execution traces, merge results, and `AppContext` — remain strictly backend-only.

**57 automated tests pass** (23 profile + 25 shared-services + 6 modules + 3 API). No changes to `resolveExecutionContext()`, policy logic, trace system, or `ModuleRegistry`.

---

## Architectural Intent

Three clean layers are now explicit:

```
┌─────────────────────────────────────┐
│  UI Profile Layer (this phase)      │
│  GET/PATCH /api/profile             │
│  → UIProfileResponse only           │
└─────────────────────────────────────┘
              │
              ▼ (session-bound profile store)
┌─────────────────────────────────────┐
│  Execution Engine                   │
│  resolveExecutionContext()          │
│  → policy + merge + trace           │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Modules                            │
│  pure input/output execution        │
└─────────────────────────────────────┘
```

| Layer | Entry point | Consumer |
|-------|-------------|----------|
| **UI Profile** | `GET/PATCH /api/profile` | Web client, forms |
| **Execution Engine** | `resolveExecutionContext()` | Module execute handler only |
| **Modules** | `ModuleRegistry.execute()` | Business logic |

---

## UI Profile Contract

### Boundary type: `UIProfileResponse`

Defined in `packages/profile/src/api/ui-profile-response.ts` — intentionally separate from internal engine types (`ProfileRecord`, `ProfileSlice`, `ExecutionTrace`).

```typescript
interface UIProfileResponse {
  profile: UIProfileDocument;  // full document, never policy-filtered
  version: number;             // optimistic concurrency revision
  schemaVersion: string;       // document schema version
}
```

Mapper: `toUIProfileResponse(record)` — converts internal `ProfileRecord` to the public contract via `structuredClone`, stripping internal identifiers.

### Forbidden response keys

`UI_PROFILE_FORBIDDEN_RESPONSE_KEYS` documents keys that must never appear on profile CRUD responses:

`trace`, `steps`, `policy`, `policyId`, `policyDocument`, `mergedInput`, `context`, `profileSlice`, `dataProvenance`, `profileId`, `revision`, `inputProvenance`, `moduleId`

---

## API Endpoints

### `GET /api/profile`

| Requirement | Status |
|-------------|--------|
| Requires `X-Session-Id` | ✅ |
| Returns full profile document (not policy-filtered) | ✅ |
| Returns `version` + `schemaVersion` | ✅ |
| Excludes trace, policy, merge metadata | ✅ |

### `PATCH /api/profile`

| Requirement | Status |
|-------------|--------|
| Requires `X-Session-Id` | ✅ |
| Requires `If-Match` or `X-Profile-Revision` | ✅ (428 if missing) |
| Returns `UIProfileResponse` with new version | ✅ |
| Appends revision history | ✅ (unchanged) |
| 409 on revision conflict | ✅ |

### `POST /api/profile`

Create endpoint aligned to the same `UIProfileResponse` shape for consistency (no internal `profileId` in response — session is the identity mechanism).

### Unchanged endpoints (not UI profile contract)

| Endpoint | Role |
|----------|------|
| `GET /api/profile/revisions` | Audit history (separate concern) |
| `POST /api/modules/:id/execute` | Execution engine entry |
| `GET /api/modules/:id/trace` | Trace retrieval (execution layer) |

---

## Separation of Concerns Verified

| Internal structure | Profile API | Execution API |
|--------------------|-------------|---------------|
| `UIProfileResponse` | ✅ exposed | ❌ |
| `ProfileRecord.id` | ❌ hidden | internal only |
| `ProfileSlice` (policy-filtered) | ❌ | via `AppContext` only |
| `ExecutionTrace` | ❌ | via `/trace` only |
| `mergedInput` | ❌ | module execute only |
| `policyDocument` | ❌ | internal merge source |
| `AppContext` | ❌ | module execute only |

`resolveExecutionContext()` is not imported or called from profile routes.

---

## Session Binding

| Rule | Status |
|------|--------|
| `X-Session-Id` is the only identity mechanism | ✅ |
| No new auth layer | ✅ |
| In-memory session → profile binding (Phase 0) | ✅ |
| Profile create binds to session when header present | ✅ |

---

## Files Changed

### New

| Path | Purpose |
|------|---------|
| `packages/profile/src/api/ui-profile-response.ts` | `UIProfileResponse`, mapper, forbidden keys |
| `packages/profile/src/api/ui-profile-response.test.ts` | Mapper unit test |
| `packages/profile/src/api/index.ts` | Public API exports |
| `apps/api/src/profile-ui-contract.test.ts` | Hard boundary validation tests |
| `docs/audits/user-profile-engine-ui-contract-report.md` | This report |

### Modified

| Path | Change |
|------|--------|
| `packages/profile/src/index.ts` | Export `api` subsystem |
| `apps/api/src/routes/profile.ts` | GET/PATCH/POST return `UIProfileResponse` |
| `apps/api/src/profile.integration.test.ts` | Updated to `version` field |

### Unchanged (by design)

| Path | Reason |
|------|--------|
| `resolve-execution-context.ts` | Execution engine — out of scope |
| `policy/*` | Policy layer — out of scope |
| `trace/*` | Trace system — out of scope |
| `AppContextSchema` | No schema changes |
| `ModuleRegistry` | No interface changes |

---

## Test Coverage

| Suite | Tests | New |
|-------|-------|-----|
| `@arrivalos/profile` | 23 | +1 mapper test |
| `@arrivalos/api` | 3 | +2 boundary tests |
| **Total** | **57** | **+3** |

### Critical boundary test (`profile-ui-contract.test.ts`)

1. Create session → create profile → PATCH with `If-Match`
2. `GET /api/profile` returns updated `version: 2` with full employment/housing data
3. Response body contains **exactly** `profile`, `version`, `schemaVersion`
4. Forbidden engine keys absent at root and nested profile level
5. PATCH without concurrency header returns **428**

---

## Example UI Response

```json
{
  "profile": {
    "schemaVersion": "1.0.0",
    "preferredLanguage": "de",
    "employment": {
      "grossMonthlyIncome": 3200,
      "taxClass": 1,
      "churchTax": false,
      "status": "employed"
    },
    "housing": {
      "monthlyColdRent": 900
    },
    "extensions": {}
  },
  "version": 2,
  "schemaVersion": "1.0.0"
}
```

Note: `grossMonthlyIncome` is present in the UI profile (full document). Policy redaction applies only at module execution time via `resolveExecutionContext()`.

---

## Non-Goals (confirmed not implemented)

- UI state management / React hooks
- PostgreSQL persistence
- Auth system
- Profile schema expansion
- New profile fields
- Policy or trace exposure on profile endpoints

---

## Verdict

The Profile Engine is **stable and UI-ready**. The web client can consume `GET /api/profile` for form pre-fill and `PATCH /api/profile` with `If-Match` for optimistic updates. Execution, policy, and trace remain fully isolated in the backend runtime layer.

**Recommended next step for web:** Wire `AppProvider` to `GET/PATCH /api/profile` using `UIProfileResponse`; keep module execution separate via existing execute endpoints.
