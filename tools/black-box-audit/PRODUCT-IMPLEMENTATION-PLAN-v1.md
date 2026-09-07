---
id: product-implementation-plan-v1
title: Arrival Atlas — Product Implementation Plan v1
project: Arrival Atlas
system: Arrival Atlas
type: plan
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - implementation-plan
  - product-decisions
  - e2e
  - black-box-audit
created: 2026-09-07
updated: 2026-09-07
related:
  - product-decisions-v1
  - e2e-product-specification-v1
  - product-guide-v1
---

# Arrival Atlas — Product Implementation Plan v1

## 1. Purpose

This document translates the **approved Product Decisions** into an incremental implementation roadmap.

Authoritative inputs:

| Input | Role |
| ----- | ---- |
| Current production code + domain architecture | Implementation baseline |
| `docs/product/product-guide-v1.md` | Desired behavioral / UX rules |
| `tools/black-box-audit/PRODUCT-DECISIONS-v1.md` | Approved product contracts (PD-001…007) |
| `tools/black-box-audit/E2E-PRODUCT-SPECIFICATION-v1.md` | Observable acceptance contracts |
| `tools/black-box-audit/` probes/artifacts | Evidence of current gaps |

This plan answers:

> What needs to change across product, domain/state, APIs, UI, persistence, execution infrastructure, and E2E coverage to make the approved product contracts real?

It does **not** implement those changes. It does **not** reopen approved product decisions.

---

## 2. Implementation Principles

1. Do not solve UX problems only in the UI if the underlying state model is insufficient.
2. Keep domain state authoritative and derive UI from it.
3. Avoid duplicate representations of the same product state.
4. Preserve existing working behavior unless it conflicts with an approved product contract.
5. Every state transition must have a user-visible semantic consequence.
6. External processes must never be represented as if Atlas performed them.
7. Long-running execution must be observable and recoverable.
8. Existing E2E coverage should be **extended** according to the E2E Product Specification rather than replaced blindly.
9. Prefer incremental implementation with verifiable vertical slices.
10. Do not introduce speculative architecture that is not required by the approved decisions.

---

## 3. Cross-Decision Architecture Map

### 3.1 Core situation → action loop

```text
Arrival / Journey
      ↓
Current Situation (Profile + derived signals)
      ↓
Life Events / Economic Reality / Healthcare / Employment intent
      ↓
Profile state (authoritative facts)
      ↓
Recommendations / Action Planner
      ↓
Actions (prepare / edit / open module / external / confirm / execute)
      ↓
State mutations
      ↓
Recalculation (LE + ER plans, recommendations)
      ↓
Next action
```

### 3.2 Employment dual tracks (PD-004)

```text
Work & Growth
      ↓
Employment intent (conceptual; no new module package required)
 ┌──────────────────┐
 │                  │
Work & Income      Job Search
 │                  │
current situation  Discovery Jobs
(Profile domains)         │
                   Search Profile
                          │
                   Execution lifecycle (PD-007)
```

### 3.3 Discovery persistence + execution (PD-006 / PD-007)

```text
Discovery Profile
      ↓
Persistence scope (accountId ?? sessionId + disclosure)
      ↓
Execution
      ↓
IDLE → QUEUED → RUNNING → SUCCESS / NO_RESULTS / ERROR
```

### 3.4 Shared infrastructure to reuse (not rebuild)

| Shared concern | Existing locus | Reuse for |
| -------------- | -------------- | --------- |
| Profile correction + confirmation toast | `DomainMutationEditor`, `ProfileCorrectionToast`, `?updated=1` | PD-001 confirm pattern |
| Situation signals | `packages/modules/src/life-event/plan/signals.ts` | PD-001 / PD-002 |
| ER plan pipeline | `buildEconomicRealityPlan` / `useEconomicRealityPlan` | PD-002 |
| External resource actions | ER `node-action-catalog.ts` `external_resource` | PD-001 guidance |
| Module UI projection | `ContractModulePage`, `normalizeRecommendations` | PD-003 |
| Discovery profile CRUD + run-now | `DiscoveryPage`, `useDiscoveryModule`, discovery routes | PD-004…007 |
| Identity scoping | `resolveDiscoveryUserId` | PD-006 / PD-007 |
| Run lifecycle engine | `packages/discovery/src/pipeline/run-lifecycle.ts` | PD-007 |
| Demo leave | `leaveDemoAndReset` / `LeaveDemoConfirm` | PD-006 disclosure |

