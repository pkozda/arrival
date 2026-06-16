# Arrive Atlas — Comprehensive System Audit

**Date:** June 2026  
**Auditor role:** Senior Staff Engineer + Product Architect + UX Systems Analyst  
**Scope:** Full codebase — frontend, backend, data flow, modules, UX, domain modeling, technical debt  
**Status:** Audit only — evidence-based analysis; recommendations deferred to Section 11  
**Method:** Code inspection only; no features invented; unknowns marked explicitly

**Related audits:**  
`docs/audits/platform-architecture-audit.md`,  
`docs/audits/frontend-ux-alignment-audit.md`,  
`docs/audits/mvp-r3-single-source-truth-audit.md`,  
`docs/audits/financial-platform-readiness-audit.md`

---

## 1. Executive Summary

- **Monorepo architecture (npm workspaces)** with 7 packages/apps: `core`, `profile`, `shared-services`, `modules`, `ux`, `api` (Fastify), `web` (Next.js 15). Build order is explicit in root `package.json`.
- **Maturity: early MVP / prototype-plus.** Strong modular contracts and test coverage in backend packages (~137+ tests observed across profile, modules, ux, api); frontend is thinner and largely stateless between page loads.
- **Execution model is sound:** `POST /api/modules/:id/execute` → `resolveExecutionContext()` → module registry execute → optional UX enrichment. This is the canonical backend path (`apps/api/src/build-app.ts`).
- **Profile engine exists and is backend-integrated** (`packages/profile`, `InMemoryProfileStore`), but **the web app does not call profile APIs**. Users submit per-module forms; profile merge only applies if a profile is bound to a session server-side (not observable from frontend flows).
- **UX layer is split across three tiers:** backend `packages/ux` (signal normalization + action cards), API attach layer (`ux-integration.ts`), and frontend interpretation layers (`ux-store`, `ux-aggregator`, `profile-insight`, `profile-surface`, FTU). Only 3 of 6 registered modules produce UX signals today.
- **All durable state is in-memory** (sessions, profiles, events, execution traces). README lists PostgreSQL/Redis as planned; not present in code.
- **Frontend/backend product surface is misaligned:** 6 backend modules registered; 5 frontend pages; `benefits-simulator` has backend + policy + merge strategy but no UI route.
- **Significant duplicate artifact debt** in `packages/profile/src/` (`engine 2/`, `policy 2/`, duplicate test files) — likely accidental copy, not imported by `index.ts`.
- **Domain modeling is Germany-specific and hardcoded** throughout shared-services rules, UX templates, and module copy (Anmeldung, Krankenkasse, Bürgergeld, Steuerklasse).
- **Overall:** Good platform skeleton and module isolation intent; scaling blocked by ephemeral persistence, frontend profile disconnect, duplicated UX logic, and incomplete cross-layer contracts.

---

## 2. System Architecture Overview

### Frontend structure

| Aspect | Evidence |
|--------|----------|
| Framework | Next.js App Router, React 19 (`apps/web`) |
| Routing | `/` home, `/modules/{id}` for 5 modules only |
| State | React `useState` per page; global client stores via module-level singletons (`ux-store.ts`, `ftu.ts` + `localStorage`) |
| Data fetching | Direct `fetch` to REST API (`apps/web/src/lib/api.ts`) |
| i18n | Server-fetched translation maps via `/api/i18n/:lang`; keys in `packages/core/src/i18n/index.ts` |
| SSR | Pages are `'use client'`; minimal SSR benefit; FTU uses `useSyncExternalStore` for hydration safety |

**Notable components (UX stack on home):**

```
FtuHomeExperience → ProfileInsightBanner → ProfileSurfacePanel → UxAttentionLayer → GlobalUxPanel → ExploreModulesSection
```

Module pages use: `ModuleLayout` + form + `ModuleResultRenderer` (wraps `UxActionPlan` + raw module output).

### Backend structure

| Layer | Package/App | Role |
|-------|-------------|------|
| HTTP | `apps/api` | Fastify REST, CORS, route registration |
| Platform | `packages/core` | Sessions, events, i18n, module registry |
| Profile | `packages/profile` | Document model, policy, merge, execution context resolution |
| Domain modules | `packages/modules` | 6 pluggable modules |
| Calculations/rules | `packages/shared-services` | Financial pipeline, Bürgergeld, rules engine, translation |
| UX orchestration | `packages/ux` | Signal → action card transformation |

**Profile runtime:** `InMemoryProfileStore` + `ProfileEngine` instantiated in `apps/api/src/profile-runtime.ts`.

