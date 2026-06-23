---
id: implemented-baseline-arr-020
title: Implemented Baseline — ARR-020 (Immutable Assumptions)
project: Arrival Atlas
system: Arrival Atlas
type: specification
domain: platform
status: frozen
maturity: frozen
owner: product-engineering
tags:
  - arr-020
  - runtime
  - baseline
  - immutable
created: 2026-06-22
updated: 2026-06-22
related:
  - runtime-consistency-contract-v1
  - arr-020-pr-description
---

# Implemented Baseline — ARR-020 (Immutable Assumptions)

**Status:** Frozen — **not re-designed in ARR-022**  
**Authority:** [runtime-consistency-contract-v1.md](../runtime/runtime-consistency-contract-v1.md), [arr-020-pr-description.md](../pr/arr-020-pr-description.md)

ARR-022 **extends** this baseline (failure surfacing, tests, polish). It does **not** replace or revisit these invariants.

---

## Runtime sync

| ID | Invariant |
|----|-----------|
| BL-01 | Domain sync graph: PROFILE → LIFE_EVENT → ECONOMIC → SNAPSHOT with defined edge semantics |
| BL-02 | Event bus drives sync: PROFILE_MUTATED, ECONOMIC_ACTION_EXECUTED, SESSION_SYNC_REQUESTED |
| BL-03 | Sync plan is deterministic for identical event sequences |
| BL-04 | Bootstrap must complete before any sync execution |
| BL-05 | Sync requires valid session; no sync without session |
| BL-06 | LIFE_EVENT and ECONOMIC domains skip when profile not ready (`profile_not_ready` is non-degraded) |
| BL-07 | Failed dependency blocks downstream; cascade edges allow continuation per graph rules |
| BL-08 | Atomic domain commit via state transaction; degraded policy withholds domain payloads |

## Hydration & locale

| ID | Invariant |
|----|-----------|
| BL-09 | SSR and client first paint produce identical locale-sensitive shell text |
| BL-10 | Client-only storage (locale preference) is not read during initial render |
| BL-11 | Display language resolves: explicit profile preference → session language → default |

## Reactivity & data freshness

| ID | Invariant |
|----|-----------|
| BL-12 | Economic plan reconcile always returns a new object graph on explicit fetch (hash may be unchanged) |
| BL-13 | Action feedback routes through sync bus ingest, not hash-gated refetch alone |
| BL-14 | Profile mutation triggers graph-driven sync (not isolated per-domain refresh) |
| BL-15 | ER action types branch: navigate vs execute per action semantics |

## Regression protection (existing)

| ID | Suite | Count |
|----|-------|-------|
| BL-16 | Web regression project (`apps/web/src/__tests__/`) | 24 tests |
| BL-17 | Runtime unit tests (`apps/web/src/lib/runtime/`) | 19 tests |

**CI command:** `npx vitest run --project regression`

---

## Explicitly out of ARR-022 redesign scope

- Graph topology and edge semantics (BL-01, BL-07)
- Event bus event types (BL-02)
- Bootstrap-before-sync gate (BL-04, BL-05, BL-06)
- Hydration locale strategy (BL-09, BL-10)
- Reconcile reference-safety model (BL-12)
- Unified sync provider architecture (BL-14)

ARR-022 work on these items is limited to **tests, monitoring, and surfacing failures** — not architectural change.
