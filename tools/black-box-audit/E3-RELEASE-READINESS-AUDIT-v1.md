---
id: e3-release-readiness-audit-v1
title: Arrival Atlas — Product Hardening & Release Readiness Audit v1 (E3)
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e3
  - release-readiness
  - product-hardening
created: 2026-09-08
updated: 2026-09-08
---

# E3 Release Readiness Audit v1

## Verdict

**E3 RELEASE READINESS PASS WITH LIMITATIONS**

The composed product foundation is coherent enough to build on. No open P0. One P1 (language clobber after claim→reload) was fixed in this audit. Remaining items are deferred P2/P3 or valid environment limitations.

---

## 1. Final product contracts (verified in code)

| Area | Contract |
| --- | --- |
| Registration | `registrable address + municipalRegistrationConfirmed` → UX COMPLETE |
| Economic Reality | known state → Action Planner next action → mutation → recalculation |
| Healthcare | minimum context → `RECOMMENDATIONS \| MORE_INFO_REQUIRED \| NO_APPLICABLE_RESULT \| TECHNICAL_ERROR` |
| Employment | dual track; Job Search → `/modules/discovery` |
| Discovery lifecycle | `IDLE → QUEUED → RUNNING → SUCCESS \| NO_RESULTS \| ERROR` |
| Trust | DISCOVERED ≠ VERIFIED ≠ RELEVANT ≠ APPLIED (Atlas does not claim APPLIED) |
| Automation | schedule → operational projection → lifecycle; digest optional |
| Ownership | `userId = accountId ?? sessionId` (server-derived) |
| Claim | session Discovery → account claim → ownership transfer (+ heal-on-list) |
| Language | selected language stable across journey / reload / navigation |

---

## 2. Evidence matrix

| Requirement | Implementation | Focused tests | Browser evidence | Status |
| --- | --- | --- | --- | --- |
| Registration COMPLETE | `registration-ux-state.ts`, LE signals, ER satisfaction keys | catalog/signals PD-001, registration-ux-state | E1, E3, PD-001 probes | PASS WITH LIMITATIONS |
| ER Action Planner | `action-planner.ts`, ActionPlannerPanel | planner.pd002, API pd002 | PD-002, E1, E3 | PASS WITH LIMITATIONS |
| Healthcare outcomes | healthcare-navigation + ModuleUIProjection | healthcare tests, API pd003 | PD-003, E1, E3 | PASS WITH LIMITATIONS |
| Employment → Discovery | employment-dual-track.ts | employment-dual-track.test | PD-004, E1, E3 | PASS WITH LIMITATIONS |
| Discovery lifecycle | execution-lifecycle.ts | pd007 unit+API | PD-007, E1, E3 | PASS WITH LIMITATIONS |
| Results / trust | opportunity + trust presentation | pd008/pd009 | PD-008/009 (env-limited SUCCESS) | PASS WITH LIMITATIONS |
| Automation | automation-summary + scheduler | pd010 | PD-010; ops tick env-limited | PASS WITH LIMITATIONS |
| Account claim | ownership-transfer + account claim route | pd011, account-claim | PD-011, E3 | PASS WITH LIMITATIONS |
| Localization | core i18n + Atlas Home; no UA←RU | e2 cohesion, e1 ua | E2, E3 | PASS WITH LIMITATIONS |
| Ownership isolation | requireOwnedProfile | pd006/pd010/pd011 API | API isolation tests | PASS |
| Language after claim reload | AppProvider bootstrap gate (E3 fix) | document-language-sync | E3 smoke | PASS (fixed) |

Prior slice docs under `tools/black-box-audit/*IMPLEMENTATION*` / `*DESIGN*` / E1 / E2 treated as established evidence.

---

## 3. Regression-trap findings

| Pattern | Classification |
| --- | --- |
| `UA = { ...RU }` | **Mitigated** (E2); regression test guards source |
| ER UA ← EN spread | **Existing limitation** (P2) |
| Hard-coded “No direct constraints.” | **Existing limitation** (P2/P3 UX) |
| Silent `[]` healthcare without outcome | **Mitigated**; outcome required on projection |
| Client-supplied Discovery userId | **False positive** — ignored; server stamps owner |
| localStorage as domain SoT | **False positive** for domain; display language only |
| Fake SUCCESS / fabricated verification | **False positive** — lifecycle maps empty SUCCESS→NO_RESULTS |
| Fixed Discovery test SQLite dirs → 409 | **Actual regression risk** — fixed (wipe dir in beforeEach) |
| Claim→reload language → EN | **Actual regression risk** — fixed (AppProvider bootstrap) |

---

## 4. State-machine findings

| Machine | Notes |
| --- | --- |
| Registration | NOT COMPLETE → ACTIONABLE → PREPARED → confirm → COMPLETE; no impossible states found |
| Discovery execution | Derived lifecycle from run store; fast runs may skip visible QUEUED/RUNNING (known P2) |
| Ownership SESSION→ACCOUNT | Transfer + heal; claim can succeed with migration error (limitation) |
| Automation DISABLED↔ENABLED | Declarative schedule + operational projection (intentional dual store) |
| Healthcare | Explicit semantic outcomes; empty list alone is not success |

---

## 5. Failure / recovery findings

| Failure | Authoritative state | UI | Recovery |
| --- | --- | --- | --- |
| Stale revision / mutation fail | Server remains prior | Error surfaces in profile/forms | Retry |
| Discovery ERROR / NO_RESULTS | Terminal from run | Explicit lifecycle copy | Retry / adjust profile |
| Digest failure | Run status unchanged | Automation note | Retry prefs |
| Claim migration error | Account claimed; profiles may remain session until heal | Error + retry | List heal / retry claim |
| Missing translation | EN compose or raw key | Deterministic | Add key |

