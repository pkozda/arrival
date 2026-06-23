# ARR-023 — Execution Lock

**Status:** FINAL · IMMUTABLE  
**Effective:** Pre-implementation freeze  
**Authority:** [ux.md](./ux.md) · [engineering.md](./engineering.md) · [verification.md](./verification.md) · [index.md](./index.md)

---

## 1. SYSTEM SCOPE FREEZE

Only **two features** exist in ARR-023 P0 scope:

1. **Life Event (LE)**
2. **Economic Reality (ER)**

No other modules, flows, journeys, or systems are part of P0.

Excluded from P0 execution: OAuth/accounts · new modules · LE-8 UI · production DB · benefits simulator web · any feature not named above.

Shared shell behavior (crash recovery, session bootstrap, shared error component) exists only to support LE and ER surfaces. It is not a third feature.

---

## 2. FEATURE EXECUTION CONTRACT (NON-NEGOTIABLE)

### Life Event (LE)

| Contract term | Binding |
|---------------|---------|
| **Entry** | Home → next-steps plan area → `/modules/life-event` |
| **Required states** | `loading` · `content` · `error` · `retry` |
| **Success condition** | Plan steps/actions OR guidance text is visible in the target surface (Home next-steps or LE module body). Module body is never blank white after a successful fetch. |
| **Failure condition** | Error panel with labeled **Retry** button in the same surface area. Next-steps area on Home is never empty on plan failure. |
| **Module independence** | LE module success is validated by **LE-M01** and **UX-LE3**. E2E-01 validates first-visit Home flow only. LE module P0 sign-off does **not** depend on E2E-01 passing. |

**P0 state transitions (LE):**

| Surface | loading → | success → | failure → | retry cycle |
|---------|-----------|-----------|-----------|-------------|
| Home next-steps | skeleton | prioritized plan list | error panel + Retry | error → skeleton → content OR error (UX-RETRY-H) |
| LE module body | skeleton | plan steps/actions | error panel + Retry | error → skeleton → content OR error (UX-RETRY-LE) |

**P0 engineering IDs:** UX-H1 · UX-LE3 · UX-LE1 · UX-RETRY-H · UX-RETRY-LE · REL-05 · E2E-01 (Home first-visit only)

---

### Economic Reality (ER)

| Contract term | Binding |
|---------------|---------|
| **Entry** | Home ER card → `/modules/economic-reality` |
| **Required states** | `loading` · `content` · `error` · `retry` |
| **Success condition** | Economic explanation, guidance, or data is rendered in the target surface (Home ER card or ER module body). Module body is never blank white after a successful fetch. |
| **Failure condition** | Error message inside card OR error panel in module body with labeled **Retry**. ER card never vanishes on failure. |
| **Module independence** | ER module success is validated by **ER-M01** and **UX-ER2**. ER P0 does **not** depend on LE plan success, LE module open, or E2E-01. |

**P0 state transitions (ER):**

| Surface | loading → | success → | failure → | retry cycle |
|---------|-----------|-----------|-----------|-------------|
| Home ER card | skeleton inside card | guidance text/actions | error inside card + Retry | error → skeleton → content OR error (UX-RETRY-ER-H) |
| ER module body | skeleton | guidance/content | error panel + Retry | error → skeleton → content OR error (UX-RETRY-ER) |

**P0 engineering IDs:** UX-H2 · UX-ER2 · UX-ER1 · UX-RETRY-ER-H · UX-RETRY-ER

Empty-state handling (UX-ER3 / ER-M03) is **P1**. It is not required for P0 ER success validation.

---

## 3. RETRY SYSTEM FREEZE

Retry is a **fixed runtime contract**. Five surfaces. Five bindings. No generic retry abstraction.

