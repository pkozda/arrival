---
id: state-reversal-recovery-audit-v1
title: Arrival Atlas — State Reversal, Recovery & Recalculation Audit v1 (E13)
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e13
  - state-reversal
created: 2026-09-09
updated: 2026-09-09
---

# State Reversal, Recovery & Recalculation Audit v1 (E13)

## Principle

**Derived state must always be a deterministic projection of the current authoritative state.**

Forward progress and backward correction must both be truthful. Failed mutations must not create fictional state. Unsupported reversals must be documented, not simulated.

Architecture:

```
authoritative profile/domain facts
  → derived evaluators / projections
  → Life Events / module presentation
  → real action → mutation → recalculation
```

## 1. Reversible fact inventory

| Fact | Domain | set | update | clear/invalidate | explicit false | unknown |
| --- | --- | --- | --- | --- | --- | --- |
| `city` | housing | yes (`fact.correct`) | yes | yes (`fact.invalidate` via empty editor) | n/a | yes (absent) |
| `monthlyColdRent` | housing | yes | yes | yes (`fact.invalidate`) | n/a | yes (absent ≠ 0) |
| `monthlyUtilities` | housing | yes | yes | yes (`fact.invalidate`) | n/a | yes |
| `municipalRegistrationConfirmed` | migration | yes | yes | **no → unknown** | yes (`fact.correct` false) | yes (absent); UI uses checkbox so unknown↔false collapse possible |
| `receivingWohngeld` | benefits | yes | yes | **no → unknown** | yes | draft checkbox may default false |
| `receivingKindergeld` | benefits | yes | yes | **no → unknown** | yes | same |
| `children` / dependentChildCount | household | yes | yes | yes (count 0 / invalidate `children`) | n/a | yes |
| `taxClass` | employment | yes | yes | yes (`fact.invalidate` empty select) | n/a | yes |
| `churchTax` | employment | yes (tri-state select) | yes | yes (`fact.invalidate` → Not specified) | yes | **protected** (E11) |
| `grossMonthlyIncome` | income | yes | yes | yes (`fact.invalidate`) | n/a | yes |
| `employmentStatus` | employment | yes | yes | yes (`fact.invalidate`) | n/a | yes (`not_provided` distinct) |
| healthcare `insuranceType` / coverage | healthInsurance | yes | yes | yes when editor clears | n/a | yes |
| Discovery profile/run/result/automation | discovery store | Discovery APIs only | yes | lifecycle-specific | n/a | n/a |

### Asymmetric flows

| Transition | Status |
| --- | --- |
| `undefined → true` (registration, benefits) | Supported |
| `true → false` | Supported via `fact.correct` |
| `true → undefined` (booleans) | **Unsupported** — no UI path to invalidate boolean to unknown; revoke uses explicit false |
| Select/text known → empty | Supported (E13 wired `fact.invalidate`) |
| Empty → silent no-op (pre-E13) | **Fixed** — was P1 |

## 2. Dependency / recalculation matrix

| Authoritative fact | Derived state | Forward | Reverse (verified) |
| --- | --- | --- | --- |
| city + `municipalRegistrationConfirmed=true` | Registration UX / LE Anmeldung / housing `reg` | actionable → COMPLETE / confirmed | COMPLETE → actionable when `false` |
| city + rent | Housing Situation | NOT_ADDED/INCOMPLETE → READY | READY → INCOMPLETE when rent cleared |
| city + rent + income; `receivingWohngeld` | Wohngeld awareness | READY_TO_ACT → COMPLETED | COMPLETED → READY_TO_ACT on `false` |
| children + `receivingKindergeld` | Kindergeld awareness | READY_TO_ACT → COMPLETED | COMPLETED → READY_TO_ACT on `false` |
| `taxClass` known | Tax Administration | INCOMPLETE/NOT_ADDED → READY | READY → INCOMPLETE/NOT_ADDED on invalidate |
| `churchTax` | Tax fact presence | UNKNOWN → KNOWN | KNOWN → UNKNOWN via invalidate; unrelated save preserves UNKNOWN |
| healthcare insurance facts | Healthcare outcome / MORE_INFO | insufficient → sufficient | reverse when cleared (if editor supports) |
| employment facts | Employment dual-track | missing → present | clear → missing; Discovery untouched |
| Discovery run lifecycle | Discovery UI | IDLE→…→terminal | ERROR retry / subsequent run; no invent from Work & Income |

