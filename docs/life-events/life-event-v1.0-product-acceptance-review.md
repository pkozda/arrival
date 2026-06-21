---
id: life-event-v1.0-product-acceptance-review
title: Life Event Module v1.0 — Product Acceptance Review
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: life-events
status: active
maturity: draft
owner: product
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - life-event-module-v2-v1.0-architecture-freeze
  - life-event-module-v1.0-ux-blueprint
  - life-state-model
  - life-event-module-v2-roadmap
  - ph-4-demo-showcase-completion
related:
  - life-event-demo-mode
  - life-event-executive-summary
  - adr-001-life-event-layered-architecture
  - adr-004-le-7-scenario-overlay
---

# Life Event Module v1.0 — Product Acceptance Review

**Reviewer lens:** Product Lead / UX Architect  
**Gate:** arr-017 closure  
**Scope:** User and product readiness — not code quality  
**Evidence base:** Architecture freeze, UX blueprint, life-state model, ADR-001–005, wireframe implementation (`le-ux`), PH-2/PH-3/PH-4 deliverables, demo personas F01/F04/F08/F10

---

## Executive Summary

The Life Event Module has crossed an important threshold: for a user with sufficient profile context, it delivers a credible answer to *"What should I do next in Germany?"* The planning loop—life state → hero focus → blockers → next actions—is implemented with discipline. PH-1 wireframe order, PH-3 visual polish, and PH-2 content localization inside the module surface make the core experience demo-worthy and aligned with the frozen LE-1–LE-5 architecture.

That strength is real but narrow. It depends on profile-backed context. A first-time visitor to Home without situation data does not meet the roadmap north star ("next step in ≤ 2 clicks"). `NextStepsCard` renders nothing when no plan exists, while English-only Home chrome ("Your situation", "Browse topics by category") still dominates the page. For DE/RU/UA users—the primary audience—this creates a mixed-language product that undercuts the localization investment inside the Life Event wireframe.

The module page compounds the coherence problem. The authoritative planner view (LE-1–LE-5) sits above a fully interactive legacy Scenario Explorer (`EVENT_HANDLERS` / `execute()`), architecturally permitted as an appendix but product-confusing: two different planning metaphors on one screen without a clear "this is simulation, that is your real plan" narrative for non-experts. Demo personas and showcase docs are strong for internal stakeholders; production demo paths and real screenshots are not yet partner-grade.

**Recommendation:** The planning core is release-quality for *profiled* users. The *product feature* is not yet acceptable as finished v1.0 for general release without addressing cold-start value delivery and Home-level localization coherence.

---

## Strengths

1. **Clear planning hierarchy on LE surfaces** — Fixed vertical order (context → scenario hint → hero → breakdown → insight) matches the UX blueprint and Figma wireframe spec.
2. **Single primary CTA discipline** — `HeroActionBlock` exposes one dominant action; severity styling reinforces urgency without alarmism.
3. **Life state model is user-visible** — Localized state badges (`life-event.state.*`) make abstract classifier output legible.
4. **Blocker separation works** — Dedicated blocked column with positive empty states reduces anxiety when no blockers exist (Persona D).
5. **Real planner-backed demos** — Four personas produce deterministic, test-verified plans via fixtures—not mocked UI.
6. **Deep LE localization** — PH-2 tests confirm shell + content keys for EN/DE/RU/UA; node titles, graph intent, and rationale strings are translated in `life-event-content/*.json`.
7. **Home dedup when plan is active** — LE-6 correctly suppresses legacy `PriorityActionsSection` and `SuggestedModulesSection` when the plan card is showing.
8. **Scenario overlay respects ADR-004** — LE-7 banner is interpretive only; it does not mutate the plan.
9. **Confidence communication** — Plan confidence pill gives appropriate epistemic humility without fake progress bars.
10. **Showcase layer is unusually complete** — Walkthroughs, before/after narrative, executive summary, and demo-mode runbook exceed typical v1.0 documentation.

---

## Weaknesses

