---
id: ux-contract-v2
title: UX Contract v2 — Mutation Semantics Layer
project: Arrival Atlas
system: Arrival Atlas
type: contract
domain: product
status: draft
maturity: proposed
owner: system
tags:
  - ux-boundaries
  - mutation-semantics
  - profile-correction
  - source-of-truth
  - three-surface-model
created: 2026-06-19
updated: 2026-06-19
related:
  - ux-contract-v1
  - profile-ux-spec
  - profile-system-v1-roadmap
  - profile-mutation-model-v1
  - profile-ux-design-prompt
---

# UX Contract v2 — Mutation Semantics Layer

**Document type:** UX architecture contract (enforcement reference)  
**System:** Arrival Atlas  
**Version:** 2.0 (draft)  
**Status:** Proposed — extends [UX Contract v1](./ux-contract-v1.md); requires ADR before implementation  
**Scope:** Mutation authority, typed fact changes, correction vs scenario separation, source-of-truth rules, lifecycle. Applies to Home, Modules, Profile surfaces and the Mutation Layer they invoke.

**Supersedes (partially):** Informal correction guidance in [profile-ux-spec.md](../identity/profile-ux-spec.md) §6.4 where this contract is stricter.  
**Does not replace:** [UX Contract v1](./ux-contract-v1.md) surface separation, leak prevention (§4), or terminology (§6). v2 **adds** write semantics; v1 rules remain in force unless explicitly amended here.

---

## 0. Contract Summary

UX Contract v1 locked **who shows what**. UX Contract v2 locks **how reality changes**.

```text
                    READ PLANE (v1)                    WRITE PLANE (v2)
┌──────────────────────────────────────────────────────────────────────────┐
│  HOME          MODULES              PROFILE                                 │
│  orient        decide + capture     mirror + explain                        │
│  (read)        (read + write)       (read + intent only)                  │
└───────┬──────────────┬──────────────────┬─────────────────────────────────┘
        │              │                  │
        │              ▼                  ▼
        │         ┌─────────────────────────────────────┐
        │         │         MUTATION LAYER              │
        │         │  validate · merge · audit · project │
        │         └─────────────────┬───────────────────┘
        │                           │
        │                           ▼
        │              Persistent stores (authoritative)
        │              ┌──────────────┬─────────────────┐
        │              │ ProfileDocument │ Session prefs │
        │              │ (domain facts)  │ (chrome only) │
        │              └──────────────┴─────────────────┘
        │                           │
        └───────────────────────────┴──► UiSnapshot projection (read model)
                                         Home + Profile refresh
```

**Core principle (v2):**

> **No surface directly mutates authoritative state.** Surfaces emit **typed mutation intents**; the **Mutation Layer** is the sole write authority.

**Relationship to v1:**

| v1 rule | v2 extension |
|---------|--------------|
| Profile read-only in UI | Profile may **request** corrections; it never **applies** them |
| Modules write via execution | Module writes are **`fact.create` / `fact.update`** via `MODULE_EXECUTE` pipeline only |
| Home never persists domain facts | Home may emit **`fact.suggest`** (navigation/rules only); never **`fact.*` persistence** |
| No scenario data in Profile | Scenarios remain **module-local execution input**; never promoted to ProfileDocument |

---

## 1. Mutation Authority Model

### 1.1 Authority tiers

| Tier | Role | May mutate authoritative state? |
|------|------|--------------------------------|
| **T0 — Surfaces (Home, Modules, Profile UI)** | Collect input; display projections | **No** — emit intents only |
| **T1 — Mutation Layer** | Validate, merge, audit, project | **Yes** — sole write authority |
| **T2 — Module runtime** | Execute decisions; produce activation patches | **Indirect** — patches applied only when Mutation Layer accepts `MODULE_EXECUTE` |
| **T3 — Profile engine** | Merge policy, revisioning, domain validation | **Indirect** — invoked by Mutation Layer for `PROFILE_UPDATE` paths |

### 1.2 Per-surface authority

#### Home

| Operation | Allowed | Forbidden |
|-----------|---------|-----------|
| **Create facts** | ❌ | Any domain fact write |
| **Update facts** | ❌ | PATCH profile, session domain fields, module execute |
| **Propose corrections** | ❌ (persistent) | Correction forms, save buttons |
| **Suggest next actions** | ✅ | Rule-based module links, checklist dismiss (localStorage only) |

