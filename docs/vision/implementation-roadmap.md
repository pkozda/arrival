# Arrival Atlas — Vision to Implementation Roadmap

Status: draft migration strategy  
Scope: Version 1 -> Certainty Navigation model  
Constraint: preserve existing engineering investments (galaxy runtime, Journey Guide engine, profile mutation pipeline, module contracts)

---

## North Star

Target interaction remains:

1. Situation is explicit and trusted.
2. One next step is always visible and explainable ("because ...").
3. Dependency map stays available as proof, not as mandatory cognitive burden.

This roadmap prioritizes migration over redesign: re-sequencing, relabeling, progressive behavior changes, and shell-level convergence before deep UI replacements.

---

## Gap Matrix by Surface

Scoring model (1-10): higher is better alignment with Vision pillars  
Pillars: Certainty Navigation, Situation First, One Next Step, Anxiety Reduction, Progressive Disclosure

### 1) Home

- Current behavior: guest marketing landing + star map; exploring state uses member slider narrative deck.
- Vision alignment: **3/10**
- Problems: module-first framing, duplicate CTAs, weak urgency path; onboarding philosophy explicitly flags current home as anti-pattern.
- Migration strategy: **Split + Improve + Delay Replace**
  - Keep map assets and slider rendering tech.
  - Improve entry copy and CTA semantics for honest preview.
  - Split "urgent start" path from "understand the product" path.
  - Delay full visual replacement until Phase 5.
- Risk: Product expectation mismatch if copy shifts without clear flow handoff.
- Engineering cost: **M**
- Dependencies: E0 Arrival Welcome + certainty layer primitives before final home inversion.

### 2) Atlas HUD

- Current behavior: desktop top nav works; mobile <=960 hides nav; guest/exploring state gate by demo flag.
- Vision alignment: **4/10**
- Problems: mobile navigation disappearance, module names over user intent, language control not in production HUD.
- Migration strategy: **Keep shell, Improve IA labels, Replace mobile navigation pattern**
- Risk: Regression in route discoverability while changing persistent chrome.
- Engineering cost: **M**
- Dependencies: nav information architecture decisions; shared route taxonomy.

### 3) Bootstrap

- Current behavior: guarded loading/error and recreated-session notice with retry and focus trap.
- Vision alignment: **7/10**
- Problems: wording still technical in places; "session" concept leaks implementation.
- Migration strategy: **Keep + Improve copy semantics**
- Risk: low; mostly messaging risk.
- Engineering cost: **S**
- Dependencies: E0 Arrival Welcome (first-contact language) + copy system.

### 4) Journey Guide

- Current behavior: strongest v1 surface (recommendations, lock explanation, route preview, unlock cinematic), but starts with mode election.
- Vision alignment: **6/10**
- Problems: first-visit mode choice violates "guide before exploration"; occasional overlap with intake; guide language parity incomplete.
- Migration strategy: **Keep core engine, Improve defaults, Remove first-visit election**
- Risk: users accustomed to independent-first entry may feel reduced control.
- Engineering cost: **M**
- Dependencies: intake sequencing, language pipeline, certainty layer component contract.

### 5) Life Events

- Current behavior: galaxy + guide + intake overlay + scenario explorer; rich dependency teaching.
- Vision alignment: **7/10**
- Problems: first-visit overlay stacking risk; intake is still form-like and surface-local.
- Migration strategy: **Keep + Improve sequencing + Merge intake into cross-surface situation flow**
- Risk: can break existing successful guided path if sequencing is changed abruptly.
- Engineering cost: **M**
- Dependencies: shared "situation minimum facts" epic.

### 6) Economic Reality

- Current behavior: galaxy visualization and sections, but concept label remains abstract for novice users.
- Vision alignment: **5/10**
- Problems: unclear distinction from Life Events, weak "what now" framing, route split debt historically noted by audits.
- Migration strategy: **Keep computation/presentation engine, Improve framing, Merge entry semantics with "Money & Support" lens**
- Risk: taxonomy change can invalidate existing mental references and tests.
- Engineering cost: **M**
- Dependencies: IA consolidation and certainty layer.

### 7) Profile

