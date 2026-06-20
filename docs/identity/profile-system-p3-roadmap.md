---
id: profile-system-p3-roadmap
title: Profile System P3 — Profile Edit & Correction Layer
project: Arrival Atlas
system: Arrival Atlas
type: roadmap
domain: identity
status: active
maturity: draft
owner: product
tags:
  - ux-p3
  - profile-edit
  - mutation-ui
  - correction-layer
  - user-context
  - arr-015
created: 2026-06-20
updated: 2026-06-20
depends_on:
  - ux-contract-v2
  - profile-mutation-model-v1
  - profile-system-v1-roadmap
related:
  - profile-ux-spec
  - profile-ux-design-prompt
  - profile-mutation-model-v1
  - ux-contract-v2
---

# Profile System P3 — Profile Edit & Correction Layer (UX-P3)

**Document type:** Product roadmap  
**System:** Arrival Atlas  
**Version:** 1.0 (draft)  
**Status:** Planned — first writable UI layer over the P1 mutation system  
**Scope:** Profile correction UX, MutationRequest authoring in web, integration with existing C2/C3 backend. **Not** new data models, **not** backend mutation engine changes.

> **Naming note:** This document is **UX-P3 / Profile Correction Layer**. It is distinct from **Profile System v1 roadmap Phase P3** (Explain presentation personalization) in [profile-system-v1-roadmap.md](./profile-system-v1-roadmap.md).

### Implementation status (arr-015)

| Phase | Status |
|-------|--------|
| Phase 0 — Revision plumbing (client-side head tracking + conflict retry) | ✅ In progress |
| Phase 1 — Edit CTA + routing | ✅ Done |
| Phase 2 — Mutation editor MVP (all 7 mirror sections) | ✅ Done |
| Phase 3 — Domain coverage polish | 🔲 Pending |
| Phase 4 — Provenance / trust polish | 🔲 Pending |

---

## 0. Executive Summary

P3 introduces the **first writable UI layer** over the Mutation System completed in P1.

It does **not** introduce new sources of truth, backend concepts, or profile CRUD APIs.

Instead, it defines:

- A Profile UI that **constructs `MutationRequest`s** for correcting `UserContextV1`
- A controlled edit experience aligned with [UX Contract v2](../ux/ux-contract-v2.md) §7

### Core shift

| Before (P1) | After (UX-P3) |
|-------------|---------------|
| Modules write facts via execute → mutation | Unchanged |
| Profile is read-only mirror | Profile becomes **correction entry point** |
| No UI mutation authoring from Profile | Profile UI = **MutationRequest builder** |
| Snapshot dual-read risk | Fully removed — Profile reads **only** `userContext` |

### Current baseline (already shipped in P1)

Read-only mirror infrastructure exists today:

| Surface | Component / route | Status |
|---------|-------------------|--------|
| Profile overview | `ProfileMirrorOverview.tsx`, `/profile` | ✅ Read-only |
| Domain detail | `ProfileDomainDetail.tsx`, `/profile/[domain]` | ✅ Read-only — **no edit CTA yet** |
| Home situation | `YourSituationSummaryCard.tsx`, `HomeSnapshotRenderer.tsx` | ✅ Read-only |
| Mutation client | `fetchUserContext()`, `submitMutation()` | ✅ Used for header prefs only |
| Request builders | `buildHeaderLanguageMutation`, `buildHeaderThemeMutation` | ✅ Pref plane only |

UX-P3 extends this baseline — it does **not** replace it.

---

## 1. Goal of P3

### Primary goal

Enable users to **view and correct their situation data safely** through the controlled mutation layer.

### UX promise

> *"This is what we know about you. You can correct it anytime."*

Aligned with [profile-ux-spec.md](./profile-ux-spec.md) §1 and [profile-ux-design-prompt.md](./profile-ux-design-prompt.md).

---

## 2. Non-goals (hard constraints)

P3 explicitly does **NOT** introduce:

