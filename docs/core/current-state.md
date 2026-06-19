---
id: current-state
title: Arrival Atlas Current State
project: Arrival Atlas
system: Arrival Atlas
type: system
domain: core
status: active
maturity: evolving
owner: system
tags:
  - platform-state
  - module-catalog
  - governance-kernel
created: 2026-06-01
updated: 2026-06-19
related:
---

# Arrival Atlas — Current State & Next Steps

**Version:** 0.1.0  
**Date:** June 2026  
**Status:** Functional MVP prototype

---

## Executive Summary

Arrival Atlas is a **working prototype** of a modular decision-support platform for migrants in Germany. The foundational architecture described in the product vision is in place: a plugin-based core, five feature modules, shared services, a REST API, and a Next.js frontend.

The app runs end-to-end today (`npm run dev` → API on `:3001`, web on `:3000`). Users can switch language (EN/DE/RU/UA), toggle light/dark theme, and execute all five modules through dedicated UI pages.

What exists is a **solid architectural skeleton with demo-grade business logic**. The next phase should focus on **accuracy, persistence, testing, and depth** in the two MVP-priority modules (Financial Reality and System Translation) before expanding scope.

---

## Architecture Overview

```
apps/web (Next.js 15)          apps/api (Fastify 5)
        │                              │
        └──────── REST JSON ───────────┘
                       │
              packages/core
         (registry · session · i18n · events)
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   financial-    healthcare-    life-event
   reality       navigation     (+ 2 more)
         │             │             │
         └─────────────┼─────────────┘
                       ▼
            packages/shared-services
         (calculation · rules · translation · normalization)
```

**Monorepo layout:** npm workspaces, 32 TypeScript source files, 5 packages + 2 apps.

| Package | Role | Files |
|---------|------|-------|
| `@arrival-atlas/core` | Platform layer | 6 |
| `@arrival-atlas/shared-services` | Reusable engines | 4 |
| `@arrival-atlas/modules` | Feature plugins | 6 |
| `@arrival-atlas/api` | HTTP server | 1 |
| `@arrival-atlas/web` | UI | 15 |

---

## Current State by Layer

### 1. Core Platform — ✅ Implemented (MVP)

| Capability | Status | Notes |
|------------|--------|-------|
| `Module` interface + Zod contracts | ✅ Done | Strict input/output validation at runtime |
| Module registry | ✅ Done | Register, list, execute, feature flags, enable/disable |
| Session management | ⚠️ In-memory only | Lost on server restart; no TTL |
| i18n (RU/UA/DE/EN) | ✅ Done | ~20 UI strings per language; UI labels only |
| Event tracking | ⚠️ In-memory only | Max 10k events; no persistence or analytics pipeline |
| Hot-add modules | ✅ Supported | New module = register in `allModuleRegistrations` |

**Assessment:** Core is minimal and stable as designed. Session and events need persistence before any production use.

---

### 2. Shared Services — ⚠️ Prototype Quality

#### Calculation Engine
- Brutto/Netto estimation with simplified 2024-ish German tax brackets
- Steuerklasse handled via multipliers (approximation, not official Lohnsteuer tables)
- Fixed social contribution rates (health 7.3%, pension 9.3%, etc.)
- Bürgergeld eligibility: simplified Regelsatz (€563) + rent gap model

**Limitation:** Results are **directional estimates**, not legally accurate. Missing: Kindergeld, Wohngeld, Minijob/Midijob thresholds, state-specific church tax, Freibeträge, Sachsen/ Bayern care rate exceptions.

#### Rules Engine
- Generic condition evaluator (`eq`, `gt`, `in`, etc.)
- 4 preloaded German admin rules (Anmeldung, Krankenversicherung, Steuerklasse, Jobcenter)

**Limitation:** Rule set is tiny. No external config, no versioning, no rule editor.

#### Translation Service
- Static glossary of **8 terms** (Anmeldung, Bürgergeld, Krankenkasse, etc.)
- Search, lookup, and category browse modes
- Explanations in all 4 languages

**Limitation:** Not a real translation API. Needs 100+ terms for MVP usefulness.

#### Normalization Layer
- Helpers for income, household size, tax class, language, location

**Assessment:** Good abstraction boundaries; content and accuracy need major investment.

---

### 3. Feature Modules — Status Matrix

| Module | UI | API | Logic Depth | MVP Ready? |
|--------|----|-----|-------------|------------|
| **Financial Reality** | ✅ Form + results | ✅ | Medium — tax + Bürgergeld + decisions | ⚠️ Needs accuracy review |
| **System Translation** | ✅ Search UI | ✅ | Low — 8 static terms | ❌ Needs glossary expansion |
| **Healthcare Navigation** | ✅ Scenario picker | ✅ | Medium — 6 hardcoded scenario flows | ⚠️ Static content |
| **Grocery Optimization** | ✅ Budget form | ✅ | Low — generic shopping plan | ⚠️ No real price data |
| **Life Event** | ✅ Event picker | ✅ | Medium — 8 events, phased actions | ⚠️ Static content |

