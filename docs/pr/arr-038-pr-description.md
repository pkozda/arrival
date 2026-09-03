# arr-038 — Personal Discovery Engine (PDE) · E8–E10 complete

**Branch:** `arr-038`  
**Tracks:** Personal Discovery Engine — canonical E8 scheduler closure · E9 Discovery UI · **E10 notifications & automated delivery**  
**Base:** `develop` (post arr-037 / merge #35)

Extends `@arrival-atlas/discovery` from **canonical E7** through **canonical E10 closure**: operational scheduler profile gate, user-facing Discovery API, Atlas web module, pull-driven **Run now**, automated email delivery, notification preferences, and host-triggered daily execution — without redesigning the scheduler or coupling PDE to CSR/MBDE.

This PR **does** wire PDE into `apps/web` and `apps/api` for end-user Discovery **and** automated email notification. It does **not** add PostgreSQL, Redis, in-process cron daemons, account-email integration, or automatic job applications / giveaway entries.

1. **Canonical E8 — Scheduler** — `DiscoveryProfile.enabled` gate at trigger time (`profile_disabled`); pull-driven execution unchanged.
2. **E9.1 — User-facing Discovery API** — framework-free handler + `DiscoveryUserService` in `packages/discovery/src/user-api/`.
3. **E9.2 — Discovery web UI + API gateway** — `/modules/discovery` · `/api/modules/discovery/*` · session auth · Atlas HUD nav · i18n.
4. **E9.3 — Functional closure** — Run now · profile criteria edit · persisted `changedFields` projection · `discovery.score.*` i18n · canonical organic Playwright journey.
5. **E10.1 — Notification wiring** — Atlas recipient resolution · worker → `NotificationService` → email · NOTIFIED write-back.
6. **E10.2 — Schedule projection** — `DiscoveryProfile.schedule` → operational `DiscoveryScheduleRecord` (daily cadence).
7. **E10.3 — Host tick** — `executeDiscoveryHostTick()` · `POST /api/ops/discovery/trigger-due-runs`.
8. **E10.4 — Notification preferences** — `emailEnabled` / `skipEmptyDigest` via profile API + Discovery UI.
9. **Documentation closure** — roadmap · domain index · ADR-006 addenda (E8 · E9 · **E10**).

**Product verdict:** A signed-in user can open Discovery, create a Jobs or Giveaways profile, edit criteria and notification preferences, trigger **Run now** or rely on host-triggered daily schedules, receive attention-first email when warranted, inspect verification/evidence/score/changed fields, update result user state, and reload with persisted state — within Atlas chrome and four-locale i18n.

**Diff vs `develop` (working tree):** ~75+ files across `packages/discovery/` · `packages/core/` · `apps/api/` · `apps/web/` · `docs/` · **3** new ADR-006 addenda (E8 · E9 · E10) · discovery package **552** tests green · CSR/MBDE domain logic untouched.

---

# Part 1 — Architecture (source of truth)

## Engine placement (unchanged)

| Capability | Question |
|------------|----------|
| **CSR** | What is happening for this user right now? |
| **MBDE** | What support / entitlements may apply? |
| **PDE** | What external opportunities exist and deserve attention? |

## User-facing surface (new in E9)

```text
Atlas web (/modules/discovery)
        ↓  x-session-id
API gateway (/api/modules/discovery/*)
        ↓
DiscoveryUserService (E9.1)
        ├── ProfileStore / ResultStore / RunStore (E7 SQLite)
        ├── ResultStateWriter (E7 transitions)
        └── DiscoveryService (E6.1) — optional; required for Run now
                ↓
        executeProfileRunNow (E9.3)
                ├─ ensureProfileSchedule (sched:{profileId})
                ├─ runNow({ scheduleId })
                └─ processNext() loop (pull-driven)
```

**Distinct surfaces:**

| Surface | Auth | Prefix | Audience |
|---------|------|--------|----------|
| **E9 user API** | Bearer token | `/user/profiles/...` | Framework-free hosts |
| **E9 gateway** | Session (`x-session-id`) | `/api/modules/discovery/...` | Atlas web |
| **E6 admin API** | Bearer + permissions | `/schedules`, `/runs`, … | Operators |

CSR `Profile` (life-event intake) remains **separate** from `DiscoveryProfile`.

## Packages touched

| Package | Role |
|---------|------|
| `@arrival-atlas/discovery` | User API · `changedFields` on `DiscoveryResult` · E8 profile gate · exports for gateway |
| `@arrival-atlas/api` | Session-scoped gateway · execution runtime · dev seed fixture |
| `@arrival-atlas/web` | Discovery module UI · client/hook · Playwright journeys |
| `@arrival-atlas/core` | `discovery-translations` (en · de · ru · ua) merged into `getTranslations()` |

---

# Part 2 — Canonical E8 · Scheduler closure

## Gap closed

Operational scheduler spine (E4.2/E5) existed; **`DiscoveryProfile.enabled` was not enforced** at trigger time.

## Delivered

- `createDiscoveryScheduler` loads profile before claim/enqueue
- Disabled profile → `skipped` with reason **`profile_disabled`**
- Schedule-level `disabled` unchanged (checked before profile gate)
- Tests: `scheduler.test.ts` (`E8 profile enabled gate`)

## Architectural notes (unchanged)

- `DiscoveryProfile.schedule` = declarative product intent; **does not** directly drive operational `DiscoveryScheduleRecord`
- Pull-driven `triggerDueRuns()` / `runNow()` — **no** in-process cron daemon
- Deferred: automatic profile-schedule projection · timezone-aware daily slots · Redis

**ADR:** [adr-006-addendum-e8-scheduler.md](../adr/adr-006-addendum-e8-scheduler.md)

---

# Part 3 — E9.1 · User-facing Discovery API

Location: `packages/discovery/src/user-api/`

## Capabilities

| Operation | Notes |
|-----------|--------|
| List / get / create / update profiles | Strategy validation via `StrategyRegistry`; ownership by `userId` |
| Enable / disable profile | Persists `DiscoveryProfile.enabled` |
| List / get results | Verification · evidence · score breakdown · `changeMetadata` |
| PATCH result `userState` | E7 `ResultStateWriter` transition rules |
| GET run-summary | Latest operational run per profile |
| POST run-now | `runProfileNow` → `executeProfileRunNow` |
| Bearer auth | `static-user-token-authenticator` for framework-free hosts |

## Port extensions (E9 prerequisites)

- `ProfileStore.listByUserId`
- `ResultStore.getById` · `listByProfile`
- `RunStore.listByProfileId`

## `changedFields` projection

- E7 computes material `changedFields` on `NoveltyDecision`
- `buildPersistPlan` writes `changedFields` onto `DiscoveryResult` (CREATE → `[]`, UPDATE → novelty array)
- `toDiscoveryResultUserView` projects `result.changedFields ?? []` — **no** hardcoded `[]`

HTTP routes: `/user/profiles/...` (distinct from E6 admin paths).

---

# Part 4 — E9.2 · Discovery web UI + API gateway

## API gateway (`apps/api`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/modules/discovery/profiles` | GET · POST | List · create |
| `/api/modules/discovery/profiles/:profileId` | GET · PATCH | Get · update criteria |
| `/api/modules/discovery/profiles/:profileId/enable` | POST | Enable |
| `/api/modules/discovery/profiles/:profileId/disable` | POST | Disable |
| `/api/modules/discovery/profiles/:profileId/results` | GET | List results |
| `/api/modules/discovery/profiles/:profileId/results/:resultId` | GET | Result detail |
| `/api/modules/discovery/profiles/:profileId/results/:resultId/user-state` | PATCH | User state |
| `/api/modules/discovery/profiles/:profileId/run-summary` | GET | Last run |
| `/api/modules/discovery/profiles/:profileId/run-now` | POST | Manual run (202) |
| `/api/dev/discovery/seed-fixture` | POST | Dev-only Playwright seed |

- Session auth via `x-session-id` (credential-required tier in `route-security-map.ts`)
- `discovery-user-runtime.ts` — SQLite-backed `DiscoveryUserService`
- `discovery-execution-runtime.ts` — `DiscoveryService` with smoke transport in dev/test
- Shared `discovery.sqlite` state dir

## Web (`apps/web`)

| Path | Role |
|------|------|
| `/modules/discovery` | Discovery module page (`GalaxyViewport` + `DiscoveryPage`) |
| `src/lib/discovery/` | Client · hook · types · helpers · errors |
| `src/modules/discovery/ui/` | Profile sidebar/panel · results list · result detail |
| `AtlasHUD.tsx` | `nav.discovery` link |

UI surfaces: profile create (Jobs/Giveaways templates) · criteria display · enable/disable · results with NEW/UPDATED badges · result detail (match · confidence · verification · evidence · score breakdown · changed fields) · user-state actions (SEEN · OPENED · SAVED · DISMISSED).

i18n: `packages/core/src/i18n/discovery-translations.ts` — **~85** keys × 4 locales; dictionary completeness test extended.

---

# Part 5 — E9.3 · Functional closure

## Run now

```text
DiscoveryProfilePanel → Run now
        ↓
triggerDiscoveryRunNow (client)
        ↓
POST .../run-now → 202
        ↓
executeProfileRunNow
        ├─ DiscoveryService.start()
        ├─ ensureProfileSchedule(sched:{profileId})
        ├─ runNow({ scheduleId })
        └─ processNext() until target run completes
        ↓
Hook refreshes results + run-summary
        ↓
UI: running / success / error surfaces
```

- Reuses existing scheduler/queue — **no** cron · **no** Redis · **no** scheduler redesign
- UUID run/job IDs in gateway execution runtime (avoids collision on reused dev state)
- Disabled profiles → validation error

## Profile criteria editing

- `updateDiscoveryProfile` (PATCH) + edit form reusing create fields (name · country · role for jobs)
- Backend validation only (`parseUpdateProfileBody`) — web does not duplicate domain rules

## i18n

- `discovery.score.*` — role · location · freshness · source · freeEntry · prizeValue · deadline · trust
- Run now · edit · profile action strings in all four locales

## E2E coverage

| Spec | Role |
|------|------|
| `e2e-discovery-canonical-journey.spec.ts` | **Canonical** — create → edit → run now → inspect → userState → reload (no seed) |
| `e2e-discovery-journey.spec.ts` | Deterministic dev seed fixture helper |

E2E helpers: `primeDiscoverySession` (skip Journey Guide welcome) · `enterAtlasHud` · `dismissArrivalWelcomeIfPresent`.

---

# Part 6 — E10 · Notifications & automated delivery

## E10.1 — Notification wiring

```text
Worker (SUCCESS / PARTIAL_SUCCESS + digest)
        ↓
createResolveDiscoveryNotificationTarget (profileStore)
        ↓
NotificationService.deliverDigest
        ↓
Email adapter (Resend / smoke)
        ↓
SENT → NOTIFIED (result IDs in digest only)
```

- Missing recipient or `emailEnabled=false` → no delivery; run still succeeds
- Idempotent via E4.4 notification store key

## E10.2 — Schedule projection

- `DiscoveryProfile.schedule` (declarative) → `DiscoveryScheduleRecord` (operational)
- Daily: `intervalSeconds: 86400` + `nextDailyRunAtUtc(hourUtc)`
- Manual / weekly: non-automatic `nextRunAt` placeholder
- Projected on profile create/update/enable/disable

## E10.3 — Host tick

```text
POST /api/ops/discovery/trigger-due-runs  (account-required)
        ↓
executeDiscoveryHostTick()
        ├─ triggerDueRuns()
        └─ processNext() loop (max 50)
```

External platform scheduler invokes the endpoint — **no in-process cron**.

## E10.4 — Notification preferences

- Domain: `notification.emailEnabled`, `notification.skipEmptyDigest`
- Partial patch via `PATCH /api/modules/discovery/profiles/:profileId`
- UI: `DiscoveryProfilePanel` notification section + i18n (en/de/ru/ua)
- `skipEmptyDigest=false` allows zero-new scan email; UNCHANGED-only reruns still suppressed

**ADR:** [adr-006-addendum-e10-notifications.md](../adr/adr-006-addendum-e10-notifications.md)

---

# Part 7 — Documentation map

| Area | Paths |
|------|-------|
| Domain index (E10 status) | [`docs/discovery/README.md`](../discovery/README.md) |
| Roadmap (E8–E10 complete) | [`docs/discovery/personal-discovery-engine-roadmap.md`](../discovery/personal-discovery-engine-roadmap.md) |
| ADR-006 addenda | [E8 scheduler](../adr/adr-006-addendum-e8-scheduler.md) · [E9 Discovery UI](../adr/adr-006-addendum-e9-discovery-ui.md) · [E10 notifications](../adr/adr-006-addendum-e10-notifications.md) |
| Decisions index | [`docs/decisions/README.md`](../decisions/README.md) |

---

# Part 8 — Architecture compliance

| Rule | Status |
|------|--------|
| CSR `Profile` separate from `DiscoveryProfile` | ✓ |
| MBDE untouched | ✓ |
| E6 admin API separate from E9 user API | ✓ |
| No scoring/novelty logic in `apps/web` | ✓ |
| `changedFields` from E7 persistence, not recomputed in web | ✓ |
| Run now pull-driven via existing `DiscoveryService` | ✓ |
| No cron / background daemon / Redis | ✓ |
| No automatic applications or giveaway entries | ✓ |
| Digest authoritative for notifications (engine unchanged) | ✓ |
| E10 notification preferences UI + API | ✓ |
| E10 host tick reuses E8 scheduler (no second scheduler) | ✓ |
| Session auth at gateway; Bearer at framework-free user API | ✓ |

---

## Known limitations / deferred (E11+)

- No in-process cron daemon (external platform scheduler hits ops HTTP endpoint)
- No account-linked recipient email (env/test override at composition root)
- No self-serve daily/weekly schedule UI (projection via API; UI defaults to manual)
- No rich/advanced criteria editor beyond name · country · role templates
- No `CandidateStore` / `DigestStore` / full `DiscoveryRun` archival
- No unsubscribe / List-Unsubscribe beyond `emailEnabled` preference
- No localized email templates (web i18n localized; email English)
- No module catalog / home-card beyond HUD nav link
- No PostgreSQL / Redis migration
- No push / Slack / WhatsApp notification channels
- Ukrainian (`ua`) discovery copy uses RU bundle with UA overrides for notification keys

---

## Test plan

### Unit / integration (required)

```bash
npm run build -w @arrival-atlas/discovery
npm test -w @arrival-atlas/discovery
```

Expected:

```text
Test Files  54 passed
Tests       552 passed
```

### API gateway + E10

```bash
npm test -w @arrival-atlas/api -- src/discovery.api.test.ts src/discovery-notification-wiring.test.ts src/discovery-host-tick.test.ts
```

Expected: discovery gateway + E10.1 wiring + E10.3 host tick green.

### Web Discovery

```bash
npm test -w @arrival-atlas/web -- src/__tests__/discovery/ src/lib/i18n/dictionary-completeness.test.ts src/lib/discovery/client.test.ts
```

Expected: **23/23** (includes E10.4 notification preferences UI + i18n).

### Playwright (canonical E9)

```bash
cd apps/web && npx playwright test tests/e2e/arr-023/e2e-discovery-canonical-journey.spec.ts
```

Expected: **1/1** — create · edit · notification prefs · run now · inspect · userState · reload.

### TypeScript

```bash
npm run typecheck -w @arrival-atlas/discovery   # or tsc --noEmit
npx tsc --noEmit -p apps/api
```

### Manual smoke (optional)

- [ ] Open `/modules/discovery` from Atlas HUD after Enter Atlas
- [ ] Create Jobs profile (DE + role) → Run now → result appears with evidence and score breakdown
- [ ] Edit criteria → save → panel reflects changes
- [ ] Toggle notification preferences → save → reload → preferences persist
- [ ] Mark result OPENED → reload → state persists
- [ ] Disable profile → Run now disabled / validation error
- [ ] Dev seed fixture (`POST /api/dev/discovery/seed-fixture`) still works for seed-based journey

---

## Related docs

- [docs/discovery/README.md](../discovery/README.md) — PDE domain index (E10 closure status)
- [ADR-006 E8](../adr/adr-006-addendum-e8-scheduler.md) — scheduler functional closure
- [ADR-006 E9](../adr/adr-006-addendum-e9-discovery-ui.md) — Discovery UI functional closure
- [ADR-006 E10](../adr/adr-006-addendum-e10-notifications.md) — notifications & automated delivery closure
- [arr-037-pr-description.md](./arr-037-pr-description.md) — E5–E7 foundation (prior)
- [arr-036-pr-description.md](./arr-036-pr-description.md) — E1–E4 foundation (prior)