| ❌ Forbidden | Reason |
|-------------|--------|
| New sources of truth | `UserContextV1` remains sole situation read model |
| Direct profile patching (`PATCH /api/profile`) | Violates UX Contract v2 H2 |
| Scenario storage in Profile | Scenarios stay in module execute plane |
| Module logic duplication in Profile UI | Shared validators live in Mutation Layer |
| Editable snapshot state | `UiSnapshot` is execution transport only |
| Multi-step wizard outside mutation system | Onboarding mutations are a separate track (Profile System v1 P2) |
| Preferences expansion in Profile | Language/theme stay in Header → `pref.update` (UX Contract v2 I3) |
| `SchemaForm` reuse for corrections | Module JSON Schema forms ≠ human-language correction editor |

---

## 3. System Positioning

```text
Modules → generate facts (execute → mutation)
           ↓
Mutation Layer → validate + resolve + commit
           ↓
UserContextV1 (authoritative read model)
           ↓
Profile UI (UX-P3) = MutationRequest builder only
```

Profile becomes:

> A **view + correction interface** over immutable derived state — not a database UI.

### Architecture invariant (from P1 lock)

```text
Mutation Engine → UserContextV1 (ONLY truth) → Profile mirror / Home / Modules
                     │
                     └── UiSnapshot (execution-only — MUST NOT drive Profile business logic)
```

All Profile reads: `selectUserContextProfile(userContext)` from `AppProvider.userContext` (`GET /api/user-context`).

---

## 4. UX-P3 Scope

### 4.1 Profile Overview (extends existing mirror)

**Unchanged layout** from current `ProfileMirrorOverview`:

- Domain section cards (read-only)
- Status badges (`DomainStatusBadge`)
- Provenance text (*"Last updated when you used …"*)
- **New:** CTA → **"Correct this section"** on domains with data or eligible empty states

**Not in scope:** redesign of overview information architecture.

### 4.2 Domain Edit Entry Point

Each **fact domain section** gains:

- **"Correct information"** CTA on `ProfileDomainDetail`
- Opens **Domain Correction Editor** (dedicated component — not `SchemaForm`)
- Section-scoped edit — one mirror section at a time

**Excluded from edit entry:**

| Mirror section | Slug | Reason |
|----------------|------|--------|
| Language & display | `language-display` | Preferences plane — Header + `pref.update` only (`supportsFactMutations: false`) |

### 4.3 Domain Correction Editor (core of P3)

#### Responsibilities

UI **must**:

- Load current domain slice from `UserContextV1` via `selectUserContextProfile()`
- Present fields in **plain language** (reuse label maps from `profile-mirror-utils.ts` where possible)
- Hold **client-side draft** until Save (UX Contract v2: `fact.suggest_correction` semantics — **never sent to API**)
- Transform confirmed edits → `MutationRequest` with `source: { kind: 'profile_ui', domain }`
- Submit via existing `submitMutation()` → refresh `userContext` via `refreshUserContext()` or `refreshSessionState()`

UI **must NOT**:

- Show field IDs, schema paths, Zod errors, or reducer internals
- Show revision numbers, event IDs, or conflict rule names
- Read from `snapshot.userContext` or `UiSnapshot.profile`
- Call `PATCH /api/profile`

#### Draft vs Save (UX Contract v2 alignment)

| Phase | Behavior | API |
|-------|----------|-----|
| **Edit mode** | Client draft only | None |
| **Cancel** | Discard draft | None |
| **Save** | Submit persistent correction | `POST /api/mutations` with `type: 'fact.correct'` |
| **Remove field** | Submit invalidation | `type: 'fact.invalidate'` (when applicable) |

> **`fact.suggest_correction` is meta/ephemeral** — it models draft intent in the contract but is **not committed**. P3 implements its semantics as **local React state**, not an API call.

### 4.4 Save Flow

```text
User edits fields (client draft)
   ↓
UI builds MutationRequest(s)
   ↓
submitMutation({ type: 'fact.correct', source: { kind: 'profile_ui', domain }, expectedHeadRevision, … })
   ↓
UserContextV1 updated (response + AppProvider refresh)
   ↓
Profile mirror returns to read mode
   ↓
Optional: refreshSessionState() if Home headline depends on updated facts
```