---

## 4. PD-001 — Registration Implementation Plan

### Approved contract

Atlas prepares the user for Anmeldung, provides external guidance, and lets the user explicitly confirm completion. Atlas must not pretend to perform municipal registration.

### 4.1 Domain / state model

**Current**

- Address / housing facts in Profile.
- `isMunicipallyRegistered` heuristic in `signals.ts` (address + residency + not recent-arrival / re-reg pending).
- LE satisfaction `municipal_registration` and ER `registration_confirmed` both consume that heuristic.
- `g1-complete-anmeldung` actions today: scenario + profile migration — **no confirm completion**.

**Desired semantic distinction**

| Product state | Meaning |
| ------------- | ------- |
| Address missing | Registration blocked on address prerequisite |
| Address available | Address COMPLETE; preparation can begin |
| Registration preparation | Atlas guidance visible; external process not confirmed |
| External process in progress | User left to Bürgeramt / guidance; Atlas still unconfirmed |
| User-confirmed completion | Authoritative Registration COMPLETE |
| Not yet confirmed | Address may exist; Anmeldung still incomplete until confirm |

**Planning implication:** heuristic alone is **not** sufficient as the product meaning of COMPLETE (approved PD-001). Implementation must introduce an authoritative confirmation fact (exact field/intent left to implementation), then wire LE/ER satisfaction to prefer confirmation.

### 4.2 Recommendation / action model

Anmeldung inspector / node must expose:

- current state (Blocked / Ready / Complete);
- blocking prerequisite when applicable (address);
- next action (provide address / prepare / open external guidance / confirm);
- external guidance as interactive action (reuse `external_resource` pattern from ER catalogs);
- confirmation action only when preparation path is reachable (address available).

Blocked section must not contradict with “No direct constraints” while status is Blocked (`E2E-GLOBAL-003`).

### 4.3 UI flow

```text
Registration
 ↓
Why it matters
 ↓
Current state
 ↓
Address prerequisite (if needed)
 ↓
Prepare Anmeldung
 ↓
External process / guidance
 ↓
User confirms completion
 ↓
Registration COMPLETE → recalculate plans
```

Primary surfaces to extend:

- LE catalog node `g1-complete-anmeldung` (`packages/modules/src/life-event/plan/graph/catalog.ts`)
- Inspector actions rendering (make actions interactive)
- Profile confirmation UX patterns (`DomainMutationEditor` / toast)

### 4.4 Recovery

| Situation | Expected product behavior |
| --------- | ------------------------- |
| No address | Explain block; interactive Provide address |
| Address, not registered | Ready/prepare + external guidance + confirm available |
| Started then leaves | Preserve state; on return show same next action |
| Returns later | Confirmation still available until done |
| Does not confirm | Remains incomplete; do not auto-COMPLETE via heuristic alone |

### 4.5 E2E

Unlock / harden: `E2E-REG-004`…`007`, `E2E-REC-001`/`002`, `E2E-GLOBAL-003`; secondary planner: `E2E-ER-006`, `E2E-STATE-004`.

### 4.6 Existing extension points

- `signals.ts`, `satisfaction-keys.ts` (`registration_confirmed`)
- ER `external_resource` templates in `node-action-catalog.ts`
- Profile mutation confirmation toast path

---

## 5. PD-002 — Economic Reality Implementation Plan

### Approved contract

Economic Reality v1 is an Action Planner. Simulators remain separate capabilities.

