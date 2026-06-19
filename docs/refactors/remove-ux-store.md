---
id: remove-ux-store
title: Remove UX Store Refactor
project: Arrival Atlas
system: Arrival Atlas
type: refactor
domain: platform
status: active
maturity: stable
owner: system
tags:
  - snapshot-projection
  - ui-state
created: 2026-06-01
updated: 2026-06-19
related:
---

# P4.2 — Remove ux-store Completely

**Date:** June 2026  
**Status:** Complete  
**Scope:** Frontend cleanup — no backend changes, no business logic changes

---

## Objective

Eliminate the legacy `ux-store` parallel UX architecture and establish `UiSnapshot.uxSnapshot` as the **only** UX read model in the application.

---

## Pre-Refactor Inventory

| File | Usage | Active Route? | Safe To Remove? |
|------|-------|---------------|-----------------|
| `apps/web/src/lib/ux-store.ts` | Module singleton; `recordModuleUx`, subscriptions | No writers; no readers on active routes | **Yes** |
| `apps/web/src/lib/ux-aggregator.ts` | `buildGlobalUxPlan`, `buildAttentionFocus`, `hasGlobalUx` from ux-store | No | **Yes** |
| `apps/web/src/components/GlobalUxPanel.tsx` | Reads ux-aggregator + ux-store | No — only via FtuHomeExperience | **Yes** |
| `apps/web/src/components/UxAttentionLayer.tsx` | Reads ux-aggregator + ux-store | No | **Yes** |
| `apps/web/src/components/ProfileInsightBanner.tsx` | `ProfileInsightBannerFromStore` reads ux-store | No | **Yes** |
| `apps/web/src/components/ProfileSurfacePanel.tsx` | `ProfileSurfacePanelFromStore` reads ux-store | No | **Yes** |
| `apps/web/src/components/ExploreModulesSection.tsx` | `hasGlobalUx()` from ux-store | No | **Yes** |
| `apps/web/src/components/FtuHomeExperience.tsx` | Mounts all legacy UX components | **No — unmounted** | **Yes** |
| `apps/web/src/lib/profile-insight.ts` | Derives insight from ux-store actions | No | **Yes** |
| `apps/web/src/lib/profile-surface.ts` | Derives surface from ux-store actions | No | **Yes** |
| `apps/web/src/lib/ftu.ts` | FTU localStorage; only imported by FtuHomeExperience | No | **Yes** (orphaned) |
| `apps/web/src/lib/snapshot/selectors/get-module-ux.ts` | Module UX from snapshot | **Yes — module pages** | **Keep — already snapshot-driven** |
| `apps/web/src/components/home/HomeSnapshotRenderer.tsx` | Direct `uxSnapshot` field access | **Yes — home page** | **Keep — refactored to selectors** |

---

## UX State Architecture Diagram

### Before

```text
                    ┌─────────────────┐
                    │   UiSnapshot    │
                    │  .uxSnapshot    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     HomeSnapshotRenderer  getModuleUx   (unused path)
              │              │
              ▼              ▼
            Home UI      Module UI

     ┌──────────────┐
     │   ux-store   │ ← recordModuleUx (removed in P4)
     └──────┬───────┘
            │
     ┌──────▼───────┐
     │ux-aggregator │
     └──────┬───────┘
            │
   GlobalUxPanel / UxAttentionLayer /
   ProfileInsight* / ExploreModulesSection
            │
            ▼
     (unmounted legacy home)
```

### After

```text
UiSnapshot.uxSnapshot
        ↓
   Pure Selectors
   ├── getGlobalUxActions(snapshot)
   ├── getPrioritySignals(snapshot)
   ├── getAttentionLayer(snapshot)
   ├── hasGlobalUx(snapshot)
   └── getModuleUx(snapshot, moduleId)
        ↓
        UI
   ├── HomeSnapshotRenderer
   └── Module pages (via useSnapshotReconstruction)
```

---

## Files Removed

| File | Reason |
|------|--------|
| `apps/web/src/lib/ux-store.ts` | Parallel UX singleton |
| `apps/web/src/lib/ux-aggregator.ts` | ux-store consumer |
| `apps/web/src/lib/profile-insight.ts` | Legacy insight derivation from ux-store actions |
| `apps/web/src/lib/profile-surface.ts` | Legacy surface derivation from ux-store actions |
| `apps/web/src/lib/ftu.ts` | Orphaned after FtuHomeExperience removal |
| `apps/web/src/components/GlobalUxPanel.tsx` | ux-store reader |
| `apps/web/src/components/UxAttentionLayer.tsx` | ux-store reader |
| `apps/web/src/components/ProfileInsightBanner.tsx` | ux-store reader |
| `apps/web/src/components/ProfileSurfacePanel.tsx` | ux-store reader |
| `apps/web/src/components/ExploreModulesSection.tsx` | ux-store reader |
| `apps/web/src/components/FtuHomeExperience.tsx` | Legacy home orchestrator |

