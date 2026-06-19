import type { SimulatorGridInput } from '@arrival-atlas/shared-services';
import type { BenefitsSimulatorInput } from './schema.js';

export function adaptToSimulatorGridInput(
  input: BenefitsSimulatorInput
): SimulatorGridInput {
  return {
    taxYear: input.taxYear,
    baseline: {
      label: 'Current situation',
      household: {
        members: input.household.members,
        housing: input.household.housing,
        currentBenefits: input.household.currentBenefits,
      },
      employments: input.baselineEmployments,
    },
    scenarios: input.scenarios.map((scenario) => ({
      id: scenario.id,
      label: scenario.label,
      events: scenario.events,
    })),
    receivingBuergergeld: input.household.currentBenefits?.receivingBuergergeld,
  };
}
