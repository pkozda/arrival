# User Profile Engine — Architecture Design

**Date:** June 2026  
**Author role:** Principal Software Architect  
**Status:** Proposal — **not implemented**  
**Related docs:** `docs/CURRENT_STATE.md`, `docs/audits/financial-module-v2-plan.md`, `docs/audits/financial-v2-validation-report.md`

---

## Executive Summary

Arrive Atlas today passes a **minimal, ephemeral `AppContext`** into every module execution. Profile data is fragmented across three places that do not share a schema:

1. **`AppContext.userProfile`** — four optional fields (`language`, `residencyStatus`, `income`, `householdSize`)
2. **`AppContext.systemState`** — untyped `Record<string, unknown>` buckets for benefits, insurance, employment
3. **Per-module input forms** — financial, healthcare, and other modules re-collect overlapping facts on every page load

Sessions are **in-memory only**; the web client sends `{ userProfile: { language } }` per request and never persists household or financial data. This blocks personalized decision support, cross-module consistency, and auditability.

This document proposes a **User Profile Engine (UPE)** as the central context provider: a versioned, typed, privacy-aware profile domain that **hydrates `AppContext` at execution time** while preserving module independence and the existing `Module.execute(input, context)` contract.

**Recommendation:** Introduce a new package `@arrivalos/profile` (engine + storage ports), keep `@arrivalos/core` as the runtime contract layer, and add PostgreSQL persistence in Phase 2. Do **not** embed profile logic inside individual modules.

---

## 1. Current Architecture Analysis

### 1.1 Context flow today

```
┌─────────────────┐     POST /api/sessions      ┌──────────────────┐
│  Next.js UI     │ ──────────────────────────► │  Fastify API     │
│  AppProvider    │     { userProfile: { lang }} │  in-memory Map   │
└────────┬────────┘                             └────────┬─────────┘
         │ POST /api/modules/:id/execute                  │
         │  { input: {...form fields}, context: {...} }   │
         └──────────────────────────────────────────────►│
                                                          │
                              merge session.context       │
                              + request.context           ▼
                                              ┌───────────────────────┐
                                              │  ModuleRegistry       │
                                              │  .execute(input, ctx) │
                                              └───────────────────────┘
```

**Key files:**

| Component | Location | Role |
|-----------|----------|------|
| `AppContextSchema` | `packages/core/src/types/index.ts` | Runtime context contract |
| `UserProfileSchema` | same | 4 fields, mostly unused |
| `SystemStateSchema` | same | Untyped nested records |
| Session store | `packages/core/src/session/index.ts` | `Map<string, Session>`, lost on restart |
| Module execute | `packages/core/src/registry/index.ts` | Validates input; passes context unchanged |
| API merge | `apps/api/src/index.ts` | Session + body context shallow merge |

### 1.2 Field duplication map

| Required profile field | `UserProfile` | `SystemState` | Module input today |
|------------------------|:-------------:|:-------------:|---------------------|
| Preferred language | ✅ | — | Passed as context only |
| Country of origin | ❌ | ❌ | ❌ |
| Federal state (Bundesland) | ❌ | ❌ | Hard-coded `BE` in financial v2 adapter |
| City | ❌ | ❌ | Healthcare `city` (optional) |
| Residency status | ⚠️ free string | ❌ | ❌ |
| Household size | ✅ | ❌ | Financial form |
| Marital status | ❌ | ❌ | Financial form |
| Children (count / ages) | ❌ | ❌ | Inferred as `householdSize − adults` |
| Employment status | ❌ | ⚠️ untyped | Financial form |
| Income (gross) | ⚠️ optional `income` | ❌ | Financial form |
| Rent | ❌ | ❌ | Financial `monthlyRent` |
| Insurance type | ❌ | ⚠️ untyped | Healthcare form |
| Benefits status | ❌ | ⚠️ untyped | Financial rules via `daysInGermany` |

**Only two modules read context meaningfully:**

- `system-translation` — `context.userProfile.language`
- `healthcare-navigation` — `context.userProfile.language`
- `financial-reality` — `context.systemState.insurance.hasCoverage`, `systemState.benefits.daysInGermany` (with defaults)