#### Module independence — ✅ Verified
- No cross-module imports
- Each module only depends on `@arrival-atlas/core` and `@arrival-atlas/shared-services`
- Replaceable without core changes

#### Module content localization — ❌ Not done
- Module **outputs** (decisions, steps, explanations) are **English only**
- UI chrome is translated; module intelligence is not

---

### 4. API Layer — ✅ Functional (Thin)

**Endpoints implemented:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| GET | `/api/modules` | List modules |
| GET | `/api/modules/:id` | Module metadata |
| POST | `/api/modules/:id/execute` | Run module |
| POST | `/api/sessions` | Create session |
| GET/PATCH | `/api/sessions/:id` | Read/update context |
| GET | `/api/i18n/languages` | Supported languages |
| GET | `/api/i18n/:lang` | UI translations |
| GET | `/api/events` | Event log (debug) |

**Missing:**
- Authentication / authorization
- Rate limiting
- Request validation middleware (relies on Zod inside registry)
- OpenAPI / Swagger spec
- Module schema introspection endpoint (`inputSchema` / `outputSchema` as JSON Schema)
- Admin endpoints for feature flags
- Database connection

---

### 5. Frontend — ✅ Usable Prototype

**Implemented:**
- Home page with module cards
- 5 module pages (form → API → results)
- Header with burger menu navigation
- Light / dark theme (localStorage + system preference)
- Language switcher (EN / DE / RU / UA)
- Responsive drawer menu
- Shared `ModuleLayout`, `ResultPanel`, `AppProvider`

**Missing:**
- Mobile layout polish for two-column module forms
- Error boundaries
- Loading skeletons
- Accessibility audit (ARIA partially done in header)
- User profile / onboarding flow
- Offline support
- SEO beyond basic metadata
- E2E tests

---

## What Works Well

1. **Architecture matches the vision** — modular, extensible, testable structure is real, not aspirational
2. **Strict module contracts** — Zod schemas enforce boundaries; bad input fails cleanly with 422
3. **Fast developer workflow** — monorepo builds in ~2s; hot reload on both API and web
4. **Decision-oriented outputs** — modules return `decisions`, `steps`, `reasoning` arrays, not raw data dumps
5. **Plugin registration** — adding a 6th module requires zero core/API changes
6. **i18n foundation** — 4-language UI infrastructure ready for content expansion

---

## Gaps & Risks

### Critical (blocks real-world use)

| Gap | Impact |
|-----|--------|
| No automated tests | Regressions undetectable; tax logic unverified |
| Inaccurate financial calculations | Users may make decisions on wrong numbers |
| No data persistence | Sessions, events, user context lost on restart |
| Module output not localized | RU/UA users get English guidance text |
| Static glossary (8 terms) | System Translation module not useful yet |

### Important (blocks production)

| Gap | Impact |
|-----|--------|
| No authentication | Cannot save user profiles or history |
| No PostgreSQL | Cannot store rules, glossary, or audit trail |
| No CI/CD pipeline | Manual deploy only |
| No input sanitization at API edge | Relies solely on Zod in registry |
| No logging/monitoring | No visibility in production |

### Nice-to-have (future)

| Gap | Impact |
|-----|--------|
| Redis caching | Performance at scale |
| Python rules engine | Complex admin logic |
| Event-driven architecture | Module chaining, async workflows |
| City-specific data | Localized Jobcenter, Bürgeramt info |

---

## Technical Debt

1. **Single-file API** — all routes in `apps/api/src/index.ts`; should split into route plugins
2. **Inline styles in React** — module pages use heavy inline `style={{}}`; should migrate to CSS modules or a component library
3. **Duplicated Stat component** — copy-pasted in financial and grocery pages
4. **Session created once on mount** — `AppProvider` doesn't update session when language changes
5. **Build order hardcoded** — root `package.json` build script manually sequences workspaces
6. **No shared ESLint/Prettier config** — inconsistent formatting risk as team grows
7. **README.pages** — legacy Apple Pages doc coexists with README.md

---

## Recommended Next Steps

### Phase 1 — Foundation Hardening (1–2 weeks)

**Goal:** Make the platform trustworthy and maintainable.

| # | Task | Priority |
|---|------|----------|
| 1 | Add **Vitest** unit tests for calculation engine, rules engine, and each module's `execute()` | P0 |
| 2 | Add API integration tests (supertest + Fastify inject) | P0 |
| 3 | Split API into route modules (`routes/modules.ts`, `routes/sessions.ts`) | P1 |
| 4 | Add ESLint + Prettier shared config | P1 |
| 5 | Expose `GET /api/modules/:id/schema` returning JSON Schema from Zod | P1 |
| 6 | Fix session sync — PATCH session when language/theme/profile changes | P2 |