**Profile API routes:** `POST/GET/PATCH /api/profile`, `GET /api/profile/revisions` (`apps/api/src/routes/profile.ts`).

### External dependencies

- **Runtime:** Node ≥20, TypeScript, Zod, Fastify, Next.js
- **Planned (README only):** PostgreSQL, Redis, Python rules service — **not observable in codebase**
- **No auth provider, no external data APIs** observed

### Text diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  apps/web (Next.js)                                              │
│  AppProvider (sessionId, language, theme)                        │
│  ux-store (in-memory) │ ftu (localStorage) │ profile-* (derived) │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST (fetch)
┌────────────────────────────▼────────────────────────────────────┐
│  apps/api (Fastify)                                              │
│  /api/modules/:id/execute                                        │
│    → resolveExecutionContext(profileEngine)                      │
│    → globalRegistry.execute()                                    │
│    → attachUxToExecutionResult() [ATLAS_UX_ENABLED]              │
│  /api/profile, /api/sessions, /api/i18n, /api/events             │
└─────┬──────────────┬─────────────────────┬────────────────────────┘
      │              │                     │
      ▼              ▼                     ▼
 packages/core   packages/profile    packages/modules
 (sessions*,      (InMemoryStore*,    (6 modules →
  registry,        policy, merge)      shared-services)
  events*)
      │
      ▼
 packages/ux (buildUXActionPlan)
 packages/shared-services (financial, rules, translation)

