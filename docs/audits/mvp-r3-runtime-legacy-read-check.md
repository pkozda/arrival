---
id: mvp-r3-runtime-legacy-read-check
title: MVP-R3 Runtime Legacy Read Check
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: platform
status: active
maturity: stable
owner: system
tags:
  - legacy-removal
created: 2026-06-01
updated: 2026-06-19
related:
---

# MVP-R3 Phase 2 — Runtime Legacy Read Check

**Date:** June 2026  
**Refactor ID:** MVP-R3 Phase 2  
**Scope:** `userProfile.language` and `context.userProfile` usage across repository  
**Status:** Post Phase 2 migration

---

## Summary

After Phase 2, **no production runtime module** reads `context.userProfile.language` as the primary source. `healthcare-navigation` and `system-translation` now resolve language via `profileSlice.preferredLanguage` with a temporary `userProfile.language` fallback.

Remaining `userProfile` references are **legacy writers** (context-builder, session, web client) or **tests** — deferred to Beta (Phase 4).

---

## Inventory

| File | Runtime Module? | Read/Write | Action Needed |
|------|:---------------:|------------|---------------|
| `packages/modules/src/healthcare-navigation/index.ts` | Yes | Read (fallback only) | ✅ **Done** — primary: `profileSlice.preferredLanguage` |
| `packages/modules/src/system-translation/index.ts` | Yes | Read (fallback only) | ✅ **Done** — primary: `profileSlice.preferredLanguage` |
| `packages/modules/src/financial-reality/index.ts` | Yes | None | ✅ No `userProfile` reads |
| `packages/modules/src/benefits-simulator/index.ts` | Yes | None | ✅ Ignores context |
| `packages/modules/src/life-event/index.ts` | Yes | None | ✅ Ignores context |
| `packages/modules/src/grocery-optimization/index.ts` | Yes | None | ✅ Ignores context |
| `packages/profile/src/engine/context-builder.ts` | No (platform) | **Write** — builds `userProfile` shim | Legacy writer — Beta cleanup |
| `packages/profile/src/engine/context-builder.ts` | No | **Write** — provenance `userProfile.*` | Legacy writer — Beta cleanup |
| `packages/core/src/session/index.ts` | No (session) | **Write** — merges `userProfile` into session | Legacy writer — Beta cleanup |
| `packages/core/src/types/index.ts` | No (schema) | Schema definition | Phase 4 removal |
| `apps/web/src/components/AppProvider.tsx` | No (client) | **Write** — `createSession({ userProfile: { language } })` | Legacy writer — Beta cleanup |
| `apps/web/src/app/modules/healthcare-navigation/page.tsx` | No (client) | **Write** — execute context | Legacy writer — Beta cleanup |
| `apps/web/src/app/modules/system-translation/page.tsx` | No (client) | **Write** — execute context | Legacy writer — Beta cleanup |
| `apps/web/src/app/modules/financial-reality/page.tsx` | No (client) | **Write** — execute context | Legacy writer — Beta cleanup |
| `apps/web/src/app/modules/grocery-optimization/page.tsx` | No (client) | **Write** — execute context | Legacy writer — Beta cleanup |
| `apps/web/src/app/modules/life-event/page.tsx` | No (client) | **Write** — execute context | Legacy writer — Beta cleanup |
| `packages/profile/src/engine/resolve-execution-context.test.ts` | Test | Assert `userProfile.income` | No action |
| `packages/profile/src/profile.integration.test.ts` | Test | Assert `userProfile.income` | No action |
| `apps/api/src/profile.integration.test.ts` | Test | Session create with `userProfile.language` | No action |
| `apps/api/src/profile-ui-contract.test.ts` | Test | Session create with `userProfile.language` | No action |
| `packages/profile/src/engine 2/context-builder.ts` | Duplicate | Write | Hygiene — remove duplicate dir |
| `packages/profile/src/engine 2/resolve-execution-context.test.ts` | Duplicate test | Assert income | Hygiene |

---

## Classification

### Runtime module reads — MVP-R3 status

| Module | `userProfile.language` primary read? | Status |
|--------|:------------------------------------:|--------|
| `healthcare-navigation` | No | ✅ Migrated Phase 2 |
| `system-translation` | No | ✅ Migrated Phase 2 |
| `financial-reality` | No | ✅ Migrated Phase 1 (uses `profileSlice` for insurance/benefits) |
| All other modules | No | ✅ N/A |

**Success condition met:** No production runtime module depends primarily on `userProfile.language`.

### Legacy writers (allowed until Beta)

- `context-builder.ts` — populates `userProfile` from `policyDocument`
- `session/index.ts` — persists session context
- Web module pages + `AppProvider` — send `userProfile.language` on execute/session create

### Test-only references

- Profile integration and resolve-execution-context tests assert `userProfile.income` (legacy shim behavior)
- API tests seed sessions with `userProfile.language`

---

## Phase 3+ follow-up

| Item | Target phase |
|------|--------------|
| Remove `userProfile.language` fallback in modules | Phase 3 |
| Stop web client sending `userProfile` on execute | Phase 4 |
| Remove `userProfile` from `AppContextSchema` | Phase 4 (BETA-R9) |
| Remove `context-builder` shim construction | Phase 3 |

---

*End of runtime legacy read check.*