Home **never** enters the Mutation Layer as a write initiator for domain facts.

#### Modules

| Operation | Allowed | Forbidden |
|-----------|---------|-----------|
| **Create facts** | ✅ (primary) | Direct ProfileDocument access from web |
| **Update facts** | ✅ (primary) | Bypassing activation maps / execute pipeline |
| **Propose corrections** | ✅ | N/A — module input IS the proposal |
| **Correct prior facts** | ✅ (conditional) | Silent overwrite without user submit on execute |

Modules are the **primary write surface** for new and re-captured facts. A module write occurs **only** when the user submits module input and `MODULE_EXECUTE` completes with profile activation (or explicit future domain mutation types routed through the same pipeline).

#### Profile

| Operation | Allowed | Forbidden |
|-----------|---------|-----------|
| **Create facts** | ❌ | Empty-domain "add field" without Mutation Layer |
| **Update facts (direct)** | ❌ | Client-side `PATCH /api/profile`, direct `PROFILE_UPDATE` from Profile route |
| **Propose corrections** | ✅ | **`fact.suggest_correction`** / confirmed **`fact.correct`** via Mutation Layer |
| **Correct prior facts** | ✅ (mediated) | Inline save that bypasses validation or audit |

Profile UI is a **correction intent builder**, not a CRUD editor. "Save" on Profile means **submit a mutation request**, not **write the store**.

#### System (server / coordinator)

| Operation | Allowed | Forbidden |
|-----------|---------|-----------|
| **Merge decisions** | ✅ | User-visible merge without audit entry |
| **Invalidate stale facts** | ✅ (future) | Silent deletion without provenance |
| **Project read models** | ✅ | Leaking engine types to UI |

### 1.3 Mutation Layer (required abstraction)

v2 **requires** an explicit **Mutation Layer** between surfaces and persistent stores.

**Responsibilities (mandatory):**

1. Accept **typed mutation requests** from authorized initiators
2. Run **domain validation** (schema, policy, revision concurrency)
3. Apply **deterministic merge rules** via profile engine
4. Append **audit trail** (revision + provenance)
5. Emit **snapshot version increment** for read-plane refresh

**Implementation mapping (current codebase):**

| Mutation Layer concern | Current anchor |
|------------------------|----------------|
| Coordinator | `SystemState` mutation coordinator (`applyMutation`) |
| Typed system mutations | `SystemMutation` union in `system-mutation-types.ts` |
| Module → profile write | `MODULE_EXECUTE` + `moduleInputToProfilePatch()` |
| Profile direct update | `PROFILE_UPDATE` (must not be called from Profile UI in v2) |
| Session chrome | `SESSION_PATCH` (language, theme) |

v2 does **not** require renaming existing types immediately. It requires **semantic alignment**: all new Profile correction flows map to product-level mutation types before reaching `PROFILE_UPDATE`.

### 1.4 Default rule (resolved)

> **Profile UI does NOT directly mutate state.**

Any future exception requires **UX Contract v2 amendment + ADR** (e.g. offline draft queue — not in scope).

---

## 2. Mutation Types

Mutations are **typed intents**, not CRUD. Product-level types are **semantic**; transport may map to `SystemMutation` variants.

### 2.1 Type catalog

| Type | Meaning | Initiator | Persistent | User confirmation | Snapshot refresh |
|------|---------|-----------|------------|-------------------|------------------|
| **`fact.create`** | Introduce a new domain fact not previously stored | Module (execute) | ✅ | Implicit on execute submit | Immediate |
| **`fact.update`** | Replace or refine an existing fact from new module input | Module (execute) | ✅ | Implicit on execute submit | Immediate |
| **`fact.correct`** | User-initiated fix of stored fact without re-running full module flow | Profile (via Mutation Layer) | ✅ | **Explicit Save** required | Immediate on accept |
| **`fact.invalidate`** | Mark fact as withdrawn / unknown (clear field) | Profile or System | ✅ | Explicit confirm for user-initiated | Immediate |
| **`fact.suggest_correction`** | Profile UI drafts correction; not yet authoritative | Profile | ❌ (until promoted) | Required before promotion | None until promoted |
| **`pref.update`** | Session chrome (language, theme, UI density) | Header / Profile prefs | ✅ | Immediate or explicit per field | Immediate |
| **`onboarding.update`** | Checklist / FTU progression flags | Home dismiss + System | ✅ | Dismiss = implicit | Immediate |
| **`fact.suggest`** | Rule-based "you might want to…" (navigation only) | Home | ❌ | N/A | N/A |

