---
id: life-event-platform-integration-audit
title: Life Event Platform Integration Audit (ARR-018)
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: platform
status: active
maturity: stable
owner: product-architecture
tags:
  - life-event
  - platform-integration
  - arr-018
  - home
  - planning-authority
created: 2026-06-20
updated: 2026-06-20
depends_on:
  - life-event-module-v2-v1.0-architecture-freeze
  - le-6-consistency-rules
  - life-event-v1.0-product-acceptance-review
  - ph-5-final-stabilization-completion
related:
  - life-event-module-v2-readiness-audit
  - profile-system-p4-roadmap
  - ux-contract-v1
---

# Life Event Platform Integration Audit (ARR-018)

**Date:** 2026-06-20  
**Auditor role:** Principal Product Architect  
**Scope:** Whether Life Event Module v1.0 has become the **primary planning layer** of Arrival Atlas — not a re-audit of LE module quality.  
**Evidence base:** Runtime code (`apps/web`, `apps/api`, `packages/modules`, `packages/profile-intelligence`), architecture freeze, LE-6 rules, PH-5 stabilization.

**Intended architecture:**

```text
UserContext → Profile Intelligence → Life Event Planner → Home → Modules
```

---

## Executive Summary

Life Event Module v1.0 is **technically complete and accepted as a module**, but it has **not** become the platform’s single planning authority. The platform currently behaves as a **guided, module-centric product** with a **strong Life Event overlay** when profile context is sufficient to produce a plan.

**What works**

- LE-1–LE-5 pipeline is live: `buildLifeEventPlan` → `GET /api/modules/life-event/plan` → Home `NextStepsCard` / module `LifeEventPlanView`.
- When a plan has a `currentFocus`, Home elevates Life Event to the hero surface and PH-5 hides competing secondary sections (catalog, legacy priority actions, heuristic suggestions).
- LE-6 deduplication suppresses overlapping P4 hints and `suggestModules()` items when the plan is active.
- Graph catalog v1 emits **24** `open_module` links into Financial Reality, Healthcare Navigation, and Benefits Simulator — strong **inbound** routing from plan nodes to modules.

**What blocks planning authority**

- **Parallel guidance systems** still exist at the data and navigation layers: legacy `buildUXActionPlan` snapshot `actionCards`, heuristic `suggestModules()`, full module catalog in Header, and P4 `missingContext` hints with independent CTAs.
- **No outbound closure loop**: module landing pages do not acknowledge plan context; LE-8 runtime signals are library-only and never passed into Home; module completion does not structurally update plan state (only indirect profile/snapshot refresh).
- **Cold-start and thin-context users** still experience a **module collection** Home, not a planner-first Home.
- Life Event remains **routed as a module** (`/modules/life-event`) alongside peers in Header navigation.

**Verdict (preview):** Life Event is **still only one module among many**, albeit the most capable planning surface when active. Platform maturity: **Level 3 — Guided platform** (not Level 4 Planning platform).

---

## Architecture Assessment

### 1. Platform Authority

| Concern | Authoritative system today | Life Event authoritative? |
|---------|---------------------------|---------------------------|
| **Prioritization** | Split: `LifeEventPlanV1.currentFocus` + `nextBestActions` when plan exists; otherwise `suggestModules()` heuristics + snapshot `actionCards` from `@arrival-atlas/ux` | **Partial** — wins on Home only when `projectActionSurface` returns a primary action |
| **Sequencing** | Life Event graph (`GRAPH_CATALOG_V1`) defines phased nodes, blockers, timeline | **Yes** for in-plan sequencing; modules do not publish sequence back |
| **Urgency** | Plan node `priority` (critical/high/medium) in LE wireframe; legacy `ActionCard.priority` in snapshot when no plan | **Partial** — dual priority vocabularies |
| **Next steps** | Home: `NextStepsCard` → `HomeLifeEventWireframe` when plan active; else cold-start card, suggested modules, or legacy priority actions | **Partial** — state-dependent |

