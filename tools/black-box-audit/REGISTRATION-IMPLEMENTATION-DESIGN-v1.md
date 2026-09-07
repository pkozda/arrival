---
id: registration-implementation-design-v1
title: Arrival Atlas — Registration Implementation Design v1 (PD-001)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-001
  - registration
  - anmeldung
  - implementation-design
created: 2026-09-07
updated: 2026-09-07
related:
  - product-decisions-v1
  - product-implementation-plan-v1
  - e2e-product-specification-v1
  - product-guide-v1
---

# Arrival Atlas — Registration Implementation Design v1 (PD-001)

## 0. Scope

**Analysis and implementation design only.** No production code, E2E tests, migrations, APIs, UI, or domain behavior were changed by this document.

**Approved contract (PD-001 Option B — not reopened):**

> Atlas prepares the user for Anmeldung, provides external guidance, and lets the user explicitly confirm completion. Atlas must not pretend to perform the municipal registration itself.

**First vertical slice:**

```text
Address available
 → Registration prerequisite satisfied
 → Prepare Anmeldung
 → External guidance
 → User explicitly confirms completion
 → Registration COMPLETE
 → Recommendations / planner recalculate
 → Life Events / Economic Reality recognize registration as satisfied
```

---

## 1. Current Registration data flow (verified)

```text
UserContextV1.profile.domains
  ├── housing.city            → hasRegistrableAddress
  └── migration.{residencyStatus, arrivedAt, countryOfOrigin}
        + benefits.daysInGermany
        ↓
computeSituationSignals()     [packages/modules/src/life-event/plan/signals.ts]
        ↓
SituationSignals
  ├── hasRegistrableAddress     (derived)
  └── isMunicipallyRegistered   (derived heuristic)
        ↓
┌───────────────────────────────┬────────────────────────────────────┐
│ Life Events                   │ Economic Reality                   │
│ isSatisfactionMet(            │ evaluateEconomicSatisfactionKeys() │
│   'municipal_registration')   │   registration_confirmed =         │
│   → isMunicipallyRegistered   │   isMunicipallyRegistered          │
│ resolveGraph()                │ node-catalog gates (g2/g3/g5/g6)   │
│   satisfied / blocked         │ buildEconomicRealityPlan()         │
└───────────────┬───────────────┴────────────────┬───────────────────┘
                ↓                                ↓
        LifeEventPlanV1                    Economic plan / action set
                ↓
        Galaxy UI + Inspector
        (GalaxyGraphInspectorBridge,
         LifeEventPlanNodeActions)
```

Plans are rebuilt from `SystemState` / `UserContext` on read:

- LE: `apps/api/src/state/life-event-plan-projection.ts` → `buildLifeEventPlan`
- ER: `buildEconomicRealityPlan` / `evaluateEconomicSatisfactionKeys`
- Client refresh after profile scope refresh: `AppProvider.refreshProfileScope` (also exposed as `refreshLifeEventPlan`)

There is **no persisted “Registration COMPLETE” fact** today.

---

## 2. `isMunicipallyRegistered` — full trace

| # | Question | Answer |
| - | -------- | ------ |
| 1 | Where defined? | `SituationSignals.isMunicipallyRegistered` in `packages/modules/src/life-event/plan/signals.ts` |
| 2 | Type? | `boolean` (in-memory derived signal only) |
| 3 | Where stored? | **Not stored.** Computed on each `computeSituationSignals(userContext)` call |
| 4 | API read/write? | No direct API. Indirectly via profile domains read into plan endpoints (`GET /api/modules/life-event/plan`, ER plan) |
| 5 | What derives Registration state? | `isSatisfactionMet('municipal_registration')` → `signals.isMunicipallyRegistered`; ER `registration_confirmed: signals.isMunicipallyRegistered` |
| 6 | When true? | `hasRegistrableAddress` (housing.city non-empty) **AND** residencyStatus present and not `unknown`/`tourist` **AND** not `reRegistrationPending` **AND** not `recentArrival` |
| 7 | Can become true without explicit Anmeldung confirmation? | **Yes.** Filling city + residency (and not being classified as recent arrival / re-reg pending) is enough |
| 8 | Authoritative or inferred? | **Inferred / system-derived.** Treated as if it were authoritative COMPLETE for satisfaction keys |
| 9 | Other consumers? | See §2.1 |
| 10 | Break risk if semantics change? | LE classification, secondary conditions, ER axes/satisfaction, banking/survival signals — see Risks |