**Not mutation types (forbidden as Profile persistence):**

- `scenario.run`, `scenario.input`, `what_if.*` — module execution input only
- `crud.profile.patch` — raw PATCH from Profile UI (forbidden)

### 2.2 Type semantics (enforceable)

#### `fact.create`

- **Trigger:** First module execution writes a domain field via activation map
- **Validation:** Module input schema + activation map + `ProfilePatchSchema`
- **Merge:** Field-level insert; empty → value
- **Provenance:** `{ source: 'module', moduleId, executionId, at }`
- **Affects Home:** Yes — next snapshot projection

#### `fact.update`

- **Trigger:** Subsequent module execution overwrites overlapping activation-mapped fields
- **Validation:** Same as create
- **Merge:** Domain-scoped patch merge (deterministic, last accepted mutation wins per field with revision guard)
- **Provenance:** Module execution metadata
- **Conflict:** See §5 — module re-run with newer execution timestamp competes with `fact.correct` by policy (§5.3)

#### `fact.correct`

- **Trigger:** User confirms Profile section save
- **Validation:** Domain validator in Mutation Layer (human field map → `ProfilePatch`); **same validators as module path where fields overlap**
- **Merge:** Profile engine merge + revision check (`expectedRevision`)
- **Provenance:** `{ source: 'profile-correction', domainSlug, at }`
- **UI copy:** *"Your situation was updated"* — never *"Profile saved"*

#### `fact.invalidate`

- **Trigger:** User clears a field or marks "I don't know anymore"
- **Validation:** Must not leave domain in inconsistent illegal state (engine constraint)
- **Merge:** Set field absent / null per engine rules
- **Use:** Rare; prefer explicit empty over silent delete

#### `fact.suggest_correction`

- **Trigger:** User enters Profile edit mode, edits fields, **before Save**
- **Persistent:** **No** — client draft state only
- **Promotion:** On Save → becomes `fact.correct` request to Mutation Layer
- **Rejection path:** Validation failure → user stays in edit mode; no partial persist
- **Alternative path:** Coordinator may reject and recommend module re-run (see §7)

#### `pref.update`

- **Scope:** `session.context.userProfile` — language, theme, uiDensity
- **Not domain facts:** Does not change employment, rent, benefits
- **Language sync:** Canonical policy per [profile-system-v1-roadmap.md](../identity/profile-system-v1-roadmap.md) P1 — `SESSION_PATCH` + optional `profile.preferredLanguage` sync via Mutation Layer rule

#### `fact.suggest`

- **Scope:** Home suggestions, onboarding checklist links
- **Effect:** Navigation only — **no API mutation** for domain facts

### 2.3 Initiator matrix (normative)

| Mutation type | Home | Modules | Profile UI | System |
|---------------|------|---------|------------|--------|
| `fact.create` | ❌ | ✅ | ❌ | ❌ |
| `fact.update` | ❌ | ✅ | ❌ | ❌ |
| `fact.correct` | ❌ | ❌ | ✅ (request) | ❌ |
| `fact.invalidate` | ❌ | ❌ | ✅ (request) | ✅ (maintenance) |
| `fact.suggest_correction` | ❌ | ❌ | ✅ (draft) | ❌ |
| `pref.update` | ❌ | ❌ | ✅ (request) | ❌ |
| `onboarding.update` | ✅ (dismiss only) | ❌ | ❌ | ✅ |
| `fact.suggest` | ✅ | ✅ (in results copy) | ✅ (empty-state CTAs) | ❌ |

---

## 3. Surface Responsibility Matrix

### 3.1 Operations matrix (refined)

