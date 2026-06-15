# Arrive Atlas Platform Architecture Audit

**Date:** June 2026  
**Auditor role:** Principal Platform Architect  
**Scope:** Full platform — Profile Engine, Execution Context Pipeline, Policy Layer, Financial Reality, Benefits Simulator, System Understanding Engine (proposed), Shared Services, Module Registry, API, Web  
**Status:** Audit only — **no implementation proposed**

**Related audits:**  
`docs/audits/financial-platform-readiness-audit.md`,  
`docs/audits/system-translation-v2.md`,  
`docs/audits/benefits-simulator-design.md`,  
`docs/audits/user-profile-engine-design.md`,  
`docs/audits/user-profile-engine-policy-layer-report.md`,  
`docs/audits/user-profile-engine-execution-trace-report.md`,  
`docs/audits/user-profile-engine-ui-contract-report.md`

---

## Executive Summary

Arrive Atlas has successfully evolved from a **single financial calculator** into a **modular decision platform** with a credible vertical slice: Profile Engine → Policy → Input Merge → Trace → Module execution, backed by a substantial Financial v2 engine and a thin Benefits Simulator orchestration layer.

That slice is **not yet a migrant operating system**. The platform can scale **within the financial/benefits corridor** with disciplined refactors. Scaling across Housing, Employment, Healthcare, and Knowledge as first-class domains will fail without structural changes — not because the module contract is wrong, but because **shared ownership, package boundaries, and cross-domain abstractions are immature**.

### Brutal bottom line

| Question | Answer |
|----------|--------|
| Can the current architecture scale to a multi-domain migrant OS? | **Conditionally — with a deliberate hybrid evolution, not as-is** |
| Is the module registry the right kernel? | **Yes** — keep it |
| Is `@arrivalos/shared-services` the right long-term home for domain logic? | **No** — it is already a monolith hiding domain boundaries |
| Is Profile Engine correctly positioned as platform infrastructure? | **Mostly yes — but it now imports financial code; that is a boundary violation** |
| Is event-driven architecture needed now? | **No for MVP; yes selectively at Beta for cross-module signals** |
| Recommended target | **D) Hybrid Architecture** — domain-bounded packages + existing module registry + selective async events |

### Platform readiness score: **52 / 100**

Scored against **multi-domain migrant OS scalability**, not against "does financial-reality work in dev." See §8.

---

## 1. Current Architecture Map

### 1.1 Package dependency graph

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              apps/web (Next.js)                          │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ HTTP
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         apps/api (Fastify monolith)                      │
│  build-app.ts: sessions, modules, profile routes, trace store (in-mem)   │
└───────┬─────────────────┬──────────────────────┬────────────────────────┘
        │                 │                      │
        ▼                 ▼                      ▼
┌───────────────┐  ┌──────────────┐      ┌─────────────────┐
│ @arrivalos/   │  │ @arrivalos/  │      │ @arrivalos/     │
│ modules (6)   │  │ profile      │      │ core            │
│ thin orch.    │  │ engine       │      │ types, registry │
└───────┬───────┘  └──────┬───────┘      │ session, events │
        │                 │               └────────▲────────┘
        │                 │                        │
        └────────┬────────┘                        │
                 │                                  │
                 ▼                                  │
        ┌────────────────────┐                     │
        │ @arrivalos/        │─────────────────────┘
        │ shared-services    │
        │ (monolithic grab-  │
        │  bag)              │
        └────────────────────┘
```

**Build order (hardcoded in root `package.json`):**  
`core → profile → shared-services → modules → api → web`

> **Finding P-01:** `profile` depends on `shared-services`, but build order places `profile` before `shared-services`. This works today only because workspace `*` resolution uses source, not build artifacts. It is fragile for packaging, CI caching, and future extraction.

### 1.2 Request execution path

```
POST /api/modules/:id/execute
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│ resolveExecutionContext(profileEngine, { moduleId, ... }) │
│   1. Load profile (in-memory store, session-bound)        │
│   2. applyProfilePolicy(moduleId, slice)                  │
│   3. buildExecutionContext → AppContext + profileSlice    │
│   4. mergeModuleInput(moduleId) → mergedInput + provenance│
│   5. collect ExecutionTrace                               │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
              ModuleRegistry.execute(id, mergedInput, context)
                            │
                            ▼
              module.execute() → shared-services / static content
