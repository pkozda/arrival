---
id: phase-1-release-blockers
title: Phase 1 Release Blockers Checklist
project: Arrival Atlas
system: Arrival Atlas
type: checklist
domain: product
status: active
maturity: draft
owner: system
tags:
  - production-readiness
  - release-blockers
  - phase-1
  - qa
  - ux
created: 2026-07-01
updated: 2026-07-01
related:
  - production-readiness-ui-ux-audit
  - malicious-beta-tester-ux-audit
  - verification
---

# Phase 1 — Release Blockers Checklist

**Date:** July 2026  
**Purpose:** Single actionable checklist for **first-phase fixes** before beta or public release  
**Source audits:** [production-readiness-ui-ux-audit.md](../audits/production-readiness-ui-ux-audit.md) · [malicious-beta-tester-ux-audit.md](../audits/malicious-beta-tester-ux-audit.md)  
**Gate reference:** [verification.md](./verification.md) (Beta Ready + Production Ready rows)

> **Rule:** Every item below is a **release blocker**. Phase 2 (polish, medium/low) is out of scope here.  
> Mark `[x]` only when acceptance criteria pass on a real device (include **375px mobile** where noted).

**Progress:** `0 / 24` blockers resolved

---

## How to use

1. Work **top to bottom** within each group (dependencies noted inline).
2. Do not ship beta until **all groups** are `[x]`.
3. After each fix, run the **Verify** step and tick the matching row in [verification.md](./verification.md) where applicable.

---

## A — Auth & session trust (5 blockers)

- [ ] **RB-A01 — Remove or honestly label mock authentication**  
  **Problem:** “Log in” / “Sign up” / “Log out” toggle `sessionStorage` only; user believes identity changed; API session unchanged.  
  **Fix:** Either wire real auth **or** rename CTAs to honest copy (“Continue exploring” / “Show navigation”) and remove “Sign up” until real.  
  **Files:** `apps/web/src/components/atlas-home/AtlasHomeProvider.tsx`, `AtlasHUD.tsx`, `AtlasGuestLanding.tsx`  
  **Verify:** Guest and member flows do not imply account creation; logout behavior matches copy.

- [ ] **RB-A02 — Logout clears user-visible session state**  
  **Problem:** Logout clears mock flag only; profile, journey guide, onboarding dismiss, API session remain.  
  **Fix:** On logout (or “Start over”): clear `localStorage` session + journey guide + display language override; call session reset API or `resetUserData` equivalent exposed in production UI.  
  **Files:** `AtlasHomeProvider.tsx`, `AppProvider.tsx`, `reset-user-data.ts`, `journey-guide/storage.ts`  
  **Verify:** After logout, fresh visit shows empty/guest state consistently across HUD and `/profile`.

- [ ] **RB-A03 — Session expiry / invalid session: user-visible message**  
  **Problem:** `ensureSession()` silently creates new session; prior data unreachable with no explanation.  
  **Fix:** Detect recreate (stored ID invalid → new ID); show modal or banner: “Your session was reset” + what it means for saved data.  
  **Files:** `apps/web/src/lib/api.ts`, new surface component or `BootstrapGate.tsx`  
  **Verify:** Invalidate session server-side → reload → user sees message, not silent empty app.  
  **Audit:** C1, production #5.

- [ ] **RB-A04 — Reset journey guide when session is recreated**  
  **Problem:** New empty session but `localStorage` guide still has `completedMissionIds` / `lastUnlockEvent` — nonsense recommendations.  
  **Fix:** On session recreate (RB-A03), clear `arrival-atlas-journey-guide-v1` or re-hydrate from graph.  
  **Files:** `journey-guide/storage.ts`, `api.ts` / bootstrap path  
  **Verify:** Story E (returner) — guide state matches empty profile.  
  **Audit:** H9.

