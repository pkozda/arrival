# arr-040 — Clean monorepo / Docker build · ER i18n layering · Web type blockers

**Branch:** `arr-040`  
**Tracks:** Dist-less / Docker-clean buildability · package DAG cycle break (Option A) · Web façade export gaps · dead navigation call · domain sync merge typing  
**Base:** `develop` (post arr-039 / merge #37)

Makes Arrival Atlas **buildable from a completely clean checkout** (no stale `packages/*/dist`, including Docker Compose context with `.dockerignore` excluding `**/dist`) without weakening TypeScript checks or changing Discovery / CSR / MBDE domain behavior.

This PR **does** break the production cycle `core → product-contract → module-runtime → core`, align root + API/Web Dockerfile build order (including `mbde` after `product-contract`), and clear the Web production typecheck blockers that blocked `next build`. It does **not** redesign package architecture beyond the approved Option A move, change Discovery logic, or clean unrelated stale test fixtures.

1. **Option A — ER copy ownership** — move `ECONOMIC_REALITY_COPY_*` / `ER_COPY_KEYS` (+ schemas) into `@arrival-atlas/core`; `product-contract` re-exports the public API; remove production `core → product-contract`.
2. **Package DAG / build order** — topological `scripts.build` + `apps/api/Dockerfile` + `apps/web/Dockerfile`; `product-contract` depends on `core`; `mbde` builds after `product-contract`; `life-event-demo` after `modules`.
3. **module-runtime clean build** — exclude `src/**/*.test.ts` from `tsc` (same pattern as sibling packages) so clean builds do not require `modules` dist for test-only imports.
4. **Web — dead `buildSpatialTransition` call** — remove unused pre-navigation call in `useAtlasNavigation` (return discarded; persistence already via interceptor → `persistArrivalIntent`).
5. **Web façade** — re-export `EconomicBlockerId`, `EconomicActionV1`, `PlanConfidence`; add missing `PlanConfidence` to product-contract **root** public exports.
6. **Web — `mergeSuccessfulDomainStates`** — merge via `mergeDomainPatches` (fix union-key `Object.entries` assignment); focused unit tests.

**Product verdict:** A clean VPS / Docker / CI checkout can run `npm run build` and `docker compose build` without relying on stale local `dist`, without `skipLibCheck` / path hacks, and without changing ER copy strings, Discovery behavior, or runtime sync semantics.

**Diff vs `develop` (working tree):** ~17 paths · +~146 / −~285 lines · ER string sources relocated core ← product-contract · Docker/root build order · Web façade + navigation + domain sync typing · CSR/MBDE/Discovery domain logic untouched.

---

# Part 1 — Problem statement

## Clean Docker / dist-less failure

With `.dockerignore` excluding `**/dist`, Web/API image builds compiled `@arrival-atlas/core` **before** `@arrival-atlas/product-contract` was available:

```text
packages/core/src/i18n/economic-reality-translations.ts
  → import from '@arrival-atlas/product-contract'   # TS2307 on clean build
```

Local builds often succeeded only because **stale `dist`** from earlier package builds masked the cycle.

## Confirmed cycle

```text
core ──(production import)──► product-contract
                                    │
                                    ▼
                             module-runtime ──► core
```

`product-contract`’s use of `core` was test/dev-oriented; the **production** upward edge was ER copy constants used only to feed `getTranslations()`.

## Secondary clean-order bug

Root + Dockerfiles built **`mbde` before `product-contract`**, despite `mbde → product-contract`. Reordering alone could not fix the cycle; both cycle break **and** order fix were required.

## Web typecheck cascade (after DAG fix)

| Blocker | Cause |
|---------|--------|
| `useAtlasNavigation` | Passed `ArrivalContextInput` into `buildSpatialTransition(ArrivalContext)` — dead call |
| `@/lib/product-contract` façade | Missing `EconomicBlockerId`, `EconomicActionV1`; `PlanConfidence` also missing from package **root** |
| `mergeSuccessfulDomainStates` | `Object.entries` + union-key write → TS demanded impossible domain-state intersection |

---

# Part 2 — Architecture (Option A)

## Before / after dependency edges

**Before (invalid for clean build):**

```text
ui-contract → core ─X→ product-contract → module-runtime → core
                         ▲
                         └── mbde (often built too early)
```

**After:**

```text
ui-contract → core  (owns ER_COPY_KEYS + ECONOMIC_REALITY_COPY_{EN,DE,RU})
                ↑
         module-runtime / profile / …
                ↑
         product-contract  (re-exports ER API; depends on core + module-runtime)
                ↑
         mbde / modules / api / web
```

## Public API preservation

| Symbol | Owner after | Still importable from `@arrival-atlas/product-contract` |
|--------|-------------|--------------------------------------------------------|
| `ECONOMIC_REALITY_COPY_EN` / `_DE` / `_RU` | `core` | ✅ re-export |
| `ER_COPY_KEYS`, `ECONOMIC_REALITY_COPY_KEY_LIST` | `core` | ✅ |
| `SYSTEM_INTENT_COPY_KEYS`, `SECTION_TYPE_COPY_KEYS` | `core` | ✅ |
| Related Zod schemas / key types | `core` | ✅ |

`packages/modules` and most of `apps/web` keep importing ER copy from product-contract — **no consumer churn**.

`getTranslations()` / `ECONOMIC_REALITY_I18N` behavior unchanged (core merges local tables).

## Build order (root + Dockerfiles)

```text
ui-contract → core → profile → shared-services → discovery
  → module-sdk → module-runtime → product-contract → mbde
  → profile-engine → profile-intelligence → observability
  → modules → life-event-demo → ux → api → web
```

(Web Dockerfile omits `discovery` / `api` as before.)

---

# Part 3 — Package / file map

| Area | Change |
|------|--------|
| `packages/core/src/i18n/economic-reality-*.ts` | Ownership of copy keys + locale tables + translations import |
| `packages/product-contract/src/i18n/` | Delete moved sources; barrel re-exports from `@arrival-atlas/core` |
| `packages/product-contract/package.json` | `@arrival-atlas/core` → **dependencies** |
| `packages/product-contract/src/index.ts` | Export `PlanConfidence` at package root |
| `packages/module-runtime/tsconfig.json` | Exclude `src/**/*.test.ts` from build |
| root `package.json` `scripts.build` | Topological order |
| `apps/api/Dockerfile` · `apps/web/Dockerfile` | Same order constraints |
| `apps/web/.../useAtlasNavigation.ts` | Remove dead `buildSpatialTransition` call |
| `apps/web/src/lib/product-contract.ts` | Façade: `PlanConfidence`, `EconomicBlockerId`, `EconomicActionV1` |
| `apps/web/.../domainSyncExecution.ts` | `mergeSuccessfulDomainStates` → `mergeDomainPatches` |
| `domainSyncExecution.test.ts` | Focused merge tests |

---

# Part 4 — Web production typecheck fixes

## 4.1 `useAtlasNavigation`

Removed no-op `motionEngine.buildSpatialTransition(...)` (result unused; engine pure). Canonical path unchanged:

```text
markExplicitNavigation → recordArrivalIntent
  → interceptor.ensureSpatialIntent → persistArrivalIntent
  → consumeArrivalIntent → ArrivalProvider
```

## 4.2 Product-contract façade + root `PlanConfidence`

- Façade re-exports types already needed by certainty / ER action routing.
- `PlanConfidence` added to package root (was only on `profile/` barrel) so façade can re-export without indexed-access aliases.

## 4.3 `mergeSuccessfulDomainStates`

Typing-only fix: reuse `mergeDomainPatches` for per-domain keyed merges. Runtime sync semantics unchanged (skip non-success / missing domains; same-key patch merge; partial maps).

---

# Part 5 — Explicitly out of scope

- Discovery / PDE domain logic, ops tokens, Compose topology content (already in arr-039)
- CSR / MBDE redesign
- New leaf package for ER i18n (Option B rejected)
- Moving ER merge out of `getTranslations` to app boundary (Option C rejected)
- `skipLibCheck`, tsconfig path aliases, committing `dist`, copying stale artifacts
- Bulk cleanup of stale **test-only** fixtures (`profile: { language }`, AppState mocks, etc.) that do not block `next build`

---

# Part 6 — Validation

## Critical clean package proof

```bash
rm -rf packages/*/dist apps/api/dist apps/web/.next

npm run build -w @arrival-atlas/ui-contract
npm run build -w @arrival-atlas/core
# must succeed with packages/product-contract/dist absent

grep -R "@arrival-atlas/product-contract" packages/core/src packages/core/package.json
# expect: no matches
```

## Full monorepo

```bash
npm run build
npm run build -w @arrival-atlas/api
npm run build -w @arrival-atlas/web
```

## Focused regression

```bash
npm test -w @arrival-atlas/web -- \
  src/lib/certainty/adapters/economic-certainty.test.ts \
  src/lib/economic-reality/resolve-action-route.test.ts \
  src/lib/runtime/domainSyncExecution.test.ts \
  src/lib/atlas-runtime/spatial-memory.test.ts \
  src/lib/i18n/dictionary-completeness.test.ts

npm test -w @arrival-atlas/modules -- \
  src/i18n/copy-resolver.test.ts \
  src/i18n/copy-validation.test.ts
```

## Docker (on a Docker host)

```bash
docker compose build
# API + Web images from empty dist context
```

### Manual / smoke checklist

- [ ] Clean `rm -rf packages/*/dist && npm run build` on a fresh clone
- [ ] `docker compose build` without local `dist`
- [ ] ER module still resolves copy via product-contract re-exports
- [ ] `getTranslations('en')` still includes `ER.MODULE.TITLE` (etc.)
- [ ] Atlas navigation / arrival intent still persists across route change
- [ ] Session sync still commits merged domain states when policy satisfied

---

## Related docs

- [arr-039-pr-description.md](./arr-039-pr-description.md) — PDE production readiness + personal staging packaging (prior)
- [docs/deployment.md](../deployment.md) — Compose + Caddy (consumes clean Docker builds)

---

## Reviewer notes

| Concern | Answer |
|---------|--------|
| Why move copy into `core`? | Smallest cycle break; other feature i18n already lives in core; preserves product-contract public API via re-exports |
| Why not a new package? | Extra workspace/Docker ceremony for ~250 lines of leaf strings |
| Discovery touched? | No domain/behavior changes |
| Runtime sync changed? | No — only typing/merge helper reuse |
| Test fixture TS debt? | Still present under `tsc -p apps/web`; does **not** fail `next build` |
