import type { LifeStateId } from '@/lib/product-contract';
import type { ScenarioContext, ScenarioDefinition } from './scenario-types';
import { detectActiveTriggers, triggersSatisfy } from './scenario-signals';

function fromStatesInclude(fromStates: LifeStateId[] | '*', current: LifeStateId): boolean {
  return fromStates === '*' || fromStates.includes(current);
}

export const SCENARIO_REGISTRY: readonly ScenarioDefinition[] = [
  {
    id: 'job_loss',
    triggers: ['employment_unemployed', 'economic_setup_pending', 'employment_data_missing'],
    fromStates: [
      'arrival_stabilizing',
      'situation_stable',
      'benefits_exploration',
      'housing_instability',
      'insurance_gap',
      'economic_setup_pending',
    ],
    toState: 'economic_setup_pending',
    priority: 90,
    reasoningTemplate: () =>
      'Losing employment shifts your situation toward economic setup — income, insurance, and benefits need reassessment.',
    matches: (context) => {
      const active = detectActiveTriggers(context);
      return (
        triggersSatisfy(['employment_unemployed'], active) ||
        (triggersSatisfy(['economic_setup_pending', 'employment_data_missing'], active) &&
          context.userContext.profile?.domains.employment?.employmentStatus === 'unemployed')
      );
    },
  },
  {
    id: 'new_arrival',
    triggers: ['registration_incomplete', 'recent_arrival_signal'],
    fromStates: ['arrival_unregistered', 'arrival_stabilizing'],
    toState: 'arrival_unregistered',
    priority: 85,
    reasoningTemplate: () =>
      'A recent arrival without completed registration places you in the unregistered arrival state.',
    matches: (context) => {
      const active = detectActiveTriggers(context);
      return (
        context.currentState === 'arrival_unregistered' ||
        (triggersSatisfy(['registration_incomplete', 'recent_arrival_signal'], active) &&
          triggersSatisfy(['registration_incomplete'], active))
      );
    },
  },
  {
    id: 'housing_change',
    triggers: ['housing_search_active', 're_registration_required', 'housing_data_missing'],
    fromStates: [
      'arrival_stabilizing',
      'economic_setup_pending',
      'situation_stable',
      'benefits_exploration',
    ],
    toState: 'housing_instability',
    priority: 80,
    reasoningTemplate: () =>
      'An active housing change or incomplete housing data moves your situation toward housing instability.',
    matches: (context) => {
      const active = detectActiveTriggers(context);
      return triggersSatisfy(
        ['housing_search_active', 're_registration_required', 'housing_data_missing'],
        active
      );
    },
  },
  {
    id: 'insurance_loss',
    triggers: ['insurance_gap'],
    fromStates: [
      'arrival_stabilizing',
      'economic_setup_pending',
      'situation_stable',
      'benefits_exploration',
      'housing_instability',
      'insurance_gap',
    ],
    toState: 'insurance_gap',
    priority: 88,
    reasoningTemplate: () =>
      'Missing or lost health insurance coverage creates an insurance gap that needs immediate attention.',
    matches: (context) => {
      const active = detectActiveTriggers(context);
      return triggersSatisfy(['insurance_gap'], active);
    },
  },
  {
    id: 'income_drop',
    triggers: ['income_data_missing', 'economic_setup_pending'],
    fromStates: ['arrival_stabilizing', 'situation_stable', 'benefits_exploration'],
    toState: 'economic_setup_pending',
    priority: 70,
    reasoningTemplate: () =>
      'A significant income reduction signals that your economic setup may need to be revisited.',
    matches: (context) => {
      const active = detectActiveTriggers(context);
      const employed = context.userContext.profile?.domains.employment?.employmentStatus;
      return (
        triggersSatisfy(['income_data_missing'], active) &&
        employed !== 'unemployed' &&
        employed !== undefined
      );
    },
  },
  {
    id: 'benefits_trigger',
    triggers: ['benefits_data_missing', 'employment_unemployed', 'economic_setup_pending'],
    fromStates: [
      'arrival_stabilizing',
      'economic_setup_pending',
      'housing_instability',
      'situation_stable',
    ],
    toState: 'benefits_exploration',
    priority: 75,
    reasoningTemplate: () =>
      'Changes in employment or missing benefits data suggest exploring available support options.',
    matches: (context) => {
      const active = detectActiveTriggers(context);
      return (
        triggersSatisfy(['benefits_data_missing'], active) &&
        triggersSatisfy(['employment_unemployed', 'economic_setup_pending'], active)
      );
    },
  },
  {
    id: 'stability_restore',
    triggers: ['stability_signal'],
    fromStates: [
      'arrival_stabilizing',
      'economic_setup_pending',
      'benefits_exploration',
      'housing_instability',
      'insurance_gap',
    ],
    toState: 'situation_stable',
    priority: 50,
    reasoningTemplate: () =>
      'Core situation signals are in place — your profile is trending toward a stable state.',
    matches: (context) => {
      const active = detectActiveTriggers(context);
      return triggersSatisfy(['stability_signal'], active);
    },
  },
] as const;

export function getScenarioDefinition(id: string): ScenarioDefinition | undefined {
  return SCENARIO_REGISTRY.find((entry) => entry.id === id);
}

export function scenarioAppliesToState(definition: ScenarioDefinition, currentState: LifeStateId): boolean {
  return fromStatesInclude(definition.fromStates, currentState);
}

export function countMatchedTriggers(
  definition: ScenarioDefinition,
  context: ScenarioContext
): number {
  const active = detectActiveTriggers(context);
  return definition.triggers.filter((trigger) => active.has(trigger)).length;
}