### 5.1 Close the loop

**Current gap (`ER-LOOP-001`)**

```text
ER → Update Housing → Housing Complete → ER → Update Housing again
```

**Desired**

```text
ER → current situation → recommended action → prerequisite
  → completed prerequisite recognized → next prerequisite
  → financial / benefits action (open_module / external as appropriate)
```

### 5.2 Analysis

| Area | Current locus | Work |
| ---- | ------------- | ---- |
| Recommendation / plan | `buildEconomicRealityPlan` pipeline | Ensure completed housing facts stop primary housing track when housing data is complete |
| Prerequisite tracking | `evaluateEconomicSatisfactionKeys`, node catalog `g2-registration` | Registration gate must use PD-001 confirmation semantics |
| Completion recognition | Action set may still include housing update after save | Filter / re-rank completed tracks; surface “housing complete → next is registration” |
| Recalculation | `useEconomicRealityPlan`, `invalidateEconomicPlanIfHashChanged`, action execute | Confirm hash/plan changes after Profile save |
| Benefits Simulator | `open_module` `benefitsModule` | Keep as destination; do not fold assessment into ER |
| Registration | `registration_confirmed` | Depends on PD-001 authoritative confirm |
| UI | ER presentation / track cards | Show completed vs next distinctly |
| Recovery | Return to ER after Profile | Obvious continuation + recalculated next step (`E2E-ER-007`) |

### 5.3 PD-001 effect on planner progression

Until Registration is user-confirmed COMPLETE:

- planner may recommend Registration preparation / confirmation;
- must **not** re-open completed Housing as if unresolved;
- after PD-001 confirm, `registration_confirmed` becomes true and planner advances past registration gate.

### 5.4 E2E

`E2E-ER-001`…`007`, `E2E-GLOBAL-004`, `E2E-STATE-001`/`003`/`004`.

Existing tests to extend (not replace):

- `apps/web/tests/e2e/economic-reality/*`
- `apps/api/tests/e2e/economic-reality/*`
- `packages/modules/tests/e2e/economic-reality/*`

---

## 6. PD-003 — Healthcare Implementation Plan

### Approved contract

Progressive enrichment. Minimum context is situation + clear insurance assumptions. Additional context is requested only when needed.

### 6.1 Observed architectural gap

Module execute already returns useful content:

- `steps`, `decisions`, `warnings` — `packages/modules/src/healthcare-navigation/index.ts`

User-facing projection can still show empty recommendations/actions because:

- `normalizeRecommendations` defaults to `[]` for modules other than `financial-reality` / `benefits-simulator` (`packages/module-runtime/src/normalizers/normalizeRecommendations.ts`)
- UI renders projection recommendations via `ContractModulePage` → `ModuleProjectionRenderer`

**Do not rewrite the healthcare engine by default.** Prefer projection + outcome UX.

### 6.2 Desired semantic outcomes

```text
SUCCESS_WITH_RECOMMENDATIONS
MORE_INFORMATION_REQUIRED
NO_APPLICABLE_RESULT
ERROR
```

Mapping intent:

| Outcome | When |
| ------- | ---- |
| SUCCESS_WITH_RECOMMENDATIONS | Scenario produced usable steps/decisions (map into recommendations/actions) |
| MORE_INFORMATION_REQUIRED | Product rules require enrichment before useful guidance (explicit UI) |
| NO_APPLICABLE_RESULT | Execution completed; nothing applicable; explained |
| ERROR | Technical failure; retry |

Minimum to execute: user-chosen `situation` + visible insurance assumptions. City/profile insurance = progressive enrichment.

### 6.3 Minimum architectural changes

1. Healthcare recommendation normalizer (or equivalent projection) mapping steps/decisions/warnings → recommendations/actions.
2. Form copy that labels defaults as assumptions.
3. Terminal empty states never silent (`E2E-HC-008`).
4. Optional enrichment prompts after first result.

### 6.4 E2E

