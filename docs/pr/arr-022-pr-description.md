# arr-022 — Production readiness documentation (Life Event + Economic Reality)

**Branch:** `arr-022`  
**Tracks:** ARR-022 production readiness · UX-first implementation contract · Controlled beta gate  
**Base:** `develop` (post arr-020)

Establishes a **frozen implementation contract** for shipping **Life Event** and **Economic Reality** to controlled beta. This branch is **documentation only** — no runtime redesign, no new modules, no EP pipeline changes. Runtime behavior remains governed by [implemented-baseline.md](../production-readiness/implemented-baseline.md) (BL-* from arr-020).

**Product verdict:** Documentation is **implementation-contract v1 frozen**. Execution mode begins via [implementation-first-pass-plan.md](../production-readiness/implementation-first-pass-plan.md). Code implementation is the next track.

---

# Part 1 — Production readiness system (frozen contract)

Six-file UX-first documentation set under `docs/production-readiness/`.

## Summary

```text
product.md          → two features + lightweight roadmap + blockers
ux.md               → interface behavior + traceability (UX → engineering → verify)
engineering.md      → flat P0/P1/P2 tasks
verification.md     → Beta / Production gates + checks + commands
index.md            → ID traceability matrix
implemented-baseline.md → BL-* frozen (arr-020, do not edit)
```

## What was done

| File | Role |
|------|------|
| [product.md](../production-readiness/product.md) | Product definition, two features, Phase 0–5 roadmap light, beta blockers, freeze declaration |
| [ux.md](../production-readiness/ux.md) | User-facing behavior: flows, four states, failure tables, LE + ER lifecycle |
| [engineering.md](../production-readiness/engineering.md) | Actionable tasks with UX ID references |
| [verification.md](../production-readiness/verification.md) | Beta Ready Gate, Production Ready Gate, E2E, retry checks |
| [index.md](../production-readiness/index.md) | UX / REL / E2E / GJ ID → file mapping |
| [implemented-baseline.md](../production-readiness/implemented-baseline.md) | BL-01–BL-17 immutable runtime invariants |

### Two features (scope freeze)

| Feature | User outcome | Surfaces |
|---------|--------------|----------|
| **Life Event** | Understand situation → get action plan → act | Home summary · Profile · next-steps · LE module |
| **Economic Reality** | Understand economic situation → get guidance → act | Home ER card · ER module |

Profile is part of Life Event — not a third feature.

---

# Part 2 — UX-first stabilization (v1 → v5)

Iterative reduction from over-abstracted spec systems to a minimal, behavior-driven contract.

## Evolution closed

| Iteration | Outcome |
|-----------|---------|
| v1–v4 (removed) | DSL contracts, roadmap-first layers, execution graphs — rejected |
| v5 UX-first | 6 files, behavior-only UX, flat engineering tasks |
| v5 patch | ER module parity, unified retry, verification alignment |
| v6 audit | Identified gate atomicity gaps — addressed in execution plan, not spec redesign |
| Freeze | Implementation Contract v1 — static; bugfix-level edits only |

## UX contract rules

- Every surface: **loading · content · empty · error** — never blank silence
- UX described as **User sees / User does / System response / Failure behavior**
- Traceability: **UX issue → engineering task → verification check**
- No DSL · no state machines · no contract assertion layers in spec files

---

# Part 3 — Life Event coverage

End-to-end flow documented and task-mapped.

## Flow

```text
onboarding → profile → plan (Home next-steps) → guidance (LE module) → action → retry → failure handling
```

## Key UX zones

| Zone | UX source | Engineering IDs |
|------|-----------|-----------------|
| Onboarding / first visit | ux.md § Onboarding | UX-D1, REL-05 |
| Profile mirror + edit | ux.md § Profile understanding | UX-P1–P3, UX-T2, REL-R5 |
| Plan generation (Home) | ux.md § Plan generation | UX-H1, UX-L1, UX-RETRY |
| Guidance (LE module) | ux.md § Guidance display | UX-LE1–3, UX-T3, UX-T5 |
| Profile → plan refresh | ux.md Flow profile change | REL-R1, REL-12 |

## Verification

- Life Event checks in [verification.md](../production-readiness/verification.md) § Life Event
- Retry: RETRY-H01–04, RETRY-LE01–04
- E2E: E2E-01, E2E-03, E2E-05, E2E-07, E2E-08

---

# Part 4 — Economic Reality coverage (v5 parity patch)

ER brought to lifecycle parity with Life Event.

## Flow

```text
Home ER card → open module → loading → content → empty → error → retry → refresh → explanation → action
```

## What was added (v5)

| Gap closed | Addition |
|------------|----------|
| ER module flow missing | ux.md Flow — Economic Reality module (6 steps) |
| Retry not executable | ux.md § Retry behavior + UX-RETRY engineering task |
| ER engineering thin | UX-ER1 (error), UX-ER2 (skeleton), UX-ER3 (empty), UX-E2 (distinct states) |
| ER not independently gateable | verification.md ER-M01–06 + Beta Gate #8 |
| LE action feedback unassigned | UX-T5 covers LE + ER actions |

