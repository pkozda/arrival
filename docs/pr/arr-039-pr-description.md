# arr-039 — Personal Discovery Engine · production readiness · personal staging

**Branch:** `arr-039`  
**Tracks:** PDE post-E10 production readiness — Jobs quality (E12) · personal notification email (E13.3) · ops health & diagnostics (E11) · H1–H3 hardening · Docker Compose + Caddy personal staging  
**Base:** `develop` (post arr-038 / merge #36)

Extends Arrival Atlas from **canonical E10 functional closure** to a **deployable personal single-tenant staging posture**: stronger Jobs discovery correctness, durable per-user notification email, operator-safe host-global Discovery ops, scheduler at-least-once hardening, and reproducible Docker/Compose packaging with Caddy.

This PR **does** make Discovery safer to run unattended for one personal Atlas host and package it for a small VPS. It does **not** introduce multi-tenant SaaS IAM, PostgreSQL, Redis, Kubernetes, a separate worker service, or an in-app cron daemon.

1. **E11.1 / E11.2 — Ops surfaces** — `GET /api/ops/discovery/health` · `GET /api/ops/discovery/runs/:runId/diagnostics` (+ funnel diagnostics in package).
2. **E12 — Jobs discovery quality** — official-employer resolution bridge · vacancy gates · opt-in Tavily search · Jobs strategy identity/location hardening.
3. **E13.3 — Personal notification email** — SQLite user email store · resolver precedence · `GET`/`PATCH /api/modules/discovery/notification-email` · Discovery UI field (never exposes env fallback).
4. **H1 — Scheduler lock & at-least-once** — preserve `runningRunId` on re-register · atomic claim + `nextRunAt` advance.
5. **H2 — Jobs correctness** — employer identity (`company` over `organization`) · whole-token location scoring · listing checks before JobPosting JSON-LD short-circuit.
6. **H3 — Ops security & delivery boundary** — `ops-token-required` for host-global tick/health · `ARRIVAL_ATLAS_OPS_TOKEN` · `ARRIVAL_ATLAS_MULTI_USER` gates shared `DISCOVERY_NOTIFICATION_EMAIL`.
7. **Deployment packaging** — `apps/api` + `apps/web` Dockerfiles · `docker-compose.yml` · Caddy same-origin `/api` · persistent `/data` volume · `docs/deployment.md`.
8. **Discovery UI polish** — schedule field · excluded roles · notification email · i18n.

**Product verdict:** A personal Atlas operator can configure a Jobs profile (including daily schedule intent and personal notification email), run real Discovery with Brave/Tavily + OpenAI + Resend, inspect ops health with an ops token, trigger host ticks from external cron, and deploy the same Compose topology to a small VPS with persistent SQLite — without ordinary accounts triggering host-global Discovery ops or silently sharing a fallback inbox in multi-user mode.

**Diff vs `develop` (working tree):** ~110+ paths across `packages/discovery/` · `packages/core/` · `apps/api/` · `apps/web/` · `deploy/` · `docs/` · Docker/Compose root files · E10 ADR addendum present · CSR/MBDE domain logic untouched.

---

# Part 1 — Architecture (source of truth)

## Engine placement (unchanged)

| Capability | Question |
|------------|----------|
| **CSR** | What is happening for this user right now? |
| **MBDE** | What support / entitlements may apply? |
| **PDE** | What external opportunities exist and deserve attention? |

## Personal staging topology (new)

```text
Internet
   │
 Caddy :80/:443
   ├── /*        → Web :3000 (Next.js)
   └── /api/*, /health → API :3001 (Fastify)
                            │
                     volume /data
                     ├── state/discovery.sqlite
                     ├── accounts · sessions · entitlements
                     │
                     ├── Brave | Tavily (opt-in)
                     ├── OpenAI
                     └── Resend

External cron
   └── POST /api/ops/discovery/trigger-due-runs
         Authorization: Bearer <ARRIVAL_ATLAS_OPS_TOKEN>
```

Exactly **one** API instance (SQLite + in-process worker drain). No separate Discovery worker process.

## Authorization tiers (H3)

| Surface | Tier | Audience |
|---------|------|----------|
| Discovery user API (`/api/modules/discovery/*`) | `credential-required` | Signed-in user (`accountId ?? sessionId`) |
| Run diagnostics | `account-required` + ownership | Claimed account; foreign run → 404 |
| Host tick + Discovery health | `ops-token-required` | Ops/cron only (`ARRIVAL_ATLAS_OPS_TOKEN`) |

## Packages touched

| Package / app | Role |
|---------------|------|
| `@arrival-atlas/discovery` | Jobs strategy · official employer · Tavily · schedule projection · ops diagnostics · user notification email store · H1 scheduler |
| `@arrival-atlas/api` | Ops routes · ops-token · notification email resolver · host tick · deployment mode · Docker |
| `@arrival-atlas/web` | Notification email / schedule / excluded-roles UI · client · Docker |
| `@arrival-atlas/core` | Discovery i18n keys |
| `deploy/` · Compose · Caddy | Personal staging packaging |

---

# Part 2 — E11 · Ops health & diagnostics

## E11.1 — Atlas ops health

- `GET /api/ops/discovery/health`
- Returns E5.6 `DiscoveryRuntimeHealth` via execution runtime (no ad-hoc SQLite in the route)
- **H3:** `ops-token-required` — ordinary accounts rejected (`OPS_FORBIDDEN`)

## E11.2 — Run diagnostics

- `GET /api/ops/discovery/runs/:runId/diagnostics`
- Ownership via profile → Discovery `userId`; foreign/unknown → **404**
- Package helpers: `run-diagnostics` · `run-funnel-diagnostics` (queries/stages/promotions when available)
- **Not exposed:** emails, tokens, API keys, raw content, filesystem paths, stacks

**Tests:** `apps/api/src/discovery-ops-health.test.ts` · `discovery-ops-run-diagnostics.test.ts` · `packages/discovery/src/ops/*`

---

# Part 3 — E12 · Jobs discovery quality

## Search provider selection

- Default remains **Brave**
- **Tavily** is explicit opt-in: `DISCOVERY_SEARCH_PROVIDER=tavily` + `TAVILY_API_KEY`
- Invalid provider values fail closed (no silent fallback)
- Adapter: `tavily-search-adapter.ts` · resolver: `resolve-discovery-search-provider.ts`

## Official employer / vacancy path

- `official-employer-resolution.ts` — bridge for OFFICIAL employer identity and vacancy checks
- E12.2 / E12.10 / E12.14 verification fixtures + tests
- Jobs strategy (`job-discovery-v1`) uses resolution + scoring helpers

## H2 correctness (Jobs)

| Fix | Behavior |
|-----|----------|
| Employer identity | Prefer `company`, else `organization` |
| Location score | Whole-token country match — no brittle `includes('de')` |
| E12.14 gate | Listing / vacancy checks before JobPosting JSON-LD short-circuit |

**Tests:** `job-discovery-v1.test.ts` · official-employer + E12.* verify suites

---

# Part 4 — E13.3 · Personal notification email

## Persistence

- SQLite table `discovery_user_notification_settings` in `discovery.sqlite`
- Keyed by Discovery `userId` (`accountId ?? sessionId`) — **not** a profile field
- Store: get / set / clear (trim only; no lowercasing)

## Resolver precedence (composition root)

```text
test override
  → user-persisted email
  → DISCOVERY_NOTIFICATION_EMAIL   (only if not multi-user)
  → null
```

## API

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/modules/discovery/notification-email` | Returns **only** persisted personal email (never env/test) |
| `PATCH` | `/api/modules/discovery/notification-email` | `{ email: string \| null }` |

## UI

- `DiscoveryNotificationField` — Save/Clear isolated from profile Save
- Opaque status when delivery is configured via fallback but personal email absent (does not reveal fallback address)
- i18n in `packages/core/src/i18n/discovery-translations.ts`

## H3 delivery boundary

- `ARRIVAL_ATLAS_MULTI_USER=true|1|yes` disables shared env fallback
- Personal/single-tenant Atlas may still use `DISCOVERY_NOTIFICATION_EMAIL`

**Tests:** resolver · notification-email API · client · store

---

# Part 5 — H1 · Scheduler lock & at-least-once

- `registerSchedule` **preserves** `existing.runningRunId`
- Scheduled `tryClaim` advances `nextRunAt` **atomically** with claim (SQLite transaction / equivalent in-memory)
- Prevents duplicate due-slot re-enqueue after crash between claim and advance

**Tests:** `scheduler.test.ts` (`H1 scheduler lock & at-least-once hardening`)

---

# Part 6 — H3 · Ops security & notification boundary

## Ops token

- Env: `ARRIVAL_ATLAS_OPS_TOKEN`
- Present via: `Authorization: Bearer <token>` **or** `x-arrival-ops-token`
- Timing-safe compare; **fail-closed** when unset
- Tier: `ops-token-required` on:
  - `POST /api/ops/discovery/trigger-due-runs`
  - `GET /api/ops/discovery/health`
- Host tick behavior unchanged after auth (still host-global — no `userId` workaround)

## Deployment mode

- `ARRIVAL_ATLAS_MULTI_USER` gates shared notification fallback
- Documented in `.env.example` · `deploy/env.example` · roadmap

**Tests:** `ops-token.test.ts` · host-tick / health auth cases · route-security map · resolver multi-user cases

---

# Part 7 — Deployment packaging (Docker Compose + Caddy)

## Assets

| Path | Role |
|------|------|
| `apps/api/Dockerfile` | Node 20 bookworm multi-stage; builds workspace + API; `better-sqlite3` |
| `apps/web/Dockerfile` | Node 20; forces empty `NEXT_PUBLIC_API_URL` for same-origin `/api` |
| `docker-compose.yml` | `caddy` · `web` · `api` (single API) |
| `deploy/Caddyfile` | `/health` + `/api/*` → API; else Web |
| `deploy/api-entrypoint.sh` | Ensures `/data/*` dirs |
| `deploy/env.example` | Staging env template |
| `docs/deployment.md` | Runbook |
| `.dockerignore` | Keeps secrets/state out of build context |

## Persistence (Compose)

```text
ARRIVAL_ATLAS_STATE_DIR=/data/state
ARRIVAL_ATLAS_ACCOUNTS_DIR=/data/accounts
ARRIVAL_ATLAS_SESSIONS_DIR=/data/sessions
ARRIVAL_ATLAS_ENTITLEMENTS_DIR=/data/entitlements
```

Volume: `atlas_api_data`. Compose hard-codes `NODE_ENV=production` and `ARRIVAL_ATLAS_DEV_TOOLS=false` (smoke transport not activated).

## Gate status

Final read-only deployment gate: **VPS READY = YES** (no packaging blockers; verify `docker compose build/up` on a Docker host; add edge access control before public exposure).

---

# Part 8 — Discovery UI additions

| Field | Purpose |
|-------|---------|
| `DiscoveryScheduleField` | Daily/manual schedule intent (projects via E10.2) |
| `DiscoveryExcludedRolesField` | Criteria excluded roles |
| `DiscoveryNotificationField` | Personal notification email |

Celestial: `spatial-parallax-scope` helper + tests (scoped parallax behavior; unrelated to Discovery domain logic).

---

# Part 9 — Documentation map

| Area | Paths |
|------|-------|
| Deployment runbook | [`docs/deployment.md`](../deployment.md) |
| Domain index | [`docs/discovery/README.md`](../discovery/README.md) |
| Roadmap (E11.1 / H3 / E11.2) | [`docs/discovery/personal-discovery-engine-roadmap.md`](../discovery/personal-discovery-engine-roadmap.md) |
| ADR-006 E10 | [`docs/adr/adr-006-addendum-e10-notifications.md`](../adr/adr-006-addendum-e10-notifications.md) |
| Decisions index | [`docs/decisions/README.md`](../decisions/README.md) |

---

# Part 10 — Architecture compliance

| Rule | Status |
|------|--------|
| CSR `Profile` separate from `DiscoveryProfile` | ✓ |
| MBDE untouched | ✓ |
| Ownership remains `accountId ?? sessionId` (no session→account migration) | ✓ |
| Host tick remains host-global; only caller auth tightened | ✓ |
| No second scheduler / DigestStore / in-app cron | ✓ |
| No Postgres / Redis / separate worker / K8s | ✓ |
| Env fallback email never returned to clients | ✓ |
| Smoke transport disabled under Compose production env | ✓ |
| Ordinary accounts cannot call host-global ops | ✓ |

---

## Known limitations / deferred

- No Docker build verification on hosts without Docker (run `docker compose build` before VPS trust)
- Public staging should add **edge access control** (anonymous sessions can still spend provider quota)
- Account-linked email (identity email) still deferred — personal Discovery email is explicit
- Multi-API-replica / shared SQLite clustering not supported (by design)
- Full E11 abuse dashboards / rate-limit productization beyond existing adapter limits
- Ukrainian discovery copy still largely RU-backed with UA overrides where added
- Pre-existing brittle test: diagnostics “no `@` in payload” conflicts with `job-discovery@1` funnel text (unrelated to this packaging)

---

## Test plan

### Discovery package

```bash
npm run build -w @arrival-atlas/discovery
npm test -w @arrival-atlas/discovery
npm run typecheck -w @arrival-atlas/discovery
```

### API (ops · email · security · gateway)

```bash
npm test -w @arrival-atlas/api -- \
  src/routing/enforce-route-security.test.ts \
  src/auth/ops-token.test.ts \
  src/discovery/resolve-discovery-notification-email.test.ts \
  src/discovery-host-tick.test.ts \
  src/discovery-ops-health.test.ts \
  src/discovery-notification-wiring.test.ts \
  src/discovery-notification-email.api.test.ts \
  src/discovery.api.test.ts

npm run typecheck -w @arrival-atlas/api
```

### Web Discovery

```bash
npm test -w @arrival-atlas/web -- \
  src/__tests__/discovery/ \
  src/lib/discovery/ \
  src/__tests__/celestial/
```

### Docker (on a Docker host)

```bash
cp deploy/env.example .env   # set AUTH_SECRET + OPS_TOKEN (+ provider keys as needed)
docker compose build
docker compose up -d
curl -fsS http://localhost/health
docker compose exec api printenv NODE_ENV ARRIVAL_ATLAS_DEV_TOOLS
docker compose down
```

### Manual smoke (optional)

- [ ] `/modules/discovery` — set personal notification email · create Jobs profile · schedule daily · Run now
- [ ] Confirm browser calls `/api/...` through Caddy (not `localhost:3001`) when using Compose
- [ ] Ops: `POST /api/ops/discovery/trigger-due-runs` with Bearer ops token succeeds; ordinary account gets 403
- [ ] Ops health with ops token; ordinary account rejected
- [ ] Restart API container · Discovery profiles / email settings survive on volume
- [ ] With `ARRIVAL_ATLAS_MULTI_USER=true` and no personal email · no shared env delivery

---

## Related docs

- [docs/deployment.md](../deployment.md) — Compose + Caddy personal staging
- [docs/discovery/README.md](../discovery/README.md) — PDE domain index
- [ADR-006 E10](../adr/adr-006-addendum-e10-notifications.md) — notifications & automated delivery
- [arr-038-pr-description.md](./arr-038-pr-description.md) — E8–E10 foundation (prior)
- [arr-037-pr-description.md](./arr-037-pr-description.md) — E5–E7 foundation (prior)
- [arr-036-pr-description.md](./arr-036-pr-description.md) — E1–E4 foundation (prior)
