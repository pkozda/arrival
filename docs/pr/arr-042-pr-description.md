# arr-042 — Product vertical slices PD-001…011 · Hardening E1–E16 · Controlled release

**Branch:** `arr-042`  
**Tracks:** PD-001 Registration → PD-011 Discovery claim · Product hardening E1–E16 · Benefits / Housing / Tax / LE integrity · State reversal · Controlled release gate  
**Base:** `develop` (post arr-041 / merge #40)

Implements the **arr-041 product contract stack** as production behavior: authoritative profile facts drive derived evaluators and Life Events / module presentation; real mutations recalculate; supported reversals recover; failed mutations do not invent state. Closes with a **controlled release** gate (build, config fail-closed, persistence restart, production browser smoke).

This PR **does** ship vertical slices across Registration, Economic Reality Action Planner, Healthcare, Employment, Guided Discovery, Discovery persistence/lifecycle/results/trust/automation/claim, Benefits awareness, Housing situation, Tax administration (ER Option C), Life Events integrity, state reversal, journey coherence, RC hardening, and release readiness. It does **not** add a global planner, Finance module, banking, Steuer-ID, Housing Search, new benefits programs, or redesign Discovery / Life Events architecture.

1. **PD-001…011 vertical slices** — Registration confirmation, ER Action Planner, Healthcare progressive enrichment, Employment dual tracks, Guided Discovery, Discovery PD-006…011.
2. **Hardening E1–E12** — Cross-module journey, localization cohesion, release readiness, Benefits E4–E8, Housing E9, Tax E10 + churchTax tri-state E11, Life Events integrity E12.
3. **E13–E14** — State reversal / recalculation integrity; end-to-end Arrival Journey v2 coherence (incl. profile hydration gate).
4. **E15–E16** — Release candidate hardening; controlled release (production auth/ops fail-closed, clean build procedure, restart persistence, browser smoke).
5. **Audit harness** — Design/implementation/audit markdown + Playwright probes under `tools/black-box-audit/`.

**Product verdict:** Arrival Atlas can be deployed to a **controlled production environment** under `RELEASE-READINESS-CONTRACT-v1.md` / Compose (secrets, persistent SQLite volume, single API replica, `DEV_TOOLS=false`, clean web build before serve). Final E16 verdict: **CONTROLLED RELEASE PASS**.

**Diff vs `develop` (working tree):** large product drop across `apps/web`, `apps/api`, `packages/{modules,mbde,discovery,core,product-contract,module-runtime,profile*}` + extensive `tools/black-box-audit/` · ~300+ paths · exclude local SQLite test dirs (`.arrival-atlas-state-*`) from the PR.

---

# Part 1 — Problem statement

## Why this work exists

arr-041 defined what Arrival Atlas must do. Production still exhibited newcomer-facing gaps:

| Theme | Pre-arr-042 gap |
| ----- | ---------------- |
| Registration | Heuristic / blocked Anmeldung; no authoritative confirmation path |
| ER | Weak next-action ownership; housing/tax/benefits not coherently projected |
| Healthcare | Empty success / progressive enrichment missing |
| Employment | No clear Work & Income vs Job Search; Discovery invent risk |
| Discovery | Persistence, lifecycle honesty, trust, automation, claim incomplete |
| Benefits / Housing / Tax | Not first-class derived panels with truthful states |
| Reversal | Clears could no-op; invalidate payloads rejected; stale COMPLETE |
| Release | Insecure prod auth default; web build type blocker; unclear release procedure |

## Constraints honored

- No global planner; ER owns Action Planner; Benefits own awareness; LE is projection-only  
- No banking / Steuer-ID / Finance routes / Housing Search / new benefit programs  
- Do not invent official Anmeldung URLs (`ANMELDUNG_OFFICIAL_GUIDANCE_URL = null`)  
- Do not convert `churchTax` unknown → false  
- Discovery live SUCCESS remains environment-limited without provider keys  
- Fix P0/P1 only in hardening passes; document P2/P3  

---

# Part 2 — Architecture (unchanged contract)

```text
authoritative profile / domain facts
  → derived evaluators / projections
  → Life Events / module presentation
  → real action → mutation → recalculation
```

| Surface | Owns |
| ------- | ---- |
| Profile editors | Authoritative fact mutation (`fact.correct` / `fact.invalidate`) |
| Economic Reality | Action Planner + Housing + Tax + Benefits host panels |
| Life Events | Lifecycle projection (not a second SoT) |
| Discovery | Profile / run / results / automation / claim |
| Employment | Dual track; Job Search → Discovery without inventing runs |

Ownership: `userId = accountId ?? sessionId` (server-derived).

---

# Part 3 — Vertical slices (PD-001…011)

| ID | Slice | Outcome (summary) |
| -- | ----- | ----------------- |
| PD-001 | Registration | `municipalRegistrationConfirmed` + address → COMPLETE; prepare ≠ complete; LE/ER aligned |
| PD-002 | ER Action Planner | Domain next-action planning on ER |
| PD-003 | Healthcare | Progressive enrichment; honest outcomes (not fake empty SUCCESS) |
| PD-004 | Employment dual tracks | Work & Income vs Job Search; Discovery not invented |
| PD-005 | Guided Discovery | Real guided setup; manual remains available |
| PD-006 | Discovery persistence | Continuity + disclosure |
| PD-007 | Discovery execution lifecycle | IDLE→…→terminal; no fake SUCCESS |
| PD-008 | Discovery results | Honest result presentation |
| PD-009 | Discovery trust | Verification semantics |
| PD-010 | Discovery automation | Schedule ≠ executed run |
| PD-011 | Discovery account claim | Possession-based ownership transfer |

Design/implementation notes live under `tools/black-box-audit/*DESIGN*` / `*IMPLEMENTATION*` with matching `probe-pd00x-*.mjs`.

---

# Part 4 — Hardening & release (E1–E16)

| ID | Focus | Verdict / note |
| -- | ----- | -------------- |
| E1 | Cross-module journey | PASS WITH LIMITATIONS |
| E2 | Localization cohesion (EN/DE/RU/UA) | Cohesion gates; no UA←RU |
| E3 | Release readiness (product) | PASS WITH LIMITATIONS |
| E4–E8 | Benefits awareness → aggregation → E2E | Wohngeld + Kindergeld shipped |
| E9 | Housing situation | READY from city+rent; independent of Registration |
| E10–E11 | Tax Administration + churchTax tri-state | Option C on ER; unknown preserved |
| E12 | Life Events integrity | PASS WITH LIMITATIONS; banking never blocks Anmeldung |
| E13 | State reversal / recovery | PASS WITH LIMITATIONS; invalidate clears + null payload schema |
| E14 | Arrival Journey v2 | PASS WITH LIMITATIONS; profile hydration gate |
| E15 | Release candidate | PASS WITH LIMITATIONS |
| E16 | Controlled release | **CONTROLLED RELEASE PASS** |

### Notable P1 fixes (non-exhaustive)

| Area | Fix |
| ---- | --- |
| E13 | Editor clears emit `fact.invalidate`; contract accepts null clear markers |
| E11 | churchTax select tri-state; unrelated save must not invent `false` |
| E14 | `DomainMutationEditor` gated on `data-profile-ready` |
| E16 | Production fail-closed for `AUTH_SECRET` / `OPS_TOKEN`; web build type predicate |

### Interrupted `.next` incident (E16)

Missing `vendor-chunks/motion-dom.js` after interrupted build = **artifact corruption / procedure**, not an application P1. Mitigation: clean rebuild before `next start` (documented in release contract).

---

# Part 5 — Artifact map

## Normative release / integrity docs

| Document | Path |
| -------- | ---- |
| Release readiness contract | `tools/black-box-audit/RELEASE-READINESS-CONTRACT-v1.md` |
| E16 controlled release audit | `tools/black-box-audit/E16-CONTROLLED-RELEASE-AUDIT-v1.md` |
| E15 RC audit | `tools/black-box-audit/E15-RELEASE-CANDIDATE-HARDENING-AUDIT-v1.md` |
| E14 journey audit | `tools/black-box-audit/E14-ARRIVAL-JOURNEY-V2-AUDIT-v1.md` |
| E13 state reversal audit | `tools/black-box-audit/STATE-REVERSAL-RECOVERY-AUDIT-v1.md` |
| E12 LE integrity audit | `tools/black-box-audit/LIFE-EVENTS-INTEGRITY-AUDIT-v1.md` |

## Probes (representative)

```text
tools/black-box-audit/probes/
  probe-pd001-*.mjs … probe-pd011-*.mjs
  probe-e1-*.mjs … probe-e16-*.mjs
  probe-e16-api-restart-persistence.mjs
  probe-e16-controlled-release.mjs
```

## Key product surfaces (code)

| Area | Paths (indicative) |
| ---- | ------------------ |
| Registration / LE | `registration-ux-state`, prepare-anmeldung, LE signals/catalog |
| ER panels | `ActionPlannerPanel`, `HousingSituationPanel`, `TaxAdministrationPanel`, `BenefitsAwarenessPanel` |
| Benefits evaluators | `packages/mbde/src/awareness/*` |
| Profile mutations | `mutation-request-builder`, `DomainMutationEditor`, invalidate schema |
| Employment | `EmploymentDualTrackView`, employment dual-track lib |
| Discovery | user-api lifecycle, automation, ownership-transfer, web Discovery UI |
| Release config | `apps/api/src/config/assert-production-configuration.ts` |

---

# Part 6 — Explicitly out of scope

- Global planner / second SoT in Life Events  
- Finance module, banking, Steuer-ID, budgeting  
- Housing Search marketplace  
- New benefits beyond Wohngeld / Kindergeld  
- Discovery / LE redesign beyond honesty + integrity  
- Eliminating all P2/P3 localization / HUD discoverability items  
- SQLite replacement / multi-replica API  
- Committing `.arrival-atlas-state-*` test SQLite files or secrets  

---

# Part 7 — Validation

### Unit / focused

```bash
# Examples
cd apps/web && npx vitest run src/lib/profile-correction/state-reversal.e13.test.ts \
  src/components/profile/domain-mutation-editor.e14.test.ts
cd apps/api && npx vitest run src/config/assert-production-configuration.test.ts
npm run build -w @arrival-atlas/api -w @arrival-atlas/web
```

### Browser / release smokes

```bash
node tools/black-box-audit/probes/probe-e13-state-reversal-recovery.mjs
node tools/black-box-audit/probes/probe-e14-arrival-journey-v2.mjs
node tools/black-box-audit/probes/probe-e15-release-candidate-hardening.mjs
node tools/black-box-audit/probes/probe-e16-api-restart-persistence.mjs
node tools/black-box-audit/probes/probe-e16-controlled-release.mjs
```

Requires API + web (prefer production `next start` after clean build for E16).

### Production / Compose (deploy host)

```bash
cp deploy/env.example .env   # set AUTH_SECRET + OPS_TOKEN
docker compose build && docker compose up -d
curl -fsS http://localhost/health
```

---

## Related docs

- [arr-041-pr-description.md](./arr-041-pr-description.md) — Product Guide · Decisions · Plan · PD-001 design (prior definition phase)  
- [arr-040-pr-description.md](./arr-040-pr-description.md) — Clean monorepo / Docker build  
- [docs/deployment.md](../deployment.md) — Personal staging Compose topology  
- [tools/black-box-audit/RELEASE-READINESS-CONTRACT-v1.md](../../tools/black-box-audit/RELEASE-READINESS-CONTRACT-v1.md) — Release contract  
- [tools/black-box-audit/E16-CONTROLLED-RELEASE-AUDIT-v1.md](../../tools/black-box-audit/E16-CONTROLLED-RELEASE-AUDIT-v1.md) — Controlled release audit  

---

## Reviewer notes

| Concern | Answer |
| -------- | ------ |
| Why so large? | Completes the full arr-041 roadmap through controlled release in one execution branch |
| Is LE a second eligibility engine? | No — E12/E14/E16 assert projection-only; banking never blocks Registration |
| Is Tax a Finance module? | No — Tax Administration Option C on Economic Reality only |
| Can we scale API replicas? | **No** — single SQLite writer; contract forbids it |
| Why is Anmeldung URL null? | Product refuses invented official URLs |
| What about Discovery SUCCESS in CI? | Environment-limited; lifecycle honesty still enforced |
| Should `.arrival-atlas-state-*` be committed? | **No** — local/test SQLite; keep out of PR |
| Interrupted `.next` failure? | Procedural — clean rebuild; not an application P1 |
| Release recommendation? | **Yes** for controlled production under the release contract |