1. **Cold-start Home fails the product promise** — Empty or minimal profile → no `NextStepsCard`; user sees generic module catalog instead of life-event guidance.
2. **Home shell not localized** — `YourSituationSummaryCard`, "Browse topics by category", Header "Your situation" remain hardcoded English.
3. **Dual systems on `/modules/life-event`** — Authoritative plan + legacy form-driven explorer without strong user-facing separation.
4. **Timeline de-emphasized** — Blueprint Zone 4 timeline lives in a collapsed "Upcoming steps" `<details>` on module (`contextualDefaultOpen={false}`).
5. **Profile ↔ Plan relationship unclear** — User must infer that correcting profile changes the plan; no explicit "update your situation to improve this plan" bridge on module hero.
6. **P4 hints may surface English** — e.g. `selectors.ts`: "Your situation is mostly complete." on Home insight path.
7. **Home cognitive load remains high** — Situation summary + plan + full module catalog + execution history compete for attention even when plan is active.
8. **Scenario discoverability is weak** — Scenarios require URL params (`?event=job_loss`) or action links; no obvious entry point for exploratory users.
9. **Demo mode is dev-only** — Stakeholder demos require `NODE_ENV=development` and engineer-operated preset loading.
10. **Showcase screenshots are wireframe placeholders** — Partner/investor materials lack captured product UI.

---

## Product Readiness Scorecard

| Area | Score | Rationale (summary) |
|------|-------|---------------------|
| **User Value** | **7.0** | Strong for profiled users; weak/obscure for FTU cold start |
| **Information Architecture** | **6.5** | Excellent within LE wireframe; Home and module page still fragmented |
| **Planning Experience** | **8.0** | State, focus, blockers, reasoning localized; timeline underplayed |
| **UX Quality** | **7.5** | PH-3 polish on LE surfaces; Home chrome visually and structurally older |
| **Localization** | **6.0** | LE module complete; Home/profile shell breaks locale consistency |
| **Scenario Experience** | **5.5** | LE-7 banner fine; legacy explorer confuses; low discoverability |
| **Demo Readiness** | **7.0** | Scripts/personas strong; dev-gated tooling; placeholder screenshots |
| **Product Coherence** | **6.0** | Feels like plan engine + legacy module + catalog, not one product |

**Average score: 6.7 / 10**

---

## Area Findings (Evidence)

### 1. User Value — 7/10

**Works:** Demo Persona A immediately surfaces "Complete Anmeldung" at critical severity. Home card title `life-event.home.title` ("Your next steps in Germany") states intent plainly. Four personas cover arrival, disruption, benefits, and stability arcs.

**Gaps:** Roadmap north star requires understanding next step from Home in ≤2 clicks. A user with `{ profile: null }` gets no plan card (`HomeLifeEventWireframe` returns `null` when `!plan`). Value proposition is obvious only *after* situation data exists—not on first open.

---

### 2. Information Architecture — 6.5/10

**Works:** `LifeEventWireframeLayout` enforces cognitive layers without interleaving. Hero dominance is correct. LE-6 hides duplicate priority/suggested modules when plan is active.

**Gaps:** `YourSituationSummaryCard` always renders above the plan—duplicate "situation" framing. "Browse topics by category" re-introduces module-grid navigation the plan was meant to replace. Module page ends with `LifeEventScenarioExplorer`—a second major IA branch on the same scroll.

---

### 3. Planning Experience — 8/10

**Works:** `HeaderContextBlock` shows state + confidence. Breakdown columns map to next/blockers/contextual actions. `localizeWhyThisNow` / `localizeWhatIsBlocking` use graph intent and node rationale keys across locales. Persona B correctly elevates employment stabilization with income blockers.

**Gaps:** Timeline nodes are hidden by default on module. "Plan confidence: Moderate" may be read as product uncertainty rather than data completeness—microcopy could be clearer. Stable resident (Persona D) can feel anticlimactic without explicit "you're in good shape" framing.

---

### 4. UX Quality — 7.5/10

**Works:** `life-event-polish.css` delivers hero gradient, severity system, mobile stacking at ≤768px, focus rings, reduced-motion support. Module hero CTA hierarchy is unambiguous. Explorer visually separated via `le-explorer` dashed lane + simulation badge (PH-3).

**Gaps:** Home sections outside `le-*` still use inline styles and generic `.card` treatment—visible quality step-down from plan card to surroundings. Mobile module page is usable but long (plan + explorer scroll).

---

### 5. Localization — 6/10