### 4.5 Feedback model

After save:

- Toast: **"Your situation was updated"**
- Provenance on next read: **"You edited this"** (alongside module provenance)
- No technical terms (mutation, revision, event, reducer)
- If correction affects module results: copy per UX Contract v2 §7.4 — *"Re-run [Tool] to refresh results"* (no automatic result rewrite)

### 4.6 Error handling

| API condition | User-facing behavior |
|---------------|---------------------|
| `REVISION_CONFLICT` | *"Your situation was updated elsewhere. We've refreshed — please review and try again."* — auto-refresh `userContext`, restore read mode |
| Domain validation failure | Plain-language field message — no schema exposure |
| Module context required | Actionable redirect — *"Open [Module Title] to update this"* — per UX Contract v2 §6.4 Path B |
| Network / 500 | Generic retry message |

---

## 5. Mutation Mapping (UI contract)

### 5.1 Allowed mutation types from Profile UI

Per `SOURCE_ALLOWED_TYPES.profile_ui` in `@arrival-atlas/profile-engine`:

| Intent | Mutation type | UI meaning | When |
|--------|---------------|------------|------|
| Correct | `fact.correct` | "You updated this information" | Save on field change / new value in empty domain |
| Remove | `fact.invalidate` | "Remove incorrect information" | Explicit clear / remove action |
| Draft | *(client only)* | Edit mode | Never sent — local state |
| Preference | `pref.update` | — | **Not in Profile P3** — Header only |

### 5.2 Forbidden from Profile UI

| Type | Reason |
|------|--------|
| `fact.create` | Module plane only — Profile uses `fact.correct` even for first field in a domain |
| `fact.update` | Module plane only |
| `fact.propose_update` | Module confirmation flow |
| `fact.suggest_correction` | Meta — client draft only, not API payload |

### 5.3 Forbidden UI constructs (user-visible)

- No "create record"
- No "event" / "revision" / "conflict" / "merge"
- No raw JSON or patch preview

### 5.4 Hidden transport requirements

These exist in requests but are **never shown**:

- `expectedHeadRevision` — required on `fact.correct` / `fact.invalidate`
- `requestId` — idempotency key
- `userConfirmationRequired: true` — default for corrections per mutation type registry

---

## 6. Domain UX Rules

### 6.1 Mirror sections vs contract domains

Profile mirror uses **UX slugs** (`profile-mirror-utils.ts`). Mutations use **contract domains** (`PROFILE_DOMAINS` in product-contract).

| Mirror section (UX slug) | Contract domain(s) | Editable in P3 |
|--------------------------|---------------------|----------------|
| Move to Germany | `migration` | ✅ |
| Where you live | `housing` | ✅ |
| Household & family | `household` | ✅ |
| Work & income | `employment`, `income` | ✅ — **may emit 1–2 requests** |
| Health insurance | `healthInsurance` | ✅ |
| Benefits & support | `benefits` | ✅ |
| Language & display | `preferences` | ❌ — Header only |

**Implementation note:** `work-income` spans two contract domains. The editor must either:

- Split into sub-sections within edit mode, or
- Submit separate `fact.correct` requests per domain on Save

Do **not** collapse employment + income into a single non-contract payload shape.

### 6.2 Example: Work & Income

**Read view (human text):**

- Gross monthly income → *"€2,500"*
- Employment status → *"Employed full-time"*
- Last updated source → module provenance line

**Edit view (human prompts):**

- *"What is your monthly gross income?"*
- *"What is your current employment status?"*

**NOT shown:**

- `grossMonthlyIncome`
- `employment.status`
- `incomeRecord.v2`

Field mapping lives in a **UI-only adapter** (`DomainCorrectionRequestBuilder`) — not in product-contract field registry exposed to users.

### 6.3 Empty domains

When a domain has no data:

- Primary CTA remains **"Open [Module]"** (existing behavior)
- Secondary CTA (P3): **"Add information manually"** → edit mode → `fact.correct` with `expectedHeadRevision: 0` (or current head)
- Do **not** use `fact.create` from Profile UI — engine rejects it for `profile_ui` source

