# P1: Profile Mutation System — event-sourced UserContext, web migration, contract lock

Implements **Phase P1 (Profile System v1)**: migration from a document-centric profile to an **event-sourced mutation architecture** with a single authoritative read model, `UserContextV1`.

## Architecture after this PR

```text
Mutation Engine (C2/C3)
        │
        ▼
UserContextV1  ← GET /api/user-context (AUTHORITATIVE)
        │
        ├── Home / Modules / Profile mirror (web)
        │
UiSnapshot (execution-only: FTU, session, executions, actionCards)
        └── userContext = derived transport copy (NOT for business logic)
```

No UI/UX visual changes — architectural migration and contract hardening only.

## What was done

### C2 — Mutation Engine (`packages/profile-engine`)

- New package `@arrival-atlas/profile-engine`: reducer, normalize, conflict resolution, module→mutation bridge
- `reduce(MutationEvent[])` → `ProfileState` / `UserContextV1`
- Golden scenario tests A–E + invariant tests (**15 tests**)

### C3 — API + persistence + snapshot bridge (`apps/api`)

- **`POST /api/mutations`** — sole write path for profile mutations
- **`GET /api/user-context`** — authoritative read model
- `SessionMutationEventLog` → `SystemState.profileMutationEvents` (file-persisted)
- `applyModuleExecute()` moved to mutation path (removed `applyProfileActivation`)
- Snapshot bridge: `buildUiSnapshot()` projects `userContext` as a transport copy only
- API contract headers:
  - `/api/user-context` → `x-user-context-authority: authoritative`
  - `/api/ui-snapshot` → `x-snapshot-layer: execution-ui-transport`
  - `?snapshotVersion=legacy` → `x-snapshot-contract: legacy-compatibility-only`

### Product Contract (`packages/product-contract`)

- Types: `MutationRequest`, `MutationEvent`, `UserContextV1`, `UserProfileViewV1`
- `UiSnapshot.profile` **removed** from the modern contract
- `SnapshotUserContextTransport` — explicit non-authoritative transport annotation
- `UiSnapshotProfile` marked `@deprecated` (legacy snapshot only)

### P1.4–P1.5 — Web migration (`apps/web`)

- `apps/web/src/lib/mutations/` — `fetchUserContext()`, `submitMutation()`, request builders, prefill adapter
- `AppProvider` hydrates `userContext` separately from `uiSnapshot`
- All situation reads via **`selectUserContextProfile(userContext)`**
- Module execute → `refreshSessionState()` (context + snapshot)
- Profile mirror UI: `/profile`, domain detail, Home situation cards
- App language: `selectAppDisplayLanguage()` — profile from userContext, session from `snapshot.session`

### P1 Cleanup — Snapshot unification

- Single read model: profile authority lives only in `UserContextV1`
- `UiSnapshot` = execution + UI state ONLY
- Legacy `?snapshotVersion=legacy` isolated (compat-only; web does not use it)

### P1 Final Hardening — Contract lock

- Boundary tests forbid:
  - `snapshot.userContext` / `uiSnapshot.userContext` in business logic
  - `snapshot.profile` / merge chains between snapshot ↔ userContext
  - `snapshotVersion=legacy` in web
  - direct `userContext.profile` access outside `selectors.ts`
- Documentation: UX Contract v2 §14; roadmap P1 marked **COMPLETE**

## Key files

| Area | Files |
|------|-------|
| API routes | `routes/profile-mutations.ts`, `routes/api-contract-headers.ts`, `routes/ui-snapshot.ts` |
| API state | `apply-profile-mutation.ts`, `session-mutation-event-log.ts`, `profile-mutation-state.ts`, `snapshot-projection-engine.ts` |
| Engine | `packages/profile-engine/src/**` |
| Contracts | `packages/product-contract/src/profile/**`, `ui/UiSnapshot.ts`, `ui/snapshot-user-context-transport.ts` |
| Web client | `lib/mutations/**`, `lib/user-context/**`, `components/AppProvider.tsx` |
| Web UI | `components/profile/**`, `components/home/*Situation*`, `app/profile/**` |
| Tests | `mutations.api.test.ts`, `contract-lock.test.ts`, `mutation-boundary.test.ts`, `api-contract-headers.test.ts` |
| Docs | `docs/identity/profile-mutation-model-v1.md`, `docs/ux/ux-contract-v2.md`, `docs/identity/profile-system-v1-roadmap.md` |

## API changes

| Endpoint | Role |
|----------|------|
| `POST /api/mutations` | Write — profile mutations (revision guards, idempotency) |
| `GET /api/user-context` | **Authoritative** read model |
| `GET /api/ui-snapshot` | Execution/UI transport (FTU, session, executions, actionCards) |
| `GET /api/ui-snapshot?snapshotVersion=legacy` | Deprecated compat only |
| `POST/PATCH /api/profile` | Legacy compat — **not used by web** |

## Hard rules (enforced by tests)

- ❌ UI must not read `snapshot.userContext` for domain logic
- ❌ No fallback/merge between snapshot and userContext
- ❌ Web must not request legacy snapshot
- ✅ Sole profile access path: `selectUserContextProfile(userContext)`

## Test plan

- [x] `@arrival-atlas/profile-engine` — 15/15
- [x] `@arrival-atlas/product-contract` — 68/68
- [x] `@arrival-atlas/api` — 190/190
- [x] `@arrival-atlas/web` — 48/48
- [ ] Smoke: Home renders situation summary from userContext
- [ ] Smoke: Profile mirror reflects domains after module execute
- [ ] Smoke: Language/theme change via mutation (not legacy PATCH profile)
- [ ] Smoke: Module prefill from userContext; execute refreshes context + snapshot
- [ ] Verify `/api/user-context` vs `/api/ui-snapshot` authority headers in network tab

## Out of scope (next tracks)

- UX-P3: Profile edit UI (corrections UI)
- P2: schema-aware form merge, onboarding mutations, completeness scoring
- Removal of legacy `POST/PATCH /api/profile` (remains API compat)
- Visual/UI redesign

## Migration notes

- Web consumers should move to `fetchUserContext()` + `selectUserContextProfile()`
- `UiSnapshot.profile` no longer exists in the modern contract — use `GET /api/user-context`
- Embedded `UiSnapshot.userContext` is transport convenience only, not a source of truth

## Definition of Done

P1 is locked when:

> There is no runtime path where `UiSnapshot` can be interpreted as authoritative user situation data.

**Status: ✅ achieved** — boundary tests, API headers, and contract annotations in place.