**Works:** `l10-ph2-full-activation.test.ts` validates all `LIFE_EVENT_I18N_KEYS` and `LIFE_EVENT_CONTENT_I18N_KEYS` for EN/DE/RU/UA. State labels never leak raw IDs in non-English locales. Schema explorer labels localized (L10-A2).

**Gaps:** Home shell strings are English-only (`YourSituationSummaryCard`, `HomeSnapshotRenderer` section titles, Header nav). A German user sees localized plan inside English chrome—mixed-language artifact. Some RU/UA strings retain "Anmeldung" (domain-acceptable but not fully naturalized).

---

### 6. Scenario Experience — 5.5/10

**Works:** LE-7 `ScenarioBanner` is optional and non-authoritative per ADR-004. Resolver is deterministic and tested. Explorer has localized title/description and simulation badge.

**Gaps:** Users cannot easily distinguish "my real plan" from "legacy scenario simulation." Explorer uses different content model (phases/checklists from `EVENT_HANDLERS`) than `LifeEventPlanV1`. No in-product scenario picker; discovery depends on deep links or planner action refs.

---

### 7. Demo Readiness — 7/10

**Works:** Four personas map to F01/F04/F08/F10 with verified API + planner parity. Guided walkthroughs, before/after, executive summary support a 10-minute stakeholder narrative. Persona differentiation is compelling (critical → high → medium → low severity arc).

**Gaps:** Presets load only via dev tools—not a production-safe demo path. Screenshot catalog is SVG wireframes, not product captures. Demo alert UX (`window.alert`) is not presentation-polished.

---

### 8. Product Coherence — 6/10

**Works:** LE-1–LE-5 pipeline feels like one system end-to-end. Home plan card and module page share `LifeEventWireframeLayout`. Life state model, graph catalog, and fixtures align across docs and runtime.

**Gaps:** Three parallel user mental models coexist: (1) profile/situation mirror, (2) deterministic life-event plan, (3) legacy scenario executor. Architecture freeze documents this; the product does not yet reconcile it for a newcomer. Result: **closer to B (multiple systems)** than A, though the plan engine is clearly the intended center of gravity.

---

## Blocking Issues

These should prevent v1.0 product acceptance for arr-017:

1. **Cold-start value delivery** — First-time Home visit does not surface Life Event guidance until profile exists; fails the module's primary user question and roadmap north star for the majority of real onboarding flows.

2. **Home-level localization incoherence** — Target locales (DE/RU/UA) receive a fully localized plan inside an English Home shell; this is a product-quality defect for the stated audience, not a polish item.

3. **Unreconciled dual experience on the module page** — Planner plan and legacy Scenario Explorer present as co-equal features without user-facing framing strong enough for non-engineers; undermines "one coherent feature" acceptance.

---

## Non-Blocking Improvements

### P0 (post-acceptance, high impact)

1. FTU → plan bridge: minimal profile capture or explicit "start here" empty state that still orients toward first life state
2. Localize Home shell strings (`Your situation`, browse sections, nav)
3. Collapse or tab the Scenario Explorer by default; label it "Simulation (optional)" above the fold

### P1

4. Open timeline section by default for arrival/critical states
5. Replace SVG showcase assets with real PNG captures
6. Production-safe demo preset path (or guided tour) for partners
7. Localize P4 completeness strings on Home

### P2

8. Reduce Home module catalog prominence when plan is active
9. Stronger scenario discovery entry (in-plan CTA, not URL-only)
10. Remove `window.alert` from demo preset loading

---

## Final Verdict

### **NEEDS ADDITIONAL WORK**

**Justification:** The LE-1–LE-5 planning experience—when fed with profile context—is architecturally sound, visually polished, and demonstrably valuable across four canonical personas. That is sufficient for an **engineering freeze** and internal demo readiness, but not for **finished product feature** acceptance.

A migrant opening Atlas in German on day one still hits English Home chrome and may see no plan at all. The module page still asks users to hold two planning models in mind at once. Until cold-start value delivery and locale-coherent Home experience are addressed—and the module page narrative clearly subordinates the legacy explorer—the feature should not be closed as v1.0 product-complete on arr-017.

**Conditional path to READY FOR RELEASE:** Accept as **v1.0-beta / internal-stakeholder** now; promote to **product release** after P0 items (FTU plan entry + Home shell localization + explorer framing) ship as a presentation-only pass—consistent with PH-1–PH-4 constraints.
