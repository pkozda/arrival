---
id: discovery-execution-lifecycle-design-v1
title: Arrival Atlas — Discovery Execution Lifecycle Design v1 (PD-007)
project: Arrival Atlas
system: Arrival Atlas
type: design
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - pd-007
  - discovery
  - execution
  - lifecycle
created: 2026-09-08
updated: 2026-09-08
---

# Discovery Execution Lifecycle Design v1

## Verdict of inspection

PD-007 is primarily **(1) exposing an existing lifecycle** and **(2) normalizing inconsistent UI/API product semantics**, with a small amount of **(3) missing product-facing fields** on the existing run-summary contract.

A parallel execution engine is **not** required. Scheduler run records, queue jobs, and pull-driven `processNext` already exist.

---

## Current execution architecture

```text
Discovery profile (owned: accountId ?? sessionId)
  → POST .../profiles/:id/run-now
  → DiscoveryUserService.runProfileNow (requireOwnedProfile)
  → executeProfileRunNow
       → ensureProfileSchedule (sched:{profileId})
       → discoveryService.runNow → scheduler.triggerNow
            → ScheduledRunRecord status=PENDING, enqueue job
       → loop discoveryService.processNext() (pull-driven worker)
            → pipeline execute → ResultStore promote
       → return ProfileRunNowResult { runId, status, lastRun }
  → GET .../profiles/:id/run-summary
       → runStore.listByProfileId(profileId, 1) → lastRun
  → GET .../profiles/:id/results
  → Discovery UI (useDiscoveryModule + DiscoveryProfilePanel)
```

Host ops tick (`executeDiscoveryHostTick`) drains due schedules the same way; manual Run Now uses the same queue/worker path inline.

### Sync vs async

Manual Run Now is **pull-driven and request-scoped**: the HTTP handler waits while `processNext` drains work for the enqueued run (up to a max iteration budget). There is **no in-process daemon**. Long runs (~30s) keep the HTTP request open; the UI can show in-progress for that whole window.

If the process loop exits before a terminal engine status, the run can remain `PENDING`/`RUNNING` in SQLite. Without further `processNext` (another Run Now continue path or ops tick), the job does not advance by polling alone.

---

## Current Run Now flow (UI)

1. Click Run Now → client sets ephemeral `runNowStatus = 'running'`.
2. Awaits `POST run-now` for the full pull-process duration.
3. On response:
   - `failed` / `skipped` → UI `error`
   - **everything else** (including `pending` / `running`) → UI `success` ← **bug**
4. Reloads profile detail once; **does not poll**.
5. Reload of the page resets `runNowStatus` to `idle` even if `lastRun` is still active or terminal — panel mostly ignores server lifecycle for the primary banner.

---

## Current engine behavior

### Engine / scheduler run statuses (`DiscoveryRunStatus` / `ScheduledRunRecord.status`)

`PENDING | RUNNING | SUCCESS | PARTIAL_SUCCESS | FAILED | CANCELLED`

### Queue job statuses

`QUEUED | RUNNING` (visibility timeout ~300s)

### ProfileRunNowStatus (API)

`skipped | pending | running | success | partial_success | failed`

### Concurrency

At most one active run per schedule (`runningRunId` / `already_running` skip). Duplicate enqueue is rejected. **Concurrent runs per profile are not supported** — product must disable or continue the active run, not spawn duplicates.

---

## Existing persistence

| Concern | Store |
| --- | --- |
| Profiles | `discovery_profiles` (payload includes `userId`) |
| Scheduler runs | RunStore / SQLite scheduler DB (`ScheduledRunRecord`) |
| Queue jobs | execution queue SQLite |
| Results | ResultStore (`promotedFromRunId` links result → run) |
| Pipeline DiscoveryRun stats | pipeline path (not currently exposed on user run-summary) |

Ownership for runs/results is enforced via **profile ownership** (`requireOwnedProfile` before run-now, run-summary, results). Same PD-006 rule: `accountId ?? sessionId`.

---

## Existing result model

`DiscoveryResult` with `promotedFromRunId`. List endpoint returns profile results; empty array alone does **not** encode whether a run finished.

UI already has a partial signal: `SUCCESS && resultsCount === 0` → “No new results in the last run”, but Run Now still banners **success**, and `resultsCount` is **profile-total**, not run-scoped.

---

## Current UI behavior / gaps

| Gap | Detail |
| --- | --- |
| No product QUEUED | PENDING never mapped for users |
| Fake SUCCESS | Client maps non-failed run-now statuses to success |
| Weak NO_RESULTS | Empty/zero conflated with success banner |
| ERROR vs skip | `skipped` (e.g. already_running) treated as error |
| Ephemeral lifecycle | React `runNowStatus` lost on reload |
| No poll / continue | Non-terminal responses not observed to completion |
| Profile ≠ run | PD-005 fixed create≠run; execution distinctions still muddy |
| Raw engine status | Summary shows `SUCCESS`/`PENDING` strings, not product copy |

---

## Selected PD-007 implementation

1. **Pure mapper** `deriveDiscoveryExecutionLifecycle` in `@arrival-atlas/discovery` mapping engine last-run + run-scoped result count → product lifecycle.
2. **Enrich `ProfileRunSummary`** (and run-now result) with:
   - `lifecycle` (product)
   - `runId` (from lastRun)
   - `applicableResultCount` (results with `promotedFromRunId === runId`)
   - optional safe `errorMessage` (no stacks)
