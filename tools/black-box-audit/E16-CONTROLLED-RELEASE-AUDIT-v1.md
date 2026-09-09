---
id: e16-controlled-release-audit-v1
title: Arrival Atlas — Controlled Release Gate Audit v1 (E16)
project: Arrival Atlas
system: Arrival Atlas
type: audit
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

# E16 — Controlled Release Gate Audit

## Verdict

**CONTROLLED RELEASE PASS**

**Can the current Arrival Atlas build be deployed to a controlled production environment safely?**

**Yes**, under the explicit operational conditions in `RELEASE-READINESS-CONTRACT-v1.md` and `docs/deployment.md`:

* Compose (or equivalent) with required secrets
* Persistent `/data` volume
* Single API replica
* `ARRIVAL_ATLAS_DEV_TOOLS=false`
* Same-origin `/api` (empty `NEXT_PUBLIC_API_URL` at web build)
* Successful clean production web build before serving (do not reuse interrupted `.next`)

P0 = 0 · P1 = 0 after E16 fixes. Interrupted-build `.next` corruption is procedural, not an application P1.

---

## 1. Release artifact baseline

| Artifact | Required for release | Current status | Risk |
| --- | --- | --- | --- |
| Web build (`next build` / image) | Yes | PASS after E16 type fix + clean `.next` | Corrupted `.next` mid-dev can 500 until clean rebuild |
| API build (`tsc` / image) | Yes | PASS | Low |
| Docker Compose + Caddy | Yes (supported path) | Config reviewed; **Docker CLI not installed in E16 host** | Ops must have Docker on deploy host |
| `deploy/env.example` | Yes | Present | Low |
| Env secrets | Yes | Compose `:?` required; E16 fail-fast in API | Mitigated |
| SQLite `/data/*` volume | Yes | Compose `atlas_api_data` | Ephemeral storage = blocker |
| Discovery host tick | Ops | Ops-token protected | Fail-closed without token |
| Auth | Yes | HMAC secret | Fail-fast in production |
| Health `GET /health` | Recommended | Live | Liveness only (not full readiness) |
| Dev tools | Must be off | Compose + Dockerfile force false | Verified closed in restart smoke |

---

## 2. Configuration contract

| Variable | Class | Behavior |
| --- | --- | --- |
| `ARRIVAL_ATLAS_AUTH_SECRET` | **required** (production) | Startup fails if missing or equals dev fallback |
| `ARRIVAL_ATLAS_OPS_TOKEN` | **required** (production) | Startup fails if missing; routes fail-closed |
| `ARRIVAL_ATLAS_DEV_TOOLS` | **required false** in prod | Compose/Dockerfile hard-code `false` |
| `NEXT_PUBLIC_API_URL` | **required empty** for Compose | Forced `""` in compose build args |
| `ATLAS_PUBLIC_ORIGIN` / CORS | required for browser | Set to public origin |
| Discovery provider keys | optional until live Jobs | Without keys, live SUCCESS limited |
| `DISCOVERY_USE_SMOKE_TRANSPORT` | development-only | Must not be `true` in prod |
| State dirs | required | Persistent volume paths |

Full contract: `tools/black-box-audit/RELEASE-READINESS-CONTRACT-v1.md`.

---

## 3. Build result

Commands:

```bash
npm run build -w @arrival-atlas/api
npm run build -w @arrival-atlas/web   # after trust-presentation type fix
# Clean rebuild when .next corrupted:
rm -rf apps/web/.next && npm run build -w @arrival-atlas/web
```

Outcomes:

* API build: **PASS**
* Web build: initially **FAIL** (TS predicate in `trust-presentation.ts`) → **fixed** → **PASS**
* Production fail-closed without secrets: **PASS** (process refuses to start)

---

## 4. Production-like startup

| Mode | Result |
| --- | --- |
| Isolated API `NODE_ENV=production` + secrets + dedicated state dir | PASS (`probe-e16-api-restart-persistence.mjs`) |
| `next start` after clean build | PASS (HTTP 200) |
| Docker Compose up | **Not executed** — Docker unavailable on E16 host (documented prerequisite) |

Semantic readiness: `/health` returns `{ status: "ok" }`. Persistence dirs created by entrypoint.

---

## 5. Persistence / restart

Isolated API restart smoke:

* Wrote city, rent, registration confirmed, Wohngeld true, taxClass 3
* Killed API, restarted same state dir
* Profile domains reconstructed identically
* `churchTax` remained absent (unknown)
* Dev reset route closed (404)
* Ops health unauthenticated → 403

---

## 6. Browser smoke

`probe-e16-controlled-release.mjs` against production `next start` + running API:

| Scenario | Result |
| --- | --- |
| A Landing | PASS |
| B Language | PASS |
| C Hydration | PASS |
| D–G Reg/Housing/Benefit/Tax | PASS |
| H Failed mutation | PASS (city unchanged) |
| I Reload | PASS |
| J Restart | PASS (API smoke) |
| K Emp→Discovery | PASS |
| L LE projection | PASS |
| M Ownership | PASS (404 denied) |
| N Dev tools | PASS closed on prod-mode API |
| Guidance URL null | PASS (not invented) |

---

## 7. Authentication / ownership

* Production refuses insecure auth default
* Ops fail-closed without token
* Foreign Discovery session → 404
* Client userId not trusted (E1–E15 / PD ownership suites remain SoT)
* Account A↔B isolation covered by existing PD-011 / account tests (not re-penetrated)