- Current behavior: profile as galaxy summary/detail; useful as structure but heavier than required for simple truth checking.
- Vision alignment: **6/10**
- Problems: situation truth exists but not always presented as single coherent state object.
- Migration strategy: **Keep graph backend, Split UI into Situation summary first + map proof second**
- Risk: over-simplification could hide important dependencies.
- Engineering cost: **M**
- Dependencies: situation layer schema and confidence indicators.

### 8) Profile Edit

- Current behavior: robust mutation flow, purpose-driven field rendering, reliable save.
- Vision alignment: **7/10**
- Problems: success feedback primarily via destination toast; emotional reassurance and field-purpose clarity inconsistent.
- Migration strategy: **Keep + Improve confirmation loop and contextual guidance**
- Risk: minor behavioral regressions around redirect and toast timing.
- Engineering cost: **S**
- Dependencies: shared write-confirmation pattern.

### 9) Generic Modules

- Current behavior: contract-based dynamic pages with schema form + result/explain panels.
- Vision alignment: **5/10**
- Problems: module-centric framing, dead-end copy ("Module not found"), hidden value from primary navigation.
- Migration strategy: **Keep runtime architecture, Improve discoverability and fallback states, Delay major reframing**
- Risk: exposing too many modules too early increases decision load.
- Engineering cost: **M**
- Dependencies: lens taxonomy and progressive disclosure rules.

### 10) Navigation

- Current behavior: mixed patterns (HUD + hidden Header drawer + route-specific structures).
- Vision alignment: **4/10**
- Problems: inconsistency between available navigation systems; primary destinations not universally reachable in <=2 taps on mobile.
- Migration strategy: **Merge navigation systems into one production pattern**
- Risk: high regression risk across all surfaces.
- Engineering cost: **L**
- Dependencies: Phase 1 telemetry, route map freeze, mobile-first acceptance criteria.

### 11) Mobile

- Current behavior: responsive visuals are strong, but primary navigation access fails in critical flows.
- Vision alignment: **3/10**
- Problems: violates "Mobile is primary reality"; critical path trap risk.
- Migration strategy: **Replace mobile nav behavior first, keep existing visual layers**
- Risk: medium-high; shell-level changes affect every page.
- Engineering cost: **M**
- Dependencies: navigation epic and accessibility regression suite.

### 12) Loading

- Current behavior: skeletons and overlays exist across bootstrap and modules.
- Vision alignment: **7/10**
- Problems: some copy is generic; certainty framing ("what is happening now") could be stronger.
- Migration strategy: **Keep + Improve explanatory loading states**
- Risk: low.
- Engineering cost: **S**
- Dependencies: copy framework.

### 13) Errors

- Current behavior: reusable `SurfaceErrorPanel` with retry; still some dead-end text on generic pages.
- Vision alignment: **6/10**
- Problems: inconsistent recovery actions; occasional dead-end phrasing.
- Migration strategy: **Keep component, Improve recovery action contracts, Remove dead-end strings**
- Risk: medium due to fragmented legacy paths.
- Engineering cost: **S-M**
- Dependencies: global recovery map.

### 14) Modals

- Current behavior: focus traps added for key dialogs; stacking risk remains on first Life Events entry.
- Vision alignment: **6/10**
- Problems: "one overlay at a time" violated by flow sequencing.
- Migration strategy: **Keep modal tech, Improve orchestration with overlay arbiter**
- Risk: sequencing regressions in onboarding.
- Engineering cost: **M**
- Dependencies: onboarding flow orchestrator.

### 15) Toasts

- Current behavior: profile correction toast works and auto-dismisses.
- Vision alignment: **6/10**
- Problems: confirmation loop split from source action; importance calibration varies.
- Migration strategy: **Keep + Improve severity/placement taxonomy**
- Risk: low.
- Engineering cost: **S**
- Dependencies: shared feedback policy.

### 16) Animations

- Current behavior: strong motion vocabulary; reduced-motion support exists; some cinematic flows can overrun urgency.
- Vision alignment: **6/10**
- Problems: instructional vs decorative boundaries still mixed (home motion, long reveal moments).
- Migration strategy: **Keep motion system, Improve urgency-aware and skippable behavior**
- Risk: medium; affects perceived quality and trust.
- Engineering cost: **M**
- Dependencies: emotional design and urgency signals.

### 17) Information Architecture

