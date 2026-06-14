import type { FinancialParameterSet } from '../../parameters/index.js';
import type { FinancialPerson } from '../../types/index.js';
import { regelbedarfStufeForPerson, hasPartnerInHousehold } from '../../household/index.js';

export function calculateRegelbedarf(
  members: FinancialPerson[],
  params: FinancialParameterSet
): number {
  const hasPartner = hasPartnerInHousehold(members);
  let total = 0;

  for (const member of members) {
    if (member.role === 'child' || member.role === 'applicant' || member.role === 'partner') {
      const stufe = regelbedarfStufeForPerson(member, hasPartner);
      total += params.regelbedarf[stufe];
    }
  }

  return round2(total);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
