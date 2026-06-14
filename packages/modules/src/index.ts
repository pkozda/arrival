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

import { financialRealityRegistration } from './financial-reality/index.js';
import { systemTranslationRegistration } from './system-translation/index.js';
import { healthcareNavigationRegistration } from './healthcare-navigation/index.js';
import { groceryOptimizationRegistration } from './grocery-optimization/index.js';
import { lifeEventRegistration } from './life-event/index.js';
import type { ModuleRegistration } from '@arrivalos/core';

export const allModuleRegistrations: ModuleRegistration[] = [
  financialRealityRegistration,
  systemTranslationRegistration,
  healthcareNavigationRegistration,
  groceryOptimizationRegistration,
  lifeEventRegistration,
];

export function registerAllModules(registry: { register: (r: ModuleRegistration) => void }): void {
  for (const registration of allModuleRegistrations) {
    registry.register(registration);
  }
}
