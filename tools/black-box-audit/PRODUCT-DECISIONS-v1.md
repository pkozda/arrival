---
id: product-decisions-v1
title: Arrival Atlas — Product Decisions v1
project: Arrival Atlas
system: Arrival Atlas
type: contract
domain: product
status: active
maturity: evolving
owner: product
tags:
  - product-decisions
  - e2e
  - black-box-audit
  - pd-001
  - pd-002
  - pd-003
  - pd-004
  - pd-005
  - pd-006
  - pd-007
created: 2026-09-07
updated: 2026-09-07
related:
  - product-guide-v1
  - e2e-product-specification-v1
  - product-implementation-plan-v1
  - economic-reality-module-v1
  - personal-discovery-engine-architecture
---

# Arrival Atlas — Product Decisions v1

## 1. Purpose

This document records the **seven product decisions** required to implement the Desired Product Flow and the E2E contracts in:

- `docs/product/product-guide-v1.md`
- `tools/black-box-audit/E2E-PRODUCT-SPECIFICATION-v1.md`
- `tools/black-box-audit/PRODUCT-IMPLEMENTATION-PLAN-v1.md` (implementation roadmap)

It preserves the original analysis and alternatives, then records the **product-owner APPROVED** contracts.

It does **not** implement behavior. Implementation planning lives in `PRODUCT-IMPLEMENTATION-PLAN-v1.md`.

Source hierarchy used:

1. Black-box production evidence (`tools/black-box-audit/`)
2. Product Guide / Product Flow (`docs/product/product-guide-v1.md`)
3. E2E Product Specification v1
4. Existing architecture and implementation (feasibility only)
5. Older docs / tests (secondary terminology only)

**Approval note (2026-09-07):** PD-001…PD-007 are **APPROVED** for implementation planning. Approved option letters match the recommendations below.

---

## 2. Decision status vocabulary

| Status | Meaning |
| ------ | ------- |
| `OPEN` | No decision has been made. |
| `RECOMMENDED` | Analysis suggests a preferred option; product owner has not approved it. |
| `APPROVED` | Explicitly approved product decision. |
| `DEFERRED` | Intentionally postponed. |
| `BLOCKED` | Cannot be decided because required information is missing. |

All seven decisions in this document are marked `APPROVED`.

---

## 3. PD-001 — Registration completion

**Status:** `APPROVED` (Option B)  
**Depends on:** none (feeds PD-002 plan advancement via `registration_confirmed`)

### 3.1 Problem

Production can reach address-related completeness, then leave Anmeldung **Blocked / unavailable** without a clear user-visible path to Registration COMPLETE.

Audit finding (paraphrased from E2E / STEP 24):

> After address verification, no clear user path to Anmeldung completion was discovered.

Do **not** claim Anmeldung is impossible.

### 3.2 What we are deciding

How Arrival Atlas records that an **external** Bürgeramt Anmeldung process is done — without implying Atlas performed the government process (Product Guide §7 / PR-010).

### 3.3 Current production behavior

- Life Events exposes `g1-complete-anmeldung` / Complete Anmeldung with Bürgeramt framing.
- Node actions deep-link Profile (housing/migration) and scenarios — **not** a “I completed Anmeldung” recorder.
- Satisfaction key `municipal_registration` is driven by **heuristic signal** `isMunicipallyRegistered` (housing address + residency status + not recent-arrival / re-reg pending) in `packages/modules/src/life-event/plan/signals.ts`.
- Economic Reality uses `registration_confirmed` tied to that same signal (`packages/modules/src/economic-reality/execution/satisfaction-keys.ts`).
- No profile field such as `anmeldungCompletedAt` / `municipalRegistrationConfirmed` was found in product profile schemas.
- Audit: blocked recovery unclear; Actions often non-interactive; “No direct constraints” contradiction (STEP 50).

### 3.4 Product Guide requirement

Desired progression ends with:

`Confirm completion → Registration COMPLETE`

External process rule: distinguish **Atlas helps you prepare** from **You must complete this with the authority**, then provide a defined completion-recording mechanism.

### 3.5 Architecture capabilities and constraints

| Capability | Evidence |
| ---------- | -------- |
| Anmeldung graph nodes | `packages/modules/src/life-event/plan/graph/catalog.ts` |
| Inferred registration | `signals.ts` → `isMunicipallyRegistered` |
| Profile domains involved | `housing`, `migration` |
| User-confirmed mutations exist generally | Profile mutation model supports `userConfirmationRequired` / `fact.correct` patterns — but **not** wired as Anmeldung completion |
| Constraint | Must not claim Atlas performs Bürgeramt registration |

### 3.6 Options

#### Option A — Preparation + manual user confirmation

Atlas guides preparation; user confirms “I completed Anmeldung” as an explicit product fact.

| Dimension | Implication |
| --------- | ----------- |
| Newcomer UX | Clear end state; honesty about external process |
| State model | New confirmed fact (or dedicated confirmation intent) feeds `municipal_registration` / `registration_confirmed` |
| Recovery | If not confirmed, remain READY with prepare + confirm actions |
| E2E | Enables `E2E-REG-005` / `E2E-REG-006` |
| Complexity | Medium — needs UX + fact + signal wiring |
| Risks | Users may confirm incorrectly; needs clear copy |