`E2E-HC-002`…`008`, `E2E-GLOBAL-005`, `E2E-REC-003`/`004`.

---

## 7. PD-004 — Employment Implementation Plan

### Approved contract

Two distinct tracks:

```text
Work & Income = current professional/economic situation
Job Search    = Discovery Jobs
```

### 7.1 Desired topology

```text
Work & Growth
      ↓
Employment (conceptual grouping)
 ┌───────────────┐
 │               │
Work & Income   Job Search
 │               │
current state   Discovery Jobs
```

No new Employment module package required for v1.

### 7.2 Analysis

| Area | Current | Work |
| ---- | ------- | ---- |
| Work & Growth | `atlas-data.ts` work slide CTAs → Life Events | Add dual CTAs / destination clarity: Profile Work & income + Discovery Jobs |
| Work & income disabled | `PROFILE_DOMAIN_DEPS['work-income']=['move-to-germany']` in `build-galaxy-graph.ts` | Explain lock + unlock path in inspector (do not force-enable) |
| Discovery Jobs | `/modules/discovery` via Atlas HUD | Bridge from Work & Growth without auto-run |
| Recommendations | ER `profileWorkIncome`; external jobcenter resources | Keep situation vs search distinct in copy |
| Profile deps | `move-to-germany` requires origin + residency | Validate unlock after completion |

### 7.3 E2E

`E2E-EMP-001`…`005`, destination sanity `E2E-DISC-001`.

---

## 8. PD-005 — Guided Discovery Implementation Plan

### Approved contract

Lightweight wizard, materially different from Journey Guide welcome.

### 8.1 Minimal honest guided flow

```text
Choose discovery goal
      ↓
Jobs / Giveaways
      ↓
Minimum required criteria
      ↓
Review
      ↓
Create profile
      ↓
Confirmation
      ↓
Optional: Run / explore (no auto-run on create)
```

### 8.2 Reuse

| Item | Source |
| ---- | ------ |
| Fields | Existing `DiscoveryPage` create form / `buildCreateProfileInput` (template, name, country, role, schedule, notification…) |
| Profile model | Same Discovery profile APIs (`POST /api/modules/discovery/profiles`) |
| Self-directed mode | Keep New profile |

### 8.3 Wizard vs welcome

- Disentangle `JourneyGuideWelcome` on Discovery (`JourneyGuide.tsx` / `JourneyGuideLayer.tsx`) so Guided means the wizard.
- Mid-wizard exit: discard draft unless a deliberate draft store is added (default: discard; non-blocking).
- Guided and self-directed converge on the same canonical profile.

### 8.4 E2E

`E2E-DISC-002` primary; creation `E2E-DISC-003`…`005`.

Existing to extend: `apps/web/tests/e2e/arr-023/e2e-discovery-*.spec.ts`.

---

## 9. PD-006 — Discovery Persistence Implementation Plan

### Approved contract

Account-scoped when account identity exists; demo/session must disclose limited persistence.

### 9.1 Current implementation

```text
userId = accountId ?? sessionId
```

(`apps/api/src/discovery/discovery-user-runtime.ts` → `resolveDiscoveryUserId`)

Implications:

| Concern | Behavior today |
| ------- | -------------- |
| Create/retrieve | Scoped to resolved userId |
| Return visit (account) | Should see same profiles if same accountId |
| Demo / new session | New sessionId ⇒ empty list (audit STEPs 37/40) |
| Leave demo | `leaveDemoAndReset` changes session continuity |
| Runs/results | Same userId ownership as profiles |

### 9.2 Desired product contract vs implementation

| Layer | Statement |
| ----- | --------- |
| Current implementation | Already keys by account when present |
| Desired contract | Account persistence promised; demo disclosed as temporary |
| Auth assumption | Uses existing identity — does not invent new auth |
| Implementation work | Disclosure UI; ensure leave-demo messaging; authenticated E2E; optional orphan/cleanup policy |

### 9.3 E2E

