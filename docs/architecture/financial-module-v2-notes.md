# Financial Module v2 — Architecture Notes (Phase M0/M1)

**Status:** Implemented (engine v2.0.0, UI unchanged)  
**Scope:** Phase M0 + Phase M1 only

---

## Package Layout

```
packages/shared-services/src/financial/
├── types/              # Domain types (Household, Scenario, Engine I/O)
├── parameters/         # Versioned legal constants (2025.1)
├── household/          # Bedarfsgemeinschaft builder + Regelbedarf mapping
├── payroll/
│   ├── tax-adapter.ts  # lohnsteuerrechner PAP adapter (MIT)
│   ├── social-contributions.ts
│   ├── minijob.ts
│   ├── midijob.ts
│   └── payroll-engine.ts
├── benefits/
│   ├── benefits-engine.ts
│   └── buergergeld/    # Regelbedarf, KdU, §11b Freibeträge
├── scenarios/          # Scenario comparator
├── decisions/          # DecisionEngine skeleton
├── pipeline/           # FinancialPipeline orchestrator
├── adapters/           # v1 ↔ v2 compatibility
└── __fixtures__/       # Golden test vectors
```

## Data Flow

```
FinancialRealityInput (v1 shape)
        │
        ▼
adaptLegacyInputToV2()
        │
        ▼
FinancialPipeline.run()
   ├── BenefitsEngine.evaluateScenario() × N
   │      └── PayrollEngine per member
   │      └── calculateBuergergeld()
   ├── compareScenarios() (if proposed)
   └── DecisionEngine.evaluate()
        │
        ▼
adaptV2OutputToLegacy()  → v1-compatible output + v2 extensions
```

## Feature Flag

`financialRealityRegistration.featureFlags.advancedTaxScenarios`

- `true` (default): v2 engine via `FinancialPipeline`
- `false`: legacy v1 engine (`calculateNetIncome` multipliers)

Toggle at runtime: `setAdvancedTaxScenarios(boolean)` (module export, for tests).

## External Dependency

| Package | Purpose | License |
|---------|---------|---------|
| `lohnsteuerrechner@^1.0.7` | BMF PAP Lohnsteuer 2025/2026 | MIT |

Social insurance, Minijob, Midijob, Bürgergeld: **custom** (no AGPL `@finanzfluss/calculators`).

## API Contract

- **Input:** unchanged v1 schema + optional `proposedGrossIncome` for compare mode
- **Output:** v1 fields preserved + optional `meta`, `verdict`, `comparison`, `expectedChanges`
- **Module version:** `2.0.0`
- **Module ID:** `financial-reality` (unchanged)

## Not in Scope (M0/M1)

- PostgreSQL / persistence
- User Profile Engine
- Wohngeld
- Full self-employed (net estimate only)
- Phase M2 UI wizard
- CI/CD, Docker, OAuth