#### Option B — External link/guidance + confirmation

Same as A, plus explicit external Bürgeramt / city guidance link as a first-class action before confirm.

| Dimension | Implication |
| --------- | ----------- |
| Newcomer UX | Stronger “Atlas prepares / authority executes” split |
| State model | Same confirmation fact as A |
| Recovery | Prepare → open external guidance → confirm |
| E2E | Same as A plus external-process assertions (PR-010) |
| Complexity | Medium (A + curated external resource actions; ER already has `external_resource` patterns) |
| Risks | Link freshness / city-specificity |

#### Option C — Informational only (no user completion state)

Registration completion remains heuristic / informational; no user-owned COMPLETE state.

| Dimension | Implication |
| --------- | ----------- |
| Newcomer UX | Weak; matches much of today’s confusion |
| State model | Keep inference-only `isMunicipallyRegistered` |
| Recovery | Remains unclear |
| E2E | Leaves `E2E-REG-006` unresolved / fails Guide §7 |
| Complexity | Lowest |
| Risks | Continues `OBSERVED_GAP` on registration recovery |

#### Option D — Treat current inference as completion (architecture status quo)

Declare heuristic housing+migration signals as the product definition of COMPLETE.

| Dimension | Implication |
| --------- | ----------- |
| Newcomer UX | Invisible “completion”; user never confirms Bürgeramt act |
| State model | Already implemented |
| Recovery | Does not fix blocked Anmeldung UX |
| E2E | Conflicts with Guide “confirm completion” |
| Complexity | None |
| Risks | False positives/negatives (recent arrival / re-reg heuristics) |

### 3.7 Recommendation (historical analysis)

**Recommend Option B** (preparation + external guidance + explicit user confirmation).

Rationale:

- Matches Product Guide §7 and PR-010.
- Reuses existing Profile confirmation mutation patterns conceptually.
- Replaces opaque inference as the *sole* product meaning of COMPLETE (inference may remain a soft signal, but user confirmation should be authoritative for Registration COMPLETE).
- Smallest scope that closes the audited “no path to completion” gap without claiming Atlas runs Bürgeramt.

### 3.7a Approved Product Contract

**Status:** `APPROVED` — Option B.

**Fixed product behavior**

- Atlas prepares the user for Anmeldung and provides external guidance.
- The user explicitly confirms completion after the external process.
- Atlas must not pretend to perform municipal registration.
- User-confirmed completion is the authoritative Registration COMPLETE signal for product progression.
- Heuristic signals (e.g. `isMunicipallyRegistered`) may remain advisory but must not silently replace confirmation as the product meaning of COMPLETE.

**Still open for implementation**

- Exact profile/domain field or mutation intent representation.
- Exact Life Event action kinds / inspector control wiring.
- Whether heuristics remain as soft unlocks alongside confirmation.

**Does not block planning**

- City-specific Bürgeramt URL catalogs (can start with generic external guidance).

### 3.8 E2E impact

Primarily: `E2E-REG-004`, `E2E-REG-005`, `E2E-REG-006`, `E2E-REG-007`, `E2E-REC-001`, `E2E-REC-002`, `E2E-GLOBAL-003`.  
Secondary: `E2E-ER-006`, `E2E-STATE-004` (via `registration_confirmed`).

### 3.9 Unknowns

- Legal/product meaning of `residencyStatus` vs true Bürgeramt confirmation.
- Whether production has any unaudited confirm path (none found in architecture/audit).

---

## 4. PD-002 — Economic Reality scope

**Status:** `APPROVED` (Option A)  
**Depends on:** PD-001 (registration satisfaction); overlaps Benefits Simulator / financial-reality (must not duplicate)

### 4.1 Problem

Production Economic Reality behaves primarily as an **action planner**. It does not present a rich economic assessment in the audited journey. Product owner must decide whether ER is planner, assessment, or both.

### 4.2 Current production behavior

- Benefit intent → prerequisites → Profile housing save works (`E2E-ER-003`–`005` PASS).
- After housing COMPLETE, plan often does **not** advance (`ER-LOOP-001`, `E2E-ER-006` GAP).
- ER can open other modules via action types (`open_module`, `external_resource`, `update_profile`, `system_intent`).

### 4.3 Product Guide / architecture

Product Guide §8: for v1, ER should be primarily an **action-oriented financial plan** (“What should I do next?”). Richer assessment can come later.

ER module docs (`docs/economic-reality/economic-reality-module-v1-spec.md`, economic state model) position ER as institutional **planning**, not the calculator.

Assessment/calculator siblings already exist:

- `financial-reality` — gross/net / Bürgergeld-oriented calculation
- `benefits-simulator` — scenario simulation

### 4.4 Options

#### Option A — Action Planner

ER answers “what next?” via plan/graph/actions; calculations live in sibling modules.

| Newcomer value | High for stressed newcomers |
| Scope | Plan, prerequisites, intents, continuation |
| Overlap | Low if ER deep-links simulators instead of embedding them |
| Complexity | Lowest coherent v1 |
| E2E | Focus on `E2E-ER-*` planner contracts + `ER-LOOP-001` fix |

#### Option B — Economic Assessment

