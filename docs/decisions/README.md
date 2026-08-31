---
id: decisions-index
title: Architecture Decision Records Index
project: Arrival Atlas
system: Arrival Atlas
type: system
domain: platform
status: active
maturity: stable
owner: system
tags:
  - adr
  - decision-log
created: 2026-06-01
updated: 2026-08-30
related:
  - personal-discovery-engine-architecture
---

# Architecture Decision Records (ADR)

Reserved for short, durable decision records using the format:

```text
Title
Context
Decision
Consequences
Status (proposed | accepted | superseded)
```

Formal ADRs currently live under [../adr/](../adr/):

| ADR | Topic |
|-----|-------|
| [ADR-001](../adr/adr-001-life-event-layered-architecture.md) | Life Event layered architecture |
| [ADR-002](../adr/adr-002-action-vs-execution-boundary.md) | Action vs execution boundary |
| [ADR-003](../adr/adr-003-le-layer-realignment.md) | LE layer realignment |
| [ADR-004](../adr/adr-004-le-7-scenario-overlay.md) | LE-7 scenario overlay |
| [ADR-005](../adr/adr-005-le-8-module-runtime-mrc.md) | LE-8 module runtime MRC |
| [ADR-006](../adr/adr-006-personal-discovery-engine-boundaries.md) | Personal Discovery Engine boundaries |
| [ADR-006 addendum](../adr/adr-006-addendum-e1-api-spike.md) | PDE E1 API spike decisions |
| [ADR-006 addendum](../adr/adr-006-addendum-e3-1-adapter-infra.md) | PDE E3.1 adapter infrastructure boundaries |
| [ADR-006 addendum](../adr/adr-006-addendum-e3-2-search-adapter.md) | PDE E3.2 first real search adapter (Brave) |
| [ADR-006 addendum](../adr/adr-006-addendum-e3-3-fetch-adapter.md) | PDE E3.3 production fetch adapter (HTTP) |
| [ADR-006 addendum](../adr/adr-006-addendum-e3-4-content-extractor.md) | PDE E3.4 production content extractor |
| [ADR-006 addendum](../adr/adr-006-addendum-e3-5-verification-adapter.md) | PDE E3.5 production verification adapter |
| [ADR-006 addendum](../adr/adr-006-addendum-e3-6-ai-adapter.md) | PDE E3.6 production AI adapter (OpenAI) |
| [ADR-006 addendum](../adr/adr-006-addendum-e3-7-production-composition.md) | PDE E3.7 production adapter composition |
| [ADR-006 addendum](../adr/adr-006-addendum-e3-8-production-smoke-hardening.md) | PDE E3.8 production smoke & contract hardening |
| [ADR-006 addendum](../adr/adr-006-addendum-e4-1-durable-result-persistence.md) | PDE E4.1 durable Result persistence (SQLite) |
| [ADR-006 addendum](../adr/adr-006-addendum-e4-2-scheduler.md) | PDE E4.2 discovery scheduler |
| [ADR-006 addendum](../adr/adr-006-addendum-e4-3-execution-queue.md) | PDE E4.3 execution queue |
| [ADR-006 addendum](../adr/adr-006-addendum-e4-4-notifications.md) | PDE E4.4 notifications |
| [ADR-006 addendum](../adr/adr-006-addendum-e4-5-production-email-notifications.md) | PDE E4.5 production email (Resend) |
| [ADR-006 addendum](../adr/adr-006-addendum-e4-6-telegram-notification.md) | PDE E4.6 Telegram notifications |
| [ADR-006 addendum](../adr/adr-006-addendum-e4-7-production-runtime-readiness.md) | PDE E4.7 production runtime readiness (E4 complete) |

Formal specifications and long-form design docs belong in [../core/](../core/) and domain folders (e.g. [../platform/](../platform/), [../identity/](../identity/), [../discovery/](../discovery/)) instead.

When adding an ADR, name it `adr-NNN-short-title.md` under `docs/adr/` (e.g. `adr-006-personal-discovery-engine-boundaries.md`).
