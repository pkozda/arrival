import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ModuleRegistry } from '@arrival-atlas/core';
import { allModuleRegistrations } from '@arrival-atlas/modules';
import { bootstrapGovernedRuntime } from '@arrival-atlas/module-runtime';
import { mapModuleStatus } from './mapModuleStatus.js';
import { normalizeCapabilities } from './normalizeCapabilities.js';
import {
  projectPublicContract,
  projectPublicModuleContract,
} from './projectPublicContract.js';
import type { PublicModuleContract } from './PublicModuleContract.js';

const FORBIDDEN_RESPONSE_KEYS = [
  'enabled',
  'featureFlags',
  'executionConstraints',
  'frozen',
  'spec',
  'requiresRecommendationNormalizer',
  'requiresActionNormalizer',
  'runtimeContractVersion',
  'normalizer',
  'registry',
  'governance',
] as const;

const REQUIRED_PUBLIC_KEYS = [
  'id',
  'title',
  'description',
  'version',
  'status',
  'capabilities',
  'metadata',
] as const;

function assertPublicModuleContractShape(value: unknown): asserts value is PublicModuleContract {
  expect(value).toBeTypeOf('object');
  expect(value).not.toBeNull();

  const record = value as Record<string, unknown>;
  for (const key of REQUIRED_PUBLIC_KEYS) {
    expect(record).toHaveProperty(key);
  }

  for (const key of FORBIDDEN_RESPONSE_KEYS) {
    expect(record).not.toHaveProperty(key);
  }

  const capabilities = record.capabilities as Record<string, unknown>;
  expect(capabilities).toHaveProperty('supports');
  expect(capabilities).not.toHaveProperty('executionConstraints');

  const supports = capabilities.supports as Record<string, unknown>;
  expect(supports).toEqual({
    recommendations: expect.any(Boolean),
    actions: expect.any(Boolean),
    explanation: expect.any(Boolean),
    riskModel: expect.any(Boolean),
  });
}

function collectForbiddenKeys(value: unknown, path = ''): string[] {
  if (value === null || typeof value !== 'object') {
    return [];
  }

  const violations: string[] = [];

  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      violations.push(...collectForbiddenKeys(entry, `${path}[${index}]`));
    }
    return violations;
  }

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_RESPONSE_KEYS.includes(key as (typeof FORBIDDEN_RESPONSE_KEYS)[number])) {
      violations.push(fullPath);
    }
    violations.push(...collectForbiddenKeys(entry, fullPath));
  }

  return violations;
}

function listSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }

    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('product contract projection', () => {
  const coreRegistry = new ModuleRegistry();
  const { governedRegistry } = bootstrapGovernedRuntime(coreRegistry, allModuleRegistrations);

  it('projects all modules into PublicModuleContract shape', () => {
    const contracts = projectPublicContract(governedRegistry);

    expect(contracts.length).toBe(allModuleRegistrations.length);
    for (const contract of contracts) {
      assertPublicModuleContractShape(contract);
    }
  });

  it('maps financial-reality capabilities from contract spec only', () => {
    const contract = projectPublicModuleContract(governedRegistry, 'financial-reality');

    expect(contract).toBeDefined();
    expect(contract?.capabilities).toEqual({
      supports: {
        recommendations: true,
        actions: true,
        explanation: true,
        riskModel: false,
      },
    });
  });

  it('maps benefits-simulator riskModel from contract spec', () => {
    const contract = projectPublicModuleContract(governedRegistry, 'benefits-simulator');

    expect(contract?.capabilities.supports.riskModel).toBe(true);
  });

  it('maps disabled modules to disabled status', () => {
    expect(mapModuleStatus({ enabled: false })).toBe('disabled');
  });

  it('maps entitlement denial to restricted status', () => {
    expect(mapModuleStatus({ enabled: true, entitlementAllowed: false })).toBe('restricted');
  });

  it('maps enabled healthy modules to available status', () => {
    expect(mapModuleStatus({ enabled: true })).toBe('available');
  });

  it('does not expose runtime-only fields in projected JSON', () => {
    const contracts = projectPublicContract(governedRegistry);
    const violations = collectForbiddenKeys(contracts);

    expect(violations).toEqual([]);
  });

  it('derives capabilities without reading runtime capability helpers', () => {
    const contract = governedRegistry.getModuleContract('financial-reality');
    expect(contract).toBeDefined();

    const runtimeCaps = governedRegistry.getCapabilities('financial-reality');
    const normalized = normalizeCapabilities(contract!);

    expect(normalized.supports.recommendations).toBe(
      contract!.spec.capabilities.includes('produces-recommendations')
    );
    expect(normalized.supports.actions).toBe(
      contract!.spec.capabilities.includes('produces-actions')
    );
    expect(JSON.stringify(normalized)).not.toContain('executionConstraints');
    expect(runtimeCaps?.executionConstraints.length).toBeGreaterThan(0);
  });
});

describe('product contract API boundary policy', () => {
  const apiSrcRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../apps/api/src');

  it('forbids globalRegistry usage in module catalog routes', () => {
    const moduleRouteFiles = ['build-app.ts'];
    const violations: string[] = [];

    for (const fileName of moduleRouteFiles) {
      const source = readFileSync(join(apiSrcRoot, fileName), 'utf8');
      const moduleListHandler = source.slice(
        source.indexOf("'/api/modules'"),
        source.indexOf("'/api/modules/:id'")
      );
      if (moduleListHandler.includes('globalRegistry')) {
        violations.push(`${fileName}: globalRegistry in GET /api/modules handler`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('requires product-contract projection in build-app module routes', () => {
    const source = readFileSync(join(apiSrcRoot, 'build-app.ts'), 'utf8');

    expect(source).toContain('projectPublicContract');
    expect(source).toContain('projectPublicModuleContract');
    expect(source).not.toMatch(/featureFlags:\s*m\./);
    expect(source).not.toMatch(/enabled:\s*m\.enabled/);
  });

  it('forbids GovernedModuleRegistry JSON leakage patterns in API sources', () => {
    const forbiddenPatterns = [
      'executionConstraints',
      'RegisteredModuleContract',
      'ModuleRegistration',
      'getCapabilities(',
    ];
    const violations: string[] = [];

    for (const filePath of listSourceFiles(apiSrcRoot)) {
      if (!filePath.endsWith('build-app.ts')) {
        continue;
      }

      const source = readFileSync(filePath, 'utf8');
      const moduleRoutes = source.slice(
        source.indexOf("'/api/modules'"),
        source.indexOf("'/api/modules/:id/execute'")
      );

      for (const pattern of forbiddenPatterns) {
        if (moduleRoutes.includes(pattern)) {
          violations.push(`${filePath}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
