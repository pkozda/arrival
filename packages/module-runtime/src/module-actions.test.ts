import { afterEach, describe, expect, it } from 'vitest';
import type { ModuleExecutionResult } from '@arrivalos/core';
import { ModuleRegistry } from '@arrivalos/core';
import { registerAllModules } from '@arrivalos/modules';
import { BenefitsSimulatorInputSchema } from '@arrivalos/modules';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModuleResultEnvelope } from './enrichment/buildModuleResultEnvelope.js';
import { enrichModuleResultActions } from './enrichment/enrichModuleResultActions.js';
import { sealModuleResult } from './enrichment/sealModuleResult.js';
import { wrapLegacyExecutionResult } from './adapters/wrapLegacyExecutionResult.js';
import {
  buildActionItems,
  extractActionSources,
} from './normalizers/actions/buildActionItems.js';
import { mapActionKind } from './normalizers/actions/action-sources.js';
import { isMrcEnvelopeEnabled } from './config/mrc-envelope.js';

const financialLegacy: ModuleExecutionResult = {
  moduleId: 'financial-reality',
  version: '2.0.0',
  success: true,
  executedAt: '2026-06-16T12:00:00.000Z',
  data: {
    meta: { confidence: 'high' },
    decisions: [
      {
        title: 'Tax class review',
        description: 'Review Steuerklassen options.',
        priority: 'high',
        action: 'Contact Finanzamt about Steuerklassenwechsel',
      },
      {
        title: 'Malformed',
        description: 'Missing action',
      },
      {
        title: 'Upload docs',
        description: 'Provide required documents.',
        priority: 'low',
        action: 'Upload income documents',
      },
    ],
  },
};

describe('mapActionKind', () => {
  it('maps known patterns deterministically', () => {
    expect(mapActionKind('Contact Finanzamt')).toBe('contact');
    expect(mapActionKind('Apply for Wohngeld')).toBe('apply');
    expect(mapActionKind('Upload income documents')).toBe('collect-documents');
    expect(mapActionKind('Schedule appointment')).toBe('schedule');
    expect(mapActionKind('Do something unusual')).toBe('custom');
  });
});

describe('extractActionSources', () => {
  it('extracts financial-reality decisions with non-empty action', () => {
    const sources = extractActionSources('financial-reality', financialLegacy.data);
    expect(sources).toHaveLength(2);
    expect(sources[0]?.sourceRecord).toBe('decisions');
    expect(sources[0]?.sourceId).toBe('financial-decision-0');
  });

  it('extracts benefits-simulator riskWarnings and recommendations actions', () => {
    const sources = extractActionSources('benefits-simulator', {
      riskWarnings: [
        {
          id: 'warn-1',
          severity: 'critical',
          title: 'Legal risk',
          description: 'Review legal exposure.',
          category: 'legal',
          action: 'Contact Jobcenter',
        },
      ],
      recommendations: [
        {
          id: 'rec-1',
          title: 'Apply path',
          description: 'Submit application.',
          priority: 'high',
          rationale: 'Eligible.',
          action: 'Apply for support',
        },
      ],
    });

    expect(sources).toHaveLength(2);
    expect(sources.map((source) => source.sourceRecord).sort()).toEqual([
      'recommendations',
      'riskWarnings',
    ]);
  });

  it('returns empty sources for unknown modules', () => {
    expect(extractActionSources('life-event', { decisions: [{ action: 'x' }] })).toEqual([]);
  });
});

