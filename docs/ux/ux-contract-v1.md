---
id: ux-contract-v1
title: UX Contract v1 — System Boundaries & Guardrails
project: Arrival Atlas
system: Arrival Atlas
type: contract
domain: product
status: active
maturity: stable
owner: system
tags:
  - ux-boundaries
  - three-surface-model
  - ui-leak-prevention
  - situation-summary
created: 2026-06-19
updated: 2026-06-19
related:
  - profile-ux-design-prompt
  - profile-ux-spec
  - ui-architecture-audit
  - ux-contract-v2
---

# UX Contract v1 — System Boundaries & Guardrails

**Document type:** UX architecture contract (enforcement reference)  
**System:** Arrival Atlas  
**Version:** 1.0  
**Status:** Active — locks Phase 1–2 UX triangle  
**Scope:** Home, Modules, Profile surfaces only. No backend or module-runtime contract changes.

**Supersedes:** Informal UX guidance scattered across discovery and design docs.  
**Does not replace:** [profile-ux-spec.md](../identity/profile-ux-spec.md) (screen-level design) or product-contract API specs.

---

## 0. Contract Summary

Arrival Atlas exposes **three independent user surfaces** with **non-overlapping roles**:

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    HOME     │     │   MODULES   │     │   PROFILE   │
│  orient     │ ──► │   decide    │ ──► │   mirror    │
│  suggest    │     │   capture   │     │   explain   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       └────────────────────┴────────────────────┘
              reads derived state · never owns facts
```

**Core principle:**

> The system is valid only if each surface can be removed without breaking the mental model of the others.

---

## 1. System Roles (Mandatory)

### 1.1 Home

| | |
|---|---|
| **Purpose** | Orientation; next-best-action suggestion; high-level situation summary only |
| **User promise** | *"What should I do next, and what does Arrival Atlas already know at a glance?"* |
| **May show** | Situation headline (city · employment · household); domain completeness counts; onboarding checklist (≤5 steps); rule-based module suggestions (≤3); priority actions; recent results; category module browse |
| **May do** | Link to modules; link to Profile mirror; dismiss onboarding (client-only) |

**Explicitly NOT:**

- Detailed profile data (field-level facts, income amounts, insurance details)
- Editable state or forms
- Raw system data (JSON, schema keys, session objects, FTU flags, debug cards)
- Profile correction or domain editing
- Module execution (except navigation to module routes)

**Route:** `/`  
**Internal name:** Home dashboard / decision cockpit

---

### 1.2 Modules

| | |
|---|---|
| **Purpose** | Decision execution; contextual data collection; explainable outcomes |
| **User promise** | *"Help me decide something specific, with clear reasoning."* |
| **May show** | Module-specific input forms; execution results; explanation panel; prefill banner when situation data applies |
| **May do** | Execute module via API; write facts to persistent situation (via server profile activation); refresh Home/Profile indirectly through snapshot |

**Explicitly NOT:**

- Profile editing UI (section editors, domain management screens)
- Long-term state management UI (settings, account, preferences beyond module scope)
- Full situation mirror or cross-domain summary
- Scenario storage in Profile (what-if values stay in module session only)
- Dependency on Profile page UI state (Profile route must be optional for module function)

**Route:** `/modules/[moduleId]`  
**User-facing label:** **tools** or **modules** (catalog titles), never internal IDs

---

### 1.3 Profile (Situation Mirror)

| | |
|---|---|
| **Purpose** | Read-only mirror of user situation; explain what the system knows; show domain completeness |
| **User promise** | *"Show me clearly what Arrival Atlas remembers to help me decide."* |
| **May show** | Plain-language domain sections; status badges (Complete / Needs attention / Not added yet); provenance (*Last updated when you used [Tool Title]*); empty-state CTAs to relevant modules |
| **May do** | Navigate to modules; navigate back to Home |

**Explicitly NOT (v1 and contract baseline):**

- Decision-making interface (no execute, no recommendations engine)
- Scenario inputs (what-if, proposed income, hypothetical household)
- Module execution logic or result rendering
- Edit mode, forms, save buttons, or settings controls
- Account/identity management (avatars, credentials, social features)
- Onboarding checklist (belongs on Home only)

**Route:** `/profile`, `/profile/[domainSlug]`  
**User-facing label:** **Your situation in Germany** — avoid exposing the word *profile* in primary UI copy where possible

---

## 2. Data Ownership Rules

| Layer | Role | Mutability | Source of truth |
|-------|------|------------|-----------------|
| **Modules** | Capture **new facts** in decision context | Write (via execution → profile activation) | **Authoritative for new user-entered facts** |
| **Profile** | **Derived persistent mirror** of situation | Read-only in UI (v1); server-side store mutated only by module pipeline / API | **Authoritative for stored situation snapshot** |
| **Home** | **Derived ephemeral view** for orientation | Read-only; onboarding dismiss flag in localStorage only | **Never authoritative** |

### Ownership invariants

1. **Facts enter through modules** (or future explicit situation APIs — not Profile UI in v1).
2. **Profile reflects modules**; it does not invent or override module logic.
3. **Home aggregates** profile + snapshot projections for display; it never persists domain facts.
4. **Preferences split:** Language/theme may live in session/header; domain facts live in situation mirror. Home may show language as a domain summary line; detailed prefs appear in Profile Language section only.

---

## 3. Data Flow Contract

```text
User input in Module
        │
        ▼