**Conclusion:** Multiple systems **compete**. Life Event is authoritative **only in the “plan active” Home state**. Snapshot UX (`apps/api/src/ux-integration.ts`, `snapshot-projection-engine.ts`) and `situation-utils.suggestModules()` remain independent planners for users without a primary focus or when secondary sections are visible.

### Canonical pipeline (as implemented)

```text
UserContext (profile)
    ├─► Profile Intelligence (P4) ──► missingContext hints, completeness
    │         │
    │         └──► LE-6 merge/dedup (presentation only)
    │
    └─► Life Event LE-1 classifier + graph ──► LifeEventPlanV1
              │
              ├─► LE-4 ActionSurfaceV1 ──► LE-5 ExecutionSurfaceV1 (AEAL)
              │
              └─► Home NextStepsCard / Module LifeEventPlanView

Parallel (not subordinate to LE):
    Module executions ──► buildUXActionPlan ──► UiSnapshot.actionCards
    Profile gaps ──► suggestModules() ──► SuggestedModulesSection
    Header ──► full module catalog by category
```

---

## Home Ownership Assessment

### Surface inventory (`HomeSnapshotRenderer`)

| Surface | Source | Visible when |
|---------|--------|--------------|
| `LifeEventColdStartCard` | Life Event (PH-0/P0) | No plan, not loading |
| `YourSituationSummaryCard` | Profile-derived (`buildSituationSummary`) | Plan exists or non–cold-start |
| `NextStepsCard` / LE wireframe | Life Event plan + LE-4/5 + LE-6 P4 overlay | Plan with `currentFocus` |
| P4 hints inside LE `InsightBlock` | Profile Intelligence (deduped) | Non-suppressed hints |
| `SuggestedModulesSection` | `suggestModules()` heuristic | No plan card; not hidden by PH-5 |
| `PriorityActionsSection` | Snapshot `actionCards` / legacy UX | No plan card; not hidden by PH-5 |
| Browse topics (module grid) | Module registry catalog | `!hideSecondarySections` |
| Onboarding checklist | FTU heuristics | FTU state |
| Recent results | Execution history | Any executions |

PH-5 rule (`shouldHideHomeSecondarySections`): when plan loading, plan card visible, or cold start — **suppresses** suggested modules, priority actions, and browse grid. This is a **presentation policy**, not a platform authority declaration.

### Guidance origin estimate (by user state)

| User state | Life Event | P4 | Suggested Modules | Legacy (UX snapshot + catalog) |
|------------|------------|-----|-------------------|------------------------------|
| **Plan active** (primary focus exists) | **~75%** (hero + breakdown + timeline in card) | **~15%** (residual insight hints) | **~0%** (LE-6 suppressed) | **~10%** (header nav, execution history; secondary Home hidden) |
| **Cold start** (no plan) | **~35%** (cold-start CTA only) | **~0–10%** | **~25%** | **~30–40%** (situation summary + catalog + suggestions when profile thin) |
| **No plan, profile sufficient but empty focus** | **~0%** | **~20%** | **~30%** | **~50%** |

**Weighted platform average (all sessions, estimated):** Life Event **~45%**, P4 **~12%**, Suggested Modules **~15%**, Legacy **~28%**.

### Does Home have a single planning authority?

**No.** Home is a **composition layer** that prefers Life Event when `buildHomePlanViewModelV2` reports `showNextSteps`, but falls back to parallel heuristics and legacy UX without a unified planning API. LE-6 resolves **display collisions**; it does not establish a single backend planning owner.

---

## Integration Matrix

