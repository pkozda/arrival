---
id: malicious-beta-tester-ux-audit
title: Malicious Beta Tester UX Audit
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: product
status: active
maturity: draft
owner: system
tags:
  - chaos-testing
  - ux
  - qa
  - state-corruption
  - data-loss
  - race-conditions
created: 2026-07-01
updated: 2026-07-01
related:
  - production-readiness-ui-ux-audit
  - user-data-persistence-lifecycle-audit
  - runtime-reactivity-audit-v1
---

# Malicious Beta Tester UX Audit — Arrival Atlas

**Date:** July 2026  
**Scope:** `apps/web` — chaos scenarios from an impatient real user  
**Method:** Code-path analysis for race conditions, state corruption, data loss, and confusion under adversarial interaction (not load testing)  
**Persona:** Clicks too fast · refreshes mid-save · opens multiple tabs · loses network · hits Back during mutations · abandons flows · returns days later · resizes constantly · unexpected navigation sequences  

**Related:**  
[phase-1-release-blockers.md](../production-readiness/phase-1-release-blockers.md) ·  
[production-readiness-ui-ux-audit.md](./production-readiness-ui-ux-audit.md)

---

## Executive summary

The app has **some guards** (revision-conflict retry on profile mutations, `saving`/`pending` disables on forms, sync queue serialization in `RuntimeConsistencyModel`). Under adversarial use, users can still experience:

- **Silent data persistence** without confirmation (intake) or **perceived data loss** (session recreate)
- **Split-brain auth** across tabs (mock `sessionStorage` vs API `localStorage`)
- **Stacked overlays** on first Life Events visit (guide welcome + intake)
- **Form data loss** on navigation, sync remount, or language change
- **Cinematic/guide state corruption** when navigating or closing during timed sequences
- **Partial profile writes** when batch mutations fail mid-sequence

**Chaos readiness score: 3.5 / 10** — core mutations are often safe server-side, but **client UX lies** about what was saved, who is logged in, and what session owns the data.

---

# Chaos scenario matrix

| Scenario | Severity | Data lost? | UI inconsistent? | User confused? |
|----------|----------|------------|------------------|----------------|
| Double-click Save (profile) | Medium | Unlikely (idempotent revision) | Possible duplicate navigation | Maybe |
| Double-click Submit (module schema) | Medium | Possible duplicate module runs | Loading flicker | Yes |
| Browser Back during profile save | High | Unlikely (mutation completes) | Toast/`?updated=1` missed | **Yes** |
| Refresh during profile save | High | Unlikely | Success feedback lost | **Yes** |
| Refresh during LE intake save | High | Unlikely | Overlay may linger until sync | **Yes** |
| Two tabs — edit same domain | Medium | Unlikely (one retry) | Stale draft in tab B | **Yes** |
| Two tabs — mock login states differ | High | N/A | HUD differs per tab | **Yes** |
| Tab A logout / Tab B still “member” | High | API data remains | Split auth UI | **Yes** |
| Invalid session → new session | **Critical** | **Server data orphaned** | None shown | **Yes** |
| Network drop mid mutation batch | High | **Partial profile** | Error string only | **Yes** |
| Navigate away during cinematic | Medium | Unlock event persisted | Animation aborted | **Yes** |
| Close guide during cinematic | Medium | Same | Abrupt dim removal | **Yes** |
| Spam Replay discovery | Low | N/A | Timer reset (guarded) | Annoying |
| Language change mid-form | High | **Unsaved form values** | Mixed EN/guide + locale UI | **Yes** |
| Resize during guide anchor | Low | N/A | Probe jumps | Mild |
| Bookmark `?updated=1` | Low | N/A | Toast on every visit | Mild |
| Fast galaxy node spam | Low | N/A | Inspector flicker | Mild |
| ER action after stale plan | Medium | N/A | `window.alert` | **Yes** |
| Open_module spam click | Low | N/A | Multiple navigations | Yes |
| Days later return | **Critical** | **If session dead** | Fresh anonymous session | **Yes** |
| Guest login → expect new data | High | N/A | Same API session | **Yes** |

