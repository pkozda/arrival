---
id: state-reversal-recovery-implementation-v1
title: Arrival Atlas — State Reversal Implementation Note v1 (E13)
project: Arrival Atlas
system: Arrival Atlas
type: implementation-note
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

# State Reversal Implementation Note v1 (E13)

## What changed

### P1 fix — empty editor clears now emit `fact.invalidate`

Pre-E13, `buildDomainCorrectionRequests` skipped fields that normalized to `undefined`, so clearing a previously known select/number was a **silent no-op** (stale READY/COMPLETED risk for housing/tax).

**Change:** `apps/web/src/lib/profile-correction/mutation-request-builder.ts`

* `collectClearedDomainFields` — when draft normalizes to `undefined` but profile had a known non-boolean value → `fact.invalidate` with field keys / `null` values
* Booleans intentionally reverse via `fact.correct` with `false` (not invalidate-to-unknown)
* `dependentChildCount` clear → invalidate `children`

### P1 fix — `fact.invalidate` payload validation accepted null clear markers

Invalidate mutations were rejected with `INVALID_MUTATION` (`expected number, received null`) because domain field Zod schemas only allowed typed values.

**Change:** `packages/product-contract/src/profile/domain-field-types.ts`

* Added `InvalidateDomainFactPayloadSchema` (field keys → `null`)
* Unioned into `MutationRequestPayloadSchema`
* Engine already clears by key presence (`operation: 'clear'`)

No generic invalidate framework. Uses existing mutation type already understood by the profile engine.

### Tests

* `apps/web/src/lib/profile-correction/state-reversal.e13.test.ts` — registration, benefits, housing, tax, churchTax, healthcare clear, Discovery isolation, no-op, revision header
* `packages/mbde/src/awareness/wohngeld-reversal.e13.test.ts` — Wohngeld COMPLETED→READY_TO_ACT
* `packages/product-contract/src/profile/profile-mutation-contract.test.ts` — invalidate null parse
* Vitest alias: `@arrival-atlas/mbde/awareness` → awareness package entry (before mbde root)

### Probe / docs

* `tools/black-box-audit/probes/probe-e13-state-reversal-recovery.mjs`
* `tools/black-box-audit/STATE-REVERSAL-RECOVERY-AUDIT-v1.md`
* this file

## What did not change

* PD-001 registration completion semantics (still confirmation + address)
* E10/E11 tax semantics
* Action Planner ownership
* Discovery architecture
* No banking / Steuer-ID / Housing Search / new benefits
* No invented clear UI solely for audit coverage

## Supported vs unsupported (product decisions)

| Decision | Rationale |
| --- | --- |
| Boolean revoke = explicit `false` | Matches checkbox editors; unknown after known is P2 |
| Non-boolean clear = `fact.invalidate` with null markers | Legitimate existing mutation; needed for truthful READY→INCOMPLETE |
| Do not invent invalidate-only buttons | Avoid speculative UX |
| churchTax tri-state retained | E11 regression boundary |

## Recalculation contract

After any successful mutation (correct or invalidate):

1. Profile head updates
2. Evaluators re-read profile (Housing, Tax, Benefits, Registration UX, LE signals)
3. UI panels bind to derived view models — no local “completed” flags

Failed / no-op mutation → no profile change → derived unchanged.

## Ownership

Mutations remain session/account scoped via existing auth. Client-supplied foreign `userId` cannot clear another user’s facts (404/denied). Probe uses session-scoped anonymous journey; account claim covered by PD-011 / Discovery ownership suites.

## Browser probe (2026-09-09)

`probe-e13-state-reversal-recovery.mjs` observed:

* Registration COMPLETE → revoke → `pending`
* Housing READY → clear rent → INCOMPLETE
* Wohngeld/Kindergeld COMPLETED → READY_TO_ACT (isolated)
* Tax READY → clear taxClass → NOT_ADDED; churchTax UNKNOWN preserved
* Reload reconstructs; EN localization clean

## How to re-verify

```bash
npm run build -w @arrival-atlas/product-contract
npx vitest run --workspace apps/web src/lib/profile-correction/state-reversal.e13.test.ts
node tools/black-box-audit/probes/probe-e13-state-reversal-recovery.mjs
```

## Verdict

**STATE REVERSAL PASS WITH LIMITATIONS**

Limitations are intentional product gaps (boolean→unknown, Discovery lifecycle infrastructure depth, account-scoped probe reuse of PD-011), not stale-completion defects.
