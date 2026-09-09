---
id: registration-integration-validation-v1
title: Arrival Atlas — Registration Integration Validation v1 (PD-001)
project: Arrival Atlas
system: Arrival Atlas
type: validation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-001
  - registration
  - integration-validation
created: 2026-09-07
updated: 2026-09-07
related:
  - registration-implementation-design-v1
  - product-decisions-v1
---

# Arrival Atlas — Registration Integration Validation v1 (PD-001)

## 1. Environment

* **How application was run:** repository normal workflow `npm run dev` (root `predev` rebuilds `@arrival-atlas/product-contract`, `profile-engine`, `modules`, `mbde`; then concurrently API `tsx watch` on `:3001` and Next web on `:3000`).
* **Prior state:** previous API process in terminal was stale/dead; web was down. Fresh `npm run dev` started for this validation.
* **PD-001 in running stack:** yes — `packages/modules/dist/life-event/plan/signals.js` contains `hasMunicipalRegistrationConfirmation` and Completion rule `hasRegistrableAddress && hasMunicipalRegistrationConfirmation`; core i18n includes confirmation label.
* **Rebuild/restart:** rebuild via `predev` + package builds; restart via `npm run dev`.
* **Validation method:** Playwright probe against localhost using normal UA first-contact → Profile → Life Events → Economic Reality flows (`tools/black-box-audit/probes/probe-pd001-integration-validation.mjs`). Artifacts under `tools/black-box-audit/artifacts/pd001-integration/`.
* **No production source changes** were made for this validation task (probe + report only).

## 2. Case A — No address

* **Expected:** Registration BLOCKED; address prerequisite; not COMPLETE.
* **Observed:** `/modules/life-event`; Anmeldung inspector status `Blocked`; graph node “Завершити Anmeldung · Blocked state”; profile `city` null; `municipalRegistrationConfirmed` absent. UI does not claim Anmeldung already happened.
* **Note:** existing inspector “Blocked: No direct constraints” wording remains a known UX limitation (out of scope).
* **Result:** **PASS**

## 3. Case B — Address without confirmation

* **Expected:** address satisfied; Registration actionable; NOT COMPLETE.
* **Observed:** housing editor saved `city=Bremen` via `POST /api/mutations` (409 revision conflict then 200 success). Profile: `municipalRegistrationConfirmed` null. Graph: address **Verified state**; Anmeldung **not** Verified/Completed.
* **Limitation:** Anmeldung node remained `aria-disabled` with alternate “Requires: banking…” / “ціль поки недоступна” galaxy copy. Disabled node click does not always move inspector focus (selection stayed on address). Domain NOT COMPLETE is proven; clean “actionable” inspector UX is incomplete (remaining PD-001 UX work).
* **Result:** **PASS** (with actionable UX limitation)

## 4. Case C — Explicit confirmation

* **UI flow:** `/profile/move-to-germany/edit` → checkbox “Я завершив(ла) Anmeldung у відповідній установі” → Зберегти.
* **Mutation:** `POST /api/mutations` — live `409 REVISION_CONFLICT` then `200` success with body including `"municipalRegistrationConfirmed":true` (revision 4). Redirect `?updated=1`.
* **Persistence / projection:** `GET /api/user-context` shows migration confirmation + housing city.
* **Life Events:** after confirmation + heuristic residency, G1 Anmeldung node left the active graph (life-state shift); Registration COMPLETE verified via domain formula + persisted fact (inspector COMPLETE wording not always present after graph change).
* **Result:** **PASS**

## 5. Case D — Economic Reality propagation

* **Observed:** `/modules/economic-reality`; domain inputs `city` + `municipalRegistrationConfirmed=true` ⇒ `registration_confirmed` formula true. UI advanced past registration-only focus (e.g. work/income recommended). AI Start-intent executions intentionally avoided.
* **Result:** **PASS**

## 6. Case E — Reload/replay

* **Observed:** full reload; `/profile/move-to-germany` still shows temporary resident; `GET /api/user-context` still has `municipalRegistrationConfirmed: true` and city Bremen. Not dependent on React-only memory.
* **Result:** **PASS**

## 7. Case F — Heuristic separation

* **Observed:** after address + `residencyStatus=temporary-resident` **without** confirmation: mirrored heuristic `isMunicipallyRegistered === true`, while `municipalRegistrationConfirmed` null and Registration graph not Verified/Completed.
* **Result:** **PASS**

## 8. Case G — Failure safety

* **Automated:** `packages/profile-engine/tests/pd001-municipal-registration-confirmed.test.ts` — revision conflict writes no confirmation.
* **Live:** multiple `409 REVISION_CONFLICT` responses during profile saves; confirmation only present after subsequent `200` mutation. No false COMPLETE from failed requests alone.
* **Result:** **PASS**

## 9. Regression observations

* Heuristic consumers were not modified in this task.
* Case F shows classify/heuristic can still become true from address+residency while Registration completion stays false — separation holds.
* Hydration mismatch console noise (UA vs EN bootstrap) observed; unrelated to PD-001 semantics.
* Existing blocked-inspector “No direct constraints” and galaxy Requires inversion remain product UX debt, not domain regressions from this slice.

## 10. Remaining PD-001 work

* Preparation UX for Anmeldung
* External guidance (Atlas does not perform registration)
* Polished blocked/recovery inspector (clear address prerequisite; actionable confirm path)
* Leave/return UX
* Full E2E acceptance gate (E2E-REG-004…007, E2E-REC-001/002, E2E-GLOBAL-003)

## 11. Final verdict

**INTEGRATION PASS WITH LIMITATIONS**

Why: live UI/API path proves the authoritative contract — address alone never yields Registration COMPLETE; explicit confirmation persists through mutation → user-context → reload; ER domain inputs satisfy `registration_confirmed`; heuristic remains separate. Limitations are existing inspector/galaxy actionable UX and LE node visibility after life-state shift — not false completion.
