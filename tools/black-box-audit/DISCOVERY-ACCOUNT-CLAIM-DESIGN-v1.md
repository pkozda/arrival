---
id: discovery-account-claim-design-v1
title: Arrival Atlas — Discovery Account Claim & Durable Continuity Design v1 (PD-011)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-011
  - discovery
  - account-claim
  - continuity
created: 2026-09-08
updated: 2026-09-08
related:
  - discovery-persistence-design-v1
  - discovery-automation-design-v1
---

# Discovery Account Claim & Durable Continuity Design v1

## Identity architecture (verified)

```text
SystemState.accountId  (null until POST /api/account/claim or ACCOUNT_LINK)
SystemState.session.id
request.identity = buildResolvedIdentity(state)  // server-derived only

POST /api/account/claim → AccountClaimService.claimSession(sessionId)
  → creates account (or returns existing)
  → ACCOUNT_CLAIM mutation
  → returns { accountId, sessionId, token, authSubject }
```

Discovery ownership (PD-006, unchanged):

```text
userId = accountId ?? sessionId
persistenceScope = accountId ? 'account' : 'session'
```

## Claim capability: **B**

* Account claim / sign-in infrastructure **exists** (`POST /api/account/claim`, idempotent).
* Discovery **migration did not** exist (PD-006 limitation: session-owned rows stay keyed by `sessionId` after claim).

PD-011 implements the smallest safe Discovery continuity layer on top of existing claim.

## Product problem

Session users can enable daily automation (PD-010) but that is not durable account ownership. UI must distinguish session continuity from account continuity without overclaiming.

## What is transferred

On successful identity claim (or heal when `accountId` is already present for this session):

| Entity | Transfer |
| --- | --- |
| Discovery profiles with `userId === sessionId` | Rewrite `userId → accountId` (same profile id) |
| Profile schedule / notification prefs | Preserved in profile payload |
| Runs / results / novelty / verification | Unchanged (keyed by `profileId`) |
| Operational schedule `sched:{profileId}` | Unchanged (no duplicate) |
| User-level notification email (`sessionId` key) | Move to `accountId` if account has none |

No unrelated Atlas state is migrated.

## Idempotency

* Profiles already under `accountId` are skipped.
* Profiles owned by other sessions/accounts are never touched.
* Repeated claim / heal is a no-op once transferred.
* Profile id preserved → no duplicate profiles/runs/results/schedules.

## Security

* `fromUserId` / `toUserId` derived only from trusted `request.identity`.
* Client cannot supply ownership targets.
* Foreign session/account still gets 404 on foreign profiles (no existence leak).

## Automation transition

`session automation → claim → account automation` with same profile id and schedule fields. Do not disable automation. Do not duplicate schedules. Scheduler continues resolving by `profileId`.

After claim, durable account language is allowed because ownership is account-scoped.

## UI

* Session: persistence disclosure + compact “Continue with account” CTA (existing claim API).
* Account: durable ownership disclosure; no claim CTA.
* Success = visible `persistenceScope=account` + profiles still listed (not toast-only).

## Non-goals

New auth system, OAuth, password management, generalized identity migration platform, leave-demo deletion policy, Discovery engine changes.