No P0 corruption paths found in audit scope.

---

## 6. Persistence findings

Profile / registration / housing / Discovery profiles-runs-results / schedule / notification prefs / claim ownership persist server-side. Display language persists in `localStorage` + session/profile when synced. Demo session durability remains explicitly limited (PD-006/010).

---

## 7. Ownership / isolation findings

`resolveDiscoveryUserId = accountId ?? sessionId`. Routes do not accept client `userId`. Cross-owner access → 404. Claim transfers only `fromUserId === session`. Scheduler is host-global over registered schedules (not a client IDOR). **Intentional architecture.**

---

## 8. Discovery pipeline integrity

Single pipeline SoT in `packages/discovery` execute/stages. Presentation adapters (trust/opportunity/result-view) read stored fields. Dual schedule (declarative vs operational) and novelty infer-on-read are intentional, not competing writers. No duplicate ownership source.

---

## 9. Cross-module recalculation

Housing + registration confirmation affect ER planner. Healthcare context drives outcome. Employment presentation from profile. Claim refreshes Discovery ownership/automation. Run completion drives result presentation. ER toast remount remains P2 (same-mounted panel only).

---

## 10. Localization regression check

E2 guards intact. E3 smoke: UA Discovery HUD `Пошук`; `document.lang=uk` stable after claim reload (post-fix). Residual P2: ER EN spill, Guide interpolations.

---

## 11. Accessibility smoke

E3: 0 unlabeled visible buttons on final home. Known residual: some `aria-disabled` without in-component reason; registration path explains blocks.

---

## 12. Operational sanity

No evidence of runaway Discovery polling after terminal in smoke. Test SQLite collision was the main ops trap found (fixed). Ops host tick requires token (env limitation).

---

## 13. Environment limitations

| Item | Class |
| --- | --- |
| Live Discovery SUCCESS + rich trust | VALID ENVIRONMENT LIMITATION |
| External ops tick (`ARRIVAL_ATLAS_OPS_TOKEN`) | VALID ENVIRONMENT LIMITATION |
| Possession-based account claim (not OAuth) | VALID ENVIRONMENT LIMITATION / product decision |
| Session demo durability | VALID ENVIRONMENT LIMITATION |

---

## 14. P0 / P1 / P2 / P3

### P0
None.

### P1 (fixed this audit)
1. AppProvider overwrote stored UA/DE/RU with default EN when consistency contexts were briefly null after remount (claim→reload).
2. PD-006/007/010/011 API tests reused fixed Discovery SQLite dirs → flaky 409/404 (test isolation).

### P2 (deferred)
- ER UA ← EN copy base; ER recalculation toast remount
- Guide interpolated EN titles; generic “No direct constraints.”
- Fast Discovery runs may skip visible QUEUED/RUNNING
- Claim/migration split-brain until heal-on-list
- Inferred novelty “NEW” semantics caveat

### P3 (deferred)
- Employment absent from primary HUD
- Richer multi-action ER planner
- Ops tick not in browser journey
- Journey Guide FAB not always on smoke path

---

## 15. Fixes implemented

See `E3-RELEASE-READINESS-IMPLEMENTATION-v1.md`.

---

## 16. Deferred work (short list)

1. Full ER UA dictionary (or explicit product decision to keep EN fallback)
2. ER planner toast across remounts
3. Employment in primary HUD
4. Durable digest mailbox UI
5. Stronger claim/auth (beyond possession)
6. Official Anmeldung URL / richer city prep (PD-001)

---

## 17. Product decisions required

1. Is EN fallback for sparse ER UA copy acceptable long-term?
2. When should Guide FAB appear for localization/a11y audits?
3. Possession claim vs real IAM — production bar?
4. Leave-demo orphan Discovery cleanup policy (PD-006 open)

---

## 18. Release-readiness matrix

| Area | Contract | Tests | Browser | Status |
| --- | --- | --- | --- | --- |
| Registration | Yes | Yes | E1/E3 | PASS WITH LIMITATIONS |
| Economic Reality | Yes | Yes | E1/E3 | PASS WITH LIMITATIONS |
| Healthcare | Yes | Yes | E1/E3 | PASS WITH LIMITATIONS |
| Employment | Yes | Yes | E1/E3 | PASS WITH LIMITATIONS |
| Discovery | Yes | Yes | E1/E3 | PASS WITH LIMITATIONS |
| Trust | Yes | Yes | Env-limited | PASS WITH LIMITATIONS |
| Automation | Yes | Yes | E3 | PASS WITH LIMITATIONS |
| Account claim | Yes | Yes | E3 | PASS WITH LIMITATIONS |
| Localization | Yes | Yes | E2/E3 | PASS WITH LIMITATIONS |
| Ownership | Yes | Yes | API | PASS |
| Recovery | Yes | Partial | Smoke | PASS WITH LIMITATIONS |
| Accessibility | Smoke | — | E3 | PASS WITH LIMITATIONS |

---

## 19. Final browser smoke

`tools/black-box-audit/probes/probe-e3-release-readiness.mjs`

**Result:** PASS WITH LIMITATIONS (0 P0/P1 after fix; trust panel N/A under NO_RESULTS = valid env limitation).

Artifacts: `tools/black-box-audit/artifacts/e3-release-readiness/`
