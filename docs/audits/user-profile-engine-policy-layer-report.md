# User Profile Engine — Phase 1.7 Profile Policy Layer Report

**Date:** June 2026  
**Package:** `@arrivalos/profile@0.1.0`  
**Follows:** `docs/audits/user-profile-engine-runtime-unification-report.md`  
**Design reference:** `docs/audits/user-profile-engine-design.md`  
**Status:** Complete

---

## Executive Summary

Phase 1.7 introduces an explicit **Profile Policy Layer** that controls which profile fields each module may access, which fields are sensitive (redacted from context exposure), and how extensions are gated per module.

Policy enforcement is integrated into the canonical `resolveExecutionContext()` pipeline **before** input merge and context building. Modules no longer receive the full profile document via `profileSlice`; they receive a **policy-filtered view** while authorized computation data flows through a separate **policy-constrained document** for merge and legacy shims.

**51 automated tests pass** (19 profile + 25 shared-services + 6 modules + 1 API integration). `AppContextSchema` and `ModuleRegistry` interfaces are unchanged.

---

## Problem Statement

Before Phase 1.7, `resolveExecutionContext()` loaded the full profile and exposed all core domains via `ProfileEngine.resolveForModule()`. Risks:

| Risk | Consequence |
|------|-------------|
| Implicit data lake | Any module could receive unrelated profile domains |
| Sensitive field leakage | Income/rent visible in `context.profileSlice` without audit trail |
| Cross-module extension bleed | Namespace isolation relied on convention only |
| No compliance hook | GDPR field-level access control impossible at Phase 2 |

---

## Solution Overview

### New subsystem: `@arrivalos/profile/policy`

| File | Role |
|------|------|
| `policy/module-profile-policy-registry.ts` | `ModuleProfilePolicy` type, registry, default policies |
| `policy/apply-profile-policy.ts` | `applyProfilePolicy()`, `buildPolicyConstrainedDocument()` |
| `policy/apply-profile-policy.test.ts` | 6 policy enforcement tests |
| `policy/index.ts` | Public exports |

### ModuleProfilePolicy shape

```typescript
type ModuleProfilePolicy = {
  moduleId: string;
  allowedFields: string[];
  sensitiveFields: string[];
  allowExtensions: boolean;
  allowedExtensions?: string[];
  redactFields?: string[];
};
```

### Two-profile-view model

| View | Function | Purpose |
|------|----------|---------|
| **ProfileSlice** (redacted) | `applyProfilePolicy()` | Exposed in `context.profileSlice` — audit-safe, no sensitive dot-paths |
| **Policy-constrained document** | `buildPolicyConstrainedDocument()` | Used by `InputMerger` and legacy context shims — full nested data within **allowed top-level domains only** |

Sensitive fields (e.g. `employment.grossMonthlyIncome`) are **redacted from ProfileSlice** but **retained in the constrained document** when the parent domain is authorized — enabling financial calculations without exposing raw income in the slice.

---

## Default Module Policies

### financial-reality

```typescript
{
  moduleId: 'financial-reality',
  allowedFields: ['preferredLanguage', 'employment', 'household', 'housing', 'location'],
  sensitiveFields: ['employment.grossMonthlyIncome', 'housing.monthlyColdRent'],
  allowExtensions: true,
  allowedExtensions: ['financial-reality'],
}
```

### healthcare-navigation

```typescript
{
  moduleId: 'healthcare-navigation',
  allowedFields: ['preferredLanguage', 'location', 'insurance', 'residency'],
  sensitiveFields: [],
  allowExtensions: true,
  allowedExtensions: ['healthcare-navigation'],
}
```

### Unregistered modules

Fallback `DEFAULT_MODULE_POLICY`: only `preferredLanguage`, no extensions.

---

## Policy Enforcement Rules

`applyProfilePolicy(profile, modulePolicy)`:

1. Include **only** top-level keys in `allowedFields`
2. **Redact** all dot-paths in `sensitiveFields` from the slice copy
3. Apply optional `redactFields` (additional removals)
4. **Gate extensions**: if `allowExtensions`, include only namespaces in `allowedExtensions` (default: own `moduleId`)
5. Prune empty nested objects after redaction

`buildPolicyConstrainedDocument(profile, modulePolicy)`:

1. Copy allowed top-level domains with **full nested data** (including sensitive paths)
2. Exclude disallowed domains entirely (no insurance/benefits for financial module)
3. Used exclusively for merge + shim derivation — never assigned directly to `profileSlice`

---

## Updated Pipeline

```
resolveExecutionContext()
        │
        ├─ 1. ProfileEngine.getProfileBySession()
        │
        ├─ 2. getModuleProfilePolicy(moduleId)
        │
        ├─ 3. applyProfilePolicy()          → profileSlice (redacted)
        │    buildPolicyConstrainedDocument() → policyDocument (merge source)
        │
        ├─ 4. mergeModuleInput(policyDocument)   ← policy-constrained
        │
        └─ 5. buildAppContext(profileSlice, policyDocument)
                │
                └── ModuleRegistry.execute(mergedInput, context)
```

