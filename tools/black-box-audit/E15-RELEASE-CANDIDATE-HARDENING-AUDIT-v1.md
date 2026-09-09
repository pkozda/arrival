---
id: e15-release-candidate-hardening-audit-v1
title: Arrival Atlas — Release Candidate & Production Hardening Audit v1 (E15)
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e15
  - release-candidate
created: 2026-09-09
updated: 2026-09-09
---

# E15 — Release Candidate & Production Hardening Audit

## Verdict

**RELEASE CANDIDATE PASS WITH LIMITATIONS**

* P0 = 0  
* P1 = 0  
* Core newcomer journey is truthful, persistent, and recoverable under realistic interruption  
* Remaining issues are documented P2/P3 or intentional product limitations  

---

## 1. Release baseline

| Area | Current implementation | Existing coverage | Remaining risk |
| --- | --- | --- | --- |
| Web | Next.js `:3000` | E1–E14 probes, vitest | SSR lang flash (P2) |
| API | Fastify `:3001` | API PD/E suites | Auth secret default if env unset (ops) |
| Persistence | SQLite under `ARRIVAL_ATLAS_STATE_DIR` | PD-006–011 isolation | Single-instance API (ops) |
| Profile mutations | `fact.correct` / `fact.invalidate` + revision retry | E7/E11/E13/E14 | Pre-hydration gated (E14) |
| Discovery | Lifecycle + ownership `accountId ?? sessionId` | PD-007–011 | Live SUCCESS depth (env) |
| MBDE / Benefits | Awareness evaluators | E4–E8 | Shared LE keys (P2) |
| Life Events | Projection from profile | E12 | Presentation ≠ catalog (P2) |
| Localization | EN/DE/RU/UA | E2, E14 | Atlas Home EN under UA (P2) |
| Navigation | HUD + direct routes | E14 | Employment/Healthcare off HUD (P2) |
| Startup | `npm run dev` / Compose | E3, docs/deployment | Compose requires secrets |

Product contract remains:

`INTENT → WHY → STATE → NEXT → ACTION → CHANGE → CONFIRM → RECALCULATE → CONTINUE/RECOVER`

No global planner. Tax on ER. LE is projection-only.

---

## 2. Critical scenarios (probe evidence)

Probe: `tools/black-box-audit/probes/probe-e15-release-candidate-hardening.mjs`  
Artifacts: `tools/black-box-audit/artifacts/e15-release-candidate/`

| Scenario | Result |
| --- | --- |
| A Clean startup / no leak | PASS — fresh session `needs-address` / NOT_ADDED |
| B Language persistence | PASS — UA `stored=ua` / `lang=uk` across LE/ER/reload |
| C Hydration guard | PASS — `data-profile-ready`; save gated until ready |
| D Registration + reverse + reload | PASS — pending (prepare≠complete) → confirmed → pending |
| E Housing READY → INCOMPLETE + reload | PASS |
| F Wohngeld COMPLETED → READY_TO_ACT + reload | PASS |
| G Kindergeld COMPLETED → READY_TO_ACT + isolation | PASS |
| H Tax READY; churchTax UNKNOWN after income save | PASS |
| I Failed mutation (noop + forced 400) | PASS — authoritative city unchanged; retry works |
| J Reload mid-state | PASS |
| K Back/forward | PASS — ER state intact after back |
| L Employment → Discovery | PASS — no invented run intent |
| M LE projection | PASS — no banking→registration blocker |
| N A11y critical | PASS — labeled city; named save (UA «Зберегти») |

---

## 3. Findings

### Fixed during E15

None required (no P0/P1 found).

### Already fixed in E1–E14 (still holding)

| Fix | Origin |
| --- | --- |
| Language after claim/reload | E3 |
| UA≠RU inheritance | E2 |
| Registration auth confirmation | PD-001 / E12 |
| Banking never blocks Anmeldung | E12 |
| Editor clears → `fact.invalidate` | E13 |
| Invalidate null payload schema | E13 |
| churchTax tri-state / unknown | E11 |
| Profile hydration gate | E14 |
| Benefits/Housing/Tax reverse recalc | E13/E14 |

### New observations (not P0/P1)

| ID | Sev | Note |
| --- | --- | --- |
| E15-I-ALERT | P2 | Forced 400 kept state safe; `role="alert"` not always observed in probe timing — recoverable via stay-on-form / retry |
| SSR lang flash | P2 | Brief `en` before client sync; semantics unchanged after wait |

---

## 4. Fixes

No product code changes in E15.

---

## 5. Regression coverage matrix

| Category | Critical scenarios | Result |
| --- | --- | --- |
| Clean startup | Wipe storage; no stale COMPLETED | PASS |
| Language | UA first contact → nav → reload | PASS |
| Registration | Confirm + reverse + prepare≠complete | PASS |
| Housing | READY → clear rent → INCOMPLETE | PASS |
| Benefits | Wohngeld/Kindergeld complete + reverse | PASS |
| Healthcare | Prior PD-003 / E14 | DEFERRED (suite) |
| Employment | Dual-track honesty → Discovery | PASS |
| Discovery | Boundary only; live SUCCESS | LIMITATION |
| Tax | READY + churchTax unknown | PASS |
| Profile mutation | Hydration gate; reject; retry | PASS |
| Reversal | Reg/Housing/Benefits | PASS |
| Reload | Mid-journey reconstruct | PASS |
| Navigation | Back/forward | PASS |
| Accessibility | Labels + save name | PASS |
| Operational config | Compose secrets / defaults | DOCUMENTED |

Unit reuse: E13 state-reversal + E14 hydration tests re-run green during E15 prep.

---

## 6. Known P2/P3 limitations (do not expand)

* Employment / Healthcare not on HUD  
* Atlas Home EN under UA  
* boolean → unknown unsupported (explicit false)  
* Discovery live SUCCESS / account claim depth  
* Life Events shared-key abstractions  
* SSR language flash before client sync  
* Forced-reject alert timing (P2)  

---

## 7. Production configuration risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| `ARRIVAL_ATLAS_AUTH_SECRET` code default | **P1 if public host without env** | Compose **requires** secret; `docs/deployment.md` warns |
| `NEXT_PUBLIC_API_URL` → localhost default | **P1 if wrong prod build** | Compose sets empty (same-origin `/api`) |
| `isDevToolsEnabled()` true when `NODE_ENV≠production` | **P2/P1 ops** | Compose `ARRIVAL_ATLAS_DEV_TOOLS=false` |
| Ops token unset | Safe fail-closed | Tick unavailable |
| SQLite single writer | Ops P1 if scaled | Do not scale API replicas |
| CORS localhost default | P2 | Set `CORS_ORIGIN` / public origin in deploy |

No secrets exposed in this audit.

---

## 8. Explicit non-goals

* No new domains / Finance / banking / Steuer-ID  
* No global planner  
* No Discovery or Life Events redesign  
* No HUD expansion solely to clear P2  
* No manufacturing live Discovery SUCCESS  

---

## 9. Release recommendation

**Arrival Atlas is technically and semantically safe enough for controlled release / hardening.**

Release as a candidate with:

1. Mandatory production env: `ARRIVAL_ATLAS_AUTH_SECRET`, ops token as needed, `NEXT_PUBLIC_API_URL` correct for the deploy topology, `ARRIVAL_ATLAS_DEV_TOOLS=false`  
2. Acceptance of documented P2/P3 product limitations  
3. Continued use of E13–E15 probes as RC smoke  

Do not block release on HUD discoverability, Atlas Home UA chrome, or Discovery live SUCCESS depth.
