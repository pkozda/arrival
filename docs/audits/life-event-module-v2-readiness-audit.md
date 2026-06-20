---
id: life-event-module-v2-readiness-audit
title: Life Event Module v2 — Readiness Audit
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: life-events
status: active
maturity: stable
owner: system
tags:
  - life-event
  - readiness
  - business-delivery
created: 2026-06-20
updated: 2026-06-20
depends_on:
  - life-event-module-v2
  - life-state-model
  - life-event-classifier-fixtures
  - life-event-graph-catalog-v1
related:
  - life-event-module-v2-roadmap
  - life-event-module-v2-spec
  - life-event-graph-catalog-v1
  - platform-architecture-audit
  - profile-ux-discovery
---

# Life Event Module v2 — Readiness Audit

> **Supersession note (2026-06-20):** This audit reflects pre-implementation estimates. LE-1–LE-5 are now complete (including ActionSurface LE-4 and AEAL LE-5). Phase numbering in this document uses the **original** roadmap labels — see [ADR-003](../adr/adr-003-le-layer-realignment.md) and the [realigned roadmap](../life-events/life-event-module-v2-roadmap.md) for canonical LE phases.

**Date:** 2026-06-20 (updated post hardening pass)  
**Scope:** Готовность к бизнес-реализации v2 в существующем модуле `life-event`  
**Framing:** Адаптация модуля, не новый platform layer  
**Spec:** [life-event-module-v2-spec.md](../life-events/life-event-module-v2-spec.md)

---

## Executive Summary

Платформа **готова** для реализации Life Event Module v2 как бизнес-задачи. P1–P4 дают всё необходимое: authoritative profile, correction flow, interpretation hints. Модуль `life-event` уже зарегистрирован, имеет богатый scenario content и маршрут `/modules/life-event`.

**Главный gap — не архитектура, а реализация:** модуль игнорирует профиль, не имеет plan API и dedicated UI. Это инженерная работа внутри `packages/modules/src/life-event/`, а не новый системный слой.

### Gate verdict (platform)

| Dimension | Score | Verdict |
|-----------|-------|---------|
| Platform prerequisites (P1–P4) | **90/100** | ✅ Ready |
| Module scaffold exists | **85/100** | ✅ Ready |
| Scenario content (business asset) | **75/100** | ✅ Ready — needs extraction |
| Profile integration | **15/100** | ❌ v1 ignores context — **LE-1 work** |
| Plan API + UI | **10/100** | ❌ Not built — **LE-2–LE-3** |
| Home as plan owner | **20/100** | ❌ **LE-4** |
| Test patterns to copy | **85/100** | ✅ P4 + module tests |

> Platform verdict unchanged. **Design readiness** (below) is the LE-1 gate.

---

## 1. What We Have (Assets)

### 1.1 Module registration ✅

```text
packages/modules/src/life-event/index.ts
  id: 'life-event'
  category: 'life-events'
  route: /modules/life-event (generic ContractModulePage)
  catalog: registered in catalog.ts
```

### 1.2 Rich scenario content ✅

8 event types with phased actions, scenarios, checklists:

| Event | Business value |
|-------|----------------|
| `arrival` | Anmeldung, insurance, banking — core newcomer flow |
| `job-change` / `job-loss` | Employment transitions |
| `marriage` / `divorce` / `childbirth` | Family events |
| `move-city` / `visa-renewal` | Relocation admin |

~330 lines — **готовый business content**, нужно структурировать, не переписывать с нуля.

### 1.3 Platform read models ✅

| API | Use in v2 |
|-----|-----------|
| `GET /api/user-context` | Plan classifier input |
| `GET /api/profile-insights` | Hints (LE-5) |
| `POST /api/modules/life-event/execute` | Scenario mode (existing) |
| `GET /api/modules/:id/explain` | Pattern for `…/plan` endpoint |

### 1.4 Profile domain coverage ✅

All classifier signals available in `UserContextV1`:

| Signal | Domain | Available |
|--------|--------|-----------|
| Location / rent | `housing` | ✅ |
| Employment | `employment` | ✅ |
| Income | `income` | ✅ |
| Insurance | `healthInsurance` | ✅ |
| Benefits | `benefits` | ✅ |
| Migration | `migration` | ✅ |
| Household | `household` | ✅ |

