---
id: discovery-guided-wizard-implementation-v1
title: Arrival Atlas — Discovery Guided Wizard Implementation v1 (PD-005)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
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
related:
  - discovery-guided-wizard-design-v1
---

# Discovery Guided Wizard Implementation v1

## Implemented

* **Honesty fix:** Journey Guide welcome suppressed on `discovery-galaxy`.
* **Discovery setup chooser:** Guided setup vs self-directed create (empty state + sidebar).
* **Lightweight wizard:** `welcome → intent → criteria → review → created`.
* **Jobs-first:** Jobs/Giveaways intent; progressive Jobs fields (name, country, optional role).
* **Create:** reuses `buildCreateProfileInput` + `createDiscoveryProfile` API.
* **Confirmation:** “Discovery profile created” — not a run.
* **Self-directed:** existing New profile form preserved (`discovery-self-directed-create`).
* **i18n:** `discovery.setup.*` / `discovery.guided.*` EN/DE/RU/UA.

## Files changed

| Area | Path |
| --- | --- |
| Design | `tools/black-box-audit/DISCOVERY-GUIDED-WIZARD-DESIGN-v1.md` |
| Implementation | `tools/black-box-audit/DISCOVERY-GUIDED-WIZARD-IMPLEMENTATION-v1.md` |
| Probe | `tools/black-box-audit/probes/probe-pd005-guided-discovery.mjs` |
| Wizard model | `apps/web/src/lib/discovery/guided-wizard.ts` (+ test) |
| UI | `DiscoveryGuidedWizard`, `DiscoverySetupChooser`, `DiscoveryPage`, `DiscoveryProfileSidebar` |
| Journey Guide gate | `JourneyGuideProvider.shouldShowJourneyGuideWelcomeOnSurface` |
| Hook | `useDiscoveryModule.createProfile` returns/rethrows; no full-page loading flash |
| i18n | `packages/core/src/i18n/discovery-translations.ts` (+ pd005 test) |
| CSS | `discovery-module.css` |

## State flow

```text
Discovery empty
  → chooser (Guided | Self-directed)
Guided
  → WELCOME → INTENT → CRITERIA → REVIEW → create API → CREATED
  → Continue → profile panel (no auto-run)
Self-directed
  → existing create form (unchanged contract)
```

## Tests

| ID | Result |
| --- | --- |
| A–E, G, K (unit) | PASS (7) |
| J i18n | PASS |
| discovery-ui regression | PASS (34) |

Existing E2E suites not modified.

## Browser validation

Probe: `probe-pd005-guided-discovery.mjs` → **BROWSER PASS**

* Journey Guide welcome absent on Discovery
* Guided opens Discovery wizard
* Jobs criteria → review accurate
* Create POST once; zero run-now POSTs; confirmation visible
* Continue shows profile; reload keeps profile without fake run claim
* Self-directed form still available

## Persistence / execution observed

* Profile created via existing Discovery profiles API (current demo/session behavior).
* No PD-006 account-scope redesign.
* No PD-007 lifecycle; wizard did not execute Discovery.

## Limitations

* Persistence honesty (account vs demo) remains PD-006.
* Run lifecycle UI remains PD-007.
* Wizard uses progressive field subset; full form remains self-directed.
* Mid-wizard drafts discarded on cancel.

## Final verdict

`PD-005 GUIDED DISCOVERY SLICE PASS WITH LIMITATIONS`
