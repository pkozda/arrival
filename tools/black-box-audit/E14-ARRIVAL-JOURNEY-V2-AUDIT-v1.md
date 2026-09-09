---
id: e14-arrival-journey-v2-audit-v1
title: Arrival Atlas — End-to-End Arrival Journey v2 Audit (E14)
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e14
  - journey
created: 2026-09-09
updated: 2026-09-09
---

# E14 — Arrival Journey v2 Audit

## Success criterion

A newcomer can move through Arrival Atlas as one coherent journey: understand current situation, see what matters next, perform a real action, observe state change, continue, and recover when facts reverse or mutations fail.

## 1. Canonical journey (`E14-CANONICAL-JOURNEY-v1`)

| Step | User intent | Surface | Current state | Next action | Result | Next state |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Choose language | Welcome | No session prefs | Select UA/EN/DE/RU | `arrival_atlas_display_language` + `document.lang` | Localized chrome |
| 2 | Enter product | Welcome → Atlas Home | Guest / entry | Continue + Atlas entry | HUD exploring | Atlas Home slides |
| 3 | Orient | Atlas Home | Unknown situation | Open Life Events / modules | Navigate | LE or ER |
| 4 | Understand lifecycle | Life Events Galaxy | Derived from profile | Inspect / prepare Anmeldung | Projection only | Actionable registration |
| 5 | Secure address | Profile where-you-live | needs-address | Set `city` | `fact.correct` | Registration pending; Housing INCOMPLETE |
| 6 | Prepare Anmeldung | prepare-anmeldung | pending | External guidance | Guidance ≠ completion | Still pending |
| 7 | Confirm registration | Profile move-to-germany | pending | Check confirmation | `municipalRegistrationConfirmed=true` | COMPLETE / confirmed |
| 8 | Housing costs | Profile + ER Housing | INCOMPLETE | Set rent (+ income) | Recalc | Housing READY; Wohngeld may READY_TO_ACT |
| 9 | Benefits awareness | ER Benefits | READY_TO_ACT | Record receiving | `receiving*=true` | COMPLETED |
| 10 | Healthcare | healthcare-navigation | Missing info | Enrich insurance facts | Progressive outcome | Recommendations when sufficient |
| 11 | Work & growth | Employment dual-track | not_provided / known | Work & Income XOR Job Search | Distinct tracks | Discovery not invented |
| 12 | Job search | Discovery | IDLE unless acted | Explicit setup/run | Lifecycle authoritative | Results/trust honest |
| 13 | Tax | ER Tax Admin | NOT_ADDED | Set taxClass | READY; churchTax UNKNOWN | No Finance module |
| 14 | Continue / recover | Any → nav → reload | Mid-journey facts | Reverse or no-op | Derived recalculates | Consistent matrix |

**Friction notes (not blockers):** Employment & Healthcare are off HUD (reachable via Home/LE/direct URL). Atlas Home / Journey Guide may retain EN under UA (E1 P2). No global planner — ER / Benefits / LE / Discovery / Profile own distinct roles.

## 2. First-contact results

| Check | UA | EN | DE | RU |
| --- | --- | --- | --- | --- |
| Welcome → stored language | `ua` / doc `uk` | `en` | `de` | `ru` |
| Persist across LE/ER | Pass | Pass | Pass | Pass |
| Module nav after sync wait | Pass | — | — | — |
| Reload preserves language | Pass | — | — | — |
| Raw keys on ER | None | None | None | None |

Mechanism remains: `arrival_atlas_display_language → AppProvider → document.documentElement.lang` (`ua`→`uk`).

## 3. User-intent / state comprehension

Surfaces explain known / missing / complete / next via derived panels (Housing, Benefits, Tax, Action Planner) and LE Galaxy. Same facts do not contradict across Profile vs ER when hydrated:

* Registration confirmed ↔ ER `reg=confirmed` ↔ planner leaves `registration_gate`
* Housing READY ↔ city+rent present
* Wohngeld COMPLETED ↔ `receivingWohngeld=true`
* Tax READY ↔ taxClass known; churchTax UNKNOWN until set

## 4. Registration journey

`needs-address → pending (city) → prepare (guidance ≠ complete) → confirmed` — pass.  
No banking prerequisite. No heuristic completion. Reload + LE agree. Reverse `confirmed → pending` supported (E13/E14).