`E2E-DISC-011`, `E2E-RETURN-*`, `E2E-GLOBAL-006` — require authenticated return-visit coverage where account scope is claimed.

---

## 10. PD-007 — Discovery Execution Lifecycle

### Approved lifecycle

```text
IDLE → QUEUED → RUNNING → SUCCESS / NO_RESULTS / ERROR
```

### 10.1 Execution state ownership

| Layer | Owner |
| ----- | ----- |
| Engine run | Discovery run store (`PENDING`…`CANCELLED`) — `packages/discovery/src/types/run.ts` |
| Queue job | SQLite execution queue (`QUEUED`/`RUNNING`, visibility timeout ~300_000 ms) |
| Product UI state | Mapped view over run/queue + results (`useDiscoveryModule` today: idle/running/success/error only) |

### 10.2 Transition semantics

| Product transition | Cause |
| ------------------ | ----- |
| IDLE → QUEUED | User Run; job enqueued / run PENDING |
| QUEUED → RUNNING | Worker/pull-process starts run |
| RUNNING → SUCCESS | Terminal SUCCESS/PARTIAL_SUCCESS with ≥1 result |
| RUNNING → NO_RESULTS | Terminal SUCCESS with zero results |
| RUNNING → ERROR | FAILED or timed-out / unrecoverable |
| Any → IDLE | After acknowledged terminal, ready to run again |

### 10.3 UI

| State | User sees |
| ----- | --------- |
| Queued | Waiting to start (not “stuck”) |
| Running | Active search; leave/return expectations |
| Success | Results + next actions |
| No results | Explicit completed-with-no-matches + refine/retry |
| Error | Why if known + Retry / change criteria |

### 10.4 Long-running execution

- Remain observable via run-summary/results observation after `run-now` (today: single await in `useDiscoveryModule.runNow` — extend).
- Leave allowed; return shows persisted state under PD-006 scope.
- Timeout: respect infrastructure ceiling; never indefinite unlabeled running.
- Retry on ERROR; block duplicate Run while QUEUED/RUNNING.
- Cancellation optional for v1 (engine has CANCELLED; API/UI not exposed).

### 10.5 Result semantics

| Semantic | Meaning |
| -------- | ------- |
| SUCCESS | Completed with results |
| NO_RESULTS | Completed, zero matches |
| ERROR | Failed |

### 10.6 E2E

`E2E-DISC-006`…`010`, `E2E-REC-005`/`006`.

---

## 11. Shared Infrastructure Work

| Shared area | Why needed | PDs | Extend existing? | Duplicate risk |
| ----------- | ---------- | --- | ---------------- | -------------- |
| Authoritative completion / confirmation facts | Heuristic ≠ COMPLETE | 001, 002 | Profile mutation + signals | Don’t invent parallel LE-only flags |
| Satisfaction / plan recalculation | Prerequisite recognition | 001, 002 | ER/LE pipelines | Don’t fork ER planner |
| Recommendation normalization | Empty projections | 003 (+ pattern for others) | `normalizeRecommendations` | Don’t special-case only in one UI |
| Interactive inspector actions | Text-only recovery | 001, 004 | LE/Profile inspector action renderers | Don’t add dead copy CTAs |
| External process framing | PR-010 | 001, 002 | `external_resource` | Don’t fake government execute |
| Identity + demo disclosure | Persistence honesty | 006, 007 | `resolveDiscoveryUserId`, leave-demo | Don’t add second userId scheme |
| Execution observation | Long-run honesty | 007 | run-summary/results APIs | Don’t invent parallel run store |
| Localization coherence | CROSS-UX-001 | all journeys | existing i18n | Don’t ship EN-only new strings |
| Route/action consequence | CROSS-UX-002 | LE/ER guided | action handlers | Don’t add more no-op CTAs |

---

## 12. Implementation Sequencing

Dependency-aware vertical slices (PD number order is **not** optimal).

### Phase 0 — Shared foundations (thin)

