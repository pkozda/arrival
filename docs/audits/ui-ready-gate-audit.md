---
id: ui-ready-gate-audit
title: UI Ready Gate Audit
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: platform
status: active
maturity: stable
owner: system
tags:
  - ui-ready-gate
  - product-contract
  - web-boundary
created: 2026-06-01
updated: 2026-06-19
related:
---

# UI Ready Gate Audit

**Date:** 2026-06-18 (updated post Phase 5C)  
**Scope:** Final UI Ready Gate verification after Phase 5C — UI Contract Purification  
**Verdict:** **UI READY**

---

## Executive Summary

Phase 5C closed all remaining UI Ready Gate debt:

- **G1** — Web types unified under `@arrival-atlas/product-contract` (no local domain mirrors)
- **G2** — `@arrival-atlas/core` fully removed from web dependency graph; CI enforces via `web-package-boundary.test.ts`
- **G3** — Module discovery, navigation, and forms are contract-driven (`/api/modules`, `/api/modules/:id/schema`)

Legacy API compatibility flags remain on the backend with deprecation headers (5C.4); web does not consume them.

---

## G1–G7 Assessment (Final)

| Gate | Status | Evidence |
|------|--------|----------|
| **G1** Web consumes only product-contract types | **PASS** | `apps/web/src/lib/product-contract.ts` re-exports all domain types; no `UiSnapshot`/`ModuleInfo` mirrors in `api.ts` |
| **G2** No runtime imports in web | **PASS** | Zero `@arrival-atlas/core` imports; removed from `apps/web/package.json`; `web-package-boundary.test.ts` |
| **G3** Module pages driven by contract | **PASS** | Dynamic `/modules/[moduleId]` + `ContractModulePage` + `SchemaForm` from schema API; Header nav from catalog |
| **G4** Execute uses ModuleUIProjection only | **PASS** | Unchanged from Phase 5B |
| **G5** Explain uses Explain API only | **PASS** | Unchanged from Phase 5B |
| **G6** Snapshot uses UiSnapshotProjection only | **PASS** | Unchanged from Phase 5A |
| **G7** Test suites green | **PASS** | Full monorepo green including web + ui-contract |

---

## Phase 5C Deliverables

### 5C.1 Core Dependency Elimination
- New package `@arrival-atlas/ui-contract` (language, theme, branding)
- Core re-exports UI primitives from ui-contract (no local branding file)
- Web imports exclusively from `@arrival-atlas/product-contract`

### 5C.2 Contract-Driven Module Discovery
- `fetchModuleCatalog()`, `fetchModuleSchema()` in web API client
- Header navigation from `PublicModuleContract[]`
- Home module grid from catalog (snapshot = session state only)
- `SchemaForm` + `deriveDefaultValues()` / `extractSchemaFields()`

### 5C.3 Web Type Unification
- `UiSnapshot`, `PublicModuleContract`, projection types in product-contract
- Deleted web-local mirrors and per-module page implementations

### 5C.4 Legacy Deprecation
- `markLegacyContractDeprecated()` on `?contractVersion=legacy` and `?snapshotVersion=legacy`
- Deprecation + Sunset headers + structured warn logs

---

## Final Architecture

```text
UI
  ↓
PublicModuleContract      (GET /api/modules)
  ↓
ContractSnapshot        (GET /api/modules/:id/schema)
  ↓
ModuleUIProjection      (POST /execute + ui-snapshot)
  ↓
ModuleExplanationView   (GET /explain)
  ↓
UiSnapshotProjection    (GET /ui-snapshot session aggregation)
```

**No:** core imports, runtime imports, local type modeling, hardcoded module UI logic.

---

## Test Summary

| Package | Tests |
|---------|-------|
| `@arrival-atlas/ui-contract` | 1 |
| `@arrival-atlas/product-contract` | 59 |
| `@arrival-atlas/api` | 174 |
| `@arrival-atlas/web` | 8 |
| **Monorepo total** | **430+** |

---

## Remaining Non-Blocking Items

| Item | Classification |
|------|----------------|
| Remove legacy API flags entirely | Post UI READY (next minor release) |
| Profile-to-schema field mapping on API | Enhancement (generic merge only today) |
| Dynamic Next.js route prefetch for all modules | Performance, not boundary |

**Platform status: UI READY**
