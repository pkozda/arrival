---
id: discovery-persistence-design-v1
title: Arrival Atlas — Discovery Persistence Design v1 (PD-006)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-006
  - discovery
  - persistence
created: 2026-09-08
updated: 2026-09-08
---

# Discovery Persistence Design v1

## Current identity model (verified)

```text
SystemState.accountId  (null until /api/account/claim or ACCOUNT_LINK)
SystemState.session.id
request.identity = buildResolvedIdentity(state)  // accountId from SystemState only
```

Trusted identity is server-derived. Client `x-session-id` / bearer token cannot invent a foreign accountId.

## Current Discovery persistence model (verified)

```text
SQLite discovery.sqlite
  → discovery_profiles payload includes profile.userId
  → listByUserId(userId) filters ownership
  → requireOwnedProfile: foreign owner → 404 (not 403)

resolveDiscoveryUserId = accountId ?? sessionId
```

Create/list/get/update/enable/disable already pass the resolved userId into `DiscoveryUserService`. Client create bodies do **not** set ownership `userId`; the server stamps it.

## accountId / sessionId selection

| Condition | Discovery owner |
| --- | --- |
| `accountId` present | `accountId` |
| else | `sessionId` |

Linked sessions (`POST /api/accounts/:id/sessions`) keep the same accountId ⇒ same Discovery owner.

## Where ownership is enforced

* API: `discoveryUserId(request)` from `request.identity`
* Service: `profile.userId === userId` on get/update/results/run
* Store: `listByUserId` filter

## Demo/session behavior today

Anonymous Atlas demo sessions never claim → owner = sessionId. Reload same session keeps profiles; fresh session shows empty. Leave-demo creates new session continuity ⇒ prior session profiles become unreachable (not auto-migrated).

## Account-backed behavior today

After claim, owner = accountId. New linked session under same account should see the same profiles. Architecture already supports this; product disclosure and focused isolation tests were missing.

## Selected PD-006 implementation

1. Keep `resolveDiscoveryUserId` as the ownership rule (no second scheme).
2. Add `resolveDiscoveryPersistenceScope` → `'account' | 'session'`.
3. Expose `persistenceScope` on Discovery profile API responses (list/create/get/mutations) from trusted identity.
4. Compact UI disclosure on Discovery (account vs demo/session).
5. Focused isolation + precedence tests; browser probe for session + account (claim + linked session).
6. **No** anonymous→account migration (document limitation; leave-demo policy remains open).

## Migration / backward compatibility

Existing session-scoped rows remain keyed by sessionId. Claiming an account does **not** rewrite prior session-owned profiles onto the account. No silent migration.

## Profile isolation requirements

* Account A ⟂ Account B
* Session A ⟂ Session B (anonymous)
* Account identity wins when both accountId and sessionId exist
* Client cannot supply alternate ownership userId

## UI disclosure semantics

* Account: profiles saved to your account
* Session/demo: available only in this demo session  
No raw IDs. Compact notice near Discovery profile management.

## PD-005

Guided and self-directed share create API ⇒ same ownership. No separate persistence path.

## PD-007

Out of scope. Profile ≠ run/result. Runs already share userId scoping but lifecycle UX is PD-007.

## Security / privacy

Preserve 404-on-foreign-profile. Do not broaden list. Disclosure must not leak account/session identifiers.

## Non-goals

New auth system, leave-demo deletion policy, PD-007 lifecycle, Discovery engine redesign, E2E suite edits, Registration/ER/Healthcare/Employment changes.

## Testing strategy

API integration: account persist across linked session, A/B isolation, session reload, session isolation, precedence, mutation isolation, guided/self-directed same path, disclosure field. Browser: demo disclosure + session reload/isolation; account claim + linked session when environment allows.

## Known limitations

* Typical Atlas web flow remains demo/session until claim UX exists in product chrome.
* Leave-demo orphan/delete/migrate still open.
* Anonymous profiles created before claim are not migrated.