- [ ] **RB-A05 — Unify auth/session story across tabs**  
  **Problem:** Mock auth is per-tab (`sessionStorage`); API session is shared (`localStorage`) — split HUD chrome.  
  **Fix:** Depend on single session source for “authenticated” UI **or** move mock flag to `localStorage` with explicit “demo mode” labeling.  
  **Verify:** Two tabs show same nav state after login/logout in either tab.  
  **Audit:** H2.

---

## B — Navigation & routing (4 blockers)

- [ ] **RB-B01 — Mobile primary navigation always reachable**  
  **Problem:** `.atlas-hud__nav { display: none }` at ≤960px with no drawer/hamburger.  
  **Fix:** Add mobile nav drawer or bottom bar with same four destinations (Home, LE, ER, Profile).  
  **Files:** `AtlasHUD.tsx`, `atlas-home.css`  
  **Verify:** [verification.md](./verification.md) row 21 — modules usable at 375px; user can reach all HUD destinations without typing URL.  
  **Audit:** production #2.

- [ ] **RB-B02 — Unify economic module routing**  
  **Problem:** HUD → `/modules/economic-reality` (galaxy); profile CTAs → `/modules/financial-reality` (generic form).  
  **Fix:** Point all user-facing links to one canonical route (recommend: `economic-reality` galaxy).  
  **Files:** `profile-mirror-utils.ts`, `resolve-action-route.ts`, any `financial-reality` hrefs  
  **Verify:** Profile domain CTA and HUD land on same ER experience.

- [ ] **RB-B03 — Honor or remove `?entry=` on Economic Reality**  
  **Problem:** Links generate `/modules/economic-reality?entry=CRISIS` but page ignores param.  
  **Fix:** Read `entry` in ER page and scroll/select/focus crisis section **or** stop generating dead links.  
  **Files:** `economic-reality/page.tsx`, `EconomicRealityPage.tsx` or bridge  
  **Verify:** Deep link `?entry=CRISIS` changes visible UI state.

- [ ] **RB-B04 — Branded `not-found` + recovery on invalid routes**  
  **Problem:** No `not-found.tsx`; invalid slug/module = one-line message, no way home.  
  **Fix:** Add `not-found.tsx` + inline recovery links (“Back to Profile”, “Explore Atlas”) on soft errors.  
  **Files:** `apps/web/src/app/not-found.tsx`, profile `[domainSlug]/page.tsx`, `modules/[moduleId]/page.tsx`  
  **Verify:** Unknown URL and invalid slug show branded 404 with working home link.

---

## C — Settings & i18n (3 blockers)

- [ ] **RB-C01 — Production language picker in live chrome**  
  **Problem:** `changeLanguage` works; UI only in unmounted `Header.tsx`.  
  **Fix:** Add language control to `AtlasHUD` (or settings panel).  
  **Files:** `AtlasHUD.tsx`, `AppProvider.tsx`  
  **Verify:** User can switch DE/EN from any destination without dev Header.

- [ ] **RB-C02 — `document.documentElement.lang` matches active locale**  
  **Problem:** `layout.tsx` hardcodes `lang="en"`.  
  **Fix:** Set `lang` on language change in `AppProvider`.  
  **Files:** `app/layout.tsx`, `AppProvider.tsx`  
  **Verify:** [verification.md](./verification.md) row 24.

- [ ] **RB-C03 — Beta limitations disclosed in UI**  
  **Problem:** Production gate row 14 open — no beta banner/guide.  
  **Fix:** Visible banner or first-visit notice: mock auth, session persistence limits, Germany-only scope.  
  **Files:** `SpatialPageShell.tsx` or `AtlasHUD.tsx`  
  **Verify:** [verification.md](./verification.md) row 14.

---

## D — Forms, saves & data feedback (5 blockers)

- [ ] **RB-D01 — Life Event intake: explicit success before dismiss**  
  **Problem:** Save succeeds silently; overlay disappears when `hasProfile` flips; user repeats or abandons.  
  **Fix:** Show “Saved” / checkmark ≥2s, then dismiss; optional brief plan-loading state.  
  **Files:** `LifeEventPlanIntake.tsx`, `life-event/page.tsx`  
  **Verify:** First-time user knows intake succeeded without inferring from overlay gone.  
  **Audit:** C4, production #12.