### 1.5 P3 correction routes ✅

`LifeActionRef.correct_in_profile` → `/profile/[slug]/edit` — routes exist.

---

## 2. What's Missing (v2 Work)

| Gap | Phase | Effort |
|-----|-------|--------|
| `buildLifeEventPlan()` | LE-1 | Core — ~3–5 days |
| Graph catalog (3 states min) | LE-1 | ~2 days |
| `GET /api/modules/life-event/plan` | LE-2 | ~1 day (copy P4 pattern) |
| `execute()` reads AppContext | LE-2 | ~0.5 day |
| Dedicated module UI | LE-3 | ~3 days |
| Home NextStepsCard | LE-4 | ~2 days |
| P4 integration + dedup | LE-5 | ~2 days |

**Total MVP (LE-1–LE-4): ~2 weeks** — realistic for primary product module.

---

## 3. Platform Stability Check

| Invariant | Status | Risk for v2 |
|-----------|--------|-------------|
| UserContextV1 authoritative | ✅ Locked | None |
| Home H7 (no writes) | ✅ | Plan is read-only — compliant |
| P4 derived read model pattern | ✅ Proven arr-016 | Copy for plan endpoint |
| Module execute path | ✅ Stable | Enhance, don't replace |
| UX orchestrator legacy | ⚠️ Parallel | v2 bypasses it — OK |
| `suggestModules()` | ⚠️ Client rules | Replace in LE-4 |

**No platform changes required before LE-1.**

---

## 4. Home Orchestration Today

```text
CURRENT HOME PLANNING (fragmented):
  suggestModules()           → client rules, life-event is fallback #4
  MissingContextHintsCard    → P4, routes to finance/healthcare
  OnboardingChecklistCard    → FTU (keep)
  actionCards                → post-execute (keep)

TARGET (v2):
  life-event plan            → primary forward planning
  P4 hints                   → merged/deduped (LE-5)
  suggestModules()           → removed
```

User's product intent aligns: **one module owns "what to do next"**.

---

## 5. Comparison: Previous Doc Framing vs Correct Framing

| Previous (orchestration layer) | Corrected (module adaptation) |
|-------------------------------|------------------------------|
| New package `@arrival-atlas/life-navigation` | Logic in `packages/modules/src/life-event/` |
| `GET /api/life-events` | `GET /api/modules/life-event/plan` |
| UX-L1 platform track | life-event v2 business track |
| New `/life-events` page | Enhanced `/modules/life-event` |
| Separate from catalog module | Same `id: 'life-event'` |

---

## 6. Readiness Checklist

### Ready to start now ✅

- [x] Module registered and routable
- [x] Scenario content exists (8 events)
- [x] UserContextV1 with all domain fields
- [x] P3 correction routes
- [x] P4 insights API (for LE-5)
- [x] AppProvider multi-fetch pattern
- [x] Module explain API pattern for new plan route
- [x] Generic module page as fallback during LE-3
- [x] **Life state model locked** — [life-state-model.md](../life-events/life-state-model.md) v1.1
- [x] **Classifier fixtures** — [life-event-classifier-fixtures.md](../life-events/life-event-classifier-fixtures.md) (24 fixtures)
- [x] **Graph catalog v1** — [life-event-graph-catalog-v1.md](../life-events/life-event-graph-catalog-v1.md) (G1–G7)
- [x] **Pre-implementation hardening** — secondary conditions, severity, priority order, state validation

### Build in LE-1–LE-4 ❌

- [ ] `buildLifeEventPlan()`
- [ ] Graph catalog
- [ ] Plan API
- [ ] Profile-aware execute prefill
- [ ] Dedicated module UI
- [ ] Home NextStepsCard

### Later (LE-5–LE-7) ⏳

- [ ] P4 dedup on Home
- [ ] Scenario content extraction
- [ ] MRC action normalizer

---

## 7. Strategic Alignment

From [profile-ux-discovery.md](../identity/profile-ux-discovery.md):

