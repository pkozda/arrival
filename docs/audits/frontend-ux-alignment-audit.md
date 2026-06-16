# Frontend UX Alignment Audit — Arrive Atlas UI Adaptation

**Date:** June 2026  
**Scope:** `apps/web/src/` vs backend UX Orchestrator + API enrichment  
**Type:** Audit + adaptation plan (no implementation)

---

## Executive Summary

The Arrive Atlas frontend is a **module-centric, per-page rendering model**. Each module page calls `executeModule`, stores `res.data`, and renders a **bespoke result layout**. The backend now attaches an optional `ux` object (`actions[]`, `summary`) on successful execution, but the frontend **does not type, read, or render it**.

Minimal adaptation can introduce a UX-first layer **without rewriting module pages**: extend the API client, add 2–3 shared UX components, and insert them above existing module output inside `ResultPanel`. A full dashboard for cross-module aggregation does not exist today and is a Phase 2 concern.

---

## 1. Current Rendering Model

### Architecture

```
User form submit
  → executeModule(moduleId, input, context, sessionId)   [lib/api.ts]
  → POST /api/modules/:id/execute
  → res.json() → ModuleResult<T>  (moduleId, success, data, executedAt)
  → Page stores res.data only
  → Module-specific JSX inside ResultPanel
```

### Shared infrastructure

| File | Role |
|------|------|
| `lib/api.ts` | Fetch wrapper; `ModuleResult<T>` has no `ux` field |
| `components/ResultPanel.tsx` | Loading / error / children shell only |
| `components/ModuleLayout.tsx` | Title + description wrapper |
| `components/AppProvider.tsx` | Session, i18n, theme — no execution state |
| `app/page.tsx` | Module catalog grid — no results, no action plan |

### Per-module pages (all follow the same pattern)

| Page | Result type | What is rendered |
|------|-------------|------------------|
| `financial-reality/page.tsx` | `FinancialResult` | Income stats, Bürgergeld block, **`decisions[]` with priority badges** |
| `healthcare-navigation/page.tsx` | `HealthcareResult` | Warnings, scenario steps, decision options |
| `system-translation/page.tsx` | `TranslationResult` | Term cards with explanation |
| `grocery-optimization/page.tsx` | `GroceryResult` | Budget stats, stores, shopping plan, decisions |
| `life-event/page.tsx` | `LifeEventResult` | Phases, actions, checklist |

**Not in web:** `benefits-simulator` (backend module exists, no page).

### UX layer usage today

**Ignored entirely.**

Evidence:

```11:18:apps/web/src/lib/api.ts
export interface ModuleResult<T = unknown> {
  moduleId: string;
  version: string;
  success: boolean;
  data?: T;
  error?: string;
  executedAt: string;
}
```

Every module page pattern:

```ts
setResult(res.data as SomeResult);  // ux discarded
```

### Parallel guidance paths (duplication risk)

**Financial Reality** is the clearest overlap:

- Backend UX Orchestrator derives action cards from `adminRules`, `decisions`, `benefits.buergergeld`.
- Frontend renders `result.decisions[]` directly with `badge-high/medium/low` styling.
- `adminRules: string[]` is typed in `FinancialResult` but **never rendered** — yet it drives UX actions (Anmeldung, Krankenkasse).

**Healthcare Navigation** renders `warnings[]` and step-by-step guidance — semantically similar to UX `no_insurance` cards but structurally different and not cross-module prioritized.

There is **no shared action-card component**; priority styling exists only on financial-reality decisions via CSS badges in `globals.css`.

---

## 2. Gaps vs Arrive Atlas UX Model

### Backend UX model (API response)

When `ATLAS_UX_ENABLED` is true (default):

```ts
{
  moduleId, version, success, data, executedAt,
  ux?: {
    actions: UXActionCard[];   // id, title, description, priority, source
    summary: string;
  }
}
```

Note: **`signals[]` are not exposed** in the API — only `actions` and `summary`. Frontend cannot render severity/domain signals without a future API extension.

### Gap matrix

| Backend capability | Frontend support | Gap |
|--------------------|------------------|-----|
| `ux.summary` | None | No summary banner anywhere |
| `ux.actions[]` | None | No unified action card renderer |
| Cross-module priority order | None | Single-module pages only; no aggregation view |
| `UXActionCard.source` | None | No module provenance badge |
| `UXActionCard.priority` | Partial | Only financial `decisions[].priority` — different shape |
| Feature-flag absence (`ux` missing) | N/A | No fallback path defined |
| Profile-bound execution | Session used | UX benefits from profile (e.g. Anmeldung) but UI doesn't show UX output |
| Multi-module action plan | API single-module only | No batch execute; home page can't show combined plan without client-side aggregation |

