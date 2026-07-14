# Arrival Atlas — UX Migration Backlog

Status: living backlog for Vision → implementation migration  
Source of truth: `implementation-roadmap.md`  
Backlog type: UX epics (not feature tickets)

---

## Backlog Usage Rules

- Every UX change must map to one epic below.
- If a change does not fit, create a new epic before implementation.
- Prioritize by migration dependency, not by visual desirability.
- Preserve existing platform investments unless an epic explicitly marks replacement.

Effort scale:

- S: ≤1 sprint
- M: 1–2 sprints
- L: 2–4 sprints

Risk scale:

- Low / Medium / High

---

## Epic Catalog

### E0 — Arrival Welcome Layer

- **Objective:** Create the first emotional and linguistic connection between a new user and Arrival Atlas.
- **Purpose:** Ensure the first interaction answers:
  - Can I use this in my language?
  - Is this for people like me?
  - What does this product help me with?
  - What should I do next?
- **Contains:**
  - First visit welcome experience
  - Visible language selection
  - Browser language suggestion
  - Language persistence
  - Trust-building introduction
  - First-time visitor state handling
  - Returning user bypass behavior
- **Surface scope:** Bootstrap completion, Guest Home, Atlas HUD, Language system, First session orchestration
- **Strategy:** Add new trust layer without replacing existing Home. Preserve current visual identity and galaxy assets.
- **Primitive spec:** [primitives/arrival-welcome.md](./primitives/arrival-welcome.md)
- **Dependencies:** None
- **Enables:**
  - E1 Certainty Layer
  - E4 Onboarding Flow Orchestrator
  - E5 Journey Guide Defaulting
  - E7 Home Inversion
- **Effort:** M
- **Risk:** Low technical / High trust impact
- **Phase target:** 0

### E1 — Certainty Layer

- **Objective:** Make "what now and why" explicit on every core surface.
- **Contains:**
  - current location
  - next action
  - because explanation
  - progress delta ("what changed")
- **Surface scope:** Home, HUD, Life Events, Economic Reality, Profile
- **Strategy:** **Improve + Merge** (shared pattern across surfaces)
- **Dependencies:**
  - E0 Arrival Welcome Layer
- **Enables:**
  - Guide defaulting, IA relabeling, emotional polish
- **Effort:** M
- **Risk:** Medium
- **Phase target:** 1–3

### E2 — Situation Layer

- **Objective:** Expose one coherent user situation before module context.
- **Contains:**
  - situation summary
  - urgency
  - confidence
  - recommendations
- **Surface scope:** Profile, Profile Edit, Home entry, Journey Guide
- **Strategy:** **Keep backend, Split UI, Merge truth surfaces**
- **Dependencies:**
  - E1 Certainty Layer
- **Enables:**
  - Home problem-first entry, lens IA
- **Effort:** M
- **Risk:** Medium
- **Phase target:** 1–5

### E3 — Navigation Parity Layer

- **Objective:** Guarantee primary lens reachability across desktop/mobile.
- **Contains:**
  - unified production nav
  - mobile-safe primary access
  - route hierarchy consistency
  - persistent language access entry point
- **Surface scope:** Atlas HUD, Navigation, Mobile, Language
- **Strategy:** **Replace divergent nav patterns, Merge shell navigation**
- **Dependencies:**
  - E0 Arrival Welcome Layer (language persistence baseline)
  - E1 telemetry and recovery baseline
- **Enables:**
  - safe guide and home migration
- **Effort:** L
- **Risk:** High
- **Phase target:** 2

### E4 — Onboarding Flow Orchestrator

- **Objective:** Enforce first-session sequencing with no overlay collisions.
- **Contains:**
  - one-overlay invariant
  - intake vs welcome ordering
  - first value within ≤90s
  - crisis branch entry
- **Surface scope:** Bootstrap, Home, Life Events, Journey Guide, Modals
- **Strategy:** **Improve + Remove conflicting first-visit behaviors**
- **Dependencies:**
  - E0 Arrival Welcome Layer
  - E1 Certainty Layer
  - E3 Navigation Parity
- **Enables:**
  - guide-default experience and home migration