### 2.1 Consumers of `isMunicipallyRegistered` (inspected)

| Consumer | Path | Role |
| -------- | ---- | ---- |
| LE satisfaction | `signals.ts` `isSatisfactionMet('municipal_registration')` | Marks `g1-complete-anmeldung` / related nodes satisfied |
| LE classify | `classify-life-state.ts` | Life-state branching |
| LE secondary | `detect-secondary-conditions.ts` | Secondary condition detection |
| LE signals derived | `bankingEstablished`, `survivalFoundationComplete`, `openSurvivalGapCount` | Downstream derived signals |
| ER satisfaction | `economic-reality/execution/satisfaction-keys.ts` | `registration_confirmed` |
| ER rule axes | `economic-reality/rule-engine/axes.ts` | `recentArrivalUnregistered` / survival crisis |
| ER confidence | `economic-reality/rule-engine/confidence.ts` | Confidence penalty when unregistered |

### 2.2 Catalog node for Anmeldung

`packages/modules/src/life-event/plan/graph/catalog.ts` — `g1-complete-anmeldung`:

- `satisfactionKey: 'municipal_registration'`
- `blockedByNodeIds: ['g1-secure-address']` (`registrable_address` ← city)
- Actions today: `explore_scenario` (arrival) + `correct_in_profile` (move-to-germany)
- **No** confirm-completion action
- **No** external Bürgeramt resource action (LE `LifeActionKind` has no `external_resource`)

---

## 3. Fact vs derived vs product state

### User-provided facts (persisted Profile)

| Fact | Domain | Field |
| ---- | ------ | ----- |
| City / housing | `housing` | `city`, `bundesland`, rent/utilities |
| Arrival / legal status | `migration` | `countryOfOrigin`, `residencyStatus`, `arrivedAt` |
| Days in Germany | `benefits` | `daysInGermany` (used by heuristic) |

Registry: `packages/product-contract/src/profile/field-registry.ts` — **no** Anmeldung-confirmation field.

### System-derived facts / signals

| Signal | Meaning |
| ------ | ------- |
| `hasRegistrableAddress` | city present |
| `isMunicipallyRegistered` | heuristic “looks registered” |
| `reRegistrationPending` / `recentArrival` | time/residency heuristics |
| Node `satisfied` / `blocked` | graph resolution over satisfaction keys |
| ER `registration_confirmed` | alias of heuristic |

### Product-facing states (UI)

From `GalaxyGraphInspectorBridge`:

- Completed ← `node.satisfied`
- Blocked ← `node.blocked`
- Recommended now / Future ← selection relative to primary

**Central PD-001 finding:** the architecture currently uses a **derived heuristic as if it were user-confirmed municipal registration.** That violates the approved contract.

---

## 4. Minimum correct state model

Do **not** persist the full pipeline as separate enums. Persist one authoritative confirmation fact; derive the rest.

### Recommended minimum authoritative fact

Add a migration-domain persistent fact, for example:

- `municipalRegistrationConfirmedAt?: string` (ISO datetime), **or**
- `municipalRegistrationConfirmed?: boolean`

**Product meaning:**

> The user explicitly confirmed they completed Anmeldung (address registration) with the relevant authority.

Prefer timestamp form (auditability + matches confirmation-event mental model). Exact TypeScript name is **VALIDATE DURING IMPLEMENTATION**; semantics are fixed.