---

### Phase 2 — MVP Depth (2–4 weeks)

**Goal:** Make Financial Reality and System Translation genuinely useful.

#### Financial Reality Module
| # | Task |
|---|------|
| 1 | Replace simplified tax logic with official **Lohnsteuer 2025** tables or verified library |
| 2 | Add Wohngeld, Kindergeld, Minijob (€556), Midijob thresholds |
| 3 | Localize all decision titles and reasoning strings (RU/UA/DE) |
| 4 | Add "explain this number" breakdown tooltips in UI |
| 5 | Validate outputs against 10+ known salary scenarios (test fixtures) |

#### System Translation Module
| # | Task |
|---|------|
| 1 | Expand glossary to **100+ terms** covering Jobcenter, Finanzamt, Krankenkasse domains |
| 2 | Store glossary in PostgreSQL with admin seed script |
| 3 | Add "related terms" graph navigation in UI |
| 4 | Category landing pages (`/modules/system-translation/administrative`) |

#### Shared
| # | Task |
|---|------|
| 1 | Wire **PostgreSQL** — sessions, events, glossary, rules |
| 2 | Localize module output via i18n keys or a `content/` JSON layer per module |
| 3 | Add user profile form (residency status, city, household) persisted in session |

---

### Phase 3 — Production Readiness (4–6 weeks)

**Goal:** Deployable, secure, observable system.

| # | Task |
|---|------|
| 1 | User authentication (email magic link or OAuth — keep lightweight) |
| 2 | Rate limiting + CORS hardening |
| 3 | Structured logging (pino → JSON) + health/readiness probes |
| 4 | Docker Compose (api + web + postgres) |
| 5 | CI pipeline (GitHub Actions: typecheck → test → build) |
| 6 | Staging deployment (Railway, Fly.io, or Hetzner) |
| 7 | OpenAPI spec auto-generated from Zod schemas |
| 8 | Mobile-responsive module layouts (single column on small screens) |

---

### Phase 4 — Platform Expansion (ongoing)

**Goal:** Life operating system vision.

| Area | Direction |
|------|-----------|
| Healthcare | City-specific provider lists, appointment booking links |
| Grocery | Real price integration (Open Food Facts, store APIs) |
| Life Events | Personalized timelines based on user profile + visa type |
| Rules engine | Extract to Python microservice for complex admin logic |
| Event architecture | Module completion events → trigger follow-up modules |
| New modules | Housing search, visa tracker, integration course finder |
| AI layer | Optional LLM for explanation enrichment (behind feature flag) |

---

## Priority Matrix

```
                    IMPACT
                 High    Low
              ┌─────────┬─────────┐
        High  │ Tax     │ ESLint  │
              │ accuracy│ Prettier│
   EFFORT     │ Tests   │         │
              │ Glossary│         │
              ├─────────┼─────────┤
        Low   │ PG      │ Redis   │
              │ session │ Python  │
              │ i18n    │ service │
              │ output  │         │
              └─────────┴─────────┘

Start here → Tax accuracy, Tests, Glossary expansion, PostgreSQL
```

---

## Suggested Immediate Action (This Week)

If picking **three tasks** to do next:

1. **Write tests for `calculateNetIncome()`** — lock in expected outputs for €1,500 / €2,500 / €4,000 gross at Steuerklasse I
2. **Expand glossary to 50 terms** — highest user-visible value for minimal architecture change
3. **Localize Financial Reality decision strings** — prove the pattern for module content i18n

---

## File Reference

| Path | Purpose |
|------|---------|
| `packages/core/src/types/index.ts` | Module + AppContext interfaces |
| `packages/core/src/registry/index.ts` | Module registry + execute pipeline |
| `packages/modules/src/*/index.ts` | Individual feature modules |
| `packages/shared-services/src/calculation/` | Tax & benefit math |
| `packages/shared-services/src/translation/` | Admin term glossary |
| `apps/api/src/index.ts` | REST API entry point |
| `apps/web/src/components/Header.tsx` | Navigation + theme |
| `apps/web/src/app/modules/*/page.tsx` | Module UI pages |

---

## Conclusion

Arrival Atlas v0.1.0 successfully proves the **modular decision-support architecture**. The platform can register modules, execute them with validated contracts, track events, and present results in a multilingual UI.

It is **not yet ready for real migrant decision-making** — financial calculations need verification, translation content is too thin, and nothing persists between sessions.

The path forward is clear: **harden → deepen MVP modules → persist → deploy**. The architecture does not need redesign; it needs content, accuracy, tests, and infrastructure.
