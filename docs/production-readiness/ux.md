# UX — What the User Experiences

> **Role: USER EXPERIENCE LAYER (locked)**  
> Behavior · flows · failures · light traceability only.  
> No tasks · no architecture · no roadmap logic.

Interface **behavior**: UX issue → engineering task → verification check.

[product.md](./product.md) · [engineering.md](./engineering.md) · [verification.md](./verification.md) · [runtime-truth.md](./runtime-truth.md)

---

## Canonical Home composition (PH-5)

**Life Event dominates Home** when it has meaningful state. This is intentional presentation policy (`shouldHideHomeSecondarySections` in `home-p0.ts`).

When LE plan is **loading**, the **plan card is visible**, or **cold-start** is active, Home **does not render** secondary sections:

- Economic Reality card
- Suggested modules (when plan card would show)
- Priority actions
- Browse-topics grid

ER remains available at `/modules/economic-reality` and via LE wireframe links. **Hiding the ER card is not a failure** — it is the canonical layout when LE is primary.

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| ER card expected always on Home | PH-5 home presentation (`home-p0.ts`) | HOME-C01 |

---

## Every surface has four states

| State | User sees | Never acceptable |
|-------|-----------|------------------|
| **Loading** | Skeleton or spinner with context | Blank white area |
| **Success** | Data, plan, or guidance | Stale data with no indication |
| **Empty** | What is missing + one clear action | Empty card, no explanation |
| **Error** | Plain message + retry or next step | Silent disappearance |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Blank area while loading | Shared loading component (UX-L1) | Structured loading Home + Profile |
| Error looks like a hint | Shared error component (UX-ENG-01) | Errors distinct from hints |

---

## Flow — First visit

| Step | User sees | User does | System response | Failure behavior |
|------|-----------|-----------|-----------------|------------------|
| 1 | Home, stable language | Opens app | Session created or restored | Error screen + retry within 10s |
| 2 | Cold-start or onboarding prompt | Starts intake | Profile intake begins | Main area never blank |
| 3 | Situation summary filling | Completes basics | Facts saved | Empty state + "Go to Profile" |
| 4 | Next-steps loading → plan | Waits | Plan generated | Error + retry — not empty space |
| 5 | ER card **or** LE-only Home | Reads LE plan; opens ER module if needed | Economic guidance in module; ER card only when PH-5 allows | When ER card visible: error inside card — never silent vanish |
| 6 | Life Event module with actions | Opens module | Full plan displayed | Error panel — not hint text |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| App looks dead on open | Session bootstrap error (REL-02) | Session bootstrap error visible |
| Blank next-steps | Home plan failure visible (UX-H1) | Home next-steps never blank on plan failure |
| ER card disappears on API fail | Home ER failure visible (UX-H2) | ER card never silent on failure **when card is rendered** |
| Core flow untested | Playwright first-time (E2E-01) | E2E-01 green |

---

## Flow — Return visit

| Step | User sees | User does | System response | Failure behavior |
|------|-----------|-----------|-----------------|------------------|
| 1 | Same plan and language as before | Reloads or returns | Session + state restored | Brief notice if session was reset |
| 2 | Consistent facts on Home and Profile | Navigates between them | Same story both places | Profile error banner if load failed |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Situation lost on reload | GJ-02 UI fixture (TEST-01) | GJ-02 return visit preserves situation |
| Language resets | Playwright locale (E2E-02) | E2E-02 green |

---

## Flow — Profile change updates everything

| Step | User sees | User does | System response | Failure behavior |
|------|-----------|-----------|-----------------|------------------|
| 1 | Edit form | Changes fact, saves | Confirmation within 5s | Clear save error + retry |
| 2 | Updated Home **without reload** | Returns to Home | LE plan reflects edit; ER via module (card when PH-5 allows) | Degraded banner if sync partial |
| 3 | Updated Life Event plan | Opens module | Plan matches new facts | Plan error if engine failed |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Silent save | Post-edit confirmation (UX-T2) | Save confirmation ≤5s |
| Plan stale after edit | Snapshot refresh (REL-R1) | Profile edit updates plan without reload |
| ER stale after edit | ER refresh on sync | E2E-03 green (LE Home + ER module) |
| Partial sync invisible | Degraded sync banner (REL-12) | Degraded sync visible |

---

## Feature A — Life Event

### Onboarding / first visit

