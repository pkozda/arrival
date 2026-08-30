# arr-035 — Runtime localization · Guide · Certainty · Profile Intake · html lang sync

**Branch:** `arr-035`  
**Tracks:** Newcomer-path localization (EN · DE · RU · UA) · Phase 1 shell/home · Phase 2A Journey Guide · Phase 2B Certainty · Phase 3 Profile Intake · document language persistence · localization smoke automation  
**Base:** `develop` (post arr-034)

Ships the localization stack that makes Arrival Welcome language selection **stick through the newcomer journey** — Guest Home, Atlas HUD, Journey Guide, Certainty chrome, and Profile Intake — without introducing a second i18n library or a parallel language state.

1. **Phase 1 — Shell / Home** — Guest Landing, Atlas HUD, Leave Demo, Onboarding Checklist via `useApp().t()` + `shell-home-translations`.
2. **Phase 2A — Journey Guide chrome** — welcome, speech, cinematic unlock templates, mission labels via `guide-translations`.
3. **Phase 2B — Certainty presentation** — language-neutral `{ key, params }` descriptors from formatters; UI resolves via `resolveCertaintyMessage` + `certainty-translations`.
4. **Phase 3 — Profile Intake** — domain field defs become `labelKey` / option `labelKey`; edit form + CTAs + toast via `profile-translations`.
5. **html `lang` persistence** — AppProvider keeps `document.documentElement.lang` aligned after bootstrap / remount / returning-user restore (`ua` → `uk`).
6. **Localization smoke** — Playwright newcomer + Profile Intake detectors (unexpected English · raw keys · dictionary parity).

**Product verdict:** After a newcomer selects DE / RU / UA on Arrival Welcome, core chrome must **not snap back to English** on Guest Home, Enter Atlas, Guide, Certainty (when enabled), or Profile Intake. Official German administrative terms (Bürgergeld, ALG I, Wohngeld, GKV, PKV) may remain in place with localized surrounding copy.

**Diff vs `develop` (working tree):** ~57 tracked files (+~1.1k / −~0.5k) plus new untracked dictionaries, unit tests, and `tests/e2e/localization/` · core i18n namespaces: shell **32** · guide **37** · certainty **18** · profile **85** keys × 4 locales.

---

# Part 1 — Architecture (source of truth)

## Invariant

```text
arrival_atlas_display_language
        ↓
AppProvider language
        ↓
useApp().t()  ← getTranslations(language) from @arrival-atlas/core
        ↓
document.documentElement.lang  (via syncDocumentLanguage)
```

**Do not add:** a second language store, `react-i18next` / similar, or surface-specific `useProfileI18n()` hooks.

## Core dictionary merge

`packages/core/src/i18n/index.ts` merges into `getTranslations()`:

| Namespace | Module | Keys (approx.) | Surfaces |
|-----------|--------|----------------|----------|
| `common.*` / `nav.*` / `home.*` | `shell-home-translations.ts` | 32 | Guest Home · HUD · Leave Demo · Onboarding |
| `guide.*` | `guide-translations.ts` | 37 | Journey Guide chrome · cinematic · missions |
| `certainty.*` | `certainty-translations.ts` | 18 | Certainty UI templates |
| `profile.*` | `profile-translations.ts` | 85 | Profile Intake fields · options · actions |

Existing Life Event / Economic Reality dictionaries remain; this PR does **not** expand ER localization.

## Document language mapping

| App language | `document.documentElement.lang` |
|--------------|----------------------------------|
| `en` | `en` |
| `de` | `de` |
| `ru` | `ru` |
| `ua` | **`uk`** |

SSR `layout.tsx` may still render `lang="en"`. After client locale resolve, AppProvider syncs the tag. Returning users (welcome completed) restore from `arrival_atlas_display_language` without revisiting Welcome.

---

# Part 2 — Phase 1 · Shell / Home

## Problem

Welcome localized copy, but Guest Home / HUD / Leave Demo / Onboarding still hardcoded English → language felt broken immediately after Continue.

## Changes

- Guest Landing, Atlas HUD, Leave Demo Confirm, Onboarding Checklist Card → `useApp().t()`.
- `guest-landing-data` / HUD labels use translation keys where product-authored.
- Unit: `shell-home-i18n.test.ts`, `__tests__/atlas-home/shell-home-i18n.test.tsx`.

## Reused commons

`common.cancel` · `common.close` · `common.dismiss` · `common.continue` (and existing `common.*` from core).

---

# Part 3 — Phase 2A · Journey Guide chrome

## Problem

Guide welcome / speech / unlock overlays / mission titles stayed English after Welcome language selection.