| System | Inbound (into Life Event) | Outbound (from Life Event) | Strength |
|--------|---------------------------|----------------------------|----------|
| **Profile** | `UserContext` / profile domains feed LE-1 classifier and graph satisfaction keys | Plan actions: `correct_in_profile` → `/profile/{slug}/edit` | **Strong** |
| **Profile Intelligence (P4)** | `ProfileInsightViewV1.missingContext` merged in `mergeP4WithPlan`; hints shown in LE `InsightBlock` | P4 does not consume plan; LE-6 suppresses duplicate hints | **Moderate** (advisory inbound; no outbound) |
| **Life Event Planner** | N/A (hub) | `open_module` links, profile corrections, scenario explore links | **Strong** (outbound design) |
| **Financial Reality** | Graph nodes link via `open_module` → `/modules/financial-reality` | No plan-aware return path; no LE-8 signal consumption on module page | **Inbound: Moderate** / **Outbound: None** |
| **Benefits Simulator** | Graph `open_module` links when benefits/housing context relevant | Same as above | **Inbound: Moderate** / **Outbound: None** |
| **Healthcare Navigation** | Graph `open_module` links for insurance/registration paths | Same as above | **Inbound: Moderate** / **Outbound: None** |
| **Suggested Modules** | Independent of LE; LE-6 suppresses overlaps when plan active | Can still recommend `life-event` in fallback order | **Weak** (parallel, partially deduped) |
| **Home Dashboard** | Renders LE plan card, cold start, P4 overlay | Links to `/modules/life-event`; does not own planning logic | **Moderate** (presentation owner, not authority) |
| **Legacy UX snapshot** | Module execution outputs → `buildUXActionPlan` | Populates `actionCards` on Home when plan inactive | **Weak** (competing authority) |

### Module pair detail

#### Financial Reality

- **Inbound:** `financialModule` in `GRAPH_CATALOG_V1` (`packages/modules/src/life-event/plan/graph/catalog.ts`); housing/employment nodes route users to `/modules/financial-reality`.
- **Outbound:** `ContractModulePage` is generic — no `from=plan` context, no “return to plan” chrome. `refreshSessionState()` refetches plan after execution but UI does not close the loop. LE-8 defines `financial-reality` → `benefits-simulator` signals in `cross-module-signal-engine.ts` but **not wired** (`runtimeEffect` never passed from `HomeSnapshotRenderer`).

#### Benefits Simulator

- **Inbound:** `benefitsModule` linked from benefits/support graph nodes.
- **Outbound:** None. Gated in `suggestModules()` by finance context independently of plan.

#### Healthcare Navigation

- **Inbound:** `healthcareModule` on insurance/registration nodes.
- **Outbound:** None. P4 may also CTA to healthcare with overlapping semantic keys (LE-6 handles Home only).

---

## Duplication Findings

| Overlap | Systems | Classification | Evidence |
|---------|---------|----------------|----------|
| “What to do next” on Home | Life Event vs `suggestModules` vs snapshot `actionCards` | **Partially resolved** | LE-6 + PH-5 hide secondary when plan active; heuristics still run and show when no plan |
| Missing-context CTAs | P4 `missingContext` vs plan node actions | **Partially resolved** | `dedupeHomeSurfaces` by semantic identity; P4 cannot add plan nodes (LE-6 invariant) |
| Module discovery | Plan `open_module` vs Suggested Modules vs Browse grid | **Partially resolved** | Plan links are authoritative in-card; catalog remains in Header always |
| Insurance / housing guidance | P4 domain hints vs graph nodes vs module landing copy | **Unresolved** at module layer | Module pages unaware of plan |
| Scenario exploration | LE-1–5 planner vs `LifeEventScenarioExplorer` execute path | **Unresolved** | Legacy `executeModule('life-event')` scenario form parallel to deterministic plan; demoted visually (PH-5) but same route |
| Priority language | Plan `priority` vs `ActionCard.priority` | **Unresolved** | Two vocabularies, two sources |
| Profile prefill messaging | P4 confidence on module pages vs LE insight on Home | **Partially resolved** | Shared `resolvePrefillConfidenceMessage`; different shells |

---

## Navigation Findings

### Intended journey: Life Event → Module → Action → Return to plan

