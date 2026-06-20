---
id: profile-system-p4-roadmap
title: Profile System P4 — Adaptive Profile Intelligence Layer
project: Arrival Atlas
system: Arrival Atlas
type: roadmap
domain: identity
status: active
maturity: conceptual
owner: product
tags:
  - ux-p4
  - profile-intelligence
  - interpretation-layer
  - confidence
  - provenance
  - profile-insights
  - arr-016
created: 2026-06-20
updated: 2026-06-20
depends_on:
  - ux-contract-v2
  - profile-mutation-model-v1
  - profile-system-v1-roadmap
  - profile-system-p3-roadmap
related:
  - profile-ux-spec
  - profile-ux-design-prompt
  - ux-contract-v2
  - profile-mutation-model-v1
---

# Profile System P4 — Adaptive Profile Intelligence Layer

**Document type:** Product & architecture roadmap  
**System:** Arrival Atlas  
**Version:** 1.0 (conceptual)  
**Status:** Active — P4-A/B core implemented on `arr-016`  
**Branch track:** `arr-016`

> **Naming note:** This document is **Profile Intelligence P4 / UX-P4**. It is **not** the same as **Profile System v1 roadmap Phase P4** (UI Personalization — onboarding layout, category ordering) in [profile-system-v1-roadmap.md](./profile-system-v1-roadmap.md). Those tracks may run in parallel but must not share identifiers in code or docs without explicit cross-reference.

### Implementation status (arr-016)

| Phase | Status |
|-------|--------|
| Phase P4-A — Core engine (`interpretProfileInsights`, contract types, API) | ✅ Done |
| Phase P4-B — UI enrichment (detail block, overview badges, Home hints, prefill copy) | ✅ Done |
| Phase P4-C — Explanation depth (field groups, staleness, explanation graph) | 🔲 Deferred |

**Test coverage:** profile-intelligence 4/4 · API 193/193 · web 53/53

---

## 0. Executive Summary

P4 adds **no new facts**, **no new writes**, and **no second profile model**.

P4 adds a **read-side interpretation layer** on top of `UserContextV1`:

| Track | User-facing shift |
|-------|-------------------|
| **P3 (UX-P3)** | *"User can correct what the system knows"* |
| **P4 (UX-P4)** | *"The system can explain what it knows, how confidently, and what might be missing"* |

P4 is the first time the Profile surface becomes **transparent** — interpretable, not editable, not authoritative.

### Core shift

```text
Before (P1–P3)                    After (+ P4)
─────────────────                 ─────────────────────────────
UserContextV1 = truth             UserContextV1 = truth (unchanged)
Profile mirror = facts            Profile mirror = facts + insight lens
Provenance = module title only    Provenance = plain-language narrative
Completeness = score only         Completeness = score + explained gaps
```

---

## 1. Goal of P4

### Primary goal

Introduce a **deterministic, read-only intelligence projection** that enriches Profile, Home, and module prefill with:

- **Confidence** per domain (and optionally per field group)
- **Provenance explanation** in plain language
- **Missing context detection** beyond raw `missingDomains`
- **Non-authoritative suggestions** (advisory only — never writes)

### UX promise

> *"This is what we know, how sure we are, and what might be missing."*

Aligned with [profile-ux-spec.md](./profile-ux-spec.md) trust principles and [profile-ux-design-prompt.md](./profile-ux-design-prompt.md) — clarity over completeness, explanation over abstraction.

---

## 2. Non-goals (critical)

P4 must **NOT** introduce:

| ❌ Forbidden | Why |
|-------------|-----|
| New source of truth | `UserContextV1` remains sole situation authority |
| New mutation types or write paths | Mutation Layer unchanged |
| Scenario / what-if storage | Stays in module execute plane |
| ML inference or probabilistic scoring | Must be deterministic and auditable |
| Backend profile rewrite | No reducer / materialization changes |
| Second editable profile model | No CRUD UI, no `interpretedProfileView` writes |
| Hidden scoring systems | All rules must be documentable and testable |
| Raw event log in web UI | Events are engine input only — not user-facing |

---

## 3. System Positioning

P4 sits **strictly above** the locked P1–P3 stack:

```text
Mutation Layer (P1–C3) + Correction UI (UX-P3)
        │
        ▼
UserContextV1  ← GET /api/user-context (AUTHORITATIVE — unchanged)
        │
        ▼
Profile Intelligence Layer (P4)  ← NEW — read-only projection
        │
        ├── confidence (deterministic)
        ├── provenance narratives
        ├── missing context hints
        └── advisory suggestions (no writes)
        │
        ▼
Profile / Home / Module prefill UI (enriched, same structure)
```

### Architecture invariant (from P1 contract lock)