**Objective:** Unblock later slices without speculative platforms.

**Major changes**

- Document/product state vocabulary in code comments/contracts only where needed.
- Identify confirmation mutation pattern reuse.
- Healthcare normalizer extension point selected.
- Discovery identity/disclosure copy decisions locked with eng.

**Dependencies:** none  
**User-visible:** little alone  
**E2E unlocked:** none yet  
**Risks:** over-building foundations

### Phase 1 — Registration (PD-001)

**Objective:** Authoritative Registration COMPLETE + explainable blocked/ready.

**Major changes:** confirmation fact; LE Anmeldung actions (prepare/external/confirm); inspector interactivity; satisfaction wiring.

**Dependencies:** Phase 0 confirmation pattern  
**User-visible:** Anmeldung recovery + confirm path  
**E2E unlocked:** `E2E-REG-004`…`007`, `E2E-REC-001`/`002`  
**Risks:** heuristic conflict; false confirmation

### Phase 2 — Economic Reality planner (PD-002)

**Objective:** Kill `ER-LOOP-001`; advance after completed housing; respect PD-001 registration.

**Major changes:** action-set/track filtering; plan recalculation verification after Profile save; copy for “housing complete → next registration.”

**Dependencies:** Phase 1 registration semantics (for full progression); housing completion already works  
**User-visible:** ER next step advances  
**E2E unlocked:** `E2E-ER-006`/`007`, `E2E-GLOBAL-004`, state scenarios  
**Risks:** over-filtering actions; breaking existing ER e2e

### Phase 3 — Healthcare outcomes (PD-003)

**Objective:** End empty-success; progressive enrichment UX.

**Major changes:** normalizer mapping; outcome states; assumption labeling.

**Dependencies:** Phase 0 normalizer extension point  
**User-visible:** recommendations or explicit empty/more-info  
**E2E unlocked:** `E2E-HC-002`…`008`, `E2E-GLOBAL-005`  
**Risks:** over-mandating fields

### Phase 4 — Employment dual tracks (PD-004)

**Objective:** Work & Growth → Work & Income **and** Discovery Jobs; explain locks.

**Major changes:** journey CTA bridges; Profile lock explanation; no auto Discovery run.

**Dependencies:** Discovery entry stable (exists today); PD-005/006/007 improve destination quality but bridges can ship earlier  
**User-visible:** employment intent reaches search + situation  
**E2E unlocked:** `E2E-EMP-001`…`005`  
**Risks:** conflating tracks in copy

### Phase 5 — Discovery foundations (PD-006 + PD-007)

**Objective:** Persistence disclosure + observable lifecycle including NO_RESULTS.

**Major changes:** demo disclosure; run state mapping; observation/poll; duplicate-run guard; retry UX.

**Dependencies:** existing Discovery APIs  
**User-visible:** honest demo; understandable runs  
**E2E unlocked:** `E2E-DISC-006`…`011`, `E2E-REC-005`/`006`, return/global persistence  
**Risks:** auth availability for account E2E; long-run flakiness

### Phase 6 — Guided Discovery wizard (PD-005)

**Objective:** Real lightweight wizard; disentangle Journey Guide welcome.

**Major changes:** wizard UI; same create API; welcome separation.

**Dependencies:** Phase 5 profile/execution foundations preferred (so wizard lands on coherent run UX)  
**User-visible:** Guided actually guides  
**E2E unlocked:** `E2E-DISC-002` (+ create path)  
**Risks:** duplicating create form logic

### Phase 7 — E2E hardening

**Objective:** Encode E2E Product Specification scenarios into automated suites; extend existing `apps/web/tests/e2e` and `apps/api/tests/e2e` rather than replacing.

**Dependencies:** Phases 1–6 slices as they land  
**Risks:** brittle selectors; cost-sensitive Discovery runs (mirror black-box cost discipline)

