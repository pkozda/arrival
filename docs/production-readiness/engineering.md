# Engineering

> **Role: IMPLEMENTATION LAYER (locked)**  
> Flat tasks · P0/P1/P2. UX reference required per task.

Tasks to match [ux.md](./ux.md). BL-* frozen: [implemented-baseline.md](./implemented-baseline.md).

**Effort:** S ≤ 1d · M 2–3d · L 4–6d

---

## P0 — Release blockers

| Task | Feature | UX problem | ID | Effort |
|------|---------|------------|-----|--------|
| App-shell crash recovery UI | Both | White screen on crash | REL-01 | M |
| Session bootstrap error + retry | Both | App looks dead on open | REL-02 | S |
| Shared error component (danger + SR) | Both | Errors look like hints | UX-ENG-01, UX-R1, UX-R2 | S |
| Home plan failure visible + retry | Life Event | Blank next-steps | UX-H1, UX-RETRY-H | S |
| Home ER failure visible + retry | Economic Reality | ER card vanishes on API fail **when rendered** | UX-H2, UX-RETRY-ER-H | S |
| Profile load error in shell | Life Event | Wrong situation, no error | REL-05 | S |
| LE module loading → plan content on success | Life Event | Module blank / no plan on success | UX-LE3, LE-M01 | S |
| LE module plan error panel + retry | Life Event | Muted hint on module API fail | UX-LE1, UX-RETRY-LE | S |
| ER module loading → content on success | Economic Reality | Module blank on successful fetch | UX-ER2, ER-M01 | S |
| ER module error panel + retry | Economic Reality | Module blank on API fail | UX-ER1, UX-RETRY-ER | M |
| Playwright: first-time journey | Life Event | Core flow untested | E2E-01 | L |

### P0 — Retry surface bindings (UX-RETRY)

Each row is one concrete fetch + UI surface. Implement all five before P0 sign-off.

| ID | Surface | Component | Fetch trigger | UI during retry | On success | On failure |
|----|---------|-----------|---------------|-----------------|------------|------------|
| UX-RETRY-H | Home next-steps | `NextStepsCard` / plan preview area | `GET /life-event/plan` (or runtime plan domain) fails | Error panel → skeleton in next-steps area; Retry disabled | Skeleton → prioritized plan list | Skeleton → error panel + Retry enabled |
| UX-RETRY-ER-H | Home ER card | Home ER guidance card | ER Home snippet fetch fails | Error inside card → skeleton inside card | Skeleton → guidance text/actions | Skeleton → error inside card + Retry enabled |
| UX-RETRY-LE | Life Event module | `/modules/life-event` plan body | LE module plan fetch fails | Error panel → skeleton in module body | Skeleton → plan steps/actions | Skeleton → error panel + Retry enabled |
| UX-RETRY-ER | Economic Reality module | `/modules/economic-reality` body | ER module data fetch fails | Error panel → skeleton in module body | Skeleton → guidance/content | Skeleton → error panel + Retry enabled |
| UX-RETRY-BOOT | Session bootstrap | App shell / bootstrap gate | Session create fails | Error screen + Retry within 10s | App loads Home | Error screen + Retry enabled |

**Verify:** RETRY-H01–04 · RETRY-LE01–04 · RETRY-ER01–05 · BOOT-C01 · manual session bootstrap retry

**Home composition (PH-5):** `shouldHideHomeSecondarySections` in `apps/web/src/lib/presentation/home-p0.ts` — LE dominates Home; ER card hidden when LE plan loading, plan card visible, or cold-start. See [runtime-truth.md](./runtime-truth.md).

**ER cache (REL-R3):** Session-scoped `deterministicHash` cache in `apps/web/src/lib/economic-reality/cache.ts`. Cache persistence across reload is valid; error panel when `state.error` set; Retry always refetches.

---

## P1 — Life Event

