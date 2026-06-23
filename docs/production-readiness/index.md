# ID Index

> **Role: TRACEABILITY ONLY (locked)**  
> ID → file → description. `INFRA` = no UX row required.

## Files (frozen)

| File | Role |
|------|------|
| product.md | Product + roadmap light |
| ux.md | User experience |
| engineering.md | Implementation tasks |
| verification.md | Release & QA |
| index.md | This index |
| implemented-baseline.md | BL-* immutable |
| implementation-first-pass-plan.md | Developer execution plan (first pass) |

## UX IDs

| ID | UX | Engineering | Verify |
|----|-----|-------------|--------|
| UX-H1 | ux.md | UX-H1 | Home next-steps never blank |
| UX-H2 | ux.md | UX-H2 | ER card never silent |
| UX-H3 | ux.md | UX-ENG-03 | Structured loading |
| UX-H4 | ux.md | UX-H4 | P2 visual |
| UX-H5 | ux.md | UX-H5 | Beta limitations disclosed |
| UX-H6 | ux.md | UX-ENG-06 | P2 localize |
| UX-L1 | ux.md | UX-L1, UX-ENG-02 | Structured loading |
| UX-D1 | ux.md | UX-D1 | Empty states CTA |
| UX-D2 | ux.md | UX-P1 | Completeness visible |
| UX-E1 | ux.md | UX-D1 | Empty states CTA |
| UX-E2 | ux.md | UX-E2 | ER states visually distinct |
| UX-E3 | ux.md | UX-ER3 | ER empty state |
| UX-P1 | ux.md | UX-P1 | Completeness visible |
| UX-P2 | ux.md | UX-P2 | Edit loading gate |
| UX-P3 | ux.md | UX-P3 | Domain snapshot error |
| UX-P4 | ux.md | UX-ENG-05 | P2 localize |
| UX-T2 | ux.md | UX-T2 | Save confirmation ≤5s |
| UX-T3 | ux.md | UX-T3 | LE confidence label |
| UX-T4 | ux.md | UX-T4 | ER rationale line |
| UX-T5 | ux.md | UX-T5 | LE + ER action feedback |
| UX-LE1 | ux.md | UX-LE1 | LE plan error severity |
| UX-LE2 | ux.md | UX-LE2 | E2E-05 |
| UX-LE3 | ux.md | UX-LE3 | Visual |
| UX-ER1 | ux.md | UX-ER1 | ER-M02 |
| UX-ER2 | ux.md | UX-ER2 | ER-M01, ER-M04 |
| UX-ER3 | ux.md | UX-ER3 | ER-M03 |
| UX-RETRY | ux.md | UX-RETRY | RETRY-* checks |
| UX-R1 | ux.md | UX-ENG-01 | Errors distinct from hints |
| UX-R2 | ux.md | UX-ENG-01 | Errors distinct from hints |
| UX-R4 | ux.md | UX-ENG-01 | Error copy matches cause |
| UX-C1 | ux.md | UX-E2 | ER states visually distinct |
| UX-C3 | ux.md | UX-ENG-07 | P2 visual |
| UX-M1 | ux.md | UX-ENG-04 | Mobile 375px |
| UX-M2 | ux.md | UX-M2 | P2 a11y |
| UX-N1 | ux.md | UX-N1 | GJ-01 keyboard-only |
| UX-N2 | ux.md | UX-N1 | Production gate #7 |
| UX-N3 | ux.md | UX-N3 | Production gate #7 |
| UX-N4 | ux.md | UX-N4 | P2 localize |
| UX-ENG-01 | engineering.md | UX-ENG-01 | Errors distinct from hints |
| UX-ENG-02 | engineering.md | UX-ENG-02 | Structured loading |
| UX-ENG-03 | engineering.md | UX-ENG-03 | Structured loading |
| UX-ENG-04 | engineering.md | UX-ENG-04 | Mobile 375px |
| UX-ENG-05 | engineering.md | UX-ENG-05 | P2 localize |
| UX-ENG-06 | engineering.md | UX-ENG-06 | P2 localize |
| UX-ENG-07 | engineering.md | UX-ENG-07 | P2 visual |

