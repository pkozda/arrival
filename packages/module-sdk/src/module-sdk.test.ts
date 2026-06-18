import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileModuleRegistration,
  defineAction,
  defineModule,
  defineModuleVersion,
  defineRecommendation,
  mapExecutionFailureToModuleError,
  registerModuleFromSDK,
  validateModuleIsolation,
  validateModuleVersioning,
} from './index.js';

describe('module-sdk', () => {
  it('compiles a valid SDK module into ModuleRegistration', () => {
    const definition = defineModule({
      id: 'demo-module',
      name: 'Demo Module',
      description: 'Demo module for SDK tests',
      version: '1.0.0',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      execute: async (input) => ({ result: input.value * 2 }),
      contract: {
        runtimeContractVersion: '1.0',
        capabilities: ['produces-recommendations'],
        requiresRecommendationNormalizer: true,
        requiresActionNormalizer: false,
      },
      recommendations: [
        defineRecommendation({
          id: 'rec-1',
          title: 'Review',
          description: 'Review output',
          priority: 'high',
        }),
      ],
      actions: [
        defineAction({
          id: 'act-1',
          kind: 'contact',
          title: 'Contact support',
          description: 'Reach out for help',
          priority: 'medium',
        }),
      ],
    });

    const compiled = compileModuleRegistration(definition);

    expect(compiled.registration.id).toBe('demo-module');
    expect(compiled.registration.module.execute).toBeTypeOf('function');
    expect(compiled.contract.spec.capabilities).toEqual(['produces-recommendations']);
    expect(compiled.fingerprints.inputSchemaHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('rejects invalid semver versions', () => {
    expect(() => defineModuleVersion('2.0')).toThrow(/semver/i);
  });

  it('maps execution failures to ModuleError without stack traces', () => {
    const mapped = mapExecutionFailureToModuleError({
      moduleId: 'demo-module',
      error: 'Invalid input: grossIncome must be positive\n    at validateInput (demo.ts:10:3)',
    });

    expect(mapped.category).toBe('validation');
    expect(mapped.retryable).toBe(false);
    expect(mapped.message).not.toContain('at validateInput');
  });

  it('detects schema drift semver violations', () => {
    const definition = defineModule({
      id: 'demo-module',
      name: 'Demo Module',
      description: 'Demo',
      version: '1.0.1',
      inputSchema: z.object({ value: z.number(), next: z.string() }),
      outputSchema: z.object({ result: z.number() }),
      execute: async (input) => ({ result: input.value }),
    });

    const compiled = compileModuleRegistration(definition);
    const baseline = {
      version: '1.0.0',
      inputSchemaHash: '00000000',
      outputSchemaHash: compiled.fingerprints.outputSchemaHash,
      capabilitiesHash: compiled.fingerprints.capabilitiesHash,
      recommendationShapeHash: compiled.fingerprints.recommendationShapeHash,
      actionShapeHash: compiled.fingerprints.actionShapeHash,
    };

    const violations = validateModuleVersioning({
      moduleId: 'demo-module',
      version: definition.version,
      baseline,
      fingerprints: compiled.fingerprints,
    });

    expect(violations.some((violation) => violation.code === 'SEMVER_POLICY_VIOLATION')).toBe(
      true
    );
  });

  it('registers modules through registerModuleFromSDK', () => {
    const definition = defineModule({
      id: 'sdk-register-demo',
      name: 'SDK Register Demo',
      description: 'Demo',
      version: '0.1.0',
      inputSchema: z.object({ ok: z.boolean() }),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async (input) => input,
    });

    const compiled = registerModuleFromSDK(definition, { skipIsolation: true });
    expect(compiled.registration.id).toBe('sdk-register-demo');
  });
});

describe('module isolation contract', () => {
  it('passes for current modules package sources', () => {
    const violations = validateModuleIsolation(
      join(dirname(fileURLToPath(import.meta.url)), '../../modules/src')
    );

    expect(violations).toEqual([]);
  });
});