* All in-memory — lost on process restart
```

---

## 3. Module & Domain Breakdown

### Platform: `packages/core`

| | |
|--|--|
| **Responsibility** | Module registry, session CRUD, event audit log, i18n strings, shared types (`AppContext`, `Module` interface) |
| **Inputs/Outputs** | Module registrations in; execution results, sessions, events out |
| **Dependencies** | Zod only |
| **Coupling** | Low — intended stable kernel |
| **Leakage** | `AppContext` still carries legacy fields (`systemState`, broad `userProfile`) though `context-builder.ts` now exposes minimal `userProfile.language` to modules |

### Profile: `packages/profile`

| | |
|--|--|
| **Responsibility** | Profile document schema, revisioning, module policy filtering, input merge, execution traces |
| **Inputs/Outputs** | Session-bound profile + request input → merged input + filtered `AppContext` |
| **Dependencies** | `@arrivalos/core`; module merge strategies registered from `@arrivalos/modules` |
| **Coupling** | Medium — central to execution but cleanly port-based (`ProfileStore` interface) |
| **Leakage** | `MODULE_INPUT_CONFIG` in `input-merger.ts` is a growing per-module field map (only financial-reality + healthcare-navigation configured); benefits-simulator uses external merge strategy pattern instead |

### Shared services: `packages/shared-services`

| | |
|--|--|
| **Responsibility** | German tax/payroll, Bürgergeld calculator, financial pipeline v2, generic rules engine, translation glossary, normalization |
| **Inputs/Outputs** | Structured financial/legal inputs → calculations, eligibility, admin rule strings |
| **Dependencies** | None from modules/profile (correct direction) |
| **Coupling** | Low externally; high internal complexity in `financial/` subtree |
| **Leakage** | 2025 parameter files hardcoded (`parameters/2025.ts`); Germany-only |

### UX: `packages/ux`

| | |
|--|--|
| **Responsibility** | Normalize module outputs → UX signals → prioritized action cards + summary |
| **Inputs/Outputs** | `{ domain, result }[]` → `UXActionPlan` |
| **Dependencies** | None |
| **Coupling** | Medium — string-matching on module output shapes (fragile contract) |
| **Leakage** | Only 3 normalizers implemented; `benefits-simulator`, `life-event`, `grocery-optimization` fall through to `[]` |

### Registered modules (6)

| Module | Responsibility | Primary deps | Coupling | Leakage signs |
|--------|---------------|--------------|----------|---------------|
| **financial-reality** | Net income, Bürgergeld, admin rules, optional v2 pipeline | shared-services, profile context resolver | Medium | Dual v1/v2 execution paths; reads profile slice via `resolveFinancialProfileContext` |
| **healthcare-navigation** | Insurance status guidance | Mostly self-contained logic | Low | Static recommendations |
| **system-translation** | Admin term lookup/translation | shared-services translation | Low | UX signal only when explicit flags set |
| **grocery-optimization** | Budget breakdown, store tips | None (inline constants) | Low | Hardcoded German store names, static cost ratios |
| **life-event** | Phased checklists per life event | None (large inline scenario tables) | Low | ~330 lines of static scenario data in module file |
| **benefits-simulator** | Multi-event benefit scenario analysis | shared-services simulator, profile merge strategy | Medium | Registered but no frontend; UX normalizer missing |

---

## 4. Data Flow Analysis

### End-to-end execution path (observed)

1. **Frontend:** User submits module form → `executeModule(id, input, { userProfile: { language } }, sessionId)` (`api.ts`)
2. **API:** Parses `AppContext` via Zod; calls `resolveExecutionContext(profileEngine, {...})`
3. **Profile pipeline:**
   - Load profile by session (if bound)
   - Apply module policy → `profileSlice`
   - Merge request input with profile fields (`input-merger.ts` or module merge strategy)
   - Build `AppContext` via `context-builder.ts` (language + profile metadata + slice)
4. **Registry:** Validate input schema → `module.execute()` → validate output schema
5. **UX attach:** If `ATLAS_UX_ENABLED`, `buildUXActionPlan()` on module output
6. **Frontend:** Page stores result locally; `recordModuleUx()` pushes to in-memory `ux-store`
7. **Home aggregation:** `ux-aggregator.ts` merges all module UX payloads; `profile-insight.ts` / `profile-surface.ts` derive display state from action cards only

### Where business logic lives

| Logic | Location |
|-------|----------|
| Tax/benefits calculations | `packages/shared-services` |
| Admin rule evaluation | `shared-services/rules`, `germanAdminRules` |
| Module orchestration | `packages/modules` |
| Profile merge/precedence | `packages/profile` |
| UX prioritization (backend) | `packages/ux/ux-orchestrator.ts` |
| UX prioritization (frontend global) | `apps/web/src/lib/ux-aggregator.ts` — **duplicated** |
| "Profile understanding" (WHY/WHERE) | `profile-insight.ts`, `profile-surface.ts` — **frontend-only, inferred from UX cards** |

### Inconsistencies / duplication

- **Summary text generation** duplicated between `packages/ux` and `apps/web/src/lib/ux-aggregator.ts` (`describeAction`, `buildSummary` patterns)
- **UX signal coverage:** Backend lists 6 UX sources; orchestrator normalizes 3
- **Profile data never flows from UI:** `AppProvider` creates session with `{ userProfile: { language } }` only; no `POST /api/profile` calls in web app
- **Module input defaults:** Frontend forms use hardcoded defaults (e.g. grossIncome 2500); profile merge path largely unused in practice
- **UX store is session-ephemeral:** Refresh loses aggregated home UX unless modules re-run

---

## 5. UX / Product Structure Analysis

### Main user flows (observable)

1. **Home → FTU (first visit):** 3-step progressive reveal (WHY → WHERE → WHAT) via `FtuHomeExperience` + `localStorage`
2. **Home → module exploration:** Collapsible module grid; proactive UX panels when modules have been executed
3. **Module page flow:** Form input → execute → `UxActionPlan` + raw structured results
4. **Navigation:** Header drawer links to 5 modules; logo returns home

### Entry points

- `/` — orchestrated dashboard
- Direct deep links to `/modules/*`
- No login, no onboarding beyond FTU, no profile setup wizard

### Navigation model

- **Global nav:** Module-centric (5 items in `Header.tsx`)
- **Home:** UX-layer-centric (insight → surface → attention → global panel → modules)
- **No cross-module workflow links** (e.g., action card → pre-filled module form)

### Cognitive load (observable)

- **Dual result presentation on module pages:** UX action plan above raw module data (`ModuleResultRenderer`) — intentional but adds layering
- **FTU vs returning user flash:** Server snapshot always step 1; completed users may briefly see onboarding card
- **Empty home state:** Without running modules first, insight/surface panels render null; FTU step 1 shows fallback copy
- **Module heterogeneity:** Financial page is form-heavy; life-event is event-selector; no shared form abstraction

### UX pattern consistency

| Pattern | Coverage |
|---------|----------|
| `ModuleLayout` wrapper | All 5 module pages |
| `ModuleResultRenderer` + `recordModuleUx` | All 5 module pages |
| Inline styles (not design system) | Universal |
| i18n via `t()` | Nav + titles; **module form labels largely hardcoded English/German mix** |
| Profile API integration | **None in UI** |

---

## 6. Backend & API Design

### Style

**REST**, resource-oriented, flat route table in `build-app.ts` + profile routes module.

### Endpoint organization

| Group | Endpoints |
|-------|-----------|
| Health | `GET /health` |
| Modules | `GET /api/modules`, `GET /api/modules/:id`, `POST /api/modules/:id/execute`, `GET /api/modules/:id/trace` |
| Profile | `POST/GET/PATCH /api/profile`, `GET /api/profile/revisions` |
| Sessions | `POST/GET/PATCH /api/sessions/:id` |
| i18n | `GET /api/i18n/languages`, `GET /api/i18n/:lang` |
| Events | `GET /api/events` |

### Validation & logic placement

- **Input validation:** Zod at API boundary (`AppContextSchema`) and per-module `inputSchema`/`outputSchema`
- **Business logic:** Modules + shared-services (correct)
- **Cross-cutting:** Profile resolution before execute (correct single entry point)
- **UX enrichment:** Post-execute adapter in API layer (appropriate for MVP)

### Data consistency strategy

- **Profile revisions:** Optimistic concurrency via `If-Match` / `X-Profile-Revision` on PATCH
- **Sessions ↔ profiles:** Binding via `profileEngine.bindSession()` on profile create
- **Persistence:** In-memory only — **no durability, no multi-instance consistency**
- **Execution traces:** Per session+module, in-memory Map, last trace only

---

## 7. Technical Debt & Risk Areas

| Category | Finding | Location |
|----------|---------|----------|
| **Ephemeral persistence** | Sessions, profiles, events, traces all in-process Maps | `core/session`, `profile/adapters/in-memory-store`, `execution-trace-store.ts`, `events/index.ts` |
| **Frontend profile disconnect** | Full profile API unused by web | `apps/web` — no `/api/profile` references |
| **Duplicate profile package trees** | `engine 2/`, `policy 2/`, `types 2/`, duplicate tests | `packages/profile/src/` |
| **UX logic duplication** | Summary/action phrasing in backend UX + frontend aggregator + insight/surface | `ux-orchestrator.ts`, `ux-aggregator.ts`, `profile-insight.ts` |
| **Fragile UX normalization** | String includes on module output fields | `ux-orchestrator.ts` (`includes('Anmeldung')`, etc.) |
| **Per-module input config growth** | Static field maps vs merge strategy pattern | `input-merger.ts` vs `benefits-simulator/merge-strategy.ts` |
| **Incomplete module UX coverage** | 3/6 modules produce signals | `normalizeModuleOutput()` default case |
| **Hardcoded module lists** | Frontend home, header nav, UX priority order maintained separately | `page.tsx`, `Header.tsx`, `ux-aggregator.ts` |
| **Naming drift** | Product: "Arrive Atlas"; packages: `@arrivalos/*`; API health: `arrivalos-api`; theme key: `arrivalos-theme` | Multiple files |
| **Legacy AppContext fields** | `systemState` in schema/session merge; modules largely ignore | `core/types`, `session/index.ts` |

---

## 8. Hidden Assumptions in the System

| Assumption | Evidence |
|------------|----------|
| **User is in Germany** | UX copy, admin rules, Bürgergeld, Anmeldung, Krankenkasse throughout |
| **German tax year 2025** | `shared-services/financial/parameters/2025.ts` |
| **Supported languages: ru, ua, de, en** | `SupportedLanguageSchema` |
| **Single-user, single-session, no auth** | Session created client-side; no user identity |
| **Profile exists only if explicitly created via API** | Frontend never creates one |
| **Health insurance is mandatory** | UX action templates, healthcare module |
| **Registration required after N days** | Financial admin rules (daysInGermany) |
| **UX actions map to ~6 fixed administrative concepts** | `ACTION_CARD_TEMPLATES` in ux-orchestrator |
| **Module outputs are stable enough for string matching** | Normalizers grep titles/rules arrays |
| **Client-side UX store is sufficient for "global view"** | No server-side UX aggregation |
| **MVP modules = 5 UI pages** | benefits-simulator excluded despite backend readiness |
| **Steuerklasse 1–6 model** | Financial module input schema |

---

## 9. Architecture Maturity Assessment

| Dimension | Score | Justification |
|-----------|-------|---------------|
| **Modularity** | **7/10** | Clear module registry contract, profile policy ports, shared-services separation. Deductions: frontend module list duplication, partial merge-strategy migration, duplicate profile dirs. |
| **Scalability** | **3/10** | All state in-memory; no DB, no horizontal scaling path, UX aggregation client-only. |
| **Maintainability** | **6/10** | Good tests in backend packages, Zod contracts, trace tooling. Deductions: stringly UX normalization, duplicated logic, artifact clutter in profile package. |
| **UX coherence** | **6/10** | Intentional WHY/WHERE/WHAT layers and FTU flow. Deductions: profile UI absent, module form inconsistency, ephemeral global UX, backend/frontend module count mismatch. |
| **Domain modeling quality** | **5/10** | Rich `ProfileDocument` schema exists but underused; frontend derives "user state" from UX cards rather than profile; grocery/life-event modules use static heuristics not domain models. |

---

## 10. Critical Findings (MOST IMPORTANT)

### 1. No durable persistence — all user/profile/session state is ephemeral

- **Why it matters:** Cannot support real users, multi-device, or production deployment; restart loses everything.
- **Where:** `packages/core/src/session/index.ts`, `packages/profile/src/adapters/in-memory-store.ts`, `apps/api/src/execution-trace-store.ts`, `packages/core/src/events/index.ts`
- **Impacts:** Production readiness, data recovery, analytics, profile continuity

### 2. Profile engine is backend-complete but frontend-disconnected

- **Why it matters:** The system's stated "single source of truth" for user situation is not reachable from the product UI; merge/policy/trace infrastructure runs but rarely activates.
- **Where:** Profile routes in `apps/api/src/routes/profile.ts`; zero references in `apps/web`
- **Impacts:** Input duplication across module forms, weak personalization, insight/surface layers infer state from UX cards instead of profile

### 3. UX contract is implicit and duplicated across three layers

- **Why it matters:** Module output shape changes silently break action cards; frontend re-implements prioritization/summary logic separately from backend.
- **Where:** `packages/ux/src/ux-orchestrator.ts`, `apps/web/src/lib/ux-aggregator.ts`, `apps/web/src/lib/profile-insight.ts`, `apps/web/src/lib/profile-surface.ts`
- **Impacts:** Drift risk, inconsistent user messaging, high cost to add modules to UX layer

### 4. Product surface ≠ registered module set

- **Why it matters:** `benefits-simulator` is registered with policy, merge strategy, golden tests, and UI contract doc — but no web route; UX orchestrator doesn't normalize it anyway.
- **Where:** `packages/modules/src/index.ts` (6 modules), `apps/web/src/app/modules/` (5 pages), `ux-orchestrator.ts` (3 normalizers)
- **Impacts:** Incomplete product narrative, wasted backend investment, confused domain boundaries (financial vs benefits)

### 5. Client-only global UX state breaks the home dashboard model

- **Why it matters:** Home proactive UX (attention layer, insight, surface) depends on `ux-store` populated only when user visits module pages in current session; refresh clears context.
- **Where:** `apps/web/src/lib/ux-store.ts`, home components subscribing via `useSyncExternalStore`
- **Impacts:** Unreliable "life OS" experience, FTU degrades to empty states, no cross-session continuity

---

## 11. Recommendations (Strategic Directions Only)

1. **Introduce a persistence boundary** — Implement `ProfileStore` and session adapters against a real database; keep the port interface already defined in `packages/profile`. This unblocks everything else.

2. **Wire the frontend to the profile API** — Replace per-module isolated forms with profile-backed defaults and a minimal profile capture flow. Aligns product with existing `resolveExecutionContext` pipeline.

3. **Formalize the UX contract** — Define a shared typed signal schema emitted by modules (or a single normalization spec document + tests), collapse frontend `ux-aggregator` summary duplication, and complete normalizers for all registered modules.

4. **Consolidate module registration as single source** — Drive home module cards, header nav, and UX priority order from `GET /api/modules` (or a shared config package) instead of three hardcoded lists.

5. **Complete or defer benefits-simulator explicitly** — Either add the web page per existing UI contract or disable registration until ready; avoid half-integrated domain modules.

6. **Clean profile package artifact debt** — Remove duplicate `* 2/` directories and duplicate test files to reduce confusion and accidental imports.

7. **Server-side UX snapshot (optional after persistence)** — Persist last-known UX action plan per session/profile so home dashboard survives refresh without re-execution; keeps frontend store as cache only.

---

## Appendix: Facts vs Interpretations

| Section | Nature |
|---------|--------|
| Sections 2–6, 8 | Primarily code-evidenced facts |
| Section 9 scores | Interpretive judgments based on evidence |
| Section 10 impacts | Interpretive judgments based on evidence |
| PostgreSQL / Redis / Python rules engine | Listed in README only — **planned, not present in codebase** |

---

*End of audit.*
