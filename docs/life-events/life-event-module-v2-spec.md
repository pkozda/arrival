---
id: life-event-module-v2
title: Life Event Module v2 — Specification
project: Arrival Atlas
system: Arrival Atlas
type: spec
domain: life-events
status: draft
maturity: evolving
owner: product
tags:
  - life-event
  - life-event-graph
  - action-planning
  - profile-aware
  - arr-016
created: 2026-06-20
updated: 2026-06-20
depends_on:
  - ux-contract-v2
  - profile-mutation-model-v1
  - profile-system-p4-roadmap
related:
  - life-event-module-v2-roadmap
  - life-event-module-v2-readiness-audit
  - life-state-model
  - life-event-classifier-fixtures
  - life-event-graph-catalog-v1
  - profile-ux-discovery
  - benefits-simulator-design
---

# Life Event Module v2 — Specification

**Document type:** Module specification (business + technical)  
**Module ID:** `life-event` (existing — this is an **evolution**, not a new module)  
**Current version:** `1.0.0` — static scenario tables, ignores profile  
**Target version:** `2.0.0` — profile-aware life-action graph  
**Status:** Design hardened — ready for LE-1  
**Branch track:** `arr-016`

---

## 0. Executive Summary

**Life Event Module** — один из ключевых продуктовых модулей Arrival Atlas. Сегодня он существует (`packages/modules/src/life-event/`), но работает как статический справочник сценариев: не читает профиль, не участвует в Home-оркестрации, не выдаёт action cards.

**v2** превращает его в то, для чего модуль изначально задумывался:

> *"Где ты находишься в жизни в Германии"* → *"Что делать дальше, в каком порядке и почему"*

### Продуктовая формула

```text
P1–P3  →  что правда          (UserContextV1)
UX-P4  →  что это значит      (ProfileInsightViewV1 — hints)
life-event v2  →  что делать    (LifeEventPlanV1 — этот модуль)
```

Архитектура платформы стабильна. Задача v2 — **бизнес-реализация** на существующих рельсах, без нового platform layer и без нового catalog module.

### Что это

| ✅ | |
|----|---|
| **Адаптация `life-event`** | Тот же `id`, тот же маршрут `/modules/life-event` |
| **Deterministic life-action graph** | DAG жизненных ограничений над `UserContextV1` |
| **Read-side plan** | `LifeEventPlanV1` — derived, не authoritative |
| **Главный navigation surface** | Home "Your next steps" + расширенная страница модуля |

### Что это НЕ

| ❌ | |
|----|---|
| Новый catalog module | `id: 'life-event'` сохраняется |
| Новый platform package | Логика живёт в `packages/modules/src/life-event/` |
| Onboarding checklist | FTU checklist на Home — отдельная concern |
| Wizard / form-only flow | Execute остаётся для scenario exploration; plan — read path |
| ML / скрытые эвристики | Все правила тестируемы |

---

## 1. Текущее состояние (v1)

```text
packages/modules/src/life-event/index.ts
  ├── 8 event types (arrival, job-loss, …)
  ├── ~330 lines static EVENT_HANDLERS
  ├── execute() ignores AppContext
  ├── DEFAULT_MODULE_CONTRACT (no actions, no profile)
  └── featureFlags.personalizedTimeline: false
```

| Аспект | v1 | Проблема |
|--------|-----|----------|
| Profile read | ❌ | План не персонализирован |
| Home presence | Fallback #4 в `suggestModules()` | Почти невидим |
| Action cards | ❌ | Не в MRC spine |
| Web UI | Generic `ContractModulePage` | Form + static output, нет plan view |
| P4 integration | ❌ | Hints ведут в finance/healthcare, не сюда |

Platform audit: *"behaves like orchestrator but is isolated static JSON"* — v2 закрывает этот gap **внутри модуля**.

---

## 2. Position in Architecture

Модуль потребляет read layers и **ссылается** на другие модули и Profile — не заменяет их.

```text
UserContextV1  ← authoritative facts
ProfileInsightViewV1  ← optional hints (P4)
        │
        ▼
life-event module v2
  buildLifeEventPlan()     ← read path (NEW)
  execute()                ← scenario exploration (existing, enhanced)
        │
        ├── GET /api/modules/life-event/plan  → LifeEventPlanV1
        ├── POST /api/modules/life-event/execute  → phased scenarios
        └── links → financial-reality, healthcare-navigation, /profile/…/edit
```

