# arr-019 — Economic Reality v1 closure (EP-11.1 + R-01–R-04 micro-patch)

**Branch:** `arr-019`  
**Tracks:** Economic Reality EP-11.1 stabilization · System Audit v2 · v1 closure spec  
**Base:** `develop` (post arr-018)

Closes the **Economic Reality Module v1 product line** after EP-11.1 stabilization and audit v2. This branch is **architecture hardening, micro-patch polish, and documentation only** — no new EP stages, no EP-12 feature expansion, no rule/graph/classifier changes.

**Product verdict:** Economic Reality v1 is **architecturally closed**; module development **pauses here**. EP-12 feedback integration remains explicitly out of closure scope.

---

# Part 1 — EP-11.1 Stabilization (audit v1 remediation)

Addresses all **4 critical** findings from [economic-reality-system-audit-v1.md](../audits/economic-reality-system-audit-v1.md).

## Summary

```text
UserContext → EP-1 → EP-2 (sole graph) → EP-3 (decoupled satisfaction)
           → EP-4 → EP-5 → EP-6 → EP-7 API
           → EP-8 client → EP-9 UI → EP-10 catalog routing → EP-11 copy
```

## What was done (EP-11.1)

| Fix | Change |
|-----|--------|
| **V-C1** Dual `graphHint` | Removed `graphHint` from evaluation; deleted `graph/selector.ts` |
| **V-C2** EP-3 coupling | `buildExecutionState` uses `evaluateEconomicSatisfactionKeys(userContext)` only |
| **V-C3** LE dual routing | LE graph catalog: `financial-reality` handoff removed; `economic-reality` only |
| **V-C4** Static cross-module maps | Deleted `cross-module-links.ts`; new `catalog-routing.ts` |
| Catalog extension | `lifeEventNodes`, `triggerEntrypoints` on ER catalog entry |
| R7 transparency | `EF_R7_FALLBACK` fixture + explicit debug reason |
| Copy runtime | `validatePresentationCopyKeys` in `buildPresentation` |
| Hash cleanup | Removed nested `presentation.metadata.deterministicHash` |

### Key files

| Area | Location |
|------|----------|
| Graph authority | `packages/modules/src/economic-reality/graph/resolve-graph.ts` |
| Execution decouple | `packages/modules/src/economic-reality/execution/build-execution-state.ts` |
| Catalog routing | `packages/modules/src/module-orchestration/catalog-routing.ts` |
| Module catalog | `packages/product-contract/src/modules/module-catalog.ts` |
| LE graph | `packages/modules/src/life-event/plan/graph/catalog.ts` |
| Copy contract | `packages/product-contract/src/i18n/` |
| Copy resolver | `packages/modules/src/i18n/` |

---

# Part 2 — System Audit v2

Post-EP-11.1 architectural re-audit.

**Document:** [economic-reality-system-audit-v2.md](../audits/economic-reality-system-audit-v2.md)

| Metric | v1 | v2 (pre R-patch) |
|--------|----|--------------------|
| Critical violations | 4 | 0 |
| Executive verdict | NOT CLOSED | CONDITIONALLY CLOSED |
| Tests | 300 | 307 |

---

# Part 3 — R-01–R-04 Micro-Patch (closure polish)

Removes residual catalog/router/UI/copy inconsistencies without changing EP-1→EP-11 architecture.

## R-01 — Router catalog authority

**File:** `apps/web/src/app-shell/modules/router.ts`

- `resolveModuleFromOpenAction` always returns catalog route
- Dev-only `ROUTER_HREF_IGNORED` warning when action `href` disagrees with catalog

## R-02 — Open-module catalog invariant

**File:** `packages/modules/src/economic-reality/actions/open-module-resolver.ts`

- Removed hardcoded `/modules/economic-reality` fallback
- Throws `CATALOG_ROUTE_MISSING` if catalog entry absent
- `enrichOpenModulePayload` uses same catalog-only path

## R-03 — HighlightPanel semantic-only UI

**File:** `apps/web/src/modules/economic-reality/ui/components/HighlightPanel.tsx`

