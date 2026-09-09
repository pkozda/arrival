---
id: registration-preparation-implementation-v1
title: Arrival Atlas — Registration Preparation Implementation v1 (PD-001 UX)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-001
  - registration
  - preparation
created: 2026-09-07
updated: 2026-09-07
related:
  - registration-preparation-design-v1
  - registration-integration-validation-v1
---

# Registration Preparation Implementation v1

## Implemented

* **Galaxy dependency fix:** `buildLifeEventGalaxyGraph` no longer treats active blocks as prerequisites of the focus (fixes Anmeldung `aria-disabled` behind banking).
* **Prepare Anmeldung** route: `/modules/life-event/prepare-anmeldung` with Why / What / Prepare / Where / Return→Confirm.
* **Catalog actions:** municipal registration nodes include Prepare + existing move-to-germany confirm.
* **Registration inspector status** panel for registration nodes (blocked / actionable / complete).
* **External guidance slot:** `ANMELDUNG_OFFICIAL_GUIDANCE_URL = null` until an authoritative URL exists; pending copy shown; never writes confirmation.
* **Localization:** en / de / ru / ua life-event-content keys.
* **Tests:** registration UX state, galaxy edges, catalog actions, existing resolve/signals PD-001 suites.

## State flow

```text
NO ADDRESS
→ BLOCKED (graph Requires address; prepare page explains; address action available)

ADDRESS + no confirmation
→ ACTIONABLE (Anmeldung selectable; Prepare Anmeldung; not COMPLETE)

PREPARATION PAGE
→ EXTERNAL PROCESS (outside Atlas; guidance slot)
→ USER RETURN
→ EXPLICIT CONFIRMATION (municipalRegistrationConfirmed via fact.correct)
→ COMPLETE
```

## Important semantic rule

> Opening external guidance is not evidence of Anmeldung completion. Only the existing explicit `municipalRegistrationConfirmed` fact can transition Registration to COMPLETE.

Domain completion formula unchanged:

```text
hasRegistrableAddress && municipalRegistrationConfirmed === true
```

## Validation (localhost `npm run dev`)

| Case | Result |
|---|---|
| A No address → blocked reason + address path | **PASS** (prepare page + graph Requires address; initial probe nav flake corrected) |
| B Address → Prepare visible, not COMPLETE, Anmeldung not aria-disabled | **PASS** |
| C Preparation experience | **PASS** |
| D External guidance does not complete | **PASS** (pending official URL) |
| E Return → confirm link | **PASS** → `/profile/move-to-germany/edit` |
| F Confirm mutation → persisted | **PASS** (409 then 200 with confirmation) |
| G Reload → still complete | **PASS** |

Artifacts: `tools/black-box-audit/artifacts/pd001-prepare-ux/`

## Remaining PD-001 work

* Authoritative official Anmeldung URL when product source exists
* Richer / city-specific preparation content
* Locked-node click always focusing Registration inspector (galaxy selection polish)
* Leave/return refinements
* Full E2E gate (E2E-REG-004…007, REC, GLOBAL)

## Safety

* No duplicate completion fact
* `isMunicipallyRegistered` semantics unchanged
* No government registration simulation
* No existing E2E test modifications
* No fabricated official URLs
