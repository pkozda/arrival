import type { FinancialPerson, HousingInput, HouseholdInput } from '../types/index.js';
import type { RegelbedarfStufe } from '../types/index.js';

export function regelbedarfStufeForPerson(person: FinancialPerson, hasPartner: boolean): RegelbedarfStufe {
  if (person.role === 'child') {
    if (person.age <= 5) return 'stufe6';
    if (person.age <= 13) return 'stufe5';
    if (person.age <= 17) return 'stufe4';
    return 'stufe3';
  }
  if (person.role === 'partner') return 'stufe2';
  if (person.role === 'applicant') {
    if (person.age >= 18 && person.age <= 24 && hasPartner) return 'stufe3';
    return hasPartner ? 'stufe2' : 'stufe1';
  }
  return 'stufe1';
}

export function countChildren(members: FinancialPerson[]): number {
  return members.filter((m) => m.role === 'child').length;
}

export function hasPartnerInHousehold(members: FinancialPerson[]): boolean {
  return members.some((m) => m.role === 'partner');
}

export function getAdultMembers(members: FinancialPerson[]): FinancialPerson[] {
  return members.filter((m) => m.role === 'applicant' || m.role === 'partner');
}

export function buildHouseholdFromLegacy(
  householdSize: number,
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed',
  monthlyRent: number,
  taxClass: 1 | 2 | 3 | 4 | 5 | 6,
  churchTax: boolean
): HouseholdInput {
  const members: FinancialPerson[] = [
    {
      id: 'applicant',
      role: 'applicant',
      age: 30,
      taxClass,
      churchTax,
    },
  ];

  const hasPartner = maritalStatus === 'married';
  if (hasPartner) {
    members.push({
      id: 'partner',
      role: 'partner',
      age: 30,
      taxClass: 5,
      churchTax: false,
    });
  }

  const adults = hasPartner ? 2 : 1;
  const children = Math.max(0, householdSize - adults);
  for (let i = 0; i < children; i++) {
    members.push({
      id: `child-${i + 1}`,
      role: 'child',
      age: 8,
    });
  }

  return {
    members,
    housing: {
      coldRent: monthlyRent,
      utilities: 0,
      bundesland: 'BE',
    },
    currentBenefits: {},
  };
}

export function validateHousehold(household: HouseholdInput): string[] {
  const errors: string[] = [];
  const applicants = household.members.filter((m) => m.role === 'applicant');
  if (applicants.length !== 1) {
    errors.push('Household must contain exactly one applicant');
  }
  const partners = household.members.filter((m) => m.role === 'partner');
  if (partners.length > 1) {
    errors.push('Household can contain at most one partner');
  }
  return errors;
}

export type { HousingInput };
