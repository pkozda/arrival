---
id: taxonomy
title: Documentation Taxonomy
project: Arrival Atlas
system: Arrival Atlas
type: system
domain: platform
status: active
maturity: stable
owner: system
tags:
  - documentation-system
  - metadata-schema
  - domain-index
created: 2026-06-19
updated: 2026-06-19
related:
  - index-schema
  - archive-index
---

# Arrival Atlas Documentation Taxonomy

This document defines the controlled vocabulary for the metadata-driven knowledge system under `docs/`.

## Top-level domains

| Domain | Scope |
|--------|--------|
| **core** | System-wide concepts, MRC, governance kernel, global architecture |
| **product** | UX intent, product concepts, cross-cutting product thinking |
| **onboarding** | Registration, Anmeldung, FTU flows, user setup |
| **migration** | Relocation logic, cross-country transitions |
| **identity** | Profiles, user identity model, profile merging, verification |
| **benefits** | Jobcenter, Bürgergeld, financial support simulations |
| **housing** | Accommodation, housing workflows, rent support |
| **legal** | Legal status, compliance, official procedures |
| **finance** | Payments, income, subsidies, financial modeling |
| **integrations** | External systems, APIs, connectors, data sources |
| **platform** | Infrastructure, backend, shared services, IAM |
| **research** | Exploratory work, investigations (cross-domain) |
| **audits** | Gate audits, readiness reviews, validation reports |
| **decisions** | Architecture Decision Records (ADRs) |
| **architecture** | Reserved for cross-cutting system design (prefer domain folders) |
| **refactors** | Migration logs, completed refactor reports |
| **specs** | Reserved for formal specs (prefer `core/` or domain folders) |
| **contracts** | Reserved for interface contracts (prefer domain folders) |
| **roadmap** | Reserved for planning (prefer domain folders) |
| **archive** | Deprecated or superseded documents |
| **meta** | Documentation about the documentation system |

## Document types

| Type | Use when |
|------|----------|
| **audit** | Read-only assessment, gate verdict, validation report |
| **research** | Exploration, comparison, investigation |
| **spec** | Formal technical specification |
| **adr** | Short architectural decision record |
| **ux** | UX discovery, design spec, user journey |
| **system** | Architecture design, engine design, living state |
| **contract** | Stable UI/API/data binding contract |
| **refactor** | Completed migration or refactor log |
| **roadmap** | Planned work, phases, milestones |

## Status values

| Status | Meaning |
|--------|---------|
| **active** | Current, authoritative |
| **draft** | Work in progress |
| **deprecated** | Superseded but still referenced |
| **archived** | Moved to `archive/`, historical only |

## Maturity values

| Maturity | Meaning |
|----------|---------|
| **experimental** | Early exploration, may change radically |
| **evolving** | Active development, structure stabilizing |
| **stable** | Reviewed, expected to change incrementally |

## Tag rules

Every document must include at least three semantic tags:

1. **Domain tag** — system-level area (e.g. `identity`, `benefits-calculation`)
2. **Functional tag** — what the doc does (e.g. `onboarding-ux`, `gate-audit`)
3. **Concept tag** — domain model entity (e.g. `profile-merge`, `module-runtime`)

### Good tags

- `migration-flow`, `profile-merge`, `benefits-calculation`, `ui-ready-gate`

### Bad tags

- `docs`, `file`, `folder`, `readme`

## Frontmatter schema

```yaml
---
id: unique-slug          # stable identifier for cross-references
title: Human readable title
project: Arrival Atlas
system: Arrival Atlas
type: audit | research | spec | adr | ux | system | contract | refactor | roadmap
domain: core | product | onboarding | migration | identity | benefits | housing | legal | finance | integrations | platform
status: active | draft | deprecated | archived
maturity: experimental | evolving | stable
owner: system
tags:
  - domain-tag
  - functional-tag
  - concept-tag
created: YYYY-MM-DD
updated: YYYY-MM-DD
related:
  - other-doc-id
---
```

## Placement rules

1. Prefer **domain folders** over generic `specs/`, `roadmap/`, `architecture/`.
2. Cross-cutting platform docs → `platform/` or `core/`.
3. Never delete content — move superseded docs to `archive/` and link via `related`.
4. Filename: lowercase kebab-case, no version suffixes unless meaningful.