**Invariant:** Plan never writes facts. Execute may activate profile fields only via existing mutation path (future, optional).

---

## 2.1 Product Planning Model

Canonical product references (pre-implementation):

| Document | Role |
|----------|------|
| [life-state-model.md](./life-state-model.md) | States, severity, secondary conditions, classifier priority |
| [life-event-classifier-fixtures.md](./life-event-classifier-fixtures.md) | 24 worked examples for classifier + golden tests |
| [life-event-graph-catalog-v1.md](./life-event-graph-catalog-v1.md) | Action graph per state — G1–G7 |

### Planning pipeline

```text
Situation facts
      ↓
Primary state (one)           ← classifyLifeState
      +
Secondary conditions (0–n)    ← detectSecondaryConditions
      ↓
Graph catalog (per primary)   ← resolve-graph
      ↓
Planner rank + reason         ← buildLifeEventPlan
      ↓
Home + /modules/life-event
```

### Plan output (product fields)

Beyond graph nodes, every plan includes:

| Field | Source |
|-------|--------|
| **Primary state** | Classifier — selects graph |
| **Secondary conditions** | Parallel detection — adjusts rank & reasoning |
| **Planning severity** | From primary state (see life-state-model) |
| **Reasoning** | `whyThisNow`, `whatIsBlocking` — plain language |

Secondary conditions are **not** user-facing state labels — they appear in reasoning and blocker copy.

### Ownership boundaries (hardened)

| Surface | Owns forward planning? | Notes |
|---------|------------------------|-------|
| **life-event plan** | ✅ Yes | Primary Home "next steps" (LE-3) |
| **P4 MissingContextHintsCard** | ❌ No (LE-6) | Merged/deduped into plan |
| **suggestModules()** | ❌ Deprecated | Removed LE-6 |
| **FTU OnboardingChecklist** | ❌ No | Product onboarding — separate intent |
| **Post-execute action cards** | ❌ No | Backward-looking module outputs |
| **Domain modules** | ❌ No | Action **targets** linked from plan nodes |

### Graph catalog strategy

One graph per primary state (7 total). Full graph definitions: [life-event-graph-catalog-v1.md](./life-event-graph-catalog-v1.md). LE-1 implements G1–G3 first with deepest node detail; G4–G7 defined in catalog for LE-1 classifier routing and minimal graph resolution.

---

## 3. Module Structure (v2)

```text
packages/modules/src/life-event/
  index.ts                    # Module registration, execute()
  schemas.ts                  # Input/Output Zod (existing, extended)
  plan/
    build-life-event-plan.ts    # Main entry
    classify-life-state.ts      # UserContextV1 → LifeStateId
    resolve-graph.ts            # DAG resolution
    rank-actions.ts             # Priority tiers
    build-reasoning.ts          # Plain-language why/blocking
  graph-catalog/                # Versioned graph definitions
    arrival-unregistered.ts
    arrival-stabilizing.ts
    economic-setup-pending.ts
    …
  scenarios/                    # Existing EVENT_HANDLERS → extracted here
    arrival.ts
    job-loss.ts
    …
  types.ts
```

Контрактные типы `LifeEventPlanV1` — в `@arrival-atlas/product-contract` (как `ProfileInsightViewV1` для P4).

---

## 4. Core Concept: Life Event Graph

### 4.1 Graph

```typescript
type LifeEventGraph = {
  schemaVersion: '1.0.0';
  rootStateId: LifeStateId;
  nodes: LifeEventNode[];
  edges: LifeEventDependency[];
};
```

### 4.2 Life state (classifier)

Стабильные якоря графа — **derived labels**, не stored facts:

```typescript
type LifeStateId =
  | 'arrival_unregistered'
  | 'arrival_stabilizing'
  | 'economic_setup_pending'
  | 'housing_instability'
  | 'insurance_gap'
  | 'benefits_exploration'
  | 'situation_stable';
```

