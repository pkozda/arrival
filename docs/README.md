---
id: docs-index
title: Arrival Atlas Documentation Index
project: Arrival Atlas
system: Arrival Atlas
type: system
domain: platform
status: active
maturity: stable
owner: system
tags:
  - documentation-system
  - domain-index
  - knowledge-base
created: 2026-06-19
updated: 2026-09-10
related:
  - taxonomy
  - product-guide-v1
---

# Arrival Atlas Documentation

Start here. This index lists **current** documentation needed to understand and work on the product.

Historical audits, PR mirrors, refactor logs, completion reports, and black-box implementation notes are preserved **outside Git** for Confluence migration:

`../arrival-atlas-local-archive/documentation/`

Stub pointers: [audits](./audits/README.md) · [pr](./pr/README.md) · [refactors](./refactors/README.md) · [archive (historical)](archive/README.md) · [black-box docs](../tools/black-box-audit/README.md)

## Start here

| Question | Document |
|----------|----------|
| What is Arrival Atlas (product behavior)? | [product/product-guide-v1.md](./product/product-guide-v1.md) |
| How do I run / deploy staging? | [deployment.md](./deployment.md) |
| Release / production constraints? | [../tools/black-box-audit/RELEASE-READINESS-CONTRACT-v1.md](../tools/black-box-audit/RELEASE-READINESS-CONTRACT-v1.md) · [production-readiness/](./production-readiness/) |
| Where are ADRs? | [decisions/README.md](./decisions/README.md) · [adr/](./adr/) |
| Platform / MRC contracts? | [platform/platform-planning-constitution-v1.md](./platform/platform-planning-constitution-v1.md) · [core/module-runtime-contract-v1.md](./core/module-runtime-contract-v1.md) |
| UX contracts? | [ux/ux-contract-v1.md](./ux/ux-contract-v1.md) |
| E2E product contracts / decisions? | [../tools/black-box-audit/E2E-PRODUCT-SPECIFICATION-v1.md](../tools/black-box-audit/E2E-PRODUCT-SPECIFICATION-v1.md) · [PRODUCT-DECISIONS-v1.md](../tools/black-box-audit/PRODUCT-DECISIONS-v1.md) |

## Domain specifications

| Domain | Start |
|--------|-------|
| Life Events | [life-events/life-state-model.md](./life-events/life-state-model.md) · [architecture freeze](./life-events/life-event-module-v2-v1.0-architecture-freeze.md) |
| Economic Reality | [economic-reality/economic-reality-module-v1-spec.md](./economic-reality/economic-reality-module-v1-spec.md) · [economic-state-model.md](./economic-reality/economic-state-model.md) |
| Discovery (PDE) | [discovery/README.md](./discovery/README.md) · [architecture](./discovery/personal-discovery-engine-architecture.md) |
| Identity / profile | [identity/profile-mutation-model-v1.md](./identity/profile-mutation-model-v1.md) · [contracts/profile-mutation-contract-summary.md](./contracts/profile-mutation-contract-summary.md) |
| Benefits / finance | [benefits/](./benefits/) · [finance/](./finance/) |
| Vision / UX principles | [vision/README.md](./vision/README.md) |

## Repository layout (docs)

```text
docs/
├── README.md                 ← you are here
├── product/                  Product Guide and cross-cutting product docs
├── adr/ + decisions/         Architecture Decision Records
├── core/ + platform/         MRC / platform contracts and roadmaps
├── life-events/              Life Event specs and models
├── economic-reality/         Economic Reality specs and models
├── discovery/                Personal Discovery Engine
├── identity/ + ux/           Profile and UX contracts
├── deployment.md             Compose / Caddy personal staging
├── production-readiness/     Current readiness surfaces
├── testing/                  Golden journeys
├── meta/                     Taxonomy and indexing tooling
├── audits|pr|refactors|archive/  → stubs; content in local archive
└── housing|legal|…           Reserved domain stubs
```

## Meta

| Resource | Path |
|----------|------|
| Taxonomy | [meta/taxonomy.md](./meta/taxonomy.md) |
| Index schema | [meta/index-schema.md](./meta/index-schema.md) |

After large documentation moves, refresh search indexes with `python3 docs/meta/index-docs.py` when available.
