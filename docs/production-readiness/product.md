# Arrival Atlas

> **ARR-022 Implementation Contract v1 — FROZEN**  
> Documentation is now a **static implementation contract**. All future work is **implementation-driven**, not architecture-driven.  
> **Frozen files:** product.md · ux.md · engineering.md · verification.md · index.md · implemented-baseline.md  
> **Allowed edits to frozen files:** bugfix-level only (typos, broken links, factual corrections). No structural changes. No new abstraction layers.  
> **Execution entry:** [implementation-first-pass-plan.md](./implementation-first-pass-plan.md)

UX-first product for newcomers in Germany. **Two features. Feature freeze.**

## Documentation system (locked)

| File | Role | May contain |
|------|------|-------------|
| **product.md** | Product + roadmap light | Features, value, Phase 0–5 goals, blockers |
| **ux.md** | User experience | Behavior, flows, failures, light traceability |
| **engineering.md** | Implementation | Flat tasks P0/P1/P2 |
| **verification.md** | Release & QA | Gates, checks, commands |
| **index.md** | Traceability | ID → file mapping only |
| **implemented-baseline.md** | Immutable | BL-* invariants — do not edit |
| **implementation-first-pass-plan.md** | Execution plan | Developer first pass — not part of frozen spec |

**Forbidden in frozen files:** structural changes · DSL · state machines · verification redesign · new abstraction layers

## What we build

A clear, modern interface where a user can **understand their life situation**, **get an action plan**, and **see their economic reality** — without confusion, silent failures, or needing to reload the page.

**Success:** a real user completes the core journey and trusts what they see, even when something fails.

## Feature A — Life Event

Helps the user **understand their situation and act**.

| User outcome | What they get |
|--------------|---------------|
| Understand current situation | Home summary and Profile mirror show what the app knows — with honest gaps |
| Complete onboarding / profile | Intake and domain edits are guided; save confirms within seconds |
| Get an action plan | Home next-steps and Life Event module show prioritized steps |

**Surfaces:** Home situation summary · Profile · Home next-steps · Life Event module

## Feature B — Economic Reality

Helps the user **understand money and options**.

| User outcome | What they get |
|--------------|---------------|
| Understand economic situation | ER card and module show current economic picture |
| Get explanations and guidance | Plain-language guidance with optional "why" context |
| See current data | Loading and refresh are visible; stale data is never shown silently |

**Surfaces:** Home ER card · Economic Reality module

## How it fits together

```text
Open app
  → see situation + plan preview (Life Event) + economic snapshot (Economic Reality)
  → correct profile facts
  → plan and economic guidance update without reload
  → act in Life Event module
```

Profile is part of Life Event — not a separate feature. It feeds the plan.

---

## Roadmap (30-second view)

```text
Phase 0  UX stability          → no silent failures
Phase 1  Life Event ready       → Feature A shippable
Phase 2  Economic Reality ready → Feature B shippable
Phase 3  UX polish              → consistent, mobile, beta disclosure
Phase 4  Beta release           → gates + sign-off → v1.0.0-beta.1
Phase 5  Production readiness   → soak, sustained CI, runbook
```

### Phase 0 — UX stability

| | |
|---|---|
| **Goal** | Stop trust-breaking UX — no silent failures, visible loading/errors |
| **Includes** | Crash recovery · bootstrap errors · plan/ER/profile failure surfacing · shared error component |
| **Blocks release until** | User always sees content, loading, or error — never blank mystery |

### Phase 1 — Life Event ready

| | |
|---|---|
| **Goal** | Feature A works end-to-end: profile → plan → guidance |
| **Includes** | Loading skeletons · profile completeness · edit flow · plan refresh after edit · LE module errors |
| **Blocks release until** | First visit + profile edit → plan update without reload (E2E-01, E2E-03) |

### Phase 2 — Economic Reality ready

| | |
|---|---|
| **Goal** | Feature B trustworthy: ER card + module + refresh after profile edit |
| **Includes** | ER failure surfacing · action feedback · rationale line · data refresh |
| **Blocks release until** | ER card never vanishes on error; guidance updates after profile edit |

### Phase 3 — UX polish + consistency

| | |
|---|---|
| **Goal** | Modern, consistent UX across Home → Profile → modules on mobile |
| **Includes** | Beta banner · mobile layout · card consistency · localization |
| **Blocks release until** | 375px usable; beta limits disclosed |

### Phase 4 — Beta release

| | |
|---|---|
| **Goal** | Invited beta users can use the product safely |
| **Includes** | Browser tests · CI gates · a11y basics · beta docs · sign-offs |
| **Blocks release until** | [Beta Ready Gate](./verification.md#beta-ready-gate) — all pass |

### Phase 5 — Production readiness

| | |
|---|---|
| **Goal** | Sustained quality beyond point-in-time pass |
| **Includes** | 48h soak · rollback runbook · error reporter · deep journey tests |
| **Blocks release until** | [Production Ready Gate](./verification.md#production-ready-gate) — all pass |

---

## What blocks beta release right now

| Blocker | Phase | Feature |
|---------|-------|---------|
| Blank Home when plan fails | 0 | Life Event |
| ER card vanishes on error | 0 | Economic Reality |
| White screen on crash | 0 | Both |
| Session bootstrap invisible | 0 | Both |
| Profile load error hidden | 0 | Life Event |
| Plan stale after profile edit | 1 | Life Event |
| ER module error/empty not surfaced | 1 | Economic Reality |
| Retry not wired on error surfaces | 0 | Both |
| No E2E-01 / E2E-03 / E2E-07 | 1–4 | Both |
| Beta docs + access control | 4 | Both |

**Ship beta when:** Phase 0–4 complete + [Beta Ready Gate](./verification.md#beta-ready-gate) pass.

---

## Product bar (good UX)

1. Every area shows **content, loading, empty, or error** — never blank silence
2. One obvious next step on every screen
3. Missing data named plainly with a path forward
4. Life Event module is the quality bar for all surfaces
5. Errors look like errors — not hints, not empty space

## Definition of done (system)

| Criterion | How |
|-----------|-----|
| Understand product | ≤2 files: **product.md** + **ux.md** |
| Implement a task | **engineering.md** alone (optional **ux.md** for behavior) |
| Test release | **verification.md** alone |
| Understand roadmap | **product.md** — no engineering context required |
| Structure stable | 6 files — no further evolution |

---

## Read these docs

| Role | Files |
|------|-------|
| Roadmap + product | **product.md** |
| UX behavior + traceability | **ux.md** |
| Engineer (build) | **implementation-first-pass-plan.md** + **engineering.md** + **ux.md** |
| Engineer (task lookup) | **engineering.md** + **ux.md** |
| QA | **verification.md** only |
| ID lookup | **index.md** |

**Frozen runtime:** [implemented-baseline.md](./implemented-baseline.md) (BL-*)

**Out of scope:** OAuth · new modules · production database · benefits simulator