- Current behavior: route/module taxonomy leaks implementation ("Economic Reality", module catalog categories).
- Vision alignment: **4/10**
- Problems: weak mapping to user problem language; surface boundaries unclear for novice users.
- Migration strategy: **Split internal modules from external lens IA, then Merge user-facing navigation into lens model**
- Risk: high product and copy risk.
- Engineering cost: **L**
- Dependencies: vocabulary governance and cross-surface analytics.

### 18) Language

- Current behavior: translation infrastructure exists; critical guidance layers still partially English; picker hidden in unmounted `Header.tsx` — not reachable in production HUD.
- Vision alignment: **4/10**
- Problems: language parity gap violates "Language is infrastructure"; first contact is English-default; user must hunt for settings.
- Migration strategy: **E0 Arrival Welcome for first contact + E8 for full parity; Keep i18n plumbing**
- Risk: high trust risk for non-English users.
- Engineering cost: **M**
- Dependencies: E0 Arrival Welcome Layer (Phase 0); localization content ops and string extraction coverage (E8).

### 19) Accessibility

- Current behavior: good focus-trap progress and reduced-motion support; mobile reachability and cognitive accessibility still weak.
- Vision alignment: **6/10**
- Problems: nav reachability and complexity density issues remain.
- Migration strategy: **Keep a11y primitives, Improve cognitive and mobile accessibility gates**
- Risk: medium; broad regression surface.
- Engineering cost: **M**
- Dependencies: nav/mobile convergence and cognitive scorecard adoption.

---

## Dependency Graph (Migration-Critical)

```
E0 Arrival Welcome Layer
 ↓
E1 Certainty Layer
 ↓
E3 / E4 / E9 / E10
```

**Why E0 precedes E1:** Language and trust are prerequisites for certainty. A user cannot feel oriented until they can read in their language and believe the product is for them. The current flow (English landing → find language → understand metaphor → enter) inverts this order and blocks all downstream migration work.

Extended prerequisites:

1. **Arrival Welcome (E0)** — first-contact language and emotional safety before any guidance layer.
2. **Certainty layer (E1)** — explicit next-step framing across surfaces.
3. **Navigation parity (E3)** — prerequisite for almost every lens migration.
4. **Language parity (E8)** — prerequisite for guide-primary behavior beyond first contact.
5. **Overlay orchestration (E4)** — prerequisite for onboarding and Journey Guide defaulting.
6. **IA relabeling** — prerequisite for home redesign and certainty-layer clarity.
7. **Certainty + semantics** — prerequisite for emotional polish and final inversion (guide-primary, map-secondary).

---

## Phased Migration Roadmap

## Phase 0 — Arrival Welcome Layer

- Why now:
  - The first user interaction happens **before** any existing roadmap item.
  - Language and emotional safety are prerequisites for all later guidance.
  - Current flow assumes English literacy and product literacy before trust — inverted for stressed newcomers.
- Why not earlier:
  - N/A — this is the entry point.
- What this enables:
  - Language-first experience
  - Trust before complexity
  - Personalized onboarding in user's language
  - Future Guide-first model
  - Safe execution of Phases 1–6

Core outcomes:

1. **First visit language choice**
   - Language selector visible immediately on first contact
   - Supported languages: German, Ukrainian, Russian, English
   - Browser language detection with suggestion (never forced auto-apply)
   - Manual selection always available
   - Saved preference (session + durable storage)

2. **Welcome reassurance**
   - First experience communicates: "We understand you."
   - Avoid: technical terms, bureaucratic language, product architecture explanation
   - Plain preview framing: private guidance, not government, device-local

3. **First session state model**

   ```text
   New visitor:
     language unknown
       ↓
     language selected
       ↓
     welcome personalized
       ↓
     enter Atlas (existing flow)

   Returning visitor:
     saved language
       ↓
     skip welcome friction
       ↓
     resume previous context
   ```

4. **Primitive specification:** [primitives/arrival-welcome.md](./primitives/arrival-welcome.md)

**Strategy:** Add trust layer without replacing Home. Preserve visual identity and galaxy assets.

**Epic:** E0 — Arrival Welcome Layer ([ux-migration-backlog.md](./ux-migration-backlog.md))

## Phase 1 — Foundation (No Visual Redesign)

