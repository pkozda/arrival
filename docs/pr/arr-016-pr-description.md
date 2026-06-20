# UX-P4: Adaptive Profile Intelligence Layer — read-side interpretation

Implements **UX-P4 (Profile Intelligence P4)** — a deterministic, read-only interpretation layer on top of `UserContextV1`. Profile becomes **transparent**: the system can explain what it knows, how confidently, and what might be missing — without new facts, writes, or a second profile model.

**Branch:** `arr-016`  
**Depends on:** P1 mutation pipeline (`UserContextV1`, contract lock) · UX-P3 correction UI (`fact.correct` via `profile_ui`)  
**Roadmap:** [profile-system-p4-roadmap.md](../identity/profile-system-p4-roadmap.md)

## Summary

P4 adds a separate read path for interpretation metadata. Situation **facts** still flow through `GET /api/user-context`; **insights** flow through `GET /api/profile-insights`. The web never sees raw mutation events.

```text
UserContextV1 (authoritative)
        +
MutationEvent[] + execution metadata (server-only)
        │
        ▼
interpretProfileInsights()  →  ProfileInsightViewV1
        │
        ▼
GET /api/profile-insights  (derived-non-authoritative)
        │
        ├── Profile domain detail — provenance + confidence block
        ├── Profile overview — per-section confidence badges
        ├── Home — missing-context hints (≤ 3)
        └── Module prefill — confidence-aware banner copy
```

## What was done

### Profile Intelligence engine (`packages/profile-intelligence/`)

New package `@arrival-atlas/profile-intelligence` — read-only, no mutation commit paths.

| Module | Purpose |
|--------|---------|
| `interpret-profile-insights.ts` | Main projection: `ProfileInsightViewV1` from inputs |
| `confidence.ts` | Deterministic domain/global confidence (high / medium / low / none) |
| `provenance.ts` | Plain-language narratives from module executions + Profile corrections |
| `missing-context.ts` | Actionable gap hints with stable priority ordering (cap ≤ 3) |
| `types.ts` | Mirror section definitions, execution metadata shapes |

**Confidence rules (v1, all testable):**

| Level | Signals (examples) |
|-------|-------------------|
| **high** | Data present + multiple module sources, or Profile correction cross-checked by module |
| **medium** | Single module source or lone `fact.correct` from Profile |
| **low** | Partial data, stale (90-day window), or conflicting field writers |
| **none** | Section empty |

### Product contract (`packages/product-contract/`)

New types in `profile/profile-insight-view.ts`:

| Type | Role |
|------|------|
| `ProfileInsightViewV1` | Top-level interpretation projection |
| `DomainInsight` | Per mirror section: confidence, provenance, suggestions |
| `DomainConfidence` | Level + human-readable reasons |
| `MissingContextHint` | Gap message + CTA (`correct_in_profile` / `open_module`) |
| `AdvisorySuggestion` | Non-authoritative advisory links |

Explicitly **not** authoritative for situation facts — same non-authority pattern as `SnapshotUserContextTransport`.

### API (`apps/api/`)

| Piece | Role |
|-------|------|
| `GET /api/profile-insights` | Returns `ProfileInsightViewV1` for session |
| `state/profile-insights-projection.ts` | Wires `UserContextV1` + events + execution metadata into engine |
| `routes/api-contract-headers.ts` | `x-profile-insights-authority: derived-non-authoritative` |
| `routing/route-security-map.ts` | Secured route registration |

**Server-side inputs (never exposed to web):**

- `MutationEvent[]` from `SystemState.profileMutationEvents`
- Module execution history from `SystemState.executionsByModuleId`

Response **must not** include raw events — enforced by API test.

### Web client & UI (`apps/web/`)

| Area | Change |
|------|--------|
| `lib/profile-insights/client.ts` | `fetchProfileInsights()` — sole web read path |
| `lib/profile-insights/selectors.ts` | Completeness summary, prefill confidence copy, mirror lookup |
| `AppProvider` | Hydrates `profileInsights` alongside `userContext` (separate fetch) |
| `DomainInsightBlock` | "What we know" section on domain detail — provenance + reasons + links |
| `ConfidenceBadge` | Plain labels on overview cards and detail block |
| `MissingContextHintsCard` | Home additive card — ≤ 3 hints + completeness summary |
| `ProfilePrefillBanner` | Confidence-aware message via `resolvePrefillConfidenceMessage()` |
| `ProfileDomainDetail` | Renders `DomainInsightBlock` below read-only facts |
| `ProfileMirrorOverview` | Confidence badges on section cards |
| `HomeSnapshotRenderer` | Renders `MissingContextHintsCard` |

