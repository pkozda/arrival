---
id: economic-reality-module-v1-readiness-audit
title: Economic Reality Module v1.0 — Readiness Audit
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: finance
status: active
maturity: evolving
owner: product
tags:
  - economic-reality
  - readiness
  - arr-019
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - economic-reality-module-v1
  - economic-state-model
  - economic-graph-catalog-v1
related:
  - economic-reality-module-v1-roadmap
  - life-event-module-v2-readiness-audit
  - life-event-platform-integration-audit
  - financial-module-v2-plan
---

# Economic Reality Module v1.0 — Readiness Audit

**Date:** 2026-06-21  
**Scope:** Readiness to begin **EP-1 implementation** of `economic-reality`  
**Framing:** Second planning pillar — institutional survival (Germany) — not a calculator rewrite

---

## Executive Summary

The platform is **ready to start EP-1** for Economic Reality Module v1.0. Prerequisites from P1–P4 and Life Event v1.0 provide the same rails that made LE-1 successful: authoritative `UserContextV1`, profile correction, insights, plan API pattern, and module UI shell.

The **design package is complete** for pre-implementation: economic state model (E1–E7), graph catalog (G1–G6), 24 classifier fixtures including **refugee / Sozialamt / Jobcenter** scenarios, and EP-1–EP-8 roadmap.

The **main gap is implementation**, not architecture. Existing `financial-reality` remains a calculator — it does not block ER; ER complements it.

### Gate verdict

| Dimension | Score | Verdict |
|-----------|-------|---------|
| Platform prerequisites (P1–P4, LE v1) | **95/100** | ✅ Ready |
| Design completeness (state, graph, fixtures, **rule engine**, **constitution**) | **95/100** | ✅ Ready for EP-1 |
| Immigrant / refugee scenario coverage | **85/100** | ✅ R3/R2 fixtures; rule predicates locked in doc |
| Rule engine execution contract | **90/100** | ✅ economic-rule-engine-v1.md |
| LE/ER governance | **90/100** | ✅ platform-planning-constitution-v1.md |
| Module scaffold | **10/100** | ❌ Not built — **EP-1** |
| Plan API + UI | **0/100** | ❌ **EP-6–EP-7** |
| LE integration clarity | **90/100** | ✅ Constitution v1; EP-8 deferred |
| `financial-reality` relationship | **70/100** | ⚠️ Documented; product naming TBD |

**Recommendation:** Proceed to **arr-019 EP-1** after product sign-off on module id `economic-reality` vs consolidating into `financial-reality`.

---

## What exists today

| Asset | Status |
|-------|--------|
| `financial-reality` execute module | ✅ Calculator + heuristics |
| `benefits-simulator` | ✅ Simulation execute |
| Life Event links to `financial-reality` | ✅ Graph `open_module` |
| LE states `economic_setup_pending`, `benefits_exploration` | ✅ Cross-module signals |
| Economic planning types / API | ❌ |
| Sozialamt / Jobcenter institutional model in code | ❌ |

---

## Design readiness checklist

| Item | Doc | Status |
|------|-----|--------|
| Module spec | economic-reality-module-v1-spec.md | ✅ |
| **Rule engine R1–R7** | economic-rule-engine-v1.md | ✅ |
| **LE ↔ ER constitution** | platform-planning-constitution-v1.md | ✅ |
| State model E1–E7 + axes | economic-state-model.md | ✅ |
| Graph catalog G1–G6 (G1 layered) | economic-graph-catalog-v1.md | ✅ |
| Fixtures EF01–EF24 | economic-classifier-fixtures.md | ✅ |
| Roadmap EP-1–EP-8 | economic-reality-module-v1-roadmap.md | ✅ |
| LE boundary rules | Spec §3 + state model | ✅ |
| ARR-018 Home authority constraint | EP-7 secondary card only | ✅ |

---

## Risks before EP-1 (mitigated)

| Risk | Mitigation |
|------|------------|
| EP-4 resolver debate | **Merged into rule engine** — R3/R4 normative |
| §24 / municipal variance | Fixtures + disclaimer; R3 predicates |
| G1 overload | **G1-A/B/C layers** — planner separation |
| LE/ER planner collision | **Constitution v1** — dual authority |
| Employment-centric bias | **Dual axes** in evaluation output |
| Collapsing Sozialamt into Jobcenter | R3 before R4 — FIRST MATCH |

---

## Recommended first PR (EP-1)

1. `packages/product-contract/src/economic-reality/` — `EconomicEvaluationV1` + `EconomicPlanV1`
2. `packages/modules/src/economic-reality/plan/rule-engine/` — `evaluateEconomicRules()` R1–R7
3. `classifier.ts` — thin wrapper only
4. Tests for EF01–EF24 including `appliedRules` + `axes`

**Do not** in EP-1: UI, API, or changes to `financial-reality` execute logic.

---

## Related

- [economic-reality-module-v1-roadmap.md](../economic-reality/economic-reality-module-v1-roadmap.md)
- [life-event-platform-integration-audit.md](./life-event-platform-integration-audit.md)
