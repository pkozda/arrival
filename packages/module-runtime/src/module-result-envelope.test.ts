import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ModuleExecutionResult } from '@arrivalos/core';
import { ModuleRegistry } from '@arrivalos/core';
import { InMemoryProfileStore, ProfileEngine } from '@arrivalos/profile';
import { registerAllModules, allModuleRegistrations } from '@arrivalos/modules';
import { bootstrapGovernedRuntime } from './governance/bootstrapGovernedRuntime.js';
import { legacyDomainToModuleResult } from './adapters/legacyDomainToModuleResult.js';
import {
  getLegacyDomainResult,
  resolveExecutionResult,
} from './adapters/resolveExecutionResult.js';
import { wrapLegacyExecutionResult } from './adapters/wrapLegacyExecutionResult.js';
import { ModuleRuntime } from './runtime/ModuleRuntime.js';

const legacySuccess: ModuleExecutionResult = {
  moduleId: 'financial-reality',
  version: '2.0.0',
  success: true,
  executedAt: '2026-06-16T12:00:00.000Z',
  data: {
    income: { gross: 2500, net: 1800 },
    meta: { confidence: 'high', disclaimer: 'Not legal advice' },
  },
};

function stripCalculatedAt(data: unknown): unknown {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }

  const record = { ...(data as Record<string, unknown>) };
  if (record.meta && typeof record.meta === 'object' && !Array.isArray(record.meta)) {
    const { calculatedAt: _calculatedAt, ...meta } = record.meta as Record<string, unknown>;
    record.meta = meta;
  }

  return record;
}

describe('wrapLegacyExecutionResult', () => {
  it('leaves legacy payload unchanged while wrapping metadata', () => {
    const envelope = wrapLegacyExecutionResult(legacySuccess, {
      executionId: 'exec_1',
      executedAt: legacySuccess.executedAt,
    });

    expect(envelope.status).toBe('success');
    expect(envelope.payload).toBe(legacySuccess.data);
    expect(envelope.meta).toEqual({
      moduleId: 'financial-reality',
      moduleVersion: '2.0.0',
      runtimeContractVersion: '1.0',
      executionId: 'exec_1',
      executedAt: '2026-06-16T12:00:00.000Z',
      confidence: 'high',
      disclaimer: 'Not legal advice',
    });
  });

  it('defaults confidence to medium when payload has no meta', () => {
    const legacy: ModuleExecutionResult = {
      ...legacySuccess,
      data: { income: { gross: 1000, net: 800 } },
    };

    const envelope = wrapLegacyExecutionResult(legacy, { executionId: 'exec_2' });
    expect(envelope.meta.confidence).toBe('medium');
  });
});

describe('resolveExecutionResult', () => {
  it('returns stored moduleResult when present', () => {
    const storedEnvelope = wrapLegacyExecutionResult(legacySuccess, { executionId: 'exec_3' });
    const resolved = resolveExecutionResult({
      moduleId: 'financial-reality',
      executionId: 'exec_3',
      timestamp: Date.parse('2026-06-16T12:00:00.000Z'),
      legacyResult: legacySuccess.data,
      moduleResult: storedEnvelope,
    });

    expect(resolved).toBe(storedEnvelope);
  });

  it('adapts legacy-only stored executions via legacyDomainToModuleResult', () => {
    const resolved = legacyDomainToModuleResult(legacySuccess.data, {
      moduleId: 'financial-reality',
      moduleVersion: '2.0.0',
      executionId: 'exec_4',
      executedAt: '2026-06-16T12:00:00.000Z',
    });

    expect(resolved.status).toBe('success');
    expect(resolved.payload).toBe(legacySuccess.data);
    expect(resolved.meta.confidence).toBe('high');
  });

  it('reads legacy domain output from dual-write storage shape', () => {
    const legacyDomain = { income: { gross: 1200 } };
    expect(
      getLegacyDomainResult({
        moduleId: 'financial-reality',
        executionId: 'exec_5',
        timestamp: 0,
        result: { income: { gross: 999 } },
        legacyResult: legacyDomain,
      })
    ).toBe(legacyDomain);
  });
});

describe('ModuleRuntime envelope mode', () => {
  const previousFlag = process.env.ARRIVALOS_MRC_ENVELOPE;

  beforeEach(() => {
    process.env.ARRIVALOS_MRC_ENVELOPE = 'true';
  });

  afterEach(() => {
    if (previousFlag === undefined) {
      delete process.env.ARRIVALOS_MRC_ENVELOPE;
    } else {
      process.env.ARRIVALOS_MRC_ENVELOPE = previousFlag;
    }
  });

  it('produces identical legacy output and a wrapped envelope', async () => {
    const store = new InMemoryProfileStore();
    const profileEngine = new ProfileEngine(store);
    const coreRegistry = new ModuleRegistry();
    registerAllModules(coreRegistry);
    const governedRegistry = bootstrapGovernedRuntime(
      coreRegistry,
      allModuleRegistrations
    ).governedRegistry;
    const moduleRuntime = new ModuleRuntime({ profileEngine, governedRegistry });

    const sessionId = 'sess_envelope';
    const profile = await profileEngine.createProfile({ preferredLanguage: 'en' });
    await profileEngine.bindSession(sessionId, profile.id);

    const input = {
      grossIncome: 2500,
      taxClass: 1 as const,
      churchTax: false,
      householdSize: 1,
      monthlyRent: 800,
      employmentStatus: 'employed' as const,
      maritalStatus: 'single' as const,
    };

    const direct = await governedRegistry.executeGovernedModule('financial-reality', input, {
      sessionId,
      userProfile: { language: 'en' },
    });

    const runtimeOutcome = await moduleRuntime.execute({
      moduleId: 'financial-reality',
      sessionId,
      accountId: null,
      requestInput: input,
      requestContext: { userProfile: { language: 'en' } },
      executionId: 'exec_runtime',
    });

    expect(runtimeOutcome.legacy.success).toBe(direct.success);
    expect(stripCalculatedAt(runtimeOutcome.legacy.data)).toEqual(
      stripCalculatedAt(direct.data)
    );
    expect(runtimeOutcome.envelope?.status).toBe('success');
    expect(stripCalculatedAt(runtimeOutcome.envelope?.payload)).toEqual(
      stripCalculatedAt(direct.data)
    );
    expect(runtimeOutcome.envelope?.meta.executionId).toBe('exec_runtime');
  });
});
