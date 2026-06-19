---
id: user-profile-engine-phase0-report
title: User Profile Engine Phase 0 Report
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: identity
status: archived
maturity: stable
owner: system
tags:
  - profile-engine
created: 2026-06-01
updated: 2026-06-19
related:
---

# User Profile Engine — Phase 0 Implementation Report

**Date:** June 2026  
**Package:** `@arrival-atlas/profile@0.1.0`  
**Design reference:** `docs/identity/user-profile-engine-design.md`  
**Phases completed:** Phase 0 (in-memory vertical slice)  
**Phases explicitly not started:** Phase 1 UI prefill, Phase 2 PostgreSQL, Phase 3 auth/onboarding, Phase 4 full personalization

---

## Executive Summary

The User Profile Engine (UPE) Phase 0 vertical slice is **implemented and tested**. A new `@arrival-atlas/profile` package provides typed profile documents, in-memory persistence with revision tracking, session binding, `AppContext` hydration, and module input merging. The Fastify API exposes profile CRUD endpoints and wires profile-aware context into module execution.

This delivers the core runtime loop described in the architecture design:

```
Session → Profile (in-memory) → ContextBuilder → AppContext → ModuleRegistry.execute()
                                      ↓
                               InputMerger (profile + input → merged input)
```

**41 automated tests pass** across the monorepo (9 profile + 25 shared-services + 6 modules + 1 API integration). No PostgreSQL, authentication, or UI changes were introduced.

> **Update (June 2026):** Profile Policy Layer (Phase 1.7) — see [`user-profile-engine-policy-layer-report.md`](./policy-layer-report.md). Test count now **51** (19 profile + 25 shared-services + 6 modules + 1 API).

---

## Completed Items

### Package — `@arrival-atlas/profile`

| Component | Path | Status |
|-----------|------|--------|
| Profile document schema (Zod) | `src/types/profile-document.ts` | ✅ |
| Profile record / revision types | `src/types/profile-record.ts` | ✅ |
| Profile slice type | `src/types/profile-slice.ts` | ✅ |
| Storage port interface | `src/ports/profile-store.ts` | ✅ |
| In-memory store | `src/adapters/in-memory-store.ts` | ✅ |
| ProfileEngine | `src/engine/profile-engine.ts` | ✅ |
| ContextBuilder | `src/engine/context-builder.ts` | ✅ |
| InputMerger | `src/engine/input-merger.ts` | ✅ |
| Deep merge + changed-field tracking | `src/utils/merge-profile.ts` | ✅ |
| Migration hook (stub) | `src/migrations/index.ts` | ✅ |
| Error types (409 conflict, 404) | `src/errors/profile-revision-conflict.ts` | ✅ |

### Core platform — `@arrival-atlas/core`

Extended `AppContextSchema` with **optional, backward-compatible** fields:

| Field | Purpose |
|-------|---------|
| `profileId` | Link to active profile |
| `profileVersion` | Optimistic concurrency / audit |
| `profileSchemaVersion` | Schema semver |
| `profileSlice` | Module-resolved profile view |
| `dataProvenance` | Field source tracking (`input`, `profile`, `default`, `override`) |

Legacy fields (`userProfile`, `systemState`, `location`) are preserved and populated from profile via shims in `ContextBuilder`.

### API — `apps/api`

| Endpoint | Method | Status |
|----------|--------|--------|
| `/api/profile` | `POST` | ✅ Create profile; bind to `X-Session-Id` |
| `/api/profile` | `GET` | ✅ Get profile for session |
| `/api/profile` | `PATCH` | ✅ Update with `If-Match` / `X-Profile-Revision` |
| `/api/profile/revisions` | `GET` | ✅ Revision history |
| `/api/modules/:id/execute` | `POST` | ✅ Profile-aware context + input merge |

Refactored API bootstrap into `build-app.ts` for testability. Singleton runtime in `profile-runtime.ts`.

### Tests

| Suite | Location | Tests |
|-------|----------|------:|
| InputMerger precedence | `packages/profile/src/engine/input-merger.test.ts` | 4 |
| ProfileEngine + store | `packages/profile/src/engine/profile-engine.test.ts` | 4 |
| Profile vertical slice | `packages/profile/src/profile.integration.test.ts` | 1 |
| API HTTP integration | `apps/api/src/profile.integration.test.ts` | 1 |

---

## Profile Schema (v1.0.0)

Core fields implemented per design document:

| Domain | Fields |
|--------|--------|
| **Locale** | `preferredLanguage`, `countryOfOrigin` |
| **Location** | `location.bundesland`, `location.city` |
| **Residency** | `residency.status`, `residency.arrivedAt` |
| **Household** | `household.size`, `household.maritalStatus`, `household.children[]` |
| **Employment** | `employment.status`, `employment.grossMonthlyIncome`, `employment.taxClass`, `employment.churchTax` |
| **Housing** | `housing.monthlyColdRent`, `housing.monthlyUtilities` |
| **Insurance** | `insurance.type`, `insurance.hasCoverage` |
| **Benefits** | `benefits.receivingBuergergeld`, `benefits.receivingAlg1`, `benefits.receivingWohngeld`, `benefits.daysInGermany` |
| **Extensions** | `extensions[moduleId]` — namespace-isolated JSON |

