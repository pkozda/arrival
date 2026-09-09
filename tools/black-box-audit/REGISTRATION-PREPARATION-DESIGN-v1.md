---
id: registration-preparation-design-v1
title: Arrival Atlas — Registration Preparation Design v1 (PD-001 UX)
project: Arrival Atlas
system: Arrival Atlas
type: design
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
---

# Registration Preparation Design v1

## Domain (unchanged)

```text
hasRegistrableAddress + municipalRegistrationConfirmed
  → Registration COMPLETE
```

`isMunicipallyRegistered` remains advisory only.

## Aria-disabled root cause (verified)

Plan resolve is correct after address (`g1-complete-anmeldung.blocked = false`).

Life-event galaxy edges in `buildLifeEventGalaxyGraph` emit:

```text
activeBlocks → focus
```

so banking (still blocked) becomes a **prerequisite of Anmeldung**. Lock logic then sets `aria-disabled` + “Requires: banking completed”.

**Fix:** emit `focus → activeBlocks` (downstream depends on focus) and `completed → focus` (real prerequisites).

## UX slice (smallest fit)

| Piece | Approach |
|---|---|
| Prepare Anmeldung | New route `/modules/life-event/prepare-anmeldung` + catalog `open_module` action |
| Preparation content | Lightweight Why / What / Prepare / Where (generic; no invented city rules) |
| External guidance | Slot + `ANMELDUNG_OFFICIAL_GUIDANCE_URL` constant (`null` until authoritative URL exists). No fabricated URL. Opening guidance never writes confirmation. |
| Confirm | Existing `/profile/move-to-germany/edit` + `municipalRegistrationConfirmed` |
| Inspector | Registration-specific status block (address / Anmeldung / next step) when registration nodes selected |

## Out of scope

City-specific docs, leave/return detection, full E2E gate, unrelated PDs, galaxy redesign beyond edge fix.
