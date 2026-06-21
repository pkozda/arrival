---
id: economic-classifier-fixtures
title: Economic Reality Classifier — Fixture Catalog
project: Arrival Atlas
system: Arrival Atlas
type: spec
domain: finance
status: draft
maturity: evolving
owner: product
tags:
  - economic-reality
  - classifier
  - fixtures
  - golden-tests
  - refugees
created: 2026-06-21
updated: 2026-06-21
depends_on:
  - economic-reality-module-v1
  - economic-state-model
  - economic-graph-catalog-v1
  - economic-rule-engine-v1
related:
  - economic-reality-module-v1-spec
  - economic-reality-module-v1-roadmap
  - life-event-classifier-fixtures
---

# Economic Reality Classifier — Fixture Catalog

**Document type:** Canonical classifier examples — pre-implementation reference  
**Purpose:** Define expected economic state, support system, and planning focus before EP-1 coding  
**Authority:** [economic-state-model.md](./economic-state-model.md) · [economic-rule-engine-v1.md](./economic-rule-engine-v1.md)

> Fixtures describe **user situations in plain language**. Engineering maps to `UserContextV1` during golden test authoring — same convention as Life Event F01–F24.

---

## How to use

| Consumer | Use |
|----------|-----|
| Classifier design | Validate priority order |
| Support system resolver | Jobcenter vs Sozialamt routing |
| Graph catalog | Confirm graph selection |
| Golden tests | One fixture → one deterministic test |
| Product review | Refugee / protection scenarios before code lock |

---

## Fixture index

| # | Scenario | Primary state | Support system | Graph |
|---|----------|---------------|----------------|-------|
| EF01 | Employed, stable salary, no benefits | `self_sustained` | none | G1-min |
| EF02 | Mini-job, thin income, no benefits | `employment_active` | none | G4 |
| EF03 | Lost job last week, not yet at Jobcenter | `unemployment_transition` | none → jobcenter | G2 |
| EF04 | Unemployed, Jobcenter appointment booked | `application_pending` | jobcenter | G2 |
| EF05 | Active Bürgergeld, reporting current | `benefits_jobcenter` | jobcenter | G3 |
| EF06 | On Bürgergeld, missed reporting month | `benefits_jobcenter` | jobcenter | G3 + SC-REPORT |
| EF07 | New arrival, no money, not registered | `financial_crisis` | none | G5 |
| EF08 | Ukrainian protection §24, Sozialleistungen | `benefits_sozialamt` | sozialamt | G6 |
| EF09 | Asylum procedure, Sozialamt support | `benefits_sozialamt` | sozialamt | G6 |
| EF10 | Protection status, transitioning to Jobcenter | `application_pending` | jobcenter | G2 |
| EF11 | Refugee, support unclear, profile incomplete | `financial_crisis` | none | G5 + SC-STATUS |
| EF12 | Registered, unemployed, complete profile | `unemployment_transition` | none | G2 |
| EF13 | Job offer while on Bürgergeld | `benefits_jobcenter` | jobcenter | G4 |
| EF14 | Started work, benefit not yet cancelled | `employment_active` | jobcenter | G4 |
| EF15 | Self-employed, irregular income | `employment_active` | none | G4 |
| EF16 | Student, no job, parents support abroad | `self_sustained` | none | G1-min |
| EF17 | Declared savings depleted, no benefits applied | `financial_crisis` | none | G5 |
| EF18 | Applied Sozialamt, awaiting decision | `application_pending` | sozialamt | G6 |
| EF19 | Employed + LE `benefits_exploration` (Wohngeld edge) | `employment_active` | none | G4 |
| EF20 | LE `economic_setup_pending` + no income | `financial_crisis` | none | G5 |
| EF21 | Stable Bürgergeld + LE `situation_stable` | `benefits_jobcenter` | jobcenter | G3 |
| EF22 | Part-time + partial Bürgergeld top-up | `benefits_jobcenter` | jobcenter | G3 |
| EF23 | Protection ended, must switch to Jobcenter | `unemployment_transition` | jobcenter | G2 |
| EF24 | Income unknown, benefits unknown, registered | `application_pending` | none | G1 |

---

## Fixture detail (selected)

### EF07 — New arrival, no money, not registered

**Situation:** User arrived in Germany days ago. No job, no benefit payments, registration not done. Small cash remaining.