ER becomes the primary financial assessment surface.

| Newcomer value | High for “how much / am I eligible?” questions |
| Scope | Calculations, projections, comparisons |
| Overlap | High conflict with `financial-reality` / `benefits-simulator` |
| Complexity | High; contradicts ER v1 module positioning |
| E2E | Would redefine most `E2E-ER-*` assertions |

#### Option C — Assessment + Action Plan

ER owns both inline assessment and planning.

| Newcomer value | Highest if well designed |
| Scope | Largest |
| Overlap | Must carefully demote sibling modules |
| Complexity | Highest for v1 |
| E2E | Expands ER scenarios substantially |

### 4.5 Recommendation (historical analysis)

**Recommend Option A — Action Planner for v1.**

Keep `financial-reality` and `benefits-simulator` as assessment/simulation destinations opened from the plan when needed.

Also require fixing completed-prerequisite recognition (`ER-LOOP-001`) as a **planner correctness** issue, not as a reason to expand into assessment.

### 4.5a Approved Product Contract

**Status:** `APPROVED` — Option A.

**Fixed product behavior**

- Economic Reality v1 is an **Action Planner** (“what should I do next?”).
- Benefits Simulator and financial-reality remain separate capabilities.
- Completed prerequisites (e.g. Housing COMPLETE) must be recognized; the planner must advance to the next incomplete prerequisite (e.g. Registration) instead of reopening completed housing (`ER-LOOP-001`).
- PD-001 confirmation semantics feed planner progression via registration satisfaction.

**Still open for implementation**

- Exact track/action filtering rules when a node is satisfied.
- How much calculator summary (if any) may appear as secondary cards without becoming “assessment-primary.”

**Validate during implementation**

- Plan hash / recalculation after profile mutations (`buildEconomicRealityPlan` pipeline).

### 4.6 E2E impact

`E2E-ER-001`–`E2E-ER-007`, `E2E-GLOBAL-004`, `E2E-STATE-001`, `E2E-STATE-003`, `E2E-STATE-004`.

### 4.7 Unknowns

- Whether future UX should surface calculator snippets *inside* ER cards vs always navigate out (does not change Option A recommendation).

---

## 5. PD-003 — Healthcare minimum context

**Status:** `APPROVED` (Option D)  
**Depends on:** Profile health-insurance domain (optional enrichment); presentation/runtime normalizer

### 5.1 Problem

Production allows Healthcare execution with limited/default context and can return:

```text
HTTP 200 + empty recommendations + empty actions + no meaningful UI result
```

Do **not** invent why the backend returned empty arrays in the audited response envelope.

### 5.2 Current production behavior

- UI form fields are editable (`E2E-HC-001`/`002` PASS).
- Execute observed with defaults and with `city=Bremen` still yielded empty projected recommendations (`step-13-execute-response.json`).
- Module **does** compute scenario `steps` / `decisions` / `warnings` from inputs (`packages/modules/src/healthcare-navigation/index.ts`).
- Runtime `normalizeRecommendations` only special-cases `financial-reality` and `benefits-simulator`; **default returns `[]`** (`packages/module-runtime/src/normalizers/normalizeRecommendations.ts`).

### 5.3 Input schema (architecture)

**Required for schema validity**

- `situation` (enum: new-arrival, need-doctor, need-specialist, insurance-choice, emergency, prescription)

**Defaulted (not forced user entry today)**

- `hasInsurance` (default false)
- `insuranceType` (default none)
- `urgency` (default routine)

**Optional / helpful**

- `city`

Profile can store health-insurance facts; galaxy node `health-insurance` is dependency-locked on `move-to-germany` (same pattern as work-income).

### 5.4 Distinguish required vs helpful

| Class | Fields | Rationale |
| ----- | ------ | --------- |
| **Required for meaningful execution** | `situation` | Selects scenario script; without it the module has no primary branch |
| **Required for honest personalization of insurance path** | `hasInsurance`, `insuranceType` (may keep defaults if UI labels them) | Changes warnings/path framing |
| **Helpful** | `urgency`, `city`, Profile insurance facts | Improves local guidance; not proven necessary for non-empty *content generation* given scenario table |

Important architectural finding: audited empty UI is consistent with **recommendation projection dropping module output**, not with “situation was insufficient to compute steps.” Product Decision must still define minimum *user-facing* context and outcome semantics.

### 5.5 Options

#### Option A — Ask all context before execution

Force full form + possibly Profile insurance before execute.

- Pros: richer answers  
- Cons: higher friction; over-mandates helpful fields  

#### Option B — Ask only minimum required, then execute

Require `situation` (and clear insurance defaults/labels); execute; show semantic outcome.

- Pros: newcomer-friendly; matches current schema  
- Cons: less personalized until enrichment  

#### Option C — Execute with partial context and explain limitations

Allow sparse execute; always explain what was assumed / missing.

- Pros: honesty  
- Cons: needs explicit limitation UX (Guide §9)  

#### Option D — Progressive enrichment

Start with minimum → show result → prompt for city/insurance to refine.

- Pros: best newcomer arc; aligns with Guide recovery patterns  
- Cons: needs multi-step outcome UX  

### 5.6 Recommendation (historical analysis)