```

**Single entry point preserved:** `resolveExecutionContext()` is the correct platform seam. Trace and UI contract layers attach cleanly.

### 1.3 Module inventory vs domain maturity

| Module ID | Domain(s) | Implementation depth | Profile policy | Input merge config |
|-----------|-----------|---------------------|:--------------:|:------------------:|
| `financial-reality` | Financial, Employment, Housing (rent) | **Engine-backed** (v2 pipeline + legacy tax) | ✅ Registered | ✅ `MODULE_INPUT_CONFIG` |
| `benefits-simulator` | Financial, Benefits | **Orchestration** over shared financial | ✅ Registered | ⚠️ Special-case branch + `benefits-simulator-input-merge.ts` |
| `system-translation` | Knowledge | **Static glossary** (8 terms) | ❌ Default only | ❌ None |
| `healthcare-navigation` | Healthcare | **Static scenario scripts** | ✅ Registered | ✅ Partial |
| `life-event` | Cross-domain (orchestration-like) | **Static phase checklists** | ❌ Default only | ❌ None |
| `grocery-optimization` | Lifestyle / cost-of-living | **Static heuristics** | ❌ Default only | ❌ None |

**Pattern split:** Two engine modules, four content modules. The platform treats them identically in the registry — which is good for uniformity, bad for governance (content modules ship without policy, merge, or fixtures).

### 1.4 Shared services inventory

| Path | Intended domain | Actual role today | Consumers |
|------|-----------------|-------------------|-----------|
| `shared-services/financial/` | Financial + Benefits | **Primary domain engine** — payroll, Bürgergeld, pipeline, simulator | `financial-reality`, `benefits-simulator`, **`profile` (input merge)** |
| `shared-services/calculation/` | Financial (legacy) | **Parallel v1 tax path** — still used by Financial Reality | `financial-reality` only |
| `shared-services/translation/` | Knowledge | Flat glossary store | `system-translation` |
| `shared-services/rules/` | Cross-cutting | Generic rules engine + hardcoded German admin rules | **Unused by modules** |
| `shared-services/normalization/` | Cross-cutting | Data normalization helpers | **Minimal / unused** |

There is **no** `shared-services/profile`, `housing`, `employment`, or `healthcare` package — those concerns are fragmented across profile document fields, financial engine, and static module content.

### 1.5 Context model (dual heritage)

`AppContext` still carries legacy shapes alongside the new profile engine:

| Field | Era | Used by |
|-------|-----|---------|
| `userProfile` (4 fields) | Legacy | `system-translation`, `healthcare-navigation` (language) |
| `systemState` (untyped records) | Legacy | `financial-reality` (insurance, benefits days) |
| `profileSlice`, `profileVersion`, `dataProvenance` | Profile Engine | Policy-aware modules via merge pipeline |
| `sessionId`, `profileId` | Runtime | API + trace store |

The context builder bridges both worlds. This is **technical debt with a purpose** (backward compatibility), but it creates **two truths** for the same facts (e.g. income in `userProfile.income` vs `profile.employment.grossMonthlyIncome`).

### 1.6 Event system (observability only)

`@arrivalos/core/events` provides in-memory `trackEvent()` for:

- `module.registered`, `module.execute.start|success|error`
- Session-less, not durable, not consumed by other modules

Events are **telemetry hooks**, not an orchestration bus. No pub/sub, no sagas, no domain events.

---

## 2. Domain Boundary Analysis

### 2.1 Profile

**Ownership today:** `@arrivalos/profile` — engine, policy registry, trace, UI contract, in-memory store.

| Strength | Weakness |
|----------|----------|
| Single execution entry (`resolveExecutionContext`) | Depends on `@arrivalos/shared-services` for benefits-simulator merge |
| Module-scoped policy with sensitive-field redaction | Only 3 of 6 modules have explicit policies |
| Versioned `ProfileDocument` + revision conflict | In-memory only; lost on API restart |
| UI contract isolation (`UIProfileResponse`) | Legacy `AppContext` fields still populated and read |

**Boundary verdict:** Profile is **platform infrastructure**, not a user-facing domain. It should remain domain-agnostic. Importing `buildHouseholdFromLegacy` and `resolveEmploymentsForLegacyInput` from financial shared services **violates that boundary** and will compound as Housing and Employment modules add their own merge rules.

### 2.2 Financial

**Ownership today:** `shared-services/financial/` (engine) + `modules/financial-reality` (adapter/orchestrator) + legacy `shared-services/calculation/`.

| Strength | Weakness |
|----------|----------|
| Richest domain model (household, employment, payroll, benefits pipeline) | Dual v1/v2 calculation paths |
| Benefits Simulator correctly delegates here | Financial Reality still calls `calculateNetIncome` (v1) alongside v2 pipeline |
| 31+ unit tests, routing regression suite | Comparator, decision engine, analysis layer undertested |
| Scenario grid + event transform for simulator | "Financial" package also owns benefits eligibility math — naming blurs Benefits domain |

**Boundary verdict:** Financial is the **only production-grade domain**. It is absorbing Benefits computation that users perceive as a separate product surface.

### 2.3 Benefits

**Ownership today:** Split three ways:

1. `shared-services/financial/benefits/` — eligibility and Bürgergeld math  
2. `modules/benefits-simulator` — scenario orchestration  
3. `ProfileDocument.benefits` slice — state capture  

| Strength | Weakness |
|----------|----------|
| Clear product separation at module layer | No independent benefits domain package |
| Golden fixtures (12 scenarios) at module boundary | Benefits merge logic lives in profile package, not benefits domain |
| Reuses financial engine — no duplicate math | Users cannot tell whether "Benefits" is a module or a subsystem of Financial |

**Boundary verdict:** Benefits is a **product domain riding on Financial infrastructure**. Acceptable for MVP if documented. **Not acceptable** for a migrant OS where Benefits triggers cross-domain obligations (housing recalculation, Meldepflicht, healthcare co-payments) without an explicit domain contract.

### 2.4 Knowledge

**Ownership today:** `shared-services/translation/` + `modules/system-translation` + proposed System Understanding Engine (SUE) in `docs/audits/system-translation-v2.md`.

| Strength | Weakness |
|----------|----------|
| Multilingual foundation (DE/EN/RU/UA) | 8-term glossary — not a knowledge system |
| Clean module boundary | No graph model, no versioning, no content pipeline |
| SUE v2 design aligns with platform patterns | **Zero implementation**; no bridge from Benefits Simulator outputs |
| Category taxonomy maps to other domains | `rules/` engine unused — missed opportunity for obligation rules |

**Boundary verdict:** Knowledge is **aspirational**. The platform has no knowledge domain yet — only a dictionary module. SUE cannot integrate without a dedicated knowledge service boundary and typed cross-module signals.

### 2.5 Housing

**Ownership today:** `ProfileDocument.housing` fields + financial engine rent inputs (KdU) + life-event static checklists mentioning Anmeldung/Wohnung.

| Strength | Weakness |
|----------|----------|
| Rent captured in profile for financial merge | **No housing module**, no shared housing service |
| KdU affects benefits calculations | Housing rules embedded in financial benefits engine |
| Life-event covers "move-city" narratively | No Mietpreisbremse, Kaution, Nebenkosten, or registration-address logic |

**Boundary verdict:** Housing is **a data slice consumed by Financial**, not a domain. For a migrant OS, housing is load-bearing (address → registration → benefits → healthcare → employment commute). Treating it as `housing.monthlyColdRent` on a profile document will not scale.

### 2.6 Employment

**Ownership today:** `ProfileDocument.employment` + `shared-services/financial/` employment classification + life-event job-change scripts + financial forms.

| Strength | Weakness |
|----------|----------|
| Employment classification engine (Minijob/Midijob/regular) | No employment module |
| Profile merge for financial and benefits-simulator | Arbeitnehmer vs freelancer vs student not modeled as first-class |
| Life-event covers job-loss / job-change | Life-event does not call financial or benefits engines — static only |

**Boundary verdict:** Employment is **financial sub-domain + static content**, not an autonomous domain. Work permit, notice periods, ALG I vs Bürgergeld transitions, and Minijob disclosure obligations need a domain home.

### 2.7 Healthcare

**Ownership today:** `modules/healthcare-navigation` (static) + `ProfileDocument.insurance` + `systemState.insurance` (legacy).

| Strength | Weakness |
|----------|----------|
| Scenario-based output (steps, decisions, warnings) | No integration with financial GKV costs or benefits co-payments |
| Partial profile merge (city, insurance) | Static content — no Krankenkasse comparison, no TK/AOK data |
| Policy registered | Dual read path: profile slice + legacy `systemState` in financial-reality |

**Boundary verdict:** Healthcare is a **content module with profile hooks**, not a healthcare domain. It cannot answer "given my Bürgergeld and Minijob, which insurance obligations apply?" without cross-domain orchestration that does not exist.

### 2.8 Domain boundary summary matrix

| Domain | Declared owner | Actual owner | Maturity (0–5) | Blocks multi-domain OS? |
|--------|----------------|--------------|:--------------:|:-----------------------:|
| Profile | `@arrivalos/profile` | Profile Engine | **4** | ⚠️ If financial coupling grows |
| Financial | `shared-services/financial` | Shared Services | **4** | No — anchor domain |
| Benefits | `modules/benefits-simulator` | Financial engine + profile merge | **3** | ⚠️ Naming + cross-domain triggers |
| Knowledge | (proposed SUE) | Translation glossary | **1** | **Yes** — no graph, no bridges |
| Housing | (none) | Profile field + financial KdU | **1** | **Yes** — no domain |
| Employment | (none) | Financial classification + life-event | **2** | **Yes** — fragmented |
| Healthcare | `modules/healthcare-navigation` | Static module | **2** | ⚠️ Until cross-domain needed |

---

## 3. Shared Services Ownership Analysis

### 3.1 Duplicated responsibilities

| Responsibility | Location A | Location B | Severity |
|----------------|------------|------------|----------|
| Net income / tax calculation | `calculation/` (v1) | `financial/payroll/` (v2) | **High** — Financial Reality uses both |
| Benefits awareness | `financial/benefits/` | `rules/germanAdminRules` | Medium — rules engine orphaned |
| Insurance state | `profile.insurance` | `AppContext.systemState.insurance` | **High** — dual truth |
| Employment status | `profile.employment` | `systemState.employmentStatus` | **High** — dual truth |
| Life scenario guidance | `life-event` module | SUE (proposed) | Medium — future overlap |
| Translation / knowledge | `translation/` | Module static strings (healthcare, life-event) | Medium — no single content pipeline |
| Input merge / profile hydration | `input-merger.ts` config | Per-module `benefits-simulator-input-merge.ts` | **High** — scaling anti-pattern |

### 3.2 Hidden coupling

| Coupling | Mechanism | Risk |
|----------|-----------|------|
| **Profile → Financial** | `benefits-simulator-input-merge.ts` imports household/employment builders | Profile package cannot ship without financial engine; violates platform layering |
| **API → Profile → Modules** | `build-app.ts` owns trace store, profile runtime singleton | Trace and profile lifecycle tied to API process |
| **Financial Reality → legacy context** | Reads `systemState.insurance`, `systemState.benefits` | New profile slices ignored for some fields |
| **Benefits Simulator → Financial Reality semantics** | Shared employment classification | Correct reuse, but product boundaries invisible to consumers |
| **Build order vs dependency** | profile listed before shared-services | CI/publish footgun |

### 3.3 Circular dependency risk

**Current graph (acyclic):**

```
core ← shared-services ← modules
         ↑
       profile ← api
