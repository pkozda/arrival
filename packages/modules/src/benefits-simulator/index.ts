import type { Module, ModuleRegistration } from '@arrival-atlas/core';
import {
  BenefitsSimulatorInputSchema,
  BenefitsSimulatorOutputSchema,
  type BenefitsSimulatorInput,
  type BenefitsSimulatorOutput,
} from './schema.js';
import { runBenefitsSimulator } from './orchestrator.js';

export {
  BenefitsSimulatorInputSchema,
  BenefitsSimulatorOutputSchema,
  BENEFITS_SIMULATOR_SCHEMA_VERSION,
  type BenefitsSimulatorInput,
  type BenefitsSimulatorOutput,
} from './schema.js';

export const benefitsSimulatorModule: Module<
  BenefitsSimulatorInput,
  BenefitsSimulatorOutput
> = {
  id: 'benefits-simulator',
  name: 'Benefits Simulator',
  version: '1.0.0',
  description:
    'Life transition scenario simulator — unemployment, employment types, children, rent, and household changes',
  inputSchema: BenefitsSimulatorInputSchema,
  outputSchema: BenefitsSimulatorOutputSchema,

  async execute(input, _context): Promise<BenefitsSimulatorOutput> {
    return runBenefitsSimulator(input);
  },
};

export const benefitsSimulatorRegistration: ModuleRegistration = {
  ...benefitsSimulatorModule,
  enabled: true,
  featureFlags: {
    multiScenario: true,
  },
  module: benefitsSimulatorModule,
};