## Verification

- Economic Reality checks in [verification.md](../production-readiness/verification.md) § Economic Reality
- Module checks: ER-M01–06 (ASSERT/CHECK)
- Retry: RETRY-ER01–05

---

# Part 5 — Unified retry system

Single retry behavior across all error surfaces.

| Rule | Behavior |
|------|----------|
| User sees | Error panel + labeled **Retry** button |
| On tap | Error → loading skeleton → refetch |
| On success | Skeleton → content |
| On failure | Skeleton → error panel, Retry re-enabled |
| Surfaces | Home next-steps · Home ER card · LE module · ER module · session bootstrap |

**Engineering:** UX-RETRY (P0)  
**Verify:** RETRY-* checks in verification.md

---

# Part 6 — Freeze + execution transition

Documentation frozen as **Implementation Contract v1**. Execution guide added (not part of frozen spec).

| Document | Status |
|----------|--------|
| product.md · ux.md · engineering.md · verification.md · index.md · implemented-baseline.md | **Frozen** — bugfix-level edits only |
| [implementation-first-pass-plan.md](../production-readiness/implementation-first-pass-plan.md) | **Active** — developer first pass |

> Documentation is now a static implementation contract. All future work is implementation-driven, not architecture-driven.

### First pass plan structure

1. Runtime stability check (hydration, boot, Home plan/ER errors)
2. Life Event implementation
3. Economic Reality implementation
4. Unified retry system
5. Verification alignment (no expansion)
6. UX polish (last)

---

## Architecture compliance

| Constraint | Status |
|------------|--------|
| Two features only (LE + ER) | ✓ |
| No new modules | ✓ |
| No BL-* runtime redesign | ✓ |
| No DSL / state machines / contract layers in docs | ✓ |
| No React Query / Zustand / EP pipeline changes in this branch | ✓ (docs only) |
| implemented-baseline.md unchanged | ✓ |
| 6-file frozen contract + 1 execution plan | ✓ |

## Deferred (explicitly out of scope)

| Item | Notes |
|------|-------|
| Code implementation | Next track — see implementation-first-pass-plan.md |
| OAuth / accounts | Out of beta scope |
| New modules | Feature freeze |
| LE-8 UI wiring | Out of ARR-022 scope |
| Production database | Out of beta scope |
| Benefits simulator web UI | Out of scope |
| Verification gate atomicity refactor | Compound rows acceptable for first pass; split only if blocking sign-off |
| REL-R3 / REL-R4 / GJ-03 | INFRA — cache optimization, secondary journey |

---

## Test plan

### Documentation validation (this PR)

- [ ] All 7 files present under `docs/production-readiness/`
- [ ] product.md freeze banner references Implementation Contract v1
- [ ] ux.md covers LE + ER full lifecycle + retry section
- [ ] engineering.md P0 tasks map to ux.md traceability rows
- [ ] verification.md Beta Ready Gate has 10 pass/fail rows
- [ ] index.md maps UX-ER1/2/3, UX-RETRY, RETRY-*, ER-M* IDs
- [ ] implemented-baseline.md unmodified from arr-020 baseline

### Implementation gate (next PR — not this branch)

When code work begins, run against frozen verification.md:

```bash
# Regression (BL-16)
cd apps/web && npx vitest run --project regression

# Runtime (BL-17)
cd apps/web && npx vitest run src/lib/runtime

# Workspace
npm run test

# Browser (when Playwright scenarios exist)
cd apps/web && npx playwright test
```

### Smoke (after implementation)

- [ ] Cold boot — no silent Home; plan and ER card show loading, content, empty, or error
- [ ] Plan API fail — Home next-steps show error + Retry (not blank)
- [ ] ER API fail — ER card and ER module show error + Retry (card never vanishes)
- [ ] Profile edit → Home + LE + ER update without reload (GJ-04 / E2E-03)
- [ ] Retry on all surfaces — loading → success OR error (RETRY-* checks)
- [ ] Beta Ready Gate — all 10 pass

---

## Related docs

- [product.md](../production-readiness/product.md) — product + roadmap light
- [ux.md](../production-readiness/ux.md) — interface behavior
- [engineering.md](../production-readiness/engineering.md) — implementation tasks
- [verification.md](../production-readiness/verification.md) — release gates
- [index.md](../production-readiness/index.md) — ID traceability
- [implementation-first-pass-plan.md](../production-readiness/implementation-first-pass-plan.md) — execution first pass
- [implemented-baseline.md](../production-readiness/implemented-baseline.md) — BL-* frozen
- [runtime-consistency-contract-v1.md](../runtime/runtime-consistency-contract-v1.md) — arr-020 runtime authority
- [arr-020-pr-description.md](./arr-020-pr-description.md) — prior runtime consistency track
- [arr-019-pr-description.md](./arr-019-pr-description.md) — prior Economic Reality v1 closure
