---
id: e1-cross-module-journey-audit-v1
title: Arrival Atlas — Cross-Module Journey Integration Audit v1 (E1)
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e1
  - cross-module
  - journey
  - black-box-audit
created: 2026-09-08
updated: 2026-09-08
related:
  - e2e-product-specification-v1
  - pd-001 … pd-011 implementation docs
---

# E1 — Cross-Module Journey Integration Audit v1

## 1. Current cross-module graph

```text
First Contact (ArrivalWelcomeGate)
  → language select → Continue
  → Atlas Guest Landing → enterAtlas()
  → Atlas Home (member slides + HUD)

Atlas HUD:
  /  |  /modules/life-event  |  /modules/economic-reality  |  /modules/discovery  |  /profile

Slides / secondary:
  Registration / LE → /modules/life-event (+ /prepare-anmeldung)
  Housing / Healthcare profile CTAs → /profile/…
  Finance → /modules/economic-reality
  Work & Growth → /modules/employment → Job Search → /modules/discovery

Discovery session → Continue with account → POST /api/account/claim
  → ownership migration → automation continues on same profileId
```

| Transition | Entry | Route | State source | Persistence |
| --- | --- | --- | --- | --- |
| Welcome → Atlas | Continue CTA | `/` | welcome localStorage | SESSION browser |
| LE Registration | prepare-anmeldung / profile edit | `/modules/life-event/prepare-anmeldung`, profile edits | `housing.city`, `municipalRegistrationConfirmed` | PERSISTED (session/account SystemState) |
| → Economic Reality | HUD / LE action | `/modules/economic-reality` | satisfaction keys + plan | RECOMPUTED on navigate/mutate |
| → Healthcare | LE/profile CTA | `/modules/healthcare-navigation` | insurance domain | PERSISTED profile |
| → Employment | Work slide / direct | `/modules/employment` | employment/migration domains | PERSISTED |
| → Discovery | Job Search href | `/modules/discovery` | Discovery userId | PERSISTED SQLite |
| → Claim | Continuity CTA | `/api/account/claim` | identity + profile.userId | PERSISTED |

## 2. Journey contract results (8 stages)

| Stage | Registration | ER | Healthcare | Employment | Discovery |
| --- | --- | --- | --- | --- | --- |
| Intent | PASS | PASS | PASS (module) | PASS dual-track | PASS |
| Why | PASS (prep UX) | PASS planner | PASS outcomes | PASS tracks | PASS ownership/automation copy |
| Current state | PASS | PASS | PASS (MORE_INFO / recommendations prior PD-003) | PASS not_provided honesty | PASS lifecycle |
| Next step | PASS | PASS gate CTAs | PASS missing insurance CTA (PD-003) | PASS Work vs Job Search | PASS Run Now / claim |
| Action | PASS | PASS | PASS | PASS href handoff | PASS |
| State change | PASS | PASS | PASS | N/A (handoff) | PASS |
| Visible confirmation | PASS COMPLETE | PASS action set change | PASS outcomes | PASS surfaces | PASS lifecycle/ownership |
| Recalculation | PASS LE signals | PASS plan rebuild | PASS on execute | N/A | PASS run-summary |

## 3. Cross-module transition results

| Transition | Result | Classification |
| --- | --- | --- |
| Registration → ER | Housing CTA cleared after confirm; planner present | OBSERVED_PASS |
| Registration → Healthcare | No invented insurance from registration | OBSERVED_PASS |
| Healthcare → Employment | No false employment/insurance implication | OBSERVED_PASS (prior + E1) |
| Employment → Discovery | Href handoff; no fake run | OBSERVED_PASS |
| Discovery → Claim → Automation | Account scope + daily cadence after reload | OBSERVED_PASS |
| Return Employment → Discovery | Same ownership + lifecycle | OBSERVED_PASS |

## 4. Return/recovery results

* Reload after claim: account + daily cadence — PASS  
* Leave Discovery → Employment → Discovery: state preserved — PASS  
* ER after profile mutation: plan recomputes on navigation — PASS (toast may miss remount — known PD-002 limitation)

## 5. Stale-state findings

| Situation | Behavior | Risk |
| --- | --- | --- |
| Profile mutate → ER | Refetch via sync / remount | Low — next action updates |
| ER open while mutating elsewhere | May need leave/return | P2 if multi-tab |
| Discovery claim | Immediate refetch + reload-safe | None observed |
| Schedule enable | Run-summary refresh | None observed |