> Users come to Arrival Atlas to **decide what to do next**.

From platform audit:

> `life-event` behaves like orchestrator but is isolated static JSON.

**v2 closes this gap inside the module** — exactly the right scope now that P1–P4 are stable.

**Priority justification:**

| Module | Role today | Role after v2 |
|--------|-----------|---------------|
| financial-reality | Domain calculator | Action target from plan |
| healthcare-navigation | Domain guide | Action target from plan |
| benefits-simulator | Domain simulator | Action target from plan |
| **life-event** | Static scenarios | **Product navigation hub** |

---

## 8. Design Readiness Gate

Pre-implementation hardening pass (2026-06-20). Evaluates product-model completeness before LE-1 coding.

| Dimension | Maturity | Evidence | Ready? |
|-----------|----------|----------|--------|
| **State model** | Stable v1.1 | 7 states defined; severity; validation; no redundant states | ✅ |
| **Secondary conditions** | Defined | 12-condition catalog; rules; P4 bridge documented | ✅ |
| **Classifier priority** | Locked | 7-step priority order; coexistence table; 24 fixtures validated | ✅ |
| **Classifier fixtures** | Complete | F01–F24 covering arrivals, employment, benefits, families, housing, insurance, stability | ✅ |
| **Graph readiness** | Complete | G1–G7 in life-event-graph-catalog-v1.md; phases, dependencies, plan mapping | ✅ |
| **Planner readiness** | Spec-complete | Pipeline, ranking tiers, reasoning rules, ownership boundaries | ✅ |
| **Open product questions** | None blocking | F07/F21 edge case resolved; arrival_stabilizing validated | ✅ |

### Consistency review (Phase 1)

| Issue found | Resolution applied |
|-------------|-------------------|
| Priority order only implied | Added to life-state-model §Classifier Priority Order |
| Secondary hints ambiguous | Secondary Conditions catalog introduced |
| 3 vs 7 graph mismatch | Roadmap + spec: 7 graphs, 3 full in LE-1 |
| P4 / plan Home overlap | LE-5 dedup; temporary MVP overlap documented |
| Data gap vs state | Fixtures F21, F24; secondary condition rules |
| suggestModules ownership | LE-4 removal documented |

### Final verdict

```text
✅ READY FOR LE-1
```

**Justification:**

- Life state model is stable with severity, secondaries, and priority order
- 24 classifier fixtures provide fixture-ready golden test basis
- No unresolved product-model questions block classifier or graph design
- Graph catalog v1.0.0 locks all 7 state graphs — LE-1 implements with G1–G3 deepest first
- Engineering can begin without reopening core planning design

**Not required before LE-1:** API (LE-2), UI (LE-3), Home (LE-4), P4 merge (LE-5).

---

## 9. Final Verdict (Platform + Design)

| Question | Answer |
|----------|--------|
| New module needed? | **No** — adapt `life-event` |
| New platform layer needed? | **No** — module-scoped plan |
| Platform stable enough? | **Yes** |
| Can start LE-1 implementation? | **Yes — design gate passed** |
| Biggest asset? | State model + fixtures + scenario content |
| Biggest gap? | Code — plan engine, API, UI (LE-1–LE-4) |

**Platform: 78/100 — GO.**  
**Design: READY FOR LE-1.**

---

## 10. Related Documents

| Document | Path |
|----------|------|
| Specification | [life-events/life-event-module-v2-spec.md](../life-events/life-event-module-v2-spec.md) |
| Roadmap | [life-events/life-event-module-v2-roadmap.md](../life-events/life-event-module-v2-roadmap.md) |
| Life state model | [life-events/life-state-model.md](../life-events/life-state-model.md) |
| Classifier fixtures | [life-events/life-event-classifier-fixtures.md](../life-events/life-event-classifier-fixtures.md) |
| Graph catalog v1 | [life-events/life-event-graph-catalog-v1.md](../life-events/life-event-graph-catalog-v1.md) |
| Platform audit (life-event gap) | [platform-architecture-audit.md](./platform-architecture-audit.md) |
| P4 roadmap | [profile-system-p4-roadmap.md](../identity/profile-system-p4-roadmap.md) |
