# Financial Reality Module v2 — Implementation Report (Phase M0/M1)

**Date:** June 2026  
**Module version:** `financial-reality@2.0.0`  
**Engine version:** `2.0.0`  
**Phases completed:** M0, M1  
**Phases explicitly not started:** M2, M3, PostgreSQL, User Profile, Wohngeld, CI/CD

---

## Executive Summary

Financial Reality Module v2 engine is implemented behind the existing module ID and API contract. The v1 UI continues to work unchanged. When `advancedTaxScenarios` is enabled (default: **true**), calculations use:

- BMF PAP Lohnsteuer via **`lohnsteuerrechner`** (adapter pattern)
- Custom social contributions with BBMG caps
- Minijob and Midijob (Gleitzone) support
- SGB II–style Bürgergeld with tiered Regelbedarf, simplified KdU, and §11b Freibeträge
- Scenario comparison and DecisionEngine skeleton

**16 automated tests** pass (10 shared-services + 6 module).

---

## Completed Items

### Step 1 — Library Evaluation
- [x] `docs/research/payroll-library-evaluation.md`
- [x] Selected `lohnsteuerrechner` (MIT, PAP 2025/2026)
- [x] Rejected `@finanzfluss/calculators` (AGPL-3.0)
- [x] `PayrollTaxAdapter` abstraction for swap-ability

### Phase M0 — Foundation
- [x] `packages/shared-services/src/financial/` package structure
- [x] `ParameterRegistry` 2025 (`2025.1`)
- [x] Household domain model + legacy builder
- [x] Scenario model + types
- [x] Golden fixture folders:
  - `__fixtures__/payroll-2025.json`
  - `__fixtures__/buergergeld-2025.json`
- [x] Vitest infrastructure (shared-services + modules)

### Phase M1 — Engines
- [x] `PayrollEngine` (regular / minijob / midijob / self-employed stub / none)
- [x] `LohnsteuerrechnerAdapter` for Lohnsteuer
- [x] `BenefitsEngine` + Bürgergeld calculator
- [x] §11b Freibeträge (3-tier model)
- [x] Tiered Regelbedarf (Stufe 1–6)
- [x] Simplified KdU with default caps
- [x] `compareScenarios()` — effective gain, marginal retention
- [x] `DecisionEngine` skeleton (verdict + ranked decisions + expectedChanges)
- [x] `FinancialPipeline` orchestrator
- [x] v1 compatibility adapter (`adaptLegacyInputToV2` / `adaptV2OutputToLegacy`)
- [x] Feature flag `advancedTaxScenarios` with `setAdvancedTaxScenarios()`
- [x] Module bumped to **2.0.0** with extended optional output fields
- [x] v1 engine preserved for flag-off regression

### Documentation
- [x] `docs/architecture/financial-module-v2-notes.md`
- [x] This report

---

## Skipped Items (Per Constraints)

| Item | Reason |
|------|--------|
| Phase M2 UI wizard | Explicit stop after M1 |
| PostgreSQL persistence | User constraint |
| User Profile Engine | User constraint |
| Wohngeld | User constraint |
| Full self-employed EÜR | Stub only (`netMonthlyEstimate`) |
| Docker / CI/CD | User constraint |
| OAuth / Redis / Python | User constraint |
| BMF API oracle integration tests | Network dependency; deferred |
| `@vitest/coverage-v8` coverage report | Not added; manual coverage below |
| OpenAPI schema endpoint | Phase M3 |
| i18n decision strings | Phase M2 |

---

## Deviations from Original Plan

| Plan | Actual | Rationale |
|------|--------|-----------|
| Manual PAP if no library | Used `lohnsteuerrechner` adapter | Trustworthy MIT PAP for 2025 found |
| Separate `financial-reality-v2` ID | Same ID, semver 2.0.0 | Preserve registry + API stability |
| `advancedTaxScenarios: false` default | Default **true** | M1 delivery activates improved engine; v1 path tested via flag |
| 120+ unit tests | 16 tests | M1 focused golden + regression; expand in M3 |
| Partner employment input in UI | Adapter infers partner from `maritalStatus: married` | UI unchanged; v2 household built from v1 fields |
| City Mietstufen database | Default KdU caps by household composition | M1 simplified KdU per plan allowance |

---

## Test Results

```
@arrivalos/shared-services  — 10 passed (financial.test.ts)
@arrivalos/modules          —  6 passed (financial-reality.test.ts)
────────────────────────────────────────────────────────────
Total                       — 16 passed, 0 failed
```

### Test categories covered