## 6. Localization findings

| Finding | Class | Priority |
| --- | --- | --- |
| UA Discovery HUD showed RU `Поиск` via `UA = { ...RU }` inheritance | OBSERVED_GAP → **fixed in E1** | P1 |
| Atlas Home slide titles/CTAs still largely EN under UA | OBSERVED_GAP (CROSS-UX-001 residual) | P2 |
| Journey Guide welcome often EN | OBSERVED_GAP residual | P2 |
| ER primary intent labels sometimes key-like EN | Known PD-002 limitation | P2 |

## 7. Status-semantic findings

* Registration COMPLETE requires explicit confirmation (PD-001) — consistent with ER `registration_confirmed`  
* Discovery SUCCESS ≠ applied; NO_RESULTS ≠ ERROR — consistent across return  
* Session-owned ≠ account-owned — disclosed  
* Employment dual-track does not invent unemployed — consistent  

No P0 semantic contradictions found in E1 live journey.

## 8. Ownership findings

* Discovery `userId = accountId ?? sessionId` preserved  
* Claim migrates session profiles; foreign isolation intact (PD-011)  
* No client-supplied ownership  

## 9. Galaxy / Product Guide consistency

* Journey Guide welcome on LE/ER/Profile; **not** on Discovery (intentional PD-005)  
* Employment not in HUD — reachable via Work slide / direct route (P3 cohesion)  
* Galaxy “Take me there” selects nodes; real navigation via inspector/action hrefs — not a false CTA  

## 10. External-action boundaries

* Anmeldung external open ≠ confirmation (PD-001)  
* Discovery Open source ≠ applied (PD-008/009)  
* E1 return: no false “applied” claim — PASS  

## 11. Persistence matrix

| State | Session reload | Nav away/back | Account claim | New session |
| --- | --- | --- | --- | --- |
| Registration confirmation | PERSISTED | PERSISTED | PERSISTED (profile) | NOT_SUPPORTED (new anonymous) |
| Housing | PERSISTED | PERSISTED | PERSISTED | NOT_SUPPORTED |
| Healthcare context | PERSISTED | PERSISTED | PERSISTED | NOT_SUPPORTED |
| Employment state | PERSISTED | PERSISTED | PERSISTED | NOT_SUPPORTED |
| Discovery profile | PERSISTED | PERSISTED | PERSISTED (migrated) | NOT_SUPPORTED (session) / PERSISTED (account+linked) |
| Discovery runs | PERSISTED | PERSISTED | PERSISTED (same profileId) | same as profile owner |
| Discovery results | PERSISTED | PERSISTED | PERSISTED | same |
| Discovery schedule | PERSISTED | PERSISTED | PERSISTED | same |
| Notification prefs | PERSISTED | PERSISTED | PERSISTED (email moved if empty) | keyed by userId |

## 12. P0 / P1 / P2 / P3

### P0
None observed in E1 live journey.

### P1
* **E1-LOC-001** UA Discovery chrome inherited Russian — **FIXED** (`nav.discovery` / module chrome Ukrainian; regression test).

### P2
* Residual CROSS-UX-001 (Atlas Home / Journey Guide EN under UA)  
* ER recalculation banner only within mounted instance  
* Healthcare module surface selector weak in probe (URL path still verified)  
* Remaining UA Discovery strings still inherited from RU where not overridden  

### P3
* Employment absent from HUD  
* Deeper multi-action ER planner prioritization  
* Ops host-tick in journey (env-limited)

## 13. Implemented fixes

See `E1-CROSS-MODULE-JOURNEY-IMPLEMENTATION-v1.md`.

## 14. Remaining limitations

* Full Atlas Home / Guide localization not rewritten in this audit  
* Live Discovery SUCCESS with trust panel still environment-limited (NO_RESULTS honest)  
* Possession-based account claim (existing IAM)

## 15. Product decisions required

1. **HUD IA:** Should Employment appear in primary HUD? (P3)  
2. **Localization strategy:** Finish UA Discovery by stopping `...RU` inheritance vs continue selective overrides? (P2)  
3. **CROSS-UX-001 scope:** Prioritize Atlas slide i18n vs accept EN product names in demo? (P2)

## Browser probe

`tools/black-box-audit/probes/probe-e1-cross-module-journey.mjs`  
Artifacts: `tools/black-box-audit/artifacts/e1-cross-module-journey/`  
**Live verdict: PASS** (all phases A–I; claim + automation continuity observed)