- **Effort:** M
- **Risk:** High
- **Phase target:** 1–3

### E5 — Guide Defaulting and Assistance Curve

- **Objective:** Transition from mode election to default-guided progression.
- **Contains:**
  - remove first-visit guided vs independent election
  - guided-by-default entry
  - reversible independence control
  - stuck detection and re-engagement
- **Surface scope:** Journey Guide, Life Events, Economic Reality, Profile
- **Strategy:** **Keep engine, Improve policy**
- **Dependencies:**
  - E0 Arrival Welcome Layer (trust + language before guidance)
  - E4 Orchestrator
  - E8 Localization Parity
- **Enables:**
  - one-next-step reliability at scale
- **Effort:** M
- **Risk:** Medium
- **Phase target:** 3

### E6 — Galaxy Semantics Layer

- **Objective:** Convert visual metaphor into explicit dependency semantics.
- **Contains:**
  - plain-language subtitles for bureaucratic terms
  - lock reason standards
  - unlock causality summary
  - map-as-proof framing
- **Surface scope:** Life Events, Economic Reality, Profile, Animations
- **Strategy:** **Improve + Split meaning from decoration**
- **Dependencies:**
  - E1 Certainty Layer
  - E5 Guide Defaulting
- **Enables:**
  - final home inversion and low-cognitive variants
- **Effort:** M
- **Risk:** Medium
- **Phase target:** 4

### E7 — Home Inversion Layer

- **Objective:** Migrate home from marketing-first to problem-first.
- **Contains:**
  - urgent problem intake entry
  - one primary CTA
  - optional "understand the big picture" depth path
  - returning-user direct resume
- **Surface scope:** Home, Atlas HUD, Information Architecture
- **Strategy:** **Split + Replace flow sequencing, Keep visual assets where useful**
- **Dependencies:**
  - E0 Arrival Welcome Layer
  - E2 Situation Layer
  - E3 Navigation Parity
  - E5 Guide Defaulting
  - E6 Galaxy Semantics
- **Enables:**
  - measurable reduction in time-to-trustworthy-action
- **Effort:** L
- **Risk:** High
- **Phase target:** 5

### E8 — Localization Parity Layer

- **Objective:** Eliminate mixed-language guidance and entry friction.
- **Contains:**
  - guide language parity
  - shell language accessibility
  - mixed-viewport language guardrails
  - fallback copy policy
- **Surface scope:** Language, Journey Guide, Home, Errors, Bootstrap
- **Strategy:** **Keep i18n infra, Improve coverage and routing**
- **Dependencies:**
  - E0 Arrival Welcome Layer (first-contact language selection)
  - E3 Navigation Parity for persistent language access
- **Enables:**
  - trustworthy guided experience for non-English speakers
- **Effort:** M
- **Risk:** High (trust + comprehension)
- **Phase target:** 1–3

### E9 — Recovery and Error Safety Layer

- **Objective:** Remove dead ends and normalize recovery paths.
- **Contains:**
  - branded not-found with next actions
  - retry + fallback path contract
  - contextual recovery links
  - technical-to-human error translation
- **Surface scope:** Errors, Bootstrap, Generic Modules, Profile routes
- **Strategy:** **Keep error panel, Improve error topology**
- **Dependencies:**
  - E0 Arrival Welcome Layer (localized recovery copy baseline)
  - E1 Certainty Layer
- **Enables:**
  - safer IA and home migration
- **Effort:** S–M
- **Risk:** Medium
- **Phase target:** 1–2

### E10 — Feedback Loop Integrity Layer

- **Objective:** Ensure every write closes with explicit human confirmation.
- **Contains:**
  - save confirmation taxonomy (toast/inline/banner)
  - mutation consequence statement
  - no silent state changes
  - confidence calibration for uncertain outcomes
- **Surface scope:** Profile Edit, Life Event intake, Economic actions, Toasts
- **Strategy:** **Improve + Merge feedback standards**
- **Dependencies:**
  - E0 Arrival Welcome Layer (localized confirmation copy)
  - E1 Certainty Layer
- **Enables:**
  - reduced anxiety and better task completion confidence