- Removed raw `dominantActionRefIds` display
- Panel shows `labelKey` via `useEconomicCopy` only

## R-04 — Runtime action copy validation

**File:** `packages/modules/src/economic-reality/presentation/build-presentation.ts`

- `validateActionSetCopyKeys(actionSet)` at EP-6 boundary
- `buildPresentation(plan, actionSet)` signature updated in pipeline

| Item | Risk | Change type |
|------|------|-------------|
| R-01 | routing drift | deterministic fix |
| R-02 | missing catalog safety | strict invariant |
| R-03 | UI leakage of graph semantics | UI cleanup |
| R-04 | copy contract enforcement gap | runtime guard |

---

# Part 4 — Economic Reality v1 Closure Spec

Formal freeze document for the closed product unit.

**Document:** [economic-reality-v1-closure-spec.md](../economic-reality/economic-reality-v1-closure-spec.md)

### Guarantees (summary)

| ID | Invariant |
|----|-----------|
| G1 | Single graph authority (EP-2) |
| G2 | Single catalog authority |
| G3 | Linear pipeline EP-1→EP-7 |
| G4 | No dual truth systems |
| G5 | Key-only UI contract |
| G6 | Catalog-driven routing |
| G7 | Deterministic replay (modules); conditional at API with EP-12 |

### Boundaries

| Inside core | Outside core |
|-------------|--------------|
| EP-1 → EP-11.1 deterministic pipeline | EP-12 feedback layer |
| Catalog + copy governance | `financial-reality` calculator module |
| Full test coverage | LE-8 runtime (unwired) |

---

## Architecture compliance (full branch)

| Constraint | Status |
|------------|--------|
| No new EP stages | ✓ |
| No rule engine / graph catalog changes | ✓ |
| No EP-12 feature expansion | ✓ |
| Single graph authority (EP-2) | ✓ |
| Single routing authority (catalog) | ✓ |
| No hardcoded ER routes | ✓ |
| Runtime copy validation (actions + presentation) | ✓ |
| Audit v2 + closure spec published | ✓ |

## Deferred (explicitly out of scope)

- EP-12 feedback layer governance and replay model amendment
- LE-8 runtime wiring (`financial-reality` signal targets)
- `financial-reality` module retirement or rename
- EP-13+ extensions (events, analytics, personalization)

---

## Test plan

### Automated

- [ ] `packages/modules` — economic-reality + catalog-routing + i18n (~238+)
- [ ] `apps/api` — economic-reality API parity EF01–EF24 + EF_R7_FALLBACK (32)
- [ ] `apps/web` — EP-8/9/10/11 boundary + router href test (38+)

```bash
cd packages/modules && npx vitest run src/economic-reality src/api/economic-reality src/module-orchestration src/i18n
cd apps/api && npx vitest run src/economic-reality
cd apps/web && npx vitest run src/lib/economic-reality src/modules/economic-reality
```

### Smoke (manual)

- [ ] Load `/modules/economic-reality` — plan renders; no raw action IDs in highlight panel
- [ ] `open_module` navigation uses catalog route (query `entry=` preserved)
- [ ] Switch DE locale — all ER surfaces resolve copy keys
- [ ] LE institutional flow suggests `economic-reality` (not `financial-reality`)
- [ ] API `GET /api/modules/economic-reality/plan` — stable hash across repeat requests

---

## Related docs

- [economic-reality-v1-closure-spec.md](../economic-reality/economic-reality-v1-closure-spec.md)
- [economic-reality-system-audit-v2.md](../audits/economic-reality-system-audit-v2.md)
- [economic-reality-system-audit-v1.md](../audits/economic-reality-system-audit-v1.md)
- [economic-reality-module-v1-roadmap.md](../economic-reality/economic-reality-module-v1-roadmap.md)
- [economic-reality-module-v1-spec.md](../economic-reality/economic-reality-module-v1-spec.md)
- [arr-018-pr-description.md](./arr-018-pr-description.md) — prior Life Event v1 closure track