- `UiSnapshot` remains execution transport only — P4 must **not** derive situation confidence from snapshot profile fields.
- Web situation **facts** still flow through `selectUserContextProfile(userContext)`.
- P4 insights flow through a **separate read path** (see §8) — analogous to `SnapshotUserContextTransport` non-authority pattern.

---

## 4. Relationship to existing tracks

| Layer / track | Meaning | Status |
|---------------|---------|--------|
| **P1** | Mutation system + `UserContextV1` authoritative read model | ✅ Complete |
| **UX-P3** | Profile correction UI (`fact.correct` via `profile_ui`) | ✅ Core complete ([p3 roadmap](./profile-system-p3-roadmap.md)) |
| **Profile System v1 P2** | Form prefill, onboarding mutations, completeness in projection | Planned — parallel, not blocking P4 |
| **Profile System v1 P3** | Explain **presentation** depth (UI-only) | Planned — distinct from P4 |
| **Profile System v1 P4** | Home layout / category personalization | Planned — distinct from this doc |
| **UX-P4 (this doc)** | Profile **interpretation** intelligence | Proposed |

### Correction vs suggestion (hard distinction)

| Type | Authority | Mechanism |
|------|-----------|-----------|
| **P3 correction** | Authoritative write | `submitMutation()` → `fact.correct` / `pref.update` |
| **P4 suggestion** | Advisory only | UI copy + links — **no** `MutationRequest`, **no** `fact.suggest` persistence |

P4 suggestions align with UX Contract v2 **`fact.suggest` semantics for Home** (navigation-only, ≤ 3 items) but are **not** a new mutation type — they are derived UI hints from `ProfileInsightViewV1`.

---

## 5. P4 Core Modules

### 5.1 Profile Interpretation Engine (read-only)

**Location (proposed):** `packages/profile-intelligence/` or read-only submodule of `@arrival-atlas/profile-engine` — **must not** import mutation commit paths.

**Server-side inputs (authoritative for projection):**

| Input | Source | Web exposure |
|-------|--------|--------------|
| `UserContextV1` | `resolveUserContext(state)` | ✅ via existing endpoint |
| `MutationEvent[]` | `SystemState.profileMutationEvents` | ❌ never to web |
| Module execution metadata | `SystemState.executionsByModuleId` | ❌ raw — only derived narratives |
| `UserProfileViewV1.completeness` | Already in user context | ✅ reuse, extend in insight view |

**Output:** `ProfileInsightViewV1` (see §8) — **not** a mutation of `UserContextV1`.

> **Naming:** Use `ProfileInsightViewV1`, not `interpretedProfileView`, to avoid implying a second editable profile document.

### 5.2 Confidence Layer (deterministic, NOT ML)

Each **mirror domain** (UX slug) or **contract domain** receives:

```typescript
type ConfidenceLevel = 'high' | 'medium' | 'low';

type DomainConfidence = {
  level: ConfidenceLevel;
  reasons: string[]; // human-readable, no internal codes in UI
};
```

**Deterministic rules (v1 proposal — all testable):**

| Level | Conditions (examples) |
|-------|----------------------|
| **high** | Domain fields present AND (confirmed via `fact.correct` from Profile OR ≥2 module executions contributed to domain OR same field updated by module after Profile correction) |
| **medium** | Domain has data from exactly one module execution OR single `fact.correct` without module cross-check |
| **low** | Domain partially filled, stale (no updates within configurable window), or conflicting source kinds detected in event metadata |
| **none** | Domain empty — use `completeness.missingDomains` + mirror empty state |

**Forbidden:** ML models, probabilistic weights, external APIs, runtime randomness.

**Reuse:** `UserProfileViewV1.completeness.score` and `missingDomains` — P4 **extends**, does not replace.

### 5.3 Missing Context Detector

Detects actionable gaps beyond enum listing:

```typescript
type MissingContextHint = {
  domain: ProfileDomain;           // contract domain
  mirrorSlug?: ProfileMirrorDomainSlug;
  message: string;                 // plain language
  suggestedAction: 'open_module' | 'correct_in_profile' | 'review';
  ctaModuleId?: string;
};
```

**Examples:**

- No income information → link to Financial Reality
- Housing without rent → *"Rent amount missing — affects benefits estimates"*
- Employment without income → cross-domain gap hint

**Rules:**

- Used **only** for UI hints and Home suggestions
- Must not auto-write defaults or prefill mutations
- Must respect UX Contract v2 Home cap: **≤ 3 suggestion items**

### 5.4 Explanation Generator (P4 key feature)

Transforms derived metadata into user-facing narratives:

**Good:**

> *"We know you live in Berlin because you used Housing guidance in June."*  
> *"You updated this information in Your situation."*

**Forbidden in UI:**