---

## Runtime Behavior

### InMemoryProfileStore

- Profiles stored in `Map<string, ProfileRecord>`
- Revisions stored in `Map<string, ProfileRevision[]>` (append-only)
- Session binding via `Map<string, string>` (sessionId → profileId)
- **Optimistic concurrency:** `update()` requires matching `expectedRevision`; throws `ProfileRevisionConflictError` (API returns **409**)
- `clear()` helper for test isolation

### ProfileEngine.resolveForModule(moduleId, profile)

Returns a **ProfileSlice** containing:

1. All core profile domains (language, location, household, employment, etc.)
2. **Only** `extensions[moduleId]` — other modules' extensions are excluded

Migration stub normalizes `schemaVersion` to `1.0.0` on read.

### ContextBuilder.buildAppContext()

Hydrates `AppContext` from profile + optional request overrides:

| AppContext field | Source |
|----------------|--------|
| `userProfile.language` | `preferredLanguage` (override or profile) |
| `userProfile.income` | `employment.grossMonthlyIncome` |
| `userProfile.householdSize` | `household.size` |
| `userProfile.residencyStatus` | `residency.status` |
| `location` | `city`, `bundesland` formatted string |
| `systemState.insurance` | `insurance.*` |
| `systemState.benefits` | `benefits.*` |
| `profileSlice` | `resolveForModule()` output |
| `dataProvenance` | Per-field source annotations |

Works without profile (falls back to request overrides only).

### InputMerger — strict precedence

For each configured module input field:

```
1. request input (body.input)
2. request overrides (body.context.inputOverrides)
3. profile values
4. module defaults
```

**Configured modules (Phase 0):**

| Module | Mapped fields |
|--------|---------------|
| `financial-reality` | `grossIncome`, `taxClass`, `churchTax`, `householdSize`, `monthlyRent`, `employmentStatus`, `maritalStatus` |
| `healthcare-navigation` | `city`, `hasInsurance`, `insuranceType` |

Explicit request input always wins over profile (verified in API integration test: profile €2,500 → override €3,000).

### Module execute flow (updated)

```
POST /api/modules/:id/execute
  │
  ├─ Resolve profile via X-Session-Id → ProfileEngine.getProfileBySession()
  ├─ ContextBuilder.buildAppContext({ sessionId, profile, requestOverrides, moduleId })
  ├─ mergeModuleInput(moduleId, { requestInput, requestOverrides, profile })
  ├─ Attach input provenance to context.dataProvenance
  └─ globalRegistry.execute(id, mergedInput, context)
```

Module registry interface **unchanged**: `execute(input, context: AppContext)`.

---

## Verified Vertical Slice (API Integration Test)

The following flow is automated in `apps/api/src/profile.integration.test.ts`:

| Step | Action | Expected |
|------|--------|----------|
| 1 | `POST /api/sessions` | `sessionId` returned |
| 2 | `POST /api/profile` with `X-Session-Id` | Profile created, revision **1** |
| 3 | `PATCH /api/profile` with `If-Match: 1` | Employment/housing updated, revision **2** |
| 4 | `GET /api/profile/revisions` | ≥ 2 revisions listed |
| 5 | `POST /api/modules/financial-reality/execute` with empty `input` | `income.gross === 2500` from profile |
| 6 | Same execute with `input: { grossIncome: 3000 }` | `income.gross === 3000` (override wins) |

---

## Architecture Diagram (as built)

```
┌──────────────┐     X-Session-Id      ┌─────────────────────────────────┐
│  API Client  │ ────────────────────► │  apps/api                        │
└──────────────┘                       │  routes/profile.ts               │
                                       │  build-app.ts (module execute)   │
                                       └───────────────┬─────────────────┘
                                                       │
                       ┌───────────────────────────────┼───────────────────────────────┐
                       ▼                               ▼                               ▼
              ┌────────────────┐              ┌─────────────────┐              ┌─────────────────┐
              │ @arrival-atlas/    │              │ @arrival-atlas/     │              │ @arrival-atlas/     │
              │ profile        │─────────────►│ core            │◄─────────────│ modules         │
              │ ProfileEngine  │  hydrate     │ AppContext      │   execute    │ (unchanged IF)  │
              │ ContextBuilder │              │ ModuleRegistry  │              │                 │
              │ InputMerger    │              └─────────────────┘              └─────────────────┘
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │ InMemoryProfile│
              │ Store (Map)    │
              └────────────────┘
```

---

## Skipped Items (Per Phase 0 Constraints)

