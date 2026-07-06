# arr-032 — Phase 1 release blockers · demo session trust · cross-tab sync

**Branch:** `arr-032`  
**Tracks:** Production readiness · RB-A01–RB-A05 · QA regressions R1–R8 · auth/session trust · demo mode · cross-tab consistency  
**Base:** `develop` (post arr-031)

Replaces the arr-031 **mock authentication** (`sessionStorage` toggle + “Log in” / “Sign up” / “Log out”) with an **honest demo exploration model**: “Enter Atlas” / “Leave demo”, persisted in `localStorage` and synchronized across tabs. Implements **full client reset on Leave demo** (RB-A02), **session recreation notice** when `ensureSession()` recreates an invalid session (RB-A03), **Journey Guide reset on recreation** (RB-A04), and **cross-tab owner/follower coordination** for demo reset and session recreation. Follow-up QA fixes cover bootstrap recreation clearing demo state (R4), synchronous demo hydration (R5), pending notice across refresh (R6), and focus traps on modals (R8).

**Product verdict:** A beta user must never believe they have an account when they do not, never see “exploring” chrome over an empty session, and never get split-brain HUD state across tabs. Session loss must be explained — not silent.

**Diff vs `develop` (working tree):** ~45 files · +~3,500 / −~130 lines (`apps/web` + `packages/core` + docs) · new modules: `atlas-demo-state.ts`, `session-recreation-notice.ts`, `clear-client-state.ts`, `SessionRecreatedNotice.tsx`, `LeaveDemoConfirm.tsx`, `focus-trap.ts`.

---

# Part 1 — Problem statement

## Pre-arr-032 failures

| Issue | Symptom |
|-------|---------|
| Mock auth | “Log in” / “Sign up” implied real accounts; API session unchanged |
| Logout | Cleared `sessionStorage` flag only; profile, guide, API session remained |
| Session recreate | `ensureSession()` silently issued new ID; user saw empty app with no explanation |
| Guide drift | New empty session + old `localStorage` guide → nonsense recommendations |
| Split tabs | Mock auth per-tab (`sessionStorage`) vs API session shared (`localStorage`) |
| QA R4 | After recreation, demo HUD still showed “exploring” over empty profile |
| QA R5 | Guest HUD flash (“Enter Atlas”) for 1+ frames on refresh / remount |
| QA R6 | Refresh before acknowledging recreation modal → notice lost |
| QA R8 | Modals lacked focus trap / Escape handling |

**Source audits:** [phase-1-release-blockers.md](../production-readiness/phase-1-release-blockers.md) · [malicious-beta-tester-ux-audit.md](../audits/malicious-beta-tester-ux-audit.md) · [production-readiness-ui-ux-audit.md](../audits/production-readiness-ui-ux-audit.md)

---

# Part 2 — Architecture overview

## Summary

```text
Bootstrap (AppProvider.retryBootstrap)
  └── ensureSession() → { sessionId, outcome }
        ├── existing  → no side effects
        ├── created   → first launch, no side effects
        └── recreated → clearJourneyGuideState()
                      → writeAtlasDemoActive(false)
                      → markSessionRecreationNoticePending()
                      → broadcastSessionRecreated()
                      → SessionRecreatedNotice modal (owner tab)

AtlasHomeProvider
  ├── useState(readAtlasDemoState)     ← synchronous hydration (R5)
  └── storage listener on arrival_atlas_demo_active  ← cross-tab (RB-A05)

Leave demo (AtlasHUD → leaveDemoAndReset)
  ├── owner tab: resetAtlasSession() + writeAtlasDemoActive(false)
  │             + broadcastAtlasDemoReset(sessionId)
  └── follower tab: adoptAtlasSessionAfterDemoReset() via storage event

Session recreation (cross-tab)
  ├── owner tab: modal + broadcast
  └── follower tab: adoptRecreatedSessionId() + requestSync — no modal, no createSession()
```

## Storage keys

