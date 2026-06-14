import type { FinancialParameterSet } from '../../parameters/index.js';

/**
 * § 11b Abs. 2 SGB II — Freibeträge for Erwerbseinkommen (simplified tiers)
 */
export function calculateEmploymentFreibetrag(
  grossEmploymentIncome: number,
  params: FinancialParameterSet
): number {
  const { grundfreibetrag, tier1Rate, tier1Upper, tier2Rate, tier2Upper } =
    params.buergergeldFreibetraege;

  if (grossEmploymentIncome <= 0) return 0;
  if (grossEmploymentIncome <= grundfreibetrag) return grossEmploymentIncome;

  let freibetrag = grundfreibetrag;

  const tier1Amount = Math.min(grossEmploymentIncome, tier1Upper) - grundfreibetrag;
  if (tier1Amount > 0) {
    freibetrag += tier1Amount * tier1Rate;
  }

  if (grossEmploymentIncome > tier1Upper) {
    const tier2Amount = Math.min(grossEmploymentIncome, tier2Upper) - tier1Upper;
    freibetrag += tier2Amount * tier2Rate;
  }

  return round2(Math.min(freibetrag, grossEmploymentIncome));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
