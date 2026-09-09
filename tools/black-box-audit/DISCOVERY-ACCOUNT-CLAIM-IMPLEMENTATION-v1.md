---
id: discovery-account-claim-implementation-v1
title: Arrival Atlas — Discovery Account Claim & Durable Continuity Implementation v1 (PD-011)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-011
  - discovery
  - account-claim
created: 2026-09-08
updated: 2026-09-08
related:
  - discovery-account-claim-design-v1
---

# Discovery Account Claim Implementation v1

## Claim capability

**B** — Existing `POST /api/account/claim` reused; Discovery session→account migration added.

## Ownership rule

Unchanged: `userId = accountId ?? sessionId`.

## Migration design

`transferDiscoveryProfileOwnership({ fromUserId: sessionId, toUserId: accountId })`

* Invoked after successful account claim
* Heal on Discovery profile list when `accountId` present
* Notification email moved session→account when account has none

## Entities transferred

* Profiles (same id; schedule + notification prefs preserved)
* Runs/results/novelty/verification (unchanged; keyed by profileId)
* Operational schedules (unchanged; keyed by `sched:{profileId}`)
* User notification email (when safe)

## Idempotency

Repeated claim/heal transfers zero profiles once ownership is account-scoped. No duplicate ids.

## Security

Only trusted `request.identity` session/account ids. Foreign access remains 404.

## Automation transition

Daily schedule survives claim on the same profile id. No disable, no duplicate schedule.

## UI

`DiscoveryPersistenceDisclosure` + Continue with account CTA → claim API → store token → refetch → `persistenceScope=account`.

## Localization

EN/DE/RU/UA `discovery.continuity.*` keys.

## Files changed

* `packages/discovery/src/user-api/ownership-transfer.ts` (+ tests)
* `apps/api/src/discovery/discovery-continuity-migration.ts`
* `apps/api/src/routes/account.ts`, `discovery.ts`
* `apps/web/.../DiscoveryPersistenceDisclosure.tsx`, `DiscoveryPage.tsx`, `useDiscoveryModule.ts`, `client.ts`
* i18n + CSS
* `apps/api/src/discovery-account-claim.pd011.api.test.ts`
* docs + `probe-pd011-discovery-account-claim.mjs`

## Tests

* ownership-transfer.pd011
* discovery-account-claim.pd011.api
* account-claim regression
* i18n pd011
* discovery-ui continuity claim

## Browser validation

Probe branch `session-claim`: session disclosure → claim CTA → account ownership → reload persists → automation still daily.

**Result:** PASS

## Limitations

* Account claim remains possession-based session claim (existing IAM), not OAuth/password signup
* Claim request must send JSON body `{}` (Fastify empty-body rule)
* Leave-demo orphan cleanup still open
* Profile list selector in probe may not enumerate sidebar items (`data-ui-surface` variance); ownership + name presence validated
