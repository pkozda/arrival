import type { LifeStateId, SecondaryConditionId, UserContextV1, UserProfileViewV1 } from '@arrival-atlas/product-contract';

export type ClassifierFixture = {
  id: string;
  userContext: UserContextV1;
  expectedPrimary: LifeStateId;
  expectedSecondaries?: SecondaryConditionId[];
};

function profile(partial: Partial<UserProfileViewV1> & { domains: UserProfileViewV1['domains'] }): UserContextV1 {
  return {
    profile: {
      schemaVersion: '1.0.0',
      preferences: { preferredLanguage: 'en' },
      completeness: partial.completeness ?? { score: 40, missingDomains: [] },
      domains: partial.domains,
    },
  };
}

export const CLASSIFIER_FIXTURES: ClassifierFixture[] = [
  {
    id: 'F01',
    userContext: profile({
      domains: {
        housing: { city: 'Berlin' },
        migration: { residencyStatus: 'tourist', arrivedAt: daysAgoIso(10) },
      },
      completeness: { score: 15, missingDomains: ['employment', 'income', 'healthInsurance'] },
    }),
    expectedPrimary: 'arrival_unregistered',
    expectedSecondaries: ['housing_data_missing', 'insurance_gap', 'employment_data_missing', 'income_data_missing'],
  },
  {
    id: 'F02',
    userContext: profile({
      domains: {
        housing: { city: 'Berlin', bundesland: 'BE' },
        migration: { residencyStatus: 'eu-citizen', arrivedAt: daysAgoIso(14) },
        benefits: { daysInGermany: 14 },
      },
      completeness: { score: 30, missingDomains: ['employment', 'healthInsurance'] },
    }),
    expectedPrimary: 'arrival_stabilizing',
    expectedSecondaries: ['insurance_gap', 'employment_data_missing', 'income_data_missing', 'banking_not_established'],
  },
  {
    id: 'F03',
    userContext: profile({
      domains: {
        housing: { city: 'Munich' },
        migration: { residencyStatus: 'work-visa' },
        employment: { employmentStatus: 'employed' },
        income: { grossMonthlyIncome: 3200 },
      },
      completeness: { score: 55, missingDomains: ['healthInsurance'] },
    }),
    expectedPrimary: 'insurance_gap',
  },
  {
    id: 'F04',
    userContext: profile({
      domains: {
        housing: { city: 'Munich', monthlyColdRent: 1200 },
        migration: { residencyStatus: 'permanent-resident' },
        employment: { employmentStatus: 'unemployed' },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        benefits: { daysInGermany: 800 },
      },
    }),
    expectedPrimary: 'economic_setup_pending',
    expectedSecondaries: ['income_data_missing', 'life_transition_pending'],
  },
  {
    id: 'F05',
    userContext: profile({
      domains: {
        housing: { city: 'Hamburg', monthlyColdRent: 900 },
        migration: { residencyStatus: 'eu-citizen' },
        employment: { employmentStatus: 'unemployed' },
        healthInsurance: { insuranceType: 'none', hasCoverage: false },
        benefits: { daysInGermany: 500 },
      },
    }),
    expectedPrimary: 'insurance_gap',
    expectedSecondaries: ['economic_setup_pending', 'life_transition_pending'],
  },
  {
    id: 'F06',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'employed' },
        benefits: { daysInGermany: 400 },
        migration: { residencyStatus: 'permanent-resident' },
      },
      completeness: { score: 35, missingDomains: ['housing'] },
    }),
    expectedPrimary: 'housing_instability',
    expectedSecondaries: ['registration_incomplete', 'housing_search_active'],
  },
  {
    id: 'F07',
    userContext: profile({
      domains: {
        housing: { city: 'Hamburg' },
        employment: { employmentStatus: 'employed' },
        income: { grossMonthlyIncome: 2200 },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        benefits: { daysInGermany: 600, receivingWohngeld: false },
        migration: { residencyStatus: 'permanent-resident' },
      },
    }),
    expectedPrimary: 'housing_instability',
    expectedSecondaries: ['housing_data_missing'],
  },
  {
    id: 'F08',
    userContext: profile({
      domains: {
        housing: { city: 'Cologne', monthlyColdRent: 1100 },
        employment: { employmentStatus: 'employed' },
        income: { grossMonthlyIncome: 1800 },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        benefits: { daysInGermany: 700, receivingWohngeld: false },
        migration: { residencyStatus: 'eu-citizen' },
      },
    }),
    expectedPrimary: 'benefits_exploration',
  },
  {
    id: 'F09',
    userContext: profile({
      domains: {
        housing: { city: 'Berlin', monthlyColdRent: 650 },
        employment: { employmentStatus: 'unemployed' },
        income: { grossMonthlyIncome: 0 },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        benefits: { receivingBuergergeld: true, daysInGermany: 900 },
        migration: { residencyStatus: 'permanent-resident' },
      },
      completeness: { score: 85, missingDomains: [] },
    }),
    expectedPrimary: 'situation_stable',
  },
  {
    id: 'F10',
    userContext: profile({
      domains: {
        housing: { city: 'Frankfurt', monthlyColdRent: 1400 },
        employment: { employmentStatus: 'employed', taxClass: 1 },
        income: { grossMonthlyIncome: 4500 },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        benefits: { daysInGermany: 1400 },
        migration: { residencyStatus: 'permanent-resident' },
      },
      completeness: { score: 95, missingDomains: [] },
    }),
    expectedPrimary: 'situation_stable',
  },
  {
    id: 'F11',
    userContext: profile({
      domains: {
        housing: { city: 'Stuttgart', monthlyColdRent: 1300 },
        employment: { employmentStatus: 'employed' },
        income: { grossMonthlyIncome: 4200 },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        household: { children: [{ age: 8 }, { age: 5 }] },
        benefits: { daysInGermany: 800, receivingWohngeld: false },
        migration: { residencyStatus: 'permanent-resident' },
      },
    }),
    expectedPrimary: 'benefits_exploration',
    expectedSecondaries: ['household_data_missing'],
  },
  {
    id: 'F12',
    userContext: profile({
      domains: {
        housing: { city: 'Leipzig' },
        migration: { residencyStatus: 'permanent-resident', arrivedAt: daysAgoIso(21) },
        employment: { employmentStatus: 'employed' },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        benefits: { daysInGermany: 900 },
      },
    }),
    expectedPrimary: 'arrival_unregistered',
    expectedSecondaries: ['re_registration_required'],
  },
  {
    id: 'F13',
    userContext: profile({
      domains: {
        housing: { city: 'Berlin' },
        migration: { residencyStatus: 'student-visa' },
        employment: { employmentStatus: 'student' },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        benefits: { daysInGermany: 400 },
      },
    }),
    expectedPrimary: 'economic_setup_pending',
    expectedSecondaries: ['insurance_gap', 'life_transition_pending'],
  },
  {
    id: 'F14',
    userContext: profile({
      domains: {
        housing: { city: 'Berlin' },
        migration: { residencyStatus: 'eu-citizen' },
        employment: { employmentStatus: 'self-employed' },
        income: { grossMonthlyIncome: 3500 },
        benefits: { daysInGermany: 200 },
      },
    }),
    expectedPrimary: 'insurance_gap',
  },
  {
    id: 'F15',
    userContext: profile({
      domains: {
        housing: { city: 'Munich', monthlyColdRent: 1500 },
        employment: { employmentStatus: 'employed' },
        income: { grossMonthlyIncome: 5000 },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        household: { children: [{ age: 0 }] },
        migration: { residencyStatus: 'permanent-resident' },
        benefits: { daysInGermany: 1000 },
      },
    }),
    expectedPrimary: 'situation_stable',
    expectedSecondaries: ['life_transition_pending', 'household_data_missing'],
  },
  {
    id: 'F16',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'employed' },
        income: { grossMonthlyIncome: 3000 },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        benefits: { daysInGermany: 700 },
        migration: { residencyStatus: 'permanent-resident' },
      },
    }),
    expectedPrimary: 'housing_instability',
    expectedSecondaries: ['registration_incomplete', 'life_transition_pending'],
  },
  {
    id: 'F17',
    userContext: profile({
      domains: {
        housing: { city: 'Berlin', monthlyColdRent: 1200 },
        employment: { employmentStatus: 'employed' },
        income: { grossMonthlyIncome: 4000 },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        migration: { residencyStatus: 'work-visa' },
        benefits: { daysInGermany: 1100 },
      },
    }),
    expectedPrimary: 'situation_stable',
    expectedSecondaries: ['life_transition_pending'],
  },
  {
    id: 'F18',
    userContext: profile({
      domains: {
        housing: { city: 'Bremen', monthlyColdRent: 850 },
        employment: { employmentStatus: 'part-time' },
        income: { grossMonthlyIncome: 1200 },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        benefits: { daysInGermany: 500, receivingWohngeld: false },
        migration: { residencyStatus: 'eu-citizen' },
      },
    }),
    expectedPrimary: 'benefits_exploration',
  },
  {
    id: 'F19',
    userContext: profile({
      domains: {
        housing: { city: 'Dresden', monthlyColdRent: 700 },
        employment: { employmentStatus: 'unemployed' },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        benefits: { receivingAlg1: true, daysInGermany: 1200 },
        migration: { residencyStatus: 'permanent-resident' },
      },
    }),
    expectedPrimary: 'benefits_exploration',
  },
  {
    id: 'F20',
    userContext: profile({
      domains: {
        housing: { city: 'Berlin' },
        migration: { residencyStatus: 'work-visa', arrivedAt: daysAgoIso(7) },
        employment: { employmentStatus: 'employed' },
        benefits: { daysInGermany: 7 },
      },
    }),
    expectedPrimary: 'arrival_unregistered',
    expectedSecondaries: ['insurance_gap', 'income_data_missing'],
  },
  {
    id: 'F21',
    userContext: profile({
      domains: {
        housing: { city: 'Hannover' },
        employment: { employmentStatus: 'employed' },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        migration: { residencyStatus: 'permanent-resident' },
        benefits: { daysInGermany: 800 },
      },
      completeness: { score: 80, missingDomains: [] },
    }),
    expectedPrimary: 'situation_stable',
    expectedSecondaries: ['housing_data_missing', 'income_data_missing'],
  },
  {
    id: 'F22',
    userContext: profile({
      domains: {
        housing: { city: 'Berlin', bundesland: 'BE' },
        migration: { residencyStatus: 'eu-citizen', arrivedAt: daysAgoIso(14) },
        benefits: { daysInGermany: 14 },
      },
    }),
    expectedPrimary: 'arrival_stabilizing',
    expectedSecondaries: ['insurance_gap', 'employment_data_missing', 'banking_not_established'],
  },
  {
    id: 'F23',
    userContext: profile({
      domains: {
        housing: { city: 'Munich', monthlyColdRent: 1300 },
        migration: { residencyStatus: 'permanent-resident' },
        employment: { employmentStatus: 'unemployed' },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        benefits: { daysInGermany: 900 },
      },
    }),
    expectedPrimary: 'economic_setup_pending',
    expectedSecondaries: ['income_data_missing', 'life_transition_pending'],
  },
  {
    id: 'F24',
    userContext: profile({
      domains: {
        housing: { city: 'Hamburg', monthlyColdRent: 1100 },
        employment: { employmentStatus: 'employed' },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        migration: { residencyStatus: 'permanent-resident' },
        benefits: { daysInGermany: 1000 },
      },
      completeness: { score: 78, missingDomains: [] },
    }),
    expectedPrimary: 'situation_stable',
    expectedSecondaries: ['income_data_missing'],
  },
];

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}
