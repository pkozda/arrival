import { describe, expect, it } from 'vitest';
import type { ModuleUIProjection } from '../ModuleUIProjection.js';
import { buildUiSnapshotProjection } from './buildUiSnapshotProjection.js';
import { projectExecutionSnapshot } from './projectExecutionSnapshot.js';

const sampleProjection: ModuleUIProjection = {
  moduleId: 'financial-reality',
  title: 'Financial Reality',
  status: 'success',
  summary: 'Net income reviewed.',
  recommendations: [
    {
      title: 'Review tax class',
      description: 'Consider updating tax class.',
      priority: 'high',
    },
  ],
  actions: [
    {
      label: 'Contact Finanzamt',
      description: 'Schedule a consultation.',
      priority: 'high',
      kind: 'contact',
    },
    {
      label: 'Collect documents',
      description: 'Gather income statements.',
      priority: 'medium',
      kind: 'collect-documents',
    },
  ],
};

describe('buildUiSnapshotProjection', () => {
  it('builds projection-only snapshot payload without legacy fields', () => {
    const payload = buildUiSnapshotProjection([
      {
        moduleId: 'financial-reality',
        executionId: 'exec_1',
        timestamp: 1_700_000_000_000,
        projection: sampleProjection,
      },
    ]);

    expect(payload.executions).toHaveLength(1);
    expect(payload.executions[0]).toEqual({
      executionId: 'exec_1',
      moduleId: 'financial-reality',
      projection: sampleProjection,
      createdAt: new Date(1_700_000_000_000).toISOString(),
    });
    expect(payload.actionCards).toHaveLength(2);
    expect(payload.recommendations).toHaveLength(1);
    expect(payload.summaries).toEqual([
      {
        moduleId: 'financial-reality',
        status: 'success',
        summary: 'Net income reviewed.',
        recommendationCount: 1,
        actionCount: 2,
      },
    ]);
    expect(JSON.stringify(payload)).not.toContain('"result"');
    expect(JSON.stringify(payload)).not.toContain('"payload"');
  });

  it('skips executions without projection', () => {
    const payload = buildUiSnapshotProjection([
      {
        moduleId: 'financial-reality',
        executionId: 'exec_missing',
        timestamp: 1_700_000_000_000,
      },
    ]);

    expect(payload.executions).toEqual([]);
    expect(payload.actionCards).toEqual([]);
    expect(payload.recommendations).toEqual([]);
    expect(payload.summaries).toEqual([]);
  });

  it('is deterministic for identical inputs', () => {
    const inputs = [
      {
        moduleId: 'financial-reality',
        executionId: 'exec_1',
        timestamp: 1_700_000_000_000,
        projection: sampleProjection,
      },
      {
        moduleId: 'healthcare-navigation',
        executionId: 'exec_2',
        timestamp: 1_700_000_100_000,
        projection: {
          ...sampleProjection,
          moduleId: 'healthcare-navigation',
          title: 'Healthcare Navigation',
          actions: [],
        },
      },
    ];

    const first = buildUiSnapshotProjection(inputs);
    const second = buildUiSnapshotProjection(inputs);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe('projectExecutionSnapshot', () => {
  it('projects execution metadata without legacy envelope fields', () => {
    const snapshot = projectExecutionSnapshot({
      moduleId: 'financial-reality',
      executionId: 'exec_1',
      timestamp: 1_700_000_000_000,
      projection: sampleProjection,
    });

    expect(Object.keys(snapshot).sort()).toEqual(['createdAt', 'executionId', 'moduleId', 'projection']);
  });
});
