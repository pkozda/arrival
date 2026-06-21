# arr-018 — Life Event v1.0 polish, demo showcase, and platform integration gate

**Branch:** `arr-018`  
**Tracks:** Life Event PH-3 / PH-4 / PH-5 · P0 Home stabilization · ARR-018 platform integration audit  
**Base:** `develop` (post arr-017)

Closes the **Life Event Module v1.0 product line** after the arr-016 architecture freeze. This branch is **presentation, dev tooling, documentation, and platform audit only** — LE-1–LE-8 planner logic, API contracts, ActionSurface, and ExecutionSurface remain frozen.

**Product verdict:** Life Event v1.0 module is **accepted**; module development **pauses here**. Platform planning-authority work is deferred to a future track (see Part 5).

---

# Part 1 — PH-3: Visual Polish & Wireframe System

Elevates Life Event from functional wireframe compliance to **presentation-quality demo surface** without changing planner, API, ActionSurface, ExecutionSurface, scenarios, or runtime behavior.

**Completion report:** [ph-3-visual-polish-completion.md](../life-events/ph-3-visual-polish-completion.md)  
**Wireframe spec:** [life-event-module-v1.0-figma-wireframe.md](../life-events/life-event-module-v1.0-figma-wireframe.md)

## Summary (PH-3)

Shared `le-ux` presentation layer for Home and module surfaces: severity tokens, hero/breakdown/insight hierarchy, empty states, mobile stacking, a11y focus rings.

```text
LifeEventPlanV1 → projectActionSurface → le-ux wireframe → HomeLifeEventWireframe / ModuleLifeEventWireframe
```

## What was done (PH-3)

### CSS design system

| Piece | Location |
|-------|----------|
| Presentation tokens + component classes | `apps/web/src/app/life-event-polish.css` |
| Severity / confidence mapping | `apps/web/src/lib/presentation/le-ux/severity.ts` |
| Empty states | `apps/web/src/lib/presentation/le-ux/components/LeEmptyState.tsx` |

### `le-ux` wireframe components (`apps/web/src/lib/presentation/le-ux/`)

| Component | Role |
|-----------|------|
| `LifeEventWireframeLayout` | Shared Home + module shell |
| `HomeLifeEventWireframe` | Home `NextStepsCard` body |
| `ModuleLifeEventWireframe` | `/modules/life-event` plan body |
| `HeroActionBlock` | Primary focus CTA |
| `ActionBreakdownBlock` | Next / blocked / contextual columns |
| `InsightBlock` | P4 hints + completeness inside LE card |
| `HeaderContextBlock` | Life state + plan confidence |
| `ScenarioBanner` | LE-7 overlay banner |
| `WireframeSkeleton` | Loading state |

### Updated surfaces (presentation only)

`LifeEventPlanNodeCard`, `LifeEventPlanView`, `LifeEventScenarioExplorer`, runtime feedback, module page shell, `globals.css` / `layout.tsx` imports.

---

# Part 2 — PH-4: Demo Content & Showcase Pass

Additive, removable demo layer for stakeholders — real planner + real API, no LE logic changes.

**Completion report:** [ph-4-demo-showcase-completion.md](../life-events/ph-4-demo-showcase-completion.md)  
**Demo mode:** [life-event-demo-mode.md](../life-events/life-event-demo-mode.md)

## Summary (PH-4)

```text
Demo persona → POST /api/dev/demo/load-preset → UserContext seed
            → GET /api/modules/life-event/plan → Home + module wireframe
```

## What was done (PH-4)

### Package `@arrival-atlas/life-event-demo`

| Piece | Role |
|-------|------|
| `personas.ts` | F01, F04, F08, F10 demo personas |
| `presets.ts` | Session presets mapped to classifier fixtures |
| Tests | 9 package tests |

### API (dev-only)

| Route | Role |
|-------|------|
| `GET /api/dev/demo/presets` | List presets with live summaries |
| `POST /api/dev/demo/load-preset` | Seed session `userContext` from fixture |
| `apps/api/src/routes/demo-tools.ts` | Route handlers |
| `demo-presets.api.test.ts` | 6 API tests |

### Web dev UX

| Piece | Role |
|-------|------|
| Header drawer → **Life Event demos** | Four persona preset buttons |
| `AppProvider.loadDemoPreset` | Load preset + `refreshSessionState` |
| `next.config.mjs` | `transpilePackages` for `@arrival-atlas/life-event-demo` |

### Showcase documentation

| Document | Role |
|----------|------|
| `life-event-guided-walkthroughs.md` | 4× guided flows |
| `life-event-showcase-gallery.md` | Screenshot catalog |
| `life-event-product-story.md` | Non-technical product narrative |
| `life-event-before-after.md` | Before/after story |
| `life-event-executive-summary.md` | Stakeholder summary |
| `docs/life-events/screenshots/` | 10 SVG placeholders + capture README |

---

# Part 3 — P0 Stabilization (Product Acceptance Blockers)

Addresses blocking findings from [life-event-v1.0-product-acceptance-review.md](../life-events/life-event-v1.0-product-acceptance-review.md).

## What was done (P0)

| Issue | Fix |
|-------|-----|
| Cold-start Home → no Life Event entry | `LifeEventColdStartCard` + `shouldShowLifeEventColdStart` |
| Home shell English-only | LE Home strings in `life-event-translations.ts` (EN/DE/RU/UA) |
| Dual planning metaphors on module page | `ScenarioExplorerPanel` collapsed by default; `?mode=scenarios` to open; **Simulation mode** label |

### Key files