**Total removed:** 11 files

---

## Files Modified

| File | Change |
|------|--------|
| `apps/web/src/lib/snapshot/selectors/get-global-ux.ts` | **New** — `getGlobalUxActions`, `getPrioritySignals`, `getAttentionLayer`, `hasGlobalUx` |
| `apps/web/src/lib/snapshot/selectors/ux-action-card.ts` | **New** — shared `isUxActionCard`, `parseUxActionCards` |
| `apps/web/src/lib/snapshot/selectors/get-module-ux.ts` | Uses shared `ux-action-card` helper |
| `apps/web/src/lib/snapshot/selectors/index.ts` | Exports global UX selectors |
| `apps/web/src/lib/snapshot/index.ts` | Barrel exports for global UX selectors |
| `apps/web/src/components/home/HomeSnapshotRenderer.tsx` | UX sections via selectors instead of direct field access |

---

## Imports Removed

From deleted components (no longer exist):

- `subscribeUxStore`, `getUxStoreVersion` from `@/lib/ux-store`
- `buildGlobalUxPlan`, `buildAttentionFocus`, `hasGlobalUx` from `@/lib/ux-aggregator`
- `recordModuleUx`, `setUx`, `getUx`, `getAllUxByModule`, `clearUx` — entire API eliminated

Module pages had already removed `recordModuleUx` in P4 — no further module page changes required.

---

## Selector Additions

All pure, read-only, deterministic:

```typescript
// get-global-ux.ts
getGlobalUxActions(snapshot: UiSnapshot | null): UxActionCard[]
getPrioritySignals(snapshot: UiSnapshot | null): unknown[]
getAttentionLayer(snapshot: UiSnapshot | null): UxActionCard[]
hasGlobalUx(snapshot: UiSnapshot | null): boolean

// get-module-ux.ts (pre-existing, unchanged behavior)
getModuleUx(snapshot: UiSnapshot | null, moduleId: string): UxPayload | null
```

---

## Validation

### Q1: Can any UX card appear on screen without being derivable from UiSnapshot?

**No.**

Evidence:
- Home: `HomeSnapshotRenderer` → `getGlobalUxActions`, `getAttentionLayer` from passed `snapshot`
- Modules: `useSnapshotReconstruction` → `getModuleUx` → `snapshot.uxSnapshot.actionCards`
- No alternate UX write or read path remains

### Q2: Can any component render UX state from a source other than UiSnapshot?

**No.**

Evidence:
- Grep `ux-store`, `recordModuleUx`, `buildGlobalUxPlan`, `buildAttentionFocus` in `apps/web/src` → **0 runtime references**
- `UxActionPlan` / `ModuleResultRenderer` receive UX derived from snapshot selectors only

### Q3: Can re-enabling legacy home components recreate split-brain UX?

**No.**

Evidence:
- Legacy components deleted — source files no longer exist
- `ux-store.ts` deleted — no singleton to repopulate

---

## Success Criteria

| Criterion | Result |
|-----------|--------|
| ux-store removed | ✅ |
| ux-aggregator removed | ✅ |
| recordModuleUx removed | ✅ |
| No UX singleton state remains | ✅ |
| Home UX derives from UiSnapshot | ✅ (via selectors) |
| Module UX derives from UiSnapshot | ✅ (unchanged from P4) |
| Search `ux-store` → zero runtime references | ✅ |
| Search `recordModuleUx` → zero references | ✅ |
| Split-brain UX architecture eliminated | ✅ |
| Typecheck passing | ✅ |

---

## Final Verdict

> **Is UiSnapshot now the only UX read authority in the application?**

**Yes.**

All UX rendering paths in the active application trace to `UiSnapshot.uxSnapshot`:

| Render path | Selector | Snapshot field |
|-------------|----------|----------------|
| Home action cards | `getGlobalUxActions` | `uxSnapshot.actionCards` |
| Home attention layer | `getAttentionLayer` | `uxSnapshot.attentionLayer` |
| Home priority signals | `getPrioritySignals` | `uxSnapshot.prioritySignals` |
| Module UX panels | `getModuleUx` | `uxSnapshot.actionCards` (filtered by `source`) |

No client-side UX singleton, aggregator, or parallel store exists. The latent split-brain architecture identified in P4.1 audit item **D1** is fully eliminated.

---

*Refactor verified: `npm run typecheck --workspace=apps/web` passing.*