```

**No circular dependency today.**  

**Imminent cycle if:**

1. `shared-services/financial` imports profile types for personalization, **or**
2. Knowledge service imports module outputs directly instead of via platform signals, **or**
3. Modules import each other (currently **zero** cross-module imports — good)

The **profile → shared-services** edge is the dangerous precedent. One more domain-specific merge file and Profile becomes a second modules package.

### 3.4 Future scalability risks

| Risk | Trigger | Impact |
|------|---------|--------|
| `input-merger.ts` god-object | Each new module adds config + special-case `if (moduleId === ...)` | Merge logic untestable; profile team becomes bottleneck |
| `shared-services` monolith | Housing, employment, healthcare engines added as folders | Unclear ownership; build times; fear of change |
| Content modules without governance | New static modules ship without policy/merge/fixtures | Privacy leaks; inconsistent UX |
| In-memory everything | Production deploy | No profile durability; trace loss; no horizontal scale |
| Legacy `AppContext` persistence | Web client still sends old shapes | Split-brain profile state |
| Single API monolith | Domain teams grow | Release coupling; blast radius |
| Knowledge graph in-process | SUE M1 as TS arrays | No content ops; no non-dev editors |

### 3.5 Missing platform abstractions

| Abstraction | Status | Needed for |
|-------------|--------|------------|
| **Domain service ports** (interfaces in core/profile) | ❌ Missing | Decouple profile merge from financial implementations |
| **Domain event contract** | ❌ Missing | Benefits change → knowledge obligations → life-event checklist |
| **Content / knowledge repository port** | ❌ Missing | SUE, healthcare, life-event content at scale |
| **Cross-module signal schema** | ❌ Missing | Simulator `riskWarnings` → SUE concept activation |
| **Unified profile field registry** | ⚠️ Per-module policy lists | Schema evolution without policy drift |
| **Persistence ports** (profile, trace, events) | ⚠️ Profile store port exists; in-memory only | Beta |
| **Domain package boundaries** | ❌ Missing | Independent team ownership |
| **Module capability tiers** | ❌ Missing | Distinguish engine vs content vs orchestrator modules |

---

## 4. Architectural Evaluation

### 4.1 Module architecture

**What works**

- Uniform `Module.execute(input, context)` contract in `@arrivalos/core`
- `ModuleRegistry` with enablement, feature flags, validation, execution telemetry
- No direct module-to-module imports
- Benefits Simulator demonstrates **thin orchestration** pattern correctly

**What does not scale**

- All modules registered in one `allModuleRegistrations` array — no domain grouping or lazy loading
- Content modules (healthcare, grocery, life-event) lack the engineering rigor applied to financial modules
- `life-event` behaves like a **cross-domain orchestrator** but is implemented as isolated static JSON — architectural lie
- No module versioning strategy beyond semver string on registration

**Verdict:** Module architecture is **sound kernel, uneven population**. Keep registry; add governance tiers.

### 4.2 Execution pipeline

**What works**

- `resolveExecutionContext()` as single front door
- Policy → context build → merge → trace ordering is correct
- Provenance tracking started
- API does not bypass pipeline

**What does not scale**

- Merge configuration centralized in profile package with module-specific branches
- Trace stored in `apps/api/execution-trace-store.ts`, not behind a port in profile
- No async/long-running execution model (acceptable for MVP)
- No idempotency keys or execution replay

**Verdict:** Pipeline is **MVP-ready for synchronous request/response**. It is not yet a **platform pipeline** — it is a **financial pipeline with hooks for other modules**.

### 4.3 Profile integration model

**What works**

- `ProfileDocument` richer than legacy `UserProfile`
- Module-scoped policy with extension namespaces
- UI contract stripped of engine internals
- Revision conflict detection

**What does not scale**

- Profile depends on financial shared services
- 50% of modules use default policy (language only)
- Legacy context fields still written and read
- No federated profile slices per domain (single document)

**Verdict:** Profile integration is **the right idea, wrong dependency direction** for benefits merge. Invert dependency via ports.

### 4.4 Event-driven possibilities

**Today:** Fire-and-forget in-memory telemetry.

**Viable event-driven use cases (Beta+, not MVP):**

| Event | Publisher | Subscriber(s) | Value |
|-------|-----------|---------------|-------|
| `benefits.scenario.completed` | Benefits Simulator | SUE, Life Event | Obligation surfacing |
| `profile.employment.changed` | Profile Engine | Financial, Benefits, Employment | Stale scenario invalidation |
| `financial.verdict.computed` | Financial Reality | SUE, Healthcare | Contextual explanations |
| `knowledge.concept.viewed` | SUE | Analytics, Profile (optional) | Learning path |

**Not recommended now:** Full event-sourced core, CQRS, or async-only module execution. Request/response remains correct for deterministic calculators.

**Verdict:** **Selective domain events at Beta** — not a rewrite.

### 4.5 Knowledge graph integration

Per `system-translation-v2.md`, SUE requires:

- Concept graph storage (not in `translation/` shape)
- Typed edges (requires, affects, reported-to)
- Scenario binding from structured module outputs
- Profile-aware filtering

**Current platform gaps for SUE:**

| SUE need | Platform state |
|----------|----------------|
| Graph storage | ❌ |
| Content versioning | ❌ |
| Cross-module input (simulator warnings) | ❌ No signal schema |
| Profile policy for knowledge | ❌ |
| Merge config | ❌ |

**Verdict:** SUE **cannot integrate** without a knowledge domain package and a **cross-module signal contract**. Bolting graph onto `translation/` inside `shared-services` repeats the financial monolith mistake.

### 4.6 Long-term maintainability

| Factor | Score | Notes |
|--------|:-----:|-------|
| Code clarity within financial vertical | 7/10 | Well-structured subfolders |
| Package cohesion | 4/10 | `shared-services` is a junk drawer |
| Test discipline | 6/10 | Strong financial; weak elsewhere |
| Documentation / audits | 8/10 | Excellent design docs; implementation lags |
| Repo hygiene | 5/10 | Duplicate `engine 2/`, `policy 2/` dirs in profile |
| Operational readiness | 3/10 | In-memory, no auth, single process |
| Team scalability | 4/10 | One bottleneck package; merge conflicts inevitable |

**Verdict:** Maintainable **as a focused financial product**. Maintainability **degrades rapidly** if 3+ domains add engines into `shared-services` without repackaging.

---

## 5. Architecture Options

### Option A — Independent Modules

**Description:** Keep current package layout. Each module owns its logic; shared-services grows organically; profile merge accumulates per-module config.

| Dimension | Assessment |
|-----------|------------|
| **Advantages** | Lowest friction; preserves today's mental model; fast feature modules; module registry already works |
| **Disadvantages** | `shared-services` becomes undeletable monolith; profile merge becomes god-file; domain teams step on each other; knowledge/financial/housing entangled |
| **Migration cost** | **Low** (status quo) |
| **Operational complexity** | **Low** short-term, **high** by Beta (undebuggable cross-domain bugs) |

**Fit:** Solo/small team, financial-only product. **Poor fit** for migrant OS vision.

---

### Option B — Domain-Driven Platform

**Description:** Split into domain packages: `@arrivalos/domain-financial`, `@arrivalos/domain-knowledge`, `@arrivalos/domain-healthcare`, etc. Profile and core remain platform layers. Modules become thin API adapters per domain.

| Dimension | Assessment |
|-----------|------------|
| **Advantages** | Clear ownership; independent versioning; profile stays agnostic via ports; housing/employment get real homes; aligns with organizational scaling |
| **Disadvantages** | Upfront package extraction; need domain boundary discipline; cross-domain workflows still need explicit design |
| **Migration cost** | **Medium–High** — extract `financial/` first, then knowledge; 4–8 weeks engineering for boundaries (not features) |
| **Operational complexity** | **Medium** — more packages, clearer deploy units later |

**Fit:** Strong foundation for multi-domain OS. Does not solve async cross-domain by itself.

---

### Option C — Event-Driven Platform

**Description:** Modules publish domain events to a bus; orchestrators subscribe; profile updates via events; eventual consistency across domains.

| Dimension | Assessment |
|-----------|------------|
| **Advantages** | Loose coupling; natural for life-event orchestration; scales to notifications and background recalculation |
| **Disadvantages** | Overkill for deterministic calculators; debugging harder; requires idempotency, DLQ, schema registry; team must operate event infra |
| **Migration cost** | **High** — event bus, schemas, replay, migration from sync API |
| **Operational complexity** | **High** — monitoring, ordering, failure recovery |

**Fit:** Beta+ for **cross-domain side effects**, not as the primary execution model.

---

### Option D — Hybrid Architecture (Recommended)

**Description:** Domain-Driven packages (B) + existing synchronous `ModuleRegistry` execution + **selective domain events** (C) for cross-module signals at Beta. Profile and core remain shared platform kernel.

```
┌─────────────────────────────────────────────────────────────┐
│                    Platform Kernel (@arrivalos/core)         │
│         ModuleRegistry · AppContext · Session · EventPort    │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────┐
│              Platform Services (@arrivalos/profile)          │
│    resolveExecutionContext · Policy · Trace · UI Contract    │
│    Merge orchestration (module plugins via ports, not imports)│
└────────────────────────────┬────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ domain-       │   │ domain-       │   │ domain-       │
│ financial     │   │ knowledge     │   │ healthcare    │
│ (+ benefits)  │   │ (SUE graph)   │   │ (future)      │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                   ┌─────────────────┐
                   │ modules (thin)   │
                   │ + event emitters │
                   └─────────────────┘
