---
id: life-events-integrity-audit-v1
title: Arrival Atlas — Life Events Integrity Audit v1 (E12)
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e12
  - life-events
created: 2026-09-09
updated: 2026-09-09
---

# Life Events Integrity Audit v1 (E12)

## Architecture

Life Events is a **projection**, not a second source of truth:

```
UserContext → computeSituationSignals → classifyLifeState → graph catalog
  → resolveGraph (satisfaction + blockedBy) → buildLifeEventPlan
  → Galaxy presentation (buildLifeEventGalaxyGraph) → inspector / CTAs
```

Authoritative facts live in the profile domains (housing, migration, employment, income, benefits, healthInsurance). LE derives node status via `SatisfactionKey`s.

## Node / state inventory (summary)

| Area | Nodes (examples) | Authoritative source | Notes |
| --- | --- | --- | --- |
| Address | `g1-secure-address` | `housing.city` | Auth |
| Registration | `g1-complete-anmeldung`, `g2-confirm-registration`, `g4-register-address` | city + `municipalRegistrationConfirmed` | PD-001 Auth |
| Insurance | G5 + g1/g2 insurance nodes | healthInsurance facts | Shared key collapses steps (P2) |
| Housing | G4 | city / rent / heuristic stable_housing | Rent auth; stable_housing heuristic |
| Employment/income | G3 | employmentStatus / grossMonthlyIncome | Auth-ish |
| Benefits | G2/G3/G6 | receiving* flags | Auth when set; shared key (P2) |
| Banking/tax copy | `g1-banking-tax`, `g2-housing-banking` | **none** | `banking_ready` never satisfied (E12) |
| Stable review | G7 | never | Informational / never completable |

Full catalog: `packages/modules/src/life-event/plan/graph/catalog.ts`.

## Dependency graph findings

### Catalog (authoritative blockers)

G1: `g1-secure-address` → blocks → `g1-complete-anmeldung` → blocks → `g1-banking-tax`

**Registration is NOT blocked by Banking.**

### Presentation edges

`build-galaxy-graph.ts`: completed → focus (dependency); focus → blocked (dependency). Prior banking→Anmeldung inversion is fixed and regression-tested.

Presentation edges are bucket-derived, not a full copy of catalog topology (known limitation / P2).

## Action semantics

| Kind | Behavior |
| --- | --- |
| Selection | Galaxy node click → inspector only |
| Navigation | `LifeEventPlanNodeActions` → real `href` links |
| Mutation | Via profile editors (e.g. confirm Anmeldung) |
| External guidance | Prepare Anmeldung; opening external ≠ complete |
| Informational | Banking nodes remain open; never COMPLETE without bank facts |

## Completed-prerequisite behavior (post-E12)

* Registration COMPLETE only with address + explicit confirmation.
* Classifier leaves `arrival_unregistered` only with authoritative confirmation (not heuristic).
* Housing READY from city+rent (E9); not from Registration alone.
* Benefits COMPLETED from receiving* facts (E4–E8).
* Tax READY from taxClass (E10); churchTax unknown preserved (E11).
* Discovery lifecycle not invented by LE (no Discovery nodes/CTAs in catalog).

## Recalculation

Profile mutation → session refresh → `buildLifeEventPlan` rebuilds from signals. No second LE store.

## Cross-module relationships

| Module | Relationship |
| --- | --- |
| Registration | Owned by migration confirmation; LE projects |
| ER / Action Planner | Navigation host; planner ownership stays on ER |
| Housing | Profile facts; LE G4 + ER panel |
| Benefits | Profile + awareness panels; LE does not override evaluator |
| Employment | Profile / ER; dual-track not LE-owned |
| Discovery | Separate module; LE must not invent runs |
| Tax Administration | ER panel; LE banking node is not tax completion |
| Healthcare | Healthcare module CTAs; unknown insurance stays unknown |

## Localization / accessibility

EN/DE/RU/UA content JSON. Blocked nodes must expose explainable reasons (registration inspector + waiting copy). Banking secondary no longer claims an untracked account is “not set up” as if known absent.

## Deferred (P2/P3)

* Shared satisfaction keys collapsing multi-step G4/G5/G6 phases
* Presentation edges ≠ full catalog topology
* G7 never completable
* Official Anmeldung URL still null (intentional pending)
* Optional `fact.invalidate` for clearing churchTax
* Banking product when real IBAN facts exist
