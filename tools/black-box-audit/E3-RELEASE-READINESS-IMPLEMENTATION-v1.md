---
id: e3-release-readiness-implementation-v1
title: Arrival Atlas — Release Readiness Implementation v1 (E3)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e3
  - release-readiness
created: 2026-09-08
updated: 2026-09-08
---

# E3 Release Readiness Implementation v1

## Scope

P0/P1 fixes only during the release-readiness audit. No new product capabilities.

## Fixes

### P1 — Language clobber after remount / claim→reload

**Problem:** `AppProvider` treated `userContext === null && uiSnapshot === null` as ready when loading flags were already false. `derivedLanguage` then defaulted to `en` and `writeStoredDisplayLanguage('en')` overwrote an explicit UA (or other) choice. Session/profile still had `ua`; navigating home later could appear fine while Discovery reload stayed English.

**Fix:** Treat missing `userContext` **or** `uiSnapshot` (or either still loading) as bootstrapping — do not apply/overwrite derived language until both consistency payloads are present.

**File:** `apps/web/src/components/AppProvider.tsx`

### P1 — Flaky Discovery API tests (fixed SQLite dirs)

**Problem:** PD-006/007/010/011 used fixed `.arrival-atlas-state-pd0xx-test` directories with fixed profile IDs. Stale WAL caused `409` on create and cascading `404` on isolation asserts.

**Fix:** `rmSync(stateDir, { recursive: true, force: true })` in each `beforeEach` before setting `ARRIVAL_ATLAS_STATE_DIR`.

**Files:**
- `apps/api/src/discovery-persistence.pd006.api.test.ts`
- `apps/api/src/discovery-execution.pd007.api.test.ts`
- `apps/api/src/discovery-automation.pd010.api.test.ts`
- `apps/api/src/discovery-account-claim.pd011.api.test.ts`

### Doc drift (non-blocking)

Updated stale comment on `resolveDiscoveryUserId` to mention PD-011 claim/heal migration.

**File:** `apps/api/src/discovery/discovery-user-runtime.ts`

## Probe

`tools/black-box-audit/probes/probe-e3-release-readiness.mjs` — shorter integrated smoke than E1; polls language after reload.

## Tests re-run

- API PD-002/003/006/007/010/011 + account-claim (34) — pass; PD-006 re-run twice — pass
- Core localization + discovery lifecycle/ownership/automation + modules planner/healthcare — pass
- Web discovery UI, employment, registration UX, trust/opportunity, document-lang — pass
- E3 browser smoke — PASS WITH LIMITATIONS (0 P1 after fix)

## Non-fixes (intentionally deferred)

P2/P3 items listed in the audit doc (ER EN spill, toast remount, Employment HUD, ops tick, etc.).
