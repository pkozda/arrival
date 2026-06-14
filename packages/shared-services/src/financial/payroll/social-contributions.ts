import type { FinancialParameterSet } from '../parameters/index.js';

export function cappedAssessmentBase(gross: number, params: FinancialParameterSet): number {
  return Math.min(gross, params.bbmgRvMonthly);
}

export function calculateSocialContributions(
  assessmentBase: number,
  params: FinancialParameterSet
): { health: number; pension: number; unemployment: number; care: number; total: number } {
  const kvRate = params.socialRates.kvEmployee + params.socialRates.kvZusatzbeitrag / 2;
  const health = assessmentBase * kvRate;
  const pension = assessmentBase * params.socialRates.rvEmployee;
  const unemployment = assessmentBase * params.socialRates.avEmployee;
  const care = assessmentBase * params.socialRates.pvEmployee;
  const total = health + pension + unemployment + care;

  return {
    health: round2(health),
    pension: round2(pension),
    unemployment: round2(unemployment),
    care: round2(care),
    total: round2(total),
  };
}

export function calculateMidijobAssessmentBase(gross: number, params: FinancialParameterSet): number {
  const { minijobGrenze, midijobObergrenze, midijob } = params;
  if (gross <= minijobGrenze) return gross;
  if (gross >= midijobObergrenze) return gross;

  const raw = midijob.gleitzoneFactor * gross - midijob.gleitzoneOffset;
  return round2(Math.max(minijobGrenze, Math.min(gross, raw)));
}

export function classifyEmploymentByGross(
  gross: number,
  params: FinancialParameterSet
): 'minijob' | 'midijob' | 'regular' {
  if (gross <= params.minijobGrenze) return 'minijob';
  if (gross < params.midijobObergrenze) return 'midijob';
  return 'regular';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