| Key | Scope | Purpose |
|-----|-------|---------|
| `arrival_atlas_demo_active` | `localStorage` | Demo exploration flag (RB-A01, RB-A05) |
| `arrival_atlas_home_authenticated` | `sessionStorage` (legacy) | Migrated once → `demo_active` |
| `arrival_atlas_demo_reset_at` | `localStorage` | Cross-tab Leave demo broadcast (RB-A02) |
| `arrival_atlas_demo_reset_owner` | `localStorage` | 12s TTL ownership lock (R2) |
| `arrival_atlas_session_recreated` | `localStorage` | Cross-tab session recreation broadcast (R3) |
| `arrival_atlas_session_recreated_pending` | `localStorage` | Pending notice survives refresh (R6) |
| `arrival_atlas_session_recreated_ack_{id}` | `sessionStorage` | Per-tab modal acknowledgement |

---

# Part 3 — RB-A01 · Honest demo labeling

## Before

| UI | Behavior |
|----|----------|
| “Log in” / “Sign up” | Toggled `sessionStorage` mock flag |
| “Log out” | Cleared mock flag only |
| Nav | Shown when mock flag set |

## After

| UI | Behavior |
|----|----------|
| **Enter Atlas** | `writeAtlasDemoActive(true)` · shows nav |
| **Leave demo** | Opens confirm dialog → full reset (RB-A02) |
| Copy | No account creation implied |

## Files

| File | Change |
|------|--------|
| `atlas-demo-state.ts` | **New** — read/write/migrate demo flag |
| `AtlasHomeProvider.tsx` | `useAtlasHomeDemo()` · sync init · storage listener |
| `AtlasHUD.tsx` | Enter Atlas / Leave demo · `LeaveDemoConfirm` |
| `AtlasGuestLanding.tsx` | Honest guest copy |
| `guest-landing-data.ts` | CTA text updates |

Context rename: `useAtlasHomeAuth` → `useAtlasHomeDemo` (deprecated alias kept).

---

# Part 4 — RB-A02 · Leave demo = full reset

## Flow

```text
User confirms Leave demo
  └── leaveDemoAndReset()
        ├── attemptAcquireResetOwnership(tabId)
        ├── owner: resetAtlasSession()
        │          → clearAtlasClientPersistedState()
        │          → createSession() on server
        │          → writeAtlasDemoActive(false)
        │          → broadcastAtlasDemoReset(newSessionId)
        └── follower: waitForDemoResetBroadcastCompletion()
                      → adoptAtlasSessionAfterDemoReset(ownerSessionId)
```

## `clearAtlasClientPersistedState()` (new)

Clears: Journey Guide · display language override · onboarding dismiss · legacy theme · celestial arrival · runtime session · spatial memory.

## `LeaveDemoConfirm.tsx` (new)

Confirm dialog before reset. Focus trap (R8). Copy explains local data loss.

## Files

| File | Role |
|------|------|
| `lib/atlas-reset/clear-client-state.ts` | Centralized client state wipe |
| `lib/dev-tools/reset-user-data.ts` | `resetAtlasSession()` · `adoptAtlasSessionAfterDemoReset()` |
| `atlas-demo-state.ts` | Ownership lock · broadcast · `waitForDemoResetBroadcastCompletion()` |
| `AppProvider.tsx` | `leaveDemoAndReset()` · owner/follower storage listeners |

---

# Part 5 — RB-A03 · Session recreation notice

## API change

`ensureSession()` now returns:

```typescript
type EnsureSessionOutcome = 'existing' | 'created' | 'recreated';
type EnsureSessionResult = { sessionId: string; outcome: EnsureSessionOutcome };
```

| Outcome | When |
|---------|------|
| `existing` | Stored session ID valid on server |
| `created` | No stored session (first visit) |
| `recreated` | Stored session invalid → new session created |

## `SessionRecreatedNotice.tsx` (new)

