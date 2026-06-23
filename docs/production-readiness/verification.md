# Verification

> **Role: RELEASE & QA LAYER (locked)**  
> Gates · checks · commands only.

**P0** = release blocker · **P1** = required · **P2** = recommended

---

## Beta Ready Gate

| # | Check | Pass? |
|---|-------|-------|
| 1 | No blank Home on plan or ER failure | ☐ |
| 2 | Crash → recovery UI | ☐ |
| 3 | Session bootstrap error visible | ☐ |
| 4 | Profile edit → plan + ER update without reload | ☐ |
| 5 | E2E-01 first-time user green | ☐ |
| 6 | E2E-03 profile update green | ☐ |
| 7 | E2E-07 plan API 500 → error, not infinite load | ☐ |
| 8 | ER module API failure shows error UI | ☐ |
| 9 | `npm run test` green + BL-16 24/24 | ☐ |
| 10 | GJ-01 keyboard-only + beta guide + access-controlled URL | ☐ |

---

## Production Ready Gate

| # | Check | Pass? |
|---|-------|-------|
| 1 | All Beta Ready Gate items pass | ☐ |
| 2 | 48h staging soak pass | ☐ |
| 3 | 3 consecutive CI green on release branch | ☐ |
| 4 | Rollback runbook published | ☐ |
| 5 | E2E-08 + E2E-09 green | ☐ |
| 6 | Mobile 375px modules usable | ☐ |
| 7 | Skip link, focus trap, document lang | ☐ |
| 8 | Sign-offs: Engineering, Product, QA, Design | ☐ |
| 9 | No open P0 UX issues | ☐ |
| 10 | Client error reporter on staging | ☐ |

---

## Commands

| Layer | Command |
|-------|---------|
| Regression BL-16 | `cd apps/web && npx vitest run --project regression` |
| Runtime BL-17 | `cd apps/web && npx vitest run src/lib/runtime` |
| Workspace | `npm run test` |
| API E2E | `npm run test -w @arrival-atlas/api -- tests/e2e/economic-reality` |
| Module E2E | `npm run test -w @arrival-atlas/modules -- tests/e2e/economic-reality` |
| Browser | `cd apps/web && npx playwright test` |

---

## Life Event

| P | Check | How | ☐ |
|---|-------|-----|---|
| P0 | Home next-steps never blank on plan failure | Block plan API | |
| P0 | Profile load failure visible | Induce user-context 500 | |
| P0 | Profile edit updates plan without reload | Edit fact → check Home + LE | |
| P0 | E2E-01 first-time user green | Playwright | |
| P0 | E2E-07 plan API 500 → error, not infinite load | Block plan API | |
| P1 | Empty states show next-step CTA | Profile walkthrough | |
| P1 | Edit: loading gate + save confirmation ≤5s | Manual | |
| P1 | Completeness visible on Home + Profile | Visual | |
| P1 | LE plan error uses error severity | Induce LE plan failure | |
| P1 | LE action gives visible feedback | Execute LE action | |
| P1 | GJ-02 return visit preserves situation | TEST-01 + E2E-02 | |
| P2 | LE confidence label visible | Visual | |

---

## Economic Reality

| P | Check | How | ☐ |
|---|-------|-----|---|
| P0 | ER card never silent on failure | Block ER data on Home | |
| P0 | ER module loads successfully | Open ER module with valid data | |
| P0 | ER module API failure shows error UI | Block ER module API | |
| P0 | E2E-03 profile edit updates guidance | Playwright | |
| P1 | ER module loading state visible during fetch | Open ER module; observe skeleton | |
| P1 | ER empty state visible when no data | Profile with missing economic fields | |
| P1 | Loading / empty / failed visually distinct | Visual | |
| P1 | ER action gives visible feedback | Execute ER action | |
| P1 | Guidance updates after profile edit | Manual after edit | |
| P2 | ER rationale line on Home | Visual | |

---

## Economic Reality — module checks

| ID | ASSERT | CHECK | ☐ |
|----|--------|-------|---|
| ER-M01 | ER module route open | Module body shows skeleton or content — never blank white | |
| ER-M02 | ER module API returns 500 | Error panel visible inside module with Retry button | |
| ER-M03 | ER module API returns empty payload | Empty state message + CTA visible — no fake guidance | |
| ER-M04 | User taps Retry after module error | Loading skeleton appears in module body | |
| ER-M05 | Retry succeeds | Module shows economic guidance/content | |
| ER-M06 | Retry fails again | Error panel returns with Retry re-enabled | |

---

## Retry checks

| ID | Surface | ASSERT | CHECK | ☐ |
|----|---------|--------|-------|---|
| RETRY-H01 | Home next-steps | Plan API blocked | Retry button visible in next-steps area | |
| RETRY-H02 | Home next-steps | User taps Retry | Loading skeleton replaces error panel | |
| RETRY-H03 | Home next-steps | Retry succeeds | Plan content visible | |
| RETRY-H04 | Home next-steps | Retry fails | Error panel returns with Retry enabled | |
| RETRY-LE01 | Life Event module | Plan API blocked in module | Retry button visible in module | |
| RETRY-LE02 | Life Event module | User taps Retry | Loading skeleton in module | |
| RETRY-LE03 | Life Event module | Retry succeeds | Plan/guidance content visible | |
| RETRY-LE04 | Life Event module | Retry fails | Error panel returns with Retry enabled | |
| RETRY-ER01 | Home ER card | ER API blocked | Retry button visible inside card | |
| RETRY-ER02 | Home ER card | User taps Retry | Loading skeleton inside card | |
| RETRY-ER03 | Economic Reality module | User taps Retry after error | Loading skeleton in module body | |
| RETRY-ER04 | Economic Reality module | Retry succeeds | Economic content visible | |
| RETRY-ER05 | Economic Reality module | Retry fails | Error panel with Retry re-enabled | |

---

## E2E scenarios

| ID | Pass when | ☐ |
|----|-----------|---|
| E2E-01 | First visit: no hydration errors; plan after intake | |
| E2E-02 | Reload preserves situation; locale stable | |
| E2E-03 | Profile edit updates Home + LE without reload | |
| E2E-04 | Guidance updates or explicit no-change after edit | |
| E2E-05 | LE action changes state or shows blocked reason | |
| E2E-06 | Invalid session/locale keys recover | |
| E2E-07 | Plan API 500 → error, not infinite load | |
| E2E-08 | No plan fetch before profile ready | |
| E2E-09 | Usable at 375px width | |

---

## System

| P | Check | ☐ |
|---|-------|---|
| P0 | GJ-01 completable without reload | |
| P0 | Errors distinct from hints | |
| P0 | No hydration warnings cold load | |
| P0 | No boot plan 400s | |
| P0 | Session bootstrap retry works | |
| P1 | Structured loading Home + Profile | |
| P1 | API down → error within 10s | |
| P1 | Degraded sync visible | |

---

## Sign-off

| Role | Name | Date | Beta ☐ | Production ☐ |
|------|------|------|--------|--------------|
| Engineering | | | | |
| Product | | | | |
| QA | | | | |
| Design | | | | |