All other profile-like data is re-entered in module forms and **never written back** to session.

### 1.3 Architectural constraints to preserve

From `README.md` and module structure:

- Modules **must not import each other**
- Modules receive `(input, context)` — contract is stable
- Core stays minimal; heavy domain logic belongs in shared services or dedicated packages
- Financial v2 already has a rich internal household model (`HouseholdInput`, `FinancialPerson`) separate from `AppContext`

The UPE must **bridge** the lightweight `AppContext` and richer domain models (financial household, healthcare scenario) without coupling modules.

---

## 2. Design Goals & Non-Goals

### Goals

| # | Goal |
|---|------|
| G1 | Single source of truth for user facts consumed across modules |
| G2 | Typed, validated, versioned profile schema |
| G3 | Modules declare what profile slices they need; engine resolves + redacts |
| G4 | Works **anonymous-first** (session-bound profile), upgradeable to authenticated account |
| G5 | GDPR-aligned: minimization, consent, export, erasure |
| G6 | Extensible by future modules without core schema churn |

### Non-Goals (this design phase)

- OAuth / identity provider integration (designed for, not built)
- Full onboarding UI wizard
- Real-time sync across devices (Phase 4)
- Replacing module-specific scenario inputs entirely (e.g. `proposedGrossIncome` stays module input)

---

## 3. Target Architecture

### 3.1 Layered model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Presentation (apps/web)                          │
│   Profile onboarding · Settings · Module forms (override / refine)       │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ REST
┌───────────────────────────────────▼─────────────────────────────────────┐
│                          API Layer (apps/api)                              │
│   Profile routes · Session ↔ Profile binding · Auth middleware (future)  │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ @arrivalos/   │         │ @arrivalos/     │         │ @arrivalos/     │
│ core          │◄────────│ profile         │────────►│ shared-services │
│ AppContext    │ hydrate │ ProfileEngine   │ map     │ normalization   │
│ Registry      │         │ ProfileStore *  │         │ financial HH    │
└───────────────┘         └────────┬────────┘         └─────────────────┘
                                   │
                                   ▼
                         ┌─────────────────┐
                         │ PostgreSQL       │
                         │ (Phase 2+)       │
                         │ InMemoryStore    │
                         │ (Phase 0–1)      │
                         └─────────────────┘

* ProfileStore = port interface; swappable adapter
```

### 3.1 Where profile data should live

| Layer | What lives here | Rationale |
|-------|-----------------|-----------|
| **`@arrivalos/profile`** | Profile schema, validation, versioning, merge semantics, `ProfileEngine`, storage port | Domain ownership; testable without HTTP or DB |
| **PostgreSQL** (Phase 2) | Durable profile snapshots, revision history, consent records | Survives restarts; audit trail; GDPR erasure |
| **`@arrivalos/core` Session** | `sessionId`, link to `profileId`, ephemeral UI prefs, last-active | Session ≠ profile; session is transport binding |
| **`AppContext`** (runtime DTO) | Resolved, redacted **view** of profile for module execution | Keeps module contract stable; no DB access in modules |
| **Module `input`** | Scenario-specific overrides only | Job offer amount, urgency, search query — not stable profile |

**Decision:** Profile is **not** stored inside `AppContext` permanently. `AppContext` is rebuilt on each request from `ProfileEngine.resolve(profileId, options)`.

### 3.2 Core types (proposed)

```typescript
// packages/profile/src/types/profile-document.ts

export const PROFILE_SCHEMA_VERSION = '1.0.0';

