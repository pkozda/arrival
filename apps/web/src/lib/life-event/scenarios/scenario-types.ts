import type {
  LifeEventPlanV1,
  LifeStateId,
  SecondaryConditionId,
  UserContextV1,
} from '@/lib/product-contract';

export const SCENARIO_IDS = [
  'job_loss',
  'new_arrival',
  'housing_change',
  'insurance_loss',
  'income_drop',
  'benefits_trigger',
  'stability_restore',
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];

export type ScenarioTrigger =
  | 'employment_unemployed'
  | 'employment_data_missing'
  | 'income_data_missing'
  | 'registration_incomplete'
  | 'housing_search_active'
  | 're_registration_required'
  | 'insurance_gap'
  | 'housing_data_missing'
  | 'benefits_data_missing'
  | 'economic_setup_pending'
  | 'life_transition_pending'
  | 'recent_arrival_signal'
  | 'stability_signal';

export type ScenarioTransitionType = 'hard' | 'soft' | 'none';

export type ScenarioContext = {
  userContext: UserContextV1;
  currentState: LifeStateId;
  secondaryConditions: SecondaryConditionId[];
};

export type ScenarioTransition = {
  fromState: LifeStateId;
  toState: LifeStateId;
  transitionType: ScenarioTransitionType;
};

export type ScenarioDefinition = {
  id: ScenarioId;
  triggers: ScenarioTrigger[];
  fromStates: LifeStateId[] | '*';
  toState: LifeStateId;
  priority: number;
  reasoningTemplate: (context: ScenarioContext) => string;
  matches: (context: ScenarioContext) => boolean;
};

export type ScenarioMatchV1 = {
  scenarioId: ScenarioId;
  fromState: LifeStateId;
  toState: LifeStateId;
  confidence: number;
  reasoning: string;
  transitionType: ScenarioTransitionType;
};

export type ScenarioPlanHintsV1 = {
  suggestedStateShift?: LifeStateId;
  explanation: string;
  confidence: number;
};

export type ResolveScenarioInput = {
  userContext: UserContextV1;
  currentPlan: Pick<LifeEventPlanV1, 'currentLifeState' | 'secondaryConditions'>;
};