- [ ] **RB-D02 — Profile save: success even if user hits Back immediately**  
  **Problem:** Mutation completes; Back before `?updated=1` redirect → no toast; user thinks save failed.  
  **Fix:** Optimistic success toast on mutation resolve **before** navigate; or block navigation until feedback shown.  
  **Files:** `DomainMutationEditor.tsx`, `ProfileCorrectionToast.tsx`  
  **Verify:** Save → immediate Back → user still saw confirmation (toast or inline).  
  **Audit:** H1, Story D.

- [ ] **RB-D03 — Partial batch mutation failure UI**  
  **Problem:** Sequential domain corrections: failure on 2/3 leaves partial save + generic error.  
  **Fix:** Report “2 of 3 saved” + which domain failed; offer retry for remainder.  
  **Files:** `submit-domain-correction.ts`, `DomainMutationEditor.tsx`, `LifeEventPlanIntake.tsx`  
  **Verify:** Simulate fail on 2nd request → user sees partial success state.  
  **Audit:** C3.

- [ ] **RB-D04 — Double-submit guards on all write forms**  
  **Problem:** Rapid double-click Save/Submit can duplicate requests or show false error (“No changes to save”).  
  **Fix:** Synchronous `useRef` guard at start of submit handlers (profile, intake, schema forms).  
  **Files:** `DomainMutationEditor.tsx`, `LifeEventPlanIntake.tsx`, `ContractModulePage.tsx`, `LifeEventScenarioExplorer.tsx`  
  **Verify:** Double-click Save → one network mutation; no error-after-success.

- [ ] **RB-D05 — Replace `window.alert` for economic action errors**  
  **Problem:** ER errors use blocking alert — breaks flow, poor a11y.  
  **Fix:** Inline `role="alert"` panel in inspector (same pattern as `SurfaceErrorPanel`).  
  **Files:** `EconomicActionButton.tsx`  
  **Verify:** Stale/offline action shows inline error; no alert dialog.

---

## E — First-run & guide overlays (3 blockers)

- [ ] **RB-E01 — Do not stack Journey Guide welcome + LE intake**  
  **Problem:** First LE visit shows welcome dialog under/over intake overlay.  
  **Fix:** Defer `JourneyGuideWelcome` until `hasProfile` **or** hide intake until welcome dismissed.  
  **Files:** `life-event/page.tsx`, `JourneyGuideProvider.tsx`, `JourneyGuideLayer.tsx`  
  **Verify:** First visit shows **one** primary overlay at a time.  
  **Audit:** H3, production #10.

- [ ] **RB-E02 — Cinematic unlock: skip + dismiss does not hide unlock info**  
  **Problem:** Long sequence, no skip; closing panel aborts cinematic without summary.  
  **Fix:** Add Skip; on dismiss show compact “You unlocked: …” or leave overlay list visible.  
  **Files:** `JourneyGuideProvider.tsx`, `JourneyGuideLayer.tsx`, `cinematic-unlock-engine.ts`  
  **Verify:** Story F — user always knows what unlocked after skip or close.  
  **Audit:** H8, production #17.

- [ ] **RB-E03 — Economic Reality empty state with CTA**  
  **Problem:** `UI_NOT_AVAILABLE` message only — dead end.  
  **Fix:** One clear action (e.g. “Complete profile” → `/profile` or specific domain).  
  **Files:** `EconomicRealityPage.tsx`, `EconomicRealityGalaxyBridge.tsx`  
  **Verify:** [verification.md](./verification.md) ER-M03 / UX-ER3 — empty ER shows CTA.

---

## F — Accessibility & production gates (4 blockers)

- [ ] **RB-F01 — Skip link visible and functional**  
  **Fix:** Add “Skip to main content” as first focusable element; target main/galaxy stage.  
  **Verify:** [verification.md](./verification.md) row 22.

