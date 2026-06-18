import { describe, expect, it } from 'vitest';
import { ModuleRegistry } from '@arrivalos/core';
import { allModuleRegistrations } from '@arrivalos/modules';
import { bootstrapGovernedRuntime } from '@arrivalos/module-runtime';
import { bootstrapProductContractLayer } from '@arrivalos/product-contract';
import { compiledModuleCatalog } from '@arrivalos/modules';
import {
  bootstrapObservability,
  buildGovernanceHealth,
  buildNormalizerGoldenBaseline,
} from '../index.js';

describe('governance health', () => {
  it('reports healthy governance after bootstrap', () => {
    const coreRegistry = new ModuleRegistry();
    const { governedRegistry } = bootstrapGovernedRuntime(coreRegistry, allModuleRegistrations);
    const contractStore = bootstrapProductContractLayer(governedRegistry);
    const observability = bootstrapObservability({
      sdkCatalog: compiledModuleCatalog,
      contractStore,
      registryFrozen: coreRegistry.isRegistrationFrozen(),
      registeredModuleCount: governedRegistry.listModuleIds().length,
      normalizerBaseline: buildNormalizerGoldenBaseline(),
    });

    const health = buildGovernanceHealth({
      registryFrozen: coreRegistry.isRegistrationFrozen(),
      registeredModules: governedRegistry.listModuleIds().length,
      contractStore,
      observability,
    });

    expect(health.healthy).toBe(true);
    expect(health.registryFrozen).toBe(true);
    expect(health.registeredModules).toBe(6);
    expect(health.contractSnapshots).toBe(6);
    expect(health.governanceVersion).toBe('1.0');
  });
});