## REL IDs

| ID | UX | Engineering | Verify |
|----|-----|-------------|--------|
| REL-01 | ux.md | REL-01 | Crash → recovery UI |
| REL-02 | ux.md | REL-02 | Session bootstrap error visible |
| REL-05 | ux.md | REL-05 | Profile load failure visible |
| REL-10 | ux.md | REL-10 | E2E-06 |
| REL-11 | ux.md | REL-11 | API down → error within 10s |
| REL-12 | ux.md | REL-12 | Degraded sync visible |
| REL-R1 | ux.md | REL-R1 | Profile edit updates plan |
| REL-R2 | ux.md | REL-R2 | P1 plan change smoke |
| REL-R3 | ux.md | REL-R3 | INFRA — cache optimization |
| REL-R4 | ux.md | REL-R4 | INFRA — action context |
| REL-R5 | ux.md | REL-R5 | Form matches server |
| REL-B2 | engineering.md | REL-B2 | INFRA — catalog warning |
| REL-B3 | engineering.md | REL-B3 | INFRA — bootstrap timeout |
| REL-B4 | ux.md | REL-B4 | GJ-02 return visit |
| REL-14 | engineering.md | REL-14 | Production gate #10 |

## Journey & test IDs

| ID | UX | Engineering | Verify |
|----|-----|-------------|--------|
| GJ-01 | ux.md flows | — | Beta gate #10, GJ-01 check |
| GJ-02 | ux.md Flow return | TEST-01 | GJ-02 + E2E-02 |
| GJ-04 | ux.md Flow profile change | REL-R1 | E2E-03 |
| E2E-01 | ux.md | E2E-01 | Beta gate #5 |
| E2E-02 | ux.md | E2E-02 | GJ-02 check |
| E2E-03 | ux.md | E2E-03 | Beta gate #6 |
| E2E-04 | — | — | E2E-04 scenario |
| E2E-05 | ux.md | — | E2E-05 scenario |
| E2E-06 | ux.md | E2E-06 | E2E-06 scenario |
| E2E-07 | ux.md | — | Beta gate #7 |
| E2E-08 | ux.md | E2E-08 | Production gate #5 |
| E2E-09 | ux.md | E2E-09 | Production gate #5 |
| ER-M01–06 | ux.md ER module flow | UX-ER1/2/3 | ER module checks |
| RETRY-H01–04 | ux.md Retry | UX-RETRY | Retry checks |
| RETRY-LE01–04 | ux.md Retry | UX-RETRY | Retry checks |
| RETRY-ER01–05 | ux.md Retry | UX-RETRY | Retry checks |
| TEST-01 | ux.md | TEST-01 | GJ-02 check |
| TEST-03–10 | — | engineering.md | INFRA — CI/test tasks |
| BL-01–17 | — | — | INFRA — implemented-baseline.md |
| A11Y-08–09 | — | engineering.md | Production gate #7 |
| DOC-01–03 | — | engineering.md | Beta/Production gates |
| V-RELEASE | — | V-RELEASE | Sign-off |

## Removed / merged

| ID | Status |
|----|--------|
| REL-03 | Merged into UX-H1 |
| REL-04 | Merged into UX-H2 |
| REL-06 | Merged into REL-R5 |
| REL-07 | Merged into REL-R1 |
| REL-08 | Merged into REL-R3 |
| REL-09 | Merged into REL-R4 |
| REL-13 | Merged into REL-R2 |
| REL-O1 | Merged into REL-14 |
| GJ-03 | INFRA — secondary journey, no active check |
| TRUST-01–05 | Merged into UX-P1, UX-T2, UX-H5, UX-T4 tasks |
| A11Y-01–07 | Merged into UX-N1, UX-N3, UX-M2 tasks |