### Derived product semantics (not all persisted)

| Product concept | How to derive |
| --------------- | ------------- |
| ADDRESS_AVAILABLE | `hasRegistrableAddress` (existing) |
| REGISTRATION_NOT_CONFIRMED | address available **and** confirmation fact absent |
| REGISTRATION_PREPARATION / EXTERNAL_PROCESS | UI/journey phase when actionable and unconfirmed (not separate DB states) |
| USER_CONFIRMED / REGISTRATION_COMPLETE | confirmation fact present → `municipal_registration` / `registration_confirmed` **true** |

### Satisfaction key change (authoritative)

```text
municipal_registration / registration_confirmed
  := confirmation fact present
```

**Not** `isMunicipallyRegistered` alone.

### What to do with the heuristic

Keep `isMunicipallyRegistered` as an **advisory / soft signal** if still useful for classification copy, **or** rename in code comments to avoid product confusion.

It must **not** be the sole gate for COMPLETE / `registration_confirmed` after PD-001.

Optional soft uses (non-blocking design choice):

- confidence / messaging (“you may still need to register”) when address exists but unconfirmed;
- never auto-COMPLETE LE/ER registration gates.

---

## 5. Anmeldung product semantics (wording / intent)

### Prepare Anmeldung

Atlas **explains and prepares**; it does **not** book Bürgeramt or file registration.

Reuse/extend existing content keys such as:

- `life-event.node.g1-complete-anmeldung.*` (already localized en/de/ua/ru)
- Action `life-event.action.scenario.arrival` (“Explore arrival guidance”)

Preparation includes: why it matters, deadline framing already in description, checklist-style guidance already in scenario/description where present.

Do not invent new legal requirements beyond repository/product content.

### External process

Atlas must show that Anmeldung happens **outside Atlas** with the authority (Bürgeramt / local registration office).

Implementation intent naming (suggested):

- Action label key idea: `life-event.action.external.anmeldung-guidance` — “Open official registration guidance” / localized equivalents
- Avoid labels that imply Atlas submitted registration

**Architecture note:** LE `LifeActionKind` today is only `open_module | correct_in_profile | explore_scenario` (`life-event-plan.ts`). ER already has `external_resource` templates. PD-001 needs either:

1. **Extend** `LifeActionKind` with `external_resource` (aligned with ER), or
2. **Reuse** `open_module` / internal `/resources/...` page that clearly deep-links out, or
3. **Use** `explore_scenario` only as interim preparation (weaker external framing).

Recommendation: prefer (1) or (2); do not fake government execution.

### User confirmation

User confirms:

> “I have completed Anmeldung with the relevant authority.”

Suggested mutation intent / field semantics:

- Field id: `municipalRegistrationConfirmedAt` (or boolean)
- Mutation type: existing `fact.correct` with `userConfirmationRequired: true`
- UI copy: “Confirm I completed Anmeldung” — **not** “Atlas registered you”

Avoid ambiguous “Registration completed” without clarifying **user-confirmed external completion**.

---

## 6. Address prerequisite trace

```text
housing.city
  → hasRegistrableAddress
  → g1-secure-address.satisfactionKey = registrable_address
  → g1-complete-anmeldung.blockedByNodeIds = ['g1-secure-address']
  → resolveGraph.isNodeBlocked()
  → node.blocked
  → UI “Blocked” + executionState disabled for blocked bucket
```

### Why Registration stayed non-actionable after address (audit STEPs 23–24 / 50)

Verified UI mechanisms:

1. **Plan blocking:** Anmeldung is blocked while `g1-secure-address` unsatisfied.
2. **When blocked, actions are non-interactive:** `LifeEventPlanNodeActions` renders `<span aria-disabled>` when `disabled` is true; `GalaxyGraphInspectorBridge` passes `disabled={isNodeDisabled(..., selectedNodeRef.blocked)}`. `buildExecutionSurface` marks blocked bucket as `executionState: 'disabled'`.
3. **Inspector “Blocked” section mismatch:** “No direct constraints.” is shown when **galaxy dependency edges** for the selection are empty (`inspectorSelection.dependencies`), **not** when `node.blocked` from plan is true. Context text may still explain Bürgeramt while Blocked section says no constraints — matches audit `blockedContradiction`.
4. **After address satisfied:** node should become **unblocked** and unsatisfied (if confirmation absent). If heuristic flips `isMunicipallyRegistered` true (city + residency + not recent arrival), Anmeldung can jump to **satisfied/Completed** without confirm — wrong for PD-001 and can look “done/disabled.”

### Required change for “address satisfied → Registration actionable”

1. Address prerequisite remains `hasRegistrableAddress` / `g1-secure-address` (city is the existing bar — do not invent extra required address fields unless product already requires them).
2. When address satisfied and confirmation absent: Anmeldung = **READY / Recommended** (not Blocked, not Complete).
3. Recovery actions for missing address must remain **clickable** from the blocked Anmeldung inspector (fix disabled-all-actions-when-blocked for prerequisite recovery links).
4. Blocked section must explain the real prerequisite (address), not “No direct constraints.”

---

## 7. Recommendation / planner propagation

### After confirmation mutation

```text
POST /api/mutations (fact.correct on confirmation field)
  → apply-profile-mutation / profile-engine reduce
  → SystemState.userContext.profile updated (+ revision)
  → Client refreshProfileScope()
  → GET life-event/plan + ER plan rebuild from fresh UserContext
  → computeSituationSignals + satisfaction keys
  → municipal_registration / registration_confirmed true
  → g1-complete-anmeldung.satisfied = true
  → ER registration gates clear
```

### What already exists

| Capability | Exists? | Notes |
| ---------- | ------- | ----- |
| Profile mutation + revision conflict | Yes | `apply-profile-mutation.ts`, `REVISION_CONFLICT` |
| Visible save confirmation | Yes | `ProfileCorrectionToast`, `?updated=1` |
| Plan rebuild from state | Yes | projection functions recompute on read |
| Client refresh after profile | Yes | `refreshProfileScope` |
| ER plan hash invalidation | Yes | `invalidateEconomicPlanIfHashChanged` |
| Auto push without refresh | Partial | Client must refresh scope after mutation (existing profile edit flow does) |

### What must change

- Satisfaction evaluation for registration keys must read confirmation fact.
- After LE-inspector confirm (if not using full profile editor), ensure same refresh path as Profile save.
- ER-LOOP / registration next-step depends on this (Phase 2), but PD-001 slice must at least flip `registration_confirmed`.

---

## 8. Reusable patterns (do not parallel)

| Pattern | Where | Reuse for PD-001 |
| ------- | ----- | ---------------- |
| `fact.correct` + revision | profile-engine / `apply-profile-mutation` | Confirmation mutation |
| Domain editor + toast | `DomainMutationEditor`, `ProfileCorrectionToast` | Optional Profile field UX |
| LE action links | `LifeEventPlanNodeActions` + `AtlasSecondaryLink` | Prepare / Profile / (extended) external |
| Graph resolve blocked/satisfied | `resolveGraph` | Address gate + complete gate |
| i18n node/action keys | `packages/core/src/i18n/life-event-content/*.json` | New confirm/external strings |
| ER `external_resource` | `economic-reality/.../node-action-catalog.ts` | Pattern reference for LE external guidance |
| Scenario explore arrival | catalog `arrivalScenario` | Prepare Anmeldung content |

**Do not** invent a second mutation bus for Registration confirmation.

---

## 9. UI / UX implementation design (not implemented)

Target flow:

```text
Registration
 → Why this matters
 → Current state
 → Address prerequisite
 → Prepare Anmeldung
 → External guidance
 → User confirms completion
 → Registration COMPLETE
```

