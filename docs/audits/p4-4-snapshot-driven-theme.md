# P4.4 — Snapshot-Driven Theme & UI Preferences

**Date:** June 2026  
**Status:** Implemented  
**Scope:** Frontend state unification — theme derived from UiSnapshot  
**Business logic changes:** None

---

## Objective

Eliminate client-side theme persistence and enforce:

> Theme must be fully derived from `UiSnapshot.session.uiPreferences.theme`

---

## Architecture

### Before

```text
localStorage('arrivalos-theme') → AppProvider.theme (useState) ❌
```

### After

```text
session.userProfile.uiPreferences.theme (server)
        ↓
UiSnapshot.session.uiPreferences.theme
        ↓
getThemePreference(snapshot) / resolveTheme()
        ↓
AppProvider.theme (derived)
        ↓
document.documentElement.dataset.theme
```

---

## Changes Implemented

### 1. Core schema (`packages/core`)

Extended `UserProfileSchema` with optional `uiPreferences.theme`:

```typescript
ThemePreference = 'light' | 'dark' | 'system'
```

Enables `PATCH /api/sessions/:id` to persist theme server-side.

### 2. Snapshot projection (`apps/api/routes/ui-snapshot.ts`)

Session object now includes:

```typescript
session: {
  sessionId: string;
  language: string;
  uiPreferences: { theme: 'light' | 'dark' | 'system' };
}
```

Default: `{ theme: 'light' }` when unset.

### 3. Selectors (new)

| File | Exports |
|------|---------|
| `get-theme.ts` | `getThemePreference`, `resolveTheme`, `getTheme`, `ResolvedTheme` |
| `get-ui-preferences.ts` | `getUiPreferences` (theme + language) |

### 4. AppProvider

**Removed:**
- `useState(theme)`
- `setTheme`
- `getInitialTheme()`
- `localStorage.setItem('arrivalos-theme', ...)`

**Added:**
```typescript
const themePreference = useMemo(() => getThemePreference(uiSnapshot), [uiSnapshot]);
const theme = useMemo(
  () => (themePreference === 'system' ? systemTheme : resolveTheme(themePreference)),
  [themePreference, systemTheme]
);
```

- `changeTheme(theme)` → `PATCH` session → snapshot refresh → force apply
- `toggleTheme()` → `changeTheme(resolved === 'dark' ? 'light' : 'dark')`
- `clearLegacyThemeStorage()` on mount (one-time migration)
- `useSystemColorScheme()` via `useSyncExternalStore` for `'system'` preference

### 5. API helper

```typescript
updateSessionTheme(sessionId, theme: 'light' | 'dark' | 'system')
```

### 6. ThemeScript / layout

- Removed localStorage reads from inline script
- Default SSR theme: `light` (`layout.tsx`, `ThemeScript.tsx`)

### 7. Header

`toggleTheme()` now triggers server-authoritative `changeTheme` via AppProvider (no local mutation).

---

## State Authority After P4.4

| Domain | Source |
|--------|--------|
| Language | UiSnapshot ✅ |
| Theme | UiSnapshot ✅ |
| UX | UiSnapshot ✅ |
| Execution results | UiSnapshot ✅ |
| Profile | UiSnapshot ✅ |

---

## Validation

| Scenario | Result |
|----------|--------|
| A — Reload with session theme=dark | Theme from snapshot ✅ |
| B — User toggles theme | PATCH → snapshot → UI updates ✅ |
| C — Multi-device | Server session is source ✅ |

| Criterion | Status |
|-----------|--------|
| No local theme state | ✅ |
| Theme derived from UiSnapshot | ✅ |
| No localStorage theme usage (except cleanup) | ✅ |
| Theme changes via session PATCH only | ✅ |
| Reload consistency | ✅ |
| Typecheck + API tests (26/26) | ✅ |

---

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/types/index.ts` | `ThemePreferenceSchema`, `UiPreferencesSchema` |
| `apps/api/src/routes/ui-snapshot.ts` | Project `uiPreferences` in session |
| `apps/api/src/ui-snapshot.test.ts` | Updated session assertion |
| `apps/web/src/lib/snapshot/selectors/get-theme.ts` | **New** |
| `apps/web/src/lib/snapshot/selectors/get-ui-preferences.ts` | **New** |
| `apps/web/src/components/AppProvider.tsx` | Derived theme, `changeTheme` |
| `apps/web/src/lib/api.ts` | `updateSessionTheme`, `clearLegacyThemeStorage` |
| `apps/web/src/components/ThemeScript.tsx` | No localStorage |
| `apps/web/src/app/layout.tsx` | Default `data-theme="light"` |

---

## Final Verdict

> **Is UiSnapshot now the only UX + preference read authority?**

**Yes** — for all persistent UI preferences in scope:

- Language → `session.language`
- Theme → `session.uiPreferences.theme`
- UX cards → `uxSnapshot`
- Module state → `executions` + `profile`

```text
UI = f(UiSnapshot)
```

No parallel client persistence layers remain for language or theme.