## Architecture

```text
guide-translations (core)
  └── JourneyGuide* · cinematic-unlock-engine · recommendation-engine
        · formatGuideSpeech / Mission / Outcome · mission-labels
              └── useApp().t() at render / speech construction
```

Certainty-authored speech remains Phase 2B (descriptors). Guide chrome no longer embeds English string literals for localized surfaces.

## Tests

- `guide-i18n.test.ts`
- `__tests__/journey-guide/guide-i18n.test.tsx`
- Existing Guide × Certainty adapter tests updated for descriptor / key shape

---

# Part 4 — Phase 2B · Certainty presentation

## Problem

Certainty formatters returned English sentences; domain layer risked baking language into semantic state.

## Architecture

```text
Certainty formatters
  → CertaintyMessageDescriptor { key, params }
  → resolveCertaintyMessage(descriptor, t)
  → localized UI (BecauseExplanation · NextStepCard · ProgressDelta · Header)
```

**Domain stays language-agnostic** — no React / `useApp` inside certainty formatters.

Guide certainty adapter consumes descriptors and resolves with the same `t()`.

## Package map

| File | Role |
|------|------|
| `packages/core/.../certainty-translations.ts` | `certainty.*` templates |
| `lib/certainty/types.ts` | `CertaintyMessageDescriptor` |
| `lib/certainty/resolve-message.ts` | Presentation resolver |
| `lib/certainty/formatters/*` | Emit keys + params |
| `components/certainty/*` | Resolve via `t()` |

## Tests

- `certainty-i18n.test.ts`
- Updated `certainty.test.ts` · adapter · UI primitive tests

---

# Part 5 — Phase 3 · Profile Intake

## Problem

Profile domain edit form (`DomainMutationEditor` / `DomainFieldRenderer`) used English `label` / `option.label` strings — newcomers hitting Profile Intake after DE/RU/UA selection snapped back to English.

## Architecture

```text
Profile domain (language-neutral)
  formKey / value / labelKey / titleKey / summaryKey / placeholderKey
        ↓
useApp().t(labelKey)
        ↓
localized Intake UI
```

**Bad (removed):** `{ label: 'Residency status' }` on domain defs.  
**Good:** `{ labelKey: 'profile.fields.residencyStatus' }`.

Canonical option values unchanged (`eu-citizen`, `employed`, …). Official terms kept where product convention requires (Bürgergeld, ALG I, Wohngeld, GKV, PKV).

Life Event cold-start intake shares `DomainFieldRenderer`; its fields point at existing `life-event.intake.*` keys (already localized).

## Surfaces localized

- Field labels · enum options · placeholders · section title/summary
- Save / Saving… / Cancel · Correct information · Edit domain · Back to {title}
- Profile correction toast · section-not-found · select placeholder
- Representative `aria-label`s bound to the same translated labels

## Out of scope (this PR)

- Full Profile galaxy overview / mirror read-view copy (`profile-mirror-utils` English remains)
- Economic Reality localization phase
- Translating user-entered data

## Tests

- `profile-i18n.test.ts`
- `__tests__/profile/profile-intake-i18n.test.tsx` (runtime DE→RU→UA without reload)
- Focused E2E: `tests/e2e/localization/profile-intake-localization.spec.ts`

---

# Part 6 — html lang persistence fix

## Root cause

SSR / full navigation remount reset `<html lang="en">`. UI language restored from storage for `t()`, but `syncDocumentLanguage` only ran on explicit Welcome select / `changeLanguage` — **not** on bootstrap restore.

## Fix

Authoritative sync in `AppProvider` after `clientLocaleReady`:

```ts
useEffect(() => {
  if (!clientLocaleReady) return;
  syncDocumentLanguage(language);
}, [clientLocaleReady, language]);
```

Helpers: `toDocumentLanguageTag` · `syncDocumentLanguage` in `lib/i18n/display-language.ts`.

## Regression tests

`__tests__/app-provider/document-language-sync.test.tsx`:

- Runtime `changeLanguage` → html lang
- Stored `ua` → `uk` after bootstrap (no Welcome)
- Returning user `de` + welcome completed
- Remount after simulated SSR `lang=en`

---

# Part 7 — Localization smoke automation

## Purpose

Automated **reality check** for the newcomer path — detects unexpected English chrome and raw translation keys. Does not “fix” product gaps by allowlisting them away.

## Layout (`apps/web/tests/e2e/localization/`)