Классификатор следует [Classifier Priority Order](./life-state-model.md#classifier-priority-order). Fixtures: [life-event-classifier-fixtures.md](./life-event-classifier-fixtures.md).

### 4.3 Node

```typescript
type LifeEventNode = {
  id: string;
  title: string;
  category: 'legal' | 'survival' | 'stabilization' | 'optimization' | 'life_transition';
  description: string;
  actions: LifeActionRef[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedTimeToComplete?: string;
  dependsOn?: string[];
  conditions?: LifeEventCondition[];
  /** Optional link to scenario execute input */
  scenarioEvent?: LifeEventInput['event'];
};

type LifeActionRef = {
  kind: 'open_module' | 'correct_in_profile' | 'explore_scenario';
  moduleId?: string;
  profileMirrorSlug?: string;
  scenarioEvent?: string;
  href: string;
  label: string;
};
```

### 4.4 Dependencies

```typescript
type LifeEventDependency = {
  from: string;
  to: string;
  type: 'blocks' | 'enables';
};
```

Это **граф жизненных ограничений** (Anmeldung blocks Steuer-ID workflow), не checklist UI.

---

## 5. Inputs

| Input | Source | Required |
|-------|--------|----------|
| `UserContextV1` | `AppContext` / API state | ✅ |
| `ProfileInsightViewV1` | P4 projection | Optional (v2.1) |
| Module catalog | `PublicModuleContract[]` | CTA labels |
| Execution history | derived metadata | De-prioritize redundant nodes |

**Forbidden:** `MutationEvent[]` in web, `snapshot.userContext` as truth, write-layer imports.

P3 corrections (`profile_ui`) — authoritative for node satisfaction (как в P4).

---

## 6. Output: `LifeEventPlanV1`

```typescript
type LifeEventPlanV1 = {
  schemaVersion: '1.0.0';
  generatedAt: string;
  moduleId: 'life-event';
  moduleVersion: string;

  currentLifeState: LifeStateId;
  secondaryConditions: SecondaryConditionId[];  // 0–n — see life-state-model
  planningSeverity: 'critical' | 'high' | 'medium' | 'low';
  currentFocus: LifeEventNode;
  nextBestActions: LifeEventNode[];
  activeBlocks: LifeEventNode[];
  timeline: LifeEventNode[];

  reasoning: {
    whyThisNow: string[];
    whatIsBlocking: string[];
    planConfidence: ConfidenceLevel;  // reuse P4 enum — not ML score
  };
};
```

### API

| Endpoint | Role |
|----------|------|
| `GET /api/modules/life-event/plan` | **Primary read** — personalized plan |
| `POST /api/modules/life-event/execute` | Scenario exploration (existing, enhanced prefill) |

Module-scoped endpoint — тот же паттерн, что `GET /api/modules/:id/explain`.

Response headers:

```text
x-read-model: LifeEventPlanV1
x-module-plan-authority: derived-non-authoritative
```

No persistence v2.0 — recompute from current profile.

---

## 7. Algorithm (deterministic)

```text
LifeEventPlanV1 = buildLifeEventPlan(userContext, insights?, graphCatalog)
```

### Steps

1. **Classify primary state** — priority-ordered rules → one `LifeStateId`
2. **Detect secondary conditions** — independent evaluation → 0–n conditions
3. **Load graph** — catalog for primary state
4. **Resolve** — evaluate node satisfaction; apply `blocks` / `enables`; boost/demote via secondaries
5. **Rank** — legal → survival → stabilization → optimization; respect planning severity
6. **Reason** — plain-language `whyThisNow` / `whatIsBlocking` incorporating secondaries

### Ranking tiers

| Tier | Category | Examples |
|------|----------|----------|
| 1 | `legal` | Anmeldung, registration |
| 2 | `survival` | Housing, income, insurance |
| 3 | `stabilization` | Banking, tax ID |
| 4 | `optimization` | Language, integration |
| 5 | `life_transition` | Job change → `explore_scenario` in this module |

---

## 8. UX Surfaces

### 8.1 Home — "Your next steps in Germany"

**Owner:** life-event module plan (не отдельный platform card).

| Element | Limit |
|---------|-------|
| Primary focus | 1 node |
| Next actions | 2–4 nodes |
| CTA | Link to `/modules/life-event` or linked module |

Заменяет `SuggestedModulesSection` для forward-planning (LE-3). Until LE-6, P4 hints may appear above plan — temporary overlap.

FTU checklist и post-execution action cards — без изменений.

### 8.2 Module page — `/modules/life-event`

v2 получает **dedicated UI** (не generic form-only):

| Section | Content |
|---------|---------|
| Your plan | `currentFocus` + `nextBestActions` |
| Why now | `reasoning` |
| What's blocking | `activeBlocks` |
| Explore a scenario | Existing event selector + execute (arrival, job-loss, …) |
| Full timeline | Collapsible `timeline` |

### 8.3 Cross-links

| Target | When |
|--------|------|
| `/modules/financial-reality` | Income, employment nodes |
| `/modules/healthcare-navigation` | Insurance nodes |
| `/modules/benefits-simulator` | Benefits nodes |
| `/profile/[slug]/edit` | Missing fact → P3 correction |
| `/modules/life-event?event=job-loss` | Life transition deep-link |

Never auto-launch execute. Never auto-mutate.

---

## 9. Relationship to Existing Scenarios (v1 content)

Статические `EVENT_HANDLERS` **не выбрасываем** — выносим в `scenarios/` и связываем с graph nodes через `scenarioEvent` / `explore_scenario` actions.

```text
Graph node "Prepare for job loss"
  → action: explore_scenario { event: 'job-loss' }
  → execute() returns phased content from scenarios/job-loss.ts
```

Один модуль, два режима:
- **Plan mode** — read, profile-aware, Home + module landing
- **Scenario mode** — execute, episodic what-if (UX Contract SC4 — не пишет в profile без activation)

---

## 10. Hard Constraints

### MUST

- Deterministic: same `UserContextV1` → same plan
- Explainable ordering with `reasoning`
- Respect P3 corrections as fact overrides
- P4 insights as hints only (v2.1)
- Navigation-only CTAs on Home
- No schema keys in UI copy

### MUST NOT

- New catalog module or platform orchestration package
- Checklist progress persistence (v2.0)
- Home domain fact writes (H7)
- ML scoring
- Duplicate P3 correction logic

---

## 11. MRC Upgrade Path (v2.2+)

После core plan — опционально:

```typescript
// module-contracts.ts
export const LIFE_EVENT_CONTRACT: SdkModuleContractSpec = {
  capabilities: ['produces-actions', 'requires-profile', 'produces-plan'],
  requiresActionNormalizer: true,
};
```

Phased scenario actions → `ModuleUIProjection.actions` → Home priority cards (post-execute).

Не блокирует v2.0 business delivery.

---

## 12. Success Criteria

- [ ] User answers: **"What should I do next in Germany?"** from Home in ≤ 2 clicks
- [ ] Plan reflects actual profile data (not static defaults)
- [ ] Same profile → same plan (golden tests)
- [ ] Existing 8 scenarios still work via execute
- [ ] No P1–P4 regression
- [ ] life-event — primary Home forward-planning owner

---

## 13. Canonical Principle

```text
P1–P3:       what is true
UX-P4:       what it means
life-event:  what to do next
```

Один модуль. Одна продуктовая ответственность. Платформа не меняется.

---

## 14. Pre-Implementation Hardening (2026-06-20)

Consistency pass across spec, roadmap, life-state-model, fixtures, audit.

| Finding | Resolution |
|---------|------------|
| Priority order in model, not spec | Added Classifier Priority Order to life-state-model; spec references it |
| "Secondary hints" ambiguous vs P4 | Introduced **Secondary Conditions** catalog — distinct from P4 hints |
| 3 graphs vs 7 states mismatch in roadmap | Clarified: 7 graphs, 3 fully authored in LE-1 |
| `arrival_stabilizing` overlap concern | Validated in State Validation — breadth state, not redundant |
| Data gaps vs states conflated | Fixtures F07 vs F21, F24 — secondary only when no planning impact |
| P4 + plan Home overlap | LE-6 dedup explicit; MVP may temporarily show both |
| suggestModules vs plan ownership | LE-6 removes; documented in ownership table |
| Missing fixture catalog | Created life-event-classifier-fixtures.md (24 fixtures) |
| Missing graph catalog | Created life-event-graph-catalog-v1.md (G1–G7) |

**Unresolved product questions:** none blocking LE-1.
