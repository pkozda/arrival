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
updated: 2026-06-19
related:
  - taxonomy
  - index-schema
---

# Arrival Atlas Documentation

Central index for the Arrival Atlas knowledge system. Documents are organized by **domain** (what part of the newcomer integration platform they describe), not by author or date.

Every document includes YAML frontmatter (`id`, `type`, `domain`, `tags`, `related`) for agent indexing and search. See [meta/taxonomy.md](./meta/taxonomy.md).

## Top-level structure

```text
docs/
├── README.md              ← you are here
├── core/                  MRC, governance kernel, global platform state
├── product/               Cross-cutting product concepts
├── onboarding/            Registration, Anmeldung, FTU flows
├── migration/             Relocation logic, cross-country transitions
├── identity/              Profiles, merging, verification, profile UX
├── benefits/              Jobcenter, Bürgergeld, benefit simulations
├── housing/               Accommodation, rent support
├── legal/                 Legal status, compliance, official procedures
├── finance/               Income, subsidies, financial modeling
├── integrations/          External APIs, connectors, data sources
├── platform/              IAM, infrastructure, platform roadmaps
├── audits/                Gate audits, readiness reviews
├── decisions/             Architecture Decision Records (ADRs)
├── refactors/             Completed migration and refactor logs
├── archive/               Superseded historical documents
└── meta/                  Taxonomy, index schema, tooling
```

## Domain guide

| Domain | Put documents here when they… |
|--------|--------------------------------|
| **core/** | Define system-wide architecture, MRC, governance kernel |
| **product/** | Describe cross-cutting UX or product concepts |
| **identity/** | Cover profiles, user context, profile UX, merging |
| **benefits/** | Cover Jobcenter, Bürgergeld, benefit simulations |
| **finance/** | Cover income, payroll, subsidies, financial modules |
| **platform/** | Cover IAM, backend, shared services, platform evolution |
| **onboarding/** | Cover registration, Anmeldung, first-time user setup |
| **migration/** | Cover relocation assistance, cross-border transitions |
| **audits/** | Record read-only assessments and gate verdicts |
| **refactors/** | Document completed migrations and refactors |
| **decisions/** | Short ADRs with context, decision, consequences |
| **archive/** | Superseded docs kept for history |

Reserved empty domains (`housing/`, `legal/`, `integrations/`) have stub indexes — add docs as those areas grow.

## Key documents (start here)

### Platform & core

| Document | Path |
|----------|------|
| Living platform state | [core/current-state.md](./core/current-state.md) |
| MRC-6 → Platform roadmap | [platform/mrc-6-to-platform-roadmap.md](./platform/mrc-6-to-platform-roadmap.md) |
| Roadmap vs current state | [platform/roadmap-vs-current-state.md](./platform/roadmap-vs-current-state.md) |
| Module Runtime Contract v1 | [core/module-runtime-contract-v1.md](./core/module-runtime-contract-v1.md) |
| MRC ADL | [core/mrc-adl.md](./core/mrc-adl.md) |
| UI Ready Gate audit | [audits/ui-ready-gate-audit.md](./audits/ui-ready-gate-audit.md) |

### Identity & profile

| Document | Path |
|----------|------|
| UX Contract v1 (Home · Modules · Profile) | [ux/ux-contract-v1.md](./ux/ux-contract-v1.md) |
| UX Contract v2 (Mutation Semantics) | [ux/ux-contract-v2.md](./ux/ux-contract-v2.md) |
| Profile UX design prompt | [identity/profile-ux-design-prompt.md](./identity/profile-ux-design-prompt.md) |
| Profile UX discovery | [identity/profile-ux-discovery.md](./identity/profile-ux-discovery.md) |
| Profile UX design spec | [identity/profile-ux-spec.md](./identity/profile-ux-spec.md) |
| Profile System v1 roadmap | [identity/profile-system-v1-roadmap.md](./identity/profile-system-v1-roadmap.md) |
| Profile Mutation Model v1 | [identity/profile-mutation-model-v1.md](./identity/profile-mutation-model-v1.md) |
| Profile mutation contract summary | [contracts/profile-mutation-contract-summary.md](./contracts/profile-mutation-contract-summary.md) |
| User Profile Engine design | [identity/user-profile-engine-design.md](./identity/user-profile-engine-design.md) |

### Benefits & finance

| Document | Path |
|----------|------|
| Benefits simulator design | [benefits/benefits-simulator-design.md](./benefits/benefits-simulator-design.md) |
| Benefits UI contract | [benefits/benefits-simulator-ui-contract.md](./benefits/benefits-simulator-ui-contract.md) |
| Financial module v2 plan | [finance/financial-module-v2-plan.md](./finance/financial-module-v2-plan.md) |

### Gate audit chain

| Phase | Document |
|-------|----------|
| P5.0 | [audits/p5-0-full-system-architecture-audit.md](./audits/p5-0-full-system-architecture-audit.md) |
| P7.0 | [audits/p7-0-module-runtime-architecture-audit.md](./audits/p7-0-module-runtime-architecture-audit.md) |
| P7.1 | [audits/p7-1-mrc-3-semantic-layer-gate-audit.md](./audits/p7-1-mrc-3-semantic-layer-gate-audit.md) |
| P7.2 | [audits/p7-2-mrc-5-registry-hardening-gate-audit.md](./audits/p7-2-mrc-5-registry-hardening-gate-audit.md) |

## Adding new documentation

1. Choose the **domain folder** using the guide above.
2. Name the file in kebab-case (no `v1`, `final`, `latest` unless meaningful).
3. Add YAML frontmatter per [meta/taxonomy.md](./meta/taxonomy.md).
4. Link related docs via `related:` IDs and relative paths.
5. If superseding an existing doc, move the old version to `archive/` and cross-link both ways.
6. Run `python3 docs/meta/index-docs.py` to refresh the search index.

## Meta & tooling

| Resource | Path |
|----------|------|
| Taxonomy & tag rules | [meta/taxonomy.md](./meta/taxonomy.md) |
| RAG index schema | [meta/index-schema.md](./meta/index-schema.md) |
| Document index (JSON) | [meta/docs-index.json](./meta/docs-index.json) |
| Section chunks (JSONL) | [meta/docs-chunks.jsonl](./meta/docs-chunks.jsonl) |
| Migration script | [meta/migrate-docs.py](./meta/migrate-docs.py) |
| Link fixer | [meta/fix-links.py](./meta/fix-links.py) |

## Archive policy

Documents move to **archive/** when superseded, deprecated, or no longer active. Archived docs are never deleted. See [archive/README.md](./archive/README.md).