export const CoreProfileSchema = z.object({
  schemaVersion: z.string(),                    // semver of document shape
  preferredLanguage: SupportedLanguageSchema,
  countryOfOrigin: z.string().length(2).optional(),  // ISO 3166-1 alpha-2
  location: z.object({
    bundesland: z.string().length(2).optional(),     // DE state code
    city: z.string().max(100).optional(),
  }).optional(),
  residency: z.object({
    status: z.enum([
      'eu-citizen', 'permanent-resident', 'temporary-resident',
      'asylum-seeker', 'student-visa', 'work-visa', 'tourist', 'unknown',
    ]).optional(),
    arrivedAt: z.string().datetime().optional(),
  }).optional(),
  household: z.object({
    size: z.number().int().min(1).max(20).optional(),
    maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
    children: z.array(z.object({
      age: z.number().int().min(0).max(25),
    })).max(10).optional(),
  }).optional(),
  employment: z.object({
    status: z.enum([
      'employed', 'self-employed', 'unemployed', 'part-time', 'student',
    ]).optional(),
    grossMonthlyIncome: z.number().nonnegative().optional(),
    taxClass: z.union([z.literal(1), /* ... */ z.literal(6)]).optional(),
    churchTax: z.boolean().optional(),
  }).optional(),
  housing: z.object({
    monthlyColdRent: z.number().nonnegative().optional(),
    monthlyUtilities: z.number().nonnegative().optional(),
  }).optional(),
  insurance: z.object({
    type: z.enum(['public', 'private', 'none']).optional(),
    hasCoverage: z.boolean().optional(),
  }).optional(),
  benefits: z.object({
    receivingBuergergeld: z.boolean().optional(),
    receivingAlg1: z.boolean().optional(),
    receivingWohngeld: z.boolean().optional(),
    daysInGermany: z.number().int().nonnegative().optional(),
  }).optional(),
});

export const ProfileDocumentSchema = CoreProfileSchema.extend({
  extensions: z.record(z.string(), z.record(z.unknown())).default({}),
  // e.g. extensions['financial-reality'] = { proposedScenarios: [...] }
});