- Schema keys (`grossMonthlyIncome`)
- Mutation terminology (`fact.correct`, `eventId`, `revision`)
- Raw timestamps without localization
- Event log references

**Current baseline (arr-015):** `profile-mirror-utils.ts` resolves provenance module title from `UiSnapshot.executionsByModuleId` — P4 **formalizes and extends** this with mutation-source awareness on the API side (`source.kind: 'module' | 'profile_ui'`).

**Distinction from ExplainPanel:** Module Explain API explains **decision outputs**. P4 explains **situation facts** — separate concern, no Explain API shape changes.

### 5.5 Suggestion Layer (non-authoritative)

Advisory copy only:

- *"You might want to update income information"*
- *"Housing data is incomplete"*

**Must:**

- Link to `/profile/[slug]/edit` (P3) or `/modules/[id]` — never silent writes
- De-duplicate with Home action cards where overlap exists
- Never bypass P3 correction flow

---

## 6. UI Surface Changes (minimal, additive)

P4 does **not** restructure Profile — it **enriches** existing surfaces.

### 6.1 Profile (`/profile`, `/profile/[slug]`)

Add optional **Domain Insight Block** (below read-only facts):

| Element | Content |
|---------|---------|
| Confidence badge | High / Medium / Low (plain labels) |
| "Why we know this" | Provenance narrative |
| Missing info hint | Link to module or P3 edit |
| "You edited this" | When `profile_ui` source (P3 polish) |

**Unchanged:** `DomainMutationEditor`, `ProfileEditCTA`, P3 save flow.

### 6.2 Home

Optional additive cards — **must not** break P1 read-only orchestrator rules:

- *"We are missing information about …"* (≤ 3 items)
- *"Your situation is mostly complete"* when `completeness.score` threshold met

**Forbidden:** Home submitting domain fact mutations; optimistic situation writes.

### 6.3 Module prefill

Enhance existing [`ProfilePrefillBanner`](../apps/web/src/components/ProfilePrefillBanner.tsx):

| Today | P4 |
|-------|-----|
| *"Using information from your situation"* | *"Using information from your situation (high confidence)"* / *"(partial — review recommended)"* |

Prefill values still sourced from `selectUserContextProfile()` — banner text from `ProfileInsightViewV1` only.

---

## 7. Data Rules (critical)

### P4 MAY read (web)

| ✅ Allowed |
|-----------|
| `UserContextV1` (facts) |
| `ProfileInsightViewV1` (interpretation) |
| `PublicModuleContract` catalog (CTA titles) |
| `UiSnapshot` — **only** for module titles / FTU — **not** for situation facts or confidence |

### P4 MUST NOT read (web)

| ❌ Forbidden |
|-------------|
| `MutationEventLog` / raw `MutationEvent[]` |
| Reducer / `ProfileState` |
| `snapshot.userContext` for business logic |
| Field registry IDs in user-visible copy |

### P4 MUST NOT write

| ❌ Forbidden |
|-------------|
| `MutationRequest` / `submitMutation()` from insight layer |
| `UserContextV1` mutation |
| `ProfileState` / event log append |
| Session profile PATCH |

---

## 8. System Outputs (P4 contract shape)

New types in `@arrival-atlas/product-contract` — **separate from** `UserContextV1`:

```typescript
/** Read-only interpretation projection — NOT authoritative for situation facts. */
type ProfileInsightViewV1 = {
  schemaVersion: '1.0.0';
  generatedAt: string;
  globalConfidence: ConfidenceLevel;
  missingContext: MissingContextHint[];
  domainInsights: DomainInsight[];
};

type DomainInsight = {
  domain: ProfileDomain;
  mirrorSlug: ProfileMirrorDomainSlug;
  confidence: DomainConfidence;
  provenanceNarrative?: string;
  fieldInsights?: FieldGroupInsight[]; // v1 optional — domain-level first
  suggestions: AdvisorySuggestion[];   // non-authoritative
};

type AdvisorySuggestion = {
  message: string;
  action: 'open_module' | 'correct_in_profile';
  href: string;
};

/** Internal/engine-only — not required in v1 web API response */
type ExplanationNode = {
  id: string;
  label: string;
  children?: ExplanationNode[];
};
```

### API delivery (proposed)

| Endpoint | Role | Authority |
|----------|------|-----------|
| `GET /api/user-context` | Situation facts | **Authoritative** (unchanged) |
| `GET /api/profile-insights` | P4 interpretation | **Non-authoritative** — derived read model |

Response headers (pattern from P1 lock):

```text
x-read-model: ProfileInsightViewV1
x-profile-insights-authority: derived-non-authoritative
```

**Alternative (defer):** embed optional `insights` on user-context response — only if clearly typed as transport copy with same non-authority semantics. Separate endpoint preferred for boundary clarity.

