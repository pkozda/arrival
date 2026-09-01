---
id: adr-006-addendum-e9-discovery-ui
title: ADR-006 Addendum — PDE E9 Discovery UI
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-09-01
updated: 2026-09-01
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e6-2-http-admin-api-boundary
  - adr-006-addendum-e7-persistence-and-history
  - adr-006-addendum-e8-scheduler
  - discovery-domain-index
  - personal-discovery-engine-roadmap
---

# ADR-006 Addendum — PDE E9 Discovery UI

**Status:** Accepted (canonical roadmap E9 functional closure)  
**Date:** 2026-09-01  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Packages:** `@arrival-atlas/discovery`, `@arrival-atlas/api`, `@arrival-atlas/web`, `@arrival-atlas/core`

---

## Context

Canonical roadmap **E9 — Discovery UI** requires strategy-driven profile creation, criteria edit, enable/disable, results with evidence, and last-scan summary — without automatic applications or giveaway entries.

Implementation was delivered in three slices:

| Slice | Scope |
|-------|--------|
| **E9.1** | User-facing Discovery API in `packages/discovery` (framework-free handler + service) |
| **E9.2** | API gateway routes + Discovery web module at `/modules/discovery` |
| **E9.3** | Functional closure: Run now, profile criteria edit, persisted `changedFields` projection, score i18n, canonical organic Playwright journey |

**E6.2/E6.3 admin API** (`/admin/...`, Bearer operator tokens) remains separate from the user-facing surface documented here.

---

## Decision

Accept **canonical E9 functional closure** with the capabilities below.

### E9.1 — User-facing Discovery API

Location: `packages/discovery/src/user-api/`

| Capability | Notes |
|------------|--------|
| Profile list / get / create / update | Strategy validation via `StrategyRegistry`; `DiscoveryProfile` ownership by `userId` |
| Profile enable / disable | Persists `DiscoveryProfile.enabled` |
| Results list / detail | Includes verification, evidence, score breakdown, novelty metadata |
| Result `userState` PATCH | Uses E7 `ResultStateWriter` transition rules |
| Run summary | Latest operational run per profile (`RunStore.listByProfileId`) |
| **Run now** | `runProfileNow` → `executeProfileRunNow` (see below) |
| Bearer auth | `static-user-token-authenticator` for framework-free hosts |

HTTP handler routes under `/user/profiles/...` (distinct path prefix from E6 admin API).

### E9.2 — Discovery web UI + API gateway

**Gateway** (`apps/api`):

- Routes under `/api/modules/discovery/*`
- Session auth via `x-session-id` (credential-required tier)
- SQLite-backed `DiscoveryUserService` sharing `discovery.sqlite` with execution runtime
- Dev-only seed fixture at `POST /api/dev/discovery/seed-fixture` (deterministic Playwright helper — not the canonical journey)

**Web** (`apps/web`):

- Route: `/modules/discovery`
- Nav entry: `nav.discovery` in Atlas HUD
- Client: `apps/web/src/lib/discovery/` (client, hook, types, helpers)
- UI: profile sidebar, criteria panel, results list, result detail (evidence / score / verification / changed fields / user-state actions)
- i18n: `packages/core/src/i18n/discovery-translations.ts` merged into `getTranslations()`

**Identity boundary:** CSR `Profile` (life-event / economic-reality intake) is **not** merged with `DiscoveryProfile`. Discovery profiles are created and owned inside the Discovery module.

### E9.3 — Functional closure

#### Run now (pull-driven execution)

```text
Web: Run now
        ↓
POST /api/modules/discovery/profiles/:profileId/run-now
        ↓
DiscoveryUserService.runProfileNow
        ↓
executeProfileRunNow
        ├─ ensureProfileSchedule (sched:{profileId})
        ├─ DiscoveryService.runNow({ scheduleId })
        └─ DiscoveryService.processNext() loop until target run completes
        ↓
Refresh results + run-summary in UI
```

Architectural constraints preserved:

- Reuses existing `DiscoveryService`, scheduler, and execution queue (E4/E5/E8)
- **No** in-process cron daemon, **no** Redis, **no** scheduler redesign
- Pull-driven: the API request enqueues and processes until the run finishes or the queue is empty
- Disabled profiles return validation error; execution uses smoke HTTP transport in dev/test (`happyPathTransport`)

#### Profile criteria editing

- Gateway `PATCH /api/modules/discovery/profiles/:profileId`
- Web `updateDiscoveryProfile` + edit form reusing create-profile fields (name, country, role for jobs)
- Strategy/criteria validation remains in the backend (`parseUpdateProfileBody`); web does not duplicate domain rules

