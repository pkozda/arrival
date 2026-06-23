# UX — What the User Experiences

> **Role: USER EXPERIENCE LAYER (locked)**  
> Behavior · flows · failures · light traceability only.  
> No tasks · no architecture · no roadmap logic.

Interface **behavior**: UX issue → engineering task → verification check.

[product.md](./product.md) · [engineering.md](./engineering.md) · [verification.md](./verification.md)

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
| 5 | ER card loading → guidance | Reads card | Economic guidance shown | Card stays visible; error inside card |
| 6 | Life Event module with actions | Opens module | Full plan displayed | Error panel — not hint text |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| App looks dead on open | Session bootstrap error (REL-02) | Session bootstrap error visible |
| Blank next-steps | Home plan failure visible (UX-H1) | Home next-steps never blank on plan failure |
| ER card disappears | Home ER failure visible (UX-H2) | ER card never silent on failure |
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
| 2 | Updated Home **without reload** | Returns to Home | Plan + ER reflect edit | Degraded banner if sync partial |
| 3 | Updated Life Event plan | Opens module | Plan matches new facts | Plan error if engine failed |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Silent save | Post-edit confirmation (UX-T2) | Save confirmation ≤5s |
| Plan stale after edit | Snapshot refresh (REL-R1) | Profile edit updates plan without reload |
| ER stale after edit | ER refresh on sync | E2E-03 green |
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
| Retry does nothing | Retry refetch wiring (UX-RETRY) | Home retry triggers refetch |

### Guidance display

| | |
|---|---|
| **User sees** | Full plan in module: steps, actions, confidence in plain language |
| **User does** | Completes or attempts actions |
| **System response** | State changes or blocked reason shown |
| **Failure behavior** | Errors use error styling; disabled actions explain why (including screen readers) |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Errors look like hints in module | LE plan error severity (UX-LE1) | LE plan error uses error severity |
| Module feels broken while loading | LE loading skeleton (UX-LE3) | Visual review |
| Blocked actions unexplained | LE disabled-action SR (UX-LE2) | E2E-05 action blocked reason |
| User unsure about plan quality | LE confidence label (UX-T3) | LE confidence label visible |
| Silent action result | LE action feedback (UX-T5) | LE action gives visible feedback |
| Retry does nothing | Retry refetch wiring (UX-RETRY) | LE retry triggers refetch |

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
| **User sees** | ER card skeleton on Home; full layout skeleton in module |
| **User does** | Waits or navigates to module |
| **System response** | Economic data loads within 10s |
| **Failure behavior** | Timeout → error message, not infinite spinner |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Infinite spinner | Fetch timeout 10s (REL-11) | API down → error within 10s |
| ER card vanishes | Home ER failure visible (UX-H2) | ER card never silent on failure |
| Retry does nothing | Retry refetch wiring (UX-RETRY) | ER card retry triggers refetch |

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
| 3 | Guidance, data, actions | Reads explanation layer | Content rendered | — |
| 4 | Honest empty + CTA | Sees missing-data message | Lists what is missing + next step | No fake guidance |
| 5 | Error panel + Retry button | Taps Retry after API fail | Refetch starts; skeleton returns | If retry fails → error stays with Retry |
| 6 | Updated guidance after profile edit | Returns from Profile without reload | Module reflects new facts | Stale data never shown silently |

| UX issue | Engineering | Verify |
|----------|-------------|--------|
| Module body blank on open | ER module loading skeleton (UX-ER2) | ER module loading state visible |
| Module API failure hidden | ER module error panel (UX-ER1) | ER module API failure shows error UI |
| No data shown as success | ER module empty state (UX-ER3) | ER empty state visible when no data |
| Retry does nothing | Retry refetch wiring (UX-RETRY) | ER retry restores state or shows failure |
| States indistinguishable | ER distinct state styling (UX-E2) | ER loading / empty / failed visually distinct |

### Refresh / update

| | |
|---|---|
| **User sees** | Brief refresh indicator when data updates |
| **User does** | Edits profile, returns to Home without reload |
| **System response** | ER card and module reflect new facts |
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
| ER fetch fails | Card disappears | Loading → error inside card |
| Missing data | Fake or generic guidance | Honest empty + what to complete |
| Action done | Silent result | Visible feedback |
| Profile changed | Old economic guidance | Updated guidance or explicit no-change |
| ER module API fails | Blank module body | Error panel + Retry (UX-ER1) |
| ER module no data | Generic placeholder | Honest empty + CTA (UX-ER3) |
| Retry tapped | No visual change | Loading skeleton → content or error |

---

## Retry behavior (all surfaces)

Applies to: Home next-steps · Home ER card · Life Event module · Economic Reality module · session bootstrap errors.

| | |
|---|---|
| **User sees** | Error panel with message + labeled **Retry** button (same shared error component styling) |
| **User does** | Taps Retry |
| **System response** | Error panel replaced by loading skeleton in the same area; original fetch/refetch re-runs |
| **On success** | Loading skeleton → content (plan, guidance, or economic data) |
| **On failure** | Loading skeleton → error panel with Retry again (button re-enabled) |
| **Failure behavior** | Retry never silent; no full-page reload unless user chooses; button disabled only while fetch in flight |

| Surface | Retry appears when | Engineering | Verify |
|---------|-------------------|-------------|--------|
| Home next-steps | Plan API fails | UX-RETRY on Home plan fetch | Home retry triggers refetch |
| Home ER card | ER API fails | UX-RETRY on Home ER fetch | ER card retry triggers refetch |
| Life Event module | Plan/guidance API fails | UX-RETRY on LE module fetch | LE retry triggers refetch |
| Economic Reality module | Economic API fails | UX-RETRY on ER module fetch | ER module retry restores or fails visibly |
| Session bootstrap | Session create fails | REL-02 | Session bootstrap retry works |

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
