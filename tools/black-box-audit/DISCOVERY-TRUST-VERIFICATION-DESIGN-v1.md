---
id: discovery-trust-verification-design-v1
title: Arrival Atlas — Discovery Trust & Verification Design v1 (PD-009)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-009
  - discovery
  - verification
  - trust
created: 2026-09-08
updated: 2026-09-08
related:
  - discovery-result-presentation-design-v1
  - discovery-execution-lifecycle-design-v1
---

# Discovery Trust & Verification Design v1

## Inspection verdict

The backend already has a real verification contract. Promoted results almost always have `verification.status === 'PASS'` because FAIL/UNKNOWN are rejected before promotion. The product gap is **presentation honesty**: a single “Verified” label collapses Jobs (official source page) and Giveaways (free participation + deadline) and hides stored `checks`, `sourceTrust`, `freshness`, and evidence.

PD-009 is **presentation of existing verification facts** — not a new verifier.

---

## Current pipeline

```text
candidate → verify adapter (HTTP checks)
  → deriveVerificationStatus(required checks)
  → FAIL/UNKNOWN rejected (not promoted)
  → PASS → score → novelty → DiscoveryResult.verification persisted
  → User API (full verification object)
  → Opportunity UI
```

### Engine statuses

`PASS | FAIL | UNKNOWN` (no `PARTIAL` in domain).

### Required checks

| Strategy | Required checks | PASS means (truthfully) |
| --- | --- | --- |
| Jobs | `official_source` | Required official-source check TRUE; finalize forces `sourceTrust=OFFICIAL` |
| Giveaways | `free_participation`, `deadline_valid` | Those checks TRUE; source may still be COMMUNITY/AGGREGATOR |

### Exclusion

Unverified / FAIL / UNKNOWN candidates are **not** promoted. UI should not invent a mixed “unverified opportunity list” unless such rows appear (legacy/fixture). If they appear, do **not** call them verified; do **not** offer Open source unless PASS + URL (existing rule).

---

## Distinctions (product)

```text
DISCOVERED  = found as a candidate (engine-internal; not a user badge for promoted rows)
VERIFIED    = required strategy checks passed at verifiedAt
RELEVANT    = criteria match score (separate from verification)
APPLIED     = never claimed by Atlas
```

---

## Selected UI semantics

1. **Trust summary** (concise, strategy-aware):
   - Jobs + PASS + `official_source` TRUE → “Official source page was checked”
   - Giveaways + PASS + free/deadline TRUE → “Free-entry and deadline checks passed”
   - PASS without recognizable checks → “Required verification checks passed” (weakest truthful claim)
   - FAIL → “Verification failed” (no Open source)
   - UNKNOWN / missing → “Verification status unknown” (no verified badge)

2. **Progressive details** (“Why checked”): list stored `checks` (id → localized label, outcome, optional `detail`) + evidence statements already on the result. No boilerplate paragraphs.

3. **Source trust**: localize `SourceTrust` enum when present; do not invent “official” from URL shape.

4. **Freshness**: show only if present (`CURRENT` / `EXPIRED` / `UNKNOWN`); no “still available” guarantee. Omit `STALE` unless present.

5. **Timestamp**: show `verifiedAt` / `lastVerifiedAt` as a date when present — not “recently verified” unless we only mean that timestamp.

6. **Relevance**: keep match score labeled as criteria match — not as trust.

7. **Actions**: keep Open source (external) only for PASS + URL.

8. **Lifecycle**: verification UI never remaps SUCCESS/NO_RESULTS/ERROR.

---

## Claims we must NOT make

- Guaranteed valid / officially approved / still available / you are eligible
- Apply completed
- Generic “Verified” without check context when strategy-specific facts exist

---

## Jobs vs Giveaways

Shared abstraction: trust summary + check list. Different summary copy and check id labels. Do not force giveaways to claim official employer pages.

---

## Localization / a11y

EN/DE/RU/UA for trust summary, check labels, outcomes, source trust, freshness, why-checked control. Status via text; expandable details keyboard-accessible (`<details>`/`<summary>` or button+region).

---

## Non-goals

New crawlers/verifiers/ranking/eligibility; lifecycle/persistence/guided redesign; inventing PARTIAL status.

---

## Testing / limitations

Focused helpers + UI + i18n; browser probe. Limitation: live FAIL/UNKNOWN results rare in UI because of promotion gates — covered by fixtures. Browser SUCCESS may be sparse (same as PD-008).