---

## 7. Data Boundaries (critical)

### Profile UI may access

| ✅ Allowed | Source |
|-----------|--------|
| `UserContextV1` | `AppProvider.userContext` / `fetchUserContext()` |
| Domain slices | `selectUserContextProfile(userContext)?.domains.*` |
| Mirror projection helpers | `profile-mirror-utils.ts` (labels, slugs) |
| Mutation client | `submitMutation()`, `request-builders.ts` extensions |
| Module catalog | `uiSnapshot` + `modules` — **for CTA links only**, not profile facts |
| Head revision | See §10.1 — **prerequisite** |

### Profile UI may NOT access

| ❌ Forbidden |
|-------------|
| `MutationEventLog` / `profileMutationEvents` |
| Reducer state / `ProfileState` |
| `snapshot.userContext` for domain reads |
| `UiSnapshot.profile` (removed from modern contract) |
| Field registry metadata shown to user |
| Conflict resolution logic (only consume human-mapped errors) |

---

## 8. Navigation Model

### Entry points

| Route | Mode |
|-------|------|
| `/profile` | Overview — "Correct this section" per card |
| `/profile/[domain]` | Detail read → edit toggle or `/profile/[domain]/edit` |

### Exit points

- Back to `/profile` (read mode after save/cancel)
- Back to Home
- Redirect to module (validation-required corrections)
- *(Future)* Return to module that initiated deep-link correction

---

## 9. System Invariants (UX Contract v2 alignment)

| ID | Invariant | P3 enforcement |
|----|-----------|------------------|
| **I1** | Mutation authority — all writes through Mutation Layer | `submitMutation()` only |
| **I2** | No dual write — no `PATCH /api/profile` | Boundary tests extended |
| **I3** | Profile is not settings | No pref editor in Profile |
| **I4** | Profile is not scenario system | No hypothetical / temporary fields |
| **I5** | Home remains read-only orchestrator | Home never submits `fact.correct` |
| **H1–H4** | No direct state mutation; no schema leak | Editor + error mapping tests |

---

## 10. Technical Integration

### 10.1 Prerequisite — head revision exposure

**Gap today:** `UserContextV1` does not expose `headRevision`, but `fact.correct` requires `expectedHeadRevision`.

**P3 Phase 0 (small contract extension — pick one):**

| Option | Approach |
|--------|----------|
| **A (recommended)** | Extend `GET /api/user-context` response with `headRevision: number` |
| **B** | Track revision in `AppProvider` from last `submitMutation()` response (`revision` field already returned) |

Without this, correction saves cannot satisfy revision guards.

### 10.2 Frontend (new / extended)

| Component / module | Purpose |
|--------------------|---------|
| `DomainCorrectionEditor` | Human-language edit UI per mirror section |
| `ProfileDomainDetail` | Add edit CTA + read/edit mode switch |
| `lib/mutations/domain-correction-builders.ts` | UI-only `MutationRequest` builder (extends `request-builders.ts`) |
| `lib/mutations/useDomainCorrection.ts` | Draft state, save/cancel, error mapping hook |
| `AppProvider` | Track `headRevision`; expose post-correction refresh |

**Reuse — do not duplicate:**

- `selectUserContextProfile`, `selectAppDisplayLanguage`
- `profile-mirror-utils` label maps
- Existing boundary tests in `contract-lock.test.ts`

### 10.3 Backend (already exists — no P3 engine work)

| Capability | Location |
|------------|----------|
| `POST /api/mutations` | `routes/profile-mutations.ts` |
| Reducer + conflict resolution | `@arrival-atlas/profile-engine` |
| `GET /api/user-context` | `profile-mutation-state.ts` |
| Revision guards | `resolveMutationConflict()` |

### 10.4 Tests (P3 deliverables)

