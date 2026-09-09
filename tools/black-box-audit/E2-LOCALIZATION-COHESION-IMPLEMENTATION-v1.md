---
id: e2-localization-cohesion-implementation-v1
title: Arrival Atlas — Localization Cohesion Implementation v1 (E2)
project: Arrival Atlas
system: Arrival Atlas
type: implementation
domain: product
status: active
maturity: evolving
owner: product-engineering
tags:
  - e2
  - localization
  - i18n
created: 2026-09-08
updated: 2026-09-08
---

# E2 Localization Cohesion Implementation v1

## Verdict

**E2 LOCALIZATION COHESION PASS WITH LIMITATIONS**

Browser probe cohesion checks: **PASS** (0 P0/P1; Journey Guide FAB not visible on this path → P3). Product verdict remains **WITH LIMITATIONS** for residual EN spill in non-chrome domains and Guide visibility on the E2 path.

## Localization architecture

```text
Welcome language / Profile preferredLanguage / localStorage(arrival_atlas_display_language)
  → AppProvider.language
  → document.documentElement.lang (ua → uk)
  → getTranslations(lang) = { ...EN_BASE, ...localeOverrides }
  → t(key) = shell.translations[key] ?? getTranslations(lang)[key] ?? key
```

Namespaces composed in `packages/core/src/i18n/index.ts` (shell-home, **atlas-home**, guide, certainty, profile, discovery, employment, life-event, economic-reality, …).

## Fallback / inheritance model

| Mechanism | Status |
| --- | --- |
| Per-key miss → EN via `{ ...EN, ...locale }` compose | **Allowed** (documented) |
| Whole-language `UA = { ...RU }` | **Forbidden** — removed from Discovery |
| Missing key with no EN | Returns raw key string |

## Language integrity contract

Selected UI language owns primary user-facing prose. Intentionally untranslated: product name “Arrival Atlas”, URLs, route/technical ids, company/legal names, external official terms where translation misleads.

## UA ← RU findings & fix

- **Root cause:** `DISCOVERY_I18N.ua` previously spread `...RU`.
- **Fix:** `UA = { ...EN, …explicit UA }`; removed duplicate keys that broke `tsc`.
- **Regression:** `localization-cohesion.e2.test.ts` + `discovery-ua-localization.e1.test.ts` assert no `...RU` inheritance and chrome UA ≠ RU.

## Atlas Home findings & fix

- Member slides/nodes/timeline/side-panel were hard-coded English in `atlas-data.ts`.
- Added `packages/core/src/i18n/atlas-home-translations.ts` (EN/DE/RU/UA) and merged into `index.ts`.
- Wired `t()` in `AtlasSlide`, `AtlasSidePanel`, `AtlasMap`, `JourneyTimeline`, `AtlasSlider`, `useAtlasLocationLabel`.

## Journey Guide findings

- Primary chrome keys already localized (e.g. UA `Провідник`).
- Browser E2 path did not surface `.journey-guide-fab` (P3) — dictionary checks still cover Guide keys.
- Residual EN may still appear from interpolated node titles / mission fallbacks (P2).

## Cross-module findings

Probe walked Registration → ER → Healthcare → Employment → Discovery → Profile for all four languages; `document.lang` + `arrival_atlas_display_language` stayed stable across navigation and reload.

## SSR / document.lang

Existing `AppProvider` + `display-language.ts` sync (`ua` → `uk`). Covered by `document-language-sync.test.tsx` and E2 probe.

## Missing-key behavior

Deterministic: locale override → EN compose → raw key. No silent RU under UA after Discovery fix.

## Files changed (primary)

- `packages/core/src/i18n/discovery-translations.ts` — UA inheritance fix
- `packages/core/src/i18n/atlas-home-translations.ts` — new
- `packages/core/src/i18n/index.ts` — merge atlas-home
- `packages/core/src/i18n/localization-cohesion.e2.test.ts` — new
- `apps/web/src/components/atlas-home/{atlas-data,AtlasSlide,AtlasSidePanel,AtlasMap,JourneyTimeline,AtlasSlider,useAtlasLocationLabel}.*`
- `tools/black-box-audit/probes/probe-e2-localization-cohesion.mjs`
- `tools/black-box-audit/E2-LOCALIZATION-COHESION-DESIGN-v1.md`
- `tools/black-box-audit/E2-LOCALIZATION-COHESION-IMPLEMENTATION-v1.md`

## Tests run

- `packages/core/src/i18n/localization-cohesion.e2.test.ts`
- `packages/core/src/i18n/discovery-ua-localization.e1.test.ts`
- web: document-language-sync, localization-audit, discovery-ui, shell-home/guide i18n

## Browser validation

`node tools/black-box-audit/probes/probe-e2-localization-cohesion.mjs`

Artifacts: `tools/black-box-audit/artifacts/e2-localization-cohesion/`

## Remaining limitations

| Sev | Item |
| --- | --- |
| P2 | Economic Reality UA copy still spreads EN for untranslated keys |
| P2 | Journey Guide interpolated domain titles may remain EN |
| P2 | Some Discovery/other keys still EN via per-key fallback (not RU) |
| P3 | Journey Guide FAB not visible on E2 welcome→guest→member path |
| P3 | Employment absent from primary HUD (E1 carry-over) |
| P3 | ER recalculation toast remount (E1 carry-over; out of E2 scope) |

## Product decisions still required

1. Whether ER should get a full UA dictionary (vs intentional EN fallback for sparse copy).
2. Whether Guide FAB should appear earlier in the guest/member path for localization audits.
3. How aggressively to translate remaining Discovery secondary strings vs leave EN fallback.