| File | Role |
|------|------|
| `localization-audit.ts` | Probes · raw-key regex · English-as-locale dictionary detector |
| `fixtures.ts` | Welcome → Guest → Atlas → LE → Guide → **Profile Intake** flow |
| `newcomer-localization.spec.ts` | Smoke per locale |
| `profile-intake-localization.spec.ts` | Focused Intake audit |
| `welcome-copy.ts` · `load-core-i18n.ts` | Welcome strings + core dict load |

## Surfaces reported

```text
Arrival Welcome
Guest Home
Atlas HUD
Atlas HUD (exploring)
Onboarding Checklist (optional)
Life Events
Journey Guide
Certainty (optional / flag)
Profile Intake
document.documentElement.lang
```

## Script

```bash
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" \
  npm run test:e2e:localization -w @arrival-atlas/web
```

(`PW_SKIP_WEBSERVER=1` when `npm run dev` already serving.)

## Dictionary completeness

`dictionary-completeness.test.ts` asserts key parity for shell / guide / certainty / profile across `en|de|ru|ua` and flags English-as-Ukrainian values in those namespaces (with documented language-neutral exceptions).

---

# Part 8 — Relationship between deliverables

```text
arr-034  Arrival Welcome + Certainty contract + CSR
    ↓
arr-035  Same language choice must drive chrome + Intake + html lang
    ↓
future   Profile galaxy read-views · Economic Reality · deeper LE content polish
```

Welcome architecture from arr-034 is **unchanged** — this PR consumes `AppProvider.changeLanguage` / stored display language as the single source of truth.

---

# Part 9 — Architecture compliance

| Rule | Status |
|------|--------|
| No new i18n library | ✓ |
| No second language state | ✓ |
| AppProvider language is source of truth | ✓ |
| Domain / certainty formatters language-neutral | ✓ |
| Profile domain uses keys, not English labels | ✓ |
| User-generated content not translated | ✓ |
| Smoke detector not weakened to hide English | ✓ |
| `ua` has real Ukrainian (not `ua: en`) | ✓ |

---

## Known limitations

- Profile **galaxy inspector read-views** / `profile-mirror-utils` / `ux-labels` humanizers still largely English (Intake path is localized).
- Economic Reality chrome not part of this PR.
- Some Life Events body content beyond cold-start / already-keyed strings may still surface English probes depending on plan state.
- SSR initial HTML remains `lang="en"` until client sync (intentional hydration-safe tradeoff).
- Official German terms intentionally appear across locales.

---

## Test plan

### Unit / dictionary

```bash
cd packages/core && npm run build   # emit PROFILE_/GUIDE_/… into dist
cd apps/web && npm run test -- \
  src/lib/i18n/ \
  src/__tests__/profile/ \
  src/__tests__/app-provider/document-language-sync.test.tsx \
  src/__tests__/atlas-home/shell-home-i18n.test.tsx \
  src/__tests__/journey-guide/
```

Expected: dictionary completeness · shell/guide/certainty/profile i18n · document lang sync · Profile Intake component tests green.

### E2E localization

```bash
# with web+api already running:
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" \
  PW_SKIP_WEBSERVER=1 \
  npx playwright test localization/newcomer-localization localization/profile-intake-localization \
  -c playwright.config.ts
# from apps/web
```

Expected:

```text
en ✓  de ✓  ru ✓  ua ✓
  … Profile Intake ✓
  html lang = en | de | ru | uk
```

### Manual smoke

- [ ] Clear storage → Welcome → select **Ukrainian** → Continue → Guest Home Ukrainian · `html lang=uk`
- [ ] Enter Atlas → HUD localized · language survives `/modules/life-event` navigation
- [ ] Journey Guide welcome / FAB / speech in UA (when Guide present)
- [ ] Open `/profile/move-to-germany/edit` → field labels / enums / Save / Cancel in UA (no “Residency status”)
- [ ] Returning user: set `arrival_atlas_display_language=de` + welcome completed → fresh load → `lang=de` without Welcome
- [ ] Runtime language change (Profile language-display domain or Welcome-equivalent path) updates chrome without full reload where wired
- [ ] Certainty flags on → certainty panel chrome localized (not English templates)

### Regression

- [ ] arr-034 Welcome / Certainty flags-off paths unchanged
- [ ] arr-032 demo: Enter Atlas · Leave demo · session recreation
- [ ] Profile correction save still works; toast copy localized

---

## Related docs

- [arr-034-pr-description.md](./arr-034-pr-description.md) — Arrival Welcome · Certainty Layer · CSR
- [arr-033-pr-description.md](./arr-033-pr-description.md) — MBDE · Vision Bible
- [arr-032-pr-description.md](./arr-032-pr-description.md) — Phase 1 release blockers · demo session trust
- Vision onboarding / cognition notes under [`docs/vision/`](../vision/)
