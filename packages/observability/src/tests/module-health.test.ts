import { describe, expect, it } from 'vitest';
import { ModuleRegistry } from '@arrival-atlas/core';
import { allModuleRegistrations, compiledModuleCatalog } from '@arrival-atlas/modules';
import { bootstrapGovernedRuntime } from '@arrival-atlas/module-runtime';
import { bootstrapProductContractLayer } from '@arrival-atlas/product-contract';
import {
  bootstrapObservability,
  buildModuleHealthSummary,
  buildNormalizerGoldenBaseline,
} from '../index.js';

describe('module health', () => {
  it('reports healthy modules when contract snapshots are present', () => {
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

    const summary = buildModuleHealthSummary({
      contractStore,
      sdkVersions: Object.fromEntries(
        compiledModuleCatalog.contracts.map((contract) => [contract.moduleId, contract.version])
      ),
      driftFindings: observability.driftFindings,
    });

    expect(summary.totalModules).toBe(6);
    expect(summary.modules.every((module) => module.status === 'healthy')).toBe(true);
  });
});