### Specific mismatches

1. **Type contract drift** — `ModuleResult` ≠ `UxEnrichedExecutionResult` from API.
2. **Guidance duplication** — financial `decisions[]` vs `ux.actions[]` may show overlapping content with different wording/order.
3. **Hidden admin rules** — UX surfaces Anmeldung/Krankenkasse from `adminRules`; UI never showed `adminRules` directly.
4. **No “next best actions” surface** — product promise of UX Orchestrator is invisible in UI.
5. **No benefits-simulator UI** — UX layer supports the domain; frontend has no entry point.

---

## 3. Required UI Changes (Plan Only)

### A. New components needed

| Component | Responsibility | Reuse |
|-----------|----------------|-------|
| **`UxSummaryBanner`** | 1–3 sentence `ux.summary` at top of result area | All module pages |
| **`UxActionCard`** | Single card: title, description, priority badge, optional source chip | List item |
| **`UxActionPlan`** | Groups actions by `high` → `medium` → `low`; renders summary + groups | Wrapper used inside `ResultPanel` |
| **`UxSourceBadge`** (optional) | Shows `source` module id (e.g. financial-reality) | Debugging / multi-module future |
| **`ModuleDetailsCollapsible`** (optional) | Raw module output behind “View details” | Reduces clutter in UX-first mode |

**Do not duplicate** module-specific renderers (income breakdown, healthcare steps, translation cards). UX components sit **above** them.

### B. Data adaptation layer

**File:** `apps/web/src/lib/ux.ts` (proposed)

```ts
// Types aligned with @arrivalos/ux / API ux-integration.ts
export interface UxActionCard {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  source: string;
}

export interface UxPayload {
  actions: UxActionCard[];
  summary: string;
}

// Extend ModuleResult in api.ts:
export interface ModuleResult<T = unknown> {
  // ...existing
  ux?: UxPayload;
}

export function getUxPayload(result: ModuleResult): UxPayload | null {
  if (!result.ux?.actions) return null;
  return result.ux;
}

export function groupActionsByPriority(actions: UxActionCard[]) {
  return {
    high: actions.filter(a => a.priority === 'high'),
    medium: actions.filter(a => a.priority === 'medium'),
    low: actions.filter(a => a.priority === 'low'),
  };
}
```

**Fallback rules:**

- `ux` absent → render module output only (current behavior).
- `ux.actions.length === 0` → optional neutral empty state or skip UX block.
- Never fail render if `ux` is malformed — treat as absent.

**Optional:** import types from `@arrivalos/ux` in web package (add dependency) to avoid drift.

### C. Layout changes

**Recommended per-module page structure:**

```
┌─────────────────────────────────────┐
│ Form (unchanged)                    │
├─────────────────────────────────────┤
│ ResultPanel                         │
│  ├─ UxSummaryBanner                 │  ← NEW (if ux present)
│  ├─ UxActionPlan (grouped cards)    │  ← NEW
│  └─ Module-specific output          │  ← EXISTING (optionally collapsible)
└─────────────────────────────────────┘
```

**Financial-reality specific:** consider **hiding or demoting** the `Decisions` card when `ux.actions` covers the same topics (Anmeldung, Bürgergeld, Wohngeld) to avoid duplicate guidance. Keep income/Bürgergeld **data** blocks — they are analytical, not action cards.

**Debug mode:** `?debug=1` or `NEXT_PUBLIC_SHOW_RAW_MODULE=1` keeps full module output expanded; default UX-first can collapse raw sections.

**Home page (Phase 2):** optional “Your next steps” panel fed by last execution UX or a future aggregated endpoint — not required for MVP alignment.

---

## 4. UX-First Rendering Proposal

### Single module page (Phase 1 — minimal)

1. **Summary** — full-width banner, primary accent, `ux.summary`
2. **High priority actions** — card list, red/high badge (reuse `.badge-high`)
3. **Medium / low actions** — collapsed section or smaller cards
4. **Module details** — existing module JSX, collapsed by default when `ux.actions.length > 0`

### Cross-module vision (Phase 2 — requires product/API decision)

Option A — **Client-side session store:** cache last `ux` from each module execution; home/dashboard merges client-side (no new API).

Option B — **New API endpoint:** `POST /api/ux/action-plan` accepting multiple module results (matches `collectUxModuleOutputs` pattern server-side).