**Sequence challenge result:** Healthcare (Phase 3) and Employment bridges (Phase 4) can proceed **in parallel** with Phase 2 after Phase 1 starts, because they do not share critical write paths. Guided Discovery should stay after lifecycle/persistence for a coherent destination.

---

## 13. Traceability Matrix

| Product Decision | Domain | API | UI | Persistence | Execution | E2E | Dependencies |
| ---------------- | ------ | --- | -- | ----------- | --------- | --- | ------------ |
| PD-001 | LE signals + confirm fact; ER `registration_confirmed` | Profile mutations; LE actions | Anmeldung inspector; external guidance; confirm | Profile facts | — | REG-004…007, REC-001/002 | — |
| PD-002 | ER satisfaction + action-set/tracks | ER plan + action execute | ER next-step presentation | Derived plan | — | ER-*, GLOBAL-004, STATE-* | PD-001 |
| PD-003 | Healthcare output semantics | Module execute (existing) | ContractModulePage outcomes; assumption labels | Optional profile insurance | Module execute | HC-002…008, GLOBAL-005 | Normalizer |
| PD-004 | Profile work-income; no new module | — | Work & Growth CTAs; lock explanation; Discovery link | Profile deps | — | EMP-001…005 | Discovery entry |
| PD-005 | Same Discovery profile model | Existing profile create | Lightweight wizard; welcome disentangle | Draft optional | No auto-run | DISC-002…005 | PD-006 |
| PD-006 | userId scoping | Discovery profiles/results | Demo/session disclosure | SQLite by userId | Ownership of runs | DISC-011, RETURN-*, GLOBAL-006 | Existing identity |
| PD-007 | Run status mapping | run-now, run-summary, results | Lifecycle UI; NO_RESULTS; retry | Run/result stores | Queue + pipeline | DISC-006…010, REC-005/006 | PD-006 |

---

## 14. Risk Register

| Risk | Impact | Mitigation | Blocks? |
| ---- | ------ | ---------- | ------- |
| Heuristic registration vs confirm conflict | False COMPLETE / stuck READY | Confirmation authoritative; heuristic advisory | No — define precedence in Phase 1 |
| Semantic state duplication | Divergent LE vs ER truth | Single confirm fact → both satisfaction keys | No |
| Recommendation normalization drops output | Empty healthcare UX continues | Extend normalizer; golden fixtures from module output | No |
| Account identity unavailable in demo/prod mix | Persistence promise untestable | Disclose demo; add authenticated E2E env | Partially blocks PD-006 proof, not coding |
| Session vs account confusion | User thinks data lost | Explicit disclosure; leave-demo copy | No |
| Long-running execution ownership | Ambiguous STEP-36-like UX | Observe run-summary; terminal mapping | No |
| Existing API contracts | Break clients | Additive actions/fields; avoid breaking execute shapes | No |
| Backward compatibility of ER plans | Existing e2e fail | Extend tests; fixture-based planner cases | No |
| Localization regressions | CROSS-UX-001 worsens | Require uk strings for new copy | No |
| Existing E2E assumptions | False greens | Map to E2E Product Spec IDs; don’t delete old coverage blindly | No |
| Discovery cost / provider usage | Expensive CI | Gate run scenarios; reuse black-box cost discipline | No |

---

## 15. Definition of Done

Not done merely because API 200 / DB write / component render / brittle E2E green.

### Global

- Actions have observable consequences (`E2E-GLOBAL-002`).
- Blocked states explain why + recovery (`E2E-GLOBAL-003`).
- Completed prerequisites remain recognized (`E2E-GLOBAL-004`).
- Recommendations recalculate after meaningful mutations.
- Localization coherent for active journey (`E2E-GLOBAL-001`).
- Persistence semantics explicit (`E2E-GLOBAL-006`).

### Registration

- External vs Atlas actions distinguished; confirm required for COMPLETE (`E2E-REG-005`/`006`).
- Recovery understandable (`E2E-REG-007`, `E2E-REC-001`/`002`).

### Economic Reality