| | |
|---|---|
| **User sees** | Welcome or checklist: what to complete first |
| **User does** | Starts intake; fills basic profile facts |
| **System response** | Situation summary begins to fill; plan generation starts |
| **Failure behavior** | No blank Home; every empty area explains what to do next |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Blank cards, no CTA | Empty-state copy (UX-D1) | Empty states show next-step CTA |
| Wrong situation, no error | Profile load error (REL-05) | Profile load failure visible |

### Profile understanding

| | |
|---|---|
| **User sees** | Mirror overview with completeness %; domain cards with facts or gaps |
| **User does** | Opens domain → reads snapshot → edits if wrong |
| **System response** | Facts match server; save updates situation everywhere |
| **Failure behavior** | Profile load error visible; snapshot errors on domain page; form resyncs after server update |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| User can't see gaps | Profile completeness (UX-P1) | Completeness visible on Home + Profile |
| Empty flash before form | Edit loading gate (UX-P2) | Edit loading gate works |
| Infinite loading on domain | Domain snapshot error (UX-P3) | Domain snapshot error surfaced |
| Stale form after sync | Editor resync (REL-R5) | Form matches server after sync |

### Plan generation

| | |
|---|---|
| **User sees** | Home next-steps: loading skeleton → prioritized action list |
| **User does** | Reads steps; taps to open Life Event module |
| **System response** | Plan from Life Event engine; refreshes when profile changes |
| **Failure behavior** | Error + retry on Home — **never blank next-steps area** |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Blank next-steps on API fail | Home plan failure visible (UX-H1) | Home next-steps never blank on plan failure |
| Text-only "Loading…" | Shared loading component (UX-L1) | Structured loading Home + Profile |
| Plan loads before profile ready | Playwright bootstrap guard (E2E-08) | E2E-08 green |
| Retry does nothing | Retry refetch wiring (UX-RETRY-H) | Home retry triggers refetch |

### Guidance display

| | |
|---|---|
| **User sees** | Full plan in module: steps, actions, confidence in plain language |
| **User does** | Completes or attempts actions |
| **System response** | State changes or blocked reason shown |
| **Failure behavior** | Errors use error styling; disabled actions explain why (including screen readers) |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Errors look like hints in module | LE plan error panel (UX-LE1) | LE-M02; LE plan error uses error severity (P1 polish) |
| Module blank on success | LE loading → plan content (UX-LE3) | LE-M01 |
| Module feels broken while loading | LE loading → plan content (UX-LE3) | LE-M01 |
| Blocked actions unexplained | LE disabled-action SR (UX-LE2) | E2E-05 action blocked reason |
| User unsure about plan quality | LE confidence label (UX-T3) | LE confidence label visible |
| Silent action result | LE action feedback (UX-T5) | LE action gives visible feedback |
| Retry does nothing | Retry refetch wiring (UX-RETRY-LE) | LE retry triggers refetch |

### Flow — Life Event module

| Step | User sees | User does | System response | Failure behavior |
|------|-----------|-----------|-----------------|------------------|
| 1 | Module shell or nav entry | Opens Life Event module | Module route loads | Never blank module body |
| 2 | Full-layout skeleton | Waits | Plan fetch starts | Skeleton visible — not empty white |
| 3 | Plan steps, actions | Reads plan; attempts actions | Plan content rendered | — |
| 4 | Error panel + Retry button | Taps Retry after API fail | Refetch starts; skeleton returns | If retry fails → error stays with Retry |
| 5 | Updated plan after profile edit | Returns from Profile without reload | Module reflects new facts | Stale plan never shown silently (P1: REL-R1) |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Module blank on success | LE loading → plan content (UX-LE3) | LE-M01 |
| Module API failure hidden | LE plan error panel (UX-LE1) | LE-M02 |
| Retry does nothing | Retry refetch wiring (UX-RETRY-LE) | RETRY-LE01–04 |

### Life Event — critical failures

| Situation | Must NOT see | Must see |
|-----------|--------------|----------|
| Plan API fails on Home | Empty next-steps | Error + retry |
| Plan API fails in module | Muted hint text | Clear error panel |
| Profile changed | Old plan, no warning | Updated plan or "no change" message |
| Action done | Silent result | Toast or inline feedback (UX-T5) |
| No plan yet | Broken layout | Empty state: what's needed to get a plan |
| Profile API down | Normal-looking empty Home | Error + retry |
| Incomplete profile | Confusing blank cards | CTA to complete Profile |
| Save succeeds | No feedback | Confirmation within 5s |

