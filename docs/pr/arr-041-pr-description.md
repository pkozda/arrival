# arr-041 — Black-box Product Flow Review · Product Guide · E2E Spec · PD-001 design

**Branch:** `arr-041`  
**Tracks:** Production black-box audit (probes + artifacts) · Product Guide v1 · E2E Product Specification v1 · Product Decisions v1 (PD-001…007 APPROVED) · Product Implementation Plan v1 · Registration Implementation Design v1 (PD-001 first slice)  
**Base:** `develop` (post arr-040 / merge #39)

Captures the **product-definition phase** after a controlled production black-box audit of Arrival Atlas. Establishes normative product contracts and an incremental implementation roadmap **without changing production application behavior**.

This PR **does** land audit tooling under `tools/black-box-audit/`, canonical Product Guide indexing under `docs/`, approved Product Decisions, E2E acceptance contracts, an implementation plan, and the PD-001 Registration design for the first vertical slice. It does **not** implement PD-001…007 in production code, modify existing Playwright/API E2E suites, change APIs/UI/domain packages, or alter Discovery / Life Events / Economic Reality runtime behavior.

1. **Black-box audit harness** — Playwright probes (probe-001…005, STEPs ~0–51) against production `arrival-atlas.pro` with evidence artifacts (screenshots, network JSON, state comparisons).
2. **Product Guide v1** — canonical behavioral / UX rules (`docs/product/product-guide-v1.md`) + docs index entry.
3. **E2E Product Specification v1** — implementation-independent journey contracts + status vocabulary + traceability matrix.
4. **Product Decisions v1** — PD-001…007 analyzed, then **APPROVED** for implementation planning.
5. **Product Implementation Plan v1** — phased roadmap (Registration → ER → Healthcare → Employment → Discovery → Guided → E2E hardening).
6. **Registration Implementation Design v1** — concrete PD-001 first-slice design (confirmation fact, heuristic demotion, blocked UX, propagation).

**Product verdict:** Arrival Atlas now has an evidence-backed product contract stack: what production actually does (audit), what it must do (Guide + Decisions), how to accept it (E2E Spec), and how to implement the first slice (Registration design) — ready for engineering execution on a follow-up branch.

**Diff vs `develop` (intended working tree):** documentation + `tools/black-box-audit/` only · **no** `apps/` · `packages/` production behavior changes · ~53 probe scripts · ~182 artifact files · 5 normative markdown contracts under the audit tree · Product Guide + docs index.

---

# Part 1 — Problem statement

## Why this work exists

Production walkthroughs and black-box probes exposed recurring newcomer failures that are **product-contract gaps**, not isolated UI bugs:

| Gap ID / theme | Observed (audit) |
| -------------- | ---------------- |
| `CROSS-UX-001` | Incomplete Ukrainian localization across journey chrome |
| `CROSS-UX-002` | Route CTA without observable route output |
| `ER-LOOP-001` | Economic Reality reopens completed housing prerequisite |
| Registration | Address can complete; Anmeldung remains blocked / non-actionable; no confirm-completion path |
| Healthcare | HTTP 200 + empty recommendations/actions + unchanged UI |
| Employment | Work & Growth → Life Events; no clear Jobs bridge; Work & income disabled without unlock explanation |
| Discovery Guided | CTA closes welcome dialog; no real guided wizard |
| Persistence / runs | Cross-session profile/run state often `UNVERIFIED` / `AMBIGUOUS` under fresh Playwright sessions |

Without a written product contract, implementation would either (a) patch UI only, or (b) silently invent product semantics (especially Registration “COMPLETE” via `isMunicipallyRegistered` heuristic).

## Constraints honored during the phase

- Production code and existing E2E tests **not** modified for audit/definition work.
- No fabricated saved session state; unavailable downstream consumption recorded as `UNVERIFIED`.
- Discovery cost discipline: at most one intentional Jobs run in the audit pass.
- PD-001…007 not silently “fixed” in code — decisions approved, then designed.

---

# Part 2 — Artifact map

## Canonical product contracts

| Document | Path | Role |
| -------- | ---- | ---- |
| Product Guide v1 | `docs/product/product-guide-v1.md` | Normative UX / journey rules (PR-001…018) |
| Docs index | `docs/README.md` | Indexes Product Guide under Key documents |
| E2E Product Specification v1 | `tools/black-box-audit/E2E-PRODUCT-SPECIFICATION-v1.md` | Observable E2E contracts + status vocabulary |
| Product Decisions v1 | `tools/black-box-audit/PRODUCT-DECISIONS-v1.md` | PD-001…007 analysis + **APPROVED** contracts |
| Product Implementation Plan v1 | `tools/black-box-audit/PRODUCT-IMPLEMENTATION-PLAN-v1.md` | Phased implementation roadmap |
| Registration Implementation Design v1 | `tools/black-box-audit/REGISTRATION-IMPLEMENTATION-DESIGN-v1.md` | PD-001 first vertical slice design |

## Black-box audit tree

```text
tools/black-box-audit/
├── probes/          # probe-001…005 Playwright scripts (STEP 0–51)
├── artifacts/       # probe-001…005 evidence (png/json/network)
├── E2E-PRODUCT-SPECIFICATION-v1.md
├── PRODUCT-DECISIONS-v1.md
├── PRODUCT-IMPLEMENTATION-PLAN-v1.md
└── REGISTRATION-IMPLEMENTATION-DESIGN-v1.md
```

| Probe | STEPs (approx.) | Journey coverage |
| ----- | --------------- | ---------------- |
| probe-001 | 0–18 | First contact · Life Events · Healthcare · Profile health insurance |
| probe-002 | 0–26 | Economic Reality · housing save/return · Registration · Work & Growth |
| probe-003 | 27–40 | Discovery (guided, Jobs/Giveaways, run-once, fresh session) |
| probe-004 | 41–45 | Household & Family (entry → save) |
| probe-005 | 46–51 | Employment · return visit · failure/recovery · Benefits downstream |

---

# Part 3 — Approved Product Decisions (summary)

| PD | Approved option | Status |
| -- | --------------- | ------ |
| **PD-001** Registration completion | **B** — prepare + external guidance + explicit user confirmation | APPROVED |
| **PD-002** Economic Reality scope | **A** — Action Planner for v1; simulators remain separate | APPROVED |
| **PD-003** Healthcare minimum context | **D** — progressive enrichment; min = situation + clear insurance assumptions | APPROVED |
| **PD-004** Employment path | **D** — dual tracks: Work & Income (situation) + Discovery Jobs (search) | APPROVED |
| **PD-005** Guided Discovery | **C** — lightweight Guided Discovery wizard | APPROVED |
| **PD-006** Discovery persistence | **A** — account-scoped contract + demo/session disclosure | APPROVED |
| **PD-007** Discovery execution | Explicit `IDLE → QUEUED → RUNNING → SUCCESS / NO_RESULTS / ERROR` + observable long runs | APPROVED |

Full analysis, alternatives, E2E impact, and open implementation questions remain in `PRODUCT-DECISIONS-v1.md`.

---

# Part 4 — Implementation planning (not executed in this PR)

## Roadmap (`PRODUCT-IMPLEMENTATION-PLAN-v1.md`)

```text
Phase 0  Shared foundations (thin)
Phase 1  Registration (PD-001)     ← first vertical slice
Phase 2  Economic Reality planner (PD-002 / ER-LOOP-001)
Phase 3  Healthcare outcomes (PD-003)
Phase 4  Employment dual tracks (PD-004)
Phase 5  Discovery persistence + lifecycle (PD-006 / PD-007)
Phase 6  Guided Discovery wizard (PD-005)
Phase 7  E2E hardening against E2E Product Spec
```

## PD-001 design highlights (`REGISTRATION-IMPLEMENTATION-DESIGN-v1.md`)

Verified production baseline:

```text
Profile facts → computeSituationSignals()
  → isMunicipallyRegistered (heuristic, not persisted)
  → LE municipal_registration + ER registration_confirmed
  → resolveGraph → Galaxy inspector
```

**Minimal intended architecture (future implementation branch):**

1. Add authoritative migration-domain confirmation fact.
2. Gate `municipal_registration` / `registration_confirmed` on that fact (heuristic advisory only).
3. Keep address prerequisite via existing `hasRegistrableAddress`.
4. Fix blocked inspector so prerequisite recovery actions stay interactive and explanations honest (`E2E-GLOBAL-003`).
5. Expose prepare / external guidance / confirm on `g1-complete-anmeldung`.

**First acceptance gate (future):** `E2E-REG-004…007`, `E2E-REC-001/002`, `E2E-GLOBAL-003`.

---

# Part 5 — E2E Product Specification posture

Status vocabulary used throughout:

| Status | Meaning |
| ------ | ------- |
| `OBSERVED_PASS` | Audit matched desired contract for checked assertions |
| `OBSERVED_GAP` | Audit conflicted with Product Guide / desired contract |
| `REQUIRED` | Normative desired behavior not yet observed as pass |
| `PRODUCT_DECISION` | Was gated on PD (now resolved for planning) |
| `UNVERIFIED` | Could not verify under normal-session constraints — **not** a confirmed defect |
| `AMBIGUOUS` | Insufficient evidence — **not** a confirmed defect |

~64 E2E scenarios across Global, First Arrival, Registration, Economic Reality, Healthcare, Household, Employment, Discovery, Return, Recovery, Cross-module state.

User Story mappings use `NEW PRODUCT CONTRACT` where no historical `US-*` IDs exist in the audit corpus.

---

# Part 6 — Explicitly out of scope

- Implementing PD-001…007 in `apps/` or `packages/`
- Modifying existing `apps/web/tests/e2e` or `apps/api/tests/e2e` suites
- Schema migrations / new APIs / UI shipping
- Reopening approved Product Decisions
- Treating `UNVERIFIED` / `AMBIGUOUS` audit rows as confirmed production defects
- Committing secrets, credentials, or private API bypasses used to “prove” persistence
- CSR / MBDE / PDE engine redesign (unchanged by this PR)

---

# Part 7 — Validation

This PR is documentation + audit tooling. Validation is **review / reproducibility**, not production build gates.

### Document coherence

- [ ] Product Guide indexed from `docs/README.md`
- [ ] All seven PDs marked `APPROVED` in `PRODUCT-DECISIONS-v1.md` with Approved Product Contract sections
- [ ] Implementation Plan references approved decisions and E2E Spec IDs
- [ ] Registration Design does not reopen PD-001 and cites concrete repo paths

### Audit harness (optional local re-run)

```bash
# Example — requires Playwright browsers + network to production
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" \
  node tools/black-box-audit/probes/probe-001-first-contact.mjs
```

Cost / safety: follow per-probe rules (no Discovery re-execution unless explicitly allowed; no private API injection).

### Production regression

- [ ] No `apps/` or `packages/` behavior diffs required for this PR to be valid
- [ ] Existing CI / `npm run build` expectations unchanged by this documentation drop

---

## Related docs

- [arr-040-pr-description.md](./arr-040-pr-description.md) — Clean monorepo / Docker build (prior)
- [docs/product/product-guide-v1.md](../product/product-guide-v1.md) — Product Guide v1
- [tools/black-box-audit/E2E-PRODUCT-SPECIFICATION-v1.md](../../tools/black-box-audit/E2E-PRODUCT-SPECIFICATION-v1.md) — E2E contracts
- [tools/black-box-audit/PRODUCT-DECISIONS-v1.md](../../tools/black-box-audit/PRODUCT-DECISIONS-v1.md) — Approved PDs
- [tools/black-box-audit/PRODUCT-IMPLEMENTATION-PLAN-v1.md](../../tools/black-box-audit/PRODUCT-IMPLEMENTATION-PLAN-v1.md) — Roadmap
- [tools/black-box-audit/REGISTRATION-IMPLEMENTATION-DESIGN-v1.md](../../tools/black-box-audit/REGISTRATION-IMPLEMENTATION-DESIGN-v1.md) — PD-001 design

---

## Reviewer notes

| Concern | Answer |
| -------- | ------ |
| Why land 74MB of artifacts? | Evidence for OBSERVED_* classifications; probes alone are insufficient to audit conclusions |
| Why no production code? | Definition phase deliberately frozen until PD-001 design was written; implementation is a follow-up branch |
| Is Registration “broken”? | Product gap: heuristic COMPLETE + blocked UX with non-interactive recovery — design specifies the fix; not implemented here |
| Are fresh-session empty Discovery profiles a bug? | Recorded as `UNVERIFIED` under `userId = accountId ?? sessionId`; PD-006 defines the contract |
| What ships next? | Implement PD-001 per Registration Design; first E2E gate `E2E-REG-004…007` + `E2E-GLOBAL-003` |
| Does this replace Product Guide in `docs/product/`? | No — Guide is canonical under `docs/product/`; audit tree holds E2E/Decisions/Plan/Design |