- Completed housing not repeatedly requested (`E2E-ER-006`).
- Planner advances to next meaningful step (`E2E-ER-007`).

### Healthcare

- No silent success + empty UI (`E2E-HC-008`).
- Every terminal state semantically explained (`E2E-HC-004`…`007`).

### Employment

- Situation vs job search distinct; Job Search reachable from Work & Growth (`E2E-EMP-001`…`003`).
- Disabled Work & income explained (`E2E-EMP-004`).

### Discovery

- Guided is genuinely guided (`E2E-DISC-002`).
- Persistence follows approved scope (`E2E-DISC-011`).
- Lifecycle observable; NO_RESULTS ≠ ERROR; long-run recoverable (`E2E-DISC-006`…`010`, `E2E-REC-005`/`006`).

---

## 16. Open Implementation Questions

Approved product decisions are **not** reopened.

| Question | Class |
| -------- | ----- |
| Exact domain field / mutation intent for Anmeldung confirmation | VALIDATE DURING IMPLEMENTATION |
| Whether LE needs a new action kind vs Profile-only confirm | VALIDATE DURING IMPLEMENTATION |
| Exact ER track filter rules for completed housing nodes | VALIDATE DURING IMPLEMENTATION |
| Healthcare normalizer shape (steps→recommendations mapping) | VALIDATE DURING IMPLEMENTATION |
| When MORE_INFORMATION_REQUIRED triggers vs first SUCCESS | VALIDATE DURING IMPLEMENTATION |
| Work & Growth CTA destinations (direct vs LE intermediary page) | NON-BLOCKING |
| Authenticated test account availability for PD-006 E2E | BLOCKING for persistence proof; NON-BLOCKING for disclosure UI |
| Client observation strategy for long Discovery runs (poll vs wait) | VALIDATE DURING IMPLEMENTATION |
| Expose CANCELLED in v1 UI? | NON-BLOCKING (default no) |
| Leave-demo orphan vs delete session profiles | NON-BLOCKING |
| City-specific Bürgeramt links vs generic guidance | NON-BLOCKING |

---

## 17. Final Recommendation

### 1. Recommended implementation order

Phase 0 → **1 Registration** → **2 Economic Reality** → (parallel) **3 Healthcare** + **4 Employment bridges** → **5 Discovery persistence/lifecycle** → **6 Guided wizard** → **7 E2E hardening**.

### 2. First vertical slice

**Registration confirmation + explainable Anmeldung recovery (PD-001).**

Smallest user-visible closed loop:

```text
Address available → Prepare / External guidance → Confirm completion
→ Registration COMPLETE visible → LE/ER satisfaction updates
```

### 3. Prerequisites for that slice

- Agree confirmation storage approach (Profile fact vs LE-only) during implementation spike.
- Reuse Profile confirmation UX patterns.
- Do not remove housing address prerequisite flow (already working).

### 4. What should NOT be implemented yet

- New Employment module package.
- Economic Reality assessment redesign / simulator merge.
- Full healthcare engine rewrite.
- New authentication system.
- Guided Discovery wizard before lifecycle/persistence honesty (Phase 6 after 5).
- Speculative cancellation UX unless needed.

### 5. First acceptance gate (E2E)

Primary:

- `E2E-REG-004`, `E2E-REG-005`, `E2E-REG-006`, `E2E-REG-007`
- `E2E-REC-001`, `E2E-REC-002`
- `E2E-GLOBAL-003`

Immediate follow-on gate after Phase 2:

- `E2E-ER-006`, `E2E-GLOBAL-004`

---

## Document control

| Field | Value |
| ----- | ----- |
| Document | Product Implementation Plan v1 |
| Location | `tools/black-box-audit/PRODUCT-IMPLEMENTATION-PLAN-v1.md` |
| Decisions | `PRODUCT-DECISIONS-v1.md` APPROVED 2026-09-07 |
| Acceptance | `E2E-PRODUCT-SPECIFICATION-v1.md` |
| Code changes in this task | None |
