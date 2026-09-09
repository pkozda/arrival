---
id: discovery-persistence-implementation-v1
title: Arrival Atlas — Discovery Persistence Implementation v1 (PD-006)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
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
related:
  - discovery-persistence-design-v1
---

# Discovery Persistence Implementation v1

## Implemented

* **Ownership rule (unchanged, verified):** `resolveDiscoveryUserId = accountId ?? sessionId`.
* **Scope helper:** `resolveDiscoveryPersistenceScope` → `account` | `session`.
* **API honesty:** `persistenceScope` on Discovery profile list/create/get/update/enable/disable responses (trusted identity).
* **UI disclosure:** compact `DiscoveryPersistenceDisclosure` on Discovery header.
* **No migration:** anonymous session profiles are not rewritten onto accounts on claim.
* **No PD-007 / no second persistence store.**

## Ownership rule

```text
if accountId exists → Discovery owner = accountId (scope: account)
else → Discovery owner = sessionId (scope: session)
```

Server stamps `profile.userId`; client create bodies cannot set ownership.

## Files changed

| Area | Path |
| --- | --- |
| Design | `tools/black-box-audit/DISCOVERY-PERSISTENCE-DESIGN-v1.md` |
| Implementation | `tools/black-box-audit/DISCOVERY-PERSISTENCE-IMPLEMENTATION-v1.md` |
| Probe | `tools/black-box-audit/probes/probe-pd006-discovery-persistence.mjs` |
| Runtime | `apps/api/src/discovery/discovery-user-runtime.ts` |
| Routes | `apps/api/src/routes/discovery.ts` |
| API tests | `apps/api/src/discovery-persistence.pd006.api.test.ts` |
| Web types/hook | `apps/web/src/lib/discovery/types.ts`, `useDiscoveryModule.ts` |
| UI | `DiscoveryPersistenceDisclosure.tsx`, `DiscoveryPage.tsx`, CSS |
| i18n | `discovery-translations.ts` (+ pd006 test) |

## Tests

| ID | Result |
| --- | --- |
| A account linked-session persistence | PASS |
| B account isolation | PASS |
| C session reload | PASS |
| D session isolation | PASS |
| E identity precedence | PASS |
| F/G guided + self-directed same ownership | PASS |
| H list/get isolation | PASS (with A/B) |
| I mutation isolation | PASS |
| J disclosure field + i18n | PASS |
| K no run coupling | PASS |
| discovery-ui regression | PASS (34) |

## Browser validation

Probe → **BROWSER PASS**

* Session disclosure visible
* Guided create + same-session reload
* Second context cannot see first session profile
* Account continuity proven via API claim + linked session (`persistenceScope=account`)
* Account disclosure in live Atlas demo UI: **UNVERIFIED** (no claim chrome); covered by API + session disclosure UI

## Migration behavior

No automatic anonymous→account migration. Pre-claim session-owned profiles remain keyed by sessionId.

## PD-005 / PD-007

* Guided and self-directed share create API ownership.
* Profile create/list does not invent runs (PD-007 untouched).

## Limitations

* Atlas demo UI does not expose account claim; typical newcomers remain session-scoped until claim UX exists.
* Leave-demo orphan/delete/migrate policy still open.
* Account browser disclosure depends on future claim entry point.

## Final verdict

`PD-006 DISCOVERY PERSISTENCE SLICE PASS WITH LIMITATIONS`