---

# 1. Double submit & click spam

### Profile editor (`DomainMutationEditor.tsx`)

- `saving` disables fields and Save — **but** React state update is async; **two rapid clicks** before re-render can queue two `handleSave` calls.
- Second call may hit “No changes to save” if first already committed — user sees **error after successful save**.
- `requestId` idempotency on mutations helps server-side; UX still confusing.

### Life Event intake (`LifeEventPlanIntake.tsx`)

- Same `saving` guard; double submit can fire duplicate `submitDomainCorrectionRequests`.
- **No `onSuccess` navigation** — relies on `hasProfile` becoming true after sync; double submit amplifies race with overlay dismiss timing.

### Schema forms (`ContractModulePage.tsx`, `LifeEventScenarioExplorer.tsx`)

- `setLoading(true)` on submit; button `disabled={loading}`.
- **Double Enter key** or double-click in same event tick can still race.
- Each successful run calls `executeModule` + `refreshSessionState()` — duplicate runs = **duplicate server executions** (not idempotent like profile mutations).

### Economic actions (`EconomicActionButton.tsx`)

- `system_intent`: `pending` disables — OK.
- `open_module` / `update_profile`: **no pending guard** — rapid clicks fire multiple `navigate()` calls → transition stack / history pollution.
- Stale action: `window.alert` — blocks UI thread.

---

# 2. Back / refresh during mutations

### Browser Back while saving profile

- Cancel button disabled during `saving` — good.
- **Browser Back is not blocked** — no `beforeunload`.
- Mutation may complete; user lands on previous page **without `?updated=1` toast** → believes save failed.

### Refresh on `/profile/{slug}/edit` mid-save

- In-flight fetch may complete; user sees **stale `initialDraft`** from first mount (`useState(initialDraft)` does not sync `userContext` updates).
- Saved data on server; form may show old values after reload if revision synced — or mixed if reload during write.

### Refresh on Life Events during intake

- `submitMutation` → `PROFILE_MUTATED` ingest; overlay hidden when `hasProfile` true.
- If refresh **before** sync completes: user may see intake again briefly, then plan loading — **no success message ever**.

### Refresh with `?updated=1`

- `ProfileCorrectionToast` reads URL param — toast shows again on refresh until dismiss strips param — **correct but surprising** if user bookmarked URL.

---

# 3. Multiple tabs

### API session (`localStorage` — `arrival_atlas_session_id`)

- **Shared across tabs** — mutations in tab A update server; tab B sees stale React state until next `requestSync`.
- Tab B editing profile with **stale `profileHeadRevision`** → revision conflict → **one automatic retry** then error if still stale.

### Mock home auth (`sessionStorage` — `arrival_atlas_home_authenticated`)

- **Per-tab** — Tab A “logged in” (HUD nav visible), Tab B guest (no nav) — **same API session, different chrome**.
- User thinks logout in Tab A logged them out everywhere; Tab B still shows guest but **same underlying data**.

### Journey Guide (`localStorage` — `arrival-atlas-journey-guide-v1`)

- Shared across tabs — Tab A chooses Guided; Tab B already mounted with old React state until reload.
- `completedMissionIds` written from either tab — **last write wins** on next persist.

### Display language (`localStorage` — display language key)

- Tab A switches language (if Header were available); Tab B mid-form with uncontrolled `SchemaForm` — **formKey remount** on sync loses input.

---

# 4. Network loss & timeouts

### During `submitDomainCorrectionRequests` (sequential loop)

```text
for (const request of requests) {
  await submitSingleWithRevisionRetry(...)
}
```

- Failure on request 2 of 3 → **requests 1 persisted, 2–3 not** — no rollback UI, single error string.
- User told “Could not save” — **partial profile** on server.

### During `executeModule`

- Generic `t('common.error')` — no retry button on form itself (only surface-level retry elsewhere).

### During bootstrap (`ensureSession`)