| Field | Value |
|-------|-------|
| Primary state | `financial_crisis` |
| Support systems | `none` |
| Graph | G5 |
| Secondary | SC-REG, SC-ADDR |
| Planning focus | `g5-immediate-needs`, `g5-registration` |
| LE correlation | Often `arrival_unregistered` — LE owns registration narrative |

---

### EF08 — Ukrainian protection §24, municipal support

**Situation:** Ukrainian citizen with §24 status. Receiving municipal social support. Not employed. Registered.

| Field | Value |
|-------|-------|
| Primary state | `benefits_sozialamt` |
| Support systems | `sozialamt` |
| Graph | G6 |
| Planning focus | `g6-sozialamt-contact`, `g6-transition-awareness` |
| Product note | Core immigrant scenario — must not classify as E1 |

---

### EF09 — Asylum procedure, Sozialamt (AsylbLG)

**Situation:** Asylum application in progress. Support via Sozialamt. Living in initial reception area.

| Field | Value |
|-------|-------|
| Primary state | `benefits_sozialamt` |
| Support systems | `sozialamt` |
| Graph | G6 |
| Secondary | SC-STATUS, SC-ADDR |
| Planning focus | `g6-status-confirm`, `g6-arrival-proof` |

---

### EF03 — Job loss, not yet at Jobcenter

**Situation:** Full-time employment ended 5 days ago. Termination letter received. Not yet registered as unemployed.

| Field | Value |
|-------|-------|
| Primary state | `unemployment_transition` |
| Support systems | `none` (employment_agency reference optional) |
| Graph | G2 |
| LE correlation | `economic_setup_pending` |
| Planning focus | `g2-termination-docs`, `g2-jobcenter-appointment` |

---

### EF13 — Job offer while on Bürgergeld

**Situation:** Active Bürgergeld. Verbal job offer. Needs to understand exit process.

| Field | Value |
|-------|-------|
| Primary state | `benefits_jobcenter` |
| Graph | G4 (transition overlay on G3) |
| Planning focus | `g4-offer-evaluation`, `g4-notify-jobcenter` |
| Module links | financial-reality, benefits-simulator |

---

### EF20 — LE economic_setup_pending + no income

**Situation:** Life Event classifies life economic setup as pending. Profile shows no income and no benefits.

| Field | Value |
|-------|-------|
| Primary state | `financial_crisis` |
| Graph | G5 |
| Cross-module | LE signal boosts ER priority; ER does not change LE state |
| Planning focus | `g5-system-entry` |

---

## Golden test contract (EP-1)

Each fixture MUST assert full evaluation output:

```typescript
const evaluation = evaluateEconomicRules(userContext);

expect(evaluation.economicState).toBe('...');
expect(evaluation.supportSystem).toBe('...');
expect(evaluation.graphId).toBe('G...');
expect(evaluation.appliedRules).toEqual(['R3']); // terminating rule
expect(evaluation.axes).toEqual({
  incomeSource: 'benefits_sozialamt',
  institutionalDependency: 'fully_dependent',
});
expect(evaluation.confidenceScore).toBeGreaterThanOrEqual(0);
```

Fixtures EF01–EF24 are the **minimum bar** for EP-1 merge.

**Rule engine spec:** [economic-rule-engine-v1.md](./economic-rule-engine-v1.md)

---

## LE fixture crosswalk

| LE fixture | ER fixture | Notes |
|------------|------------|-------|
| F04 Job loss | EF03 | LE pending setup; ER unemployment transition |
| F05 Between jobs, insurance lapsed | EF12 | ER focuses Jobcenter path |
| F08 Low wage, high rent | EF19 | LE benefits exploration; ER employment_active |
| F09 On Bürgergeld | EF05, EF21 | ER owns institutional loop |
| F01 Fresh arrival | EF07, EF11 | Crisis / Sozialamt routing |

---

## Open questions (resolve before EP-4 lock)

| # | Question | Default v1 assumption |
|---|----------|---------------------|
| 1 | §24 always Sozialamt vs sometimes Jobcenter? | EF08 → E5; municipal variance documented in copy |
| 2 | ALG I vs Bürgergeld precedence? | Reference node only; Bürgergeld path primary in ER |
| 3 | Mini-job + Bürgergeld | EF22 partial support case |