| Step | Visible state | Primary action | Secondary | Nav? | Mutate? | Observable consequence | Loading / success / error / recovery |
| ---- | ------------- | -------------- | --------- | ---- | ------- | ---------------------- | ------------------------------------ |
| Why | Context/rationale from node description | — | — | Select only | No | Inspector shows why | — |
| Current state | Blocked / Ready / Complete | — | — | Select | No | Status text matches plan | — |
| Address missing | Blocked + explains address | Provide/update address (`correct_in_profile` where-you-live) | — | Yes → Profile edit | Later on save | Editor opens; after save address COMPLETE | Existing Profile mutation errors |
| Address available | Ready / Recommended | Prepare / External / Confirm | Update arrival details | Yes for links | Confirm mutates | Actions enabled | — |
| Prepare | Guidance / scenario | Explore arrival guidance | — | Yes | No | Scenario/guidance visible | — |
| External | Clear “outside Atlas” framing | Open official guidance | — | External or resources page | No | Leaves Atlas or opens guidance | — |
| Confirm | Explicit confirm control | Confirm I completed Anmeldung | Cancel | No (or Profile) | Yes `fact.correct` | Toast + status Complete + plan refresh | Preserve revision conflict handling; no false Complete |
| Complete | Completed | Edit/correct if needed | — | Optional | Only on correction | Downstream nodes unlock | Leave/return keeps Complete |

### E2E-GLOBAL-003 requirements

- Blocked status true ⇒ explain **why** (address), **prerequisite**, **actionable recovery link** (interactive).
- Never present “No direct constraints” as the explanation for a blocked Anmeldung.
- Do not disable prerequisite recovery actions merely because Anmeldung is blocked.

---

## 10. Selection vs navigation vs mutation

| Interaction | Type |
| ----------- | ---- |
| Click Anmeldung graph node | **Selection** → inspector update |
| Update housing / arrival Profile links | **Navigation** + later **mutation** on save |
| Explore arrival guidance | **Navigation** (scenario) |
| Open official guidance | **External link** / resources navigation |
| Confirm Anmeldung completion | **State mutation** (`fact.correct`) |
| Show route / non-action chrome | Must remain non-pretend; no silent no-ops |

Do **not** turn node selection into navigation to “fix” the journey.

---

## 11. Recovery design

| Case | Behavior |
| ---- | -------- |
| A. No address | Blocked; explain address missing; interactive Provide address |
| B. Address available | Unblocked; Prepare + External + Confirm available |
| C. Opens preparation | Guidance visible; still unconfirmed |
| D. Leaves before confirm | Remains unconfirmed; no COMPLETE |
| E. Returns later | Same Ready/unconfirmed state understandable |
| F. Completes external process | Still requires explicit Atlas confirmation |
| G. Confirms | COMPLETE; LE/ER recognize satisfaction |
| H. Mutation fails | No COMPLETE; show existing mutation error (`REVISION_CONFLICT`, validation, etc.); retry |

---

## 12. E2E traceability (first gate)

| Scenario | Current production | Desired | Capability required | Likely test surface |
| -------- | ------------------ | ------- | ------------------- | ------------------- |
| `E2E-REG-004` | Address may unlock node; heuristic may auto-satisfy or actions stay unclear | After address, Anmeldung actionable if unconfirmed | Satisfaction ≠ heuristic; actions enabled when Ready | LE module UI + plan API |
| `E2E-REG-005` | Prepare ≈ scenario/profile only; weak external framing | Prepare + clear external guidance | External action kind or resources link + copy | LE inspector actions |
| `E2E-REG-006` | No confirm path | Explicit confirm → COMPLETE | New fact + mutation + satisfaction wiring | Mutations API + LE/ER plan |
| `E2E-REG-007` | Leave/return preserves selection; recovery unclear | Preserve state **and** actionable recovery | Interactive actions + explainable blocked | LE leave/return UI |
| `E2E-REC-001` | Blocked + “No direct constraints” + disabled actions | Explain + recover | Inspector + action enablement fix | LE inspector |
| `E2E-REC-002` | State preserved; recovery still unclear | Same as REC-001 after return | Persistence of profile facts + UI | LE session return |
| `E2E-GLOBAL-003` | Fails on Anmeldung | Pass | Blocked explanation + recovery | Cross-cutting inspector |

