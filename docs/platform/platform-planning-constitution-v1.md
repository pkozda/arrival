---
id: platform-planning-constitution-v1
title: Platform Planning Constitution v1
project: Arrival Atlas
system: Arrival Atlas
type: contract
domain: platform
status: active
maturity: evolving
owner: product-architecture
tags:
  - planning-authority
  - life-event
  - economic-reality
  - governance
  - arr-018
  - arr-019
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - life-event-module-v2-v1.0-architecture-freeze
  - economic-reality-module-v1
  - life-event-platform-integration-audit
related:
  - economic-rule-engine-v1
  - le-6-consistency-rules
  - ux-contract-v1
---

# Platform Planning Constitution v1

**Document type:** Runtime governance contract — not marketing  
**Version:** 1.0.0  
**Status:** Active  
**Audience:** Engineering, product architecture, module authors

This document fixes the **dual-authority architecture** introduced when Economic Reality joins Life Event. It is the runtime constitution missing from ARR-018.

---

## 1. Architecture model

```text
┌─────────────────────────────────────────────────────────┐
│                    UserContextV1                         │
└──────────────────────────┬──────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
┌─────────────────────┐           ┌─────────────────────┐
│   LIFE EVENT        │           │  ECONOMIC REALITY   │
│   Life state        │           │  Institutional      │
│   authority         │           │  state authority    │
│   LifeEventPlanV1   │           │  EconomicPlanV1     │
└─────────────────────┘           └─────────────────────┘
         │                                   │
         └─────────────────┬─────────────────┘
                           ▼
              Home UI (composition — NOT a third planner)
```

**Principle:** Dual authority at the **domain** layer. **Single composition** at the **Home UI** layer.

---

## 2. Authority rules

### 2.1 Life Event authority

| Owns | Does not own |
|------|--------------|
| Life situation classification (`arrival_unregistered`, `insurance_gap`, …) | Jobcenter vs Sozialamt selection |
| Life-action graph (G1–G7) | Bürgergeld reporting obligations |
| Life narrative: "what is happening in my life" | Income source axis as institutional truth |
| Home **primary** plan surface | Economic support system classification |

### 2.2 Economic Reality authority

| Owns | Does not own |
|------|--------------|
| Economic state (E1–E7) via [Rule Engine](./economic-reality/economic-rule-engine-v1.md) | Life situation narrative states |
| Support system (`jobcenter` \| `sozialamt` \| `none`) | Registration / insurance life graphs |
| Institutional dependency axis | FTU onboarding checklist |
| Economic graph (G1–G6) | Legal immigration determinations |
| Module `/modules/economic-reality` + Home **secondary** card | Home primary hero plan |

---

## 3. Hard boundaries

| ID | Rule |
|----|------|
| **B1** | LE **cannot** infer `supportSystem` or set `benefits_jobcenter` / `benefits_sozialamt` as authoritative classification |
| **B2** | ER **cannot** infer `lifeStateId` or mutate `LifeEventPlanV1` |
| **B3** | LE **cannot** emit Home-level next-step CTAs that override ER institutional routing when ER evaluation is `financial_crisis` or `application_pending` — ER secondary card must be visible |
| **B4** | ER **cannot** emit Home-level hero CTAs — ever, in v1 |
| **B5** | P4 hints are **advisory** to both modules; neither module writes profile from hints |
| **B6** | Legacy `buildUXActionPlan` / `suggestModules()` **must not** contradict active LE primary or ER secondary surfaces when platform composition policy hides them |

---

## 4. Conflict resolution

When Life Event signals and Economic Reality evaluation appear to disagree:

| Domain | Winner | Example |
|--------|--------|---------|
| **Financial / institutional classification** | **ER** | LE `situation_stable` + ER `benefits_jobcenter` → user is in Jobcenter system |
| **Lifecycle / life admin classification** | **LE** | LE `arrival_unregistered` + ER `self_sustained` → registration remains LE focus |
| **Home UI priority** | **LE primary, ER secondary** | LE hero stands; ER card shows institutional truth |
| **Blocker on shared fact** | **Both reference same satisfaction key** | `SC-REG` blocks ER G2 and LE registration nodes — fix once in Profile |

```text
LE says: "life is stable"
ER says: "on Bürgergeld"
→ Both true. LE does not downgrade ER. ER does not change LE state.
→ Home: LE plan + ER secondary card explaining Jobcenter obligations.
```

### 4.1 What LE signals may do (allowlist)

LE plan MAY:

- Link to ER module via `open_module`
- Elevate ER secondary card visibility when LE state is `economic_setup_pending` or `benefits_exploration`
- Pass **read-only** context to ER presentation (not rule predicates)

LE plan MUST NOT:

- Set ER `economicState`
- Skip ER rule engine via Home heuristics

> **Change from earlier draft:** Removed "LE `economic_setup_pending` → never downgrade ER below E3" from state model. That blended planners. LE may **surface** ER; only the [Rule Engine](./economic-reality/economic-rule-engine-v1.md) sets E1–E7.

---

## 5. UI composition rules (ARR-018 alignment)

### 5.1 Home surfaces

| Surface | Authority | When shown |
|---------|-----------|------------|
| `NextStepsCard` (LE) | Life Event | Plan has `currentFocus` |
| `LifeEventColdStartCard` | Life Event | No LE plan |
| **ER secondary card** | Economic Reality | `economicState ∉ { self_sustained }` OR user pinned ER |
| P4 hints inside LE card | P4 advisory | LE-6 dedup |
| `SuggestedModulesSection` | Legacy heuristic | Only when constitution hides competing surfaces |
| Module catalog grid | Legacy | Only when no LE plan + no ER crisis/pending |

### 5.2 Module pages

| Route | Role |
|-------|------|
| `/modules/life-event` | Full life plan |
| `/modules/economic-reality` | Full economic plan |
| Other modules | Execution tools — link back to plans (future ARR-018 priority) |

---

## 6. Cross-module signals (EP-8 / LE-8)

Optional runtime feedback MUST:

- Be **advisory only**
- Never re-run the other module's rule/planner engine silently on Home
- Publish events like `benefit_activation_completed` → ER may refresh on next `evaluate()`

Forbidden:

- LE planner consuming ER output as classification input in v1
- ER rule engine consuming LE `currentFocus` as predicate in v1

---

## 7. Enforcement checklist (code review)

- [ ] ER classification goes only through `evaluateEconomicRules()`
- [ ] LE classification goes only through `buildLifeEventPlan()`
- [ ] Home does not call `suggestModules()` when `shouldHideHomeSecondarySections` equivalent is true for ER+LE
- [ ] No third planner on Home without constitution amendment
- [ ] Fixture tests prove LE/ER boundary cases (EF20, EF21)

---

## 8. Amendment process

Changes to authority split require:

1. Update this document
2. Update affected module specs
3. Add fixture tests proving new boundary
4. Platform audit note if Home composition changes

---

## Related

- [life-event-platform-integration-audit.md](../audits/life-event-platform-integration-audit.md)
- [le-6-consistency-rules.md](../life-events/le-6-consistency-rules.md)
- [economic-reality-module-v1-spec.md](../economic-reality/economic-reality-module-v1-spec.md)