| Surface | Read authoritative facts | Write authoritative facts | Suggest (non-persistent) | Correct (persistent) |
|---------|--------------------------|----------------------------|--------------------------|----------------------|
| **Home** | ✅ aggregated projection only | ❌ **never** | ✅ rules + links only | ❌ **never** |
| **Modules** | ✅ prefill + context | ✅ **primary** (`fact.create/update`) | ✅ in-result guidance | ✅ **only** by re-execute with new input |
| **Profile** | ✅ full mirror projection | ❌ **no direct write** | ✅ empty-state → module CTAs | ✅ **mediated** (`fact.correct` via Mutation Layer) |
| **Mutation Layer** | ✅ (for merge context) | ✅ **sole applier** | ❌ | ✅ adjudicates corrections |
| **Header** | ✅ prefs projection | ✅ `pref.update` only | ❌ | ❌ |

### 3.2 Read vs write coupling rules

| Rule ID | Statement |
|---------|-----------|
| **M1** | Home read plane MUST NOT depend on Profile route being mounted |
| **M2** | Module write plane MUST NOT depend on Profile edit UI |
| **M3** | Profile correction MUST NOT bypass module validation rules for shared fields |
| **M4** | No surface may call `ProfileEngine.updateProfile` except through Mutation Layer |
| **M5** | Dual-write (Module + Profile UI saving same field in same session without merge) is **forbidden** — coordinator serializes |

### 3.3 Profile edit (UX-P3) position in matrix

Profile edit is **`fact.suggest_correction` → `fact.correct`**, not **Update Profile API from browser**.

```text
Profile Edit Mode (client draft)
        │
        │  [Save] ──► MutationRequest { type: fact.correct, domain, patch, expectedRevision }
        │
        ▼
Mutation Layer ──► validate ──► PROFILE_UPDATE ──► revision + snapshot++
        │
        ▼
Profile read mode ← Home summary refresh
```

**Cancel** discards draft — no `fact.suggest_correction` residue in store.

---

## 4. Correction vs Scenario Separation

### 4.1 Definitions

| Concept | Definition | Storage | Lifetime |
|---------|------------|---------|----------|
| **Persistent fact** | User's asserted real-world situation (rent, employment, coverage) | `ProfileDocument` | Until corrected or invalidated |
| **Scenario input** | Hypothetical or exploratory input for a decision run | Module execution request body + optional session-scoped execution cache | **Ephemeral** — current or recent run only |
| **Module result** | Computed outcome of a scenario/decision | Execution record + projection | Historical display; not a substitute for facts |

### 4.2 Critical rule

> **Profile is not a scenario system.**

Scenario inputs **MUST NOT** be written to `ProfileDocument` by activation maps or Profile correction.

**Canonical examples:**

| Input | Classification | Store |
|-------|----------------|-------|
| Current gross income | Persistent fact | ProfileDocument.employment |
| Monthly rent | Persistent fact | ProfileDocument.housing |
| `proposedGrossIncome` (what-if job offer) | Scenario | Module input only |
| Comparison toggles, slider experiments | Scenario | Module UI state only |
| Bürgergeld eligibility **estimate** from run | Module result | Execution projection — not Profile fact |
| User confirms "I actually earn X now" | Persistent fact | `fact.correct` or module re-run |

### 4.3 Separation diagram

```text
┌──────────────────────── MODULE SESSION ────────────────────────┐
│  Form input                                                    │
│    ├── committed facts ──────► activation map ──► Mutation Layer│
│    └── scenario fields ──────► execute only ──► result/projection│
│                                      │                           │
│                                      ✕ never ────────────────────┼──► ProfileDocument
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────── PROFILE CORRECTION ──────────────────────┐
│  Edit section → fact.correct ──► Mutation Layer ──► ProfileDocument│
│                                      ✕ never scenario fields      │
└──────────────────────────────────────────────────────────────────┘
```

### 4.4 Enforcement

| # | Rule |
|---|------|
| **SC1** | Activation maps MUST declare `persists: true` per field mapping; scenario fields omitted |
| **SC2** | Profile domain editors MUST NOT expose scenario-only fields (e.g. proposed income) |
| **SC3** | Re-running a module with scenario values MUST NOT overwrite Profile facts unless mapped as persistent |
| **SC4** | UI copy for scenarios: *"This run explores a scenario — it won't change your saved situation unless you confirm"* |

---

## 5. Source of Truth Rules

### 5.1 Authoritative stores