## 3. Supported forward / reverse transitions

### Supported

* Registration confirm / revoke (`true` ↔ `false`)
* Wohngeld / Kindergeld receiving (`true` ↔ `false`)
* Housing / tax / income / employment / insurance clears via empty editor → `fact.invalidate`
* churchTax Not specified / Yes / No (tri-state)
* Discovery lifecycle recovery via Discovery actions only

### Unsupported (documented, not invented)

* Boolean facts → `undefined` (unknown) after once known — product uses explicit false
* Banking / Steuer-ID / Housing Search — out of scope / no facts
* Forced Discovery lifecycle states without infrastructure
* Generic invalidate framework / API

## 4–11. Slice results (summary)

| Area | Result |
| --- | --- |
| Registration | COMPLETE derived from current confirmation; revoke → not COMPLETE |
| Benefits | true→false recalculates; isolation between Wohngeld/Kindergeld |
| Housing | clear rent → incomplete; missing ≠ zero; reg independent |
| Tax | taxClass clear → not READY; churchTax unknown survives unrelated save |
| Healthcare | insuranceType clear emits invalidate; evaluator follows current facts |
| Employment/Discovery | Work & Income mutations do not invent Discovery runs |
| Error/revision | no-op save stable; builder carries `expectedHeadRevision`; E7/E11 boundaries retained |
| Cross-module | projections recalculate from same profile snapshot |
| Persistence | reload reconstructs from authoritative profile |
| Ownership | `userId = accountId ?? sessionId`; foreign access denied (existing semantics) |

## 12. Mutation failure semantics

| Failure | Expected | Status |
| --- | --- | --- |
| Validation reject | authoritative unchanged → derived unchanged | Client builds only diffs; empty draft → no requests |
| Network/server error | UI must not treat as applied | Existing mutation client paths |
| `REVISION_CONFLICT` | retry with refreshed revision; no clobber | `submitDomainCorrectionRequests` bumps revision; E7 sync |

## 13. Localization / a11y

Reverse states use existing keys (`READY_TO_ACT`, incomplete, unknown). EN/DE/RU/UA coverage from E2/E4–E11 suites. Probe spot-checks EN for raw keys. No UA←RU inheritance.

## 14. Browser probe

`tools/black-box-audit/probes/probe-e13-state-reversal-recovery.mjs`  
Artifacts: `tools/black-box-audit/artifacts/e13-state-reversal/`

## 15. Remaining P2 / P3

* **P2** Boolean unknown after known (checkbox semantics; revoke uses explicit `false`)
* **P2** Benefits draft may present unchecked as false before explicit user intent (pre-existing)
* **P2** Concurrent revision conflict not forced in browser (covered by unit/API; single-writer 409 retry observed)
* **P2** Account-scoped reversal not re-probed here (PD-011 ownership suites remain authoritative)
* **P2** Discovery full lifecycle ERROR/RUNNING recovery relies on existing Discovery suites/fixtures
* **P3** Explicit “clear confirmation to unknown” UX if product wants tri-state registration

## Browser probe results (2026-09-09)

Artifact: `tools/black-box-audit/artifacts/e13-state-reversal/report.json`

All minimum scenarios A–J passed after invalidate payload fix (registration revoke, housing clear, benefits reverse, tax clear, churchTax unknown, reload, EN keys).

## Verdict

**STATE REVERSAL PASS WITH LIMITATIONS**

Supported mutations recalculate derived state forward and backward. Unsupported reversals (boolean→unknown) are explicit. Failed mutations do not invent state.
