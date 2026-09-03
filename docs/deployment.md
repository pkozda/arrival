# Arrival Atlas — Personal Staging Deployment (Docker Compose + Caddy)

Personal single-tenant staging packaging. Not a SaaS platform.

## Topology

```text
Internet / localhost
        │
     Caddy :80/:443
        │
   ┌────┴────┐
   │         │
 Web:3000  API:3001
 Next.js   Fastify + in-process Discovery worker
             │
        volume: atlas_api_data (/data)
```

- Exactly **one** API container (SQLite + in-process worker).
- Exactly **one** Web container.
- Caddy terminates HTTP/HTTPS and routes `/api/*` + `/health` → API, everything else → Web.
- Browser uses **same-origin** relative `/api/...` URLs when `NEXT_PUBLIC_API_URL` is empty at Web build time.

## Prerequisites

- **Docker Engine + Docker Compose v2** installed and running on the host (`docker compose version`)
- Node is **not** required on the host for Compose runtime (only for optional local `npm` tests)
- For a VPS later: DNS A/AAAA records for your domain; open ports 80/443

## Quick start (local production-like)

```bash
# From repository root
cp deploy/env.example .env
# Edit .env — set at least:
#   ARRIVAL_ATLAS_AUTH_SECRET
#   ARRIVAL_ATLAS_OPS_TOKEN
# Optionally set real BRAVE/TAVILY + OPENAI + RESEND keys for real Discovery later.

docker compose build
docker compose up -d
docker compose ps
docker compose logs -f
```

Local defaults:

| Variable | Local value |
|----------|-------------|
| `ATLAS_SITE_ADDRESS` | `http://localhost` |
| `ATLAS_PUBLIC_ORIGIN` | `http://localhost` |
| Web API base | same-origin `/api` (Compose build arg empty) |