| Domain data | Source of truth | Write path | Read projection |
|-------------|-----------------|------------|-----------------|
| **Employment** (status, income) | `ProfileDocument.employment` | Module activation, `fact.correct` | `UserProfileViewV1.domains.employment` |
| **Housing** (rent, location) | `ProfileDocument.housing` + location | Module activation, `fact.correct` | Profile mirror + Home headline (aggregated) |
| **Household** | `ProfileDocument.household` | Module activation, `fact.correct` | Profile mirror |
| **Benefits status** | `ProfileDocument.benefits` | Module activation, `fact.correct` | Profile mirror |
| **Insurance** | `ProfileDocument.insurance` | Module activation, `fact.correct` | Profile mirror |
| **Residency / move** | `ProfileDocument` residency fields | Module activation, `fact.correct` | Profile mirror |
| **Language preference** | **Session** `userProfile.language` (canonical v2 policy); mirrored to `profile.preferredLanguage` via sync rule | `pref.update` / `SESSION_PATCH` | Header + Profile Language section |
| **Theme / UI density** | Session `userProfile.uiPreferences` | `pref.update` | Header + Profile prefs |
| **Module results** | Execution store | `MODULE_EXECUTE` | Home recent results, module page |
| **Onboarding progress** | Explicit onboarding state (P2) + dismiss flags | `onboarding.update` | Home checklist |

Home and Profile UI are **never** sources of truth — only projections.

### 5.2 Conflict resolution

When module output conflicts with existing profile data:

| Conflict | Resolution policy |
|----------|-------------------|
| Same field, new module execute vs older stored value | **Module execute wins** for activation-mapped fields (user just submitted) |
| Same field, `fact.correct` vs older module activation | **`fact.correct` wins** (explicit user correction supersedes inferred activation) |
| Same field, two modules write overlapping domains | **Last accepted mutation wins** per field, revision-monotonic; provenance records both module IDs |
| Module result contradicts profile (display only) | **Do not auto-correct profile** — show explanation; suggest re-run or Profile correction |
| Language session vs profile preferredLanguage | **Mutation Layer sync rule** — single canonical value after `pref.update` |

### 5.3 Determinism requirement

Merge MUST be **deterministic and rule-based** — not ML, not heuristic inference in UI.

- Merge engine: `@arrival-atlas/profile` policy + patch merge
- UI MUST NOT implement merge logic
- Conflict policies above are **code-enforced** in Mutation Layer, not user-selectable

### 5.4 Non-goals

- Profile does **not** drive module algorithm outcomes (v1 research constraint preserved)
- Profile completeness scores do **not** mutate facts
- Home suggestions do **not** write facts

---

## 6. Mutation Lifecycle

### 6.1 End-to-end flow

```text
┌──────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│  User    │───►│   Surface   │───►│   Mutation   │───►│   Merge +   │───►│ Snapshot │
│  action  │    │   intent    │    │   validate   │    │   audit     │    │ project  │
└──────────┘    └─────────────┘    └──────────────┘    └─────────────┘    └────┬─────┘
                                                                                 │
                     ┌───────────────────────────────────────────────────────────┘
                     ▼
              Home / Profile / Module prefill refresh (read plane)
```

### 6.2 Stage responsibilities

| Stage | Where | Responsibility |
|-------|-------|----------------|
| **1. User action** | Surface UI | Collect input; no store access |
| **2. Intent construction** | Surface client | Build `MutationRequest` (typed); Profile builds `fact.correct` draft → request on Save |
| **3. Transport** | Web API | Authenticated session; If-Match revision for corrections |
| **4. Validation** | Mutation Layer | Schema, policy, revision, domain rules, scenario field rejection |
| **5. Merge decision** | Profile engine (invoked by layer) | Deterministic patch merge |
| **6. Audit** | Profile engine | Append `ProfileRevision`; record provenance |
| **7. Snapshot update** | Snapshot projection | Increment `snapshotVersion`; project `UserContextV1` |
| **8. Read refresh** | Web AppProvider | Home summary, Profile mirror, module prefill |

### 6.3 Path A — Module write (primary)

```text
User submits module form
  → MutationRequest { via: MODULE_EXECUTE, input }
  → Module runtime execute
  → moduleInputToProfilePatch() → optional ProfilePatch
  → Mutation Layer apply MODULE_EXECUTE + conditional PROFILE_UPDATE
  → audit + snapshot++
  → Module result UI + toast ("Saved to your situation" if activated)
```