**Outside first gate but dependent:** `E2E-ER-006`, `E2E-STATE-004`, `E2E-GLOBAL-004` (planner progression after registration confirm — Phase 2).

Do not modify tests in this task.

---

## 13. File-level implementation map

| Area | Existing file/module | Current responsibility | Required change | Class | Risk |
| ---- | -------------------- | ---------------------- | --------------- | ----- | ---- |
| Signals | `packages/modules/src/life-event/plan/signals.ts` | Derives `isMunicipallyRegistered`; maps `municipal_registration` | Satisfaction for registration must use confirmation fact | MUST CHANGE | HIGH — many consumers |
| Domain types | `packages/product-contract/src/profile/domain-field-types.ts` | Migration fields | Add confirmation field | MUST CHANGE | MEDIUM |
| Field registry | `packages/product-contract/src/profile/field-registry.ts` | Persistent fact IDs | Register new field + confirmationRequired | MUST CHANGE | MEDIUM |
| Profile view schema | `user-profile-view.ts` / migration schema | Domain projection | Include new field | MUST CHANGE | MEDIUM |
| LE catalog | `packages/modules/src/life-event/plan/graph/catalog.ts` | Anmeldung actions | Add external + confirm actions | MUST CHANGE | MEDIUM |
| LifeActionKind | `packages/product-contract/src/profile/life-event-plan.ts` | Action kinds | Possibly add `external_resource` | LIKELY CHANGE | MEDIUM |
| ER satisfaction | `packages/modules/src/economic-reality/execution/satisfaction-keys.ts` | `registration_confirmed` | Gate on confirmation fact | MUST CHANGE | HIGH |
| Classify / secondary | `classify-life-state.ts`, `detect-secondary-conditions.ts` | Uses heuristic | Decide advisory vs authoritative | VALIDATE DURING IMPLEMENTATION | HIGH |
| ER axes/confidence | `rule-engine/axes.ts`, `confidence.ts` | Uses heuristic | Keep soft or align carefully | VALIDATE DURING IMPLEMENTATION | MEDIUM |
| Graph resolve | `graph/resolve.ts` | blocked/satisfied | REUSE AS-IS once keys fixed | REUSE AS-IS | LOW |
| Plan build | `build-life-event-plan.ts` | Orchestrates plan | REUSE AS-IS | REUSE AS-IS | LOW |
| Mutations | `apps/api/src/state/apply-profile-mutation.ts` | Commit facts | REUSE AS-IS for confirm | REUSE AS-IS | LOW |
| Profile editor defs | `domain-field-definitions.ts` | move-to-germany fields | Optionally expose confirm field | LIKELY CHANGE | LOW |
| Inspector bridge | `GalaxyGraphInspectorBridge.tsx` | Status/Blocked/Actions | Explain blocked; don’t claim no constraints | MUST CHANGE | HIGH |
| Node actions | `LifeEventPlanNodeActions.tsx` | Renders links vs disabled spans | Allow prerequisite recovery when blocked | MUST CHANGE | HIGH |
| Execution adapter | `life-event-plan/execution/adapter.ts` | Blocked → disabled | Revisit disabling recovery actions | MUST CHANGE | HIGH |
| i18n | `packages/core/src/i18n/life-event-content/{en,de,ua,ru}.json` | Anmeldung strings | Add confirm/external keys; fix hardcoded EN inspector chrome | MUST CHANGE | MEDIUM |
| App refresh | `AppProvider.tsx` | refreshProfileScope | REUSE AS-IS after confirm | REUSE AS-IS | LOW |
| E2E | `apps/web/tests/e2e/*`, API e2e | Existing LE/ER | Extend for gate scenarios later | LIKELY CHANGE (later) | MEDIUM |

