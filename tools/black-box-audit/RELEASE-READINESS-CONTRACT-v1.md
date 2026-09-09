---
id: release-readiness-contract-v1
title: Arrival Atlas — Release Readiness Contract v1
project: Arrival Atlas
system: Arrival Atlas
type: contract
domain: operations
status: active
maturity: evolving
owner: product-engineering
tags:
  - e16
  - release
created: 2026-09-09
updated: 2026-09-09
---

# Release Readiness Contract v1

Personal single-tenant controlled release. Not a SaaS multi-region platform.

## Required

| Item | Contract |
| --- | --- |
| `ARRIVAL_ATLAS_AUTH_SECRET` | Mandatory when `NODE_ENV=production`. Must not equal the development fallback. API **fails startup** if missing/unsafe. |
| `ARRIVAL_ATLAS_OPS_TOKEN` | Mandatory when `NODE_ENV=production`. Ops routes fail-closed without it. |
| `ARRIVAL_ATLAS_DEV_TOOLS` | Must be `false` in production (Compose hard-codes). |
| `NEXT_PUBLIC_API_URL` | Empty for Compose/Caddy same-origin `/api`. Never bake `http://localhost:3001` into a public web image. |
| Persistent volume | API state under `ARRIVAL_ATLAS_STATE_DIR` (+ accounts/sessions/entitlements) on durable storage. |
| Single API replica | Exactly one API process against a given SQLite state (no horizontal scale). |
| Authentication | Session/account tokens HMAC’d with auth secret; no ownership from client-supplied userId. |
| Public origin | `ATLAS_PUBLIC_ORIGIN` / CORS aligned with browser origin through Caddy. |

## Recommended

* Restart policy (`unless-stopped` / equivalent)
* Log retention for API stdout/stderr
* Volume backups of `/data` (SQLite)
* Ops tick schedule for Discovery host trigger (authenticated)
* Real Discovery provider keys only when running live Jobs discovery
* Health checks against `GET /health` (liveness)

## Forbidden

* `ARRIVAL_ATLAS_DEV_TOOLS=true` on a public host
* `DISCOVERY_USE_SMOKE_TRANSPORT=true` in production
* Ephemeral SQLite (state only in container writable layer without a volume)
* Multiple API replicas sharing one SQLite database
* Shipping test fixtures / probe routes as production features
* Authentication bypass / trusting client `userId` as owner
* Inventing official Anmeldung URLs

## Known limitations (accepted for controlled release)

* Employment / Healthcare not on HUD
* Atlas Home may show EN under UA (P2)
* boolean → unknown unsupported (explicit false)
* Discovery live SUCCESS depth depends on provider keys/environment
* Life Events shared-key abstractions (P2)
* SSR language flash before client sync (P2)
* `ANMELDUNG_OFFICIAL_GUIDANCE_URL` is intentionally `null` until an authoritative URL exists
* Docker Compose packaging is the supported production-like path; host must provide Docker

## Topology

See `docs/deployment.md`: Caddy → Web + API; volume `atlas_api_data` → `/data`.

## Build integrity

`.next` is a **generated release artifact**, not source.

* An interrupted, failed, or `next dev`–mixed `.next` directory must **not** be reused for `next start`.
* After any incomplete/interrupted web build, delete `apps/web/.next` and run a clean production build before starting.
* `next start` must run only after a successful production build (exit 0, `.next/BUILD_ID` present).
* Production release validation (E16 browser smoke) must run against that freshly built artifact.
* Preferred production path: Docker Compose web image build (clean builder stage). Host-local `next start` is for controlled smoke only when Compose is unavailable.

Minimal local procedure when not using Compose:

1. Stop the production web process if required  
2. Ensure no interrupted build is still writing `.next`  
3. `rm -rf apps/web/.next` when the prior artifact is incomplete/suspect  
4. `npm run build -w @arrival-atlas/web`  
5. Verify build success  
6. `next start`  
7. Run `tools/black-box-audit/probes/probe-e16-controlled-release.mjs`  
8. Only then consider the release ready  
