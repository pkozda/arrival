---
id: economic-reality-system-audit-v2
title: Economic Reality — System Audit v2 (Post-EP-11.1 Closure)
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: finance
status: active
maturity: frozen-review
owner: architecture
tags:
  - economic-reality
  - audit
  - ep-closure
  - deterministic-pipeline
  - single-source-of-truth
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - economic-reality-system-audit-v1
  - economic-reality-module-v1-roadmap
  - economic-rule-engine-v1
related:
  - economic-reality-system-audit-v1
  - platform-planning-constitution-v1
---

# Economic Reality — System Audit v2 (Post-EP-11.1 Closure)

**Date:** 2026-06-21  
**Scope:** EP-1 → EP-11 pipeline + API/Web integration after EP-11.1 stabilization  
**Method:** Code verification + invariant checks + automated tests (no redesign)  
**Tests at audit time:** 238 (modules) + 32 (api) + 37 (web) = **307 green**

**Baseline:** Assumes EP-11.1 applied (`graphHint` removed, satisfaction decoupled, `catalog-routing`, LE graph unified).

---

## A. Executive verdict

### **CLOSED** (post R-01–R-04)

| Dimension | Verdict | Notes |
|-----------|---------|-------|
| **A. Architecturally closed** (EP-1→EP-11) | **YES** | R-01–R-04 micro-patch applied |
| **B. Fully deterministic** (UserContext-only) | **CONDITIONAL** | Modules pipeline strict; EP-12 optional at API |
| **C. Single-source-of-truth** | **YES** | Residual EP-12 boundary documented |

**Compared to audit v1:** All 4 **critical** violations resolved. R-01–R-04 minor items **resolved** in arr-019.

> **Economic Reality v1 is architecturally closed** under strict deterministic single-source-of-truth constraints for the EP-1→EP-11 core pipeline, with EP-12 documented as an explicit API boundary extension.

---

## B. Critical questions (explicit answers)

### Q1 — Is there ANY remaining dual authority?

**No critical dual authority.** Residual minor leaks:

| ID | Issue | Class | Severity |
|----|-------|-------|----------|
| R-01 | `resolveModuleFromOpenAction` prefers `input.href` over catalog route | catalog authority | Minor |
| R-02 | `open-module-resolver` fallback `href: '/modules/economic-reality'` when catalog entry missing | catalog authority | Minor |
| R-03 | ER action catalog includes `open_module → financial-reality` as **calculator tool** (not LE routing) | intentional complement | Informational |
| R-04 | API injects `feedbackSignals` from `economicRealityEvents[]` into `evaluate()` | side channel (EP-12) | Out of EP-11 scope |

**Resolved since v1:** `graphHint`, `cross-module-links.ts` static maps, LE `financial-reality` graph handoff.

---

### Q2 — Is EP-1 → EP-11 a strictly linear function?

**YES** for the modules pipeline:

```text
UserContext (+ optional feedbackSignals at API only)
  → evaluate (EP-1)
  → resolveGraphContext (EP-2)
  → buildExecutionState (EP-3)
  → buildActionSet (EP-4)
  → buildPlan (EP-5)
  → buildPresentation (EP-6)
  → serialize + hash (EP-7)
```

No backward imports in web runtime. EP-5 `enrichEconomicOpenModuleActions` enriches `open_module` payloads from catalog + strategy — governed planner step, not a parallel action source.

---

### Q3 — Can the system be replayed deterministically from UserContextV1 only?

| Layer | UserContext-only replay | Evidence |
|-------|------------------------|----------|
| `packages/modules` pipeline | **YES** | EF01–EF24 + `EF_R7_FALLBACK`; repeat-run tests; hash stable across meta noise |
| `apps/api` plan projection | **CONDITIONAL** | Same `UserContext` + empty `economicRealityEvents` → deterministic; events enrich EP-1 input |
| Web client | **YES** | Hash-keyed cache; no engine; reconcile skips unchanged hash |

**Strict answer:** Replay from **UserContextV1 alone** holds in the **modules package**. Full API replay requires **UserContext + event log state** if EP-12 feedback events exist.

---

### Q4 — Are catalog, graph, and routing fully unified?

| Domain | Authority | Status |
|--------|-----------|--------|
| Graph identity | EP-2 `resolveGraphContext` only | **PASS** — no `graphHint`, no `selectGraphHint` |
| Cross-module routing | `MODULE_CATALOG_V1` + `catalog-routing.ts` | **PASS** — no static `LIFE_EVENT_NODE_TARGETS` |
| Entrypoints | `triggerEntrypoints` on catalog entry | **PASS** |
| Router | `resolveModule` / `resolveModuleFromOpenAction` | **CONDITIONAL** — href override (R-01) |