```

| Dimension | Assessment |
|-----------|------------|
| **Advantages** | Keeps what works (registry, sync execute); fixes package boundaries; enables SUE + life-event orchestration without rewrite; incremental migration |
| **Disadvantages** | Two integration styles (sync + events) to govern; requires port discipline; temporary duplication during extraction |
| **Migration cost** | **Medium** — phased extraction over MVP→Beta |
| **Operational complexity** | **Medium** — bounded; event infra only where cross-domain needed |

**Fit:** **Best match** for Arrive Atlas migrant OS trajectory.

---

## 6. Future Architecture Map

### 6.1 Target state (Beta horizon)

```
┌──────────┐     ┌──────────────────────────────────────────────────┐
│ Web UI   │────►│ API Gateway (auth, rate limit, session)          │
└──────────┘     └────────────┬─────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Profile Service │  │ Module Executor │  │ Trace / Audit   │
│ (persisted)     │  │ (registry)      │  │ (persisted)     │
└────────┬────────┘  └────────┬────────┘  └─────────────────┘
         │                    │
         │         ┌──────────┴──────────┐
         │         ▼                     ▼
         │  ┌─────────────┐      ┌─────────────┐
         │  │ Sync path   │      │ Event bus   │
         │  │ execute()   │      │ (domain     │
         │  └──────┬──────┘      │  signals)   │
         │         │             └──────┬──────┘
         ▼         ▼                    ▼
