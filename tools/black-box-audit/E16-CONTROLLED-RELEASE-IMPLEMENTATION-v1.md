---
id: e16-controlled-release-implementation-v1
title: Arrival Atlas — E16 Controlled Release Implementation Note
project: Arrival Atlas
system: Arrival Atlas
type: implementation-note
domain: operations
status: active
maturity: evolving
owner: product-engineering
tags:
  - e16
  - controlled-release
created: 2026-09-09
updated: 2026-09-09
---

# E16 Implementation Note

## Fixes (P1)

### 1. Production configuration fail-closed

Files:

* `apps/api/src/config/assert-production-configuration.ts`
* `apps/api/src/config/assert-production-configuration.test.ts`
* `apps/api/src/index.ts` — calls `assertProductionConfiguration()` before listen

When `NODE_ENV=production`:

* Missing `ARRIVAL_ATLAS_AUTH_SECRET` → refuse start
* Secret equal to development fallback → refuse start
* Missing `ARRIVAL_ATLAS_OPS_TOKEN` → refuse start

Compose already required these via `:?`; this closes bare `node dist` deploys.

### 2. Web production build type error

File: `apps/web/src/lib/discovery/trust-presentation.ts`

Fixed TypeScript type predicate so `next build` succeeds.

## Probes / docs added

| File | Purpose |
| --- | --- |
| `tools/black-box-audit/probes/probe-e16-api-restart-persistence.mjs` | Isolated API restart + persistence + devtools/ops closed |
| `tools/black-box-audit/probes/probe-e16-controlled-release.mjs` | Browser RC smoke A–N |
| `tools/black-box-audit/RELEASE-READINESS-CONTRACT-v1.md` | Release contract |
| `tools/black-box-audit/E16-CONTROLLED-RELEASE-AUDIT-v1.md` | Audit |
| this file | Implementation note |

## Verification commands

```bash
# Unit
cd apps/api && npx vitest run src/config/assert-production-configuration.test.ts

# Builds
npm run build -w @arrival-atlas/api
rm -rf apps/web/.next && npm run build -w @arrival-atlas/web

# Fail-closed spot-check
NODE_ENV=production node apps/api/dist/index.js   # must exit with config error

# Persistence restart
node tools/black-box-audit/probes/probe-e16-api-restart-persistence.mjs

# Browser smoke (API + next start)
node tools/black-box-audit/probes/probe-e16-controlled-release.mjs
```

## Environment note

Docker Compose was **not** executed on the E16 audit host (Docker CLI absent). Contract and Dockerfiles were reviewed against `docs/deployment.md`. Deploy hosts must run Compose themselves.

## Verdict

**CONTROLLED RELEASE PASS**

Docker Compose was **not** executed on the E16 audit host (Docker CLI absent). Contract and Dockerfiles were reviewed against `docs/deployment.md`. Deploy hosts must run Compose themselves.

Interrupted / corrupted `.next` during E16 was a **build-artifact / procedure** issue, not an application defect. No additional code was added for that incident; recovery is clean rebuild then `next start` (see audit “Release Incident” and contract “Build integrity”).
