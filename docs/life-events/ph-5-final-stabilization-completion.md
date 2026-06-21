# PH-5 — Final Stabilization Pass (completion)

**Status:** Complete  
**Constraint:** Presentation, UX, i18n, and microcopy only — LE-1–LE-8 logic frozen.

## Deliverables

| Area | Change |
|------|--------|
| Home microcopy | LE-toned strings across situation, cold start, catalog, completeness |
| i18n | New keys: cold start duration/reassurance, prefill messages, simulation hierarchy |
| Scenario panel | Renamed to **Simulation mode**, hierarchy label, visual demotion, embedded explorer |
| Cold start | Duration + reassurance lines; hides duplicate situation card |
| Home IA | Secondary catalog/priority sections hidden when plan, cold start, or loading |
| Edge states | Loading skeleton with `aria-label`; meaningful-state helpers |
| Tests | `ph5-final-stabilization.test.ts` + updated P0 suite |

## Release criteria met

- Home always shows plan OR cold start OR loading skeleton
- No legacy English dashboard phrases in LE Home components
- Scenario Explorer visually and linguistically subordinate
- Microcopy consistent (plan / situation / next step vocabulary)
