---
id: personal-discovery-engine-mvp
title: Personal Discovery Engine — MVP Scope
project: Arrival Atlas
system: Arrival Atlas
type: spec
domain: discovery
status: proposed
maturity: evolving
owner: product
tags:
  - discovery
  - pde
  - mvp
created: 2026-08-30
updated: 2026-08-30
depends_on:
  - personal-discovery-engine-architecture
  - personal-discovery-engine-roadmap
related:
  - adr-006-personal-discovery-engine-boundaries
  - discovery-domain-index
---

# Personal Discovery Engine — MVP Scope

**Status:** Proposed  
**Goal:** Prove the core loop before expanding categories or channels.

> **criteria → discovery → verification → ranking → notification**

Canonical design: [personal-discovery-engine-architecture.md](./personal-discovery-engine-architecture.md)  
Epic map: [personal-discovery-engine-roadmap.md](./personal-discovery-engine-roadmap.md)

---

## MVP in one sentence

A user creates a Job or Giveaway Discovery Profile; Arrival Atlas runs on a daily schedule, verifies candidates with evidence, ranks using **strategy-defined** scoring (match, confidence, freshness, novelty, opportunity value — not a fixed global product formula), and emails an attention-optimized digest only when something new or meaningfully updated deserves notice.

---

## In scope

### Domain

- DiscoveryProfile
- Strategy (versioned)
- Candidate / Result
- Verification + Evidence
- Score (Match + Confidence)
- DiscoveryRun
- Digest
- Result state (at least NEW · SEEN · NOTIFIED · EXPIRED · DISMISSED)

### Strategies

```text
JobDiscoveryStrategyV1
GiveawayDiscoveryStrategyV1
```

### Pipeline

```text
Search → Collect → Normalize → Deduplicate → Filter
  → Verify → AI evaluate (gated) → Score → Persist
```

### UI

- create profile;
- edit criteria (strategy-driven);
- enable / disable;
- view results;
- view evidence;
- last-scan summary (including zero-new).

### Automation

- daily scheduler;
- daily digest builder;
- email notification (zero-result skip by default).

### Package

- `packages/discovery/` domain foundation
- adapters in API / workers as needed (search, fetch, AI, persistence, mail)

---

## Out of scope (do not build in MVP)

| Deferred | Why |
|----------|-----|
| Mobile push | Channel expansion after email loop works |
| Complex recommendation learning | Need labeled outcomes first |
| User-to-user sharing / social | Distracts from trust loop |
| Many discovery categories at once | Dilutes strategy quality |
| Autonomous job applications | High risk / compliance |
| Automatic giveaway participation | High risk / abuse |
| Full Profile galaxy / HUD redesign for PDE | Presentation can be a dedicated Discovery surface |
| Merging PDE into Certainty / Journey Guide speech | Separate product epic |
| Housing / education / travel strategies | Post-MVP strategy backlog |

---

## Acceptance loop (definition of done)

A reviewer can:

1. Create a **Job** profile with Required / Preferred / Excluded criteria.
2. Trigger or wait for a DiscoveryRun.
3. See at least one path where an **aggregator hit is rejected** without official verification (when strategy requires it).
4. See at least one **verified** result with Evidence URLs and Match + Confidence.
5. Create a **Giveaway** profile; confirm purchase-required candidates are **REJECTED**, not low-scored.
6. Receive (or correctly skip) a daily email under the zero-result policy.
7. Rerun without re-notifying unchanged results; a material field change surfaces as **Updated**.

---

## Success metrics (directional)

| Metric | Intent |
|--------|--------|
| Precision of notified results | User does not dismiss most items as noise |
| Evidence completeness | Notified items carry inspectable evidence |
| Notification fatigue | Empty days usually produce no email |
| Cost per accepted result | Funnel keeps AI calls small vs candidates found |
| Explainability | Rejected candidates have a recorded reason |

Volume of candidates found is **not** a success metric.

---

## Risks for MVP

| Risk | Mitigation |
|------|------------|
| Provider / site blocking | Multiple discovery adapters; partial success |
| AI cost blow-ups | Cheap filters first; AI only post-verify |
| Prompt injection from pages | Untrusted content; hardened evaluation prompts |
| Legal / ToS of scraping | Prefer official APIs where possible; document adapters |
| False trust from aggregators | ADR-006: found ≠ verified |

---

## Related

- [Architecture](./personal-discovery-engine-architecture.md)
- [Domain model](./personal-discovery-engine-domain-model.md)
- [Pipeline](./personal-discovery-engine-pipeline.md)
- [Strategy contract](./personal-discovery-engine-strategy-contract.md)
- [Roadmap](./personal-discovery-engine-roadmap.md)
- [ADR-006](../adr/adr-006-personal-discovery-engine-boundaries.md)