**Recommend Option D (progressive enrichment), with Option B as the first step of that arc.**

Minimum to allow execution:

1. `situation` explicitly chosen by the user.
2. Insurance fields either confirmed or clearly shown as assumed defaults.
3. Execution must never end as unexplained empty success (`E2E-HC-008`): map module steps/decisions/warnings into user-visible recommendations/actions **or** show MORE INFO / NO RESULT explicitly.

City and Profile insurance remain **helpful**, not hard blockers for first result.

### 5.6a Approved Product Contract

**Status:** `APPROVED` — Option D.

**Fixed product behavior**

- Progressive enrichment: ask minimum first, enrich when needed.
- Minimum context = `situation` + clear insurance assumptions (defaults must be visible as assumptions, not hidden).
- Additional context (city, profile insurance, urgency refinements) is requested only when needed.
- Terminal outcomes must be semantic: recommendations found / more information required / no applicable result / error.
- Unexplained empty success is prohibited.

**Still open for implementation**

- Exact normalizer mapping from `steps`/`decisions`/`warnings` → recommendations/actions.
- When MORE_INFORMATION_REQUIRED is chosen vs SUCCESS_WITH_RECOMMENDATIONS for sparse inputs.

**Validate during implementation**

- Existing execute payload already contains useful content; prefer projection/UI fix over engine rewrite.

### 5.7 E2E impact

`E2E-HC-002`–`E2E-HC-008`, `E2E-GLOBAL-005`, `E2E-REC-003`, `E2E-REC-004`.

### 5.8 Unknowns

- Whether any client path already renders raw `steps` outside recommendation projection (not observed in audit).
- Exact product definition of “useful” beyond scenario scripts.

---

## 6. PD-004 — Employment canonical path

**Status:** `APPROVED` (Option D)  
**Depends on:** PD-005 / PD-006 (Discovery destination quality); Profile `move-to-germany` unlock for Work & income

### 6.1 Problem

Audit:

- Work & Growth → Life Events (not employment-specific).
- No visible employment Life Events node in inspected state.
- Discovery → Jobs exists independently.
- Profile Work & income exists but is disabled until dependencies met.

Do **not** claim employment functionality is absent.

### 6.2 Architecture facts

| Concept | What it is today |
| ------- | ---------------- |
| Work & Growth | Journey slide / intent; CTAs go to `/modules/life-event` |
| Work & income | Profile domains `employment` + `income`; locked by `PROFILE_DOMAIN_DEPS['work-income'] = ['move-to-germany']` in `apps/web/src/lib/presentation/profile/build-galaxy-graph.ts` |
| Discovery Jobs | Independent opportunity engine at `/modules/discovery` |
| Dedicated Employment module package | **Not found** |
| ER job-search node | Can point to **external** employment-agency resource — not Discovery |

Product Guide §10 preferred conceptual flow:

`Work & Growth → Employment → Job search → Discovery / Jobs → …`

Guide also states Work & income ≠ Job Search.

### 6.3 Options

#### Option A — Work & Growth → Discovery Jobs

Direct bridge from employment intent to Discovery.

| Comprehension | Simple |
| Fit | Uses existing Discovery; skips missing Employment module |
| Risk | Skips Profile employment situation capture |

#### Option B — Work & Growth → Employment → Discovery Jobs

Employment as an intermediate capability.

| Comprehension | Matches Guide narrative |
| Fit | Requires defining Employment without a dedicated module today (Life Event work nodes + Profile Work & income + CTA to Discovery) |
| Risk | Higher UX surface; unlock explanation must be fixed |

#### Option C — Work & Growth → Employment with integrated job search

Employment embeds search.

| Comprehension | One place |
| Fit | Poor — would duplicate Discovery |
| Risk | Large scope; conflicts with PDE architecture |

#### Option D — Dual tracks (situation vs search)

- **Situation track:** Work & Growth / Profile Work & income (employment facts)  
- **Search track:** explicit “Find jobs” → Discovery Jobs  
Both reachable from Work & Growth without conflating them.

| Comprehension | High if labeled clearly |
| Fit | Best match to Guide’s Work & income vs Job Search distinction + existing systems |
| Risk | Needs clear CTAs and unlock explanations |

### 6.4 Recommendation (historical analysis)

**Recommend Option D for v1**, implemented without a new Employment package:

1. Work & Growth exposes two understandable actions:
   - Update my work situation → Profile Work & income (after explaining `move-to-germany` unlock if locked).
   - Find jobs → Discovery Jobs (no auto-execution).
2. Life Events may reinforce work-related next steps, but must not be a dead end with zero employment-related affordance.
3. Defer a branded “Employment module” page unless later needed (that would be a future Option B package).

This preserves Guide semantics, reconnects newcomer intent to Discovery, and avoids inventing a module that does not exist.

### 6.4a Approved Product Contract

**Status:** `APPROVED` — Option D.

**Fixed product behavior**

- Two distinct tracks from Work & Growth / Employment intent:
  - **Work & Income** = current professional/economic situation (Profile).
  - **Job Search** = active search = Discovery Jobs.
- These must not be conflated.
- Work & Income disablement must explain prerequisite / unlock path.
- Job Search must be discoverable without requiring users to know internal module names.
- No requirement to invent a new Employment module package for v1.