Modal on bootstrap `recreated`. i18n keys in `packages/core` (EN · DE · RU · UK). Focus trap (R8). Continue acknowledges per-tab.

## Notice persistence (R6)

`markSessionRecreationNoticePending(sessionId)` writes `arrival_atlas_session_recreated_pending`. Survives refresh until user clicks Continue.

## Files

| File | Role |
|------|------|
| `lib/api.ts` | `ensureSession()` outcome typing · `isSessionValid()` |
| `lib/session-recreation-notice.ts` | Pending · ack · display claim · broadcast parse |
| `AppProvider.tsx` | Bootstrap hook · modal state · `SessionRecreatedNotice` mount |

---

# Part 6 — RB-A04 · Journey Guide reset on recreation

## Bootstrap path

When `outcome === 'recreated'`:

1. `clearJourneyGuideState()` — removes `arrival-atlas-journey-guide-v1`
2. Dispatches `JOURNEY_GUIDE_RESET_EVENT` → `JourneyGuideProvider` resets in-memory state

## Cross-tab adoption

`adoptRecreatedSessionId()` also calls `clearJourneyGuideState()` for follower tabs (R3).

## Files

| File | Change |
|------|--------|
| `journey-guide/storage.ts` | `clearJourneyGuideState()` · `JOURNEY_GUIDE_RESET_EVENT` |
| `journey-guide/JourneyGuideProvider.tsx` | Listens for reset event |
| `reset-user-data.ts` | `adoptRecreatedSessionId()` |

---

# Part 7 — RB-A05 · Cross-tab demo sync

## Mechanism

| Direction | Path |
|-----------|------|
| Enter Atlas (same tab) | `writeAtlasDemoActive(true)` + `setState(true)` |
| Leave demo (other tabs) | `storage` event on `arrival_atlas_demo_active` |
| Leave demo (owner) | `broadcastAtlasDemoReset` → follower adopts session |
| Session recreate (other tabs) | Demo cleared via `writeAtlasDemoActive(false)` storage event |

## `AtlasHomeProvider` hydration (R5)

```typescript
const [isExploringAtlas, setIsExploringAtlas] = useState(readAtlasDemoState);
```

No `useEffect` hydration gate. No loading placeholders. SSR-safe via `typeof window` guards in `readAtlasDemoActive()`.

Legacy `sessionStorage` key migrated synchronously on first read.

---

# Part 8 — QA regression fixes

| ID | Problem | Fix |
|----|---------|-----|
| **R1** | Guide not cleared on bootstrap recreation path | `clearJourneyGuideState()` in `retryBootstrap` when `recreated` |
| **R2** | Cross-tab Leave demo race → split-brain sessions | Owner/follower model + 12s ownership lock |
| **R3** | Cross-tab session recreation → duplicate `createSession()` | `SESSION_RECREATED_BROADCAST_KEY` · follower adopts only |
| **R4** | Demo HUD active after session recreation | `writeAtlasDemoActive(false)` alongside guide reset |
| **R5** | Guest HUD flash on refresh / remount | Synchronous `useState(readAtlasDemoState)` |
| **R6** | Recreation notice lost on refresh before ack | `arrival_atlas_session_recreated_pending` in `localStorage` |
| **R8** | Modals without focus management | `useFocusTrap()` hook on both modals |

---

# Part 9 — Cross-tab coordination detail

## Leave demo — owner/follower (R2)

```text
Tab A (owner)                    Tab B (follower)
─────────────                    ────────────────
attemptAcquireResetOwnership ✓
resetAtlasSession()
broadcastAtlasDemoReset()
writeAtlasDemoActive(false)
                                 storage: demo_reset_at
                                 → adoptAtlasSessionAfterDemoReset()
                                 → writeAtlasDemoActive(false)
                                 storage: demo_active=null
                                 → AtlasHomeProvider → guest HUD
```

Simultaneous Leave demo: loser waits via `waitForDemoResetBroadcastCompletion()` (storage events, no polling).

