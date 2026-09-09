---
id: discovery-result-presentation-design-v1
title: Arrival Atlas — Discovery Result Presentation Design v1 (PD-008)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-008
  - discovery
  - results
  - presentation
created: 2026-09-08
updated: 2026-09-08
related:
  - discovery-execution-lifecycle-design-v1
  - discovery-persistence-design-v1
  - discovery-guided-wizard-design-v1
---

# Discovery Result Presentation Design v1

## Inspection verdict

The Discovery **domain model is sufficient** for a useful opportunity experience. The gap is primarily **presentation**: list/detail omit source URLs and action CTAs; empty-list copy can conflate with PD-007 `NO_RESULTS`; score percent formatting assumes 0–1 while engine scores are 0–100; location is scored but **not persisted** on `DiscoveryResult` (omit, do not invent).

PD-008 is a **presentation + semantic honesty** slice on existing results — not a new engine.

---

## Current result architecture

```text
Pipeline candidate
  → novelty / persist-promote
  → DiscoveryResult (SQLite discovery_results JSON)
  → User API listResults / getResult (+ changeMetadata)
  → useDiscoveryModule.results
  → DiscoveryResultsList + DiscoveryResultDetail
```

Ownership: results inherit profile ownership (`requireOwnedProfile`); PD-006 `accountId ?? sessionId`.

Run linkage: `promotedFromRunId`. PD-007 SUCCESS/NO_RESULTS uses run-scoped applicable count; the list remains **profile-wide** history ordered by `lastChangedAt` / `updated_at` DESC.

---

## Current raw / result data (authoritative)

| Field | Use for PD-008 |
| --- | --- |
| `canonicalPresentation.title` | Required card title |
| `canonicalPresentation.summary` | Optional |
| `canonicalPresentation.primaryUrl` | Preferred external URL |
| `identity.canonicalUrl` | Fallback URL |
| `source.url` / `source.trust` / `source.label` | Fallback URL + trust context |
| `identity.fingerprintMaterial.company` / `organizer` | Organization |
| `verification.status` | Trust gate for actionable CTA (`PASS` required) |
| `score.matchScore` / `confidenceScore` | 0–100 relevance |
| `firstSeenAt` / `lastChangedAt` | Discovered / updated |
| `materialFields.salary` | Optional if present |
| `promotedFromRunId` | Current-run badge |
| Location extracted at score time | **Not on stored result** — omit |

---

## Normalization / persistence / API

- Presentation built at promote (`presentationFromCandidate`).
- Identity fingerprint dedup already exists (CREATE/UPDATE/SKIP).
- List API returns full `DiscoveryResultUserView`; no presentation DTO yet.
- Digest `rank()` exists for email — **not** applied to in-app list. Preserve list order; do not invent ranking.

---

## Current UI gaps

1. No external “Open source” CTA despite URLs on the model.
2. Generic empty list vs PD-007 `NO_RESULTS` / ERROR / in-progress conflation risk.
3. `formatMatchPercent` multiplies by 100 → wrong for 0–100 scores.
4. Heavy inspect metadata (raw lifecycle, weights) overshadows opportunity action.
5. SUCCESS hint exists; list does not highlight current-run results.
6. Stale test expects `discovery-zero-new-run` removed in PD-007.

---

## Selected presentation approach

1. **Pure view helpers** (`opportunity-presentation.ts`) mapping result → display fields + optional external action (no invented values).
2. **Fix score display** for 0–100 (compat with ≤1 fixtures).
3. **List**: lifecycle-aware empty/active states; count; current-run marker; title/org/match/discovered; no premature results claim during QUEUED/RUNNING.
4. **Detail**: summary, org, verification, timestamps, optional salary; primary CTA **Open source** (external) only when `verification.status === 'PASS'` and a URL exists; mark links as external; keep user-state actions.
5. **NO_RESULTS**: explicit copy + recover via existing Edit / Run again (no new editor).
6. **ERROR**: keep PD-007 error surface; results panel must not say “no matching opportunities”.
7. **Ownership**: unchanged — verify with tests.
8. **No** new ranking, dedup engine, verification system, or lifecycle redesign.

---

## Minimum useful result representation

Per opportunity (when present):

* title  
* organization  
* match relevance  
* discovered timestamp  
* verification status  
* external Open source (PASS + URL only)  
* summary / salary if present  
* current-run indicator when `promotedFromRunId === lastRun.runId`

---

## Result ↔ lifecycle

| Lifecycle | Results panel |
| --- | --- |
| QUEUED / RUNNING | Status: run in progress; do not claim NO_RESULTS; may show prior profile results as historical |
| SUCCESS | List + count; highlight applicable to last run |
| NO_RESULTS | Explicit no-match message; prior results (if any) labeled as previous |
| ERROR | Explicit failure; not NO_RESULTS |
| IDLE | Generic empty if no results; otherwise historical list |

---

## Ownership

Inherit profile ownership. Cross-user result GET/list → not found.

---

## Deduplication / ranking

Reuse existing identity dedup. In-app order remains store order (recent first). Digest ranking stays email-only — document limitation.

---

## Localization / a11y

New keys EN/DE/RU/UA for result count, open source (external), current run, previous results, in-progress results, source unavailable. External links: `target="_blank"` + `rel="noopener noreferrer"` + accessible name including “opens in new tab” / external cue. Status not by color alone (text badges).

---

## Non-goals

New search/ranking/dedup engines; PD-005–007 redesigns; history dashboard; notifications redesign; inventing location/apply flows.

---

## Testing strategy

Focused helpers + UI tests (A–L); API ownership already covered; browser probe `probe-pd008-discovery-results.mjs`.

---

## Known limitations

* Location not on persisted result → omitted.  
* Fast runs may skip visible QUEUED/RUNNING (PD-007).  
* Browser SUCCESS depends on live adapters; fixture/seed when needed.  
* Duplicate near-matches possible if fingerprints differ — out of scope.
