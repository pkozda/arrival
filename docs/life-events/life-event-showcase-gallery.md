# Life Event Module — Showcase gallery

Audience: product, partnerships, and onboarding—no engineering background required.

Assets live in [`screenshots/`](./screenshots/). SVG wireframes ship with PH-4; replace with PNG captures using the [capture guide](./screenshots/README.md).

---

## Home

### Active plan

![Home with active life event plan](./screenshots/home-active-plan.svg)

| Field | Detail |
|-------|--------|
| **Title** | Home — active plan |
| **Purpose** | Show that Atlas surfaces one prioritized plan on arrival, not a module grid. |
| **State** | Persona A (`new-arrival`), `arrival_unregistered`, focus: Complete Anmeldung |
| **Explanation** | The home snapshot answers “what should I do first?” immediately after login. |

### Scenario banner

![Home with scenario banner](./screenshots/home-scenario-banner.svg)

| Field | Detail |
|-------|--------|
| **Title** | Home — scenario overlay |
| **Purpose** | Demonstrate “what if” context without leaving Home. |
| **State** | Persona B (`job-loss`), scenario `job_loss` |
| **Explanation** | When life changes, Atlas flags the shift and links to deeper exploration. |

### Localized (German)

![Home in German](./screenshots/home-localized-de.svg)

| Field | Detail |
|-------|--------|
| **Title** | Home — German localization |
| **Purpose** | Prove L10n is active for newcomer audiences. |
| **State** | Persona A, language **DE** |
| **Explanation** | Labels, severity, and plan copy render in the user’s language. |

---

## Module page

### Hero

![Module hero](./screenshots/module-hero.svg)

| Field | Detail |
|-------|--------|
| **Title** | Life Event — hero |
| **Purpose** | Single primary CTA aligned to current life state. |
| **State** | Persona A on `/modules/life-event` |
| **Explanation** | Hero states the constraint and one action—no competing buttons. |

### Action breakdown

![Action breakdown](./screenshots/module-action-breakdown.svg)

| Field | Detail |
|-------|--------|
| **Title** | Life Event — action breakdown |
| **Purpose** | Show categorized next steps (legal, survival, stabilization). |
| **State** | Persona B (`economic_setup_pending`) |
| **Explanation** | Users see *why* steps are grouped, not just a flat task list. |

### Timeline

![Timeline](./screenshots/module-timeline.svg)

| Field | Detail |
|-------|--------|
| **Title** | Life Event — timeline |
| **Purpose** | Visualize phased progression over weeks and months. |
| **State** | Persona C (`benefits_exploration`) |
| **Explanation** | Timeline communicates sequence without implying fixed deadlines. |

---

## Scenario explorer

### Configured example

![Explorer configured](./screenshots/explorer-configured.svg)

| Field | Detail |
|-------|--------|
| **Title** | Scenario Explorer — configured |
| **Purpose** | User selects a life event to simulate before committing. |
| **State** | Persona B, `?event=job_loss#explorer` |
| **Explanation** | Explorer is optional overlay—core plan still comes from the real planner. |

### Completed example

![Explorer completed](./screenshots/explorer-completed.svg)

| Field | Detail |
|-------|--------|
| **Title** | Scenario Explorer — completed |
| **Purpose** | Show outcome narrative after simulation. |
| **State** | Persona B after submitting explorer |
| **Explanation** | Completing a scenario explains expected shifts in focus and severity. |

---

## Mobile

### Home

![Mobile home](./screenshots/mobile-home.svg)

| Field | Detail |
|-------|--------|
| **Title** | Mobile — Home |
| **Purpose** | Confirm plan-first layout on small screens. |
| **State** | Persona A, 390px viewport |
| **Explanation** | Critical focus remains visible without horizontal scrolling. |

### Module page

![Mobile module](./screenshots/mobile-module.svg)

| Field | Detail |
|-------|--------|
| **Title** | Mobile — module |
| **Purpose** | Hero and breakdown remain readable on phone form factors. |
| **State** | Persona A, `/modules/life-event` |
| **Explanation** | Same planner output as desktop—responsive presentation only. |