Open: [http://localhost/](http://localhost/)  
API health via Caddy: [http://localhost/health](http://localhost/health)

Stop:

```bash
docker compose down
```

Volumes (`atlas_api_data`, `caddy_data`, `caddy_config`) are kept. To wipe API state:

```bash
docker compose down
docker volume rm arrival-atlas_atlas_api_data   # name may vary; see `docker volume ls`
```

## Required environment variables

Compose reads **repository-root** `.env` and injects values into containers (the API does not auto-load dotenv).

### Always required for Compose

| Variable | Purpose |
|----------|---------|
| `ARRIVAL_ATLAS_AUTH_SECRET` | Session token HMAC (must not use API built-in default on a public host) |
| `ARRIVAL_ATLAS_OPS_TOKEN` | Protects `POST /api/ops/discovery/trigger-due-runs` and ops health |

### Required for real Jobs Discovery

| Variable | Purpose |
|----------|---------|
| `DISCOVERY_SEARCH_PROVIDER` | `brave` (default) or `tavily` |
| `BRAVE_SEARCH_API_KEY` or `TAVILY_API_KEY` | Matching provider |
| `OPENAI_API_KEY` | AI evaluate stage |

Compose hard-codes:

- `NODE_ENV=production`
- `ARRIVAL_ATLAS_DEV_TOOLS=false`
- Does **not** set `DISCOVERY_USE_SMOKE_TRANSPORT` (smoke only activates when that value is exactly `true`)

### Required for real email

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend send |
| `DISCOVERY_EMAIL_FROM` | From header |
| Personal email in UI **or** `DISCOVERY_NOTIFICATION_EMAIL` | Recipient (single-tenant fallback) |

### Site / URLs

| Variable | Purpose |
|----------|---------|
| `ATLAS_SITE_ADDRESS` | Caddy site address (`http://localhost` or `atlas.example.com`) |
| `ATLAS_PUBLIC_ORIGIN` | Browser origin for API CORS (`http://localhost` or `https://atlas.example.com`) |
| Web `NEXT_PUBLIC_API_URL` | **Forced empty** in `docker-compose.yml` (same-origin `/api`) |

### Persistence (set by Compose on API)

| Variable | Container path |
|----------|----------------|
| `ARRIVAL_ATLAS_STATE_DIR` | `/data/state` (`discovery.sqlite` + system state) |
| `ARRIVAL_ATLAS_ACCOUNTS_DIR` | `/data/accounts` |
| `ARRIVAL_ATLAS_SESSIONS_DIR` | `/data/sessions` |
| `ARRIVAL_ATLAS_ENTITLEMENTS_DIR` | `/data/entitlements` |

## Build / start commands

```bash
docker compose build          # build web + api images
docker compose up -d          # start caddy, web, api
docker compose ps
docker compose logs -f api
docker compose logs -f web
docker compose logs -f caddy
docker compose down           # stop containers; keep volumes
```

Images:

| Service | Dockerfile | Notes |
|---------|------------|-------|
| `api` | `apps/api/Dockerfile` | Node 20 bookworm; builds workspace packages + API; `better-sqlite3` native |
| `web` | `apps/web/Dockerfile` | Node 20 bookworm; bakes `NEXT_PUBLIC_API_URL` at build |
| `caddy` | `caddy:2.8-alpine` | Config: `deploy/Caddyfile` |

## Verify

### Health

```bash
curl -fsS http://localhost/health
# expect: {"status":"ok","service":"arrival-atlas-api",...}
```

### Web

Open `http://localhost/` — Next.js should load through Caddy (not `:3000` directly).

### API URL (no localhost:3001 in the browser)

With empty `NEXT_PUBLIC_API_URL`, browser network calls should go to `http://localhost/api/...`.

### Production smoke safety

```bash
docker compose exec api printenv ARRIVAL_ATLAS_DEV_TOOLS NODE_ENV DISCOVERY_USE_SMOKE_TRANSPORT
# expect: false / production / (empty or unset)
```

### Persistence

```bash
# Create a marker file on the API volume, restart API, confirm it survives
docker compose exec api sh -c 'echo ok > /data/state/persist-check.txt'
docker compose restart api
docker compose exec api cat /data/state/persist-check.txt
```

## Caddy routing

| Path | Upstream |
|------|----------|
| `/health` | `api:3001` |
| `/api/*` | `api:3001` |
| everything else | `web:3000` |

Ops endpoints remain behind H3 ops-token auth. Do not put `ARRIVAL_ATLAS_OPS_TOKEN` in browser/Web env.

### Future VPS domain

```bash
# .env
ATLAS_SITE_ADDRESS=atlas.example.com
ATLAS_PUBLIC_ORIGIN=https://atlas.example.com
```

Point DNS at the VPS, then `docker compose up -d`. Caddy obtains certificates automatically for the hostname form (not `http://...`).

Rebuild Web after changing the Compose build args that affect `NEXT_PUBLIC_*` (this Compose file forces an empty API base for same-origin routing):

```bash
docker compose build web --no-cache
docker compose up -d web
```

## Manual Discovery run (operator)

1. Open the site through Caddy.
2. Complete session bootstrap.
3. Open `/modules/discovery`.
4. Set personal notification email (if using Resend).
5. Create an enabled Jobs profile.
6. Click **Run now**.
7. Confirm results appear in the UI.

Requires real provider keys in the API container env. Do not enable smoke transport.

## External scheduler (later)

Hourly (or similar) cron against the **public** origin:

```bash
curl -fsS -X POST "https://atlas.example.com/api/ops/discovery/trigger-due-runs" \
  -H "Authorization: Bearer ${ARRIVAL_ATLAS_OPS_TOKEN}"
```

Local:

```bash
curl -fsS -X POST "http://localhost/api/ops/discovery/trigger-due-runs" \
  -H "Authorization: Bearer ${ARRIVAL_ATLAS_OPS_TOKEN}"
```

Use a generous timeout (several minutes). Calling more often than schedules are due is safe (skips).

Ops health (token required):

```bash
curl -fsS "http://localhost/api/ops/discovery/health" \
  -H "Authorization: Bearer ${ARRIVAL_ATLAS_OPS_TOKEN}"
```

## Backup

```bash
# Identify volume name
docker volume ls | grep atlas_api_data

# Example backup of SQLite + state dirs
docker compose stop api
docker run --rm -v arrival-atlas_atlas_api_data:/data -v "$PWD/backup:/backup" alpine \
  tar czf /backup/atlas-data-$(date +%Y%m%d).tar.gz -C /data .
docker compose start api
```

Volume project prefix may differ; adjust the `-v` name from `docker volume ls`.

## Update / redeploy

```bash
git pull
docker compose build
docker compose up -d
docker compose ps
```

API state survives because it lives on `atlas_api_data`.

## Single-API-instance requirement

Do **not** set `deploy.replicas` on `api` and do not run multiple API containers against the same volume. Discovery uses SQLite and an in-process worker drain.

## Never commit

- `.env` with real secrets
- API keys, ops tokens, auth secrets
- Volume dumps / SQLite backups containing personal data
- Provider credentials in Docker images (Compose injects at runtime)

## Related files

| Path | Role |
|------|------|
| `docker-compose.yml` | caddy + web + api |
| `deploy/Caddyfile` | reverse proxy |
| `deploy/env.example` | env template |
| `deploy/api-entrypoint.sh` | ensure `/data/*` dirs |
| `apps/api/Dockerfile` | API image |
| `apps/web/Dockerfile` | Web image |
| `.dockerignore` | build context hygiene |

## Security note (public VPS)

Anyone who can open the Web UI can create a session and potentially trigger Discovery spend. For internet exposure, put an edge gate (Basic Auth, Cloudflare Access, VPN, or IP allowlist) in front of Caddy. That is outside this Compose package.
