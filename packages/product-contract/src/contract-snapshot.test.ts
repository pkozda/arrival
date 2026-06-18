import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ModuleRegistry } from '@arrivalos/core';
import { allModuleRegistrations } from '@arrivalos/modules';
import {
  FinancialRealityInputSchema,
  FinancialRealityOutputSchema,
} from '@arrivalos/modules';
import { bootstrapGovernedRuntime } from '@arrivalos/module-runtime';
import { buildContractSnapshot } from './buildContractSnapshot.js';
import { bootstrapProductContractLayer } from './bootstrapProductContractLayer.js';
import { createContractSnapshotStore } from './ContractSnapshotStore.js';
import { normalizeCapabilities } from './normalizeCapabilities.js';
import { projectModuleCapabilities, projectModuleSchema } from './projectContractSnapshot.js';

describe('ContractSnapshot bootstrap layer', () => {
  const coreRegistry = new ModuleRegistry();
  const { governedRegistry } = bootstrapGovernedRuntime(coreRegistry, allModuleRegistrations);

  it('creates a snapshot for every governed module once at bootstrap', () => {
    const store = bootstrapProductContractLayer(governedRegistry);

    expect(store.frozen).toBe(true);
    expect(store.listModuleIds().length).toBe(allModuleRegistrations.length);
    expect(store.getContractSnapshot('financial-reality')).toBeDefined();
  });

  it('keeps snapshots deeply immutable after bootstrap', () => {
    const store = bootstrapProductContractLayer(governedRegistry);
    const snapshot = store.getContractSnapshot('financial-reality');

    expect(snapshot).toBeDefined();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot!.capabilities)).toBe(true);
    expect(Object.isFrozen(snapshot!.capabilities.supports)).toBe(true);
    expect(Object.isFrozen(snapshot!.inputSchema)).toBe(true);
    expect(Object.isFrozen(snapshot!.outputSchema)).toBe(true);

    expect(() => {
      (snapshot as { moduleId?: string }).moduleId = 'mutated';
    }).toThrow();
  });

  it('derives input schema from Zod source definitions', () => {
    const snapshots = buildContractSnapshot(governedRegistry);
    const financial = snapshots['financial-reality'];

    expect(financial).toBeDefined();
    expect(financial!.inputSchema).toMatchObject({
      type: 'object',
    });

    const properties = financial!.inputSchema.properties as Record<string, unknown>;
    expect(properties).toHaveProperty('grossIncome');
    expect(properties).toHaveProperty('taxClass');

    const zodShape = FinancialRealityInputSchema.shape;
    for (const key of Object.keys(zodShape)) {
      expect(properties).toHaveProperty(key);
    }
  });

  it('derives output schema from Zod source definitions', () => {
    const snapshots = buildContractSnapshot(governedRegistry);
    const financial = snapshots['financial-reality'];

    const properties = financial!.outputSchema.properties as Record<string, unknown>;
    expect(properties).toHaveProperty('income');

    const zodShape = FinancialRealityOutputSchema.shape;
    for (const key of Object.keys(zodShape)) {
      expect(properties).toHaveProperty(key);
    }
  });

  it('maps capabilities from contract spec without execution inference', () => {
    const contract = governedRegistry.getModuleContract('financial-reality');
    expect(contract).toBeDefined();

    const snapshot = buildContractSnapshot(governedRegistry)['financial-reality'];
    expect(snapshot?.capabilities).toEqual(normalizeCapabilities(contract!));
    expect(snapshot?.capabilities.supports.recommendations).toBe(true);
    expect(snapshot?.capabilities.supports.riskModel).toBe(false);
  });

  it('does not call runtime execution during snapshot build', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'buildContractSnapshot.ts'),
      'utf8'
    );

    expect(source).not.toContain('executeGovernedModule');
    expect(source).not.toContain('execute(');
    expect(source).not.toContain('normalizeRecommendations');
    expect(source).not.toContain('enrichModuleResult');
  });

  it('projects schema and capabilities as read-only views from the store', () => {
    const store = createContractSnapshotStore(buildContractSnapshot(governedRegistry));

    const schema = projectModuleSchema(store, 'financial-reality');
    const capabilities = projectModuleCapabilities(store, 'benefits-simulator');

    expect(schema?.inputSchema).toEqual(
      store.getContractSnapshot('financial-reality')?.inputSchema
    );
    expect(schema?.outputSchema).toEqual(
      store.getContractSnapshot('financial-reality')?.outputSchema
    );
    expect(capabilities?.supports.riskModel).toBe(true);
  });

  it('returns deterministic snapshots for the same registry state', () => {
    const frozenAt = '2026-06-16T12:00:00.000Z';
    const first = buildContractSnapshot(governedRegistry, frozenAt);
    const second = buildContractSnapshot(governedRegistry, frozenAt);

    expect(first).toEqual(second);
  });
});