| Category | Tests |
|----------|-------|
| PAP Lohnsteuer adapter | 2 |
| PayrollEngine (regular, minijob, midijob, classification) | 6 |
| §11b Freibeträge | 1 |
| Regelbedarf tiers | 1 |
| v1 adapter shape + compare mode | 3 |
| Module v2 execute | 2 |
| Module v1 regression (flag off) | 1 |
| Output schema validation | 1 |

### Manual coverage estimate

| Area | Coverage |
|------|----------|
| `payroll/tax-adapter.ts` | High |
| `payroll/payroll-engine.ts` | High |
| `payroll/minijob.ts`, `midijob.ts` | Medium |
| `benefits/buergergeld/*` | Medium |
| `scenarios/comparator.ts` | Medium (via module tests) |
| `decisions/decision-engine.ts` | Low–Medium |
| `pipeline/financial-pipeline.ts` | Medium |
| `adapters/v1-adapter.ts` | High |

---

## Assumptions

1. **Tax year 2025** parameters apply (`ruleSetVersion: 2025.1`).
2. **Default Bundesland `BE`** when not specified (legacy adapter).
3. **Applicant age 30**, **child age 8** when inferred from `householdSize`.
4. **Partner Steuerklasse V** when married (legacy adapter).
5. **Average KV Zusatzbeitrag 1.7%** (employee pays half).
6. **Church tax 9%** (not 8% BY/BW) unless state passed (not in v1 UI).
7. **Kindergeld fully counted** as income in Bürgergeld imputation.
8. **Self-employed:** user-provided net estimate × 0.7 of gross in legacy mapping (rough).
9. **KdU caps** are defaults, not city-specific Mietstufen tables.
10. **lohnsteuerrechner** PAP output is authoritative for Lohnsteuer.

---

## Known Limitations

1. **Lohnsteuer only from library** — social insurance is custom approximation.
2. **KdU not city-specific** — may over/under-state housing need vs Jobcenter.
3. **No Vermögensprüfung** — asset test excluded.
4. **No Wohngeld / ALG I** interaction.
5. **No PKV** modeling — assumes GKV employee rates.
6. **Partner income** not in v1 UI — only inferred household structure.
7. **Child ages** inferred, not collected in UI.
8. **Decision strings English only** — no i18n content layer.
9. **lohnsteuerrechner** is new (low npm adoption) — monitor for maintenance.
10. **Midijob Lohnsteuer** calculated on full gross (correct); Gleitzone applies to SV only.

---

## Architectural Concerns

1. **Dual engine maintenance** — v1 path should be removed after M2 confirms zero flag-off usage.
2. **Module-level flag state** — `setAdvancedTaxScenarios` is process-global; consider per-request flag via `AppContext` in M2.
3. **Type duplication** — `LegacyFinancialOutput` overlaps `FinancialRealityOutput`; consider shared types package.
4. **JSON fixture typing** — fixtures use manual casts; consider `zod` fixture schemas.
5. **Self-employed path** — needs dedicated engine or explicit disclaimer until EÜR support.

---

## Sample Output Comparison (€2,500 gross, StKl I, single, rent €800)

| Metric | v1 engine | v2 engine |
|--------|-----------|-----------|
| Net monthly | ~€1,639 | ~€1,788 |
| Lohnsteuer method | EStG multiplier hack | BMF PAP |
| Bürgergeld eligible | No (simple gap) | No (Freibeträge + tiered Regelbedarf) |
| `meta.engineVersion` | absent | `2.0.0` |

v2 net is higher because PAP Lohnsteuer is lower than the v1 multiplier approximation for this scenario.

---

## Recommended Next Step (Phase M2)

1. **Multi-step UI** — household builder, unemployed → job offer compare flow
2. **Surface `verdict` and `comparison`** in results panel
3. **i18n decision templates** (EN/DE/RU/UA)
4. **Expand golden fixtures** to 30+ vectors validated against BMF Steuerrechner
5. **Remove v1 engine** after 2 weeks of v2-only production use
6. **Add `@vitest/coverage-v8`** with 85% gate on `financial/`

---

## File Reference (New/Modified)

| Path | Change |
|------|--------|
| `packages/shared-services/src/financial/**` | New (~20 files) |
| `packages/modules/src/financial-reality/index.ts` | v2 orchestration |
| `packages/modules/src/financial-reality/financial-reality.test.ts` | New |
| `packages/shared-services/package.json` | +lohnsteuerrechner, vitest |
| `docs/research/payroll-library-evaluation.md` | New |
| `docs/architecture/financial-module-v2-notes.md` | New |

**Unchanged:** All other modules, API routes, web UI pages, core registry.

---

*Phase M1 complete. Do not proceed to M2 without explicit authorization.*
