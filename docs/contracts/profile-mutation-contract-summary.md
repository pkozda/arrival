---
id: profile-mutation-contract-summary
title: Profile Mutation Contract Summary
project: Arrival Atlas
system: Arrival Atlas
type: contract
domain: identity
status: active
maturity: stable
owner: system
tags:
  - profile-mutation
  - product-contract
  - mutation-request
created: 2026-06-19
updated: 2026-06-19
related:
  - profile-mutation-model-v1
  - ux-contract-v2
---

# Profile Mutation Contract Summary

Short reference for `@arrival-atlas/product-contract` profile mutation types.  
Full semantics: [profile-mutation-model-v1.md](../identity/profile-mutation-model-v1.md).

## Package location

```text
packages/product-contract/src/profile/
```

## MutationRequest

Uncommitted intent from a surface. **Not** a profile patch.

| Field | Purpose |
|-------|---------|
| `id` / `requestId` | Tracking + idempotency key |
| `type` | `fact.create`, `fact.correct`, `pref.update`, … |
| `intent` | Semantic vocabulary: `capture`, `correction`, `preference`, … |
| `domain` | `migration`, `housing`, `income`, … |
| `source` | `module`, `profile_ui`, `system`, `header` |
| `payload` | Typed domain fields — **not** `Record<string, unknown>` |
| `userConfirmationRequired` | Gate before commit |
| `expectedHeadRevision` | Optimistic concurrency for corrections |

## MutationEvent

Committed append-only log entry. Includes `fieldDeltas`, `sequence`, `revision`, `reason`.

## Registries

| Registry | Export |
|----------|--------|
| Domains | `PROFILE_DOMAINS`, `PROFILE_DOMAIN_REGISTRY` |
| Mutation types | `MUTATION_TYPES`, `MUTATION_TYPE_REGISTRY` |
| Intents | `MUTATION_INTENTS`, `MUTATION_INTENT_REGISTRY` |
| Persistent fields | `PERSISTENT_FACT_FIELD_REGISTRY` |
| Scenario fields | `SCENARIO_FIELD_REGISTRY` (excluded from profile state) |

## UserProfileViewV1

UI-safe projection: domain field IDs, completeness, preferences. No event log, no schema paths.

## Validation primitives

- Zod: `MutationRequestSchema`, `MutationEventSchema`, `ProfileRevisionSchema`, `UserProfileViewV1Schema`
- `validatePersistentPayloadFields()` — rejects scenario fields and unknown field IDs

## Not in this package (C2+)

- Reducer / `ProfileState`
- Mutation Layer coordinator
- Storage / API routes
- UI components
