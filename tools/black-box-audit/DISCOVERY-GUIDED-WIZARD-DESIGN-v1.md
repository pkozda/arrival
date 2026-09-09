---
id: discovery-guided-wizard-design-v1
title: Arrival Atlas — Discovery Guided Wizard Design v1 (PD-005)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-005
  - discovery
  - guided-wizard
created: 2026-09-08
updated: 2026-09-08
---

# Discovery Guided Wizard Design v1

## Current Discovery architecture (verified)

```text
/modules/discovery
  → GalaxyViewport(surfaceId=discovery-galaxy)
      → JourneyGuideProvider + JourneyGuideLayer  (global welcome)
      → DiscoveryPage
           → useDiscoveryModule (list / create / update / run-now)
           → create form via buildCreateProfileInput
           → POST /api/modules/discovery/profiles
           → profile list + results + optional Run now
```

Reusable pieces already present:

* `buildCreateProfileInput` / `buildUpdateProfileInput`
* Jobs vs Giveaways strategy templates (`job-discovery` / giveaway)
* Required criteria: `country` (+ giveaways `freeParticipation`)
* Optional Jobs: preferred `role`, excluded roles, schedule, notifications
* `createDiscoveryProfile` client + `useDiscoveryModule.createProfile`
* Existing self-directed “New profile” form in `DiscoveryPage`

## Current direct profile creation

Sidebar “New profile” → inline form (template, name, country, optional role/exclusions/schedule/notifications) → `createProfile` → profile selected in list.

## Current guided CTA behavior

`JourneyGuideWelcome` renders when `showWelcome` (mode not chosen). Buttons:

* Start guided → `startGuidedJourney` (global Journey Guide mode)
* Explore alone → independent mode

On Discovery this closes the dialog and leaves the empty Discovery page. **No Discovery profile steps run.**

## Why this fails PD-005

PR-011 / Option C require Guided Discovery to **actually guide Discovery setup**. The welcome dialog is Atlas Journey Guide onboarding, not a Discovery profile wizard. Labeling it as guided Discovery is misleading.

## Selected architecture

**Option C — lightweight wizard** on Discovery only:

1. **Honesty fix:** do not show `JourneyGuideWelcome` on `discovery-galaxy`.
2. **Discovery entry chooser:** Guided setup vs Self-directed (New profile).
3. **Wizard steps** reuse `buildCreateProfileInput` + existing create API.
4. **No new persistence / no auto-run.**

```text
WELCOME → INTENT → CRITERIA → REVIEW → CREATED
```

Discard draft on exit (no mid-wizard persistence).

## Wizard states

| Step | Purpose |
| --- | --- |
| `welcome` | Explain Guided vs what it does / does not do |
| `intent` | Jobs or Giveaways |
| `criteria` | Minimum fields (name, country; optional Jobs role) |
| `review` | Summary before create; no “search completed” claim |
| `created` | Semantic confirmation: profile created; continue to Discovery |

## Minimum information

Aligned with existing create contract:

* **Required:** profile name, country (2-letter)
* **Intent:** Jobs or Giveaways
* **Jobs optional:** preferred role (schedule/notifications use existing defaults)
* **Giveaways:** country + auto `freeParticipation` via `buildCreateProfileInput`

Do not invent new fields. Do not force excluded roles / schedule / notifications in the wizard.

## Jobs-first flow

Employment Job Search lands on Discovery; default intent highlight is Jobs. Giveaways remains selectable in intent step.

## Confirmation semantics

Success copy: Discovery **profile created**.  
Not: search completed / results ready.  
`claimsDiscoveryRun = false` always from wizard completion.

## PD-006 relationship

Reuse current profile create persistence (session/demo as today). Do not redesign account scoping. Document if current store is not yet account-scoped — out of scope here.

## PD-007 relationship

No lifecycle changes. Wizard does not call run-now. Existing Run button unchanged.

## Non-goals

Journey Guide redesign, Discovery engine/ranking, PD-006/007, Employment changes, E2E suite edits, generic wizard framework.

## Localization

New `discovery.guided.*` keys in `DISCOVERY_I18N` for EN/DE/RU/UA. Reuse existing strategy/create field keys where applicable.

## Testing strategy

Unit: step validation, create input mapping, Journey Guide suppress on discovery surface, i18n.  
Browser probe: guided ≠ Journey Guide; Jobs path; create confirmation; no fake run; self-directed remains.

## Known limitations

* Persistence may still be demo/session-scoped until PD-006.
* Run lifecycle honesty remains PD-007.
* Wizard uses progressive field subset; full form remains self-directed.
