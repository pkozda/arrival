# L10-A — Life Event Localization (UI-only)

## Scope

Presentation-layer localization for the Life Event module UI. All user-facing copy in Life Event surfaces renders through the platform i18n system (`@arrival-atlas/core` → `GET /api/i18n/:lang` → `AppProvider.t()`).

### In scope

- State labels (`life-event.state.*`)
- Severity labels (`life-event.severity.*`)
- Home card copy (`life-event.home.*`)
- Plan page sections (`life-event.plan.*`)
- Timeline sections (`life-event.timeline.*`)
- Scenario overlay banner (`life-event.scenario.*`)
- Empty and loading states (`life-event.empty.*`)
- Node chrome (`life-event.node.*`)
- Runtime feedback chrome (`life-event.runtime.*`)

### Out of scope (L10-B and frozen layers)

- `LifeEventPlanV1`, `LifeStateId`, graph/node/scenario IDs
- API responses and schemas
- `buildLifeEventPlan()` and planner reasoning text
- `reasonCode` / translation codes on contracts
- ActionSurface, ExecutionSurface, scenario matching logic
- Runtime MRC behavior
- Planner-generated node titles, descriptions, and `scenario.reasoning` prose

## Architectural boundary

**Planner owns facts. UI owns language.**

`plan.currentLifeState`, `plan.currentFocus`, node IDs, and reasoning arrays are unchanged at runtime. Only rendering maps stable IDs to localized labels via `life-event.*` keys.

`formatLifeStateLabel()` in `presentation.ts` remains for projection tests; the module page renders `lifeEventStateLabel(t, plan.currentLifeState)` instead of `projection.lifeStateLabel`.

## Translation domains

| Domain | Example key | Example (en) |
|--------|-------------|--------------|
| `life-event.state.*` | `life-event.state.arrival_unregistered` | New arrival |
| `life-event.severity.*` | `life-event.severity.critical` | Critical |
| `life-event.home.*` | `life-event.home.viewFullPlan` | View full plan |
| `life-event.plan.*` | `life-event.plan.whyThisNow` | Why this now |
| `life-event.timeline.*` | `life-event.timeline.upcomingSteps` | Upcoming steps |
| `life-event.scenario.*` | `life-event.scenario.contextShiftTitle` | Context shift detected |
| `life-event.empty.*` | `life-event.empty.noPlan` | No plan available |

Resources live in `packages/core/src/i18n/life-event-translations.ts` and merge into each locale block in `packages/core/src/i18n/index.ts`.

Supported locales: `en`, `de`, `ru`, `ua` (no new locales introduced).

## UI integration

- **Helpers:** `apps/web/src/lib/life-event/ui-labels.ts`
- **Components:** `NextStepsCard`, `LifeEventPlanView`, `LifeEventPlanNodeCard`, `runtime-ui-feedback`, life-event module page
- **Fallback:** `getTranslations(lang)` merges English; `AppProvider.t()` falls back to English when a key is missing from the fetched bundle

## Tests

`apps/web/src/lib/life-event/l10-localization.test.ts` covers state/severity/home/scenario localization and platform fallback behavior.

## v1.0 freeze compliance

No changes to LE-1–LE-5 core, LE-4 ActionSurface, LE-5 ExecutionSurface, LE-7 scenario resolution, or LE-8 runtime engine. ADR-001–005 and the v1.0 architecture freeze remain valid.