| Test | Purpose |
|------|---------|
| `domain-correction-builders.test.ts` | Request shape + source kind |
| Extend `contract-lock.test.ts` | No `PATCH /api/profile`; no snapshot profile reads in editor |
| Extend `mutation-boundary.test.ts` | Profile edit files use `submitMutation` |
| Integration / E2E (optional) | Save correction → userContext reflects → mirror read mode |

---

## 11. Rollout Plan

### Phase 0 — Revision plumbing

- Expose `headRevision` to web (§10.1)
- `AppProvider` holds revision alongside `userContext`

### Phase 1 — UI skeleton

- Add **"Correct this section"** CTA on `ProfileDomainDetail`
- Route to edit mode shell (fields read-only placeholder)
- No mutation submit yet

### Phase 2 — Mutation editor MVP

- `DomainCorrectionEditor` for **one domain** (recommend `income` — simplest single-domain)
- `domain-correction-builders.ts` + `submitMutation()` integration
- Save / cancel / toast / error mapping
- Revision conflict recovery flow

### Phase 3 — Domain coverage expansion

- All **6 fact mirror sections** editable (excluding `language-display`)
- Handle `work-income` multi-domain save
- Consistent UX patterns per [profile-ux-spec.md](./profile-ux-spec.md) §6.4

### Phase 4 — Polish

- Provenance: *"You edited this"*
- Trust feedback refinement
- Empty-state secondary manual-add path
- Material-edit → re-run module copy

---

## 12. Success Criteria

UX-P3 is complete when:

- [ ] User can correct any **fact domain** from Profile UI (6 mirror sections)
- [ ] All corrections go through `POST /api/mutations` with `source.kind: 'profile_ui'`
- [ ] `UserContextV1` reflects corrections immediately after save
- [ ] No `PATCH /api/profile` usage anywhere in web
- [ ] No schema / field-ID leakage in Profile edit UI
- [ ] Boundary tests green (`contract-lock`, `mutation-boundary`)
- [ ] UX Contract v2 §7.1 checklist satisfied
- [ ] Home / module mirror unchanged except reading updated projection

---

## 13. Relationship to P1 / P2 / other tracks

| Track | Meaning | Status |
|-------|---------|--------|
| **P1** | Mutation system + UserContext + read-only mirror + contract lock | ✅ Complete |
| **Profile System v1 P2** | Form prefill, onboarding mutations, completeness in snapshot | Planned — **parallel**, not blocking P3 |
| **UX-P3 (this doc)** | Controlled write UI — correction layer | Planned |
| **Profile System v1 P3** | Explain presentation personalization | Planned — separate concern |
| **UX-P3 Profile edit (UX Contract)** | Same as this doc | — |

Read-only mirror was delivered in **P1 web track**, not Profile System v1 P2.

---

## 14. Key Principle

> **Profile is not a database UI.**  
> It is a **controlled correction interface** over a deterministic, event-sourced state system.

Surfaces propose; the Mutation Layer disposes.

---

## 15. References

| Document | Relevance |
|----------|-----------|
| [ux-contract-v2.md](../ux/ux-contract-v2.md) §6.4, §7 | Correction path, draft/save semantics |
| [profile-mutation-model-v1.md](./profile-mutation-model-v1.md) | Event log, reducer, source authorization |
| [profile-ux-spec.md](./profile-ux-spec.md) §6.4 | Section-scoped edit UX |
| [profile-system-v1-roadmap.md](./profile-system-v1-roadmap.md) | P1 complete; P2/P3/P4/P5 tracks |
| [contracts/profile-mutation-contract-summary.md](../contracts/profile-mutation-contract-summary.md) | Type catalog |

---

## 16. Open Questions

| # | Question | Default recommendation |
|---|----------|------------------------|
| Q1 | Separate route `/profile/[domain]/edit` vs inline mode toggle? | Inline toggle on detail page (simpler) |
| Q2 | Single vs multi-request save for `work-income`? | Multi-request, sequential, one toast |
| Q3 | Optimistic read-mode update before refresh completes? | **No** — wait for `userContext` refresh (UX Contract v2 §7.2) |
| Q4 | Extend `UserContextV1` with `headRevision`? | **Yes** — Option A in §10.1 |