- Failure → `BootstrapGate` error + retry — OK.
- **Invalid session** (network blip on validation): `createSession()` — **new empty session, no banner**.

### Economic `system_intent` offline

- `window.alert` with error message — user stuck in alert loop if they spam click.

### Mid-sync `requestSync('FULL')`

- `RuntimeConsistencyModel` serializes via `syncQueue` — concurrent syncs queue, not corrupt — but UI may show **long loading** with no cancel.

---

# 5. Session expiry & “return days later”

### `ensureSession()` (`api.ts`)

- Validates stored session; on failure → **`createSession()` silently**.
- User returns after server restart / TTL / cleared server memory → **new anonymous session**.
- All prior profile/plan data **orphaned on server** (in-memory deployment) — UI shows **empty intake / fresh galaxy** with no explanation.

### Journey Guide `lastActiveAt` stored

- Guide state persists across “return” — `completedMissionIds` may **not match** new empty profile graph → recommendations nonsensical until graph catches up.

### Onboarding dismiss (`localStorage`)

- Persists independently — user may have dismissed checklist (if ever shown) but see welcome again on galaxy.

---

# 6. Journey Guide & cinematic chaos

### Welcome + intake stack (first LE visit)

- `showWelcome` when `!hasChosenMode` — full-screen guide welcome.
- `showPlanIntakeForm` when no profile/plan — intake overlay **on top**.
- User must interact through **two competing overlays** — clicks may hit wrong layer.

### Navigate away during cinematic (`JourneyGuideProvider.tsx`)

- Timers cleared on unmount — cinematic aborted.
- `lastUnlockEvent` persisted — replay available, but user **missed explanation** with no “you unlocked X” on return.

### `closePanel()` during cinematic

- Clears `cinematicUnlock` + timers — **abrupt** dim removal; no confirm.

### Spam “Replay discovery”

- `startCinematicUnlock` calls `clearCinematicTimers()` first — safe, but **re-triggers full multi-second sequence** — traps impatient user.

### Route preview + cinematic + guided dim

- `applyRoutePreview` blocked when `cinematicUnlock` set — good.
- User spamming Preview before cinematic starts may still queue route preview then lose it to cinematic start (`setRoutePreview(null)`).

### Locked planet clicks during cinematic

- `handleLockedNodeSelect` can open locked guide **during** cinematic — competing panels and dim states.

### `dismissWelcome` exists but unwired

- User cannot escape welcome without choosing mode — refresh resets to welcome unless `hasChosenMode` set.

---

# 7. Language & locale mid-flow

### `changeLanguage` (`AppProvider.tsx`)

- Updates `languageRef`, localStorage, mutation, session PATCH, **`requestSync('FULL')`**.
- Triggers `formKey` change on module pages → **SchemaForm remount** → uncontrolled values **lost**.
- Journey Guide strings **stay English** — user sees mixed-language UI.

### Profile edit `language-display` domain

- Saves language + calls `updateSessionLanguage` — if user navigates away before `refreshSessionState`, other surfaces lag.

### Static `<html lang="en">`

- Screen readers wrong language after switch.

---

# 8. Navigation chaos

### `useAtlasNavigation` vs browser Back

- Atlas `push`/`replace` wrapped with spatial transitions.
- **Browser Back** bypasses spatial layer — arrival animation state in `sessionStorage` may **desync** from pathname.

### Profile: galaxy click vs deep link

- Click domain on `/profile` — URL stays `/profile`.
- User hits Back expecting to leave domain — **may exit profile entirely** (history entry was `/profile` not `/profile/slug`).

### `financial-reality` from profile CTA vs HUD `economic-reality`

- User rapid-switches between modules — **two different ER UIs** in history — believes app “changed layout randomly”.

### Spam `arriveAt` during spatial transition

- `spatialPhase` may still be animating — second navigation may drop or overlap transitions (visual glitch).

---

# 9. Form abandon & stale state

### Profile edit draft