---

## 8. Discovery operational

* Compose: `DEV_TOOLS=false`, no smoke transport
* Ops tick requires token
* Live SUCCESS remains **environment-limited** without provider keys
* Schedule ≠ execution (E15/PD-010)

---

## 9. External guidance

`ANMELDUNG_OFFICIAL_GUIDANCE_URL = null` with status `missing_authoritative_url`. No localhost / placeholder presented as official.

---

## 10. Logging / failure visibility

* Invalid mutation returns structured error codes (`INVALID_MUTATION`, `REVISION_CONFLICT`)
* Production config failure prints clear startup error
* Forced browser reject did not invent success
* Secrets not logged by E16 probes

---

## 11. Findings

### Fixed during E16

| ID | Sev | Fix |
| --- | --- | --- |
| Production auth/ops missing | P1 | `assertProductionConfiguration()` at API boot |
| Web release build TS error | P1 | `trust-presentation.ts` type predicate |

### Already proven E1–E15

Journey truthfulness, reversals, hydration gate, LE projection, churchTax unknown, ownership model.

### Remaining P2/P3 / ops

* Docker not on E16 audit host (deploy host must provide Compose)
* Clean `.next` required if build interrupted while `next dev` running
* HUD / Atlas Home UA / boolean→unknown / Discovery live SUCCESS / LE shared keys / SSR flash
* `/health` is liveness, not deep readiness (config/persistence checked at startup + volume)

---

## 12. Fixes

See implementation note.

---

## 13. Known limitations

Carried from E15 + operational: Compose dependency; Discovery provider keys for live Jobs; Anmeldung URL unset by design.

---

## 14. Release prerequisites

1. Deploy host with Docker Compose  
2. Root `.env` from `deploy/env.example` with real secrets  
3. `docker compose build && docker compose up -d`  
4. Confirm `curl /health`, same-origin `/api`, volume persistence  
5. Keep single API replica  
6. Optional: provider keys for live Discovery  

---

## 15. Final verdict

**CONTROLLED RELEASE PASS**

P0 = 0 · P1 = 0. Clean production web artifact starts and passes E16 browser smoke. Persistence/restart, authentication/ownership, and fail-closed production config remain valid. Accepted product/ops P2/P3 limitations are documented in the release contract and do not block controlled deployment.

Safe for controlled personal/staging production under `RELEASE-READINESS-CONTRACT-v1.md` / `docs/deployment.md`. Not a claim of unlimited SaaS scale-out.

---

## Release Incident — Interrupted Build Artifact

### Initial failure

During E16 production-like web startup, `next start` on `:3000` returned HTTP 500:

```text
Cannot find module './vendor-chunks/motion-dom.js'
Require stack: .../.next/server/webpack-runtime.js
```

This followed a `next build` run while a prior `next dev` process / incomplete `.next` tree was in play (interrupted or overlapping artifact use).

### Diagnosis (evidence-based)

| Classification | Assessment |
| --- | --- |
| Source / application defect | **No** — clean rebuild of the same sources produced a working server; E16 smoke passed |
| Dependency defect | **No** — no package change was required to recover |
| Next.js build artifact corruption | **Yes** — runtime required a chunk path under `.next` that was absent; `BUILD_ID` / server tree incomplete or inconsistent |
| Deployment / procedure issue | **Yes** — `next start` was pointed at an unusable generated artifact; release must not reuse interrupted builds |

`.next` is generated output (`apps/web` `"build": "next build"`, `"start": "next start"`). Compose/Web Dockerfile builds in a clean image layer and does not rely on a host `.next` left by `next dev`.

### Recovery

```bash
# stop production web if running
rm -rf apps/web/.next
npm run build -w @arrival-atlas/web
cd apps/web && NODE_ENV=production npx next start -p 3000
node tools/black-box-audit/probes/probe-e16-controlled-release.mjs
```

### Clean rebuild result

* Build succeeded (`BUILD_ID` present)
* `next start` served `/` and profile edit with HTTP 200
* E16 browser smoke: **PASS** (P0=0 P1=0), including landing, UA language, hydration, Registration/Housing/Benefits/Tax, failed mutation, reload, Emp→Discovery, LE, ownership, devtools closed
* API restart persistence smoke already green (unchanged)

### Reproducibility

Observed once in this audit sequence after overlapping/interrupted build artifact use. Not treated as a standing application defect. Not reproduced after a deliberate clean rebuild procedure.

### Application code changed for this incident?

**No.** Mitigation is procedural (discard incomplete `.next`, rebuild, then start). Prior E16 P1 fixes (production auth/ops fail-closed; `trust-presentation` build type error) are unrelated to this artifact incident.

### Operational mitigation

Documented under **Build integrity** in `RELEASE-READINESS-CONTRACT-v1.md`. Minimal reliable local/non-Compose procedure:

1. Stop the production web process if it is serving from the artifact being replaced  
2. Ensure no `next build` / `next start` is mid-flight against the same `.next`  
3. `rm -rf apps/web/.next` when the prior build was interrupted, failed, or mixed with `next dev`  
4. `npm run build -w @arrival-atlas/web` (or Compose image build)  
5. Confirm build exit success and presence of `.next/BUILD_ID`  
6. `next start` (or Compose `web` service) only after step 5  
7. Run `probe-e16-controlled-release.mjs` (and keep API restart smoke as persistence gate)  
8. Only then treat the release candidate as ready  

Compose path already builds in a clean builder stage — preferred for production hosts.
