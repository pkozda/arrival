export {
  financialRealityModule,
  financialRealityRegistration,
  FinancialRealityInputSchema,
  FinancialRealityOutputSchema,
} from './financial-reality/index.js';

export {
  systemTranslationModule,
  systemTranslationRegistration,
  SystemTranslationInputSchema,
  SystemTranslationOutputSchema,
} from './system-translation/index.js';

export {
  healthcareNavigationModule,
  healthcareNavigationRegistration,
  HealthcareNavigationInputSchema,
  HealthcareNavigationOutputSchema,
} from './healthcare-navigation/index.js';

export {
  groceryOptimizationModule,
  groceryOptimizationRegistration,
  GroceryOptimizationInputSchema,
  GroceryOptimizationOutputSchema,
} from './grocery-optimization/index.js';

export {
  lifeEventModule,
  lifeEventRegistration,
  LifeEventInputSchema,
  LifeEventOutputSchema,
} from './life-event/index.js';

export {
  benefitsSimulatorModule,
  benefitsSimulatorRegistration,
  BenefitsSimulatorInputSchema,
  BenefitsSimulatorOutputSchema,
} from './benefits-simulator/index.js';

export {
  FINANCIAL_REALITY_CONTRACT,
  BENEFITS_SIMULATOR_CONTRACT,
  DEFAULT_MODULE_CONTRACT,
} from './module-contracts.js';

export { compiledModuleCatalog, allModuleRegistrations } from './catalog.js';

import { registerModuleMergeStrategy } from '@arrivalos/profile';
import type { ModuleRegistration } from '@arrivalos/core';
import { benefitsSimulatorMergeStrategy } from './benefits-simulator/merge-strategy.js';
import { allModuleRegistrations } from './catalog.js';

export function registerAllMergeStrategies(): void {
  registerModuleMergeStrategy(benefitsSimulatorMergeStrategy);
}

export function registerAllModules(registry: { register: (r: ModuleRegistration) => void }): void {
  registerAllMergeStrategies();
  for (const registration of allModuleRegistrations) {
    registry.register(registration);
  }
}
