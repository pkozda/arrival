import type { LifeActionRef } from '@arrival-atlas/product-contract';
import type { LifeEventGraphDefinition } from './types.js';

const profileHousing: LifeActionRef = {
  kind: 'correct_in_profile',
  profileMirrorSlug: 'where-you-live',
  href: '/profile/where-you-live/edit',
  label: 'Update housing details',
};

const profileMigration: LifeActionRef = {
  kind: 'correct_in_profile',
  profileMirrorSlug: 'move-to-germany',
  href: '/profile/move-to-germany/edit',
  label: 'Update arrival details',
};

const profileEmployment: LifeActionRef = {
  kind: 'correct_in_profile',
  profileMirrorSlug: 'work-income',
  href: '/profile/work-income/edit',
  label: 'Update work and income',
};

const profileInsurance: LifeActionRef = {
  kind: 'correct_in_profile',
  profileMirrorSlug: 'health-insurance',
  href: '/profile/health-insurance/edit',
  label: 'Update health insurance',
};

const profileBenefits: LifeActionRef = {
  kind: 'correct_in_profile',
  profileMirrorSlug: 'benefits-support',
  href: '/profile/benefits-support/edit',
  label: 'Update benefits information',
};

const profileHousehold: LifeActionRef = {
  kind: 'correct_in_profile',
  profileMirrorSlug: 'household-family',
  href: '/profile/household-family/edit',
  label: 'Update household details',
};

const healthcareModule: LifeActionRef = {
  kind: 'open_module',
  moduleId: 'healthcare-navigation',
  href: '/modules/healthcare-navigation',
  label: 'Explore health insurance options',
};

const benefitsModule: LifeActionRef = {
  kind: 'open_module',
  moduleId: 'benefits-simulator',
  href: '/modules/benefits-simulator',
  label: 'Explore benefits support',
};

const economicRealityModule: LifeActionRef = {
  kind: 'open_module',
  moduleId: 'economic-reality',
  href: '/modules/economic-reality',
  label: 'Open Economic Reality plan',
};

const arrivalScenario: LifeActionRef = {
  kind: 'explore_scenario',
  scenarioEvent: 'arrival',
  href: '/modules/life-event?event=arrival',
  label: 'Explore arrival guidance',
};

const jobLossScenario: LifeActionRef = {
  kind: 'explore_scenario',
  scenarioEvent: 'job-loss',
  href: '/modules/life-event?event=job-loss',
  label: 'Explore job loss guidance',
};

const moveCityScenario: LifeActionRef = {
  kind: 'explore_scenario',
  scenarioEvent: 'move-city',
  href: '/modules/life-event?event=move-city',
  label: 'Explore moving cities',
};

const visaScenario: LifeActionRef = {
  kind: 'explore_scenario',
  scenarioEvent: 'visa-renewal',
  href: '/modules/life-event?event=visa-renewal',
  label: 'Explore visa renewal',
};

const childbirthScenario: LifeActionRef = {
  kind: 'explore_scenario',
  scenarioEvent: 'childbirth',
  href: '/modules/life-event?event=childbirth',
  label: 'Explore family guidance',
};

