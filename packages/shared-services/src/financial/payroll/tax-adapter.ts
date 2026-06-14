import { calculate as calculatePap } from 'lohnsteuerrechner';
import type { FinancialParameterSet } from '../parameters/index.js';
import type { TaxClass } from '../types/index.js';

export interface PayrollTaxInput {
  grossMonthly: number;
  taxClass: TaxClass;
  churchTax: boolean;
  taxYear: number;
  params: FinancialParameterSet;
}

export interface PayrollTaxResult {
  incomeTax: number;
  solidaritySurcharge: number;
  churchTax: number;
}

export interface PayrollTaxAdapter {
  calculate(input: PayrollTaxInput): PayrollTaxResult;
}

function centsToEuro(cents: number): number {
  return Math.round(cents) / 100;
}

export class LohnsteuerrechnerAdapter implements PayrollTaxAdapter {
  calculate(input: PayrollTaxInput): PayrollTaxResult {
    const grossCents = Math.round(input.grossMonthly * 100);
    const kvz = input.params.socialRates.kvZusatzbeitrag * 100;

    const result = calculatePap(input.taxYear as 2025 | 2026, {
      LZZ: 2,
      RE4: grossCents,
      STKL: input.taxClass,
      KVZ: kvz,
      PVZ: 0,
      R: 0,
      LZZFREIB: 0,
      LZZHINZU: 0,
      PKV: 0,
      PKPV: 0,
    });

    const incomeTax = centsToEuro(result.LSTLZZ);
    const solidaritySurcharge = centsToEuro(result.SOLZLZZ);
    const churchTax = input.churchTax
      ? Math.round(incomeTax * input.params.churchTaxRate * 100) / 100
      : 0;

    return { incomeTax, solidaritySurcharge, churchTax };
  }
}

export const defaultTaxAdapter = new LohnsteuerrechnerAdapter();