Recommended: **Phase 1 single-module first**; Phase 2 Option B for true “Arrive Atlas dashboard.”

### Visual hierarchy

| Zone | Content | User intent |
|------|---------|-------------|
| Top | Summary | “What should I do next?” |
| Middle | Action cards | Actionable steps, prioritized |
| Bottom | Module output | Evidence, numbers, steps, glossary |

---

## 5. Risk Analysis

| Risk | Severity | Mitigation |
|------|----------|------------|
| Duplicate guidance (financial `decisions` + `ux.actions`) | Medium | UX-first mode hides redundant decision list; map overlap by `id` / keywords |
| Users lose detail when collapsing raw output | Medium | Collapsed by default, not removed; debug flag |
| `ATLAS_UX_ENABLED=false` in prod | Low | Fallback already matches today; no UX block |
| Type drift web ↔ `@arrivalos/ux` | Medium | Shared type import or codegen from ux package |
| Healthcare steps vs UX insurance card redundancy | Low | Keep steps as detail; UX card is headline action |
| Over-rendering complexity | Medium | One `UxActionPlan` wrapper, not per-module UX logic |
| i18n — UX strings English-only from orchestrator | Medium | Future: pass language to orchestrator; Phase 1 accept EN |
| No signals in API | Low | Frontend doesn't need signals for MVP; actions are sufficient |

**Breaking behavior:** None if UX block is additive and raw output remains accessible.

---

## 6. Migration Path

### Phase 1 — Foundation (smallest viable UX-first UI)

1. Add `@arrivalos/ux` types (or mirror) to web `ModuleResult`
2. Create `UxSummaryBanner`, `UxActionCard`, `UxActionPlan`
3. Integrate into **`financial-reality/page.tsx` only** (highest UX overlap, profile-driven admin rules)
4. Verify with profile bound + `daysInGermany: 90` → Anmeldung card visible
5. Add 2–3 component tests / snapshot tests for action grouping

**Estimated touch:** ~4 new files, ~2 modified files (`api.ts`, one module page).

### Phase 2 — Rollout

1. Wrap shared pattern: `ModuleResultView` = `UxActionPlan` + children
2. Apply to `healthcare-navigation`, `system-translation`
3. Demote duplicate decision/warning UI where UX supersedes
4. Add i18n keys for UX section headers (“Your next steps”, “Details”)

### Phase 3 — Product surface

1. Home dashboard “Next best actions” (session-scoped or profile-scoped)
2. Benefits Simulator page + UX integration
3. Optional API batch UX endpoint for true multi-module plan

### Phase 4 — Polish

1. Expose `signals[]` in API if UI needs severity/domain diagnostics
2. Link action cards to module deep-links (`/modules/healthcare-navigation?situation=insurance-choice`)
3. Remove redundant module-level decision rendering where 100% covered by UX layer

---

## 7. Files to Change (Implementation Checklist)

| Priority | File | Change |
|----------|------|--------|
| P0 | `apps/web/src/lib/api.ts` | Add `ux?` to `ModuleResult` |
| P0 | `apps/web/src/lib/ux.ts` | New — types + helpers |
| P0 | `apps/web/src/components/UxActionPlan.tsx` | New — summary + grouped cards |
| P1 | `apps/web/src/app/modules/financial-reality/page.tsx` | Store full `res`, render `UxActionPlan` above stats |
| P1 | `apps/web/package.json` | Optional `@arrivalos/ux` dependency |
| P2 | Other module pages | Same wrapper pattern |
| P2 | `apps/web/src/app/page.tsx` | Optional dashboard strip |
| P3 | `apps/web/src/app/globals.css` | UX banner styles if needed |

**Do not modify:** module packages, profile engine, API orchestrator (already done).

---

## 8. Success Criteria Mapping

| Criterion | Audit outcome |
|-----------|---------------|
| Clear backend ↔ frontend mapping | §2 gap matrix + §4 layout |
| Minimal UI changes | Phase 1 = 1 module + 3 components + api types |
| No duplication of module rendering logic | UX layer wraps existing JSX, does not replace |
| Migration path to UX-first UI | §6 phased plan |

---

## 9. Conclusion

The frontend is **structurally ready** for UX alignment: thin API client, shared `ResultPanel`, isolated module pages. The missing piece is a **small shared UX presentation layer** and **typing the `ux` envelope** already returned by the API.

**Recommended first PR:** UX components + financial-reality integration only — proves end-to-end value (Module execution → UX interpretation → visible action plan) with lowest risk and no architectural rewrite.
