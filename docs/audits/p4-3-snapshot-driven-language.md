# P4.3 — Snapshot-Driven Language

**Date:** June 2026  
**Status:** Implemented  
**Scope:** Frontend state unification — language derived from UiSnapshot only  
**Backend changes:** None  
**Business logic changes:** None

---

## Objective

Eliminate parallel language state and enforce:

> UI language must be fully derived from `UiSnapshot.session.language`

---

## Problem (Before)

```text
ensureSession → AppProvider.language (useState) ❌
                    ↓
            translations / execute context / UI
```

Language could diverge from `uiSnapshot.session.language` after reload or session restore.

---

## Target Architecture (After)

```text
session (server)
        ↓
UiSnapshot.session.language
        ↓
getSessionLanguage(snapshot)
        ↓
AppProvider.language (derived via useMemo)
        ↓
fetchTranslations(language)
        ↓
UI + executeModule({ userProfile: { language } })
```

### Invariant

```text
language = getSessionLanguage(uiSnapshot)
```

No `useState` for language. No `setLanguage`. No localStorage language persistence.

---

## Changes Implemented

### 1. AppProvider — removed independent language authority

**Before:**
```typescript
const [language, setLanguageState] = useState<SupportedLanguage>('en');
const setLanguage = useCallback((lang) => setLanguageState(lang), []);
```

**After:**
```typescript
const language = useMemo(() => getSessionLanguage(uiSnapshot), [uiSnapshot]);
```

- Removed `useState` for language
- Removed `setLanguage`
- Added `changeLanguage(lang)` — PATCH session + force snapshot apply

### 2. Session bootstrap alignment

```typescript
ensureSession({ userProfile: { language: 'en' } })
```

New sessions default to `'en'` server-side. Existing sessions restore from localStorage sessionId; language comes from first UiSnapshot fetch.

### 3. Translation system alignment

```typescript
useEffect(() => {
  fetchTranslations(language).then(setTranslations).catch(console.error);
}, [language]);
```

`language` is derived from snapshot — translations reload when snapshot language changes.

### 4. Execute context alignment

Module pages consume `language` from `useApp()`:

```typescript
executeModule(input, { userProfile: { language } }, sessionId);
```

Since `language` is snapshot-derived, execute context matches UI and snapshot.

### 5. Language switching (Header)

**Before:** `setLanguage(lang.code)` — local state only

**After:** `changeLanguage(lang.code)` — server-first flow:

```text
changeLanguage(lang)
  → PATCH /api/sessions/:id { context: { userProfile: { language } } }
  → fetchUiSnapshot()
  → applySnapshot() (force apply — session PATCH does not bump snapshotVersion)
  → language derived from new snapshot
  → translations refetch
```

### 6. New selector

`apps/web/src/lib/snapshot/selectors/get-session-language.ts`:

```typescript
export function getSessionLanguage(snapshot: UiSnapshot | null): SupportedLanguage
```

Validates against `SupportedLanguageSchema`; fallback `'en'`.

### 7. New API helper

`apps/web/src/lib/api.ts`:

```typescript
export async function updateSessionLanguage(sessionId: string, language: string): Promise<void>
```

---

## P3 Interaction Note

Session language PATCH does **not** increment `snapshotVersion`. Standard `applySnapshotIfNewer` would reject a refresh with the same version but updated language.

**Resolution:** `changeLanguage` uses `applySnapshot()` (force apply) after explicit user action. Version monotonicity for mutations is preserved; language switch is an intentional snapshot replace.

---

## Edge Cases

| Case | Behavior |
|------|----------|
| `uiSnapshot` null | `getSessionLanguage` → `'en'` |
| Missing `session.language` | Fallback `'en'` |
| Translation fetch delay | Previous translations retained until new fetch completes |
| Snapshot updates language | `useMemo` recomputes → translations refetch → UI re-renders |
| Page reload | Session restored → snapshot loads → language from server |

---

## Validation Scenarios

### Scenario A — Reload

1. Session has `userProfile.language = 'de'`
2. Reload app
3. UiSnapshot loads with `session.language = 'de'`
4. `AppProvider.language = 'de'`

✅ UI and translations consistent with server

### Scenario B — Session change

1. User selects RU in Header
2. `PATCH /api/sessions/:id`
3. Snapshot refresh + force apply
4. `language = 'ru'`, translations refetch

✅ Automatic UI update

### Scenario C — No divergence

```text
execute language == UI language == snapshot.session.language
```

All three read the same derived `language` from AppProvider context.

---

## Success Criteria

| Criterion | Status |
|-----------|--------|
| No AppProvider language state | ✅ |
| Language derived from UiSnapshot | ✅ |
| Execute uses snapshot.language | ✅ |
| Translation system depends only on snapshot | ✅ |
| No localStorage language persistence | ✅ |
| No dual-language source-of-truth | ✅ |
| Reload preserves language deterministically | ✅ |
| Typecheck passing | ✅ |

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/components/AppProvider.tsx` | Derived language; `changeLanguage`; removed `setLanguage` |
| `apps/web/src/components/Header.tsx` | `changeLanguage` instead of `setLanguage` |
| `apps/web/src/lib/api.ts` | Added `updateSessionLanguage` |
| `apps/web/src/lib/snapshot/selectors/get-session-language.ts` | **New** selector |
| `apps/web/src/lib/snapshot/selectors/index.ts` | Export |
| `apps/web/src/lib/snapshot/index.ts` | Export |

Module pages unchanged — already consume `language` from `useApp()`.

---

## Final Result

Language is now part of the UiSnapshot projection model:

```text
UI = f(UiSnapshot)
```

The last active parallel UI state axis for localization (P4.1 item **D2**) is eliminated.