| Step | Status | Notes |
|------|--------|-------|
| Home → Life Event plan | ✅ Works | `NextStepsCard`, cold start, “View full plan” → `/modules/life-event` |
| Plan node → Module | ✅ Works | `LifeEventPlanNodeActions` links `open_module` hrefs |
| Module → Action (execute) | ✅ Works | `ContractModulePage` + `executeModule`; `refreshSessionState` refetches plan |
| Module → Return to plan | ❌ Broken | No back link, no plan context banner, no `?from=plan` handling |
| Profile correction → Return to plan | ⚠️ Weak | Profile edit flows exist; no explicit “back to your plan” |
| Header → Module (bypass plan) | ✅ Works (by design) | Users can skip plan entirely via catalog |
| Scenario explorer → Plan | ⚠️ Ambiguous | Separate execution path; not the LE-1 planner output |

### Broken journeys (product-relevant)

1. **Module silo:** User follows plan CTA to Financial Reality, completes action, must manually navigate Home or Life Event module — no orienting breadcrumb.
2. **Cold start → Scenario mode:** `/modules/life-event?mode=scenarios` exposes legacy explorer without establishing planner authority first.
3. **Dual next-step surfaces:** User with thin plan (no `currentFocus`) sees suggested modules + priority actions instead of LE cold start — inconsistent mental model.
4. **LE-8 feedback gap:** Cross-module signals never surface after module execution on Home (`runtimeEffect` prop unused in `HomeSnapshotRenderer`).

---

## Platform Maturity Assessment

| Level | Definition | Fit |
|-------|------------|-----|
| 1 — Module collection | Catalog + isolated tools | Cold-start Home, Header nav |
| 2 — Connected modules | Shared profile, snapshot, prefill | Baseline for all users |
| 3 — Guided platform | Home surfaces prioritized guidance | **Plan-active Home** |
| 4 — Planning platform | Single authority; modules subordinate; closed loops | Not met |
| 5 — Adaptive platform | Runtime replanning from module signals | LE-8 library only |

### Rating: **Level 3 — Guided platform**

The platform **guides** users through a Life Event plan when context allows, but does not **govern** all prioritization, does not require modules to report into the planner, and preserves module-first navigation escape hatches.

### Planner-first vs module-first

| Signal | Planner-first | Module-first |
|--------|---------------|--------------|
| Home hero when plan exists | ✅ | |
| Header primary IA | | ✅ Module catalog by category |
| Default entry for new users | | ✅ Cold start offers scenarios without plan |
| Next steps without plan | | ✅ Heuristics + legacy UX |
| Module page contract | | ✅ Identical for all entry paths |
| API planning endpoints | ✅ `/api/modules/life-event/plan` | Parallel snapshot UX plan |

**Evidence-weighted classification: B — Module-first product** with a **planner-first Home slice** for users with sufficient profile context.

---

## Future Platform Risks

### Benefits v2 expansion

- **Risk:** Benefits Simulator gains its own recommendation engine and Home widgets → third competing planner beside LE and P4.
- **Mitigation need:** Benefits outputs must publish into `UserContext` only; Home CTAs must route through plan nodes or explicit LE-8 signals, not parallel “suggested benefits actions.”

### Healthcare v2 expansion

- **Risk:** Insurance workflows are long-running; users spend sessions inside Healthcare without plan continuity → plan feels optional.
- **Mitigation need:** Plan-aware module chrome, `planNodeId` query param, satisfaction key updates on profile mutation.

### Additional life states

- **Risk:** Graph catalog growth without classifier coverage → more users in “no primary focus” fallback → Home reverts to module collection.
- **Mitigation need:** Life state coverage SLAs tied to Home experience; empty-focus treated as product bug, not edge case.

### LE-8 wiring (if done ad hoc)

- **Risk:** Per-module signal hooks bypass LE-1 graph → fragmented replanning logic.
- **Mitigation need:** Single ingress: module execution → profile/satisfaction update → replan LE-1; LE-8 as presentation of diffs only.

### i18n / content drift

- **Risk:** Module landing copy and plan node labels diverge across DE/RU/UA as modules evolve independently.
- **Mitigation need:** Shared content keys or contract-level action labels for cross-surface CTAs.

---

## Recommended ARR-018 Priorities

Platform-level (ordered):

