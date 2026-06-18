import { describe, expect, it } from 'vitest';
import { ModuleRegistry } from '@arrivalos/core';
import { allModuleRegistrations, compiledModuleCatalog } from '@arrivalos/modules';
import { bootstrapGovernedRuntime } from '@arrivalos/module-runtime';
import { bootstrapProductContractLayer } from '@arrivalos/product-contract';
import {
  bootstrapObservability,
  buildBootstrapIntegritySnapshot,
  buildNormalizerGoldenBaseline,
  detectContractDrift,
  detectSnapshotDrift,
  sha256Checksum,
  stableStringify,
  validateNormalizerIntegrity,
} from '../index.js';

describe('drift detection', () => {
  it('produces deterministic checksums without timestamps', () => {
    const payload = { moduleId: 'financial-reality', version: '2.0.0', value: 1 };
    expect(sha256Checksum(payload)).toBe(sha256Checksum(payload));
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('detects no contract drift for aligned sdk and contract snapshots', () => {
    const coreRegistry = new ModuleRegistry();
    const { governedRegistry } = bootstrapGovernedRuntime(coreRegistry, allModuleRegistrations);
    const contractStore = bootstrapProductContractLayer(governedRegistry);

    expect(
      detectContractDrift({
        sdkCatalog: compiledModuleCatalog,
        contractStore,
      })
    ).toEqual([]);
  });

  it('detects snapshot drift when integrity checksum changes', () => {
    const stored = {
      moduleCount: 6,
      governanceChecksum: 'abc',
      snapshotChecksum: 'def',
      generatedAt: '2026-06-16T00:00:00.000Z',
    };
    const recomputed = {
      ...stored,
      snapshotChecksum: 'changed',
    };

    expect(detectSnapshotDrift({ stored, recomputed }).length).toBeGreaterThan(0);
  });

  it('validates normalizer golden baseline integrity', () => {
    const baseline = buildNormalizerGoldenBaseline();
    expect(validateNormalizerIntegrity(baseline)).toEqual([]);
  });

  it('builds bootstrap integrity snapshot deterministically for checksum payload', () => {
    const coreRegistry = new ModuleRegistry();
    const { governedRegistry } = bootstrapGovernedRuntime(coreRegistry, allModuleRegistrations);
    const contractStore = bootstrapProductContractLayer(governedRegistry);

    const first = buildBootstrapIntegritySnapshot({
      sdkCatalog: compiledModuleCatalog,
      contractStore,
      registryFrozen: true,
      registeredModuleCount: 6,
    });
    const second = buildBootstrapIntegritySnapshot({
      sdkCatalog: compiledModuleCatalog,
      contractStore,
      registryFrozen: true,
      registeredModuleCount: 6,
    });

    expect(first.governanceChecksum).toBe(second.governanceChecksum);
    expect(first.snapshotChecksum).toBe(second.snapshotChecksum);
    expect(first.moduleCount).toBe(6);
  });

  it('bootstraps observability without error level drift findings', () => {
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

    expect(state.bootstrapCompleted).toBe(true);
    expect(state.driftFindings.some((finding) => finding.severity === 'error')).toBe(false);
  });
});