## Session recreation — owner/follower (R3)

```text
Tab A (owner)                    Tab B (follower)
─────────────                    ────────────────
ensureSession → recreated
clearJourneyGuideState()
writeAtlasDemoActive(false)
broadcastSessionRecreated()
SessionRecreatedNotice modal
                                 storage: session_recreated
                                 → adoptRecreatedSessionId()
                                 → setSessionId() + requestSync
                                 (no modal, no createSession)
                                 storage: demo_active=null
                                 → guest HUD
```

---

# Part 10 — CSS & i18n

## `atlas-home.css`

HUD guest/exploring layout · Leave demo button · guest spacer · leave error alert.

## `ui-cohesion.css`

`.session-recreated-notice` · `.leave-demo-confirm` — backdrop · dialog · actions · reduced-motion safe.

## `packages/core/src/i18n/index.ts`

| Key | EN |
|-----|-----|
| `app.sessionRecreated.title` | A new Atlas session has started |
| `app.sessionRecreated.message` | Your previous session could not be restored… |
| `app.sessionRecreated.continue` | Continue |

DE · RU · UK translations included.

---

# Part 11 — Tests

| File | Covers |
|------|--------|
| `atlas-demo-state.test.ts` | Read/write · legacy migration · broadcast parse |
| `AtlasHomeProvider.test.tsx` | Sync hydration (R5) · storage listener · migration |
| `bootstrap-recreated.test.tsx` | Guide + demo clear on `recreated` · preserved on `existing`/`created` |
| `session-recreation-notice.test.ts` | Pending · ack · shouldPresent logic |
| `session-recreation-cross-tab.test.ts` | Broadcast parse · follower adoption (R3) |
| `demo-reset-cross-tab.test.ts` | Leave demo broadcast · follower path (R2) |
| `demo-reset-ownership.test.ts` | Ownership lock TTL · acquire (R2) |
| `clear-client-state.test.ts` | Client wipe keys |
| `journey-guide/storage.test.ts` | `clearJourneyGuideState` · reset event |
| `api.test.ts` | `ensureSession` outcomes |
| `SessionRecreatedNotice.test.tsx` | Render · focus trap |
| `LeaveDemoConfirm.test.tsx` | Render · focus trap |
| `a11y/focus-trap.test.ts` | Trap logic |
| `a11y/useFocusTrap.test.tsx` | Hook behavior |

```bash
cd apps/web && npx vitest run \
  src/components/atlas-home/atlas-demo-state.test.ts \
  src/__tests__/atlas-home/AtlasHomeProvider.test.tsx \
  src/__tests__/app-provider/bootstrap-recreated.test.tsx \
  src/lib/session-recreation-notice.test.ts \
  src/lib/dev-tools/session-recreation-cross-tab.test.ts \
  src/lib/dev-tools/demo-reset-cross-tab.test.ts \
  src/lib/dev-tools/demo-reset-ownership.test.ts \
  src/lib/atlas-reset/clear-client-state.test.ts \
  src/lib/journey-guide/storage.test.ts \
  src/lib/api.test.ts \
  src/__tests__/components/SessionRecreatedNotice.test.tsx \
  src/__tests__/components/LeaveDemoConfirm.test.tsx \
  src/__tests__/a11y/

npm run test
```

---

## Architecture compliance

| Constraint | Status |
|------------|--------|
| No real auth backend | ✓ — honest demo labeling only |
| No routing changes | ✓ |
| Journey Guide semantics unchanged | ✓ — only reset on recreation/leave |
| arr-031 cinematic unlock preserved | ✓ |
| Cross-tab via `storage` events only | ✓ — no BroadcastChannel |
| SSR-safe localStorage access | ✓ |

## Release blocker status (Group A)

| Blocker | Status |
|---------|--------|
| RB-A01 — Honest demo labeling | ✓ |
| RB-A02 — Leave demo full reset | ✓ |
| RB-A03 — Session recreation notice | ✓ |
| RB-A04 — Guide reset on recreation | ✓ |
| RB-A05 — Cross-tab demo sync | ✓ |