**Still open for implementation**

- Exact Work & Growth CTA copy and destinations.
- Whether Life Events gains an explicit employment-oriented node vs CTA-only bridges.

**Validate during implementation**

- Unlock of Work & income after `move-to-germany` completion.

### 6.5 E2E impact

`E2E-EMP-001`–`E2E-EMP-005`, `E2E-DISC-001`, possibly `E2E-DISC-003`.

### 6.6 Unknowns

- Whether filling `move-to-germany` fully unlocks Work & income in production (EMP-005 still `UNVERIFIED`).
- Whether Journey Guide missions were intended to orchestrate job search (not evidenced for Discovery profile creation).

---

## 7. PD-005 — Guided Discovery

**Status:** `APPROVED` (Option C)  
**Depends on:** PD-004 (entry path), PD-006 (created profiles must persist per contract)

### 7.1 Problem

Production shows Guided entry (`Почати супроводжуваний шлях`), but audit STEP 28 observed:

`dialog closes → same empty Discovery page`

No Discovery-specific guided multi-step process appeared.

### 7.2 Architecture facts

- The Guided control on Discovery is the **global Journey Guide welcome** (`JourneyGuideWelcome` in `apps/web/src/lib/journey-guide/JourneyGuide.tsx`), modes `guided` | `independent` — not a Discovery profile wizard.
- Real create path already exists: New profile → type → name → criteria → create (STEPs 29–35 PASS).
- Product Guide §11.1 / PR-011: Guided must actually guide, or the CTA must not imply it exists.

### 7.3 Options

#### Option A — Implement real Guided Discovery

Multi-step: what → where → constraints → delivery → review → create.

| UX | Best match to Guide |
| Complexity | High |
| Reuse | Can wrap existing profile fields |
| Consistency | Aligns with Atlas “guided journey” language if clearly Discovery-scoped |

#### Option B — Remove Guided Discovery; keep direct configuration

Remove/relabel Guided on Discovery; keep New profile.

| UX | Honest |
| Complexity | Lowest |
| Risk | Loses soft onboarding for overwhelmed users |

#### Option C — Lightweight guided overlay/wizard

Same fields as New profile, presented as short steps; creates the same profile model.

| UX | Good compromise |
| Complexity | Medium |
| Reuse | Highest — same APIs/profile model |
| Consistency | Must not reuse global Journey Guide welcome as if it were Discovery Guided |

### 7.4 Recommendation (historical analysis)

**Recommend Option C** for v1 if Guided remains labeled on Discovery; otherwise **Option B** immediately as an honesty fix.

Preferred sequencing for product-owner review:

1. Short term honesty: do not present global Journey Guide welcome as Discovery Guided (relabel or suppress on Discovery) — aligns with Option B semantics.
2. v1 product direction: ship Option C wizard that creates the same Jobs/Giveaways profile.

Do **not** keep the current misleading CTA unchanged (PR-011).

### 7.4a Approved Product Contract

**Status:** `APPROVED` — Option C.

**Fixed product behavior**

- Discovery Guided is a **lightweight wizard**, materially different from the global Journey Guide welcome dialog.
- Wizard creates the same canonical Discovery profile model as self-directed New profile.
- Guided experiences must actually guide (PR-011).
- Self-directed New profile remains available.

**Still open for implementation**

- Exact step list / field subset for Jobs vs Giveaways.
- Mid-wizard draft persistence vs discard-on-exit.

**Implementation note**

- Suppressing or disentangling Journey Guide welcome on Discovery is a prerequisite honesty fix inside this approved direction, not a separate product decision.

### 7.5 E2E impact

`E2E-DISC-002` (primary), `E2E-DISC-003`–`E2E-DISC-005`, PR-011.

### 7.6 Unknowns

- Whether Journey Guide “guided” mode was ever intended to drive Discovery missions end-to-end (no Discovery profile-creation mission evidence found).

---

## 8. PD-006 — Discovery persistence

**Status:** `APPROVED` (Option A + demo disclosure)  
**Depends on:** IAM / account availability; demo-session product honesty; PD-007 for run/result persistence

### 8.1 Problem

Audit could **not** verify cross-session persistence: fresh sessions showed no profiles. That is **not** evidence profiles were deleted.

Product Guide §11.6: Discovery profiles are persistent user assets for returning users through the normal authenticated/user session.

### 8.2 Architecture facts

- Profiles stored in SQLite with `userId` (`packages/discovery` sqlite profile persistence).
- `resolveDiscoveryUserId = accountId ?? sessionId` (`apps/api/src/discovery/discovery-user-runtime.ts`).
- Demo / anonymous usage therefore scopes profiles to **session id**.
- In-session create/list works (audit PASS).
- Fresh Playwright context ⇒ new session id ⇒ empty list is expected under session scoping.

### 8.3 Distinguish persistence models

| Model | Meaning | Fits Arrival Atlas when… |
| ----- | ------- | ------------------------ |
| Session persistence | Survives within one browser session | Demo / anonymous exploration |
| User/account persistence | Survives return visits for the same account | Authenticated newcomers (Guide promise) |
| Device/browser persistence | Local-only survival | **Not** the primary architecture (server SQLite is account/session keyed) |