---

### Q5 — Is LE ↔ ER integration architecturally clean or still hybrid?

| Path | Status |
|------|--------|
| LE graph → `economic-reality` | **PASS** — `financial-reality` removed from LE catalog |
| Catalog bridge → `suggestModulesForLifeContext` | **PASS** — catalog triggers only |
| LE-8 runtime signals → `financial-reality` | **HYBRID** — library exists, unwired; outside ER module boundary |
| ER → LE advisory hints (`cross-module-feedback`) | **PASS** — advisory-only message keys |

**LE ↔ ER institutional handoff is clean.** Platform-wide LE-8 runtime still references `financial-reality` but is frozen/unwired per constitution.

---

## C. Violation matrix (remaining only)

### Resolved (v1 → v2 → arr-019)

| v1 ID | Issue | Status |
|-------|-------|--------|
| V-C1 | Dual `graphHint` vs `resolveGraphContext` | **RESOLVED** (EP-11.1) |
| V-C2 | EP-3 satisfaction used `evaluation` | **RESOLVED** (EP-11.1) |
| V-C3 | LE dual economic module routing | **RESOLVED** (EP-11.1) |
| V-C4 | Parallel `cross-module-links` tables | **RESOLVED** (EP-11.1) |
| V-M9 | Nested presentation `deterministicHash` | **RESOLVED** (EP-11.1) |
| R-01 | Router `href` override bypasses catalog | **RESOLVED** (arr-019) |
| R-02 | Hardcoded open-module fallback route | **RESOLVED** (arr-019) |
| R-03 | `HighlightPanel` raw action ref IDs | **RESOLVED** (arr-019) |
| R-04 | `validateActionSetCopyKeys` test-only | **RESOLVED** (arr-019) |

### Remaining (out of EP-11 closure scope)

| ID | Class | Issue | Location |
|----|-------|-------|----------|
| R-07 | side channel | EP-12 `feedbackSignals` enriches EP-1 at API | `economic-reality-plan-projection.ts` |

**No FAIL-class violations remain in EP-1→EP-11 scope.**

---

## D. Layer-by-layer verification

| EP | Layer | Status | Evidence |
|----|-------|--------|----------|
| **EP-1** | Rule engine | **PASS** | FIRST MATCH WINS; 25 fixtures incl. `EF_R7_FALLBACK`; no `graphHint` on evaluation |
| **EP-2** | Graph | **PASS** | `resolvePrimaryGraph` exhaustive; 24/24 `entryNodeId` tests; single resolver |
| **EP-3** | Execution | **PASS** | `evaluateEconomicSatisfactionKeys(userContext)` only; no `evaluate()` in `buildExecutionState` |
| **EP-4** | Actions | **PASS** | Catalog-only templates; stable sort; pure function of execution |
| **EP-5** | Planner | **PASS** | Track partition + global P5 dedup; deterministic ordering |
| **EP-6** | Presentation | **CONDITIONAL PASS** | Bijective action↔card; `INTENT_UI_MAP` explicit; runtime copy validation in `buildPresentation` |
| **EP-7** | API | **CONDITIONAL PASS** | Server-only pipeline; Zod validation; SHA-256 hash; EP-12 feedback input optional |
| **EP-8** | Client | **PASS** | No engine imports; hash-only cache; boundary tests |
| **EP-9** | UI | **CONDITIONAL PASS** | Presentation renderer; copy keys; R-03 raw action IDs in highlight |
| **EP-10** | Catalog / routing | **PASS** | `catalog-routing.ts` → `resolveTriggeredModules` only |
| **EP-11** | i18n / copy | **CONDITIONAL PASS** | Key-only wire contract; `useEconomicCopy`; error keys; R-03/R-04 gaps |

---

## E. Determinism proof summary

### Evidence of reproducibility

```bash
# Audit commands 2026-06-21
cd packages/modules && npx vitest run src/economic-reality src/api/economic-reality src/module-orchestration src/i18n
# 238 passed

cd apps/api && npx vitest run src/economic-reality
# 32 passed (EF01–EF24 + EF_R7_FALLBACK API parity)

cd apps/web && npx vitest run src/lib/economic-reality src/modules/economic-reality
# 37 passed (EP-8/9/10/11 boundary guards)
```