---

## 9. Determinism Rule

P4 projection must satisfy:

```text
ProfileInsightViewV1 = interpret(UserContextV1, MutationEvent[], execution metadata)
```

Same inputs → same output. Golden tests required for:

- Confidence level per domain
- Narrative strings given fixed event fixtures
- Missing context hint ordering (stable sort)

**Forbidden:** ML inference, probabilistic scoring, external APIs, non-deterministic timestamps in confidence logic (display timestamps OK in narratives).

---

## 10. Boundaries (hard rules)

P4 is forbidden to:

- Modify `UserContextV1` shape or authority
- Trigger mutations or influence reducer / conflict resolution
- Alter UX-P3 correction flows or `DomainMutationEditor`
- Override P3 CTAs or duplicate write entry points
- Introduce hidden scoring opaque to tests and docs
- Leak schema paths or mutation internals into UI copy

---

## 11. Success Criteria

P4 is complete when:

- [x] Each Profile mirror domain can show plain-language provenance where data exists
- [x] Each domain shows deterministic confidence (high / medium / low)
- [x] Missing context hints surface actionable gaps (≤ 3 on Home)
- [x] `ProfileInsightViewV1` is fully derived — no new writes in web or API
- [x] Mutation architecture unchanged — P1 boundary tests still green
- [x] Golden tests prove determinism for interpretation engine
- [x] No regression in P3 correction flow or Home read-only orchestration

---

## 12. Strategic Impact

P4 shifts the product feel from:

> *"Here is your data"*

to:

> *"Here is your understanding of yourself in the system — and here is how we know it."*

This supports trust before UX expansion (onboarding, personalization) without expanding the mutation surface.

---

## 13. Suggested Implementation Phases

### Phase P4-A — Core engine (`arr-016`+)

| Deliverable | Package |
|-------------|---------|
| `interpretProfileInsights()` pure function | `packages/profile-intelligence/` |
| Deterministic confidence model | tested rules table |
| Missing context detector | uses `completeness` + domain field presence |
| `ProfileInsightViewV1` types | `product-contract` |
| `GET /api/profile-insights` | `apps/api` — projects from `SystemState`, no new persistence |

### Phase P4-B — UI enrichment

| Deliverable | Surface |
|-------------|---------|
| `DomainInsightBlock` component | Profile detail |
| Confidence badge on overview cards | `/profile` |
| Home missing-context strip (≤ 3) | Home |
| `ProfilePrefillBanner` confidence copy | Module forms |
| `fetchProfileInsights()` + boundary tests | `apps/web` |

### Phase P4-C — Explanation depth

| Deliverable | Notes |
|-------------|-------|
| Field-group narratives | optional v1.1 |
| `explanationGraph` builder | internal/debug first; flat strings to UI |
| Cross-domain gap detection | e.g. employment without income |
| Staleness signals | time-based rules from event `committedAt` |

---

## 14. Key Design Principle

> **P4 must never feel like a second profile.**  
> It must feel like **a lens over the same `UserContextV1`.**

If P1–P3 built **truth, storage, and correction**, then P4 builds **understanding**.

---

## 15. Open Questions

| # | Question | Default recommendation |
|---|----------|------------------------|
| Q1 | Separate package vs `profile-engine` submodule? | Separate `profile-intelligence` — keeps engine write path isolated |
| Q2 | Field-level vs domain-level confidence in v1? | Domain-level first; field groups in P4-C |
| Q3 | Include execution timestamps in narratives? | Yes — localized, no ISO strings in UI |
| Q4 | Reuse `UiSnapshot` for module titles in web insights client? | Yes for display metadata only; confidence from insights API |
| Q5 | Relationship to Profile System v1 P2 completeness (P2.4)? | Merge — P4 consumes completeness from user context, extends with narratives |

---

## 16. References

| Document | Relevance |
|----------|-----------|
| [ux-contract-v2.md](../ux/ux-contract-v2.md) | Home suggestions, no dual-write, `fact.suggest` semantics |
| [profile-mutation-model-v1.md](./profile-mutation-model-v1.md) | Event log authority, source kinds |
| [profile-system-p3-roadmap.md](./profile-system-p3-roadmap.md) | Correction layer — P4 must not override |
| [profile-system-v1-roadmap.md](./profile-system-v1-roadmap.md) | Parallel tracks P2 / v1-P3 / v1-P4 |
| [profile-ux-spec.md](./profile-ux-spec.md) | Trust, provenance, section UX |

---

## 17. Final Takeaway

```text
P1–P3:  truth · storage · correction
P4:     understanding (read-only, deterministic, transparent)
```

No new data. No new writes. A lens — not a duplicate profile.