---

## Feature B — Economic Reality

### Data loading

| | |
|---|---|
| **User sees** | ER card skeleton on Home **when PH-5 allows**; full layout skeleton in module |
| **User does** | Waits or navigates to module |
| **System response** | Economic data loads within 10s |
| **Failure behavior** | Timeout → error message, not infinite spinner |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Infinite spinner | Fetch timeout 10s (REL-11) | API down → error within 10s |
| ER card vanishes on API fail | Home ER failure visible (UX-H2) | ER card never silent on failure when rendered |
| Retry does nothing | Retry refetch wiring (UX-RETRY-ER-H) | ER card retry triggers refetch |

### Explanation layer

| | |
|---|---|
| **User sees** | Short guidance on Home; optional one-line "why you're seeing this" |
| **User does** | Reads; taps action or opens full module |
| **System response** | Guidance matches current profile and economic context |
| **Failure behavior** | Loading, empty, and failed states look different from each other |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| User doesn't know why guidance shown | ER rationale line (UX-T4) | ER rationale line on Home |
| States look the same | ER distinct state styling (UX-E2) | ER loading / empty / failed visually distinct |

### Flow — Economic Reality module

| Step | User sees | User does | System response | Failure behavior |
|------|-----------|-----------|-----------------|------------------|
| 1 | Module shell or nav entry | Opens Economic Reality module | Module route loads | Never blank module body |
| 2 | Full-layout skeleton | Waits | Economic data fetch starts | Skeleton visible — not empty white |
| 3 | Guidance, data, actions | Reads explanation layer | Content rendered (success path) | — |
| 4 | Honest empty + CTA | Sees missing-data message | Lists what is missing + next step | No fake guidance |
| 5 | Error panel + Retry button | Taps Retry after API fail | Refetch starts; skeleton returns | If retry fails → error stays with Retry |
| 6 | Updated guidance after profile edit | Returns from Profile without reload | Module reflects new facts | Stale data never shown silently |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Module body blank on open | ER loading → content (UX-ER2) | ER-M01 |
| Module API failure hidden | ER module error panel (UX-ER1) | ER-M02 |
| No data shown as success | ER module empty state (UX-ER3) | ER-M03 (P1) |
| Retry does nothing | Retry refetch wiring (UX-RETRY-ER) | ER retry restores state or shows failure |
| States indistinguishable | ER distinct state styling (UX-E2) | ER loading / empty / failed visually distinct |

### Refresh / update

| | |
|---|---|
| **User sees** | Brief refresh indicator when data updates |
| **User does** | Edits profile, returns to Home without reload |
| **System response** | ER module reflects new facts; Home ER card when visible under PH-5 |
| **Failure behavior** | Stale guidance never shown silently; partial sync shows degraded banner |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Stale guidance after edit | Snapshot refresh (REL-R1) | Guidance updates after profile edit |
| Partial sync invisible | Degraded sync banner (REL-12) | Degraded sync visible |
| Untested cross-feature path | Playwright profile update (E2E-03) | E2E-03 green |

### Missing data

| | |
|---|---|
| **User sees** | Honest empty: what economic data is missing and why |
| **User does** | Completes missing profile facts or accepts limitation |
| **System response** | Guidance appears when enough context exists |
| **Failure behavior** | No misleading guidance from incomplete data |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Misleading guidance from gaps | Empty-state copy (UX-D1) | Empty states show next-step CTA |

### Clarity of interpretation

| | |
|---|---|
| **User sees** | Plain language — no jargon; actions have visible outcomes |
| **User does** | Executes economic action |
| **System response** | Success or failure feedback |
| **Failure behavior** | "Fix your profile" and "Server unavailable" use different copy and styling |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Silent action result | ER action feedback (UX-T5) | ER action gives visible feedback |
| Errors look like hints | Shared error component (UX-ENG-01) | Errors distinct from hints |

### Economic Reality — critical failures