Policy is applied **before** InputMerger and ContextBuilder. No alternate execution path exists.

---

## Integration Changes

| File | Change |
|------|--------|
| `engine/resolve-execution-context.ts` | Policy step inserted; returns `profileSlice` |
| `engine/context-builder.ts` | Accepts pre-built `profileSlice` + `policyDocument`; no longer calls `resolveForModule` |
| `index.ts` | Exports `policy/*` |
| `profile.integration.test.ts` | Asserts benefits/insurance blocked for financial policy |

`ProfileEngine.resolveForModule()` remains as an **internal** helper (tests only); production path uses policy layer exclusively.

---

## Verification

### Policy tests (`apply-profile-policy.test.ts`)

| Test | Asserts |
|------|---------|
| Sensitive redaction | `grossMonthlyIncome`, `monthlyColdRent` absent from slice |
| Domain exclusion | Financial slice has no `insurance`, `benefits`, `residency` |
| Extension isolation | Each module sees only its namespace |
| Cross-module leak | Financial cannot see healthcare extensions |
| Healthcare scope | No employment/housing in healthcare slice |
| Merge document | Sensitive values retained in constrained doc for authorized domains |

### Regression

| Suite | Tests | Status |
|-------|------:|--------|
| `@arrivalos/profile` | 19 | ✅ |
| `@arrivalos/shared-services` | 25 | ✅ |
| `@arrivalos/modules` | 6 | ✅ |
| `@arrivalos/api` | 1 | ✅ |
| **Total** | **51** | ✅ |

Behavior preserved:
- Input override wins over profile
- Profile fallback for merge when input empty
- Session binding and revision logic unchanged
- Financial module still computes €2,500 gross from policy-constrained document

Behavior changed (intentional):
- `context.profileSlice.employment.grossMonthlyIncome` is **undefined** (redacted)
- `context.systemState.benefits` unavailable to financial module (domain not allowed)

---

## Architecture (after Phase 1.7)

```
┌──────────────────────────────────────────────────────────────┐
│              resolveExecutionContext()                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              ModuleProfilePolicyRegistry               │  │
│  └──────────────────────────┬─────────────────────────────┘  │
│                             ▼                                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ applyProfilePolicy          buildPolicyConstrainedDoc  │  │
│  │      → ProfileSlice (redacted)   → merge/shim source     │  │
│  └──────────────┬─────────────────────────┬─────────────────┘  │
│                 ▼                         ▼                    │
│         buildAppContext              mergeModuleInput          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ModuleRegistry.execute()
```

---

## Constraints Preserved

| Constraint | Status |
|------------|--------|
| `AppContextSchema` unchanged | ✅ |
| `ModuleRegistry.execute()` unchanged | ✅ |
| Single entry point `resolveExecutionContext()` | ✅ |
| No merge logic in API | ✅ |
| No PostgreSQL / auth / UI | ✅ |

---

## GDPR / Compliance Readiness

| Capability | Phase 1.7 | Phase 2+ |
|------------|-----------|----------|
| Field-level module allowlists | ✅ | Extend per module |
| Sensitive field redaction in context | ✅ | Encrypt at rest |
| Extension namespace isolation | ✅ | Registry in DB |
| Audit: policy applied per execution | ✅ `profileSlice` | Log policy version |
| Deny-by-default unregistered modules | ✅ | Admin policy UI |

---

## Known Limitations

1. **Policies are code-defined** — not yet editable at runtime or stored in PostgreSQL.
2. **Legacy context shims** (`userProfile.income`) still derive from policy-constrained document — income appears in shims for authorized modules but not in `profileSlice`.
3. **Only two modules** have explicit policies; others get minimal `preferredLanguage`-only access.
4. **No policy version** on execution metadata yet — future: `context.meta.policyVersion`.

---

## Recommended Next Steps

1. **Register policies for remaining modules** (system-translation, life-event, grocery-optimization).
2. **Expose `GET /api/profile/policies/:moduleId`** for UI transparency ("what we use").
3. **Phase 2 Postgres** — store policies in registry table; keep `applyProfilePolicy` unchanged.
4. **Financial v2 adapter** — read `bundesland` from policy-permitted `profileSlice.location`.
5. **Add policy version to `dataProvenance`** — e.g. `{ field: 'grossIncome', source: 'profile', policy: 'financial-reality@1' }`.

---

## Commands

```bash
npm run build
npm run test

# Policy tests only
npm run test -w @arrivalos/profile -- src/policy
```

---

*Phase 1.7 establishes profile as a controlled attribute system. All module execution must continue to flow through `resolveExecutionContext()` with policy enforcement.*
