# arr-043 — Repository cleanup · production hardening hygiene

**Branch:** `arr-043`  
**Tracks:** Repo hygiene · documentation quarantine · life-event-demo isolation · dead current-situation scaffold removal  
**Base:** `develop` (post arr-042 / merge #41)

Production-hardening cleanup after the arr-042 controlled-release drop: shrink the Git surface, keep only durable docs/contracts in-repo, stop pulling demo personas into production bundles, and delete an unused Current Situation Resolver scaffold that never had a production consumer.

This PR **does** untrack generated/accidental artifacts, quarantine historical audits/PR mirrors/black-box notes to a local archive, lazy-load `life-event-demo` behind DEV_TOOLS / development gates, and remove `apps/web/src/lib/current-situation/**` plus its obsolete env flag. It does **not** change grocery-optimization, financial-reality, AppProvider ownership, Docker/build architecture, Discovery / Life Events / Economic Reality product behavior, or rewrite normative product contracts.

1. **Step 1 — Repository hygiene** — untrack black-box probe evidence, Playwright residue, `tsbuildinfo`, Finder `* 2` duplicates; tighten `.gitignore` / `.dockerignore`.
2. **Step 2 — Documentation quarantine** — move completed audits, PR description mirrors, refactor/archive narratives, and black-box `*-AUDIT-*` / `*-IMPLEMENTATION-*` notes to `../arrival-atlas-local-archive/`; leave ADRs, domain specs, Product Guide, and normative BB contracts in Git with stub READMEs.
3. **Step 3 — life-event-demo isolation** — API dynamic-imports the package only after the DEV_TOOLS gate; web Header loads persona UI only in development via a separate dynamic chunk (package remains in the workspace for typed demo tooling).
4. **Step 4 — Experimental audit (read-only)** — confirmed `current-situation` dead; grocery-optimization and financial-reality **active / do not touch**.
5. **Step 5 — Dead scaffold removal** — delete unused CSR implementation + self-tests; remove `NEXT_PUBLIC_CURRENT_SITUATION_ENABLED`; repair docs that pointed at the deleted path.

**Product verdict:** Same production product surface as arr-042, with a smaller Git/Docker context, clearer docs boundary (durable vs historical), demo personas kept out of the production web/API hot path, and one unused experimental lib removed. No intentional newcomer-facing behavior change.

**Diff vs `develop` (working tree):** ~536 paths · mostly deletions (BB artifacts + quarantined docs) · focused app edits in Header / demo-tools / deleted `current-situation` · ignore-file tighten · CSR vision/certainty/PDE path repairs · **grocery-optimization and financial-reality untouched**.

---

# Part 1 — Problem statement

## Why this work exists

arr-042 shipped a large product + audit drop. The working tree then carried weight that does not belong in the durable production repo:

| Theme | Pre-arr-043 gap |
| ----- | ---------------- |
| Git / Docker context | ~100MB+ black-box PNGs/JSON, Playwright `test-results`, `tsbuildinfo`, accidental Finder duplicates |
| Docs | Historical audits, PR mirrors, showcase/completion notes mixed with ADRs and live contracts |
| Demo tooling | `@arrival-atlas/life-event-demo` reachable on API startup / Header import graph even when unused in production |
| Experimental scaffold | `apps/web/src/lib/current-situation/` — self-tested only; zero runtime consumers; obsolete feature flag |

## Constraints honored

- Do **not** touch `grocery-optimization` or `financial-reality` (active; product decision still required for grocery)  
- Do **not** remove `life-event-demo` from the workspace (AppProvider / typed demo still need the package)  
- Do **not** rewrite Product Guide, E2E Product Spec, Product Decisions, or Release Readiness Contract  
- Do **not** treat LE `currentSituation` copy / Header context / conceptual CSR vision as the deleted scaffold  
- Prefer quarantine + stub pointers over deleting historical narrative forever  
- No Docker/build architecture redesign; no history rewriting  

---

# Part 2 — What changed (by step)

## Step 1 — Repository hygiene (`fcef944`)

| Action | Detail |
| ------ | ------ |
| Untrack | `tools/black-box-audit/artifacts/**` (evidence preserved under `../arrival-atlas-local-archive/black-box-audit/artifacts/`) |
| Remove | Playwright `test-results/`, `apps/web/tsconfig.tsbuildinfo`, `README.pages`, Finder `* 2` duplicates, empty scaffolds |
| Ignore | Artifacts, tsbuildinfo, `*-test` state dirs, etc. via `.gitignore` / `.dockerignore` |

No application source behavior change.

## Step 2 — Documentation quarantine (`4fa6c9e`)

Moved outside Git (local archive for Confluence migration):

```text
../arrival-atlas-local-archive/documentation/
  docs/audits/ … docs/pr/ … docs/refactors/ … docs/archive/ …
  tools/black-box-audit/*-AUDIT-* / *-IMPLEMENTATION-* (historical notes)
```

**Kept in-repo (normative / durable):**

| Kind | Examples |
| ---- | -------- |
| Product contracts | Product Guide; BB `E2E-PRODUCT-SPECIFICATION`, `PRODUCT-DECISIONS`, `RELEASE-READINESS-CONTRACT` |
| Designs still useful | BB `*-DESIGN-v1.md`, implementation plan |
| ADRs / domain specs | `docs/architecture`, domain trees, vision primitives |

`docs/audits|pr|archive|refactors/` retain stub READMEs pointing at the archive. `docs/README.md` retargeted accordingly.

## Step 3 — life-event-demo isolation (`b44ed7e`)

| Surface | Before | After |
| ------- | ------ | ----- |
| API `demo-tools` | Eager import of package content | Dynamic import **after** `DEV_TOOLS` gate |
| Web Header | Static import of demo personas | `HeaderLifeEventDemos` + dynamic import; UI only when `NODE_ENV === 'development'` |
| Package / Docker | In workspace build graph | **Still** built/copied (typed tooling); runtime gated |

Production Compose already sets `ARRIVAL_ATLAS_DEV_TOOLS=false`. Demo code is expected to DCE out of the production Next bundle when the Header path is unused.

## Step 4 — Experimental audit (no commit)

| Area | Verdict | Action on arr-043 |
| ---- | ------- | ----------------- |
| `apps/web/src/lib/current-situation/` | DEAD / EXPERIMENTAL — zero prod consumers | **Removed** (Step 5) |
| `grocery-optimization` | ACTIVE (shallow catalog) | **Untouched** — needs product decision |
| `financial-reality` | ACTIVE (execute API, profile, LE, mirrors) | **Untouched** — keep |

## Step 5 — Remove unused CSR scaffold (`296f904`)

Deleted `apps/web/src/lib/current-situation/**` (types, registry, resolver, flag, self-tests).

Removed from `.env.example`:

```text
NEXT_PUBLIC_CURRENT_SITUATION_ENABLED=false
```

Minimal doc repairs only where paths/flags would be broken:

- `docs/vision/primitives/current-situation-resolver.md` — conceptual design kept; notes scaffold/flag removed  
- `docs/vision/primitives/certainty-layer.md` — drop obsolete flag row + deleted path listing  
- `docs/discovery/personal-discovery-engine-architecture.md` — stop claiming implementation under deleted path  

---

# Part 3 — Explicitly out of scope

- Product behavior changes for Registration / ER / Discovery / LE journeys  
- Removing or redesigning `grocery-optimization` or `financial-reality`  
- Full removal of `@arrival-atlas/life-event-demo` from workspace / Docker  
- AppProvider refactor to drop demo type coupling  
- Regenerating `docs/meta/docs-chunks.jsonl` (stale generated index may still mention old paths)  
- Broad documentation rewrite / Confluence migration itself  
- Docker multi-stage redesign, SQLite/replica changes, secrets handling  

---

# Part 4 — Validation

### Hygiene / search

```bash
# No runtime consumers of deleted scaffold
rg -n "@/lib/current-situation|resolveCurrentSituation|isCurrentSituationEnabled|CurrentSituationRegistry|NEXT_PUBLIC_CURRENT_SITUATION_ENABLED" \
  apps packages --glob '!**/node_modules/**'

# Confirm active modules untouched in this branch's commits
git diff origin/develop..HEAD --stat -- \
  '**/grocery-optimization/**' '**/financial-reality/**'
```

### Web

```bash
cd apps/web
npm run typecheck   # may still report pre-existing unrelated test typing debt
npm run build       # production Next build — expected PASS after Step 5
npm run test -- src/lib   # current-situation suite gone; unrelated pre-existing failures OK
```

### Demo isolation (manual / spot)

- With `NODE_ENV=production` / `ARRIVAL_ATLAS_DEV_TOOLS=false`: Header has no life-event persona demo UI; demo-tools routes remain gated.  
- Development: persona demos still available via dynamic `HeaderLifeEventDemos`.

---

# Part 5 — Commit map

| Commit | Summary |
| ------ | ------- |
| `fcef944` | chore: remove generated artifacts and accidental Finder duplicates |
| `4fa6c9e` | docs: quarantine historical audits, PRs, and black-box notes |
| `b44ed7e` | fix: lazy-load life-event-demo behind DEV_TOOLS gates |
| `296f904` | chore: remove unused current situation scaffold |

---

## Related docs

- [arr-042-pr-description.md](../../arrival-atlas-local-archive/documentation/docs/pr/arr-042-pr-description.md) — Product vertical slices + controlled release (prior branch; archived mirror)  
- [docs/pr/README.md](./README.md) — historical PR mirrors quarantine note  
- [docs/vision/primitives/current-situation-resolver.md](../vision/primitives/current-situation-resolver.md) — conceptual CSR (implementation removed)  
- [tools/black-box-audit/RELEASE-READINESS-CONTRACT-v1.md](../../tools/black-box-audit/RELEASE-READINESS-CONTRACT-v1.md) — release contract (unchanged)  

> Note: prior `docs/pr/arr-0xx-pr-description.md` files were quarantined in Step 2. Relative links into `../arrival-atlas-local-archive/` work for local review; GitHub will not host that archive.

---

## Reviewer notes

| Concern | Answer |
| -------- | ------ |
| Why delete so much? | Artifacts + historical docs were never product runtime; they bloated clone/Docker context |
| Did product behavior change? | **No** intentional newcomer-facing change; demo UI already gated off in production |
| Why keep `life-event-demo` package? | Still required for typed demo tooling / workspace; isolation is import-graph + runtime gates |
| Why remove CSR code but keep the vision doc? | Scaffold had zero consumers; conceptual design remains for a future real consumer |
| Were grocery / financial-reality changed? | **No** |
| Is the local archive required to build? | **No** — archive is for humans / Confluence migration only |
| Should `docs-chunks.jsonl` be regenerated? | Optional follow-up; not required for runtime |
| Release recommendation? | Same controlled-release posture as arr-042, with a cleaner repo surface |