| ID | Surface | Trigger (user action) | Loading state | Success state | Failure state |
|----|---------|----------------------|---------------|---------------|---------------|
| **UX-RETRY-H** | Home next-steps (`NextStepsCard` / plan preview) | User taps **Retry** after plan fetch error | Skeleton in next-steps area; Retry disabled | Skeleton → prioritized plan list | Skeleton → error panel; Retry re-enabled |
| **UX-RETRY-ER-H** | Home ER card | User taps **Retry** after ER snippet fetch error | Skeleton inside card; Retry disabled | Skeleton → guidance text/actions inside card | Skeleton → error inside card; Retry re-enabled |
| **UX-RETRY-LE** | LE module (`/modules/life-event` plan body) | User taps **Retry** after LE module plan fetch error | Skeleton in module body; Retry disabled | Skeleton → plan steps/actions | Skeleton → error panel; Retry re-enabled |
| **UX-RETRY-ER** | ER module (`/modules/economic-reality` body) | User taps **Retry** after ER module data fetch error | Skeleton in module body; Retry disabled | Skeleton → guidance/content | Skeleton → error panel; Retry re-enabled |
| **UX-RETRY-BOOT** | Session bootstrap (app shell) | User taps **Retry** after session create fails | Loading indicator; Retry disabled | Home loads | Error screen; Retry re-enabled (within 10s) |

**Hard rules:**

- Each surface wires retry to **one** fetch. No shared retry handler without per-surface UI binding.
- Retry button is disabled only while fetch is in flight.
- Retry never silent. No full-page reload unless user explicitly navigates away.
- Fetch failure is the **system** trigger. User tap on **Retry** is the **user** trigger that starts the loading → success/failure cycle.

---

## 4. VERIFICATION CONTRACT FREEZE

### Rules (P0)

1. Every P0 check is **atomic**: one ASSERT = one observable outcome = one check row.
2. **No compound gates** for P0 sign-off. Beta/Production gate rows are release milestones; P0 implementation is complete when all atomic P0 checks below pass.
3. **No subjective checks** for P0. Every check names an observable UI element or system response.
4. Every check maps to **engineering.md** task ID(s) and **ux.md** behavior.

### LE — independent P0 verification path

| ID | ASSERT (1 condition) | Observable CHECK |
|----|----------------------|------------------|
| — | Home plan API blocked | Next-steps area shows error + Retry (not blank) |
| LE-M01 | LE module open; plan fetch succeeds | Skeleton then plan steps/actions in module body |
| LE-M02 | LE module plan API returns 500 | Error panel + Retry in module body |
| LE-M03 | User taps Retry in LE module | Skeleton appears in module body |
| LE-M04 | LE module retry succeeds | Plan/guidance content visible |
| LE-M05 | LE module retry fails | Error panel + Retry re-enabled |
| RETRY-H01 | Home plan API blocked | Retry button in next-steps area |
| RETRY-H02 | User taps Home plan Retry | Skeleton replaces error panel |
| RETRY-H03 | Home plan retry succeeds | Plan content visible |
| RETRY-H04 | Home plan retry fails | Error panel + Retry enabled |
| RETRY-LE01 | LE module plan API blocked | Retry button in module |
| RETRY-LE02 | User taps LE module Retry | Skeleton in module |
| RETRY-LE03 | LE module retry succeeds | Plan/guidance content visible |
| RETRY-LE04 | LE module retry fails | Error panel + Retry enabled |
| — | Profile load API fails | Profile load error visible in shell |
| E2E-01 | First visit completes | No hydration errors; plan after intake on Home |
| E2E-07 | Plan API 500 on Home | Error shown; not infinite load |

### ER — independent P0 verification path

| ID | ASSERT (1 condition) | Observable CHECK |
|----|----------------------|------------------|
| — | Home ER API blocked | Error inside ER card (card visible) |
| ER-M01 | ER module open; data fetch succeeds | Skeleton then guidance/content in module body |
| ER-M02 | ER module API returns 500 | Error panel + Retry in module body |
| ER-M04 | User taps Retry in ER module | Skeleton in module body |
| ER-M05 | ER module retry succeeds | Economic content visible |
| ER-M06 | ER module retry fails | Error panel + Retry re-enabled |
| RETRY-ER01 | Home ER API blocked | Retry button inside card |
| RETRY-ER02 | User taps Home ER Retry | Skeleton inside card |
| RETRY-ER03 | User taps ER module Retry | Skeleton in module body |
| RETRY-ER04 | ER module retry succeeds | Economic content visible |
| RETRY-ER05 | ER module retry fails | Error panel + Retry enabled |