| Task | UX problem | ID | Effort |
|------|------------|-----|--------|
| Shared loading component | Text-only "Loading…" | UX-L1, UX-ENG-02 | M |
| Loading on Home + Profile | Inconsistent loading | UX-H3, UX-ENG-03 | M |
| Profile completeness in mirror | User can't see gaps | UX-P1, UX-D2 | S |
| Profile edit loading gate | Empty flash before form | UX-P2 | S |
| Domain snapshot error | Infinite loading on domain | UX-P3 | S |
| Empty-state next-step copy | Blank cards, no CTA | UX-D1, UX-E1 | S |
| Post-edit confirmation toast | Silent save | UX-T2 | S |
| Profile editor resync on revision | Stale form after sync | REL-R5 | M |
| Snapshot refresh after profile mutation | Plan doesn't update after edit | REL-R1 | M |
| Playwright: profile → plan update | Stale plan/guidance undetected | E2E-03 | L |
| LE disabled-action SR reasons | Blocked actions unexplained | UX-LE2 | S |
| LE action feedback (toast/inline) | Silent action result | UX-T5 | S |
| Home suggestion plan binding | Stale suggestions | REL-R2 | L |
| LE confidence label | User unsure about plan quality | UX-T3 | S |
| GJ-02 UI fixture | Return visit not testable | TEST-01 | M |
| Fetch timeout + error within 10s | Infinite spinner | REL-11 | M |
| Degraded sync banner | Partial sync invisible | REL-12 | S |
| New session notice after reset | User confused after session reset | REL-B4 | S |

---

## P1 — Economic Reality

| Task | UX problem | ID | Effort |
|------|------------|-----|--------|
| ER module empty state | No data shown as success | UX-ER3 | S |
| ER distinct state styling | Loading/empty/error look the same | UX-E2, UX-C1 | M |
| ER action feedback (toast/inline) | Silent action result | UX-T5 | S |
| ER rationale line on Home | User doesn't know why guidance shown | UX-T4 | S |
| Session-scoped plan cache | Unnecessary refetch flicker; valid cached presentation on reload | REL-R3 | S |
| Action context lifecycle | Action state lost | REL-R4 | S |

---

## P1 — Shared reliability

| Task | UX problem | ID | Effort |
|------|------------|-----|--------|
| Storage key validation recovery | App broken on bad storage | REL-10 | M |
| Catalog failure warning | Module list failure blocks app | REL-B2 | S |
| Bootstrap sync timeout (30s degraded) | App hangs on slow sync | REL-B3 | M |
| CI regression gate (BL-16) | Runtime regressions ship | TEST-03 | S |
| Integration: mutation → sync → commit | Edit doesn't propagate | TEST-04 | M |
| Playwright bootstrap guard | Plan loads before profile ready | E2E-08 | M |
| Playwright locale persistence | Language resets on reload | E2E-02 | S |
| Unit: crash, storage, draft resync | Edge cases untested | TEST-09 | M |

---

## P1 — Beta quality

| Task | UX problem | ID | Effort |
|------|------------|-----|--------|
| Beta banner + user guide | User unaware of beta limits | UX-H5 | S |
| Mobile single-column layout | Broken on phone | UX-M1, UX-ENG-04 | M |
| Nav focus trap + skip link | Keyboard users blocked | UX-N1, UX-N2 | M |
| Dynamic document lang | SR/lang mismatch | UX-N3 | S |
| Beta guide + IAM limitations | Trust / access gaps | DOC-01 | S |
| Complete verification P0 | Ship without checklist | V-RELEASE | M |

---

## P2 — Polish

| Task | UX problem | ID | Effort |
|------|------------|-----|--------|
| Home primary block hierarchy | Home feels cluttered | UX-H4 | M |
| Card visual token alignment | Inconsistent cards Home ↔ modules | UX-C3, UX-ENG-07 | M |
| Localize profile mirror | DE/RU users see English | UX-P4, UX-ENG-05 | M |
| Localize onboarding checklist | DE/RU users see English | UX-H6, UX-ENG-06 | S |
| Localize navigation labels | Nav not localized | UX-N4 | S |
| Focus-visible, reduced motion | A11y gaps | UX-M2 | S |
| axe CI on primary routes | A11y regressions | A11Y-08 | M |
| Contrast audit artifact | Contrast failures | A11Y-09 | M |
| Playwright mobile 375px | Mobile untested | E2E-09 | M |
| Playwright storage recovery | Storage edge cases | E2E-06 | M |
| Profile-engine journey depth | Deep journey gaps | TEST-10 | L |
| Staging 48h soak | Stability unknown | — | M |
| Rollback runbook | No recovery plan | DOC-02 | S |
| Client error reporter (staging) | Errors invisible in staging | REL-14 | M |

---

## Excluded

OAuth/accounts · new modules · LE-8 UI · production DB · benefits simulator web