- Why now:
  - Lowest-risk unlock of trust: copy semantics, recovery consistency, overlay policy, instrumentation.
  - Prevents redesigning over unstable behavior.
- Why not earlier:
  - Requires Phase 0 language and trust baseline — certainty copy is meaningless if the user cannot read it.
- What this enables:
  - Measurable cognitive and certainty metrics across all surfaces.
  - Safe shell changes in Phase 2.

Core outcomes:
- Certainty copy baseline (bootstrap, loading, errors, toasts).
- Overlay arbiter contract (one blocking overlay at a time).
- Recovery map baseline (no dead ends).
- Instrumentation: time-to-next-step, mode-election fallout, nav reachability.

## Phase 2 — Navigation

- Why now:
  - Mobile trap and discoverability debt block all downstream improvements.
- Why not earlier:
  - Needs Phase 1 guardrails and telemetry to avoid shell regressions.
- What this enables:
  - Lens-based IA transition and reliable problem-first routing.

Core outcomes:
- Unified production navigation (desktop + mobile).
- Reachability <=2 taps to core lenses from anywhere.
- Language control accessible from production shell.
- Generic modules discoverability policy (promote, keep internal, or archive from top-level nav).

## Phase 3 — Journey Guide

- Why now:
  - Guide is strongest existing asset; defaulting it creates immediate certainty gain without rewriting map engines.
- Why not earlier:
  - Requires stable nav, language entry, and overlay orchestration from Phases 1-2.
- What this enables:
  - Situation-first onboarding and one-next-step consistency across surfaces.

Core outcomes:
- Remove first-visit guided/independent election.
- Guide default-guided with reversible independence.
- Lock, unlock, and because-explanation consistency.
- Localized guide shell and critical copy.

## Phase 4 — Galaxy Semantics

- Why now:
  - After guide behavior stabilizes, map semantics can be clarified without losing orientation.
- Why not earlier:
  - Semantic changes before navigation/guide stabilization increase confusion.
- What this enables:
  - Home inversion and lens-first framing with preserved graph runtime.

Core outcomes:
- Planet subtitle semantics (bureaucracy term + plain-language translation).
- Consistent lock and dependency explanation language.
- Situation/proof separation: map as evidence, not mandatory first step.
- Economic vs Life Events distinction in user language.

## Phase 5 — Home Redesign (Migration, Not Rewrite)

- Why now:
  - Requires stable IA labels, guide defaults, and map semantics.
- Why not earlier:
  - Earlier home change would route users into inconsistent downstream systems.
- What this enables:
  - Full Situation First entry and crisis-first branch.

Core outcomes:
- Problem-intake-first home.
- One urgent CTA path + optional "understand my map" depth path.
- Returning-user direct resume behavior.
- Home-to-lens handoff with certainty context.

## Phase 6 — Emotional Polish

- Why now:
  - Emotional layer should amplify already-correct sequencing, not mask structural confusion.
- Why not earlier:
  - Premature polish risks decorative UX debt.
- What this enables:
  - Durable trust, reduced anxiety, perceived intelligence of product guidance.

Core outcomes:
- Urgency-aware motion pacing and cinematic constraints.
- Confidence and reassurance microcopy tuning.
- Celebration proportionality and closure loops.
- Cross-surface tone alignment with product personality.

---

## Cross-Phase Risk Register

- Engineering risk:
  - Shell regressions in persistent HUD/nav and overlay sequencing.
  - Mitigation: feature flags per phase, route-level golden flows, mobile smoke suite.
- UX risk:
  - Over-correcting by hiding useful exploratory depth.
  - Mitigation: progressive disclosure contract, expert-path validation.
- Product risk:
  - Naming transition confusion for existing users.
  - Mitigation: staged relabeling with explanatory helper text.
- Regression risk:
  - Journey Guide + intake + modal orchestration collisions.
  - Mitigation: explicit state machine and one-overlay invariant tests.

---

## Preserve vs Change Summary

- Preserve:
  - Galaxy rendering/runtime and dependency graph mechanics.
  - Journey Guide recommendation/lock/unlock engine.
  - Profile mutation infrastructure.
  - Module contract execution architecture.
- Change incrementally:
  - Surface sequencing, entry semantics, naming, shell navigation, overlay orchestration, copy confidence.
- Avoid:
  - Big-bang redesign that discards proven educational graph interactions.