### 8.4 Options

#### Option A — Account-scoped product contract

Profiles persist for authenticated accounts; demo/session profiles are session-bound and disclosed as such.

#### Option B — Session/demo-only contract

Do not promise cross-visit survival; update Product Guide accordingly.

#### Option C — Hybrid with explicit disclosure

Always persist in DB, but UI states ownership model (account vs temporary demo). Returning requires same account/session continuity.

### 8.5 Recommendation (historical analysis)

**Recommend Option A (account-scoped contract) with Option C disclosure for demo.**

Product promise for v1:

- **Authenticated / account-linked user:** Discovery profiles (and associated run summaries/results per PD-007) persist across normal return visits.
- **Demo / session-only user:** profiles may not appear in a new session; UI must not imply otherwise.

Do **not** label STEP 37/40/49/51 fresh-session emptiness as a confirmed persistence defect without an authenticated return-visit test.

### 8.5a Approved Product Contract

**Status:** `APPROVED` — Option A + explicit demo/session disclosure.

**Fixed product behavior**

- Discovery profiles are **account-scoped** when an account identity exists.
- Demo/session mode must explicitly communicate limited persistence semantics.
- Current implementation keying (`userId = accountId ?? sessionId`) is compatible with this contract but must be disclosed honestly in demo.
- This decision does **not** invent a new authentication system; it defines persistence semantics relative to existing identity.

**Still open for implementation**

- Exact demo disclosure copy and placement.
- Whether leave-demo should orphan, migrate, or delete session-scoped profiles.

**Validate during implementation**

- Authenticated return-visit E2E for `E2E-DISC-011` / `E2E-GLOBAL-006`.

### 8.6 E2E impact

`E2E-DISC-011`, `E2E-GLOBAL-006`, `E2E-RETURN-001`–`003` (Discovery subset), future authenticated E2E prerequisite.

### 8.7 Unknowns / potential BLOCKED aspects

- Production authentication state on `arrival-atlas.pro` for typical newcomers was not established by the black-box audit.
- Whether “Leave demo” orphans or deletes SQLite rows (effectively invisible either way).

If product owner requires a hard guarantee before messaging, authenticated-session evidence is still needed — recommendation stands, verification remains `UNVERIFIED`.

---

## 9. PD-007 — Discovery execution lifecycle

**Status:** `APPROVED` (explicit lifecycle + observable long-running state)  
**Depends on:** PD-006 (whose runs/results persist); worker/queue health

### 9.1 Problem

STEP 36: Run clicked once → UI `Виконується…` / equivalent for ~30s → no verified terminal state, no confirmed `/execute` visibility in capture window, no confirmed backend failure → E2E status `AMBIGUOUS`.

### 9.2 Architecture facts

Engine run statuses (`packages/discovery/src/types/run.ts`):

`PENDING | RUNNING | SUCCESS | PARTIAL_SUCCESS | FAILED | CANCELLED`

Queue job statuses include `QUEUED` / `RUNNING` (sqlite execution queue; visibility timeout default **300_000 ms**).

`run-now` API pull-processes jobs in-request (bounded iterations). UI `runNow` maps largely to `idle → running → success|error` without a continuous poll loop after response (client module).

Cancellation exists in engine types; no user-facing cancel route found in Discovery HTTP/UI.

Product Guide vocabulary:

`IDLE → QUEUED → RUNNING → SUCCESS / NO_RESULTS / ERROR`

### 9.3 Desired product lifecycle (recommendation)

Map product states to engine states:

| Product state | Engine / queue meaning | User-visible meaning |
| ------------- | ---------------------- | -------------------- |
| `IDLE` | No active run for profile | Ready to run |
| `QUEUED` | Job `QUEUED` / run `PENDING` | Waiting to start |
| `RUNNING` | `RUNNING` | Search in progress |
| `SUCCESS` | `SUCCESS` or `PARTIAL_SUCCESS` with ≥1 result | Results available (partial may show warnings) |
| `NO_RESULTS` | `SUCCESS` with zero results | Completed, nothing matched |
| `ERROR` | `FAILED` (and optionally timed-out queue failure) | Failed; recovery offered |
| `CANCELLED` | `CANCELLED` | Optional v1; only if exposed |

`PARTIAL_SUCCESS`: treat as **SUCCESS with warnings** for v1 unless product owner wants a separate badge.

### 9.4 Policy recommendations (not implementation)

| Policy | Recommendation |
| ------ | -------------- |
| Timeout | User-visible running state must resolve to SUCCESS / NO_RESULTS / ERROR within a defined bound; queue visibility timeout (~5 min) is an infrastructure ceiling — product UX should not look indefinite |
| Retry | On ERROR, offer Retry + Change criteria |
| Leave while running | Allowed; on return, show current state if persisted (PD-006) or honest “run status unknown” if session-scoped |
| Return while running | Resume observing state; do not auto-start a second run |
| Duplicate execution | Block second Run while `QUEUED`/`RUNNING` |
| Stale execution | If run exceeds timeout, surface ERROR/stale with recovery |
| Cancellation | Optional for v1; engine supports it, product UI does not yet |

### 9.5 Options summary