┌────────────────────────────────────────────────────────────┐
│ Domain Layer                                                │
│  financial (+ benefits engine) │ knowledge (graph)         │
│  employment (classification +  │ healthcare (content +    │
│   work-rights rules)           │   policy rules)           │
│  housing (rent law + KdU caps) │                           │
└────────────────────────────────────────────────────────────┘
```

### 6.2 Domain-to-package target mapping

| Domain | Target package | Module adapter |
|--------|----------------|----------------|
| Profile (platform) | `@arrivalos/profile` | — |
| Financial | `@arrivalos/domain-financial` | `financial-reality` |
| Benefits (product) | `@arrivalos/domain-financial/benefits` + `modules/benefits-simulator` | `benefits-simulator` |
| Knowledge | `@arrivalos/domain-knowledge` | `system-understanding` (evolved) |
| Healthcare | `@arrivalos/domain-healthcare` | `healthcare-navigation` |
| Housing | `@arrivalos/domain-housing` | new module (future) |
| Employment | `@arrivalos/domain-employment` | new module or life-event split |
| Cross-domain narratives | `@arrivalos/domain-orchestration` | `life-event` (subscriber) |

### 6.3 Cross-domain signal flow (Beta)

```
Benefits Simulator execute()
        │
        ├─► sync response to client
        │
        └─► emit benefits.scenario.completed { warnings, events[], household }
                    │
                    ├─► Knowledge: activate concepts (Bürgergeld, Minijob, Meldepflicht)
                    └─► Life Event: refresh checklist items
