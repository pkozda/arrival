import { defineModuleFromRegistration, registerModulesFromSDK } from '@arrival-atlas/module-sdk';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { financialRealityRegistration } from './financial-reality/index.js';
import { systemTranslationRegistration } from './system-translation/index.js';
import { healthcareNavigationRegistration } from './healthcare-navigation/index.js';
import { groceryOptimizationRegistration } from './grocery-optimization/index.js';
import { lifeEventRegistration } from './life-event/index.js';
import { benefitsSimulatorRegistration } from './benefits-simulator/index.js';
import {
  BENEFITS_SIMULATOR_CONTRACT,
  DEFAULT_MODULE_CONTRACT,
  FINANCIAL_REALITY_CONTRACT,
} from './module-contracts.js';

const modulesSourceRoot = join(dirname(fileURLToPath(import.meta.url)));

export const compiledModuleCatalog = registerModulesFromSDK(
  [
    defineModuleFromRegistration(financialRealityRegistration, FINANCIAL_REALITY_CONTRACT),
    defineModuleFromRegistration(systemTranslationRegistration, DEFAULT_MODULE_CONTRACT),
    defineModuleFromRegistration(healthcareNavigationRegistration, DEFAULT_MODULE_CONTRACT),
    defineModuleFromRegistration(groceryOptimizationRegistration, DEFAULT_MODULE_CONTRACT),
    defineModuleFromRegistration(lifeEventRegistration, DEFAULT_MODULE_CONTRACT),
    defineModuleFromRegistration(benefitsSimulatorRegistration, BENEFITS_SIMULATOR_CONTRACT),
  ],
  {
    isolationRoot: modulesSourceRoot,
  }
);

export const allModuleRegistrations = compiledModuleCatalog.registrations;