## QA regression status

| ID | Status |
|----|--------|
| R1 — Guide clear on bootstrap recreation | ✓ |
| R2 — Leave demo cross-tab race | ✓ |
| R3 — Session recreation cross-tab | ✓ |
| R4 — Demo cleared on recreation | ✓ |
| R5 — No guest HUD flash | ✓ |
| R6 — Pending notice across refresh | ✓ |
| R8 — Focus trap on modals | ✓ |

## Known issues / limitations

| Item | Notes |
|------|-------|
| No real authentication | Phase 2 — wire auth provider or remove signup entirely |
| Mobile nav still hidden ≤960px | RB-B01 — separate PR |
| `useAtlasHomeAuth` deprecated alias | Remove in cleanup pass |
| Same-tab demo clear on recreation | Owner tab relies on `BootstrapGate` deferring children until bootstrap completes |
| Recreation modal owner-only | Follower tabs adopt silently — by design |
| Leave demo confirm copy hardcoded EN | i18n pass deferred |

## Deferred — post ARR-032

| Item | Notes |
|------|-------|
| RB-B01 — Mobile navigation drawer | Phase 1 Group B |
| RB-B02–B04 — Routing unification | Phase 1 Group B |
| RB-C01–C03 — Language picker in HUD | Phase 1 Group C |
| Real auth integration | Replaces demo model |
| i18n for Leave demo confirm | `packages/core` keys |

---

## Test plan

### Unit

```bash
cd apps/web && npm run test
```

### Manual smoke — demo mode (RB-A01, RB-A05)

- [ ] **First visit** — Guest HUD · “Enter Atlas” CTA · no nav
- [ ] **Enter Atlas** — nav appears · demo flag in `localStorage`
- [ ] **Refresh while exploring** — nav persists immediately (no guest flash)
- [ ] **Two tabs** — Enter Atlas in Tab A → Tab B shows nav without action
- [ ] **Leave demo Tab A** — Tab B returns to guest chrome

### Manual smoke — Leave demo (RB-A02)

- [ ] **Leave demo** — confirm dialog · focus trapped
- [ ] **Confirm** — profile empty · guide cleared · guest HUD · home redirect
- [ ] **Cancel** — stays in demo
- [ ] **Two tabs simultaneous Leave** — no split-brain session

### Manual smoke — session recreation (RB-A03, RB-A04, R4)

- [ ] **Invalidate session server-side** → reload
- [ ] **Modal appears** — “A new Atlas session has started”
- [ ] **Guest HUD** — not “exploring” (R4)
- [ ] **Journey Guide** — welcome / fresh state (RB-A04)
- [ ] **Refresh before Continue** — modal reappears (R6)
- [ ] **Continue** — modal dismissed · does not return on next reload
- [ ] **Tab B open** — adopts session silently · guest HUD · no modal

### Manual smoke — valid session / first launch

- [ ] **Valid session reload** — no modal · demo state unchanged
- [ ] **First launch** — no modal · guest state

### Manual smoke — arr-031 regression

- [ ] Cinematic unlock · replay · profile correction toast
- [ ] Journey Guide welcome · guided · route preview

### Typecheck / build

```bash
cd apps/web && npm run typecheck
cd apps/web && npm run build
```

---

## Related docs

- [arr-031-pr-description.md](./arr-031-pr-description.md) — Journey Guide · cinematic unlock · profile correction toast
- [phase-1-release-blockers.md](../production-readiness/phase-1-release-blockers.md) — Phase 1 checklist (Group A resolved by this PR)
- [malicious-beta-tester-ux-audit.md](../audits/malicious-beta-tester-ux-audit.md) — Chaos scenarios source audit
- [production-readiness-ui-ux-audit.md](../audits/production-readiness-ui-ux-audit.md) — UI/UX readiness audit