export type ProfileDocument = z.infer<typeof ProfileDocumentSchema>;
```

**Sensitive field classification** (for encryption & redaction):

| Tier | Fields | Storage |
|------|--------|---------|
| **Public** | `preferredLanguage`, `location.city`, `residency.status` (enum) | Plain |
| **Internal** | `household.size`, `employment.status`, `insurance.type` | Plain, module-gated |
| **Sensitive** | `employment.grossMonthlyIncome`, `housing.monthlyColdRent`, `benefits.*` | Encrypt at rest (Phase 2) |
| **Extensions** | Module-specific | Namespace-isolated JSONB |

---

## 4. How Modules Consume Profile Data

### 4.1 Consumption pattern (recommended)

Modules **do not read the database**. They receive:

1. **`AppContext`** — hydrated subset (backward compatible)
2. **`ProfileSlice`** (optional new parameter via resolver, or embedded in extended context)

**Phase 1 (minimal breaking change):** Expand `AppContext` and hydrate from profile in API middleware:

```typescript
// apps/api — before registry.execute()
const profile = await profileEngine.getBySession(sessionId);
const context = contextBuilder.buildAppContext({
  sessionId,
  profile,
  requestOverrides: body.context,
  moduleId: id,
});
const input = inputMerger.merge(body.input, profile, moduleId); // opt-in per module
```

**Phase 2 (explicit slices):** Modules opt into declarative requirements:

```typescript
// packages/modules/src/financial-reality/profile-requirements.ts
export const financialProfileRequirements: ProfileRequirements = {
  moduleId: 'financial-reality',
  required: ['household.size', 'employment.grossMonthlyIncome'],
  optional: ['housing.monthlyColdRent', 'employment.taxClass', 'location.bundesland'],
  sensitive: ['employment.grossMonthlyIncome', 'housing.monthlyColdRent'],
};
```

`ProfileEngine.resolveForModule(moduleId, profile)` returns only allowed paths.

### 4.2 Input merge precedence

When a module executes, field values resolve in strict precedence:

```
1. Explicit module input (form / API body)     ← highest
2. Request context overrides
3. Profile document
4. Module-specific defaults
5. Engine defaults (e.g. bundesland 'BE' with confidence flag)  ← lowest
```

This preserves **user override per scenario** while eliminating repetitive data entry.

**Example — financial-reality after UPE:**

```typescript
async function execute(input: FinancialRealityInput, context: AppContext) {
  const merged = mergeFinancialInput(input, context.profileSlice);
  // merged.grossIncome ← input.grossIncome ?? profile.employment.grossMonthlyIncome
  // merged.monthlyRent ← input.monthlyRent ?? profile.housing.monthlyColdRent
  // ...
}
```

### 4.3 Mapping to domain models

| Profile path | Financial v2 (`HouseholdInput`) | Healthcare module |
|--------------|--------------------------------|-------------------|
| `location.bundesland` | `housing.bundesland` | — |
| `location.city` | — | `city` |
| `household.size` + `children[]` | `buildHouseholdFromLegacy` → rich members | — |
| `employment.*` | `employments.applicant` | — |
| `insurance.type` | rules `hasHealthInsurance` | `insuranceType` |
| `benefits.receivingBuergergeld` | `currentBenefits` | — |
| `preferredLanguage` | decision i18n (M2) | step localization |

Mapping functions live in **`@arrivalos/profile/mappers`** or **`@arrivalos/shared-services/profile-adapters`**, not inside modules, to avoid cross-module imports.

### 4.4 Module contract evolution

**Short term:** Keep `execute(input, context: AppContext)`.

**Medium term:** Extend `AppContext` without breaking existing modules:

```typescript
export const AppContextSchema = z.object({
  sessionId: z.string().optional(),
  profileId: z.string().optional(),
  profileVersion: z.number().int().optional(),      // optimistic concurrency
  profileSchemaVersion: z.string().optional(),
  userProfile: LegacyUserProfileSchema.optional(),  // deprecated shim
  profileSlice: z.record(z.unknown()).optional(),     // resolved module slice
  systemState: SystemStateSchema.optional(),          // deprecated → profile.benefits
  dataProvenance: z.array(z.object({
    field: z.string(),
    source: z.enum(['input', 'profile', 'default']),
  })).optional(),
});
```

Legacy modules continue reading `userProfile.language`; new code reads `profileSlice` or typed helpers:

```typescript
import { getProfileField } from '@arrivalos/profile/runtime';
const lang = getProfileField(context, 'preferredLanguage', 'en');
```

---

## 5. Profile Versioning

### 5.1 Three version dimensions

| Dimension | Purpose | Example |
|-----------|---------|---------|
| **Schema version** (`schemaVersion`) | Shape of `ProfileDocument` | `1.0.0` → `1.1.0` adds `housing.utilities` |
| **Revision number** (`revision`) | Optimistic concurrency per save | `42` → `43` |
| **Migration version** | Applied upward migrations | `profile_migration_003` |

### 5.2 Revision model

Every profile mutation creates:

1. **Update** to `profiles` (current snapshot)
2. **Append** to `profile_revisions` (immutable JSON diff or full snapshot)

```typescript
interface ProfileRevision {
  id: string;
  profileId: string;
  revision: number;
  schemaVersion: string;
  document: ProfileDocument;       // full snapshot (simpler for audit)
  changedFields: string[];         // dot-paths
  changedBy: 'user' | 'module' | 'system' | 'migration';
  moduleId?: string;
  createdAt: string;
}
```

### 5.3 Schema evolution rules

1. **Additive changes only** in minor versions (new optional fields)
2. **Breaking changes** bump major; migration functions transform old documents
3. Modules declare `minProfileSchemaVersion` in registration metadata
4. `ProfileEngine.migrate(document)` runs on read if `document.schemaVersion < current`

```typescript
// packages/profile/src/migrations/1.0.0-to-1.1.0.ts
export function migrate_1_0_0_to_1_1_0(doc: unknown): ProfileDocument {
  // e.g. split userProfile.income → employment.grossMonthlyIncome
}
```

### 5.4 Module execution snapshot

For explainability and audit, module results should record:

```typescript
meta: {
  profileRevision: 42,
  profileSchemaVersion: '1.0.0',
  fieldsUsedFromProfile: ['employment.grossMonthlyIncome', 'housing.monthlyColdRent'],
}
```

Financial v2 already has `meta.engineVersion` — extend similarly.

---

## 6. Extensibility for Future Modules

### 6.1 Extension namespace pattern

Core profile holds **cross-cutting facts**. Module-specific fields go in `extensions[moduleId]`:

```json
{
  "schemaVersion": "1.0.0",
  "preferredLanguage": "ru",
  "extensions": {
    "grocery-optimization": {
      "dietaryRestrictions": ["halal"],
      "preferredStores": ["Aldi", "Lidl"]
    },
    "life-event": {
      "lastProcessedEvent": "birth"
    }
  }
}
```

### 6.2 Profile Field Registry

Modules register at startup ( alongside module registration):

```typescript
profileFieldRegistry.register({
  moduleId: 'grocery-optimization',
  extensionSchema: z.object({
    dietaryRestrictions: z.array(z.string()).optional(),
    preferredStores: z.array(z.string()).optional(),
  }),
  paths: [
    { dotPath: 'extensions.grocery-optimization', tier: 'internal' },
  ],
});
```

Core validates extensions against registered schemas on write. Unknown extension keys are rejected unless `allowUnregisteredExtensions` dev flag is set.

### 6.3 Rules for extension vs core promotion

| Criterion | Action |
|-----------|--------|
| Used by ≥ 2 modules | Promote to core schema |
| Needed for legal eligibility (e.g. residency) | Core |
| Module-only UX preference | Extension |
| Sensitive financial data | Core `employment` / `housing` with encryption |

---

## 7. Privacy & Security

### 7.1 Threat model (summary)

| Threat | Mitigation |
|--------|------------|
| Profile data leaked via logs/events | Structured logging with field redaction; no income/rent in `trackEvent` payloads |
| Module over-reads profile | `resolveForModule()` path allowlists |
| Session hijacking | HTTP-only secure cookies (Phase 3 auth); session rotation; TTL |
| Data breach at rest | AES-256-GCM for sensitive columns; keys in KMS/env |
| GDPR erasure request | Cascade delete profile + revisions + session links |
| Cross-user access | `profileId` scoped to auth subject or session owner |

### 7.2 GDPR alignment

| Requirement | Implementation |
|-------------|----------------|
| **Lawful basis** | Consent for profiling; legitimate interest for session binding (document in privacy policy) |
| **Data minimization** | Modules declare required fields; onboarding progressive disclosure |
| **Purpose limitation** | `profile_consents.purposes[]` — e.g. `decision_support`, `analytics` |
| **Right to access** | `GET /api/profile/export` → JSON bundle |
| **Right to erasure** | `DELETE /api/profile` → hard delete + anonymize events |
| **Right to rectification** | `PATCH /api/profile` with revision trail |
| **Storage limitation** | TTL for anonymous profiles (e.g. 90 days inactive); prompt to create account |

### 7.3 Consent record

```sql
CREATE TABLE profile_consents (
  id            UUID PRIMARY KEY,
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  purpose       TEXT NOT NULL,
  granted       BOOLEAN NOT NULL,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at  TIMESTAMPTZ,
  ip_hash       TEXT,          -- optional, hashed
  policy_version TEXT NOT NULL
);
```

### 7.4 Anonymous vs authenticated profiles

| Mode | `profileId` | Persistence | Upgrade path |
|------|-------------|-------------|--------------|
| **Guest** | Tied to session UUID | Session store → PG with `user_id NULL` | `POST /api/profile/claim` after login |
| **Registered** | Tied to `user_id` | PG durable | Cross-device sync |

**Never** merge two profiles without explicit user confirmation.

### 7.5 API security controls

- Rate limit profile writes (10/min per session)
- Validate all input through Zod; reject unknown core fields
- `PATCH` uses JSON Merge Patch with dot-path allowlist
- Return **409 Conflict** on revision mismatch
- Sensitive fields omitted from `GET` unless `?include=sensitive` and consent verified

---

## 8. Database Schema Proposal

**Engine:** PostgreSQL 15+  
**Phase:** Introduced in Phase 2; schema designed now for forward compatibility.

### 8.1 Entity-relationship overview

```
users ─────────────┐
                   │ 1:1 (optional)