export const GRAPH_CATALOG_V1: LifeEventGraphDefinition[] = [
  {
    graphId: 'G1',
    lifeStateId: 'arrival_unregistered',
    intent: 'Establish legal presence through registration',
    nodes: [
      {
        id: 'g1-secure-address',
        title: 'Secure a registrable address',
        description:
          'Confirm where you can legally register and obtain landlord confirmation if required.',
        category: 'legal',
        priority: 'critical',
        phase: 1,
        rationale: 'Anmeldung requires a valid address — housing and registration are coupled.',
        satisfactionKey: 'registrable_address',
        blockedByNodeIds: [],
        actions: [profileHousing, moveCityScenario, economicRealityModule],
      },
      {
        id: 'g1-complete-anmeldung',
        title: 'Complete Anmeldung',
        description:
          'Book a Bürgeramt appointment and register your address within the legal deadline.',
        category: 'legal',
        priority: 'critical',
        phase: 2,
        rationale: 'Registration unlocks tax ID, insurance paths, and employment formalities.',
        satisfactionKey: 'municipal_registration',
        blockedByNodeIds: ['g1-secure-address'],
        actions: [arrivalScenario, profileMigration],
      },
      {
        id: 'g1-insurance-awareness',
        title: 'Understand mandatory health insurance',
        description:
          'Learn your insurance obligation and begin enrollment if employment is not imminent.',
        category: 'survival',
        priority: 'high',
        phase: 3,
        rationale: 'Health insurance is mandatory in Germany.',
        satisfactionKey: 'insurance_coverage',
        blockedByNodeIds: [],
        actions: [healthcareModule, profileInsurance],
      },
      {
        id: 'g1-banking-tax',
        title: 'Set up banking and tax path',
        description:
          'Open a bank account for rent and salary; expect your tax ID after registration.',
        category: 'stabilization',
        priority: 'medium',
        phase: 4,
        rationale: 'Financial infrastructure supports housing and employment next steps.',
        satisfactionKey: 'banking_ready',
        blockedByNodeIds: ['g1-complete-anmeldung'],
        actions: [economicRealityModule, profileHousing],
      },
    ],
  },
  {
    graphId: 'G2',
    lifeStateId: 'arrival_stabilizing',
    intent: 'Order early settlement across survival domains',
    nodes: [
      {
        id: 'g2-confirm-registration',
        title: 'Confirm registration is complete',
        description: 'Verify your Anmeldung and update your situation after any recent move.',
        category: 'legal',
        priority: 'high',
        phase: 1,
        rationale: 'Confirm foundation before stacking other settlement tasks.',
        satisfactionKey: 'municipal_registration',
        blockedByNodeIds: [],
        actions: [profileMigration, profileHousing],
      },
      {
        id: 'g2-enroll-insurance',
        title: 'Enroll in health insurance',
        description:
          'Choose statutory or private coverage and complete Krankenkasse enrollment.',
        category: 'survival',
        priority: 'critical',
        phase: 2,
        rationale: 'Mandatory coverage is the highest survival priority after registration.',
        satisfactionKey: 'insurance_coverage',
        blockedByNodeIds: [],
        actions: [healthcareModule, profileInsurance],
      },
      {
        id: 'g2-economic-path',
        title: 'Clarify employment and income path',
        description: 'Record employment status or start your job search with clear next steps.',
        category: 'survival',
        priority: 'high',
        phase: 3,
        rationale: 'Income unlocks sustainable settlement.',
        satisfactionKey: 'employment_basis',
        blockedByNodeIds: [],
        actions: [economicRealityModule, profileEmployment, arrivalScenario],
      },
      {
        id: 'g2-housing-banking',
        title: 'Confirm housing and banking',
        description: 'Record rent and housing details and open a suitable bank account.',
        category: 'stabilization',
        priority: 'medium',
        phase: 4,
        rationale: 'Physical and financial base for daily life.',
        satisfactionKey: 'banking_ready',
        blockedByNodeIds: [],
        actions: [profileHousing, economicRealityModule],
      },
      {
        id: 'g2-benefits-awareness',
        title: 'Check if support programs may apply',
        description:
          'If income is low or uncertain, explore whether state support is relevant.',
        category: 'optimization',
        priority: 'low',
        phase: 5,
        rationale: 'Benefits exploration follows economic clarity.',
        satisfactionKey: 'benefits_assessed',
        blockedByNodeIds: ['g2-economic-path'],
        actions: [benefitsModule, profileBenefits],
      },
    ],
  },
  {
    graphId: 'G3',
    lifeStateId: 'economic_setup_pending',
    intent: 'Establish employment and income foundation',
    nodes: [
      {
        id: 'g3-stabilize-employment',
        title: 'Stabilize employment situation',
        description:
          'Register with Agentur für Arbeit if unemployed and clarify job search obligations.',
        category: 'survival',
        priority: 'critical',
        phase: 1,
        rationale: 'Employment status drives insurance, benefits, and daily income.',
        satisfactionKey: 'employment_basis',
        blockedByNodeIds: [],
        actions: [economicRealityModule, profileEmployment, jobLossScenario],
      },
      {
        id: 'g3-insurance-continuity',
        title: 'Maintain insurance continuity',
        description: 'Prevent or close a health insurance gap during your job transition.',
        category: 'legal',
        priority: 'critical',
        phase: 2,
        rationale: 'Mandatory insurance must not lapse between jobs.',
        satisfactionKey: 'insurance_coverage',
        blockedByNodeIds: [],
        actions: [healthcareModule, profileInsurance],
      },
      {
        id: 'g3-income-clarity',
        title: 'Clarify income basis',
        description: 'Record or estimate income to support budgeting and benefits assessment.',
        category: 'survival',
        priority: 'high',
        phase: 3,
        rationale: 'Income clarity unlocks downstream planning.',
        satisfactionKey: 'income_recorded',
        blockedByNodeIds: ['g3-stabilize-employment'],
        actions: [economicRealityModule, profileEmployment],
      },
      {
        id: 'g3-benefits-pathway',
        title: 'Explore support if income is insufficient',
        description: 'Assess Bürgergeld, ALG I, or bridging support if income is not enough.',
        category: 'stabilization',
        priority: 'medium',
        phase: 4,
        rationale: 'Support may be available after economic clarity.',
        satisfactionKey: 'benefits_assessed',
        blockedByNodeIds: ['g3-income-clarity'],
        actions: [benefitsModule, profileBenefits, economicRealityModule],
      },
    ],
  },
  {
    graphId: 'G4',
    lifeStateId: 'housing_instability',
    intent: 'Stabilize housing and registrable address',
    nodes: [
      {
        id: 'g4-clarify-housing',
        title: 'Clarify your living situation',
        description: 'Determine whether your current housing is temporary or long-term.',
        category: 'survival',
        priority: 'critical',
        phase: 1,
        rationale: 'Admin planning requires a clear housing picture.',
        satisfactionKey: 'stable_housing',
        blockedByNodeIds: [],
        actions: [profileHousing, moveCityScenario],
      },
      {
        id: 'g4-secure-housing',
        title: 'Secure registrable housing',
        description: 'Find housing with a valid lease and landlord confirmation for registration.',
        category: 'survival',
        priority: 'critical',
        phase: 2,
        rationale: 'A registrable address unlocks Anmeldung and benefits.',
        satisfactionKey: 'stable_housing',
        blockedByNodeIds: ['g4-clarify-housing'],
        actions: [economicRealityModule, profileHousing],
      },
      {
        id: 'g4-register-address',
        title: 'Register at your address',
        description: 'Complete Anmeldung or Ummeldung at your current address.',
        category: 'legal',
        priority: 'high',
        phase: 3,
        rationale: 'Legal address is required for most downstream admin.',
        satisfactionKey: 'municipal_registration',
        blockedByNodeIds: ['g4-secure-housing'],
        actions: [moveCityScenario, profileMigration],
      },
      {
        id: 'g4-record-rent',
        title: 'Record rent and housing costs',
        description: 'Add rent details so benefits and budgeting estimates can be accurate.',
        category: 'stabilization',
        priority: 'medium',
        phase: 4,
        rationale: 'Rent affects Wohngeld and affordability planning.',
        satisfactionKey: 'housing_rent_recorded',
        blockedByNodeIds: [],
        actions: [profileHousing, benefitsModule],
      },
    ],
  },
  {
    graphId: 'G5',
    lifeStateId: 'insurance_gap',
    intent: 'Secure continuous mandatory health coverage',
    nodes: [
      {
        id: 'g5-assess-coverage',
        title: 'Assess your coverage status',
        description: 'Determine whether you are currently insured and identify any gap.',
        category: 'legal',
        priority: 'critical',
        phase: 1,
        rationale: 'You cannot close a gap without knowing it exists.',
        satisfactionKey: 'insurance_coverage',
        blockedByNodeIds: [],
        actions: [healthcareModule, profileInsurance],
      },
      {
        id: 'g5-choose-path',
        title: 'Choose your insurance path',
        description: 'Select the correct statutory or private path based on your status.',
        category: 'legal',
        priority: 'critical',
        phase: 2,
        rationale: 'The enrollment path depends on employment and residency status.',
        satisfactionKey: 'insurance_coverage',
        blockedByNodeIds: ['g5-assess-coverage'],
        actions: [healthcareModule, economicRealityModule],
      },
      {
        id: 'g5-enroll-restore',
        title: 'Enroll or restore coverage',
        description: 'Contact Krankenkasse and complete enrollment without leaving a gap.',
        category: 'survival',
        priority: 'critical',
        phase: 3,
        rationale: 'Mandatory coverage closes legal and financial risk.',
        satisfactionKey: 'insurance_coverage',
        blockedByNodeIds: ['g5-choose-path'],
        actions: [healthcareModule, profileInsurance],
      },
      {
        id: 'g5-family-coverage',
        title: 'Confirm family coverage rules',
        description: 'If you have dependents, confirm how family insurance applies.',
        category: 'stabilization',
        priority: 'medium',
        phase: 4,
        rationale: 'Family members may need separate or joint coverage steps.',
        satisfactionKey: 'insurance_coverage',
        blockedByNodeIds: [],
        actions: [profileHousehold, profileInsurance],
      },
    ],
  },
  {
    graphId: 'G6',
    lifeStateId: 'benefits_exploration',
    intent: 'Assess and navigate state support options',
    nodes: [
      {
        id: 'g6-complete-inputs',
        title: 'Complete assessment inputs',
        description: 'Ensure income, rent, and household details are recorded.',
        category: 'survival',
        priority: 'high',
        phase: 1,
        rationale: 'Benefits estimates require complete situation inputs.',
        satisfactionKey: 'income_recorded',
        blockedByNodeIds: [],
        actions: [profileEmployment, profileHousing, profileHousehold],
      },
      {
        id: 'g6-identify-programs',
        title: 'Identify relevant support programs',
        description: 'Explore which of Bürgergeld, ALG I, Wohngeld, or Kindergeld may apply.',
        category: 'stabilization',
        priority: 'medium',
        phase: 2,
        rationale: 'Programs have different gates — map options before acting.',
        satisfactionKey: 'benefits_assessed',
        blockedByNodeIds: ['g6-complete-inputs'],
        actions: [benefitsModule, profileBenefits],
      },
      {
        id: 'g6-understand-obligations',
        title: 'Understand obligations and trade-offs',
        description: 'Learn reporting duties and how part-time work interacts with support.',
        category: 'stabilization',
        priority: 'medium',
        phase: 3,
        rationale: 'Support comes with rules the user should understand.',
        satisfactionKey: 'benefits_assessed',
        blockedByNodeIds: ['g6-identify-programs'],
        actions: [benefitsModule, jobLossScenario],
      },
      {
        id: 'g6-application-path',
        title: 'Plan your application pathway',
        description: 'Identify the right office and documents for your situation.',
        category: 'optimization',
        priority: 'low',
        phase: 4,
        rationale: 'Exploration becomes action when the user is ready to apply.',
        satisfactionKey: 'benefits_assessed',
        blockedByNodeIds: [],
        actions: [benefitsModule],
      },
    ],
  },
  {
    graphId: 'G7',
    lifeStateId: 'situation_stable',
    intent: 'Maintain stability and prepare for life transitions',
    nodes: [
      {
        id: 'g7-review-foundation',
        title: 'Review that your situation is current',
        description: 'Confirm registration, insurance, work, and housing details are still accurate.',
        category: 'stabilization',
        priority: 'low',
        phase: 1,
        rationale: 'Stability requires accurate situation facts.',
        satisfactionKey: 'foundation_reviewed',
        blockedByNodeIds: [],
        actions: [profileMigration, profileInsurance, profileEmployment, profileHousing],
      },
      {
        id: 'g7-life-transitions',
        title: 'Prepare for upcoming life changes',
        description: 'Explore guidance for job changes, moves, family events, or visa renewal.',
        category: 'life_transition',
        priority: 'medium',
        phase: 2,
        rationale: 'Stable users benefit from proactive transition planning.',
        satisfactionKey: 'transition_explored',
        blockedByNodeIds: [],
        actions: [jobLossScenario, moveCityScenario, childbirthScenario, visaScenario],
      },
      {
        id: 'g7-optimization',
        title: 'Optimize finances and integration',
        description: 'Review tax class, language goals, or financial planning when ready.',
        category: 'optimization',
        priority: 'low',
        phase: 3,
        rationale: 'Value-add steps without manufactured urgency.',
        satisfactionKey: 'transition_explored',
        blockedByNodeIds: [],
        actions: [economicRealityModule],
      },
    ],
  },
];

const graphByState = new Map(GRAPH_CATALOG_V1.map((graph) => [graph.lifeStateId, graph]));

export function getGraphForState(lifeStateId: LifeEventGraphDefinition['lifeStateId']) {
  const graph = graphByState.get(lifeStateId);
  if (!graph) {
    throw new Error(`No graph catalog entry for life state: ${lifeStateId}`);
  }
  return graph;
}

export function getAllGraphs(): LifeEventGraphDefinition[] {
  return GRAPH_CATALOG_V1;
}
