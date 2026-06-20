# L10-A2 — Life Event Content Localization Completion

## Audit findings

L10-A localized UI chrome (section headings, states, severity, loading states). A follow-up audit found **157 additional user-visible strings** still rendered from planner output, module metadata, scenario explorer schema, and runtime overlays.

| Domain | Source (frozen) | Render boundary | Key pattern |
|--------|-----------------|-----------------|-------------|
| Module metadata | `packages/modules/.../index.ts` | Life Event page header | `life-event.module.*` |
| Graph node copy | `GRAPH_CATALOG_V1` | `LifeEventPlanNodeCard` | `life-event.node.{id}.title\|description\|rationale` |
| Action labels | `LifeActionRef` in graph | `LifeEventPlanNodeActions` | `life-event.action.profile\|module\|scenario.*` |
| Graph intent | per `lifeStateId` | `localizeWhyThisNow()` | `life-event.graph.{lifeStateId}.intent` |
| Secondary blockers | `build-reasoning.ts` | `localizeWhatIsBlocking()` | `life-event.reasoning.secondary.{id}` |
| Blocker waiting | planner template | `localizeWhatIsBlocking()` | `life-event.reasoning.blocker.waiting` |
| Scenario overlay | `scenario-registry.ts` | `NextStepsCard` | `life-event.scenario.{scenarioId}.reasoning` |
| Scenario explorer | hardcoded + Zod schema | `LifeEventScenarioExplorer` + `SchemaForm` | `life-event.explorer.*`, `life-event.schema.*` |
| Runtime signals | `cross-module-signal-engine.ts` | `RuntimeCrossModuleFeedback` | `life-event.runtime.signal.*` |

**Not localized (out of scope):**

- `EVENT_HANDLERS` scenario execution output (large corpus; module projection not primary Life Event plan path)
- API / client error strings (`Failed to load your next steps plan`, etc.)
- Shared components outside Life Event (`ResultPanel`, `ModuleProjectionRenderer` generic headings)
- Profile prefill banner messages (profile-insights domain)

## Localization coverage

Resources live in:

- `packages/core/src/i18n/life-event-content/en.json` (generated from graph catalog)
- `packages/core/src/i18n/life-event-content/de.json`, `ru.json`, `ua.json`
- Merged via `life-event-content-translations.ts` into platform `getTranslations()`

Presentation helpers: `apps/web/src/lib/life-event/content-labels.ts`

**157 keys** across `en`, `de`, `ru`, `ua` covering all in-scope domains above.

## Fallback strategy

```
localized key lookup
        ↓ miss
planner / registry English text (unchanged API payload)
```

- `resolveLocalized(t, key, fallback)` never throws; missing keys return `fallback`.
- `LifeEventPlanV1`, `ActionSurfaceV1`, and `ExecutionSurfaceV1` payloads are **never mutated**.
- Runtime signals keep English `message` for tests/debug; UI prefers `messageKey` when present.

## Architectural rationale

**Planner owns facts. UI owns language.**

- No `titleCode`, `reasonCode`, or contract changes.
- Stable IDs (`node.id`, `action.profileMirrorSlug`, `scenarioId`, `secondaryConditionId`) map to presentation-layer keys only.
- LE-1 through LE-8 behavior unchanged; v1.0 Architecture Freeze and ADR-001–005 remain valid.

## Regenerating English keys

When graph catalog copy changes (future non-freeze work), regenerate `en.json`:

```bash
npm run build --workspace=@arrival-atlas/modules
node packages/core/scripts/sync-life-event-content-en.mjs
```

Then update `de.json`, `ru.json`, and `ua.json` overlays to match.

## Remaining gaps

- Scenario execution handler output (`EVENT_HANDLERS`) — English in module execute path; not wired to primary plan UI today.
- Module catalog card title/description on Home still uses API `PublicModuleContract` strings (not Life Event page header).
- `life-event.scenario.situationChanging` key from L10-A remains unused in UI.

## Tests

`apps/web/src/lib/life-event/l10-a2-content-localization.test.ts` — node localization, fallback, schema labels, module metadata, planner output regression.