### 6.4 Path B — Profile correction (mediated)

```text
User opens Profile section edit
  → client draft (fact.suggest_correction)
User taps Save
  → MutationRequest { type: fact.correct, domain, patch, expectedRevision }
  → Mutation Layer validate (same field rules as modules)
  → PROFILE_UPDATE
  → audit + snapshot++
  → Profile read mode + confirmation toast
  → optional copy: "Your next [Tool] visit will use this information"
```

**Validation failure:** no partial write; user sees human inline errors — not schema keys.

**Coordinator rejection (policy):** If correction requires module context (e.g. tax class without Financial Reality context), return **actionable redirect** — link to module, not silent fail.

### 6.5 Path C — Preference update

```text
User changes language in Header
  → MutationRequest { type: pref.update, field: language, value }
  → SESSION_PATCH (+ sync rule for preferredLanguage)
  → snapshot++
```

### 6.6 Audit trail

| Requirement | v2 policy |
|-------------|-----------|
| Audit required for domain facts? | **Yes** — `ProfileRevision[]` |
| Audit required for prefs? | **Recommended** — session event log |
| Audit required for scenario runs? | Execution trace only — not profile revision |
| User-visible provenance? | Plain language: *"Last updated when you used [Tool Title]"* or *"You updated this"* |
| Expose revision IDs in UI? | **Forbidden** (leak rule from v1) |

### 6.7 Deferred vs immediate snapshot refresh

| Mutation | Snapshot refresh |
|----------|------------------|
| `fact.create`, `fact.update`, `fact.correct`, `fact.invalidate` | **Immediate** (same request) |
| `pref.update` | **Immediate** |
| `fact.suggest_correction` (draft) | **None** |
| `fact.suggest` | **None** |
| `onboarding.update` | **Immediate** |

---

## 7. UI Implications (Conceptual — UX-P3 Foundation)

These are **contract constraints** on future UI work, not implementation specs.

### 7.1 Profile edit UI (UX-P3)

| Requirement | Rule |
|-------------|------|
| Pattern | Section-scoped read → edit → save/cancel |
| Save semantics | Submits **`fact.correct`** request — not CRUD |
| Draft state | **`fact.suggest_correction`** — client only until Save |
| Labels | Plain language — v1 terminology contract |
| Validation errors | Human messages — no Zod/schema exposure |
| After save | Return to read mode; toast confirmation |
| Scenario fields | **Must not appear** in Profile editors |
| Bypass module validation | **Forbidden** |

### 7.2 Home

| Requirement | Rule |
|-------------|------|
| Mutations | **None** for domain facts |
| Onboarding dismiss | Client + `onboarding.update` only |
| Suggestions | **`fact.suggest`** — links only |
| Post-correction | May reflect updated headline on next snapshot fetch — **never optimistic domain write** |

### 7.3 Modules

| Requirement | Rule |
|-------------|------|
| Primary write | Remains execute submit |
| Scenario UX | Visually distinct from "saved situation" fields where both present |
| Prefill | Read-only from projection; user override on submit writes via activation |
| After Profile correction | Prefill updates on next visit — no Profile page dependency |

### 7.4 Post-mutation user narrative

| Event | User-visible outcome |
|-------|---------------------|
| Module activation write | Toast: saved to situation |
| Profile correction | Toast: situation updated |
| Scenario run | No situation toast unless persistent fields also changed |
| Material correction affecting past results | Copy: *"Re-run [Tool] to refresh results"* — not automatic result rewrite |

---

## 8. Hard Constraints (Normative)

The following are **non-negotiable** under UX Contract v2:

| ID | Constraint |
|----|------------|
| **H1** | Profile UI does **NOT** directly mutate authoritative state |
| **H2** | No surface bypasses Mutation Layer for domain fact writes |
| **H3** | No surface bypasses module validation rules for shared fields |
| **H4** | No raw schema keys, patch JSON, or revision IDs in mutation UI flows |
| **H5** | No scenario data stored in ProfileDocument |
| **H6** | No dual-write ambiguity — Module path and Profile path converge in Mutation Layer |
| **H7** | Home MUST NOT initiate `fact.create`, `fact.update`, `fact.correct`, or `fact.invalidate` |
| **H8** | Profile MUST NOT expose module execution or scenario controls |
| **H9** | All persistent fact changes MUST produce audit/provenance |
| **H10** | v1 leak prevention (L1–L10) remains in force |

