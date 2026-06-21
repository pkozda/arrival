---
id: economic-reality-v1-closure-spec
title: Economic Reality v1 — Closure Spec
project: Arrival Atlas
system: Arrival Atlas
type: spec
domain: finance
status: frozen
maturity: closed
owner: architecture
tags:
  - economic-reality
  - closure
  - deterministic-pipeline
  - single-source-of-truth
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - economic-reality-module-v1-spec
  - economic-reality-system-audit-v2
  - economic-reality-module-v1-roadmap
related:
  - economic-reality-system-audit-v1
  - economic-reality-system-audit-v2
  - platform-planning-constitution-v1
---

# Economic Reality v1 — Closure Spec

**Status:** ARCHITECTURALLY CLOSED (post EP-11.1 + R-01–R-04 micro-patch)  
**Date:** 2026-06-21

---

## 1. System definition

Economic Reality v1 is a **deterministic, catalog-driven economic state machine** with strict layered projection architecture.

It transforms:

```text
UserContextV1
  → EconomicState        (EP-1)
  → GraphPlacement       (EP-2)
  → Execution State      (EP-3)
  → Action Set           (EP-4)
  → Plan                 (EP-5)
  → Presentation         (EP-6)
  → API Response         (EP-7)
  → Client Projection    (EP-8)
  → UI Surface           (EP-9)
```

Routing and copy are governed by EP-10 (catalog) and EP-11 (i18n) respectively.

---

## 2. Architectural guarantees (hard invariants)

### G1 — Single graph authority

- **EP-2** is the sole graph resolver.
- No graph hints exist in the evaluation layer.

### G2 — Single catalog authority

- `MODULE_CATALOG_V1` is the only routing source.
- No static cross-module maps.

### G3 — Linear deterministic pipeline

```text
EP-1 → EP-2 → EP-3 → EP-4 → EP-5 → EP-6 → EP-7
```

No backward dependencies between layers.

### G4 — No dual truth systems

Explicitly removed:

| Artifact | Status |
|----------|--------|
| `graphHint` | Removed |
| `cross-module-links.ts` | Removed |
| LE dual routing (`financial-reality` vs `economic-reality`) | Removed from LE graph |

### G5 — Key-only UI contract

UI constraints:

- No raw user-facing strings in economic surfaces
- No semantic logic in UI components
- Only `labelKey`, `titleKey`, `intentKey` on the wire

### G6 — Catalog-driven routing

All navigation originates from:

```text
MODULE_CATALOG_V1 + triggerEntrypoints
```

No hardcoded fallback routes. `open_module` href mismatches are ignored at the router layer (catalog route wins).

### G7 — Deterministic replay model

For a given:

```text
UserContextV1 + optional event log (EP-12 boundary)
```

the system produces:

- identical graph
- identical execution
- identical action set
- identical plan
- identical presentation
- identical `meta.deterministicHash` (given same pipeline inputs)

---

## 3. System boundaries

### INSIDE CORE (EP-1 → EP-11.1)

| Property | Value |
|----------|-------|
| Deterministic | Yes |
| Stateless (modules) | Yes |
| Catalog-driven | Yes |
| Fully testable | Yes |

### OUTSIDE CORE

| System | Role | Closure status |
|--------|------|----------------|
| **EP-12** (Feedback Layer) | Optional enrichment; event-driven mutation of EP-1 input | NOT part of closure spec |
| **financial-reality** module | External calculator / tooling layer | NOT part of institutional planning system |
| **LE-8 runtime** | Cross-module signal library (unwired) | Platform scope; not ER v1 |

---

## 4. Source of truth hierarchy

Strict priority:

1. `MODULE_CATALOG_V1`
2. `GRAPH_REGISTRY` (economic graph catalog)
3. `COPY_REGISTRY` (`ER_COPY_KEYS`)
4. `RULE ENGINE` (R1–R7)
5. `UI SURFACES` (pure projection)

No other authority layers exist in the closed system.

---

## 5. Determinism model

### Deterministic domain

| Layer | Deterministic |
|-------|---------------|
| EP-1 rule engine | YES |
| EP-2 graph | YES |
| EP-3 execution | YES |
| EP-4 actions | YES |
| EP-5 plan | YES |
| EP-6 presentation | YES |
| EP-7 API | YES |
| EP-8 client | YES |
| EP-9 UI | YES |
| EP-10 catalog routing | YES |
| EP-11 copy | YES |

### Conditional determinism

| Input | Effect |
|-------|--------|
| EP-12 event log | Modifies EP-1 input via `feedbackSignals` at API boundary |

Replay from **UserContextV1 alone** holds in `packages/modules`. Full API replay requires stored event log when EP-12 is active.

---

## 6. System invariants (formal)

### I1 — No dual authority

No two systems may define:

- graph identity
- module routing
- action semantics

### I2 — No cross-layer logic leakage

- UI cannot compute state
- Planner cannot mutate graph
- Execution cannot evaluate rules

### I3 — Catalog completeness invariant

All `open_module` actions for `economic-reality` **MUST** resolve via catalog. Missing catalog entry throws `CATALOG_ROUTE_MISSING`.

### I4 — Copy immutability

UI must never:

- generate labels
- derive text from graph semantics
- fallback to raw strings

Runtime guards:

- `validateActionSetCopyKeys` at EP-6 boundary
- `validatePresentationCopyKeys` + `validateNoRawStringsInPresentation` in `buildPresentation`

---

## 7. Architectural status

### FINAL STATUS: ARCHITECTURALLY CLOSED

Meaning:

- No missing EP stages in v1 scope
- No structural ambiguity in authority layers
- No dual authority systems in EP-1→EP-11 core
- Micro-patch polish (R-01–R-04) applied

---

## 8. Post-closure classification

| Category | Status |
|----------|--------|
| Core engine | **frozen** |
| API | **stable** |
| UI | **stable projection** |
| Catalog | **authoritative** |
| Copy system | **stable** |
| Routing | **closed** (R-01/R-02 resolved) |

---

## 9. Closure evidence chain

| Artifact | Path |
|----------|------|
| System audit v1 | [economic-reality-system-audit-v1.md](../audits/economic-reality-system-audit-v1.md) |
| EP-11.1 stabilization | arr-019 branch |
| System audit v2 | [economic-reality-system-audit-v2.md](../audits/economic-reality-system-audit-v2.md) |
| R-01–R-04 micro-patch | arr-019 branch |
| This closure spec | (this document) |

---

## 10. Final statement

> **Economic Reality v1 is a deterministic, catalog-driven economic orchestration system with fully resolved authority layers and a strict linear execution pipeline from state inference to UI projection.**

---

## Related

- [economic-reality-module-v1-spec.md](./economic-reality-module-v1-spec.md)
- [economic-reality-module-v1-roadmap.md](./economic-reality-module-v1-roadmap.md)
- [economic-reality-system-audit-v2.md](../audits/economic-reality-system-audit-v2.md)
