# Life Event Module — Demo mode

Run a stakeholder demo in under 10 minutes without engineering support.

## Prerequisites

- Repository cloned, `npm install` completed
- `npm run dev` running (API `:3001`, web `:3000`)
- Browser at `http://localhost:3000`
- **Development build only** — demo controls are hidden in production

## Demo personas

Canonical personas map to real classifier fixtures (planner inputs—not mocked outputs).

| ID | Persona | Life state | Fixture | Tagline |
|----|---------|------------|---------|---------|
| `new-arrival` | A — New Arrival | `arrival_unregistered` | F01 | I just arrived. What should I do first? |
| `job-loss` | B — Job Loss | `economic_setup_pending` | F04 | I lost my job. What happens next? |
| `benefits-discovery` | C — Benefits Discovery | `benefits_exploration` | F08 | Am I eligible for assistance? |
| `stable-resident` | D — Stable Resident | `situation_stable` | F10 | What should I prepare for next? |

Definitions live in `@arrival-atlas/life-event-demo` (`packages/life-event-demo`).

## Loading a preset

### UI (recommended)

1. Open the header menu (☰).
2. Under **Life Event demos**, click a persona button.
3. Wait for confirmation, then navigate to Home or Life Event module.

### API (optional)

```http
GET /api/dev/demo/presets
POST /api/dev/demo/load-preset
Content-Type: application/json

{ "presetId": "new-arrival" }
```

Requires session credentials (`x-session-id` / bearer token). Returns plan summary from the **real** planner.

### Reset between demos

Use **Reset my data** (session) or **Clear all local state** (full wipe) in the same dev tools panel.

## Walkthrough order

Follow [life-event-guided-walkthroughs.md](./life-event-guided-walkthroughs.md):

1. New Arrival (2–3 min)  
2. Job Loss + scenario banner (2–3 min)  
3. Benefits Discovery (2–3 min)  
4. Stable Resident (2–3 min)

## Screenshots

Curated catalog: [life-event-showcase-gallery.md](./life-event-showcase-gallery.md)  
Capture instructions: [screenshots/README.md](./screenshots/README.md)

## Presentation flow (10-minute version)

| Minute | Action |
|--------|--------|
| 0–1 | Problem framing: bureaucracy overload for newcomers ([product story](./life-event-product-story.md)) |
| 1–4 | Load **new-arrival** → Home → module hero |
| 4–6 | Load **job-loss** → scenario banner → explorer |
| 6–8 | Load **benefits-discovery** → timeline + breakdown |
| 8–9 | Load **stable-resident** → contrast stable vs crisis |
| 9–10 | Before/after recap ([before-after doc](./life-event-before-after.md)) |

## Localization demo

1. Load `new-arrival`.
2. Switch language to **DE** in the header drawer.
3. Show [home-localized-de](./screenshots/home-localized-de.svg) equivalent on screen.

## Mobile demo

Resize browser to 390px width or use device mode. Capture references: `mobile-home.svg`, `mobile-module.svg`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Demo buttons missing | Confirm `NODE_ENV=development` |
| API 404 on load-preset | API must not be in production mode |
| Stale plan after preset | Hard refresh or reset session, reload preset |
| Explorer empty | Add `?event=job_loss#explorer` (or matching scenario) to module URL |

## Related documents

- [Executive summary](./life-event-executive-summary.md) — one-pager for investors/partners  
- [PH-4 completion report](./ph-4-demo-showcase-completion.md) — delivery checklist
