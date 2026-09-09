---
id: e2-localization-cohesion-design-v1
title: Arrival Atlas — Localization Cohesion & Language Integrity Design v1 (E2)
project: Arrival Atlas
system: Arrival Atlas
type: design
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

# E2 Localization Cohesion Design v1

## Architecture (verified)

```text
Welcome / Profile preferredLanguage / localStorage(arrival_atlas_display_language)
  → AppProvider language
  → document.documentElement.lang (ua → uk)
  → getTranslations(lang) = { ...EN, ...locale }
  → t(key) = locale[key] ?? EN[key] ?? key
```

## Integrity contract

| Selected | Primary prose |
| --- | --- |
| UA | Ukrainian |
| RU | Russian |
| DE | German |
| EN | English |

**May remain untranslated:** product name “Arrival Atlas”, URLs, route ids, company/legal names, intentional English product identifiers.

## Fallback vs inheritance

* **Allowed:** per-key miss → English via `getTranslations` / `t()`.
* **Forbidden:** whole-language namespace inheritance (`UA = { ...RU }`) as the primary UA dictionary mechanism.

## Scope for this slice

1. Remove Discovery `UA = { ...RU }`; use `...EN` + explicit UA overrides (translate remaining RU-leaked keys).
2. Localize Atlas Home member chrome + slide/node/timeline copy via **atlas-home** keys (`ATLAS_HOME_I18N`).
3. Journey Guide chrome already has UA keys — verify; fix only accidental EN hard-codes in shared chrome.
4. Regression tests + four-language browser probe.

## Non-goals

New i18n framework; full ER copy rewrite; translating URLs/identifiers; domain/nav redesign.

## Implementation status

See `E2-LOCALIZATION-COHESION-IMPLEMENTATION-v1.md`.
