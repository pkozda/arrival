---
id: economic-reality-action-planner-implementation-v1
title: Arrival Atlas — Economic Reality Action Planner Implementation v1 (PD-002)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-002
  - economic-reality
  - action-planner
created: 2026-09-08
updated: 2026-09-08
---

# Economic Reality Action Planner Implementation v1

## Implemented

* **Current-state presentation:** compact Action Planner panel on Economic Reality (`ActionPlannerPanel`) showing known facts, missing reasons, status, and next CTA.
* **Selected action:** registration-gate vertical slice — `Update housing and registration details` → after address present → `Confirm Anmeldung completion` (not the same housing CTA).
* **Action execution:** existing `update_profile` navigation + `fact.correct` mutation path (no parallel executor).
* **Satisfaction/recalculation:** added `registrable_address`; registration node templates filtered by satisfaction snapshot; plan rebuild via existing PROFILE_MUTATED → ECONOMIC refetch.
* **Visible confirmation:** planner shows recalculation message when `deterministicHash` changes after return.
* **Persistence:** completion/next action derived from persisted profile + rebuilt plan (survives reload).

## State flow

```text
CURRENT (domain satisfaction + plan)
→ ACTIONABLE (READY housing or confirm)
→ EXECUTE (profile mutation)
→ COMPLETE (housing prerequisite / later registration_confirmed)
→ RECALCULATE (plan hash changes)
→ NEXT (confirm Anmeldung, then primary plan)
```

Planner statuses used: `NOT_READY` | `READY` | `COMPLETE` (`IN_PROGRESS` unused — no persistent execution state for profile updates).

## Domain semantics

| Condition | Authoritative source |
|---|---|
| Address present | `housing.city` → satisfaction `registrable_address` |
| Registration COMPLETE | `hasRegistrableAddress` + `municipalRegistrationConfirmed === true` → `registration_confirmed` (PD-001; not heuristic `isMunicipallyRegistered`) |
| Housing CTA eligible | registration nodes + `!registrable_address` |
| Confirm CTA eligible | registration nodes + address present + `!registration_confirmed` |

## Tests

| Test | Result |
|---|---|
| A — prerequisite missing (housing READY, no confirm) | PASS |
| B — address present → confirm READY, no housing | PASS |
| C — registration_confirmed after address + confirm | PASS |
| D — recalculation replaces housing with confirm | PASS |
| E — missing income/employment = UNKNOWN | PASS |
| F — address alone ≠ registration; confirm required | PASS |
| API vertical slice (mutation → plan rebuild) | PASS |
| ep11 i18n / action-set / execution-state updates | PASS |

## Browser validation

Probe: `tools/black-box-audit/probes/probe-pd002-action-planner-local.mjs`  
Artifacts: `tools/black-box-audit/artifacts/pd002-action-planner/`

Observations:

1. ER Action Planner visible with status `READY`, CTA **Update housing and registration details**.
2. Housing save (`#profile-field-city` = Bremen) succeeded.
3. Return to ER: CTA **Confirm Anmeldung completion**; plan `housing:false`, `confirm:true`; hash changed (`6c4274…` → `a10417…`).
4. Reload: confirm CTA persists (`housing:false`, `confirm:true`).
5. Recalculation banner may not show on full navigation remount (hash baseline resets) — limitation; domain recalculation still proven by hash + action set change.

**Browser verdict:** PASS (ER-LOOP-001 resolved in live UI).

## Limitations

* Action Planner focuses on registration-gate first; richer multi-action prioritization deferred.
* UA ER copy still mostly English base with localized planner/confirm strings.
* Client view-model is a browser-safe mirror of the modules builder (avoids importing Node `crypto` barrel into Next client).
* Recalculation toast only when hash changes within the same mounted panel instance.
* Simulators / forecasts intentionally not implemented.

## Remaining PD-002

* Richer Action Planner across all ER graphs
* Multiple prioritized next actions with ordering UX
* Benefit/application guided flows (non-simulator)
* Simulators (separate capability)
* Forecasting / deeper financial modeling

## Safety check

* No simulator implemented
* No duplicate Registration completion logic (reuses PD-001 satisfaction)
* No fake UI-only completion
* No HTTP-200-only success semantics for domain completion
* No E2E suite edits
* No unrelated galaxy redesign