| Item | Design phase | Reason deferred |
|------|--------------|-----------------|
| PostgreSQL / `PostgresProfileStore` | Phase 2 | Explicit constraint |
| Authentication / user accounts | Phase 3 | Explicit constraint |
| Onboarding UI / settings pages | Phase 1+ | Explicit constraint |
| `completenessScore` on API responses | Phase 1 | Not required for runtime slice |
| `GET /api/profile/schema` | Phase 1 | Not required for runtime slice |
| GDPR export / delete / consents | Phase 2–3 | No persistence yet |
| Profile Field Registry | Phase 1+ | Extensions work; registry not wired |
| Web client profile sync | Phase 1 | UI out of scope |
| Input merge for all 5 modules | Phase 4 | Only financial + healthcare configured |
| Financial v2 adapter reads `location.bundesland` from profile | Phase 1 | Adapter still defaults `BE`; profile field exists but not consumed by engine yet |
| Encrypted sensitive fields | Phase 2 | In-memory only |
| Session persistence to PostgreSQL | Phase 2 | Core session still in-memory Map |

---

## Known Limitations

1. **Data loss on API restart** — profiles and session bindings live in process memory only.
2. **Single API instance** — no shared store across replicas.
3. **No profile without session binding** — `GET/PATCH /api/profile` require `X-Session-Id`; unbound profiles can be created but not retrieved via session endpoints.
4. **Legacy web unchanged** — UI still sends `{ userProfile: { language } }` per request; does not call profile API yet.
5. **Financial module does not read `profileSlice` directly** — benefits come from merged **input**, not from module code changes. Context shims supply `systemState` for rules evaluation.
6. **Migration stub** — no real schema transform chain; only version normalization.

---

## File Inventory

### New files

```
packages/profile/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── adapters/in-memory-store.ts
    ├── engine/
    │   ├── profile-engine.ts
    │   ├── context-builder.ts
    │   ├── input-merger.ts
    │   ├── profile-engine.test.ts
    │   └── input-merger.test.ts
    ├── errors/profile-revision-conflict.ts
    ├── migrations/index.ts
    ├── ports/profile-store.ts
    ├── profile.integration.test.ts
    ├── types/
    │   ├── profile-document.ts
    │   ├── profile-record.ts
    │   └── profile-slice.ts
    └── utils/merge-profile.ts

apps/api/src/
├── build-app.ts
├── profile-runtime.ts
├── profile.integration.test.ts
└── routes/profile.ts
```

### Modified files

```
packages/core/src/types/index.ts          — extended AppContextSchema
apps/api/src/index.ts                     — delegates to buildApp()
apps/api/package.json                     — @arrival-atlas/profile dependency + vitest
package.json                              — build/test includes profile workspace
```

---

## Exit Criteria vs Design Phase 0

| Design exit criterion | Status |
|-----------------------|--------|
| Create `@arrival-atlas/profile` package | ✅ Done |
| Types, Zod schemas, migrations skeleton | ✅ Done |
| `ContextBuilder` hydrates `AppContext` | ✅ Done |
| Expand session context with profile link | ✅ Partial — `profileId` set on bind via `updateSessionContext` |
| Web sync language to profile | ❌ Deferred (no UI) |
| Financial module reads bundesland from profile | ❌ Deferred — merge/context ready; adapter not updated |

**Phase 0 scope exceeded in one area:** REST profile API and module input merge were design Phase 1 items but were included in this slice to deliver a testable end-to-end path.

---

## Recommended Next Steps (Phase 1)

1. **Wire web client** — call `POST/PATCH /api/profile` from `AppProvider`; pre-fill financial form from profile.
2. **Update financial v2 legacy adapter** — read `context.profileSlice.location.bundesland` instead of hard-coded `BE`.
3. **Add `completenessScore`** — drive progressive onboarding when UI is built.
4. **Extend InputMerger** — life-event, grocery-optimization, system-translation as needed.
5. **Expose `GET /api/profile/schema`** — JSON Schema for dynamic forms.

## Recommended Next Steps (Phase 2)

1. **`PostgresProfileStore`** — implement storage port against DDL in design doc.
2. **Persist sessions** — survive API restarts.
3. **Encrypt sensitive columns** — income, rent at rest.
4. **GDPR endpoints** — export, delete, consent records.

---

## Commands

```bash
npm install
npm run build          # includes @arrival-atlas/profile
npm run test           # 41 tests (profile + shared-services + modules + api)

# Manual profile flow (API on :3001)
curl -X POST http://localhost:3001/api/sessions -H 'Content-Type: application/json' -d '{}'
curl -X POST http://localhost:3001/api/profile -H 'X-Session-Id: <id>' -H 'Content-Type: application/json' -d '{"preferredLanguage":"de"}'
curl -X PATCH http://localhost:3001/api/profile -H 'X-Session-Id: <id>' -H 'If-Match: 1' -H 'Content-Type: application/json' -d '{"employment":{"grossMonthlyIncome":2500,"taxClass":1,"status":"employed"}}'
curl -X POST http://localhost:3001/api/modules/financial-reality/execute -H 'X-Session-Id: <id>' -H 'Content-Type: application/json' -d '{"input":{}}'
```

---

*This report documents Phase 0 implementation status. For full architecture and future phases, see `docs/identity/user-profile-engine-design.md`.*
