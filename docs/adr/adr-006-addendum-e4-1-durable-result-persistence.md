---
id: adr-006-addendum-e4-1-durable-result-persistence
title: ADR-006 Addendum — PDE E4.1 Durable Result Persistence
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-31
updated: 2026-08-31
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e3-8-production-smoke-hardening
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E4.1 Durable Result Persistence

**Status:** Accepted (E4.1)  
**Date:** 2026-08-31  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

Introduce durable persistence for promoted `DiscoveryResult` records behind the existing **read-only `ResultStore`** and **`ResultWriter`** ports (E2.6/E2.7).

E4.1 implementation: **SQLite** via `better-sqlite3`, factory `createSqliteResultPersistence`.

Domain types remain storage-neutral. SQL/ORM types do not leak into pipeline or domain APIs.

## Why SQLite (E4.1)

Monorepo inspection found **no installed database client** yet. Platform docs plan **PostgreSQL 15+** (`DATABASE_URL` in `.env.example`), but E4.1 needs:

- deterministic automated tests without external services;
- restart durability;
- relational uniqueness + transactions;
- minimal isolated adapter boundary.

SQLite satisfies E4.1 without inventing application-wide DB infrastructure. A future **PostgreSQL adapter** can reuse the same `serializeDiscoveryResult` / `deserializeDiscoveryResult` boundary and equivalent DDL (`packages/discovery/src/schema/sqlite-discovery-results.sql` documents the portable shape).

## Storage boundary

```text
DiscoveryResult
    ↕ serializeDiscoveryResult / deserializeDiscoveryResult
DiscoveryResultRecordV1 { schemaVersion: 1, result }
    ↕ SQLite TEXT payload column
discovery_results table
```

- Schema version: `DISCOVERY_RESULT_RECORD_SCHEMA_VERSION = 1`
- Unsupported versions → `ResultStoreError` (never silent partial domain objects)
- No raw HTML / fetched page bodies — Result persistence only

## Identity / uniqueness

Uniqueness follows existing E2.7 `buildPersistPlan` id convention:

```text
result:{profileId}:{resultIdentityKey(identity, identityFingerprintFields)}
```

`PRIMARY KEY (id)` prevents duplicate promoted results. `findByIdentity` computes the same id at read time — no new domain identity model.

## Transaction / atomicity

`create` and `update` run inside SQLite transactions. Duplicate create or missing update throws `ResultWriterError`. Failed writes do not leave partial rows.

## Failure semantics

| Condition | Behavior |
|-----------|----------|
| No row | `findByIdentity` → `null` (NEW novelty) |
| DB / parse / schema error | `ResultStoreError` (not NEW) |
| Duplicate create | `ResultWriterError` |
| Missing update target | `ResultWriterError` |
| Pipeline writer failure | existing `PERSIST_FAILED` / `PARTIAL_SUCCESS` semantics |

Credentials and connection strings are never logged from the adapter.

## Configuration

```ts
createSqliteResultPersistence({
  databasePath, // file path or ':memory:'
  ensureDirectory?: boolean,
})
```

Composition root supplies `databasePath`. Adapter does **not** read `process.env`.

## Deferred (not E4.1)

- E4.2+ scheduler / recurring runs
- PostgreSQL production adapter (planned; same record envelope)
- Profile / Run / Candidate / Digest durable tables
- Distributed locking, queues, notification delivery
- Raw content archival

## Related

- [E3.8 smoke hardening](./adr-006-addendum-e3-8-production-smoke-hardening.md)
- [Discovery README](../discovery/README.md)