Only files actually inspected are listed.

---

## 14. API / data contract impact

| Concern | Impact |
| ------- | ------ |
| Mutation endpoint | **Reuse** `POST /api/mutations` / existing profile mutation pipeline |
| Request payload | New field id in `fact.correct` deltas |
| Response | Existing revision + profile projection |
| Persistence schema | New persistent fact in migration domain (profile document / event log) — **migration may be needed** for typed registry; explain in implementation, do not create here |
| Revision handling | Preserve existing `REVISION_CONFLICT` |
| Read models | LE/ER plans automatically reflect new fact on rebuild |
| Cache | Client profile-scope refresh; ER hash invalidation already present |
| New Registration API | **Not required** if confirmation is a Profile fact |

---

## 15. Localization impact

| Item | Observation |
| ---- | ----------- |
| Existing Anmeldung keys | Present in en/de/ua/ru under `life-event.node.g1-complete-anmeldung.*` and action keys for arrival/profile |
| Hardcoded EN inspector chrome | “Blocked state”, “No direct constraints.”, “No direct unlocks.”, “Completed”, “Context”, “Actions” in `GalaxyGraphInspectorBridge.tsx` / Profile bridges — contributes to CROSS-UX-001 |
| New strings needed | Confirm action label; external guidance label; confirmation field label/help; blocked-prerequisite explanation |
| Reuse | Node title/description/rationale already localized |

Do not modify translation files in this task.

---

## 16. Implementation sequence (PD-001)

### Step 1 — Authoritative confirmation semantics

- **Goal:** Define confirmation fact; map `municipal_registration` / `registration_confirmed` to it
- **Modules:** field-registry, domain-field-types, signals satisfaction mapping, ER satisfaction-keys
- **Deps:** none
- **User-visible:** none yet (or tests only)
- **Acceptance:** Without confirm fact, registration keys false even if heuristic true

### Step 2 — Address prerequisite correctness + explainable blocked UX

- **Goal:** Address missing ⇒ blocked with actionable Provide address; address present ⇒ Ready
- **Modules:** GalaxyGraphInspectorBridge, LifeEventPlanNodeActions, execution adapter, resolve (reuse)
- **Deps:** Step 1 preferred for Complete semantics
- **User-visible:** E2E-GLOBAL-003 / REC-001 path improves
- **Acceptance:** Blocked Anmeldung shows why + clickable address recovery; no false “No direct constraints”

### Step 3 — Preparation + external guidance actions

- **Goal:** Prepare + external guidance visible when Ready
- **Modules:** LE catalog actions; possibly LifeActionKind; i18n
- **Deps:** Step 2
- **User-visible:** E2E-REG-005
- **Acceptance:** External framing clear; Atlas does not claim to register

### Step 4 — Explicit confirmation mutation UX

- **Goal:** User can confirm; mutation uses fact.correct; toast/refresh
- **Modules:** LE inspector confirm control and/or Profile field; mutations reuse
- **Deps:** Step 1
- **User-visible:** Confirm control
- **Acceptance:** Failed mutation ≠ COMPLETE; success ⇒ Complete status

### Step 5 — Propagation verification

- **Goal:** LE + ER recognize COMPLETE after refresh
- **Modules:** plan projections (reuse), AppProvider refresh, ER hash
- **Deps:** Step 4
- **User-visible:** Downstream unlocks / registration gate clears
- **Acceptance:** Plans show satisfied registration; no heuristic-only COMPLETE

### Step 6 — Leave/return recovery polish