## 5. ER / Housing / Benefits

Housing READY after rent; planner stays coherent (`primary_plan`); Wohngeld READY_TO_ACT → COMPLETED → READY_TO_ACT on revoke; Registration independent; Kindergeld isolation held.

## 6. Healthcare

Route reachable; progressive enrichment (`insuranceType=public`) persists. Unknown insurance not asserted as uninsured by E14 probe. Deep MORE_INFO outcome covered by PD-003 suites.

## 7. Employment / Discovery

Dual tracks visible; `impliesJobSearchIntent=false`; `claimsDiscoveryRun=false`; Discovery reachable; return to Employment works. Live SUCCESS not required (infra limitation documented).

## 8. Tax journey

NOT_ADDED → READY via taxClass; churchTax UNKNOWN survives unrelated income save; no Finance module product surface.

## 9. Profile mutation integrity

Flow: draft → mutation → profile → recalculation. E14 fix: editor gated on `data-profile-ready` to prevent pre-hydration boolean no-ops. E7 revision retry and E11 churchTax tri-state remain intact. No-op save leaves derived ER state unchanged.

## 10. Navigation / continuation

HUD + direct routes preserve language (after client sync) and mid-journey ER state across LE / Employment / Discovery / Profile / ER.

## 11. Recovery / reversal

Wohngeld COMPLETED→READY_TO_ACT; Registration confirmed→pending; no-op mutation stable. External guidance ≠ completion.

## 12. Life Events projection integrity

LE remains projection (E12 baseline). No banking COMPLETE. Registration not blocked by banking. Discovery not invented by LE.

## 13. Cross-module consistency matrix

| State/fact | Profile | ER | Life Events | Module | After reload |
| --- | --- | --- | --- | --- | --- |
| address (city) | Bremen | Housing READY/INCOMPLETE | Address node from city | — | Same |
| municipal confirmation | checkbox true/false | `confirmed`/`pending` | Anmeldung from auth confirm | prepare guidance only | Same |
| rent | monthlyColdRent | Housing READY | Housing nodes | — | Same |
| Wohngeld receipt | receivingWohngeld | COMPLETED/READY_TO_ACT | Shared benefit keys (P2 abstraction) | — | Same |
| Kindergeld receipt | receivingKindergeld | card state | Shared keys (P2) | — | Same |
| taxClass | select | Tax READY | Tax/banking copy informational | Tax panel on ER | Same |
| churchTax unknown | empty select | UNKNOWN | — | — | Same |
| healthcare | insuranceType | — | Insurance nodes | healthcare-navigation | Persists |
| employment | employmentStatus | — | Employment nodes | dual-track not_provided | — |
| Discovery run | — | — | Not invented | Discovery lifecycle only | Explicit actions only |

## 14. Localization

UA/EN full journey; DE/RU spot-check. No raw ER keys. No UA←RU inheritance observed. Residual Atlas Home EN under UA = P2 (E1).

## 15. Accessibility (journey-level)

Native checkboxes/selects labeled; profile save disabled until ready with status text; benefits/housing/tax expose `role="status"` recalculation where present; external Discovery links use existing semantics. Residual: Employment/Healthcare not in HUD (discoverability P2).

## 16. P0/P1 findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| E14-K-STALE / hydration | P1 | Benefits revoke could no-op if editor interacted before profile hydration (unchecked defaults) | Gate editor on `profileReady`; probe waits `data-profile-ready` |
| E14-I-LANG (initial) | P1 candidate | `document.lang=en` while stored `ua` immediately after full `page.goto` | Client sync wait; SSR flash remains P2 if brief |

No open P0 after hardening.

## 17–18. P2/P3

* Employment & Healthcare off HUD
* Atlas Home / guide EN under UA
* Boolean → unknown unsupported (explicit false)
* Discovery live SUCCESS / account claim depth outside E14
* LE shared satisfaction keys / presentation ≠ catalog (E12)
* Concurrent revision conflict not forced in browser

## 19. Product decisions

No new planner, domain, or Finance module. Tax remains ER Option C. Ownership boundaries unchanged.

## 20. Limitations

Discovery live terminal SUCCESS; account-scoped claim re-probe; full a11y keyboard matrix not exhaustive.

## Verdict

**ARRIVAL JOURNEY PASS WITH LIMITATIONS**