| Invariant | Result |
|-----------|--------|
| Same `UserContext` → same evaluation/graph/execution/actions/plan/presentation | **PASS** |
| `meta.deterministicHash` stable across `requestId` / `generatedAt` | **PASS** |
| `graphHint` absent from evaluation wire | **PASS** (`expect(evaluation).not.toHaveProperty('graphHint')`) |
| No `Date.now()` in plan hash path | **PASS** (events use timestamps but hash is over pipeline output given stored events) |
| Locale does not alter pipeline keys | **PASS** (copy layer only) |

### Failure cases (documented, not bugs)

- **EP-12 feedback:** Appending events changes `feedbackSignals` → may change EP-1 enrichment → different plan hash. Deterministic given same event log.
- **R7 catch-all:** Profiles with unknown employment axis fall to R7 → `unemployment_transition`. Explicit, tested via `EF_R7_FALLBACK`.

---

## F. Cross-checks by audit dimension

### 3.1 Pipeline determinism — **PASS** (modules); **CONDITIONAL** (API with events)

### 3.2 Authority consistency — **PASS**

| Domain | Authority | Verified |
|--------|-----------|----------|
| State | EP-1 | ✅ |
| Graph | EP-2 | ✅ no parallel selector |
| Execution | EP-3 | ✅ |
| Actions | EP-4 | ✅ |
| Plan | EP-5 | ✅ |
| Presentation | EP-6 | ✅ |
| API | EP-7 | ✅ |
| Client | EP-8 | ✅ |
| UI | EP-9 | ✅ |
| Routing | EP-10 catalog | ✅ |
| Copy | EP-11 | ✅ |

### 3.3 Cross-module integrity — **PASS** (ER scope)

- `catalog-routing.ts` contains zero static routing maps
- Grep: no `LIFE_EVENT_NODE_TARGETS`, `cross-module-links.ts` deleted
- LE graph: zero `financial-reality` references

### 3.4 Determinism invariants — **PASS** (core); EP-12 documented exception

### 3.5 Graph integrity — **PASS**

- `graphHint` / `selectGraphHint`: **absent** from production code (test assertion only)

### 3.6 Copy system integrity — **CONDITIONAL PASS**

- Presentation: `validatePresentationCopyKeys` + `validateNoRawStringsInPresentation` in `buildPresentation`
- UI tree: `useEconomicCopy` + `ER_COPY_KEYS`
- Gap: `HighlightPanel` action ref IDs (R-03)

### 3.7 Action & execution purity — **PASS**

- Actions from execution + catalog only
- EP-5 enrichment does not inject new action types

---

## G. v1 → v2 delta summary

| Metric | Audit v1 | Audit v2 |
|--------|----------|----------|
| Critical violations | 4 | **0** |
| EP-1→EP-11 FAIL layers | 5 (EP-1,2,3,6,10) | **0** |
| Executive verdict | NOT CLOSED | **CONDITIONALLY CLOSED** |
| Tests | 300 | **307** |

---

## H. Final closure recommendation

### **FREEZE** the EP-1→EP-11 Economic Reality core

The system meets the stabilization goal of EP-11.1:

- Single graph authority (EP-2)
- Single routing authority (EP-10 catalog)
- Linear deterministic pipeline
- Key-based copy governance

### Optional polish (non-blocking)

1. Remove router `href` override (R-01) or treat mismatch as error
2. Remove open-module fallback href (R-02)
3. Hide `dominantActionRefIds` behind debug flag (R-03)
4. Add `validateActionSetCopyKeys` to `buildActionSet` runtime (R-04)

### Extension phase gate

**Do not treat EP-12 as part of v1 closure.** If EP-12 proceeds:

- Document `UserContext + economicRealityEvents` as explicit replay input
- Amend constitution §6 with feedback semantics
- Re-audit determinism under combined input model

---

## I. Final statement

> **Economic Reality v1 is architecturally closed** under strict deterministic single-source-of-truth constraints **for the EP-1→EP-11 planning and presentation pipeline**, with **conditional** status at the API boundary where EP-12 feedback events optionally enrich EP-1 input. No critical dual-authority or parallel routing systems remain after EP-11.1.

---

## Related

- [economic-reality-system-audit-v1.md](./economic-reality-system-audit-v1.md)
- [economic-reality-module-v1-roadmap.md](../economic-reality/economic-reality-module-v1-roadmap.md)
- [platform-planning-constitution-v1.md](../platform/platform-planning-constitution-v1.md)
