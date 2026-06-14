export interface TaxCalculationInput {
  grossIncome: number;
  taxClass: 1 | 2 | 3 | 4 | 5 | 6;
  churchTax?: boolean;
  state?: string;
}

export interface TaxCalculationResult {
  grossIncome: number;
  incomeTax: number;
  solidaritySurcharge: number;
  churchTax: number;
  socialContributions: {
    health: number;
    pension: number;
    unemployment: number;
    care: number;
    total: number;
  };
  netIncome: number;
  effectiveTaxRate: number;
  monthlyNet: number;
}

const SOCIAL_RATES = {
  health: 0.073,
  pension: 0.093,
  unemployment: 0.013,
  care: 0.017,
};

const TAX_CLASS_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 0.85,
  3: 0.7,
  4: 1.0,
  5: 1.3,
  6: 1.5,
};

function estimateIncomeTax(annualGross: number, taxClass: number): number {
  const multiplier = TAX_CLASS_MULTIPLIERS[taxClass] ?? 1.0;
  const taxableBase = annualGross * multiplier;

  if (taxableBase <= 11604) return 0;
  if (taxableBase <= 17005) {
    const y = (taxableBase - 11604) / 10000;
    return (922.98 * y + 1400) * y;
  }
  if (taxableBase <= 66760) {
    const z = (taxableBase - 17005) / 10000;
    return (181.19 * z + 2397) * z + 1025.38;
  }
  if (taxableBase <= 277825) {
    return 0.42 * taxableBase - 10602.13;
  }
  return 0.45 * taxableBase - 18936.88;
}

export function calculateNetIncome(input: TaxCalculationInput): TaxCalculationResult {
  const annualGross = input.grossIncome * 12;
  const incomeTax = Math.max(0, estimateIncomeTax(annualGross, input.taxClass));
  const solidaritySurcharge = incomeTax > 18130 ? incomeTax * 0.055 : 0;
  const churchTax = input.churchTax ? incomeTax * 0.09 : 0;

  const health = annualGross * SOCIAL_RATES.health;
  const pension = annualGross * SOCIAL_RATES.pension;
  const unemployment = annualGross * SOCIAL_RATES.unemployment;
  const care = annualGross * SOCIAL_RATES.care;
  const socialTotal = health + pension + unemployment + care;

  const totalDeductions = incomeTax + solidaritySurcharge + churchTax + socialTotal;
  const netIncome = annualGross - totalDeductions;
  const effectiveTaxRate = annualGross > 0 ? totalDeductions / annualGross : 0;

  return {
    grossIncome: input.grossIncome,
    incomeTax: Math.round(incomeTax / 12),
    solidaritySurcharge: Math.round(solidaritySurcharge / 12),
    churchTax: Math.round(churchTax / 12),
    socialContributions: {
      health: Math.round(health / 12),
      pension: Math.round(pension / 12),
      unemployment: Math.round(unemployment / 12),
      care: Math.round(care / 12),
      total: Math.round(socialTotal / 12),
    },
    netIncome: Math.round(netIncome / 12),
    effectiveTaxRate: Math.round(effectiveTaxRate * 1000) / 10,
    monthlyNet: Math.round(netIncome / 12),
  };
}

export function calculateBuergergeldEligibility(
  netIncome: number,
  householdSize: number,
  rent: number
): {
  eligible: boolean;
  estimatedBenefit: number;
  reasoning: string[];
} {
  const regelsatz = 563;
  const housingAllowance = rent;
  const needs = regelsatz * householdSize + housingAllowance;
  const gap = needs - netIncome;

  const reasoning: string[] = [];
  reasoning.push(`Regelsatz (${householdSize} person(s)): €${regelsatz * householdSize}/month`);
  reasoning.push(`Housing costs considered: €${rent}/month`);
  reasoning.push(`Total need: €${needs}/month vs. net income: €${netIncome}/month`);

  if (gap <= 0) {
    reasoning.push('Income exceeds estimated need — likely not eligible for Bürgergeld');
    return { eligible: false, estimatedBenefit: 0, reasoning };
  }

  reasoning.push(`Estimated gap: €${Math.round(gap)}/month — may qualify for Bürgergeld`);
  return { eligible: true, estimatedBenefit: Math.round(gap), reasoning };
}