1. **Align product vocabulary to engine + explicit NO_RESULTS UX** (recommended).  
2. **Add async poll of run-summary/results** for long runs (architecture already has summary/results reads).  
3. **Keep single HTTP wait only** — insufficient for long-running honesty given STEP 36 ambiguity.

### 9.6 Recommendation (historical analysis)

**Recommend (1) + (2):** adopt the mapped lifecycle above, require terminal user-visible outcomes (including NO_RESULTS), and use post-run observation (poll/summary) so long runs cannot remain unexplained.

Do **not** treat STEP 36 as confirmed backend failure.

### 9.6a Approved Product Contract

**Status:** `APPROVED`.

**Fixed product behavior**

- Explicit lifecycle:

```text
IDLE → QUEUED → RUNNING → SUCCESS / NO_RESULTS / ERROR
```

- Long-running execution must remain observable and recoverable.
- SUCCESS with zero matches is **NO_RESULTS**, not ERROR and not silent success.
- Duplicate run while QUEUED/RUNNING is blocked.
- Leave/return must preserve honest run state under the PD-006 identity scope.
- Engine states (`PENDING`, `PARTIAL_SUCCESS`, `FAILED`, `CANCELLED`, queue `QUEUED`) must map into the product lifecycle above.

**Still open for implementation**

- Exact client observation mechanism (poll run-summary vs extended run-now wait).
- Whether CANCELLED is user-exposed in v1.
- How `PARTIAL_SUCCESS` is labeled (recommended: SUCCESS with warnings).

**Validate during implementation**

- Queue visibility timeout (~300_000 ms in sqlite execution queue) as infrastructure ceiling — product UX must not look indefinite.

### 9.7 E2E impact

`E2E-DISC-006`–`E2E-DISC-010`, `E2E-REC-005`, `E2E-REC-006`.

### 9.8 Unknowns

- Exact STEP 36 terminal outcome under longer wait / continuous worker.
- Whether production always runs a continuous scheduler daemon vs pull-only `run-now`.

---

## 10. Cross-decision consistency

| Interaction | Consistency rule |
| ----------- | ---------------- |
| PD-004 ↔ PD-005 | Employment path may land in Discovery; Guided Discovery must not be a fake CTA on that landing. |
| PD-004 ↔ PD-006 | Bridging to Discovery is only valuable if profiles persist per the chosen contract for returning users. |
| PD-005 ↔ PD-006 | Guided/lightweight wizard creates the same persisted profile model. |
| PD-006 ↔ PD-007 | Run/result persistence follows the same userId scoping as profiles. |
| PD-002 ↔ Benefits Simulator | ER remains planner; simulator remains assessment — avoid duplicate “economic truth” UIs. |
| PD-002 ↔ PD-001 | Planner advancement after housing depends on honest registration satisfaction/completion. |
| PD-003 ↔ Profile | Healthcare progressive enrichment may use Profile insurance, but must not hard-require every profile field. |
| PD-001 ↔ Global blocked-state rules | Completion UX must also fix explainable blocked/ready transitions (PR-001/002). |

**Cannot be finalized completely independently:**

- PD-004 destination quality depends on PD-005 honesty and PD-006/007 contracts.
- PD-002 planner correctness depends on PD-001 registration completion semantics.
- PD-007 observation UX depends on PD-006 identity scope.

---

## 11. Decision comparison table

| Decision | Problem | Approved option | Status | Depends on | Main impact |
| -------- | ------- | --------------- | ------ | ---------- | ----------- |
| PD-001 | No clear Anmeldung completion path | **B** — prepare + external guidance + user confirm | APPROVED | — | Registration COMPLETE becomes user-owned |
| PD-002 | Planner vs assessment ambiguity | **A** — Action Planner for v1 | APPROVED | PD-001 | Keeps ER focused; simulators remain separate |
| PD-003 | Empty healthcare outcomes / unclear minimum context | **D** — progressive enrichment (min = situation + clear insurance assumptions) | APPROVED | Presentation of module output | Ends unexplained empty-success |
| PD-004 | Employment intent disconnected | **D** — dual tracks: Work & income situation + Discovery Jobs search | APPROVED | PD-005/006 | Reconnects Work & Growth to Jobs without new module |
| PD-005 | Guided CTA does not guide | **C** — lightweight Guided Discovery wizard | APPROVED | PD-006 | PR-011 compliance |
| PD-006 | Unverified cross-session profiles | **A** — account-scoped contract + demo/session disclosure | APPROVED | IAM/demo model | Defines return-visit promise |
| PD-007 | Ambiguous run lifecycle | Explicit IDLE→…→SUCCESS/NO_RESULTS/ERROR + observable long runs | APPROVED | PD-006 | Makes Discovery execution understandable |

---

## 12. Implementation impact matrix

(Only impacts supported by repository analysis — not a build plan.)

