---
id: user-profile-engine-runtime-unification-report
title: User Profile Engine Runtime Unification Report
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: identity
status: archived
maturity: stable
owner: system
tags:
  - profile-engine
  - execution-context
created: 2026-06-01
updated: 2026-06-19
related:
---

# User Profile Engine — Runtime Unification Report

**Date:** June 2026  
**Package:** `@arrival-atlas/profile@0.1.0`  
**Follows:** `docs/archive/user-profile-engine/phase0-report.md`  
**Design reference:** `docs/identity/user-profile-engine-design.md`  
**Status:** Complete — single resolution pipeline enforced

---

## Executive Summary

Phase 0 introduced profile resolution across three separate entry points:

- `ProfileEngine.resolveForModule()` — module slice
- `InputMerger.mergeModuleInput()` — input precedence
- `ContextBuilder.buildAppContext()` — AppContext hydration

The API orchestrated these independently in `build-app.ts`, creating **distributed ownership** of field resolution, precedence rules, and provenance. This refactor introduces one canonical function — **`resolveExecutionContext()`** — as the only supported path from API to module execution.

**45 automated tests pass** (13 profile + 25 shared-services + 6 modules + 1 API integration). Behavior is preserved: input overrides win, profile fallback works, session binding and revision logic unchanged.

---

## Problem Statement

| Risk without unification | Impact at Phase 2+ |
|--------------------------|-------------------|
| Duplicate precedence rules in API and package | Postgres hydration bugs |
| Split provenance (context vs input) | Unexplainable module outputs |
| Multiple call paths to merge/slice | Regression during UI/persistence work |
| No single debug trace | Impossible to audit user decisions |

---

## Solution

### Canonical entry point

**File:** `packages/profile/src/engine/resolve-execution-context.ts`

```typescript
resolveExecutionContext(profileEngine, {
  sessionId,
  moduleId,
  requestInput,
  requestContext,
  inputOverrides,
}) → { context, mergedInput, profile }
```

### Pipeline (fixed order)

```
1. Load profile     → ProfileEngine.getProfileBySession(sessionId)
2. Merge input      → mergeModuleInput() [internal]
3. Build context    → buildAppContext() [internal]
4. Unify provenance → context.dataProvenance = context + input sources
5. Return           → { context, mergedInput, profile }
```

### Module execution flow (only allowed path)

```
POST /api/modules/:id/execute
        │
        ▼
resolveExecutionContext(profileEngine, params)
        │
        ├── mergedInput ──► ModuleRegistry.execute(id, mergedInput, context)
        └── context     ──►
```

No other code path may call `mergeModuleInput` or `buildAppContext` for module execution.

---

## Refactor Details

### New / changed files

| File | Change |
|------|--------|
| `engine/resolve-execution-context.ts` | **Added** — canonical pipeline |
| `engine/resolve-execution-context.test.ts` | **Added** — 4 integration tests |
| `engine/context-builder.ts` | `ContextBuilder` class → internal `buildAppContext()` function |
| `engine/input-merger.ts` | Marked `@internal`; no longer exported from package index |
| `engine/profile-engine.ts` | `resolveForModule()` marked `@internal` |
| `index.ts` | Exports `resolveExecutionContext`; removes `ContextBuilder`, `mergeModuleInput` |
| `apps/api/src/build-app.ts` | Execute handler delegates solely to `resolveExecutionContext` |
| `apps/api/src/profile-runtime.ts` | Removed `contextBuilder` singleton |
| `profile.integration.test.ts` | Uses `resolveExecutionContext` |

### Public API surface (after refactor)

| Export | Purpose |
|--------|---------|
| `resolveExecutionContext` | **Only** runtime resolution entry point |
| `ProfileEngine` | CRUD, session bind, revisions (not input merge) |
| `InMemoryProfileStore` | Phase 0 storage |
| Types, errors, migrations | Unchanged |

### Internal helpers (not exported)

