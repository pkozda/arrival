import type { RegelbedarfStufe } from '../types/index.js';

export interface FinancialParameterSet {
  year: number;
  version: string;
  grundfreibetrag: number;
  minijobGrenze: number;
  midijobObergrenze: number;
  regelbedarf: Record<RegelbedarfStufe, number>;
  kindergeld: number;
  bbmgKvMonthly: number;
  bbmgRvMonthly: number;
  socialRates: {
    kvEmployee: number;
    pvEmployee: number;
    rvEmployee: number;
    avEmployee: number;
    kvZusatzbeitrag: number;
  };
  midijob: {
    gleitzoneFactor: number;
    gleitzoneOffset: number;
  };
  minijob: {
    rvOptInRate: number;
  };
  buergergeldFreibetraege: {
    grundfreibetrag: number;
    tier1Rate: number;
    tier1Upper: number;
    tier2Rate: number;
    tier2Upper: number;
  };
  kduDefaultCapSingle: number;
  kduDefaultCapCouple: number;
  churchTaxRate: number;
}

export const PARAMETERS_2025: FinancialParameterSet = {
  year: 2025,
  version: '2025.1',
  grundfreibetrag: 12096,
  minijobGrenze: 556,
  midijobObergrenze: 2000,
  regelbedarf: {
    stufe1: 563,
    stufe2: 506,
    stufe3: 451,
    stufe4: 471,
    stufe5: 390,
    stufe6: 357,
  },
  kindergeld: 250,
  bbmgKvMonthly: 5512.5,
  bbmgRvMonthly: 7550,
  socialRates: {
    kvEmployee: 0.073,
    pvEmployee: 0.017,
    rvEmployee: 0.093,
    avEmployee: 0.013,
    kvZusatzbeitrag: 0.017,
  },
  midijob: {
    gleitzoneFactor: 1.127718284,
    gleitzoneOffset: 255.4365684,
  },
  minijob: {
    rvOptInRate: 0.036,
  },
  buergergeldFreibetraege: {
    grundfreibetrag: 100,
    tier1Rate: 0.2,
    tier1Upper: 520,
    tier2Rate: 0.1,
    tier2Upper: 1000,
  },
  kduDefaultCapSingle: 750,
  kduDefaultCapCouple: 950,
  churchTaxRate: 0.09,
};

const REGISTRY: Record<number, FinancialParameterSet> = {
  2025: PARAMETERS_2025,
};

export function getParameters(taxYear: number): FinancialParameterSet {
  const params = REGISTRY[taxYear];
  if (!params) {
    throw new Error(`No financial parameters registered for tax year ${taxYear}`);
  }
  return params;
}

export function getSupportedTaxYears(): number[] {
  return Object.keys(REGISTRY).map(Number);
}