**Unchanged:** `DomainMutationEditor`, P3 save flow, `submitMutation()` write path.

### Documentation

- New roadmap: `docs/identity/profile-system-p4-roadmap.md` (UX-P4, tagged `arr-016`)
- Link added to `docs/README.md` and `profile-system-v1-roadmap.md`
- P3 roadmap cross-references P4 as follow-on track

## Architecture compliance (P1–P3 lock preserved)

- ✅ Situation facts via `selectUserContextProfile(userContext)` only — unchanged
- ✅ Writes via `submitMutation()` only — insight layer never calls `/api/mutations`
- ✅ No reads from `snapshot.userContext` for domain logic
- ✅ `MutationEvent[]` stays server-side — web receives derived `ProfileInsightViewV1` only
- ✅ `UiSnapshot` used only for module titles / FTU — not for confidence derivation
- ✅ P4 suggestions are advisory links — no `MutationRequest`, no `fact.suggest` persistence
- ✅ API authority headers distinguish the three read models:

```text
GET /api/user-context       → x-user-context-authority: authoritative
GET /api/ui-snapshot        → x-snapshot-layer: execution-ui-transport
GET /api/profile-insights   → x-profile-insights-authority: derived-non-authoritative
```

## Data flow

```text
AppProvider bootstrap / refreshSessionState()
  → fetchUserContext()          (facts — authoritative)
  → fetchProfileInsights()      (interpretation — derived)
  → fetchUiSnapshot()           (execution transport)

/profile/[slug]
  → read facts from userContext
  → render DomainInsightBlock from profileInsights.domainInsights

/profile
  → section cards with ConfidenceBadge

/  (Home)
  → MissingContextHintsCard (≤ 3 hints)

/modules/[id]
  → ProfilePrefillBanner with confidence-aware copy
  → prefill values still from userContext
```

## Key files

```
packages/profile-intelligence/src/**
packages/product-contract/src/profile/profile-insight-view.ts
apps/api/src/routes/profile-insights.ts
apps/api/src/state/profile-insights-projection.ts
apps/api/src/routes/api-contract-headers.ts
apps/web/src/lib/profile-insights/**
apps/web/src/components/profile/DomainInsightBlock.tsx
apps/web/src/components/profile/ConfidenceBadge.tsx
apps/web/src/components/home/MissingContextHintsCard.tsx
apps/web/src/components/AppProvider.tsx
docs/identity/profile-system-p4-roadmap.md
```

## Test plan

- [x] `@arrival-atlas/profile-intelligence` — **4/4** (determinism, missing-context cap, provenance, confidence)
- [x] `@arrival-atlas/api` — **193/193** (`profile-insights.api.test.ts` — shape, headers, no event leak)
- [x] `@arrival-atlas/web` — **53/53** (`profile-insights-boundary.test.ts`, `mutation-boundary.test.ts` updated)
- [ ] Smoke: `/profile/work-income` shows confidence badge + "What we know" block after module execute
- [ ] Smoke: Profile correction updates provenance narrative ("You updated this…")
- [ ] Smoke: Home shows ≤ 3 missing-context hints with working links
- [ ] Smoke: Module prefill banner reflects global confidence level
- [ ] Smoke: P3 edit/save flow unchanged — no regression
- [ ] Verify `/api/profile-insights` authority headers in network tab

## Out of scope (P4-C and follow-up)

- Field-group insights, staleness detail, explanation graph (Phase P4-C)
- `headRevision` on `GET /api/user-context`
- ML / probabilistic scoring
- Embedding insights on user-context response (separate endpoint preferred)
- Auto-write or prefill mutations from hints
- Backend reducer / mutation engine changes

## Non-goals (confirmed)

- ❌ No new mutation types or write paths
- ❌ No second editable profile model
- ❌ No raw event log in web UI
- ❌ No schema keys or mutation terminology in user-facing copy
- ❌ No Home situation writes or optimistic fact mutations

## Definition of Done (UX-P4 Phase P4-A/B)

- [x] `interpretProfileInsights()` produces deterministic `ProfileInsightViewV1`
- [x] `GET /api/profile-insights` with contract authority headers
- [x] Profile domain detail shows provenance + confidence
- [x] Profile overview shows per-section confidence badges
- [x] Home surfaces missing-context hints (≤ 3)
- [x] Module prefill banner uses confidence-aware copy
- [x] P1 boundary tests still green; P3 correction flow untouched
- [x] Golden tests prove determinism

**Remaining for full UX-P4 lock:** Phase P4-C explanation depth (field groups, staleness narratives, explanation graph) — see roadmap.