| Helper | Responsibility |
|--------|----------------|
| `buildAppContext()` | AppContext + legacy shims + context provenance |
| `mergeModuleInput()` | Input precedence (input → override → profile → default) |
| `ProfileEngine.resolveForModule()` | Module-scoped profile slice |

---

## Precedence Rules (unchanged)

For each configured module input field:

| Priority | Source |
|----------|--------|
| 1 | `requestInput` (body.input) |
| 2 | `inputOverrides` (body.input.inputOverrides or body.context.inputOverrides) |
| 3 | Profile document |
| 4 | Module defaults |

Context fields (`userProfile`, `location`, `systemState`) follow override → profile in `buildAppContext`, with provenance recorded separately from input field provenance. Both are merged into `context.dataProvenance` by `resolveExecutionContext`.

---

## Verification

### New tests — `resolve-execution-context.test.ts`

| Test | Asserts |
|------|---------|
| Profile fallback | `mergedInput.grossIncome === 2500` from profile; context slice populated |
| Input override | `requestInput.grossIncome: 3200` wins; provenance `input` |
| Request overrides | `inputOverrides.monthlyRent` between input and profile |
| No profile | Defaults used; `profile === null` |

### Regression coverage

| Suite | Tests | Status |
|-------|------:|--------|
| `@arrival-atlas/profile` | 13 | ✅ |
| `@arrival-atlas/shared-services` | 25 | ✅ |
| `@arrival-atlas/modules` | 6 | ✅ |
| `@arrival-atlas/api` integration | 1 | ✅ |
| **Total** | **45** | ✅ |

API integration test confirms end-to-end: session → profile → PATCH revision → execute with empty input (profile) → execute with override (input wins).

---

## Architecture (after)

```
┌─────────────────────────────────────────────────────────────┐
│                     apps/api/build-app.ts                  │
│  POST /api/modules/:id/execute                             │
│       │                                                      │
│       └── resolveExecutionContext()  ◄── ONLY ENTRY POINT   │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │  resolve-execution-context   │
              │  ┌─────────────────────────┐ │
              │  │ getProfileBySession     │ │
              │  │ mergeModuleInput        │ │ internal
              │  │ buildAppContext         │ │ internal
              │  │ resolveForModule        │ │ internal
              │  └─────────────────────────┘ │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │  ModuleRegistry.execute()    │
              └─────────────────────────────┘
```

---

## Constraints preserved

| Constraint | Status |
|------------|--------|
| `AppContextSchema` unchanged | ✅ |
| `ModuleRegistry.execute(input, context)` unchanged | ✅ |
| Session binding unchanged | ✅ |
| Revision / optimistic concurrency unchanged | ✅ |
| No PostgreSQL / auth / UI changes | ✅ |

---

## Exit criteria

| Criterion | Met |
|-----------|-----|
| Single authoritative `resolveExecutionContext()` | ✅ |
| ContextBuilder not used externally for merge | ✅ |
| InputMerger not exported / not called from API | ✅ |
| ProfileEngine does not merge input | ✅ |
| All existing tests green | ✅ |
| New integration test for pipeline | ✅ |

---

## Recommended next steps (Phase 1)

1. **Web client** — single profile PATCH on form save; module pages send only overrides in `input`.
2. **Financial v2 adapter** — read `context.profileSlice.location.bundesland` (pipeline already provides slice).
3. **Phase 2 Postgres** — implement `ProfileStore` port; **`resolveExecutionContext` remains unchanged** — only `getProfileBySession` backend swaps.
4. **Observability** — optional debug mode logging full `ResolveExecutionContextResult` (redacted) for support.

---

## Commands

```bash
npm run build
npm run test

# Profile pipeline tests only
npm run test -w @arrival-atlas/profile
```

---

*This unification is a prerequisite for Phase 1 (UI) and Phase 2 (PostgreSQL). All future module execution must go through `resolveExecutionContext()`.*