#### Persisted `changedFields`

E7 computes material `changedFields` on `NoveltyDecision`. E9.3 closes the user-facing loop:

- `buildPersistPlan` writes `changedFields` onto `DiscoveryResult` (CREATE → `[]`, UPDATE → novelty array)
- `toDiscoveryResultUserView` projects `result.changedFields ?? []` into `changeMetadata.changedFields`
- UI displays the API value in result detail — **no** novelty recomputation in `apps/web`

#### i18n

All four locales (en, de, ru, ua) include:

- `discovery.score.*` dimension labels for score breakdown
- Run now, edit, and profile action strings
- Dictionary completeness enforced by `apps/web/src/lib/i18n/dictionary-completeness.test.ts`

#### Canonical E2E coverage

Organic journey (no dev seed fixture): `apps/web/tests/e2e/arr-023/e2e-discovery-canonical-journey.spec.ts`

1. Open Discovery
2. Create profile (Jobs)
3. Edit criteria
4. Trigger Run now
5. Wait for completion
6. Inspect result (evidence, score breakdown, verification)
7. Change result `userState`
8. Reload and verify persisted profile/result state

A separate seed-based journey (`e2e-discovery-journey.spec.ts`) remains as a deterministic dev-fixture helper.

---

## Exit criteria evidence

| Criterion | Evidence |
|-----------|----------|
| User can create profile | E9.1 service/HTTP tests; canonical Playwright journey |
| User can edit criteria | `discovery-ui.test.tsx` (E9.3); canonical Playwright journey |
| User can enable/disable profile | E9.2 UI tests; gateway tests |
| User can trigger Run now | `discovery-user-api.test.ts` (E9.3 integration); `discovery.api.test.ts`; canonical Playwright |
| Results show match, confidence, evidence, verification | E9.1/E9.2 UI tests |
| Score breakdown uses i18n keys | `discovery-ui.test.tsx`; dictionary completeness test |
| `changedFields` from API | `discovery-user-api.test.ts`; UI test |
| User-state actions persist | E9.1 tests; seed + canonical Playwright reload steps |
| Last-scan / zero-new summary | E9.2 UI empty-results test |
| No automatic applications | No apply/entry actions in UI or user API |

### Verification status (2026-09-01)

| Suite | Result |
|-------|--------|
| `packages/discovery` full | **534/534** |
| E9 user API + run-now integration | **16/16** |
| `apps/api` discovery gateway | **3/3** |
| Web discovery UI + i18n | **20/20** |
| Canonical E9 Playwright | **1/1** |
| `packages/discovery` + `apps/api` TypeScript | **green** |

---

## Explicitly deferred / non-goals for E9

- **Scheduler redesign**, in-process **cron daemon**, or **Redis**
- **Automatic `DiscoveryProfile.schedule` → `DiscoveryScheduleRecord` projection** (E8 deferral unchanged)
- **Rich/advanced criteria editor** beyond name, country, role (jobs) / free-participation (giveaways) templates
- **`CandidateStore`**, **`DigestStore`**, full pipeline **`DiscoveryRun` archival**
- **E10** notification/digest **UI** (digest builder and email adapters exist in the engine; no user-facing digest preferences UI in E9)
- **Module catalog / home-card** discovery entry (HUD nav link only unless separately scheduled)
- **Automatic job applications or giveaway entries**
- **Scoring/novelty logic in `apps/web`**
- **Merging CSR `Profile` with `DiscoveryProfile`**
- **Replacing E6 admin API** with the user API (both coexist; different auth and route prefixes)

---

## Consequences

- **E10 (Daily Digest / Email)** can build on existing digest/notification engine paths; E9 does not add digest UI or preference screens.
- Hosts that need Bearer-token Discovery access can mount `createDiscoveryUserHttpHandler` directly; Atlas web uses session-scoped gateway routes.
- Run now depends on `DiscoveryService` being wired into `DiscoveryUserService` (production API host provides execution runtime with smoke transport in dev).
- Further UI polish (advanced criteria, module home cards) is out of E9 scope and requires a new epic or sub-slice.

## Related

- [E7 persistence & history](./adr-006-addendum-e7-persistence-and-history.md)
- [E8 scheduler](./adr-006-addendum-e8-scheduler.md)
- [E6.2 HTTP admin API](./adr-006-addendum-e6-2-http-admin-api-boundary.md)
- [Discovery domain index](../discovery/README.md)
- [PDE roadmap](../discovery/personal-discovery-engine-roadmap.md)
