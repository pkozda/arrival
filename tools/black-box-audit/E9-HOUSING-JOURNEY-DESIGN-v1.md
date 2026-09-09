---
id: e9-housing-journey-design-v1
title: Arrival Atlas — Housing Journey Design v1 (E9)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e9
  - housing
created: 2026-09-08
updated: 2026-09-08
---

# E9 Housing Journey Design v1

## Current Housing capability

Housing is a **profile domain** consumed by Registration, ER Action Planner, Benefits (Wohngeld), and Life Event G4 — **not** a standalone module or marketplace.

Authoritative facts: `city`, `bundesland`, `monthlyColdRent`, `monthlyUtilities` (+ related `municipalRegistrationConfirmed` on migration).

## Selected vertical slice

**Option A — Housing Situation** on Economic Reality.

Why: gives a coherent current-state view using existing facts/CTAs. No marketplace (D out). Search prep (C) and readiness productization (B) need fields that do not exist.

## Entry point

`HousingSituationPanel` on Economic Reality (beside Action Planner + Benefits). No `/modules/housing` route.

## Semantic states

| State | Meaning |
| --- | --- |
| `NOT_ADDED` | No housing facts |
| `INCOMPLETE` | Some facts; city and/or cold rent missing |
| `READY` | City + cold rent known (usable for ER/Benefits) |

Registration is a **related** signal (`needs-address` / `pending` / `confirmed`), not Housing completion ownership. PD-001 preserved: confirmation requires explicit `municipalRegistrationConfirmed`.

## Actions

* Update housing → `/profile/where-you-live/edit`
* Prepare Anmeldung → `/modules/life-event/prepare-anmeldung` when address known but unconfirmed
* Review housing when READY + confirmed

## Relationships

* **Registration:** consumes city as registrable-address proxy; does not duplicate confirmation
* **ER:** planner remains separate; Housing panel makes rent visible (planner currently focuses on address)
* **Benefits:** rent feeds Wohngeld awareness via existing path

## Persistence / ownership

Profile facts only; derived situation recalculated. `userId = accountId ?? sessionId`.

## Deferred

Housing Search / marketplace, warm rent, street address, search intent fact, standalone Housing module.
