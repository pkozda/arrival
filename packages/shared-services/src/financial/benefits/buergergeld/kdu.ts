import type { FinancialParameterSet } from '../../parameters/index.js';
import type { HousingInput } from '../../types/index.js';
import { hasPartnerInHousehold, countChildren } from '../../household/index.js';
import type { FinancialPerson } from '../../types/index.js';

export function calculateKdu(
  housing: HousingInput,
  members: FinancialPerson[],
  params: FinancialParameterSet
): { kdu: number; capped: boolean; capApplied: number } {
  const actual = housing.coldRent + housing.utilities;
  const hasPartner = hasPartnerInHousehold(members);
  const children = countChildren(members);

  let cap = params.kduDefaultCapSingle;
  if (hasPartner) cap = params.kduDefaultCapCouple;
  if (children > 0) cap += children * 150;

  if (housing.cityMietstufe) {
    cap = cap * (1 + (housing.cityMietstufe - 1) * 0.05);
  }

  const kdu = Math.min(actual, round2(cap));
  return {
    kdu,
    capped: actual > cap,
    capApplied: round2(cap),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