profiles ──────────┤
  │                │
  ├── profile_revisions
  ├── profile_consents
  └── profile_extensions (optional normalize)

sessions ──► profiles (guest binding)
```

### 8.2 DDL

```sql
-- Users: placeholder for Phase 3 auth
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE,                    -- nullable until auth
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ                     -- soft delete
);

CREATE TABLE profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  schema_version    TEXT NOT NULL DEFAULT '1.0.0',
  revision          INTEGER NOT NULL DEFAULT 1,
  -- Core columns (queryable, indexed)
  preferred_language TEXT NOT NULL DEFAULT 'en',
  country_of_origin  CHAR(2),
  bundesland         CHAR(2),
  city               TEXT,
  residency_status   TEXT,
  household_size     SMALLINT,
  marital_status     TEXT,
  employment_status  TEXT,
  -- Sensitive (encrypted application-side or pgcrypto)
  gross_monthly_income_enc  BYTEA,
  monthly_cold_rent_enc     BYTEA,
  -- Document blob for full fidelity + extensions
  document_json     JSONB NOT NULL DEFAULT '{}',
  -- Metadata
  completeness_score REAL,                        -- 0..1 for onboarding UX
  last_accessed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ,                  -- guest TTL
  CONSTRAINT profiles_revision_positive CHECK (revision > 0)
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_profiles_expires_at ON profiles(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_profiles_bundesland ON profiles(bundesland);

CREATE TABLE profile_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  revision        INTEGER NOT NULL,
  schema_version  TEXT NOT NULL,
  document_json   JSONB NOT NULL,
  changed_fields  TEXT[] NOT NULL DEFAULT '{}',
  changed_by      TEXT NOT NULL CHECK (changed_by IN ('user','module','system','migration')),
  module_id       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, revision)
);