- `apps/web/src/components/home/LifeEventColdStartCard.tsx`
- `apps/web/src/components/life-event/ScenarioExplorerPanel.tsx`
- `apps/web/src/lib/presentation/home-p0.ts`
- `apps/web/src/lib/presentation/home-p0-stabilization.test.ts`
- Localized: `YourSituationSummaryCard`, `SuggestedModulesSection`, `HomeSnapshotRenderer`, `MissingContextHintsCard`

---

# Part 4 — PH-5: Final Stabilization Pass

Post-P0 polish: microcopy, i18n sweep, Home IA, scenario panel UX, edge states.

**Completion report:** [ph-5-final-stabilization-completion.md](../life-events/ph-5-final-stabilization-completion.md)

## Summary (PH-5)

Home always shows **plan OR cold start OR loading skeleton**. Secondary competing sections hidden when plan, cold start, or loading is active.

## What was done (PH-5)

| Area | Change |
|------|--------|
| Home microcopy | LE-toned strings: situation, cold start, catalog, completeness |
| i18n | Cold start duration/reassurance, prefill messages, simulation hierarchy |
| Scenario panel | Renamed **Simulation mode**; embedded explorer; visual demotion |
| Home IA | `shouldHideHomeSecondarySections` — hides catalog, priority actions, suggestions when plan active |
| Cold start | Hides duplicate situation card during FTU cold start |
| Edge states | Loading skeleton `aria-label`; meaningful-state helpers |
| Tests | `ph5-final-stabilization.test.ts` (7 tests) + updated P0 suite |

### Release criteria met

- Home always shows plan OR cold start OR loading skeleton
- No legacy English dashboard phrases in LE Home components
- Scenario Explorer visually and linguistically subordinate
- Microcopy consistent (plan / situation / next step vocabulary)

---

# Part 5 — ARR-018: Platform Integration Audit

Principal Product Architect gate: **has Life Event become the platform planning authority?**

**Audit:** [life-event-platform-integration-audit.md](../audits/life-event-platform-integration-audit.md)

## Intended architecture

```text
UserContext → Profile Intelligence → Life Event Planner → Home → Modules
```

## Audit verdict

| Dimension | Result |
|-----------|--------|
| Platform maturity | **Level 3 — Guided platform** (not Level 4 Planning platform) |
| Home (plan active) | ~75% guidance from Life Event; LE-6 dedup suppresses overlapping P4/suggestions |
| Competing authorities | Legacy `buildUXActionPlan` action cards, `suggestModules()`, Header module catalog |
| Module integration | Strong **inbound** (`open_module` from graph); **no outbound** return-to-plan loop |
| LE-8 runtime | Library exists; **not wired** to Home execution flow |
| Final verdict | **Life Event is still one module among many** |

Module development **stops at this gate**. Recommended next platform priorities (1–10) are documented in the audit — not implemented in this branch.

---

## Architecture compliance (full branch)

| Constraint | Status |
|------------|--------|
| No LE-1–LE-8 logic changes | ✓ |
| No planner / graph / classifier changes | ✓ |
| No ActionSurface / ExecutionSurface changes | ✓ |
| Demo tooling removable / dev-gated | ✓ |
| Real planner + real plan API in demos | ✓ |
| P4 reads advisory only; LE-6 dedup unchanged | ✓ |

## Deferred (explicitly out of scope)

- Plan-aware module chrome / return-to-plan navigation
- LE-8 runtime feedback wiring on Home
- Retiring legacy UX `actionCards` / `suggestModules` as competing planners
- Production-safe demo path (dev-only in this branch)
- PNG screenshot replacement (SVG placeholders + capture guide included)
- Benefits v2 / Healthcare v2 platform integration

---

## Test plan

### Automated

- [ ] `npm test` — workspace tests pass
- [ ] `@arrival-atlas/life-event-demo` — persona/preset tests (9)
- [ ] `apps/api` — `demo-presets.api.test.ts` (6)
- [ ] `apps/web` — `home-p0-stabilization.test.ts`, `ph5-final-stabilization.test.ts`
- [ ] `apps/web` — `le-ux-wireframe.test.ts`, `le-ux-ph3.test.ts`, `l10-ph2-full-activation.test.ts`
- [ ] Life Event + le-ux regression suite (~289 tests)

```bash
npm run test --workspace=@arrival-atlas/life-event-demo
npm run test --workspace=apps/api -- --run demo-presets dev-tools
npm run test --workspace=apps/web -- --run src/lib/presentation src/lib/life-event
```

### Smoke (manual)

- [ ] **Cold start:** fresh session → Home shows cold-start card (not empty `NextStepsCard`)
- [ ] **Plan active:** Header → Life Event demos → `new-arrival` → Home plan card visible; catalog/priority/suggestions hidden
- [ ] **i18n:** switch DE/RU/UA → Home LE surfaces localized
- [ ] **Scenario demotion:** `/modules/life-event` — explorer collapsed; `?mode=scenarios` opens simulation panel
- [ ] **Demo presets:** each persona loads plan via real `GET /api/modules/life-event/plan`
- [ ] **Regression:** profile correction + module execute refresh plan via `refreshSessionState`
- [ ] **Docs:** platform integration audit linked from `docs/README.md`

---

## Related docs

- [life-event-module-v2-v1.0-architecture-freeze.md](../life-events/life-event-module-v2-v1.0-architecture-freeze.md)
- [life-event-v1.0-product-acceptance-review.md](../life-events/life-event-v1.0-product-acceptance-review.md)
- [le-6-consistency-rules.md](../life-events/le-6-consistency-rules.md)
- [life-event-module-v1.0-ux-blueprint.md](../life-events/life-event-module-v1.0-ux-blueprint.md)
- [arr-016-pr-description.md](./arr-016-pr-description.md) — prior LE core + P4 track