### System — P0 shared checks

| ASSERT (1 condition) | Observable CHECK |
|----------------------|------------------|
| App crashes | Recovery UI shown (not white screen) |
| Session create fails | Error screen + Retry within 10s |
| Error displayed | Error styling distinct from hint styling |
| Cold load | No hydration warnings |
| Boot | No plan 400s (BL-06) |

Retry is testable **per surface** via RETRY-H*, RETRY-LE*, RETRY-ER*, and bootstrap retry. No cross-surface retry test may substitute for a missing surface check.

---

## 5. TRACEABILITY LOCK

Every **P0-relevant ID** maps exactly once across the contract stack:

| ID | ux.md | engineering.md | verification.md |
|----|-------|----------------|-----------------|
| UX-H1 | ✓ | ✓ | Home next-steps never blank |
| UX-H2 | ✓ | ✓ | ER card never silent |
| UX-LE1 | ✓ | ✓ | LE-M02 |
| UX-LE3 | ✓ | ✓ | LE-M01 |
| UX-ER1 | ✓ | ✓ | ER-M02 |
| UX-ER2 | ✓ | ✓ | ER-M01 |
| UX-RETRY-H | ✓ | ✓ | RETRY-H01–04 |
| UX-RETRY-ER-H | ✓ | ✓ | RETRY-ER01–02 |
| UX-RETRY-LE | ✓ | ✓ | RETRY-LE01–04 |
| UX-RETRY-ER | ✓ | ✓ | RETRY-ER03–05 |
| UX-RETRY-BOOT | ✓ | REL-02 | Session bootstrap retry |
| UX-ENG-01 | ✓ | ✓ | Errors distinct from hints |
| UX-R1 | ✓ | UX-ENG-01 | Errors distinct from hints |
| UX-R2 | ✓ | UX-ENG-01 | Errors distinct from hints |
| REL-01 | ✓ | ✓ | Crash → recovery UI |
| REL-02 | ✓ | ✓ | Session bootstrap error visible |
| REL-05 | ✓ | ✓ | Profile load failure visible |
| E2E-01 | ✓ | ✓ | First-time user green |
| E2E-07 | ✓ | — | Plan API 500 → error |
| LE-M01–05 | ✓ | UX-LE3, UX-LE1, UX-RETRY-LE | LE module checks |
| ER-M01–02, ER-M04–06 | ✓ | UX-ER1, UX-ER2, UX-RETRY-ER | ER module checks |
| BL-06 | — | — | No boot plan 400s |
| BL-09 | — | — | No hydration warnings |

**Lock rules:**

- No P0 UX-* ID may exist without a row in **index.md** linking ux → engineering → verify.
- No orphan P0 ID. No P0 execution path may reference INFRA-only IDs (REL-R3, REL-R4, REL-B2, REL-B3, TEST-03–10, BL-* except BL-06 and BL-09 as regression guards).
- **UX-RETRY** (generic) is **void**. Use UX-RETRY-H, UX-RETRY-ER-H, UX-RETRY-LE, UX-RETRY-ER, UX-RETRY-BOOT only.
- Authoritative index: [index.md](./index.md).

---

## 6. IMMUTABILITY CLAUSE

This document is the **final canonical execution state** for ARR-023 P0.

**During implementation:**

- This contract is **immutable**.
- No edits to ux.md, engineering.md, verification.md, index.md, or this file may be made to "clarify," "improve," or "optimize" behavior mid-build.
- No new IDs, states, surfaces, or retry bindings may be introduced during coding.
- No scope expansion beyond Life Event and Economic Reality.

**Any change requires:**

1. Explicit re-audit (new ARR ticket)
2. Written approval before merge
3. Re-issue of Execution Lock with new effective date

Implementation proceeds only against this locked contract. Deviations are defects, not interpretations.
