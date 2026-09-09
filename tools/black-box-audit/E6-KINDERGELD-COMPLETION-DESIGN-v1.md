---
id: e6-kindergeld-completion-design-v1
title: Arrival Atlas — Kindergeld Completion Fact Design v1 (E6)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e6
  - benefits
  - kindergeld
  - completion
created: 2026-09-08
updated: 2026-09-08
---

# E6 Kindergeld Completion Fact Design v1

## Authoritative fact

`domains.benefits.receivingKindergeld?: boolean`

Same representation as `receivingWohngeld`:

| Value | Meaning |
| --- | --- |
| `undefined` | Unknown / not provided |
| `false` | Explicitly not receiving |
| `true` | User confirmed they currently receive Kindergeld |

## Source-of-truth semantics

* **Persisted:** profile fact `receivingKindergeld` via existing fact mutation / revision infrastructure
* **Derived:** Kindergeld awareness state (never persisted)

`children[]` means family context exists. It never means receipt.

## Relationship to awareness

`evaluateKindergeldAwareness`:

1. `receivingKindergeld === true` → `COMPLETED` (short-circuit)
2. `undefined` or `false` → existing E5 children/seed evaluation

## State transitions

```
NOT_ENOUGH_INFORMATION / READY_TO_ACT / NOT_APPLICABLE
  → user sets receivingKindergeld = true
  → COMPLETED

COMPLETED
  → user sets receivingKindergeld = false
  → normal awareness (children-based)
```

## Profile mutation path

Benefits Support editor (`/profile/benefits-support/edit`) checkbox  
→ `fact.correct` domain `benefits` field `receivingKindergeld`  
→ profile-engine projection includes field in `UserProfileView`  
→ ER panel re-evaluates

## Persistence / ownership

No new store. Ownership remains `userId = accountId ?? sessionId`. Revision conflicts use existing mutation recovery. No client-supplied ownership.

## Localization

EN/DE/RU/UA for field label, completion explanation, record-receiving CTA. No UA←RU.

## Legal / product boundary

Completion = **user-confirmed fact**, not authority-verified eligibility, amount, or continued entitlement.

## Limitations

* No external verification of Kindergeld payment
* Child ages remain optional / unspecified for awareness
* Seed rule remains presence-only
