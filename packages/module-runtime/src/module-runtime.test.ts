import { describe, it, expect, beforeEach } from 'vitest';
import { ModuleRegistry } from '@arrival-atlas/core';
import { InMemoryProfileStore, ProfileEngine } from '@arrival-atlas/profile';
import { registerAllModules, allModuleRegistrations } from '@arrival-atlas/modules';
import { resolveExecutionContext } from '@arrival-atlas/profile';
import { toModuleRuntimeContext } from './adapters/toModuleRuntimeContext.js';
import { bootstrapGovernedRuntime } from './governance/bootstrapGovernedRuntime.js';
import { ModuleRuntime } from './runtime/ModuleRuntime.js';

function stripNonDeterministicMeta(data: unknown): unknown {
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

describe('toModuleRuntimeContext', () => {
  it('maps AppContext fields structurally without transformation', () => {
    const appContext = {
      sessionId: 'sess_1',
      profileId: 'prof_1',
      profileVersion: 2,
      location: 'Berlin',
      userProfile: {
        language: 'de' as const,
        uiPreferences: { theme: 'dark' as const },
      },
      profileSlice: {
        preferredLanguage: 'de',
        employment: { status: 'employed', taxClass: 1 },
      },
      dataProvenance: [{ field: 'grossIncome', source: 'profile' as const }],
    };

    const runtimeContext = toModuleRuntimeContext(appContext, {
      moduleId: 'financial-reality',
      traceId: 'trace_1',
      executedAt: '2026-06-16T12:00:00.000Z',
      accountId: 'acct_1',
    });

    expect(runtimeContext).toEqual({
      sessionId: 'sess_1',
      accountId: 'acct_1',
      locale: 'de',
      uiPreferences: { theme: 'dark' },
      profileSlice: {
        preferredLanguage: 'de',
        employment: { status: 'employed', taxClass: 1 },
      },
      profileId: 'prof_1',
      profileVersion: 2,
      dataProvenance: [{ field: 'grossIncome', source: 'profile' }],
      location: 'Berlin',
      runtime: {
        moduleId: 'financial-reality',
        executedAt: '2026-06-16T12:00:00.000Z',
        traceId: 'trace_1',
      },
    });
  });

  it('does not mutate the source AppContext', () => {
    const appContext = {
      sessionId: 'sess_2',
      dataProvenance: [{ field: 'taxClass', source: 'default' as const }],
    };
    const snapshot = structuredClone(appContext);

    toModuleRuntimeContext(appContext, {
      moduleId: 'benefits-simulator',
      traceId: 'trace_2',
      executedAt: '2026-06-16T12:00:00.000Z',
    });

    expect(appContext).toEqual(snapshot);
  });
});

describe('ModuleRuntime.execute', () => {
  const sessionId = 'sess_mrc_runtime';
  let store: InMemoryProfileStore;
  let profileEngine: ProfileEngine;
  let governedRegistry: ReturnType<typeof bootstrapGovernedRuntime>['governedRegistry'];
  let moduleRuntime: ModuleRuntime;

  beforeEach(async () => {
    store = new InMemoryProfileStore();
    profileEngine = new ProfileEngine(store);
    const coreRegistry = new ModuleRegistry();
    registerAllModules(coreRegistry);
    governedRegistry = bootstrapGovernedRuntime(coreRegistry, allModuleRegistrations).governedRegistry;
    moduleRuntime = new ModuleRuntime({ profileEngine, governedRegistry });

    const profile = await profileEngine.createProfile({ preferredLanguage: 'en' });
    await profileEngine.bindSession(sessionId, profile.id);
    await profileEngine.updateProfile(
      profile.id,
      {
        employment: {
          grossMonthlyIncome: 2500,
          taxClass: 1,
          churchTax: false,
          status: 'employed',
        },
        household: { size: 1, maritalStatus: 'single' },
        housing: { monthlyColdRent: 800 },
        insurance: { hasCoverage: true, type: 'public' },
        benefits: { daysInGermany: 90 },
      },
      1
    );
  });

  it('returns the same execution result as governed registry execution', async () => {
    const requestInput = { grossIncome: 3000 };
    const requestContext = { userProfile: { language: 'en' as const } };

    const resolved = await resolveExecutionContext(profileEngine, {
      sessionId,
      moduleId: 'financial-reality',
      requestInput,
      requestContext,
    });

    const directResult = await governedRegistry.executeGovernedModule(
      'financial-reality',
      resolved.mergedInput,
      resolved.context
    );

    const runtimeOutcome = await moduleRuntime.execute({
      moduleId: 'financial-reality',
      sessionId,
      accountId: null,
      requestInput,
      requestContext,
    });

    expect(runtimeOutcome.legacy.success).toBe(directResult.success);
    expect(runtimeOutcome.legacy.moduleId).toBe(directResult.moduleId);
    expect(runtimeOutcome.legacy.version).toBe(directResult.version);
    expect(runtimeOutcome.legacy.error).toBe(directResult.error);
    expect(stripNonDeterministicMeta(runtimeOutcome.legacy.data)).toEqual(
      stripNonDeterministicMeta(directResult.data)
    );
    expect(runtimeOutcome.mergedInput).toEqual(resolved.mergedInput);
    expect(runtimeOutcome.trace.moduleId).toBe('financial-reality');
    expect(runtimeOutcome.runtimeContext.sessionId).toBe(sessionId);
    expect(runtimeOutcome.runtimeContext.runtime.moduleId).toBe('financial-reality');
  });

  it('does not mutate resolved AppContext during execution', async () => {
    const resolved = await resolveExecutionContext(profileEngine, {
      sessionId,
      moduleId: 'financial-reality',
      requestInput: {},
      requestContext: {},
    });
    const contextSnapshot = structuredClone(resolved.context);

    await moduleRuntime.execute({
      moduleId: 'financial-reality',
      sessionId,
      accountId: null,
      requestInput: {},
      requestContext: {},
    });

    expect(resolved.context).toEqual(contextSnapshot);
  });
});
