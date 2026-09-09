---
id: e8-benefits-e2e-journey-audit-v1
title: Arrival Atlas — Benefits End-to-End Journey Audit v1 (E8)
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e8
  - benefits
  - e2e
  - audit
created: 2026-09-08
updated: 2026-09-08
---

# E8 Benefits End-to-End Journey Audit v1

## Capability classification

**COHERENT BUT LIMITED**

A user can understand incomplete Benefits state, supply profile facts, see recalculation, confirm receipt, reload, and reverse completion — for Wohngeld and Kindergeld — without eligibility overclaim or Action Planner conflation.

Limitations are scope/product boundaries (two benefits; no legal eligibility; no planner feed; no authority verification), not journey breakage.

## Complete journey (observed)

```
CURRENT SITUATION (incomplete profile on ER)
→ WHY THIS MATTERS (Benefits disclaimer + aggregate need-information)
→ BENEFITS AWARENESS (Wohngeld + Kindergeld NOT_ENOUGH_INFORMATION)
→ NEXT ACTION (household / housing / income CTAs)
→ ACTION (profile mutation)
→ VISIBLE CONFIRMATION (cards reorder; primary focus updates)
→ RECALCULATION (READY_TO_ACT)
→ COMPLETION (receiving* = true → COMPLETED)
→ CONTINUE / REVERSE (receiving* = false → READY_TO_ACT)
```

Probe: `tools/black-box-audit/probes/probe-e8-benefits-e2e-journey.mjs`  
Artifact: `tools/black-box-audit/artifacts/e8-benefits-e2e-journey/report.json`  
Result: **E8 BENEFITS E2E JOURNEY PASS WITH LIMITATIONS** (P0=0, P1=0)

## Wohngeld transitions

| Step | Evidence |
| --- | --- |
| NOT_ENOUGH_INFORMATION | Phase A |
| READY_TO_ACT after rent/income | Phase C |
| COMPLETED after `receivingWohngeld` | Phase G |
| Remains COMPLETED while Kindergeld revoked | Phase H |

## Kindergeld transitions

| Step | Evidence |
| --- | --- |
| NOT_ENOUGH_INFORMATION | Phase A |
| READY_TO_ACT after explicit children | Phase B (not household size) |
| COMPLETED after `receivingKindergeld` | Phase E |
| Reverse to READY_TO_ACT | Phase H |
| Reload retains COMPLETED | Phase F |

## Aggregation

| Case | Observed |
| --- | --- |
| Both need info | Phase A — `GATHER_INFORMATION` |
| Both ready | Phase D — Wohngeld then Kindergeld; actionable count 2 |
| One ready + one completed | Phase E — Wohngeld primary; Kindergeld COMPLETED last |
| Both completed | Phase G — `REVIEW_COMPLETED`; no fake next action |
| Reverse mixed | Phase H — Kindergeld actionable first; Wohngeld COMPLETED |

Ordering remains presentation policy; aggregate copy denies legal/amount ranking.

## Action Planner boundary

* Planner and Benefits are separate panels on ER.
* Planner text does not mention Wohngeld/Kindergeld/Benefits awareness.
* Housing/income CTAs may appear in both surfaces for different reasons (planner situation vs benefit awareness) — **useful duplication**, not a P1: each card/panel explains its own why.
* Benefits remain presentation-only (E7 decision upheld).

## Semantic integrity

* No `eligible` / `qualify` / `entitled` / `guaranteed` / authority-confirmed language in Benefits UI copy (source + probe overclaim scan).
* Awareness ≠ receipt ≠ official verification ≠ completion.
* External official CTAs only on READY_TO_ACT; absent on COMPLETED.
* Completion text frames user-confirmed profile fact.

## Profile semantics

* `children[]` / `dependentChildCount` drive Kindergeld; household size alone does not.
* `receivingWohngeld` / `receivingKindergeld` are authoritative booleans (`undefined` ≠ `false`).
* E7 `DomainMutationEditor` revision sync remains in place (boolean clobber protected).

## Recalculation / persistence

* Profile mutation → return to ER → derived cards update without manual refresh.
* Reload reconstructs identical card snapshot (Phase F).
* Session isolation via cleared storage between language journeys.

## Localization

* Unit: E4–E7 i18n **14/14**.
* Browser: EN `lang=en`, UA `lang=uk`; no RU leakage; no raw keys.

## Accessibility

* Section `aria-labelledby` + heading
* Benefit cards as `article`
* Aggregate `role="status"`
* Completed marker text (not color-only)
* Keyboard-reachable profile/official CTAs (existing atlas links/buttons)

## Recovery

* No-op benefits save does not invent states (Phase J on fresh session after language switch).
* Reverse receipt fact clears COMPLETED immediately.
* Full mutation-failure / revision-conflict injection not force-failed in browser (would require API sabotage); covered by existing mutation/revision unit paths + E7 draft sync.

## Tests run

| Suite | Result |
| --- | --- |
| MBDE awareness (E4–E7) | 32/32 |
| benefits-awareness i18n E4–E7 | 14/14 |
| mutation-request-builder | 6/6 |
| Action Planner PD-002 | 6/6 |
| E8 browser probe | PASS WITH LIMITATIONS |

## Fixes in E8

None required for product P0/P1. Probe waits/assertions hardened only.

## Limitations

* Only Wohngeld + Kindergeld
* No legal eligibility / amounts / application workflow
* No Benefits → Action Planner integration (intentional)
* No external authority verification of receipt
* Account-claim ownership cross-check not re-executed in this probe (session-scoped journey + existing claim infrastructure)

## Deferred

Third benefit; planner feed; authority verification; broader a11y redesign; forced mutation-failure browser harness.

## Product decisions

None blocking. Benefits hardening cycle can stop; next work should be a different product capability unless a new benefit is explicitly scoped.