describe('buildActionItems', () => {
  it('produces deterministic sorted actions', () => {
    const first = buildActionItems({
      moduleId: 'financial-reality',
      payload: financialLegacy.data,
    });
    const second = buildActionItems({
      moduleId: 'financial-reality',
      payload: financialLegacy.data,
    });

    expect(first).toEqual(second);
    expect(first[0]?.priority).toBe('high');
    expect(first[0]?.kind).toBe('contact');
    expect(first[0]?.id).toBe('financial-reality:decisions:financial-decision-0');
  });

  it('deduplicates by kind+title+description+sourceId keeping higher priority', () => {
    const actions = buildActionItems({
      moduleId: 'financial-reality',
      payload: {
        decisions: [
          {
            id: 'decision-1',
            title: 'Tax class review',
            description: 'Review Steuerklassen options.',
            priority: 'low',
            action: 'Contact Finanzamt',
          },
          {
            id: 'decision-1',
            title: 'Tax class review',
            description: 'Review Steuerklassen options.',
            priority: 'high',
            action: 'Contact Finanzamt',
          },
        ],
      },
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.priority).toBe('high');
  });
});

describe('enrichModuleResultActions', () => {
  const previousExplanation = process.env.ARRIVALOS_MRC_EXPLANATION;

  afterEach(() => {
    if (previousExplanation === undefined) {
      delete process.env.ARRIVALOS_MRC_EXPLANATION;
    } else {
      process.env.ARRIVALOS_MRC_EXPLANATION = previousExplanation;
    }
  });

  it('does not add actions when explanation flag is off', () => {
    process.env.ARRIVALOS_MRC_EXPLANATION = 'false';
    const envelope = wrapLegacyExecutionResult(financialLegacy, { executionId: 'exec_1' });

    const enriched = enrichModuleResultActions(envelope, financialLegacy, {
      moduleId: 'financial-reality',
    });

    expect(enriched.actions).toBeUndefined();
  });

  it('adds actions when explanation flag is on', () => {
    process.env.ARRIVALOS_MRC_EXPLANATION = 'true';
    const envelope = wrapLegacyExecutionResult(financialLegacy, { executionId: 'exec_2' });

    const enriched = enrichModuleResultActions(envelope, financialLegacy, {
      moduleId: 'financial-reality',
    });

    expect(Array.isArray(enriched.actions)).toBe(true);
    expect(enriched.actions?.length).toBe(2);
  });
});

describe('MRC-4 envelope pipeline', () => {
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

  it('implicitly enables envelope when explanation is on (FLAG-01)', () => {
    delete process.env.ARRIVALOS_MRC_ENVELOPE;
    process.env.ARRIVALOS_MRC_EXPLANATION = 'true';
    expect(isMrcEnvelopeEnabled()).toBe(true);
  });

  it('omits actions when explanation is off', () => {
    process.env.ARRIVALOS_MRC_ENVELOPE = 'true';
    process.env.ARRIVALOS_MRC_EXPLANATION = 'false';

    const legacySnapshot = structuredClone(financialLegacy.data);
    const envelope = buildModuleResultEnvelope(
      financialLegacy,
      { executionId: 'exec_env_only' },
      {
        moduleId: 'financial-reality',
        mergedInput: {},
      }
    );

    expect(envelope?.actions).toBeUndefined();
    expect(financialLegacy.data).toEqual(legacySnapshot);
    expect(envelope?.payload).not.toBe(financialLegacy.data);
  });

  it('adds actions and isolates payload when explanation is on', () => {
    process.env.ARRIVALOS_MRC_ENVELOPE = 'true';
    process.env.ARRIVALOS_MRC_EXPLANATION = 'true';

    const legacySnapshot = structuredClone(financialLegacy.data);
    const envelope = buildModuleResultEnvelope(
      financialLegacy,
      { executionId: 'exec_actions' },
      {
        moduleId: 'financial-reality',
        mergedInput: {},
      }
    );

    expect(financialLegacy.data).toEqual(legacySnapshot);
    expect(envelope?.payload).not.toBe(financialLegacy.data);
    expect(Array.isArray(envelope?.actions)).toBe(true);
    expect(envelope?.actions?.length).toBe(2);
    expect(envelope?.recommendations).toBeDefined();
    expect(envelope?.explanation).toBeDefined();
  });

  it('produces deterministic actions for benefits simulator fixture', async () => {
    process.env.ARRIVALOS_MRC_ENVELOPE = 'true';
    process.env.ARRIVALOS_MRC_EXPLANATION = 'true';

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
    const legacy = await registry.execute('benefits-simulator', input, {
      sessionId: 'sess_actions',
    });

    const envelopeA = buildModuleResultEnvelope(
      legacy,
      { executionId: 'exec_a' },
      { moduleId: 'benefits-simulator', mergedInput: input as Record<string, unknown> }
    );
    const envelopeB = buildModuleResultEnvelope(
      legacy,
      { executionId: 'exec_b' },
      { moduleId: 'benefits-simulator', mergedInput: input as Record<string, unknown> }
    );

    expect(envelopeA?.actions).toEqual(envelopeB?.actions);
  });
});

describe('sealModuleResult', () => {
  it('deep clones payload and actions', () => {
    const legacyData = { value: 1 };
    const envelope = {
      status: 'success' as const,
      meta: {
        moduleId: 'financial-reality',
        moduleVersion: '2.0.0',
        runtimeContractVersion: '1.0' as const,
        executionId: 'exec_seal',
        executedAt: '2026-06-16T12:00:00.000Z',
        confidence: 'medium' as const,
      },
      payload: legacyData,
      actions: [
        {
          id: 'financial-reality:decisions:financial-decision-0',
          kind: 'contact' as const,
          title: 'Contact',
          description: 'Contact office',
          priority: 'high' as const,
        },
      ],
    };

    const sealed = sealModuleResult(envelope, legacyData);
    expect(sealed.payload).not.toBe(legacyData);
    expect(sealed.payload).toEqual(legacyData);
    expect(sealed.actions).not.toBe(envelope.actions);
    expect(sealed.actions).toEqual(envelope.actions);
  });
});
