# Payroll Library Evaluation — German Brutto/Netto

**Date:** June 2026  
**Scope:** Lohnsteuer (BMF PAP), social contributions, Minijob/Midijob  
**Decision:** Use **`lohnsteuerrechner`** via adapter for Lohnsteuer; custom implementation for SV/Minijob/Midijob

---

## Evaluation Criteria

| Criterion | Weight |
|-----------|--------|
| Maintenance activity (2024–2026) | High |
| BMF PAP alignment (2025+) | Critical |
| License compatibility (private/commercial) | Critical |
| TypeScript / ESM support | High |
| Social insurance + Minijob/Midijob | High |
| Testability / cent precision | High |

---

## Candidates Evaluated

### 1. `lohnsteuerrechner` (npm)

| Attribute | Value |
|-----------|-------|
| **License** | MIT ✅ |
| **Last publish** | March 2026 (v1.0.7) |
| **GitHub** | canida-software/lohnsteuer |
| **Stars / activity** | Low (new project, 1 contributor) |
| **Years supported** | 2025, 2026 |
| **Scope** | Lohnsteuer PAP only (LSTLZZ, SOLZLZZ, church tax bases) |
| **Precision** | Cent integers + `decimal.js` internally |
| **Social insurance** | ❌ Not included |
| **Minijob/Midijob** | ❌ Not included |

**Verification (local smoke test):**
```
calculate(2025, { LZZ: 2, RE4: 250000, STKL: 1 }) → LSTLZZ: 20666 (€206.66/month)
```
Plausible for €2,500 gross, Steuerklasse I.

**Pros:** MIT, current PAP years, cent-exact tax, clean API, ESM.  
**Cons:** Very new, low community adoption, tax-only, single maintainer.

**Risk mitigation:** Adapter layer isolates dependency; golden tests against known values; fallback path documented.

---

### 2. `@finanzfluss/calculators`

| Attribute | Value |
|-----------|-------|
| **License** | **AGPL-3.0** ❌ |
| **Last publish** | April 2026 (v1.3.4) |
| **GitHub** | finanzfluss/calculators (45 stars, active) |
| **Scope** | Full Brutto-Netto (tax + social + all StKl) |
| **Years** | 2025, 2026 |

**Pros:** Most complete maintained solution; Finanzfluss production usage; Zod types.  
**Cons:** **AGPL-3.0 requires source disclosure for network services** — incompatible with closed/private Arrive Atlas deployment without legal review.

**Decision:** Rejected for licensing reasons.

---

### 3. `@bmfin/steuerrechner`

| Attribute | Value |
|-----------|-------|
| **License** | MIT ✅ |
| **Last release** | September 2023 (v1.1.1) |
| **Years supported** | 2022, 2023 only |
| **Scope** | Lohnsteuer PAP (partial) |

**Pros:** MIT, PAP-based.  
**Cons:** Outdated (no 2024–2026), stale maintenance.

**Decision:** Rejected — tax year gap.

---

### 4. `lohnsteuer` (ksm2)

| Attribute | Value |
|-----------|-------|
| **License** | MIT |
| **Last update** | March 2019 |
| **Scope** | Tax + social (2019 rates) |

**Decision:** Rejected — abandoned.

---

### 5. `taxjs` (taxcalcs)

| Attribute | Value |
|-----------|-------|
| **License** | MIT |
| **Last update** | April 2024 |
| **Latest release** | 2023.0.0 |
| **Scope** | PAP code-generated, year-specific classes |

**Decision:** Rejected — no 2025/2026, maintenance slowing.

---

### 6. BMF Steuerrechner API wrapper (`bmf-steuerrechner-api`)

| Attribute | Value |
|-----------|-------|
| **Type** | Remote HTTP oracle |
| **Last update** | 2018 |

**Decision:** Rejected for runtime dependency; useful only as optional integration-test oracle (not implemented in M1).

---

## Decision

### Adopt: `lohnsteuerrechner` via `PayrollTaxAdapter`

```
PayrollEngine
  ├── PayrollTaxAdapter → lohnsteuerrechner (Lohnsteuer, Soli, Kirchensteuer basis)
  ├── SocialContributionsEngine (custom, ParameterRegistry 2025)
  ├── MinijobEngine (custom)
  └── MidijobEngine (custom, Gleitzone formula)
```

### Why not manual PAP?

A trustworthy **MIT-licensed 2025 PAP** implementation exists. Manual PAP porting is high-risk (one-cent bugs, annual maintenance). The adapter pattern gives:

- Official algorithm alignment for Lohnsteuer
- Swap-ability if library is abandoned
- Custom control where no library exists (SGB II, Gleitzone)

### Why custom social / Minijob / Midijob?

No evaluated library combines:
- MIT license
- 2025 parameters
- Gleitzone (Midijob) per current SV law
- Minijob pauschale rules

`@finanzfluss/calculators` covers this but is AGPL.

---

## Adapter Architecture

```typescript
// packages/shared-services/src/financial/payroll/tax-adapter.ts
interface PayrollTaxAdapter {
  calculateLohnsteuer(input: TaxInput): TaxOutput; // cents internally
}

// Default: LohnsteuerrechnerAdapter
// Future: CustomPapAdapter | BmfOracleAdapter (tests only)
```

---

## Ongoing Validation Strategy

1. Golden fixtures in `__fixtures__/payroll-2025.json`
2. Regression tests vs v1 adapter output shape (not values)
3. Annual review when BMF publishes new PAP — bump `lohnsteuerrechner` or migrate adapter
4. Optional: BMF API cross-check in CI (network, manual approval)

---

## References

- [lohnsteuerrechner on npm](https://www.npmjs.com/package/lohnsteuerrechner)
- [finanzfluss/calculators](https://github.com/finanzfluss/calculators) (AGPL — not adopted)
- [BMF PAP documentation](https://www.bmf-steuerrechner.de/interface/pseudocodes.xhtml)
- [Minijob-Zentrale Gleitzone](https://www.minijob-zentrale.de/)
