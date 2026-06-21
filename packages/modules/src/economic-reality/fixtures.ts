import type {
  EconomicEvaluationV1,
  EconomicRuleId,
  EconomicStateId,
  EconomicSupportSystemId,
  UserContextV1,
  UserProfileViewV1,
} from '@arrival-atlas/product-contract';

export type EconomicFixture = {
  id: string;
  userContext: UserContextV1;
  expected: {
    economicState: EconomicStateId;
    supportSystem: EconomicSupportSystemId;
    winningRule: EconomicRuleId;
  };
};

function profile(
  partial: Partial<UserProfileViewV1> & { domains: UserProfileViewV1['domains'] }
): UserContextV1 {
  return {
    profile: {
      schemaVersion: '1.0.0',
      preferences: { preferredLanguage: 'en' },
      completeness: partial.completeness ?? { score: 50, missingDomains: [] },
      domains: partial.domains,
    },
  };
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const ECONOMIC_FIXTURES: EconomicFixture[] = [
  {
    id: 'EF01',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'employed' },
        income: { grossMonthlyIncome: 3200 },
        benefits: {
          receivingBuergergeld: false,
          receivingSozialamtSupport: false,
        },
        migration: { residencyStatus: 'permanent-resident' },
        housing: { city: 'Berlin' },
      },
    }),
    expected: {
      economicState: 'self_sustained',
      supportSystem: 'none',
      winningRule: 'R6',
    },
  },
  {
    id: 'EF02',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'part-time' },
        income: { grossMonthlyIncome: 520 },
        benefits: { receivingBuergergeld: false },
        housing: { city: 'Berlin' },
        migration: { residencyStatus: 'eu-citizen' },
      },
    }),
    expected: {
      economicState: 'employment_active',
      supportSystem: 'none',
      winningRule: 'R6',
    },
  },
  {
    id: 'EF03',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'unemployed' },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        housing: { city: 'Munich', monthlyColdRent: 1200 },
        migration: { residencyStatus: 'permanent-resident' },
        benefits: {
          receivingBuergergeld: false,
          receivingSozialamtSupport: false,
          daysInGermany: 800,
        },
      },
    }),
    expected: {
      economicState: 'unemployment_transition',
      supportSystem: 'none',
      winningRule: 'R5',
    },
  },
  {
    id: 'EF04',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'unemployed' },
        housing: { city: 'Munich' },
        migration: { residencyStatus: 'permanent-resident' },
        benefits: {
          receivingBuergergeld: false,
          supportApplicationPending: 'jobcenter',
          daysInGermany: 800,
        },
      },
    }),
    expected: {
      economicState: 'application_pending',
      supportSystem: 'pending',
      winningRule: 'R2',
    },
  },
  {
    id: 'EF05',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'unemployed' },
        housing: { city: 'Hamburg' },
        migration: { residencyStatus: 'permanent-resident' },
        benefits: {
          receivingBuergergeld: true,
          receivingSozialamtSupport: false,
          daysInGermany: 900,
        },
      },
    }),
    expected: {
      economicState: 'benefits_jobcenter',
      supportSystem: 'jobcenter',
      winningRule: 'R4',
    },
  },
  {
    id: 'EF06',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'unemployed' },
        housing: { city: 'Hamburg' },
        migration: { residencyStatus: 'permanent-resident' },
        benefits: {
          receivingBuergergeld: true,
          benefitReportingOverdue: true,
          daysInGermany: 900,
        },
      },
    }),
    expected: {
      economicState: 'benefits_jobcenter',
      supportSystem: 'jobcenter',
      winningRule: 'R4',
    },
  },
  {
    id: 'EF07',
    userContext: profile({
      domains: {
        migration: { residencyStatus: 'tourist', arrivedAt: daysAgoIso(5) },
        benefits: { daysInGermany: 5 },
        employment: { employmentStatus: 'unemployed' },
      },
      completeness: { score: 10, missingDomains: ['housing', 'income'] },
    }),
    expected: {
      economicState: 'financial_crisis',
      supportSystem: 'none',
      winningRule: 'R1',
    },
  },
  {
    id: 'EF08',
    userContext: profile({
      domains: {
        migration: {
          residencyStatus: 'temporary-resident',
          countryOfOrigin: 'UA',
          arrivedAt: daysAgoIso(120),
        },
        housing: { city: 'Berlin' },
        employment: { employmentStatus: 'unemployed' },
        benefits: {
          receivingSozialamtSupport: true,
          receivingBuergergeld: false,
          daysInGermany: 120,
        },
      },
    }),
    expected: {
      economicState: 'benefits_sozialamt',
      supportSystem: 'sozialamt',
      winningRule: 'R3',
    },
  },
  {
    id: 'EF09',
    userContext: profile({
      domains: {
        migration: { residencyStatus: 'asylum-seeker', arrivedAt: daysAgoIso(30) },
        housing: { city: 'Brandenburg' },
        employment: { employmentStatus: 'unemployed' },
        benefits: {
          receivingSozialamtSupport: true,
          daysInGermany: 30,
        },
      },
    }),
    expected: {
      economicState: 'benefits_sozialamt',
      supportSystem: 'sozialamt',
      winningRule: 'R3',
    },
  },
  {
    id: 'EF10',
    userContext: profile({
      domains: {
        migration: {
          residencyStatus: 'temporary-resident',
          countryOfOrigin: 'UA',
          arrivedAt: daysAgoIso(400),
        },
        housing: { city: 'Cologne' },
        employment: { employmentStatus: 'unemployed' },
        benefits: {
          receivingSozialamtSupport: false,
          receivingBuergergeld: false,
          supportApplicationPending: 'jobcenter',
          daysInGermany: 400,
        },
      },
    }),
    expected: {
      economicState: 'application_pending',
      supportSystem: 'pending',
      winningRule: 'R2',
    },
  },
  {
    id: 'EF11',
    userContext: profile({
      domains: {
        migration: { residencyStatus: 'unknown' },
        employment: { employmentStatus: 'unemployed' },
        benefits: { savingsDepleted: true, daysInGermany: 60 },
      },
      completeness: { score: 20, missingDomains: ['housing', 'income'] },
    }),
    expected: {
      economicState: 'financial_crisis',
      supportSystem: 'none',
      winningRule: 'R1',
    },
  },
  {
    id: 'EF12',
    userContext: profile({
      domains: {
        housing: { city: 'Leipzig', monthlyColdRent: 700 },
        migration: { residencyStatus: 'permanent-resident' },
        employment: { employmentStatus: 'unemployed' },
        income: { grossMonthlyIncome: 0 },
        healthInsurance: { insuranceType: 'public', hasCoverage: true },
        benefits: {
          receivingBuergergeld: false,
          receivingSozialamtSupport: false,
          daysInGermany: 700,
        },
      },
    }),
    expected: {
      economicState: 'unemployment_transition',
      supportSystem: 'none',
      winningRule: 'R5',
    },
  },
  {
    id: 'EF13',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'employed' },
        income: { grossMonthlyIncome: 2800 },
        housing: { city: 'Stuttgart' },
        migration: { residencyStatus: 'permanent-resident' },
        benefits: {
          receivingBuergergeld: true,
          daysInGermany: 1000,
        },
      },
    }),
    expected: {
      economicState: 'benefits_jobcenter',
      supportSystem: 'jobcenter',
      winningRule: 'R4',
    },
  },
  {
    id: 'EF14',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'employed' },
        income: { grossMonthlyIncome: 2100 },
        housing: { city: 'Frankfurt' },
        migration: { residencyStatus: 'work-visa' },
        benefits: {
          receivingBuergergeld: true,
          daysInGermany: 500,
        },
      },
    }),
    expected: {
      economicState: 'benefits_jobcenter',
      supportSystem: 'jobcenter',
      winningRule: 'R4',
    },
  },
  {
    id: 'EF15',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'self-employed' },
        income: { grossMonthlyIncome: 1800 },
        housing: { city: 'Hamburg' },
        migration: { residencyStatus: 'permanent-resident' },
        benefits: {
          receivingBuergergeld: false,
          receivingSozialamtSupport: false,
        },
      },
    }),
    expected: {
      economicState: 'self_sustained',
      supportSystem: 'none',
      winningRule: 'R6',
    },
  },
  {
    id: 'EF16',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'student' },
        housing: { city: 'Berlin' },
        migration: { residencyStatus: 'student-visa' },
        benefits: {
          receivingBuergergeld: false,
          daysInGermany: 200,
        },
      },
    }),
    expected: {
      economicState: 'self_sustained',
      supportSystem: 'none',
      winningRule: 'R6',
    },
  },
  {
    id: 'EF17',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'unemployed' },
        housing: { city: 'Dresden' },
        migration: { residencyStatus: 'permanent-resident' },
        benefits: {
          receivingBuergergeld: false,
          savingsDepleted: true,
          daysInGermany: 600,
        },
      },
    }),
    expected: {
      economicState: 'financial_crisis',
      supportSystem: 'none',
      winningRule: 'R1',
    },
  },
  {
    id: 'EF18',
    userContext: profile({
      domains: {
        migration: { residencyStatus: 'asylum-seeker' },
        housing: { city: 'Bremen' },
        employment: { employmentStatus: 'unemployed' },
        benefits: {
          receivingSozialamtSupport: false,
          supportApplicationPending: 'sozialamt',
          daysInGermany: 45,
        },
      },
    }),
    expected: {
      economicState: 'application_pending',
      supportSystem: 'pending',
      winningRule: 'R2',
    },
  },
  {
    id: 'EF19',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'employed' },
        income: { grossMonthlyIncome: 1900 },
        housing: { city: 'Cologne', monthlyColdRent: 1100 },
        migration: { residencyStatus: 'eu-citizen' },
        benefits: {
          receivingBuergergeld: false,
          receivingWohngeld: false,
          daysInGermany: 800,
        },
      },
    }),
    expected: {
      economicState: 'self_sustained',
      supportSystem: 'none',
      winningRule: 'R6',
    },
  },
  {
    id: 'EF20',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'unemployed' },
        housing: { city: 'Berlin' },
        migration: { residencyStatus: 'temporary-resident' },
        benefits: {
          receivingBuergergeld: false,
          receivingSozialamtSupport: false,
          savingsDepleted: true,
          daysInGermany: 20,
        },
      },
      completeness: { score: 25, missingDomains: ['income'] },
    }),
    expected: {
      economicState: 'financial_crisis',
      supportSystem: 'none',
      winningRule: 'R1',
    },
  },
  {
    id: 'EF21',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'unemployed' },
        housing: { city: 'Berlin', monthlyColdRent: 850 },
        migration: { residencyStatus: 'permanent-resident' },
        benefits: {
          receivingBuergergeld: true,
          daysInGermany: 1200,
        },
      },
    }),
    expected: {
      economicState: 'benefits_jobcenter',
      supportSystem: 'jobcenter',
      winningRule: 'R4',
    },
  },
  {
    id: 'EF22',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'part-time' },
        income: { grossMonthlyIncome: 900 },
        housing: { city: 'Bonn' },
        migration: { residencyStatus: 'eu-citizen' },
        benefits: {
          receivingBuergergeld: true,
          daysInGermany: 900,
        },
      },
    }),
    expected: {
      economicState: 'benefits_jobcenter',
      supportSystem: 'jobcenter',
      winningRule: 'R4',
    },
  },
  {
    id: 'EF23',
    userContext: profile({
      domains: {
        employment: { employmentStatus: 'unemployed' },
        housing: { city: 'Hannover' },
        migration: { residencyStatus: 'permanent-resident', countryOfOrigin: 'UA' },
        benefits: {
          receivingBuergergeld: false,
          receivingSozialamtSupport: false,
          daysInGermany: 500,
        },
      },
    }),
    expected: {
      economicState: 'unemployment_transition',
      supportSystem: 'none',
      winningRule: 'R5',
    },
  },
  {
    id: 'EF24',
    userContext: profile({
      domains: {
        housing: { city: 'Berlin' },
        migration: { residencyStatus: 'permanent-resident' },
        employment: { employmentStatus: 'unemployed' },
        benefits: {
          benefitApplicationIntent: true,
          daysInGermany: 400,
        },
      },
      completeness: { score: 35, missingDomains: ['income'] },
    }),
    expected: {
      economicState: 'application_pending',
      supportSystem: 'none',
      winningRule: 'R2',
    },
  },
  {
    id: 'EF_R7_FALLBACK',
    userContext: profile({
      domains: {
        housing: { city: 'Berlin' },
        migration: { residencyStatus: 'permanent-resident' },
        income: { grossMonthlyIncome: 400 },
        benefits: {
          receivingBuergergeld: false,
          receivingSozialamtSupport: false,
          daysInGermany: 400,
        },
      },
    }),
    expected: {
      economicState: 'unemployment_transition',
      supportSystem: 'none',
      winningRule: 'R7',
    },
  },
];

export function pickEconomicFixtureSummary(evaluation: EconomicEvaluationV1) {
  const winning = evaluation.appliedRules.find((rule) => rule.matched);
  return {
    economicState: evaluation.economicState,
    supportSystem: evaluation.supportSystem,
    winningRule: winning?.id,
  };
}