1. **Declare planning authority contract** — Document and enforce: when `LifeEventPlanV1` has `currentFocus`, no other system may emit Home-level next-step CTAs (retire or gate snapshot `actionCards` on Home).
2. **Plan-aware module shell** — `ContractModulePage` accepts `?planNode=` / shows “Part of your plan” + return link to Home and `/modules/life-event`.
3. **Wire LE-8 feedback loop** — Pass `processModuleRuntimeEvent` results into Home after `refreshSessionState`; show advisory replan hints.
4. **Close cold-start gap** — Minimum profile capture on Home that triggers plan generation without sending users to legacy scenario execute first.
5. **Remove or demote Header module catalog** when session has active plan (mirror PH-5 Home policy globally).
6. **Unify empty-focus handling** — If classifier returns no focus, show LE cold start + P4 completeness, not `suggestModules` + priority actions.
7. **Module → plan satisfaction bridge** — Map module execution outcomes to graph `satisfactionKey` updates (profile mutation or explicit plan revision API).
8. **Retire parallel scenario execute as equal citizen** — Keep simulation mode clearly non-authoritative; optional: block scenario execute when plan exists.
9. **P4 subordination API** — P4 reads plan overlay server-side and suppresses hints before client LE-6 (single dedup layer).
10. **Integration tests for navigation journeys** — E2E: Home plan CTA → module → profile/module action → Home shows updated focus.

---

## Final Verdict

### **Life Event is still only one module among many**

Life Event v1.0 is a **successful planning module** with real Home integration when the classifier produces a focus, but the platform has **not** transferred global planning authority to Life Event.

**Supporting evidence:**

1. **Competing planners remain live** — `buildUXActionPlan`, `suggestModules()`, and module catalog navigation are not subordinate to `LifeEventPlanV1`; they are only hidden by presentation flags when a plan card shows.
2. **Life Event is peer-routed** — Same Header category navigation as Financial Reality, Healthcare, and Benefits; `/modules/life-event` is not the default app root.
3. **Inbound > outbound** — Graph catalog strongly links **into** modules; modules do not link back or report structured completion into the planner.
4. **LE-8 not integrated** — Cross-module runtime contract exists in code but is explicitly frozen as library-only; no adaptive replanning loop.
5. **State-dependent authority** — Planning authority is **session-state conditional** (~75% LE on Home when plan active vs ~35% or less when not), which is incompatible with “platform planning layer” claims.
6. **Architecture freeze acknowledges gaps** — Full removal of `SuggestedModulesSection`, LE-8 wiring, and scenario engine consolidation remain **explicit backlog**, not done.

**What would change the verdict to “Life Event is now the platform planning authority”:**

- Single backend rule: all prioritization/sequencing/urgency/next-steps APIs derive from `LifeEventPlanV1` (or its successor), with other systems limited to inputs.
- Home and Header always treat modules as **execution surfaces** for plan nodes, never as parallel entry points.
- Closed navigation loop from every module action back to an updated plan surface.
- LE-8 or equivalent replanning path wired from module execution without duplicate UX planners.

---

## Appendix: Key code references

| Concern | Location |
|---------|----------|
| Home composition | `apps/web/src/components/home/HomeSnapshotRenderer.tsx` |
| Plan presentation + dedup | `apps/web/src/lib/life-event-plan/presentation-v2.ts`, `home-dedup.ts` |
| PH-5 secondary suppression | `apps/web/src/lib/presentation/home-p0.ts` |
| Graph → module links | `packages/modules/src/life-event/plan/graph/catalog.ts` |
| Legacy UX action cards | `apps/api/src/ux-integration.ts`, `state/snapshot-projection-engine.ts` |
| Heuristic module suggestions | `apps/web/src/lib/situation-utils.ts` (`suggestModules`) |
| LE-8 signals (unwired) | `apps/web/src/lib/life-event/runtime/cross-module-signal-engine.ts` |
| Architecture freeze scope | `docs/life-events/life-event-module-v2-v1.0-architecture-freeze.md` |
| LE-6 rules | `docs/life-events/le-6-consistency-rules.md` |

---

*Audit complete. Next track: ARR-018 platform integration work should target priorities 1–3 for maximum authority shift with minimum module rewrites.*
