import { describe, expect, it, afterEach } from 'vitest';
import { ModuleRegistry } from '@arrivalos/core';
import { InMemoryProfileStore, ProfileEngine } from '@arrivalos/profile';
import { registerAllModules } from '@arrivalos/modules';
import { BenefitsSimulatorInputSchema } from '@arrivalos/modules';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateModuleExplanation } from './normalizers/generateModuleExplanation.js';
import { normalizeRecommendations } from './normalizers/normalizeRecommendations.js';
import { buildModuleResultEnvelope } from './enrichment/buildModuleResultEnvelope.js';
import { toModuleRuntimeContext } from './adapters/toModuleRuntimeContext.js';

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

describe('generateModuleExplanation', () => {
  it('always generates a summary and confidence mapping', () => {
    const recommendations = normalizeRecommendations({
      moduleId: 'financial-reality',
      payload: {
        meta: { confidence: 'high' },
        verdict: { summary: 'Employment remains financially beneficial.' },
        decisions: [],
        benefits: { buergergeld: { eligible: false, estimatedBenefit: 0, reasoning: [] } },
        adminRules: ['rule_a'],
      },
    });

    const explanation = generateModuleExplanation({
      moduleId: 'financial-reality',
      payload: {
        meta: { confidence: 'high' },
        verdict: { summary: 'Employment remains financially beneficial.' },
        benefits: {
          buergergeld: {
            eligible: true,
            estimatedBenefit: 100,
            reasoning: ['Income below need.'],
          },
        },
        adminRules: ['rule_a'],
      },
      recommendations,
      runtimeContext: toModuleRuntimeContext(
        {
          sessionId: 'sess_1',
          profileId: 'prof_1',
          profileSlice: {
            preferredLanguage: 'de',
            employment: { status: 'employed', grossMonthlyIncome: 2500 },
          },
          dataProvenance: [{ field: 'grossIncome', source: 'profile' }],
        },
        {
          moduleId: 'financial-reality',
          traceId: 'trace_1',
          executedAt: '2026-06-16T12:00:00.000Z',
        }
      ),
      mergedInput: { grossIncome: 2500 },
    });

    expect(explanation.summary).toBe('Employment remains financially beneficial.');
    expect(explanation.confidence).toBe('high');
    expect(explanation.factors.length).toBeGreaterThan(0);
    expect(explanation.ruleIds).toContain('rule_a');
  });

  it('uses benefits simulator summary as module explanation headline', () => {
    const explanation = generateModuleExplanation({
      moduleId: 'benefits-simulator',
      payload: {
        meta: { confidence: 'medium' },
        summary: 'Minijob increases household resources with manageable benefit reduction.',
        recommendations: [],
        riskWarnings: [],
      },
      recommendations: [],
    });

    expect(explanation.summary).toBe(
      'Minijob increases household resources with manageable benefit reduction.'
    );
    expect(explanation.confidence).toBe('medium');
  });
});

describe('MRC-3 envelope enrichment', () => {
  const previousEnvelope = process.env.ARRIVALOS_MRC_ENVELOPE;
  const previousExplanation = process.env.ARRIVALOS_MRC_EXPLANATION;

  afterEach(() => {
    if (previousEnvelope === undefined) {
      delete process.env.ARRIVALOS_MRC_ENVELOPE;
    } else {
      process.env.ARRIVALOS_MRC_ENVELOPE = previousEnvelope;
    }

    if (previousExplanation === undefined) {
      delete process.env.ARRIVALOS_MRC_EXPLANATION;
    } else {
      process.env.ARRIVALOS_MRC_EXPLANATION = previousExplanation;
    }
  });

  it('enriches envelope without mutating legacy payload', async () => {
    process.env.ARRIVALOS_MRC_ENVELOPE = 'true';
    process.env.ARRIVALOS_MRC_EXPLANATION = 'true';

    const store = new InMemoryProfileStore();
    const profileEngine = new ProfileEngine(store);
    const registry = new ModuleRegistry();
    registerAllModules(registry);

    const sessionId = 'sess_explanation';
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
        housing: { monthlyColdRent: 1200 },
        insurance: { hasCoverage: true, type: 'public' },
        benefits: { daysInGermany: 90 },
      },
      1
    );

    const input = {
      grossIncome: 2500,
      taxClass: 1 as const,
      churchTax: false,
      householdSize: 1,
      monthlyRent: 1200,
      employmentStatus: 'employed' as const,
      maritalStatus: 'single' as const,
    };

    const legacy = await registry.execute('financial-reality', input, {
      sessionId,
      userProfile: { language: 'en' },
    });
    const legacySnapshot = structuredClone(legacy.data);

    const envelope = buildModuleResultEnvelope(
      legacy,
      { executionId: 'exec_explain', executedAt: legacy.executedAt },
      {
        moduleId: 'financial-reality',
        runtimeContext: toModuleRuntimeContext(
          {
            sessionId,
            profileId: profile.id,
            profileVersion: 2,
            profileSlice: {
              preferredLanguage: 'en',
              employment: { status: 'employed', grossMonthlyIncome: 2500 },
              housing: { monthlyColdRent: 1200 },
            },
            dataProvenance: [{ field: 'grossIncome', source: 'profile' }],
          },
          {
            moduleId: 'financial-reality',
            traceId: 'trace_explain',
            executedAt: legacy.executedAt,
          }
        ),
        mergedInput: input,
      }
    );

    expect(legacy.data).toEqual(legacySnapshot);
    expect(Array.isArray(envelope?.recommendations)).toBe(true);
    expect(envelope?.explanation?.summary).toBeTruthy();
    expect(envelope?.explanation?.confidence).toMatch(/high|medium|low/);
    expect(envelope?.payload).not.toBe(legacy.data);
    expect(stripCalculatedAt(envelope?.payload)).toEqual(stripCalculatedAt(legacy.data));
    expect(Array.isArray(envelope?.actions)).toBe(true);
  });

  it('produces deterministic recommendations for the same benefits simulator input', async () => {
    const registry = new ModuleRegistry();
    registerAllModules(registry);

    const fixturesPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../tests/fixtures/benefits-simulator-scenarios.json'
    );
    const fixture = JSON.parse(readFileSync(fixturesPath, 'utf8')) as {
      fixtures: Array<{ id: string; input: unknown }>;
    };
    const scenario = fixture.fixtures.find((entry) => entry.id === 'S02-minijob-450-transition');
    expect(scenario).toBeDefined();

    const input = BenefitsSimulatorInputSchema.parse(scenario!.input);
    const first = await registry.execute('benefits-simulator', input, {
      sessionId: 'sess_benefits',
    });
    const second = await registry.execute('benefits-simulator', input, {
      sessionId: 'sess_benefits',
    });
    expect(stripCalculatedAt(first.data)).toEqual(stripCalculatedAt(second.data));

    const recommendationsA = normalizeRecommendations({
      moduleId: 'benefits-simulator',
      payload: first.data,
    });
    const recommendationsB = normalizeRecommendations({
      moduleId: 'benefits-simulator',
      payload: second.data,
    });

    expect(recommendationsA).toEqual(recommendationsB);
    expect(recommendationsA.length).toBeGreaterThan(0);
  });
});
