---
id: e14-arrival-journey-v2-implementation-v1
title: Arrival Atlas — E14 Journey v2 Implementation Note
project: Arrival Atlas
system: Arrival Atlas
type: implementation-note
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e14
  - journey
created: 2026-09-09
updated: 2026-09-09
---

# E14 Implementation Note

## Files changed

| File | Change |
| --- | --- |
| `apps/web/src/components/profile/DomainMutationEditor.tsx` | Gate edit/save on profile readiness (`data-profile-ready`, loading status, disabled controls) |
| `packages/core/src/i18n/profile-translations.ts` | `profile.loading` EN/DE/RU/UA |
| `apps/web/src/components/profile/domain-mutation-editor.e14.test.ts` | Focused revoke / no-invent tests |
| `tools/black-box-audit/probes/probe-e14-arrival-journey-v2.mjs` | Full A–L browser journey |
| `tools/black-box-audit/E14-ARRIVAL-JOURNEY-V2-AUDIT-v1.md` | Audit |
| this file | Implementation note |

## Fixes (P1)

**Profile editor pre-hydration gate**

Boolean drafts default to `false` when a field is unknown. If the editor was interactable before the authoritative profile loaded, a “revoke” of an already-unchecked checkbox produced **no mutation**, leaving COMPLETED benefits stale in projections.

Mitigation:

* Do not sync/save until `profile != null`
* Expose `data-profile-ready` / `data-profile-loading` for UI and probes
* Disable fields + save while loading

No new invalidate framework; no new domains.

## Tests

```bash
cd apps/web && npx vitest run \
  src/components/profile/domain-mutation-editor.e14.test.ts \
  src/lib/profile-correction/state-reversal.e13.test.ts
```

Also rebuilt `@arrival-atlas/core` for `profile.loading` strings.

## Browser probe

```bash
node tools/black-box-audit/probes/probe-e14-arrival-journey-v2.mjs
```

Artifacts: `tools/black-box-audit/artifacts/e14-arrival-journey-v2/`

Observed (2026-09-09): **ARRIVAL JOURNEY PASS** at probe level (P0=0 P1=0 P2=0) after hydration gate + language sync wait.

## Regressions

E13 state-reversal unit suite re-run green. Prior vertical-slice semantics unchanged (Registration, Housing, Benefits, Tax, Employment honesty).

## Limitations

* Product verdict remains **PASS WITH LIMITATIONS** (HUD discoverability, Atlas Home UA chrome, Discovery live SUCCESS, boolean→unknown, E12 LE abstractions)
* Probe uses full `page.goto` (SSR lang flash); waits for client sync before asserting language

## Verdict

**ARRIVAL JOURNEY PASS WITH LIMITATIONS**