**ADR gate:** Changing H1, H5, or H6 requires ADR in `docs/decisions/`.

---

## 9. Mapping to Profile System P1 / Implementation

| v2 concept | Profile System P1 deliverable |
|------------|-------------------------------|
| Mutation Layer typing | [profile-mutation-model-v1.md](../identity/profile-mutation-model-v1.md) §2, §6 |
| Profile read projection | `UserProfileViewV1` (§6.5 of mutation model) |
| Profile correction API | `submitMutation({ type: 'fact.correct', ... })` — not raw PATCH |
| Web client | `submitMutation()` — not `updateProfile()` from Profile components |
| Revision concurrency | `expectedHeadRevision` on all corrections |
| Language | `pref.update` sync policy |

See [profile-system-v1-roadmap.md](../identity/profile-system-v1-roadmap.md) Phases P1–P2 and [profile-mutation-model-v1.md](../identity/profile-mutation-model-v1.md).

---

## 10. Enforcement Reference

### 10.1 Phase alignment

| Phase | Deliverable | Contract sections |
|-------|-------------|-------------------|
| Step A | UX Contract v2 (this doc) | All |
| Step B | Profile System P1 | §5, §6, §9 |
| Step C | UX-P3 Profile correction UI | §3, §7 |
| Future | Staleness (`fact.invalidate` prompts) | §2, UX-P5 |

### 10.2 PR checklist (mutation-specific)

- [ ] Profile UI calls Mutation Layer API — not direct profile store
- [ ] New fields classified persistent vs scenario in activation map
- [ ] Correction path uses `expectedRevision`
- [ ] Audit/provenance recorded
- [ ] No scenario fields added to Profile editors
- [ ] Home unchanged as write initiator
- [ ] Boundary tests updated for forbidden direct PATCH from Profile route

### 10.3 Related documents

| Document | Relationship |
|----------|--------------|
| [ux-contract-v1.md](./ux-contract-v1.md) | Surface separation — still active |
| [profile-ux-spec.md](../identity/profile-ux-spec.md) | Screen design — subordinate to §4, §7 here |
| [profile-system-v1-roadmap.md](../identity/profile-system-v1-roadmap.md) | Technical delivery — implements §6, §9 |
| [profile-ux-design-prompt.md](../identity/profile-ux-design-prompt.md) | Product intent |

### 10.4 Contract change process

1. ✅ v2 draft in `docs/ux/` (this document)
2. ☐ ADR: `docs/decisions/adr-ux-mutation-layer.md` — approve H1, correction path, conflict policy
3. ☐ Update v1 §9 phase table to reference v2 as active for mutation work
4. ☐ Add mutation boundary tests in web + API packages
5. ☐ Re-index: `python3 docs/meta/index-docs.py`

---

## 11. Violation Examples

Incorrect designs that **break UX Contract v2**. Use in review and ADR discussions.

### V1 — Profile as direct CRUD

```text
❌ ProfileDomainEdit.tsx calls PATCH /api/profile with raw ProfilePatch on Save
```

**Why wrong:** Bypasses mutation intent model; blurs mirror vs authority; risks dual-write with module activation.

**Correct:** Save → `submitFactCorrection({ type: 'fact.correct', ... })` → Mutation Layer.

---

### V2 — Home inline edit

```text
❌ Home situation card adds "Edit rent" input field that PATCHes profile
```

**Why wrong:** Violates H7; Home becomes data editor (v1 S2 failure).

**Correct:** Link to Profile section edit or relevant module.

---

### V3 — Scenario persisted to Profile

```text
❌ Financial Reality activation map writes proposedGrossIncome to ProfileDocument.employment
```

**Why wrong:** Violates H5, SC1; pollutes facts with hypotheticals.

**Correct:** `proposedGrossIncome` stays in execution input only.

---

### V4 — Profile scenario playground

```text
❌ Profile "Work & income" section includes "What if I earned €X?" slider saved to situation
```

**Why wrong:** Profile is not a scenario system (§4).

**Correct:** CTA → Financial Reality module with scenario mode.

---

### V5 — Dual-write race

```text
❌ Module execute and Profile Save both PATCH overlapping fields without coordinator serialization
```

