import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ModuleRegistry } from '@arrivalos/core';
import { allModuleRegistrations, compiledModuleCatalog } from '@arrivalos/modules';
import { bootstrapGovernedRuntime } from '@arrivalos/module-runtime';
import { bootstrapProductContractLayer } from '@arrivalos/product-contract';
import { validateModuleVersioningCatalog } from '@arrivalos/module-sdk';
import {
  bootstrapObservability,
  buildBootstrapIntegritySnapshot,
  buildNormalizerGoldenBaseline,
  collectDriftFindings,
  validateNormalizerIntegrity,
} from '../index.js';

describe('observability drift CI suite', () => {
  it('passes contract, snapshot, and normalizer drift checks', () => {
    const coreRegistry = new ModuleRegistry();
    const { governedRegistry } = bootstrapGovernedRuntime(coreRegistry, allModuleRegistrations);
    const contractStore = bootstrapProductContractLayer(governedRegistry);
    const normalizerBaseline = buildNormalizerGoldenBaseline();
    const integrity = buildBootstrapIntegritySnapshot({
      sdkCatalog: compiledModuleCatalog,
      contractStore,
      registryFrozen: coreRegistry.isRegistrationFrozen(),
      registeredModuleCount: governedRegistry.listModuleIds().length,
    });

    const findings = collectDriftFindings({
      sdkCatalog: compiledModuleCatalog,
      contractStore,
      storedIntegrity: integrity,
      recomputedIntegrity: integrity,
      normalizerBaseline,
    });

    expect(findings.filter((finding) => finding.severity === 'error')).toEqual([]);
    expect(validateNormalizerIntegrity(normalizerBaseline)).toEqual([]);
  });

  it('aligns with module versioning baseline gate', () => {
    const baselinePath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../module-sdk/baselines/module-version-baseline.json'
    );
    const moduleVersionBaseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
      modules: Record<string, unknown>;
    };

    const violations = validateModuleVersioningCatalog({
      modules: Object.entries(compiledModuleCatalog.fingerprintsByModuleId).map(
        ([moduleId, fingerprints]) => ({
          moduleId,
          version:
            compiledModuleCatalog.contracts.find((contract) => contract.moduleId === moduleId)
              ?.version ?? '',
          fingerprints,
        })
      ),
      baseline: moduleVersionBaseline,
    });

    expect(violations).toEqual([]);
  });

  it('bootstraps observability state without drift errors', () => {
    const coreRegistry = new ModuleRegistry();
    const { governedRegistry } = bootstrapGovernedRuntime(coreRegistry, allModuleRegistrations);
    const contractStore = bootstrapProductContractLayer(governedRegistry);

    const state = bootstrapObservability({
      sdkCatalog: compiledModuleCatalog,
      contractStore,
      registryFrozen: coreRegistry.isRegistrationFrozen(),
      registeredModuleCount: governedRegistry.listModuleIds().length,
      normalizerBaseline: buildNormalizerGoldenBaseline(),
    });

    expect(state.driftFindings.some((finding) => finding.severity === 'error')).toBe(false);
  });
});