CREATE TABLE profile_consents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  purpose         TEXT NOT NULL,
  granted         BOOLEAN NOT NULL,
  policy_version  TEXT NOT NULL,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at    TIMESTAMPTZ
);

-- Session binding (replaces in-memory-only session context for profile link)
CREATE TABLE sessions (
  id              TEXT PRIMARY KEY,               -- sess_*
  profile_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  context_json    JSONB NOT NULL DEFAULT '{}',    -- ephemeral UI state only
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_profile_id ON sessions(profile_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

### 8.3 Denormalized columns vs JSONB

| Approach | Pros | Cons |
|----------|------|------|
| **JSONB only** | Flexible | Harder to query/report |
| **Hybrid (recommended)** | Indexable fields for analytics; full doc in JSONB | Sync on write |

Denormalized columns mirror core fields for Jobcenter-region analytics (Bundesland distribution) without parsing JSONB in hot paths.

### 8.4 Storage port interface

```typescript
// packages/profile/src/ports/profile-store.ts
export interface ProfileStore {
  get(profileId: string): Promise<ProfileRecord | null>;
  create(document: ProfileDocument, meta: CreateMeta): Promise<ProfileRecord>;
  update(profileId: string, patch: ProfilePatch, expectedRevision: number): Promise<ProfileRecord>;
  delete(profileId: string): Promise<void>;
  listRevisions(profileId: string, limit?: number): Promise<ProfileRevision[]>;
  bindSession(sessionId: string, profileId: string): Promise<void>;
  getBySession(sessionId: string): Promise<ProfileRecord | null>;
}
```

Implementations: `InMemoryProfileStore` (Phase 0–1), `PostgresProfileStore` (Phase 2).

---

## 9. API Proposal

### 9.1 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/profile` | Create profile (guest or user-bound) |
| `GET` | `/api/profile` | Get current profile (via session or auth) |
| `PATCH` | `/api/profile` | Partial update (`If-Match: revision`) |
| `DELETE` | `/api/profile` | GDPR erasure |
| `GET` | `/api/profile/schema` | JSON Schema / Zod meta for UI forms |
| `GET` | `/api/profile/revisions` | Audit history (paginated) |
| `GET` | `/api/profile/export` | GDPR data export |
| `POST` | `/api/profile/consents` | Record consent |
| `POST` | `/api/profile/claim` | Attach guest profile to authenticated user |

**Session routes (modified):**

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/api/sessions` | Creates session **+ empty profile**; returns `{ sessionId, profileId }` |
| `PATCH` | `/api/sessions/:id` | Ephemeral context only; profile via `/api/profile` |

**Module execute (modified):**

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/api/modules/:id/execute` | API hydrates context from profile; optional `input` merge |

### 9.2 Example payloads

**Create profile (automatic on session create):**

```json
POST /api/sessions
{ "context": { "preferredLanguage": "ru" } }

→ 201
{
  "sessionId": "sess_abc123",
  "profileId": "prof_def456",
  "profile": {
    "schemaVersion": "1.0.0",
    "revision": 1,
    "preferredLanguage": "ru",
    "completenessScore": 0.08
  }
}
```

**Update profile:**

```json
PATCH /api/profile
If-Match: 3
{
  "household": { "size": 3, "maritalStatus": "single", "children": [{ "age": 8 }] },
  "employment": { "status": "employed", "grossMonthlyIncome": 2500, "taxClass": 2 },
  "housing": { "monthlyColdRent": 900 },
  "location": { "bundesland": "BE", "city": "Berlin" }
}

→ 200
{ "profileId": "...", "revision": 4, "completenessScore": 0.72 }
```

**Module execute (profile-aware):**

```json
POST /api/modules/financial-reality/execute
X-Session-Id: sess_abc123

{
  "input": { "proposedGrossIncome": 1200 },
  "context": {}
}

→ Profile fills grossIncome, householdSize, rent, etc.
→ Input overrides only proposedGrossIncome
```

### 9.3 Completeness score

Drive onboarding UX:

| Fields present | Approx. score |
|----------------|---------------|
| Language only | 0.08 |
| + Location | 0.20 |
| + Household | 0.40 |
| + Employment + income | 0.65 |
| + Housing + insurance + benefits | 0.90 |

Modules may return `confidence: 'low'` when required profile fields are missing (aligns with financial v2 confidence model).

---

## 10. Migration Strategy

### Phase 0 — Schema & resolver (no DB, 1 week)

**Goal:** Define types; hydrate expanded `AppContext` from session-stored profile blob.

| Task | Detail |
|------|--------|
| Create `@arrivalos/profile` package | Types, Zod schemas, migrations skeleton |
| Expand session context | Store `profileDocument` inside session (in-memory) |
| `ContextBuilder` | Session → `AppContext` + provenance |
| Web: sync language to profile on change | Fix language not PATCHing session today |

**Exit:** Financial module can read bundesland from profile when adapter updated.

### Phase 1 — Profile API + input merge (2 weeks)

**Goal:** REST profile endpoints backed by `InMemoryProfileStore`; module input merge for financial-reality.

| Task | Detail |
|------|--------|
| Profile routes in API | CRUD + revision conflict |
| `InputMerger` for financial-reality | Precedence rules |
| Deprecate `systemState` reads | Shim from profile.benefits / profile.insurance |
| Unit tests | Schema, merge, migration, redaction |
| Update validation report assumptions | Remove hard-coded `BE` when profile provides bundesland |

**Exit:** User enters profile once; financial form pre-fills.

### Phase 2 — PostgreSQL persistence (2 weeks)

**Goal:** Durable profiles; session binding; guest TTL.

| Task | Detail |
|------|--------|
| Deploy PostgreSQL + migrations | DDL from §8 |
| `PostgresProfileStore` | Implements port |
| Encrypt sensitive columns | Application-level AES-GCM |
| Session table in PG | Replace in-memory Map |
| Backup & erasure procedures | GDPR runbook |

**Exit:** Survives API restart; profile export works.

### Phase 3 — Onboarding UI + auth readiness (2–3 weeks)

**Goal:** Progressive profile wizard; account claim.

| Task | Detail |
|------|--------|
| Settings / onboarding pages | Completeness-driven steps |
| `users` table + JWT/session auth | Profile claim flow |
| Consent capture | `profile_consents` |
| Module metadata: `profileRequirements` | Registry introspection endpoint |

### Phase 4 — Full personalization (ongoing)

| Task | Detail |
|------|--------|
| All modules consume profile slices | Healthcare, life-event, grocery |
| i18n decisions from `preferredLanguage` | Financial M2 |
| Analytics (privacy-preserving) | Aggregates only, no raw income |
| Cross-device sync | Auth-required |

### 10.1 Backward compatibility matrix

| Client | Phase 0–1 behavior |
|--------|-------------------|
| Old web (language only in context) | Still works; empty profile defaults |
| Old module inputs (full form) | Input overrides profile; no break |
| `systemState` in context | Shimmed from profile until removed in Phase 3 |

### 10.2 Data migration from today

**No user data to migrate** — sessions are ephemeral and contain almost no profile data.

One-time **code migration**:

| From | To |
|------|-----|
| `UserProfile.language` | `preferredLanguage` |
| `UserProfile.income` | `employment.grossMonthlyIncome` |
| `UserProfile.householdSize` | `household.size` |
| `UserProfile.residencyStatus` | `residency.status` |
| `systemState.insurance.*` | `insurance.*` |
| `systemState.benefits.*` | `benefits.*` |
| Financial form fields | Profile core (when user saves) |

---

## 11. Package Structure Proposal

```
packages/profile/
├── src/
│   ├── types/
│   │   ├── profile-document.ts      # CoreProfileSchema, ProfileDocumentSchema
│   │   ├── profile-record.ts        # DB record + revision types
│   │   └── profile-requirements.ts  # Module declaration types
│   ├── engine/
│   │   ├── profile-engine.ts        # get, update, migrate, resolveForModule
│   │   ├── context-builder.ts       # Profile → AppContext
│   │   ├── input-merger.ts          # Profile + input → merged input
│   │   └── completeness.ts          # Score calculation
│   ├── migrations/
│   │   ├── index.ts
│   │   └── v1_0_0-to-v1_1_0.ts
│   ├── ports/
│   │   └── profile-store.ts
│   ├── adapters/
│   │   ├── in-memory-store.ts
│   │   └── postgres-store.ts        # Phase 2
│   ├── mappers/
│   │   ├── financial-household.ts   # Profile → HouseholdInput
│   │   └── healthcare-input.ts
│   ├── registry/
│   │   └── profile-field-registry.ts
│   ├── privacy/
│   │   ├── redaction.ts
│   │   └── encryption.ts
│   └── index.ts
└── package.json
```

**Dependency rule:** `@arrivalos/profile` may depend on `@arrivalos/core` (language enum) and `@arrivalos/shared-services/normalization`. It must **not** depend on `@arrivalos/modules`.

---

## 12. Risks & Open Decisions

| # | Risk / decision | Recommendation | Status |
|---|-----------------|----------------|--------|
| R1 | Scope creep into full identity platform | UPE owns profile only; auth is separate service | Open |
| R2 | Module authors bypass profile and re-collect data | Registry lint rule: declare `profileRequirements`; CI check | Open |
| R3 | Incorrect profile → wrong financial advice | Provenance flags + confidence downgrade + disclaimers | Adopt |
| R4 | Children as array vs count | Array of `{ age }` for Regelbedarf accuracy; derive count | **Decided** |
| R5 | Store tax class in profile? | Yes — optional, user-confirmed; needed for financial | **Decided** |
| R6 | Single global profile vs household profiles | Single profile per user for MVP; multi-person household inside document | **Decided** |
| R7 | Encryption: app-level vs pgcrypto | App-level AES-GCM for portability | **Decided** |

---

## 13. Success Criteria

| Metric | Target |
|--------|--------|
| Profile field reuse | ≥ 80% of financial form fields pre-filled from profile |
| Cross-module consistency | Same `bundesland` / language for financial + healthcare in one session |
| Version safety | Zero silent data loss on concurrent PATCH (409 on conflict) |
| GDPR | Export + delete complete within 1 API call each |
| Module isolation | No new cross-module imports; profile access via context only |
| Performance | Profile resolve + merge < 5 ms p95 (in-memory); < 20 ms (PG) |

---

## 14. Summary of Recommendations

1. **Create `@arrivalos/profile`** as the domain owner; PostgreSQL in Phase 2 via storage port.
2. **Keep `AppContext` as the module-facing DTO**, hydrated by `ContextBuilder` — do not expose raw DB rows to modules.
3. **Use input merge precedence** so forms override profile for scenario-specific runs.
4. **Version profiles** with schema semver + integer revision + immutable revision log.
5. **Extend via `extensions[moduleId]`** registered in `ProfileFieldRegistry`; promote shared fields to core.
6. **Treat income, rent, and benefits as sensitive** — encrypt, redact in logs, gate module access.
7. **Migrate in four phases** from in-memory schema validation to full personalized UX — no big-bang rewrite.

---

*This document is an architecture proposal only. Implementation tickets should be derived per phase after stakeholder review.*
