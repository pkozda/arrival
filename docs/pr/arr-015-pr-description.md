# UX-P3: Profile Edit & Correction Layer — MutationRequest builder UI

Implements **UX-P3 (Profile Edit & Correction Layer)** on top of the P1 mutation system: Profile becomes a controlled **MutationRequest builder** over `UserContextV1`, not a CRUD form or settings page.

**Branch:** `arr-015`  
**Depends on:** P1 mutation pipeline (`submitMutation`, `fetchUserContext`, contract lock)  
**Roadmap:** [profile-system-p3-roadmap.md](../identity/profile-system-p3-roadmap.md)

## Summary

Users can now correct situation data from Profile via human-language editors. All writes go through `POST /api/mutations` with `source.kind: 'profile_ui'`. No backend changes, no new mutation types, no `PATCH /api/profile`.

```text
UserContextV1 (read) → DomainMutationEditor (draft) → submitMutation() → UserContextV1 (refresh)
```

## What was done

### Profile correction library (`apps/web/src/lib/profile-correction/`)

| Module | Purpose |
|--------|---------|
| `domain-field-definitions.ts` | Human-readable field configs for all 7 mirror sections |
| `mutation-request-builder.ts` | Builds `fact.correct` / `pref.update` requests from draft values |
| `submit-domain-correction.ts` | Sequential submit with revision conflict retry |
| `revision-conflict.ts` | Parses current head revision from API conflict errors |

**Domain mapping:**

| Mirror section | Mutation domain(s) |
|----------------|-------------------|
| Your move to Germany | `migration` |
| Where you live | `housing` |
| Household & family | `household` |
| Work & income | `employment` + `income` (multi-request on save) |
| Health insurance | `healthInsurance` |
| Benefits & support | `benefits` |
| Language & display | `pref.update` (+ session language/theme sync) |

### UI components

| Component | Role |
|-----------|------|
| `DomainMutationEditor` | Section-scoped edit → save/cancel flow |
| `DomainFieldRenderer` | Plain-language inputs (no schema keys in UI) |
| `ProfileEditCTA` | "Correct information" entry point |
| `ProfileCorrectionToast` | Post-save feedback banner |

### Routes & wiring

- **New route:** `/profile/[domainSlug]/edit`
- **`ProfileDomainDetail`** — edit CTA + success toast via `?updated=1`
- **`ProfileDomainSectionCard`** — edit link on overview cards (with and without data)
- **`AppProvider`** — tracks `profileHeadRevision` from mutation responses
- **Mutation client** — returns `{ userContext, revision }`; throws `MutationClientError` with API codes

### Documentation

- New roadmap: `docs/identity/profile-system-p3-roadmap.md` (UX-P3, tagged `arr-015`)
- Link added to `docs/README.md` and `profile-system-v1-roadmap.md`

## Architecture compliance (P1 lock preserved)

- ✅ Reads situation data via `selectUserContextProfile(userContext)` only
- ✅ Writes via `submitMutation()` only — no `PATCH /api/profile`
- ✅ No reads from `snapshot.userContext` for domain logic
- ✅ `fact.correct` uses `source: { kind: 'profile_ui', domain }` + `expectedHeadRevision`
- ✅ `fact.create` / `fact.update` not exposed in Profile UI (engine rejects for `profile_ui`)
- ✅ Draft state is client-only (UX Contract v2 `fact.suggest_correction` semantics — not sent to API)

## Save flow

```text
/profile/[slug]/edit
  → user edits fields (client draft)
  → buildDomainCorrectionRequests()
  → submitMutation() per changed domain
  → refreshSessionState()
  → redirect /profile/[slug]?updated=1
  → toast: "Your situation was updated"
```

**Revision handling (no backend change):** `profileHeadRevision` tracked in `AppProvider`; on `REVISION_CONFLICT`, auto-retry once with parsed current head from error message.

## Key files

```
apps/web/src/lib/profile-correction/
apps/web/src/components/profile/DomainMutationEditor.tsx
apps/web/src/components/profile/DomainFieldRenderer.tsx
apps/web/src/components/profile/ProfileEditCTA.tsx
apps/web/src/components/profile/ProfileCorrectionToast.tsx
apps/web/src/app/profile/[domainSlug]/edit/page.tsx
apps/web/src/lib/mutations/client.ts          (revision in response)
apps/web/src/components/AppProvider.tsx       (profileHeadRevision)
docs/identity/profile-system-p3-roadmap.md
```

## Test plan

- [x] `@arrival-atlas/web` — **51/51** tests
- [x] `mutation-request-builder.test.ts` — request shape + change detection
- [x] `contract-lock.test.ts` — includes `DomainMutationEditor` selector check
- [x] `mutation-boundary.test.ts` — no `/api/profile` usage
- [ ] Smoke: open `/profile/work-income/edit`, change income, save → mirror updates
- [ ] Smoke: save after module execute (revision conflict retry path)
- [ ] Smoke: language correction syncs Header language
- [ ] Smoke: cancel returns to read view without mutation

## Out of scope (follow-up phases)

- Provenance line *"You edited this"* on read view (Phase 4)
- Explicit `fact.invalidate` / field clear actions
- `headRevision` on `GET /api/user-context` (remove client retry hack)
- `children` array editing in household domain
- Backend / mutation engine changes

## Non-goals (confirmed)

- ❌ No new mutation types or data models
- ❌ No scenario / what-if fields in Profile editor
- ❌ No `SchemaForm` reuse for corrections
- ❌ No settings expansion beyond language/display prefs in mirror section

## Definition of Done (UX-P3 Phase 1–2)

- [x] User can open correction editor for any Profile mirror section
- [x] All corrections go through Mutation Layer
- [x] No schema leakage in UI labels
- [x] Profile read-only outside edit mode
- [x] Boundary tests green

**Remaining for full UX-P3 lock:** provenance polish, invalidate flow, API head revision exposure (see roadmap Phases 3–4).