| Decision | UI | Domain/state | API | Persistence | E2E | Risk |
| -------- | -- | ------------ | --- | ----------- | --- | ---- |
| PD-001 | Anmeldung inspector actions; confirm completion; external guidance | Registration satisfaction / new confirm fact; signal wiring | Profile mutation or LE action kind | Profile facts | REG/REC/ER state | False confirmation; heuristic conflict |
| PD-002 | ER remains plan-first; open_module to simulators | Plan recalculation after completed prerequisites | Existing ER plan/execute | Plan state derived from profile | ER-LOOP scenarios | Scope creep into assessment |
| PD-003 | Healthcare outcomes UX; progressive prompts | Optional profile insurance enrichment | Execute envelope already exists; recommendation projection gap | Profile health-insurance optional | HC-002…008 | Over-mandating fields |
| PD-004 | Work & Growth CTAs; unlock explanation for Work & income | No new Employment package required | Nav to Discovery / Profile | — | EMP-001…005 | Conflating situation vs search |
| PD-005 | Discovery Guided wizard or CTA removal | Same Discovery profile model | Existing profile create APIs | Same as PD-006 | DISC-002…005 | Confusion with Journey Guide welcome |
| PD-006 | Demo vs account disclosure | `userId` = accountId ?? sessionId | Discovery profile APIs | SQLite by userId | DISC-011, RETURN-* | Over-promising in demo |
| PD-007 | Lifecycle labels; NO_RESULTS; retry; block duplicate runs | Run status mapping | `run-now`, run-summary, results | Run/result stores | DISC-006…010, REC-005/006 | Long-run UX without polling |

---

## 13. E2E scenarios affected (by decision)

### PD-001

`E2E-REG-004`, `E2E-REG-005`, `E2E-REG-006`, `E2E-REG-007`, `E2E-REC-001`, `E2E-REC-002`, `E2E-GLOBAL-003` (+ secondary `E2E-ER-006`, `E2E-STATE-004`)

### PD-002

`E2E-ER-001`–`E2E-ER-007`, `E2E-GLOBAL-004`, `E2E-STATE-001`, `E2E-STATE-003`, `E2E-STATE-004`

### PD-003

`E2E-HC-002`–`E2E-HC-008`, `E2E-GLOBAL-005`, `E2E-REC-003`, `E2E-REC-004`

### PD-004

`E2E-EMP-001`–`E2E-EMP-005`, `E2E-DISC-001` (as destination)

### PD-005

`E2E-DISC-002` (primary), `E2E-DISC-003`–`E2E-DISC-005`

### PD-006

`E2E-DISC-011`, `E2E-GLOBAL-006`, `E2E-RETURN-001`–`E2E-RETURN-003` (Discovery/profile subset)

### PD-007

`E2E-DISC-006`–`E2E-DISC-010`, `E2E-REC-005`, `E2E-REC-006`

---

## 14. Open questions

| Topic | Unknown | Why it matters | Evidence that would resolve it |
| ----- | ------- | -------------- | ------------------------------ |
| PD-001 | Authoritative legal meaning of residency vs Anmeldung confirm | Avoid false COMPLETE | Product-owner + domain rule definition |
| PD-003 | Any non-projection UI path for healthcare steps | Affects urgency of normalizer work | UI code path audit / production screenshot of steps |
| PD-004 | Production unlock after completing move-to-germany | Validates Work & income track | Controlled Profile fill + re-inspect (EMP-005) |
| PD-006 | Typical auth state on production | Determines whether account persistence is reachable for newcomers | Authenticated black-box return visit |
| PD-007 | Worker/scheduler mode in production + STEP 36 true terminal | Separates UX timeout vs backend stall | Longer observation + ops diagnostics / run-summary |

None of these block issuing **recommendations**; they may block marking a decision `APPROVED` or closing related `UNVERIFIED` E2E rows.

---

## 15. Approved Product Direction

Approved for implementation planning (2026-09-07):

1. **Registration:** Atlas prepares and links out; user explicitly confirms Anmeldung completion (PD-001 Option B).
2. **Economic Reality:** Remain an action planner; fix prerequisite recognition; keep simulators separate (PD-002 Option A).
3. **Healthcare:** Minimum situation + clear insurance assumptions; progressive enrichment; never unexplained empty success (PD-003 Option D).
4. **Employment:** Dual track — Profile work situation vs Discovery job search — reachable from Work & Growth (PD-004 Option D).
5. **Guided Discovery:** Lightweight Discovery profile wizard, distinct from Journey Guide welcome (PD-005 Option C).
6. **Discovery persistence:** Account-scoped promise; honest demo/session limits (PD-006 Option A + disclosure).
7. **Discovery execution:** Explicit lifecycle including NO_RESULTS; observe long runs to a terminal state; retry on ERROR (PD-007).

**Smallest coherent v1 theme:** clarify state and next action for newcomers; reuse existing modules; avoid new packages unless necessary; prefer honesty over unfinished guided chrome.

Implementation roadmap: `tools/black-box-audit/PRODUCT-IMPLEMENTATION-PLAN-v1.md`.

---

## 16. Document control

| Field | Value |
| ----- | ----- |
| Document | Product Decisions v1 |
| Location | `tools/black-box-audit/PRODUCT-DECISIONS-v1.md` |
| Inputs | Black-box audit, Product Guide v1, E2E Product Specification v1, domain architecture |
| Approvals | PD-001…PD-007 **APPROVED** 2026-09-07 for implementation planning |
| Implementation | Planned in `PRODUCT-IMPLEMENTATION-PLAN-v1.md`; not implemented by this document |
