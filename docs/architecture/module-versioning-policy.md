# Module Versioning Policy

Arrival Atlas modules are versioned with **semantic versioning** (`MAJOR.MINOR.PATCH`) and validated at bootstrap/CI time via `@arrivalos/module-sdk`.

## Scope

This policy applies to modules compiled through the Module SDK (`defineModule` → `registerModuleFromSDK`) before they enter `bootstrapGovernedRuntime()`.

## Version bump rules

| Change | Required bump | Notes |
|--------|---------------|-------|
| Breaking `inputSchema` change | **MAJOR** | Removed fields, stricter validation, type narrowing |
| Breaking `outputSchema` change | **MAJOR** | Removed fields, breaking shape changes |
| Capability set change | **MAJOR** | Any add/remove in module contract capabilities |
| Recommendation/action template shape change | **MINOR** | SDK metadata used for MRC-3/MRC-4 surface |
| Internal execute logic change (schemas unchanged) | **PATCH** | Output-equivalent logic refactors |
| Documentation-only / copy changes | **PATCH** | No schema or contract drift |

## Enforcement

CI runs `validateModuleVersioning()` against `packages/module-sdk/baselines/module-version-baseline.json`:

- Zod schema fingerprints (`hashZodSchema`) detect schema drift deterministically
- Capability and recommendation/action template hashes detect contract drift
- Semver in module definition must match the required bump class

## Coexistence

Major version bumps may introduce parallel module versions during deprecation windows. The governance kernel remains unchanged; versioning is enforced at SDK registration time only.

## Non-goals

- Runtime hot-reload of module versions
- Automatic migration of stored executions
- UI-facing version negotiation (handled by product contract layer)