Module execution (API)
        │
        ├──► Module result (ephemeral display on module page)
        │
        └──► Profile activation / merge (persistent situation)
                    │
                    ├──► Profile mirror (read on /profile)
                    │
                    └──► UiSnapshot projection
                              │
                              └──► Home summary + suggestions (read on /)
```

### Directional rules

| Flow | Allowed | Forbidden |
|------|---------|-----------|
| Module execution → Profile update | ✅ | — |
| Profile → Module input prefill | ✅ (read merge into defaults) | Profile UI writing to module state |
| Profile → Module logic/recommendations | — | ❌ Profile must not change module outcomes |
| Home → Profile mutation | — | ❌ |
| Home → Module mutation | — | ❌ (navigation only) |
| Profile → Home mutation | — | ❌ |

### Prefill contract (Modules)

When situation data prefills a module form:

- Show banner: **"Using information from your situation"**
- Do not expose field mapping, schema keys, or raw JSON
- User may override prefilled values in the module form without visiting Profile
- Profile page is **not required** for module execution

---

## 4. UI Leak Prevention Rules

The following are **hard violations** of UX Contract v1:

| # | Violation | Example (forbidden) |
|---|-----------|---------------------|
| L1 | `moduleId` or internal slug visible to user | `financial-reality` on action card |
| L2 | Schema keys as labels | `grossMonthlyIncome`, `employment.status` |
| L3 | JSON rendering in any user surface | `RecordFields`, `JSON.stringify` in UI |
| L4 | Raw profile object on Home | Full profile dump on dashboard |
| L5 | Session/debug cards on Home | Session language object, FTU boolean |
| L6 | Internal engineering labels | "Attention layer", "Priority signals", "snapshot" |
| L7 | Technical status vocabulary | "entity", "record", "state store" in UI |
| L8 | Global completion gamification | Percentage bars, XP, profile score as primary metric |
| L9 | Profile as gate before modules | Forced `/profile` completion before first tool |
| L10 | Edit controls on Profile (v1) | Save, Edit section, PATCH from Profile UI |

### Allowed internal use (non-UI)

- `moduleId` in routes, API calls, React props, tests — **must not render in DOM text**
- Snapshot types in code — **must not appear in user copy**
- Word *profile* in code and docs — **avoid in user-facing strings**; prefer *your situation*

### Review checklist (PR gate)

Before merging UI changes, confirm:

- [ ] No new debug panels on Home
- [ ] No schema keys in rendered labels
- [ ] No JSON pretty-print in user surfaces
- [ ] Module titles (from catalog) used everywhere users see tool names
- [ ] Profile changes remain read-only unless explicit v2 edit contract exists
- [ ] New Home widgets do not duplicate Profile domain detail

---

## 5. UX Stability Rules

These rules prevent architectural drift:

| Rule | Statement |
|------|-----------|
| **S1 — Profile ≠ settings** | Profile must never accumulate theme pickers, account controls, notification prefs, or admin toggles |
| **S2 — Home ≠ profile viewer** | Home shows headline + counts only; field-level facts belong on Profile |
| **S3 — Modules ⊥ Profile UI** | Modules function with Profile route removed; no `useProfilePageState` coupling |
| **S4 — Surface independence** | Each surface has its own layout components; no shared "mega dashboard" |
| **S5 — Onboarding on Home** | Checklist lives on Home only; max 5 steps; dismissible |
| **S6 — Suggestions rule-based** | Home suggestions use deterministic rules, not opaque ML |
| **S7 — Completeness per domain** | Status badges: Complete / Needs attention / Not added yet — no global score |
| **S8 — Decision/support split** | Modules decide; Profile explains memory; Home orients |

### Versioning

Changes that violate S1–S8 require **UX Contract v2** amendment and explicit ADR — not silent drift.

---

## 6. Terminology Contract

### User-facing (required)

| Term | Use for |
|------|---------|
| **Your situation** | Stored facts mirror (not "profile", "account", "record") |
| **Your situation in Germany** | Profile page title |
| **Tools** / **modules** | Decision features (prefer catalog **title** over slug) |
| **Areas** | Domain sections (location, work, insurance, etc.) |
| **Suggested for you** | Rule-based module recommendations on Home |
| **Priority actions** | Action cards from snapshot UX layer |
| **Recent results** | Past module execution summaries on Home |
| **Complete / Needs attention / Not added yet** | Domain status only |

### User-facing (avoid)

| Avoid | Reason |
|-------|--------|
| profile | Implies settings/account CRM |
| schema | Engineering leak |
| state | Engineering leak |
| entity | Engineering leak |
| record | Database connotation |
| snapshot | Internal projection term |
| session | Auth/debug connotation |
| attention layer | Internal UX pipeline name |
| FTU / first-time user | Internal flag |

### Internal (engineering/docs OK)

- `profile`, `UiSnapshot`, `moduleId`, `executionsByModuleId` — code and architecture docs only

---

## 7. Failure Modes

If this contract is violated, expect these regressions:

| Violation | Failure mode | User impact |
|-----------|--------------|-------------|
| Home shows raw profile | **Debug dashboard regression** | Newcomers see JSON; trust collapses |
| Profile gains edit forms without design | **Settings creep** | Users maintain data twice; modules feel redundant |
| Profile shows module results | **Decision/support blur** | User unsure where to act vs read |
| Modules require Profile visit | **Onboarding gate** | Abandonment before first value |
| moduleId in UI | **Internal leak** | Product feels unfinished, developer-facing |
| Home duplicates Profile domains | **Dashboard creep** | Two sources of truth; inconsistent summaries |
| Profile drives module recommendations | **Coupling** | Profile UI changes break module behavior |
| Scenario data in Profile | **What-if pollution** | Permanent store conflated with experiments |
| Global completion score | **Gamification drift** | Bureaucratic form pressure returns |

**Early warning signs:**

- New Home card iterates over profile keys
- Profile route imports module execution components
- Module page imports Profile section editors
- Copy introduces "complete your profile" language

---

## 8. Principle (Canonical)

> **The system is valid only if each surface can be removed without breaking the mental model of the others.**

| Remove | Mental model preserved if… |
|--------|---------------------------|
| **Home** | User opens a module directly and still decides; Profile still explains situation |
| **Modules** | N/A — modules are primary value (contract assumes modules exist) |
| **Profile** | User uses modules + Home summary only; no loss of decision capability |

Profile is **optional for action** but **required for trust** at scale. Home is **optional for navigation** (header/menu suffices) but **required for orientation** during first weeks.

---

## 9. Enforcement Reference

### Phase alignment

| Phase | Deliverable | Contract sections |
|-------|-------------|-------------------|
| Phase 1 | Home UX cleanup | §1.1, §4, §6, §7 |
| Phase 2 | Profile read-only mirror | §1.3, §2, §3, §5 S2 |
| Phase 3 | UX Contract Lock (this doc) | All |
| Phase 4+ | Profile edit, save feedback | Requires [UX Contract v2](./ux-contract-v2.md) + ADR |

### Related documents

| Document | Relationship |
|----------|--------------|
| [ux-contract-v2.md](./ux-contract-v2.md) | Mutation semantics — extends v1 for write authority |
| [profile-ux-design-prompt.md](../identity/profile-ux-design-prompt.md) | Product intent — subordinate to this contract for boundary disputes |
| [profile-ux-spec.md](../identity/profile-ux-spec.md) | Screen design — must not violate §4–§5 |
| [ui-architecture-audit.md](../audits/ui-architecture-audit.md) | Baseline audit — pre-Phase 1 state |
| [ui-ready-gate-audit.md](../audits/ui-ready-gate-audit.md) | Platform UI gate — technical boundary sibling |

### Contract change process

1. Propose UX Contract v2 draft in `docs/ux/`
2. Link ADR in `docs/decisions/` if boundaries move
3. Update boundary tests / PR checklist in web package
4. Re-index docs: `python3 docs/meta/index-docs.py`

---

## 10. Acceptance (Self-Check)

UX Contract v1 is satisfied when:

1. ✅ UX boundaries explicitly defined (§1)
2. ✅ Data ownership model clear (§2)
3. ✅ UI leakage rules strict (§4)
4. ✅ Home / Modules / Profile roles non-overlapping (§1, §5)
5. ✅ Document usable as enforcement reference (§9)

**Locked triangle:**

```text
Home → orients
Modules → decide + capture
Profile → mirror + explain
```

No settings creep. No dashboard creep. No schema exposure. No over-coupling.