- **Goal:** E2E-REG-007
- **Modules:** same UI; profile persistence already session/account scoped
- **Deps:** Steps 2–5
- **Acceptance:** Return shows same understandable state + next action

### Step 7 — E2E coverage extension

- **Goal:** Automate first gate
- **Modules:** `apps/web/tests/e2e`, API e2e — **later task**
- **Deps:** Steps 1–6
- **Acceptance:** Gate scenarios green without weakening Product Spec

---

## 17. Risks

| Risk | Class |
| ---- | ----- |
| Changing satisfaction away from `isMunicipallyRegistered` breaks classify/ER axes/fixtures | **HIGH** |
| Leaving heuristic as COMPLETE gate (false-positive COMPLETE) | **BLOCKING** for PD-001 contract |
| Confusing address completeness with municipal registration | **HIGH** |
| Duplicate state (UI-only COMPLETE vs domain) | **HIGH** |
| Stale LE/ER after confirm without refresh | **MEDIUM** |
| Disabling all actions when blocked blocks recovery | **HIGH** (current behavior) |
| Extending LifeActionKind / contract churn | **MEDIUM** |
| Localization regression / hardcoded EN inspector | **MEDIUM** |
| API backward compatibility for profile shape | **MEDIUM** |
| External-process wording implying Atlas filed Anmeldung | **HIGH** |

---

## 18. Definition of Done (PD-001)

### State

- Registration COMPLETE requires explicit user confirmation fact.
- Address availability ≠ registration completion.
- Heuristic cannot alone mark Registration COMPLETE / `registration_confirmed`.

### UX

- Blocked explains why + prerequisite + actionable recovery.
- Preparation understandable; external process clearly external.
- Confirmation explicit; completion visibly confirmed.
- Leave/return preserves understandable state.

### Propagation

- After confirm + refresh, LE Anmeldung satisfied; ER `registration_confirmed` true; dependent gates can clear.

### Reliability

- Failed mutation cannot yield COMPLETE; revision conflicts preserved.

### E2E

Clear implementation path for `E2E-REG-004…007`, `E2E-REC-001/002`, `E2E-GLOBAL-003`.

---

## 19. Final recommendation

1. **Minimal architecture change:** Add one migration-domain confirmation fact; make `municipal_registration` / `registration_confirmed` depend on it; keep address via existing `hasRegistrableAddress`; fix blocked inspector so recovery actions stay interactive and explanations are honest; add prepare/external/confirm actions on `g1-complete-anmeldung`.
2. **Exact first implementation step:** Step 1 — wire authoritative confirmation semantics into field registry + satisfaction keys (heuristic demoted).
3. **Most likely files:** `signals.ts` (satisfaction mapping), `satisfaction-keys.ts`, `field-registry.ts` / `domain-field-types.ts`, `catalog.ts`, `GalaxyGraphInspectorBridge.tsx`, `LifeEventPlanNodeActions.tsx`, `execution/adapter.ts`, i18n life-event-content.
4. **Reuse:** Profile `fact.correct` mutation pipeline, plan rebuild-on-read, `refreshProfileScope`, existing Anmeldung i18n node copy, arrival scenario action.
5. **Biggest risk:** Broad consumers of `isMunicipallyRegistered` — change satisfaction gates carefully; keep heuristic advisory only.
6. **First E2E gate:** `E2E-REG-004…007`, `E2E-REC-001/002`, `E2E-GLOBAL-003`.
7. **Blocking technical unknowns:** None that block design. **VALIDATE DURING IMPLEMENTATION:** exact field id/shape; whether LifeActionKind gains `external_resource` vs resources page; how aggressively classify-life-state should stop using the heuristic.

PD-001 remains **APPROVED** and is not reopened.

---

## Document control

| Field | Value |
| ----- | ----- |
| File | `tools/black-box-audit/REGISTRATION-IMPLEMENTATION-DESIGN-v1.md` |
| Contract | PD-001 Option B APPROVED |
| Code/E2E changes | None |
