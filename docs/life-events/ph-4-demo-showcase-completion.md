# PH-4 — Demo content & showcase pass (completion report)

**Status:** Complete  
**Constraint:** Additive, removable, presentation-only — no LE-1–LE-8 logic changes.

---

## Deliverables

| # | Deliverable | Location |
|---|-------------|----------|
| 1 | Demo personas (A–D) | `packages/life-event-demo/src/personas.ts` |
| 2 | Demo session presets (real planner + API) | `packages/life-event-demo/src/presets.ts`, `apps/api/src/demo/`, `POST /api/dev/demo/load-preset` |
| 3 | Guided walkthroughs | `docs/life-events/life-event-guided-walkthroughs.md` |
| 4 | Screenshot catalog | `docs/life-events/screenshots/` (10 SVG placeholders + README) |
| 5 | Showcase gallery | `docs/life-events/life-event-showcase-gallery.md` |
| 6 | Product story | `docs/life-events/life-event-product-story.md` |
| 7 | Before / after story | `docs/life-events/life-event-before-after.md` |
| 8 | Demo mode documentation | `docs/life-events/life-event-demo-mode.md` |
| 9 | Executive summary | `docs/life-events/life-event-executive-summary.md` |
| 10 | PH-4 completion report | this document |

## Dev UX

- Header drawer → **Life Event demos** (four persona buttons)
- `GET /api/dev/demo/presets` — list presets with live summaries
- `POST /api/dev/demo/load-preset` — seed session `userContext` from classifier fixture

Package: `@arrival-atlas/life-event-demo`

---

## Demo readiness review

| Criterion | Result |
|-----------|--------|
| Demo personas work | ✓ F01, F04, F08, F10 mapped; 9 package tests |
| Presets generate expected plans | ✓ API tests assert `currentLifeState` + `currentFocus` parity |
| Screenshots current | ✓ SVG catalog + capture guide (PNG optional upgrade) |
| Documentation complete | ✓ 9 markdown deliverables |
| Localized examples documented | ✓ DE home shot + demo-mode instructions |
| Mobile screenshots available | ✓ `mobile-home.svg`, `mobile-module.svg` |
| Product story understandable | ✓ Non-technical, &lt;2 pages |
| Stakeholder &lt;10 min understanding | ✓ Demo mode flow + 4×2–3 min walkthroughs |

---

## Architecture compliance

| Rule | Verified |
|------|----------|
| No planner changes | ✓ Uses existing `buildLifeEventPlan` + fixtures |
| No API contract changes | ✓ Dev-only routes under `/api/dev/demo/*` |
| No LE-3 UI behavior changes | ✓ Dev header buttons only |
| No ActionSurface / ExecutionSurface changes | ✓ |
| Real planner used | ✓ `buildLifeEventPlan` / `buildLifeEventPlanFromState` |
| Real API used | ✓ Plan fetched via `GET /api/modules/life-event/plan` after seed |

---

## Test evidence

```
npm run test -w @arrival-atlas/life-event-demo   # 9 passed
npm run test -w @arrival-atlas/api -- demo-presets  # 6 passed
```

---

## Removable surface area

To disable PH-4 entirely:

1. Remove `registerDemoToolsRoutes` from `build-app.ts`
2. Remove `@arrival-atlas/life-event-demo` dependency and package
3. Remove Header demo buttons and `loadDemoPreset` from AppProvider
4. Delete `docs/life-events/screenshots/` and PH-4 markdown docs

No frozen LE layers are affected.

---

## Follow-up (optional)

- Replace SVG placeholders with PNG captures from running `npm run dev`
- Record a Loom walkthrough using [life-event-demo-mode.md](./life-event-demo-mode.md)
