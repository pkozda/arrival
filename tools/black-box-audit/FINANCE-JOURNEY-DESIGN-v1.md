---
id: finance-journey-design-v1
title: Arrival Atlas — Finance Journey Design v1 (E10)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e10
  - finance
created: 2026-09-08
updated: 2026-09-08
---

# Finance Journey Design v1 (E10)

## Capability assessment

| Capability | Existing authoritative data? | Existing action/mutation? | Existing UI? | Existing route? | Safe to build now? |
| --- | --- | --- | --- | --- | --- |
| 1. Current financial situation (income / net) | Yes (`grossMonthlyIncome`, FR engine) | Yes — work-income | ER Action Planner + Financial Reality | `/modules/economic-reality`, `/modules/financial-reality` | Weak as *new* Finance — ER owns situation |
| 2. Banking setup (Konto / IBAN) | **No** | No | LE/Atlas copy + heuristic `bankingEstablished` only | No real banking route | **No** |
| 3. Tax administration (Steuerklasse / Kirchensteuer) | Yes (`employment.taxClass`, `employment.churchTax`) | Yes — `/profile/work-income/edit` | Embedded in work-income; consumed by FR | Profile edit + FR | **Yes** |
| 4. Benefits / payment flow | Yes (receiving* + awareness) | Yes — benefits-support | BenefitsAwarenessPanel | ER | Already Benefits (reject as Finance) |
| 5. Financial planning / budgeting | No product store | No | No | No | **No** |
| 6. Finance discovery | No | No | No | No | **No** |

### Explicit distinctions

1. **Current financial situation** — Economic Reality / Action Planner ownership; income is not rebranded as Finance.
2. **Banking setup** — presentation/heuristic only (`g1-banking-tax`, Atlas “Open bank account”); **no IBAN/Konto facts** → deferred.
3. **Tax administration** — real profile facts + mutation → **selected slice**.
4. **Benefits/payment** — Benefits awareness (E4–E8); not duplicated.
5. **Budgeting** — not present; not invented.
6. **Finance discovery** — not present; not invented.

## Selected option

**Option C — Tax Administration**

Rationale: strongest truthful infrastructure (authoritative fields + existing mutation + recalculation consumers) with the smallest semantic surface that is still distinct from ER income planning and Benefits. Option B (banking) rejected — would invent facts. Option A (financial situation) would duplicate ER. Option D belongs to Benefits. Option E unnecessary once C is viable.

## What Finance owns (this slice)

* Explaining **taxClass** / **churchTax** presence using explicit-unknown semantics.
* One recovery/review CTA into the existing work-income editor.
* Honest disclaimer that this is **not** banking, advice, or Finanzamt adjudication.

## What Finance does NOT own

* Action Planner / income situation (Economic Reality)
* Housing situation (E9)
* Wohngeld / Kindergeld (Benefits)
* Anmeldung confirmation (Registration / PD-001)
* Employment dual-track intent
* Bank account / IBAN / Steuer-ID (absent facts)
* Budgeting, advice, marketplace

## Authoritative data

| Field | Source | Meaning | Undefined | False (if bool) | Persists | Entered/derived | Safe as status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `employment.taxClass` | Profile employment domain | Steuerklasse 1–6 | Unknown — not class 1 | n/a | Yes | User-entered | Yes |
| `employment.churchTax` | Profile employment domain | Kirchensteuer preference | Unknown — **not** “no” | Explicitly not paying | Yes | User-entered | Yes when known |

Editor contract (semantic hardening): Work & Income exposes churchTax as a tri-state select (Not specified / Yes / No). Draft must not default unknown to `false`. Only explicit user selection may persist `true` or `false`.

Not used as banking/tax completion: income, household size, city, `municipalRegistrationConfirmed`, LE `bankingEstablished` heuristic.

## Semantic states

| State | Meaning |
| --- | --- |
| `NOT_ADDED` | Both taxClass and churchTax unknown |
| `INCOMPLETE` | churchTax known but taxClass missing |
| `READY` | taxClass known (churchTax may still be unknown) |

No BLOCKED/COMPLETED invented for presentation. READY is based on authoritative `taxClass`, not heuristics.

## Entry point

`TaxAdministrationPanel` on Economic Reality (beside Action Planner, Housing, Benefits). **No** `/modules/finance` landing required.

## Real action

Update/review tax details → `/profile/work-income/edit` → profile mutation → ER/FR recalculation consumers → persists via normal profile ownership (`userId = accountId ?? sessionId`).

## Cross-module relationships

| Module | Relationship |
| --- | --- |
| Registration | Intentionally not connected for completion; Steuer-ID not a fact |
| Economic Reality | Host surface; does not take Action Planner ownership |
| Benefits | Intentionally not connected |
| Employment | Consumes employment-domain tax fields; does not reinterpret job-search |
| Housing | Intentionally not connected |
| Profile | Authoritative store + mutation path |
| Life Events banking nodes | Merely related presentation; not authoritative |

## Deferred

* Bank account / IBAN / Konto setup
* Steuer-ID / tax ID administration
* Budgeting / personal finance dashboard
* Standalone Finance module route
* Treating LE `banking_ready` as completion
* Financial advice / eligibility engine