| Situation | Must NOT see | Must see |
|-----------|--------------|----------|
| ER fetch fails (card rendered) | Card disappears | Loading → error inside card |
| ER card hidden by PH-5 | Expecting card on Home | LE primary; open ER module |
| Missing data | Fake or generic guidance | Honest empty + what to complete |
| Action done | Silent result | Visible feedback |
| Profile changed | Old economic guidance | Updated guidance or explicit no-change |
| ER module API fails | Blank module body | Error panel + Retry (UX-ER1) |
| ER module no data | Generic placeholder | Honest empty + CTA (UX-ER3) |
| Retry tapped | No visual change | Loading skeleton → content or error |

---

## Retry behavior (all surfaces)

Concrete bindings — no generic retry. See [engineering.md § P0 Retry surface bindings](./engineering.md#p0--retry-surface-bindings-ux-retry).

### Home next-steps (UX-RETRY-H)

| | |
|---|---|
| **Trigger** | `GET /life-event/plan` (or runtime LIFE_EVENT domain) returns error |
| **User sees** | Error panel + Retry in next-steps area |
| **User does** | Taps Retry |
| **During retry** | Skeleton replaces error panel; Retry button disabled |
| **On success** | Skeleton → prioritized plan list |
| **On failure** | Skeleton → error panel; Retry re-enabled |
| **Verify** | RETRY-H01–04 |

### Home ER card (UX-RETRY-ER-H)

**Precondition:** ER card is rendered (PH-5 does not hide secondary sections). When LE dominates Home, validate ER retry at module surface (`UX-RETRY-ER`).

| | |
|---|---|
| **Trigger** | Home ER snippet fetch returns error |
| **User sees** | Error message inside card (card stays visible) + Retry |
| **User does** | Taps Retry |
| **During retry** | Skeleton inside card; Retry disabled |
| **On success** | Skeleton → guidance text/actions |
| **On failure** | Skeleton → error inside card; Retry re-enabled |
| **Verify** | RETRY-ER01–02 |

### Life Event module (UX-RETRY-LE)

| | |
|---|---|
| **Trigger** | LE module plan fetch returns error |
| **User sees** | Error panel + Retry in module body |
| **User does** | Taps Retry |
| **During retry** | Skeleton in module body; Retry disabled |
| **On success** | Skeleton → plan steps/actions |
| **On failure** | Skeleton → error panel; Retry re-enabled |
| **Verify** | RETRY-LE01–04 |

### Economic Reality module (UX-RETRY-ER)

Session-scoped presentation cache (`REL-R3`) may show cached content after reload when `deterministicHash` is unchanged — this is **valid**. Error panel applies when fetch fails and `state.error` is set. **Retry always re-triggers fetch.**

| | |
|---|---|
| **Trigger** | ER module data fetch returns error (no valid cached presentation for current state) |
| **User sees** | Error panel + Retry in module body |
| **User does** | Taps Retry |
| **During retry** | Skeleton in module body; Retry disabled |
| **On success** | Skeleton → economic guidance/content |
| **On failure** | Skeleton → error panel; Retry re-enabled |
| **Cache note** | Reload after prior success may display cached presentation without error UI |
| **Verify** | RETRY-ER03–05 · ER-M02–06 (error-state path) |

### Session bootstrap (UX-RETRY-BOOT / REL-02)

| | |
|---|---|
| **Trigger** | Session create fails |
| **User sees** | Error screen + Retry within 10s |
| **User does** | Taps Retry |
| **During retry** | Loading indicator; Retry disabled |
| **On success** | Home loads |
| **On failure** | Error screen; Retry re-enabled |
| **Verify** | BOOT-C01 (source contract) · manual session-block check · Playwright optional (may skip if POST intercept flaky) |

---

## App-wide behavior

| Situation | User sees | User can do |
|-----------|-----------|-------------|
| App crash | Recovery screen | Reload |
| Session fails on open | Error within ~10s | Retry |
| API down mid-session | Error within 10s | Retry |
| Bad data in browser storage | App works normally | Continue (optional notice) |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| White screen on crash | Crash recovery UI (REL-01) | Crash → recovery UI |
| App broken on bad storage | Storage key recovery (REL-10) | E2E-06 green |
| User unaware of beta limits | Beta banner (UX-H5) | Beta limitations disclosed |
| Keyboard users blocked | Skip link + focus trap (UX-N1) | GJ-01 keyboard-only |
| Broken on phone | Mobile layout (UX-M1) | Mobile 375px usable |

---

## Out of scope

New modules · onboarding wizard redesign · benefits simulator · desktop nav redesign