- `useState(initialDraft)` — navigate away → **draft lost** (expected).
- Return via Back — remount may show **fresh** draft from server (OK) or stale if `userContext` not yet synced.

### SchemaForm defaults

- Prefill from profile; if user partially edits then `uiState.snapshotVersion` bumps → **formKey** changes → edits vanish.

### LE scenario explorer

- `initialScenarioEvent` from URL — change `?event=` while form open → effect re-runs, **new defaults**, in-progress form lost.

### Economic action `recorded` state

- Local `useState` — navigate away and back → button **re-enabled** though server already recorded intent — duplicate action possible until plan refresh marks stale.

---

# 10. Galaxy-specific chaos

### Body scroll lock (`GalaxyViewport.tsx`)

- Sets `overflow: hidden` on `html`/`body`; cleanup on unmount — OK unless hard crash.
- Navigate galaxy → edit page → galaxy: lock/unlock cycles — on some mobile browsers **scroll position lost**.

### `useGalaxyGraphModel` selection reset

- When `selectableNodeIds` changes after sync, selection jumps to first selectable — **user’s selected planet snaps away** after background refresh.

### Resize / orientation

- `JourneyGuideLayer` measures DOM anchors — rapid resize → probe **jumps**, speech bubble detaches briefly.
- Crossing 960px toggles HUD nav visibility mid-session — layout shift.

### Keyboard spam on galaxy stage

- Arrow keys cycle nodes; rapid key repeat during `isRebalancing` (260ms) — inspector content flickers.

### Complete mission → cinematic trigger

- Requires completion + unlock in **same snapshot tick** — if user refreshes between completion API response and graph update → **cinematic skipped** with no replay unless unlock detectable later (may not re-fire).

---

# 11. Mock auth confusion scenarios

| Sequence | What user expects | What happens |
|----------|-------------------|--------------|
| Guest → Sign up → fill profile | New account | Same API session as before; only `sessionStorage` flag set |
| Log out → Log in | Clean slate | API session + profile unchanged; HUD toggles only |
| Log out Tab A, work Tab B | Logged out everywhere | Tab B guest HUD, **same API data** |
| “Log in” → `/profile` | Authenticated experience | Nav appears; no real identity |

---

# 12. Worst-case user stories

### Story A — “The double saver”

1. Opens profile edit, changes city, double-clicks Save.  
2. First mutation succeeds; second throws “No changes to save”.  
3. User sees red error, leaves without checking galaxy.  
**Outcome:** Data saved; user believes it failed.

### Story B — “The tab hoarder”

1. Tab A: profile edit half-filled. Tab B: saves language domain.  
2. Tab A saves with stale revision.  
3. Retry once; if Tab B saved again, Tab A errors.  
**Outcome:** Conflicting error messages; partial trust loss.

### Story C — “The phone rotator”

1. Opens LE on phone, HUD nav hidden.  
2. Rotates landscape ↔ portrait during guide welcome + intake.  
3. Probe jumps; FAB overlaps inspector.  
**Outcome:** Cannot reach nav; taps wrong overlay.

### Story D — “The back-button believer”

1. Saves profile, immediately hits Back (before redirect to `?updated=1`).  
2. Mutation completed server-side.  
**Outcome:** No toast; user re-edits same fields.

### Story E — “The returner”

1. Uses app Monday; server restarts Tuesday.  
2. Opens app — new session silently.  
**Outcome:** Empty profile; guide still thinks missions completed in localStorage.

### Story F — “The cinematic skipper”

1. Completes mission; cinematic starts.  
2. Hits × on guide panel.  
3. Cinematic killed; user never sees unlock list.  
**Outcome:** Galaxy unlocked but user doesn’t know why.

---

# Severity-ranked findings

## Critical (data or trust break)

| # | Finding | Location |
|---|---------|----------|
| C1 | Silent new session on invalid/expired session — prior data unreachable | `api.ts` `ensureSession` |
| C2 | Mock auth misrepresents login state vs API session | `AtlasHomeProvider.tsx` |
| C3 | Partial profile batch save on mid-sequence network failure | `submit-domain-correction.ts` |
| C4 | LE intake success invisible — user repeats or abandons | `LifeEventPlanIntake.tsx` |

