import { describe, expect, it } from 'vitest';
import { ModuleRegistry } from '@arrival-atlas/core';
import { allModuleRegistrations } from '@arrival-atlas/modules';
import { bootstrapGovernedRuntime } from '@arrival-atlas/module-runtime';
import { bootstrapProductContractLayer } from '@arrival-atlas/product-contract';
import { compiledModuleCatalog } from '@arrival-atlas/modules';
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