- **Effort:** S–M
- **Risk:** Low–Medium
- **Phase target:** 1–4

### E11 — Motion Governance Layer

- **Objective:** Enforce instructional motion and urgency-aware pacing.
- **Contains:**
  - skippable cinematic rules
  - reduced-motion parity
  - urgency overrides
  - instructional-vs-decorative lint checklist
- **Surface scope:** Animations, Journey Guide cinematic, Home ambient motion
- **Strategy:** **Keep motion stack, Improve policy and orchestration**
- **Dependencies:**
  - E0 Arrival Welcome Layer (calm first-contact motion baseline)
  - E4 Orchestrator
  - E5 Guide Defaulting
- **Enables:**
  - emotional polish without trust debt
- **Effort:** M
- **Risk:** Medium
- **Phase target:** 4–6

### E12 — Generic Module Positioning Layer

- **Objective:** Retain module execution architecture while reducing cognitive overload.
- **Contains:**
  - module discoverability policy
  - lens alignment metadata
  - fallback and "module not found" modernization
  - progressive disclosure in nav
- **Surface scope:** Generic Modules, Navigation, Information Architecture
- **Strategy:** **Keep runtime, Improve entry semantics, Delay full lens migration**
- **Dependencies:**
  - E3 Navigation Parity
  - E6 Galaxy Semantics
- **Enables:**
  - safe integration of MBDE-facing future opportunities without IA sprawl
- **Effort:** M
- **Risk:** Medium
- **Phase target:** 2–5

### E13 — Accessibility and Cognitive Safety Layer

- **Objective:** Make cognitive accessibility first-class quality gate.
- **Contains:**
  - mobile reachability guarantees
  - focus order and trap consistency
  - decision-density limits
  - readability and plain-language checks
- **Surface scope:** Mobile, Modals, Navigation, Loading, Errors, Language
- **Strategy:** **Keep primitives, Improve enforcement**
- **Dependencies:**
  - E0 Arrival Welcome Layer (accessible first-contact baseline)
  - E3 Navigation Parity
  - E4 Orchestrator
- **Enables:**
  - resilient rollout of home and emotional layers
- **Effort:** M
- **Risk:** Medium
- **Phase target:** 0–6 (continuous)

---

## Phase Mapping (Roadmap → Backlog)

- **Phase 0 — Arrival Welcome Layer:**
  - E0, E13 (first-contact accessibility baseline)
- **Phase 1 — Foundation:**
  - E1, E2 (start), E4 (orchestration baseline), E9, E10, E13
- **Phase 2 — Navigation:**
  - E3, E8 (persistent language access), E12 (discoverability baseline), E9 (route recovery completion)
- **Phase 3 — Journey Guide:**
  - E5, E8 (guide parity completion), E4 (first-session sequencing hardening)
- **Phase 4 — Galaxy semantics:**
  - E6, E11 (instructional motion constraints), E12 (lens metadata alignment)
- **Phase 5 — Home redesign:**
  - E7, E2 (home-facing situation expression completion)
- **Phase 6 — Emotional polish:**
  - E11 (final), E10 (tone calibration), E13 (final audits)

---

## Dependency Order (Execution-Critical)

```
E0 Arrival Welcome Layer
 ↓
E1 Certainty Layer
 ↓
E3 / E4 / E9 / E10
```

**Why E0 precedes E1:** Language and trust are prerequisites for certainty. A user cannot feel oriented ("where am I, what next, why") until they can read in their language and believe the product is for them. Certainty Navigation begins at first contact — not after the user deciphers English marketing copy and finds hidden settings.

Extended chain:

1. **E0 → E1 → E3/E4/E9/E10**
2. **E3 + E4 + E8 → E5**
3. **E5 + E1 → E6**
4. **E0 + E2 + E3 + E5 + E6 → E7**
5. **E11 after E5/E6** (polish only after structure)

---

## Definition of Done for This Backlog

- Each epic has:
  - owner
  - measurable UX outcomes
  - regression guard tests
  - rollout flag strategy
  - rollback criteria
- No roadmap phase starts without dependency epics in "accepted" state.