```

Sync path unchanged. Events are **side-effect channel**, not execution path.

---

## 7. Recommended Target Architecture

**Choose Option D — Hybrid Architecture.**

### 7.1 Non-negotiable principles

1. **Keep `ModuleRegistry` and `AppContext`** — they are the stable product API.
2. **Keep `resolveExecutionContext()`** as the single profile→execution seam.
3. **Invert profile merge dependencies** — domain packages register merge strategies; profile orchestrates.
4. **Extract `domain-financial` first** — highest value, highest risk if left in monolith.
5. **Establish `domain-knowledge` before SUE M1** — do not grow `translation/` further.
6. **Retire legacy `AppContext.userProfile` / `systemState` reads** on a published timeline.
7. **Classify modules** as Engine | Orchestrator | Content — different governance rules each.
8. **Introduce domain events at Beta** only for cross-module signals, not calculator internals.

### 7.2 What not to do

- Do not rewrite around a message bus for MVP.
- Do not add Housing/Employment as folders inside `shared-services/financial/`.
- Do not implement SUE as a 500 KB TypeScript array in the module.
- Do not let `life-event` remain a pseudo-orchestrator without engine subscriptions.

---

## 8. Critical Refactors

### 8.1 Before MVP (supervised alpha)

Priority is **boundary integrity and financial trust**, not new domains.

| ID | Refactor | Rationale | Domain |
|----|----------|-----------|--------|
| MVP-R1 | **Remove profile → shared-services import** — introduce merge strategy port registered by benefits-simulator domain | Stops platform layer contamination | Profile / Benefits |
| MVP-R2 | **Register policies for all modules** or explicitly mark content modules as `policyExempt` with documented reason | Prevents silent PII exposure | Profile |
| MVP-R3 | **Single context truth** — financial-reality reads profile slices, not `systemState` | Eliminates dual truth | Financial |
| MVP-R4 | **Deprecate `calculation/` v1 path** in Financial Reality or isolate behind explicit `legacyMode` flag | Dual tax paths are latent bugs | Financial |
| MVP-R5 | **Fix build order** — `shared-services` before `profile`, or remove profile's dependency on shared-services (preferred) | CI/publish correctness | Platform |
| MVP-R6 | **Delete duplicate profile source dirs** (`engine 2/`, `policy 2/`, `trace 2/`) | Repo hygiene | Platform |
| MVP-R7 | **Module capability metadata** — `tier: engine \| orchestrator \| content` on registration | Governance | Core |
| MVP-R8 | **Persist profile store** behind existing port (PostgreSQL adapter) | Alpha users lose data on restart | Profile |
| MVP-R9 | Complete financial P0 items per `financial-platform-readiness-audit.md` | User safety | Financial |

### 8.2 Before Beta (broader migrant OS)

| ID | Refactor | Rationale | Domain |
|----|----------|-----------|--------|
| BETA-R1 | **Extract `@arrivalos/domain-financial`** from `shared-services` | Domain ownership | Financial |
| BETA-R2 | **Create `@arrivalos/domain-knowledge`** + SUE M0 graph store | Knowledge domain exists | Knowledge |
| BETA-R3 | **Cross-module signal schema** in core (`PlatformSignal` envelope) | SUE + life-event integration | Platform |
| BETA-R4 | **Selective event bus** (in-process → Redis/NATS later) for domain signals | Cross-domain side effects | Platform |
| BETA-R5 | **Extract housing domain** — KdU rules move out of financial benefits | Housing is not financial subfolder | Housing |
| BETA-R6 | **Extract employment domain** — classification + work-rights | Employment obligations | Employment |
| BETA-R7 | **Healthcare domain service** — replace static-only module | GKV/PKV rules evolve | Healthcare |
| BETA-R8 | **Merge plugin registry** replaces `MODULE_INPUT_CONFIG` god-object | N modules without profile bloat | Profile |
| BETA-R9 | **Retire legacy `AppContext` fields** | Single profile truth | Platform |
| BETA-R10 | **AuthN + tenant/session hardening** | Production | API |
| BETA-R11 | **Persist execution trace** behind port | Support/debug at scale | Profile |
| BETA-R12 | **Content pipeline** for knowledge/healthcare/life-event (versioned data, not code) | Non-dev content ops | Knowledge |

---

## 9. Architectural Risk Matrix

| ID | Risk | Likelihood | Impact | Current mitigation | Residual risk |
|----|------|:----------:|:------:|-------------------|:-------------:|
| AR-01 | Profile becomes second modules package via merge sprawl | **High** | **High** | None — benefits merge already special-cased | **Critical** |
| AR-02 | `shared-services` monolith unmaintainable at 4+ domains | **High** | **High** | Financial subfolder structure | **High** |
| AR-03 | Dual AppContext truths cause wrong financial verdicts | **Medium** | **High** | Partial profile migration | **High** |
| AR-04 | v1/v2 tax path divergence | **Medium** | **High** | Tests on v2 path | **Medium** |
| AR-05 | SUE built inside translation/ without domain boundary | **Medium** | **Medium** | Design doc only | **Medium** (if ignored) |
| AR-06 | Content modules leak PII without policy | **Medium** | **High** | 3/6 policies registered | **High** |
| AR-07 | In-memory profile loss on deploy | **High** | **Medium** | Port exists | **High** for alpha |
| AR-08 | Life-event promised cross-domain orchestration, delivers static text | **High** | **Medium** | None | **Medium** |
| AR-09 | Benefits/Financial naming confusion for users and team | **Medium** | **Low** | Design docs | **Low** |
| AR-10 | No auth — profile ID spoofing | **High** (if exposed) | **High** | Session header only | **Critical** (public) |
| AR-11 | Event bus over-adoption too early | **Low** | **Medium** | N/A | **Low** if hybrid discipline held |
| AR-12 | Build order / dependency inversion breaks publish | **Medium** | **Medium** | Works in dev workspace | **Medium** |

---

## 10. Platform Readiness Score

**Overall: 52 / 100** — *"Strong financial vertical prototype; not yet a multi-domain platform."*

### 10.1 Score breakdown

| Dimension | Weight | Score | Weighted |
|-----------|:------:|:-----:|:--------:|
| Core module contract & registry | 10% | 78 | 7.8 |
| Profile engine (design & pipeline) | 15% | 70 | 10.5 |
| Financial domain depth | 15% | 68 | 10.2 |
| Benefits product clarity | 10% | 55 | 5.5 |
| Knowledge domain | 10% | 18 | 1.8 |
| Healthcare domain | 8% | 25 | 2.0 |
| Housing domain | 7% | 15 | 1.1 |
| Employment domain | 7% | 40 | 2.8 |
| Shared services hygiene | 8% | 38 | 3.0 |
| Cross-domain integration | 10% | 20 | 2.0 |
| Operational readiness (persist, auth, ops) | 10% | 22 | 2.2 |
| **Total** | **100%** | — | **49.9 → 52** (rounded with test/doc quality bonus +3) |

### 10.2 Score interpretation

| Range | Meaning |
|-------|---------|
| 80–100 | Production migrant OS platform |
| 60–79 | Beta-ready multi-domain platform with known gaps |
| 40–59 | **← Arrive Atlas is here** — credible single-domain platform, multi-domain needs structural work |
| 20–39 | Prototype |
| 0–19 | Demo |

### 10.3 What the score is not

- **Not** a financial calculator score — financial alone would rate ~68.
- **Not** a code quality score — code within financial is good.
- **Is** a honest answer to: *"Can we bolt on Housing, Employment, Healthcare, and Knowledge without rewriting?"* — **not safely today**.

---

## 11. Conclusion

Arrive Atlas has made the **right foundational bets**: module registry, typed execution context, profile engine with policy and trace, and financial engine depth. The Benefits Simulator proves the **orchestrator-over-domain-engine** pattern works.

The platform **will not scale** to a multi-domain migrant operating system if development continues on the current trajectory — especially profile importing financial code, `shared-services` absorbing every new domain, and content modules shipping without platform governance.

**Evolve toward Hybrid Architecture (D):** domain-bounded packages, preserved synchronous module execution, merge strategy plugins instead of profile special-cases, and selective domain events at Beta for knowledge and life-event orchestration.

The gap is **organizational structure in code**, not vision. The audits and design documents are ahead of the repository layout. Closing that gap is the critical path — not more modules.

---

*End of audit. No implementation proposed.*