- [ ] **RB-F02 — Journey Guide welcome: focus trap + Escape**  
  **Problem:** `role="dialog"` without `aria-modal`, focus trap, or Escape dismiss.  
  **Fix:** Focus first button on open; trap tab; Escape calls `dismissWelcome` or equivalent.  
  **Files:** `JourneyGuide.tsx`, `JourneyGuideLayer.tsx`  
  **Verify:** Keyboard-only user can complete or exit welcome.

- [ ] **RB-F03 — Mobile: FAB / inspector / HUD do not block primary actions**  
  **Problem:** Bottom FAB overlaps galaxy HUD/inspector at ≤768px.  
  **Fix:** Offset FAB when inspector open; or collapse inspector on guide FAB focus.  
  **Files:** `life-event-polish.css`, `JourneyGuideLayer.tsx`  
  **Verify:** 375px — user can tap recommended planet and inspector CTA without overlap.

- [ ] **RB-F04 — Add `error.tsx` for route-level failures**  
  **Problem:** Only root `AppErrorBoundary`; unhandled route errors lack branded recovery.  
  **Fix:** `app/error.tsx` with retry + home link.  
  **Verify:** Forced error boundary shows recovery UI (pair with RB-B04).

---

## G — Smoke gate (run after all above)

Run once every RB-* is `[x]`:

```bash
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && npm run test
```

Manual (required):

- [ ] **RB-G01 — Mobile 375px full journey:** Home → LE → intake → plan → Profile → edit city → toast → ER  
- [ ] **RB-G02 — Session reset journey:** invalidate session → reload → banner → clean guide state  
- [ ] **RB-G03 — Chaos spot-check:** double Save profile, Back during save, two-tab edit conflict  
- [ ] **RB-G04 — Beta Ready Gate rows 1–15** in [verification.md](./verification.md)  
- [ ] **RB-G05 — No open P0 UX issues** ([verification.md](./verification.md) Production row 29)

---

## Traceability matrix

| Blocker | Production audit | Chaos audit | verification.md |
|---------|------------------|-------------|-----------------|
| RB-A01 | #1 | C2 | — |
| RB-A02 | #16 | C2 | — |
| RB-A03 | #5 | C1 | row 4 |
| RB-A04 | — | H9 | — |
| RB-A05 | — | H2 | — |
| RB-B01 | #2 | Story C | row 21 |
| RB-B02 | #3 | — | — |
| RB-B03 | #9 | — | — |
| RB-B04 | #6 | — | — |
| RB-C01 | #4 | H4 | — |
| RB-C02 | #11 | — | row 24 |
| RB-C03 | #7 | — | row 14 |
| RB-D01 | #12 | C4 | E2E-01 |
| RB-D02 | — | H1 | UX-T2 |
| RB-D03 | — | C3 | — |
| RB-D04 | — | H7, M1 | — |
| RB-D05 | #15 | M3 | — |
| RB-E01 | #10 | H3 | — |
| RB-E02 | #17 | H8 | — |
| RB-E03 | #13 | — | ER-M03 |
| RB-F01–F04 | #7 | — | rows 22–23 |

---

## Explicitly deferred to Phase 2 (not blockers)

Do **not** block release on these; track separately:

- Profile galaxy URL sync on selection  
- Guest home module discovery paths  
- SchemaForm controlled migration / dirty-check on remount  
- Tab-sync banner (`storage` event)  
- `beforeunload` on mutations  
- Orphan component cleanup (`Header`, `HomeSnapshotRenderer`)  
- Theme toggle removal from dead code  
- Journey Guide full i18n  
- Cinematic “don’t show again” preference  

---

## Related docs

- [production-readiness-ui-ux-audit.md](../audits/production-readiness-ui-ux-audit.md)  
- [malicious-beta-tester-ux-audit.md](../audits/malicious-beta-tester-ux-audit.md)  
- [verification.md](./verification.md)  
- [ux.md](./ux.md)  
- [implementation-first-pass-plan.md](./implementation-first-pass-plan.md)