3. **Harden `executeProfileRunNow`**:
   - Process until target run is terminal or queue empty.
   - On `already_running` / active run: **continue draining** that run instead of returning a user-facing failure.
4. **UI**:
   - Authoritative lifecycle from run-summary (reload-safe).
   - While POST in flight: show RUNNING (request accepted / execution underway).
   - If response/summary is QUEUED/RUNNING: poll run-summary; when still active, call run-now again as **continue** (server drains active run).
   - Disable Run Now while QUEUED/RUNNING.
   - Distinct banners for IDLE / QUEUED / RUNNING / SUCCESS / NO_RESULTS / ERROR.
5. **No new engine, ranking, or DB schema** unless enrichment proves impossible (it does not).

---

## Product lifecycle mapping

| Product | Rule |
| --- | --- |
| IDLE | No lastRun, or lastRun terminal and UI not showing a just-finished banner preference — **default after create**: no lastRun → IDLE |
| QUEUED | lastRun.status === `PENDING` |
| RUNNING | lastRun.status === `RUNNING` |
| SUCCESS | `SUCCESS` or `PARTIAL_SUCCESS` and `applicableResultCount >= 1` |
| NO_RESULTS | `SUCCESS` or `PARTIAL_SUCCESS` and `applicableResultCount === 0` |
| ERROR | `FAILED` or `CANCELLED` (and failed run-now without recoverable skip) |

Validation/precondition failures (disabled profile, bad input) remain **HTTP 4xx / validation errors** and must **not** invent QUEUED/RUNNING.

---

## State transition rules

```text
IDLE
  -- Run Now accepted / enqueue --> QUEUED (PENDING)
  -- worker starts --> RUNNING
  -- terminal success with results --> SUCCESS
  -- terminal success with zero applicable results --> NO_RESULTS
  -- terminal failure --> ERROR

QUEUED/RUNNING
  -- duplicate Run Now --> continue same run (no second enqueue)
  -- reload --> reconstruct from run-summary
```

After terminal states, a new Run Now starts a **new** runId (new PENDING).

---

## Terminal-state semantics

- **SUCCESS**: show completed state + existing result cards/list for the profile; lifecycle tied to last run’s applicable count.
- **NO_RESULTS**: explicit copy — search completed, no matching opportunities — distinct from ERROR and from IDLE.
- **ERROR**: explicit error + retry (Run Now) when profile enabled; no stack traces.

---

## Failure semantics

| Class | Handling |
| --- | --- |
| Precondition (disabled, validation) | Do not start lifecycle; surface error; stay IDLE |
| Technical mid-run | Engine FAILED → ERROR |
| Zero applicable results | NO_RESULTS |
| already_running | Continue / show active lifecycle — not ERROR |

---

## Long-running execution

- Do **not** timeout RUNNING → ERROR after ~30s.
- Keep truthful QUEUED/RUNNING while lastRun is non-terminal.
- Prefer server completion via pull `processNext` (run-now continue + optional poll).
- UI must eventually show a terminal product state when the backend completes.

---

## Reload / continuation

On profile select / page load: `GET run-summary` (+ results) → derive lifecycle. Never rely only on React `runNowStatus`.

Active run after reload: show QUEUED/RUNNING and resume observe/continue until terminal.

---

## Profile / run relationship

- **profileId**: search configuration + ownership boundary.
- **runId**: individual execution identity from scheduler (`ScheduledRunRecord.runId`).
- Multiple historical runs may exist; product summary uses **latest** run for lifecycle.
- Profile create (PD-005) leaves lifecycle **IDLE** (no lastRun).

---

## Ownership (PD-006)

Unchanged identity: `resolveDiscoveryUserId = accountId ?? sessionId`. Run-summary / run-now / results already go through `requireOwnedProfile`. Cross-user access → not found. Add focused isolation tests for run-summary and run-now.

---

## Relationship to PD-005

Guided wizard creates profile only (`claimsDiscoveryRun=false`). After create, user can Run Now and enter this lifecycle. Do not auto-start runs from the wizard.

---

## Non-goals

- New Discovery engine / ranking / adapters
- Background daemon inside the API process
- Redesign of account/session system
- Anonymous→account migration
- Changes to Registration / ER / Healthcare / Employment / PD-005 wizard / PD-006 ownership rule
- Black-box E2E suite edits
- Fabricated results or timer-based fake progress

---

## Testing strategy

- Unit: lifecycle mapper (IDLE/QUEUED/RUNNING/SUCCESS/NO_RESULTS/ERROR)
- Service/API: run-summary enrichment; ownership isolation; continue-on-active; create≠run
- UI/hook: mapping + poll/continue behavior (focused)
- i18n: EN/DE/RU/UA keys present
- Browser probe `probe-pd007-discovery-execution.mjs` for IDLE → Run Now → active → terminal → reload

---

## Known limitations

- Product QUEUED may be brief when run-now processes inline before HTTP returns; client shows RUNNING while the request is in flight.
- `applicableResultCount` depends on `promotedFromRunId`; legacy rows without it may under-count (document if observed).
- Full browser ERROR / deterministic NO_RESULTS paths may need fixtures; covered by focused tests when browser cannot force them safely.
- Ops tick still required for purely scheduled (non-manual) drains in production hosts; PD-007 focuses on manual Run Now observability.
