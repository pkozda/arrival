# Module Runtime Contract v1.0 — Evolution Roadmap

**Project:** Arrival Atlas  
**Document Type:** Architecture Roadmap  
**Domain:** Module Runtime Platform  
**Status:** Proposed  
**Version:** 0.1  
**Date:** June 2026  

**Related documents:**

- [Module Runtime Contract v1.0 Specification](./module-runtime-contract-v1-specification.md)
- [IAM Evolution Roadmap](./iam-evolution-roadmap.md)
- [Financial Module v2 — Architecture Notes](./financial-module-v2-notes.md)
- [P7.0 — Module Runtime Architecture Audit](../audits/p7-0-module-runtime-architecture-audit.md)
- [User Profile Engine Runtime Unification Report](../audits/user-profile-engine-runtime-unification-report.md)

---

## 1. Executive Summary

Arrival Atlas currently contains multiple independent execution engines:

* Financial Reality
* Benefits Simulator
* Local Benefits (planned)
* Community Support Modules (planned)
* Housing Modules (planned)
* Integration Modules (planned)

While these modules share common goals, they do not yet operate under a formally defined runtime contract.

The purpose of Module Runtime Contract v1.0 is to establish a unified execution model that governs:

* module inputs
* module outputs
* traceability
* explainability
* recommendations
* actions
* UI integration

The contract becomes the boundary between:

```text
Profile System
      ↓
Module Runtime
      ↓
UI Snapshot
```

and ensures all future modules behave consistently regardless of domain.

---

## 2. Architectural Goals

Module Runtime v1.0 must guarantee:

### Deterministic execution

Identical inputs produce identical outputs.

### Explainable results

Every recommendation must provide reasoning.

### Auditable behavior

Every execution must provide trace data.

### UI independence

Modules never render UI directly.

### Profile isolation

Modules cannot mutate DPSS or Profile Engine state.

### Extensibility

Future modules must plug into the runtime without custom orchestration logic.

---

## 3. Target Architecture

```text
DPSS
 │
 ▼
Profile Engine
 │
 ▼
Runtime Context Builder
 │
 ▼
┌───────────────────────────┐
│     Module Runtime        │
├───────────────────────────┤
│ Financial Reality         │
│ Benefits Simulator        │
│ Local Benefits            │
│ Housing Support           │
│ Tafel Discovery           │
│ Future Modules            │
└───────────────────────────┘
 │
 ▼
Module Results
 │
 ▼
Explanation Engine
 │
 ▼
UI Snapshot
```

---

## 4. Roadmap Phases

### Phase MRC-1 — Runtime Foundations

#### Goal

Define the core runtime contract.

#### Deliverables

* ModuleMetadata
* ModuleCapabilities
* ModuleRuntimeContext
* ModuleResult
* ModuleTrace

#### Success Criteria

* All interfaces formally defined
* Runtime package created
* No module-specific logic included

---

### Phase MRC-2 — Execution Standardization

#### Goal

Migrate existing modules to the runtime contract.

#### Scope

**Financial Reality**

Replace custom output structures with ModuleResult.

**Benefits Simulator**

Replace custom output structures with ModuleResult.

#### Deliverables

* Unified `execute()`
* Unified `trace()`
* Shared runtime interfaces

#### Success Criteria

* Existing modules execute through the same runtime API
* No module-specific adapters required

---

### Phase MRC-3 — Explanation Layer

#### Goal

Introduce a common explanation model.

#### Deliverables

```typescript
ModuleExplanation
ExplanationFactor
```

#### Features

* reasoning
* factors
* confidence level

#### Success Criteria

Every recommendation produced by a module includes explanation data.

---

### Phase MRC-4 — Action Framework

#### Goal

Standardize user actions.

#### Deliverables

```typescript
ActionItem
Recommendation
```

#### Supported Actions

* apply
* contact
* collect-documents
* schedule

#### Success Criteria

All modules expose actions through a shared schema.

---

### Phase MRC-5 — Runtime Registry

#### Goal

Create a module registry.

#### Deliverables

```typescript
ModuleRegistry
```

#### Features

* module discovery
* version management
* capability inspection

#### Success Criteria

New modules register through the registry only.

---

### Phase MRC-6 — UI Snapshot Integration

#### Goal

Integrate runtime outputs into UI Snapshot.

#### Deliverables

* Snapshot transformation layer
* Module card model
* Action model
* Insight model

#### Success Criteria

Frontend consumes UI Snapshot only.

No frontend knowledge of:

* DPSS
* Profile Engine
* Runtime internals

---

### Phase MRC-7 — Runtime Governance

#### Goal

Protect long-term architectural consistency.

#### Deliverables

Contract rules:

* modules are deterministic
* modules are side-effect free
* modules provide explanations
* modules provide traces

#### Success Criteria

Contract tests prevent runtime regressions.

---

## 5. Non-Goals (v1)

The following are explicitly out of scope:

* OAuth integration
* AI-generated recommendations
* Event-driven execution
* Streaming responses
* Background workers
* External API orchestration
* Billing integration
* Marketplace functionality

---

## 6. Acceptance Criteria

Module Runtime Contract v1.0 is complete only if:

### Runtime

* Every module executes through a common runtime interface.
* Every module receives ModuleRuntimeContext.

### Explainability

* Every recommendation contains explanation metadata.

### Auditability

* Every module exposes trace output.

### UI

* UI Snapshot is generated from ModuleResult objects only.

### Governance

* Contract tests enforce runtime invariants.

---

## 7. Future Evolution

After Module Runtime Contract v1.0 is complete, the platform can evolve toward:

### v2.0

* Async execution
* External providers
* Workflow orchestration

### v3.0

* AI-assisted recommendations
* Adaptive action plans
* Cross-module reasoning

### v4.0

* Marketplace modules
* Third-party developer SDK

---

## 8. Outcome

Module Runtime Contract v1.0 establishes a single execution standard for Arrival Atlas.

It ensures that every present and future module:

```text
Receives the same context
Executes the same way
Explains its reasoning
Produces auditable results
Integrates into UI consistently
```

This contract becomes the foundation for UI Snapshot Contract v1.0 and Explanation Engine v1.0.