## High (confusion / inconsistent UI)

| # | Finding | Location |
|---|---------|----------|
| H1 | Browser Back during save — no success feedback | Profile edit flow |
| H2 | Tab split: mock auth per-tab vs shared API session | `sessionStorage` vs `localStorage` |
| H3 | Welcome + intake overlay stack | LE page + `JourneyGuideLayer` |
| H4 | SchemaForm remount on sync/language — edits lost | `ContractModulePage.tsx` `formKey` |
| H5 | Profile draft stale after `userContext` update | `DomainMutationEditor.tsx` |
| H6 | Galaxy selection resets on graph refresh | `useGalaxyGraphModel.ts` |
| H7 | Duplicate module execution on double submit | Schema forms |
| H8 | Cinematic aborted without recovery copy on dismiss | `JourneyGuideProvider.tsx` `closePanel` |
| H9 | Journey guide localStorage vs empty new session graph | `storage.ts` + `ensureSession` |

## Medium

| # | Finding |
|---|---------|
| M1 | Double profile save → false error |
| M2 | `?updated=1` bookmark replays toast |
| M3 | ER stale action `alert` spam |
| M4 | `open_module` click spam — navigation stack |
| M5 | Spatial Back vs browser Back desync |
| M6 | Profile URL desync + Back confusion |
| M7 | `recorded` state local-only on ER actions |
| M8 | No `beforeunload` on any in-flight mutation |

## Low

| # | Finding |
|---|---------|
| L1 | Probe jump on resize |
| L2 | Inspector flicker on rapid node click |
| L3 | Replay discovery annoyance loop |
| L4 | Locked clicks during cinematic — panel competition |

---

# Recommended chaos hardening (UX-only)

| Priority | Fix |
|----------|-----|
| P0 | Session expiry modal — “Your session was reset” + what was lost |
| P0 | Unify auth story — remove fake login or label “Continue exploring” |
| P0 | LE intake success state — explicit “Saved” before overlay dismiss |
| P1 | `beforeunload` or in-app guard during `saving`/`pending` |
| P1 | Batch mutation partial-failure UI — “2 of 3 saved” |
| P1 | Defer guide welcome until intake complete (or vice versa) |
| P1 | Mobile nav drawer — always reachable |
| P1 | Cinematic skip + “Don’t show again” |
| P2 | Controlled profile/schema forms or dirty-check on remount |
| P2 | Tab sync banner — “Data updated in another tab” on `storage` event |
| P2 | Disable double-submit via ref guard (sync) on all forms |
| P2 | Reset journey guide on session recreate |

---

## Chaos readiness score

| Area | Score |
|------|-------|
| Mutation safety (server) | 6 |
| Mutation feedback (client) | 3 |
| Multi-tab coherence | 2 |
| Session continuity | 2 |
| Guide/cinematic resilience | 4 |
| Form resilience | 3 |
| Navigation predictability | 4 |
| **Overall chaos readiness** | **3.5 / 10** |

---

## Test scripts for manual chaos QA

```text
1. Profile edit → double-click Save rapidly → observe error vs success
2. Profile edit → Save → immediate browser Back → check if data persisted without toast
3. Two tabs: edit city in both → save Tab A then Tab B within 1s
4. Tab A login mock, Tab B guest — compare HUD vs same /profile data
5. LE first visit: count overlapping overlays (welcome + intake)
6. Complete unlock mission → close guide at 2s → verify user understands unlock
7. Module form: fill halfway → trigger language change (dev Header) → confirm data loss
8. Economic action offline → airplane mode → click system_intent
9. Clear API server memory → reload app → document what user sees
10. Mobile 375px: rotate during guide speech; tap FAB + inspector simultaneously
11. Spam Replay discovery 5×
12. Save profile → bookmark ?updated=1 URL → reopen later
```