**Why wrong:** Violates H6; undefined merge outcome.

**Correct:** Both paths → Mutation Layer; revision-monotonic merge.

---

### V6 — UI-side merge

```text
❌ ContractModulePage merges profile + form defaults AND Profile page separately PATCHes — client picks winner
```

**Why wrong:** Merge must be server deterministic (§5.3).

**Correct:** Server projection is authoritative; clients send intents only.

---

### V7 — Schema leak in correction flow

```text
❌ Profile save error: "employment.grossMonthlyIncome: Expected number, received string"
```

**Why wrong:** Violates H4, v1 L2.

**Correct:** "Please enter your gross monthly income as a number."

---

### V8 — Bypass module validation

```text
❌ Profile correction API accepts tax class changes with no domain validator; modules enforce differently
```

**Why wrong:** Violates H3; inconsistent facts.

**Correct:** Shared domain validators in Mutation Layer for overlapping fields.

---

### V9 — Silent profile overwrite from module result

```text
❌ Module result eligibility flag auto-writes benefits.receivingBuergergeld = true without activation map + user submit
```

**Why wrong:** Facts must come from user-submitted input paths, not inferred results.

**Correct:** Only activation-mapped **input fields** on execute; results stay in projection.

---

### V10 — Optimistic Home write

```text
❌ After Profile save, Home locally mutates summary state without waiting for snapshotVersion
```

**Why wrong:** Home is read plane; creates split-brain vs Profile mirror.

**Correct:** Refresh snapshot; render from projection.

---

## 12. Acceptance (Self-Check)

UX Contract v2 is satisfied when:

1. ☐ Mutation authority model documented and enforced (§1)
2. ☐ Typed mutation catalog mapped to implementation (§2)
3. ☐ Surface matrix unambiguous (§3)
4. ☐ Correction vs scenario separation enforced (§4)
5. ☐ Source of truth and conflict rules codified (§5)
6. ☐ Lifecycle stages owned by named layers (§6)
7. ☐ UX-P3 constraints derivable from §7 without ambiguity
8. ☐ Hard constraints H1–H10 testable
9. ☐ ADR approved for mutation layer

**Semantic boundary established:**

```text
Reading reality  →  UserContextV1 (authoritative) + UiSnapshot (execution transport only)
Changing reality →  Mutation Layer only (v2)
```

---

## 14. P1 Contract Lock (Final Hardening)

**Status:** Locked as of P1 Final Hardening pass.

### 14.1 Read-model authority

| Endpoint | Role | Authority |
|----------|------|-----------|
| `GET /api/user-context` | User situation read model | **Authoritative** — sole source for profile/domain facts in UI |
| `GET /api/ui-snapshot` | Execution + session + FTU transport | **Non-authoritative** — MUST NOT drive business logic |

Response headers (`x-user-context-authority`, `x-snapshot-layer`, `x-read-model`) encode this split at the API boundary.

### 14.2 UiSnapshot.userContext

`UiSnapshot.userContext` is typed as `SnapshotUserContextTransport` — a derived projection duplicate for transport convenience only.

**Hard rules (web/UI):**

- ❌ No business logic reads from `snapshot.userContext`
- ❌ No fallback or merge chains between snapshot and userContext
- ✅ All situation reads via `selectUserContextProfile(userContext)` where `userContext` comes from AppProvider (`GET /api/user-context`)

### 14.3 Legacy snapshot isolation

`GET /api/ui-snapshot?snapshotVersion=legacy` remains **compatibility-only** (deprecated). Production web flows MUST NOT request it. Legacy responses include `x-snapshot-contract: legacy-compatibility-only`.

### 14.4 Snapshot architecture (permanent)

UiSnapshot is an **execution-only layer** — never part of the identity system:

```text
Mutation Engine → UserContextV1 (ONLY truth) → Home / Modules / Profile
                     │
                     └── UiSnapshot (FTU, session, executions, actionCards)
```

P1 is complete when no runtime path allows UiSnapshot to be interpreted as authoritative user situation data.

---

## 13. Canonical Principle (v2)

> **Surfaces propose; the Mutation Layer disposes.**

Profile explains what is remembered. Modules decide what to capture. Home orients what to do next. **Only the Mutation Layer changes what is true.**
