import { describe, expect, it } from 'vitest';
import type { ModuleResult } from '@arrival-atlas/module-runtime';
import { projectModuleUI } from './projectModuleUI.js';
import type { ContractSnapshot } from './ContractSnapshot.js';

const snapshot: ContractSnapshot = {
  contractVersion: '1.0',
  moduleId: 'healthcare-navigation',
  title: 'Healthcare Navigation',
  version: '1.1.0',
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  capabilities: {
    recommendations: true,
    actions: false,
    explanation: true,
    riskModel: false,
  },
  metadata: {},
  frozenAt: '2026-09-08T00:00:00.000Z',
};

function sealed(partial: Partial<ModuleResult> & Pick<ModuleResult, 'status'>): ModuleResult {
  return {
    meta: {
      moduleId: 'healthcare-navigation',
      moduleVersion: '1.1.0',
      runtimeContractVersion: '1.0',
      executionId: 'exec_test',
      executedAt: '2026-09-08T00:00:00.000Z',
      confidence: 'medium',
    },
    recommendations: [],
    ...partial,
  };
}

describe('PD-003 healthcare ModuleUIProjection outcomes', () => {
  it('G — MORE_INFO_REQUIRED is distinguishable from empty success', () => {
    const projection = projectModuleUI(
      sealed({
        status: 'success',
        payload: {
          outcome: 'MORE_INFO_REQUIRED',
          insuranceAssumption: 'unknown',
          scenario: 'Additional insurance context required',
          steps: [],
          decisions: [],
          warnings: [],
          missing: [
            {
              field: 'insurance',
              reasonKey: 'healthcare.missing.insurance',
              profileHref: '/profile/health-insurance/edit',
            },
          ],
        },
      }),
      snapshot
    );

    expect(projection.outcome).toBe('MORE_INFO_REQUIRED');
    expect(projection.insuranceAssumption).toBe('unknown');
    expect(projection.missingContext?.[0]?.field).toBe('insurance');
    expect(projection.recommendations).toEqual([]);
    expect(projection.status).toBe('success');
  });

  it('D — NO_APPLICABLE_RESULT remains an explicit success outcome', () => {
    const projection = projectModuleUI(
      sealed({
        status: 'success',
        payload: {
          outcome: 'NO_APPLICABLE_RESULT',
          insuranceAssumption: 'insured',
          scenario: 'Evaluated with no guidance',
          steps: [],
          decisions: [],
          warnings: [],
          missing: [],
        },
      }),
      snapshot
    );

    expect(projection.outcome).toBe('NO_APPLICABLE_RESULT');
    expect(projection.status).toBe('success');
  });

  it('E — technical failure projects TECHNICAL_ERROR', () => {
    const projection = projectModuleUI(
      sealed({
        status: 'execution_error',
        error: 'Healthcare evaluator failed',
      }),
      snapshot
    );

    expect(projection.status).toBe('error');
    expect(projection.outcome).toBe('TECHNICAL_ERROR');
    expect(projection.error?.message).toBe('Healthcare evaluator failed');
  });

  it('F — RECOMMENDATIONS outcome carries scenario summary', () => {
    const projection = projectModuleUI(
      sealed({
        status: 'success',
        payload: {
          outcome: 'RECOMMENDATIONS',
          insuranceAssumption: 'insured',
          scenario: 'Finding and visiting a general practitioner',
          steps: [{ order: 1, title: 'Search for Hausarzt', description: 'Find a GP.' }],
          decisions: [],
          warnings: [],
          missing: [],
        },
        recommendations: [
          {
            id: 'healthcare-step-1',
            title: 'Search for Hausarzt',
            description: 'Find a GP.',
            priority: 'high',
            explanation: {
              summary: 'Find a GP.',
              confidence: 'medium',
              factors: [],
            },
          },
        ],
      }),
      snapshot
    );

    expect(projection.outcome).toBe('RECOMMENDATIONS');
    expect(projection.summary).toBe('Finding and visiting a general practitioner');
    expect(projection.recommendations).toHaveLength(1);
  });
});
