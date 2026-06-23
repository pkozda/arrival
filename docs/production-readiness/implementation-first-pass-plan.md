# ARR-022 — Implementation First Pass Plan

**Status:** Active execution plan  
**Contract:** Frozen — [product.md](./product.md) · [ux.md](./ux.md) · [engineering.md](./engineering.md) · [verification.md](./verification.md) · [index.md](./index.md) · [implemented-baseline.md](./implemented-baseline.md)

> Build directly from frozen docs. No redesign. No new architecture.

---

## 1. Executive goal

| Goal | Definition |
|------|------------|
| **Build Life Event (LE)** | User completes onboarding → profile → plan → guidance → action with no silent states |
| **Build Economic Reality (ER)** | User sees Home ER card → ER module lifecycle → explanation → action with LE-equivalent state handling |
| **Production-ready UX** | Every surface shows loading, content, empty, or error — never blank silence |

**Ship signal:** [verification.md § Beta Ready Gate](./verification.md#beta-ready-gate) — all pass.

---

## 2. System reality summary (current state)

| Area | Status | Notes |
|------|--------|-------|
| **Life Event** | Implementable end-to-end | Flows, failures, retry, and P0/P1 tasks defined in ux.md + engineering.md |
| **Economic Reality** | Implementable with minor gaps | Module flow added in v5; deeper module tasks thinner than LE but sufficient for first pass |
| **Retry / failure / loading** | Defined and usable | ux.md § Retry behavior + UX-RETRY-H/ER-H/LE/ER/BOOT + RETRY-* / LE-M* / ER-M* checks |
| **Verification** | Usable, imperfect atomicity | Some compound gate rows; detailed checks in feature sections suffice for QA |
| **Traceability** | Sufficient for implementation | index.md maps UX → engineering → verify; INFRA IDs are non-blocking |
| **Runtime baseline** | Frozen | BL-* in implemented-baseline.md — surface failures only, no graph redesign |

---

## 3. Implementation strategy (first pass only)

**Principle:** Implement features exactly as documented. Reference ux.md for behavior, engineering.md for tasks, verification.md for done-ness.

### 3.0 — Read order (before coding)

1. [ux.md](./ux.md) — behavior for the surface you are building
2. [engineering.md](./engineering.md) — P0 tasks first, then P1 for that feature
3. [verification.md](./verification.md) — run checks as you complete each surface
4. [implemented-baseline.md](./implemented-baseline.md) — do not violate BL-*

---

### 3.1 — Runtime stability check

**Goal:** App boots reliably; no silent failures on Home.

| Build | UX source | Engineering IDs | Verify |
|-------|-----------|-----------------|--------|
| Hydration stable, no boot white screen | ux.md App-wide | REL-01, REL-02 | Crash → recovery; session bootstrap error |
| Plan fetch error visible on Home | ux.md Plan generation | UX-H1, UX-RETRY-H | Home next-steps never blank; RETRY-H01–04 |
| ER card deterministic render (never vanishes) | ux.md Data loading | UX-H2, UX-RETRY-ER-H | ER card never silent; RETRY-ER01–02 |
| Shared error + loading components | ux.md Four states | UX-ENG-01, UX-L1 | Errors distinct from hints |

**Exit:** User opens app and always sees content, loading, or error on Home — including plan and ER card areas.

---

### 3.2 — Life Event implementation

**Flow (strict order):**

```text
onboarding → profile → plan → guidance → action → retry → failure handling
```

| Step | Surface | Build from | Engineering IDs |
|------|---------|------------|-------------------|
| 1 | Onboarding / first visit | ux.md § Onboarding | UX-D1, REL-05 |
| 2 | Profile mirror + edit | ux.md § Profile understanding | UX-P1, UX-P2, UX-P3, UX-T2, REL-R5 |
| 3 | Home next-steps (plan) | ux.md § Plan generation | UX-H1, UX-RETRY-H |
| 4 | LE module plan load + guidance | ux.md § Flow LE module | UX-LE3, UX-LE1, UX-RETRY-LE |
| 5 | LE module polish (P1) | ux.md § Guidance display | UX-LE2, UX-T3, UX-T5 |
| 6 | Profile edit → plan refresh (P1) | ux.md Flow profile change | REL-R1, REL-12, E2E-03 |

**Must include:**
- Plan loading skeletons (not text-only "Loading…")
- Retry: error → skeleton → content OR error (ux.md § Retry)
- Action feedback on LE actions (UX-T5)
- Profile save → Home + LE update without reload (REL-R1, P1)

**Exit criteria:**
- [ ] No silent states on LE surfaces
- [ ] Full observable lifecycle: loading / content / empty / error
- [ ] Retry functional on Home next-steps and LE module (RETRY-H*, RETRY-LE*)
- [ ] E2E-01 green
- [ ] LE-M01–05 pass (module loading → content → error → retry)
- [ ] E2E-03 green (P1 — profile edit updates plan; requires REL-R1)

---

### 3.3 — Economic Reality implementation

**Flow (strict order):**

```text
Home ER card → open module → loading → content → empty → error → retry → refresh → explanation → action
```

| Step | Surface | Build from | Engineering IDs |
|------|---------|------------|-------------------|
| 1 | Home ER card | ux.md § Data loading | UX-H2, UX-RETRY-ER-H |
| 2 | ER module loading → content (P0) | ux.md Flow ER module step 2–3 | UX-ER2, ER-M01 |
| 3 | Module error + retry (P0) | ux.md Flow ER module step 5 | UX-ER1, UX-RETRY-ER |
| 4 | Module empty state (P1) | ux.md Flow ER module step 4 | UX-ER3, ER-M03 |
| 5 | Module polish (P1) | ux.md § Explanation layer | UX-T4, UX-E2, UX-T5 |
| 6 | Refresh after profile edit (P1) | ux.md § Refresh | REL-R1, E2E-03 |

**Must include:**
- ER module lifecycle parity with LE (skeleton, error panel, empty, retry)
- Explanation layer bound to current profile state
- Action feedback — no silent ER actions (UX-T5)
- Distinct loading / empty / failed visuals (UX-E2)

**Exit criteria:**
- [ ] ER module P0 cycle complete (ER-M01, ER-M02, ER-M04–06 pass; ER-M03 P1)
- [ ] Retry parity with LE on card + module (RETRY-ER*)
- [ ] Guidance updates after profile edit without reload
- [ ] Beta Gate #8 pass (ER module API failure shows error UI)

---

### 3.4 — Unified retry system

**One behavior everywhere** — implement once, apply to all surfaces.

| Rule | Behavior |
|------|----------|
| Retry visible | Error panel always includes labeled **Retry** button |
| On tap | Error panel → loading skeleton in same area → refetch |
| On success | Skeleton → content |
| On failure | Skeleton → error panel with Retry re-enabled |
| Surfaces | Home next-steps (UX-RETRY-H) · Home ER card (UX-RETRY-ER-H) · LE module (UX-RETRY-LE) · ER module (UX-RETRY-ER) · session bootstrap (UX-RETRY-BOOT) |

**Engineering:** One shared retry component; wire per surface per engineering.md § P0 Retry surface bindings  
**Verify:** RETRY-H01–04 · RETRY-LE01–04 · RETRY-ER01–05 · session bootstrap retry

**Exit:** Retry never silent; button disabled only while fetch in flight.

---

### 3.5 — Verification alignment (no expansion)

**Only align existing checks with built behavior. Do not design new verification.**

| Action | Scope |
|--------|-------|
| Run Beta Ready Gate after P0 surfaces ship | verification.md § Beta Ready Gate |
| Map compound gate rows to sub-checks mentally | #9 = test green AND BL-16; #10 = keyboard AND docs |
| Split subjective rows only if they block sign-off | e.g. document what "usable at 375px" means in test notes |
| Do NOT add new E2E scenarios or gate tiers | Use E2E-01–09 as-is |

**Exit:** QA can execute verification.md checklists against running app.

---

### 3.6 — UX polish (last step only)

**Cosmetic only. No new logic.**

| Polish | IDs | When |
|--------|-----|------|
| Loading state consistency | UX-L1, UX-H3, UX-LE3, UX-ER2 | After P0/P1 features work |
| Error UI consistency | UX-ENG-01, UX-C3 | After retry system wired |
| Mobile 375px | UX-M1, E2E-09 | Before production gate |
| Text clarity / localization | UX-P4, UX-H6, UX-N4 | P2 — after beta path green |

**Exit:** Production Ready Gate pass (verification.md § Production Ready Gate).

---

## 4. Feature completion definition

### Life Event is complete when

- [ ] Profile → plan → guidance → action works end-to-end without reload
- [ ] Retry exists on Home next-steps and LE module
- [ ] No silent failure states (every area: loading, content, empty, or error)
- [ ] UX-T5 action feedback on LE actions
- [ ] E2E-01, E2E-03, E2E-05, E2E-07 green

### Economic Reality is complete when

- [ ] Module lifecycle mirrors LE state system (loading / content / empty / error)
- [ ] Explanation layer renders deterministically from profile state
- [ ] Retry behavior consistent with LE on Home card and module
- [ ] UX-T5 action feedback on ER actions
- [ ] ER-M01, ER-M02, ER-M04–06 and RETRY-ER* checks pass (ER-M03 P1)

---

## 5. Success criteria

| Criterion | Met when |
|-----------|----------|
| Developer implements without questions | All behavior found in ux.md; all tasks in engineering.md |
| QA executes without interpretation | verification.md checks + ASSERT/CHECK rows are runnable |
| No undocumented UX state | Every state is loading, content, empty, or error per ux.md § Four states |
| Beta shippable | Beta Ready Gate — all 10 pass + sign-offs |

---

## 6. Task priority (developer quick reference)

**Week 1 — P0 (both features stable):**

1. REL-01, REL-02, UX-RETRY-BOOT — crash + bootstrap
2. UX-ENG-01 — shared error component
3. UX-H1, UX-H2, UX-RETRY-H, UX-RETRY-ER-H — Home plan + ER card errors + retry
4. UX-LE3, UX-LE1, UX-RETRY-LE — LE module success + error + retry
5. UX-ER2, UX-ER1, UX-RETRY-ER — ER module success + error + retry
6. REL-05 — profile load error
7. E2E-01 — first-time journey

**Week 2 — P1 Life Event + ER polish:**

8. UX-L1, UX-H3 — loading consistency
9. UX-P1–P3, UX-D1, UX-T2, REL-R5 — profile flow
10. UX-LE2, UX-T3, UX-T5 — LE module polish
11. UX-ER3, UX-E2, UX-T4, UX-T5 — ER module empty + styling + explanation
12. REL-R1, REL-12, E2E-03 — profile → plan/guidance refresh
13. Run Beta Ready Gate

**Week 4+ — P2 polish + production gate**

---

## 7. Hard constraints (this plan)

- Do NOT change frozen documentation architecture
- Do NOT introduce DSL, state machines, or new verification tiers
- Do NOT redesign BL-* runtime (implemented-baseline.md)
- Do NOT add features beyond Life Event + Economic Reality
- Clarify in code comments by referencing UX/REL IDs only — not new spec layers

---

## 8. Transition statement

**ARR-022 is now in execution mode.**

Spec evolution is complete. Implementation contract v1 is frozen. This plan is the single execution guide for the first production pass.
