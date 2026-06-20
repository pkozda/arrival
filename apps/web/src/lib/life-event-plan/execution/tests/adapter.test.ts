import { describe, expect, it } from 'vitest';
import { buildLifeEventPlan, CLASSIFIER_FIXTURES } from '@arrival-atlas/modules/life-event';
import {
  projectActionSurface,
  type ActionSurfaceV1,
} from '@/lib/life-event-plan/actions';
import { buildExecutionSurface } from '@/lib/life-event-plan/execution/adapter';
import {
  assertExecutableNotBlocked,
  snapshotActionSurface,
} from '@/lib/life-event-plan/execution/guards';
import type { LifeEventPlanNode } from '@/lib/product-contract';

const GENERATED_AT = '2026-06-20T12:00:00.000Z';

function buildFixtureSurface(fixtureId: string): ActionSurfaceV1 {
  const fixture = CLASSIFIER_FIXTURES.find((entry) => entry.id === fixtureId);
  if (!fixture) {
    throw new Error(`Missing fixture ${fixtureId}`);
  }

  const plan = buildLifeEventPlan({
    userContext: fixture.userContext,
    generatedAt: GENERATED_AT,
  });

  return projectActionSurface(plan);
}

function collectExecutionIds(surface: ReturnType<typeof buildExecutionSurface>): string[] {
  const ids: string[] = [];
  if (surface.primary) {
    ids.push(surface.primary.id);
  }
  for (const action of surface.secondary) {
    ids.push(action.id);
  }
  for (const action of surface.contextual) {
    ids.push(action.id);
  }
  for (const action of surface.blocked) {
    ids.push(action.id);
  }
  return ids;
}

describe('buildExecutionSurface (AEAL)', () => {
  for (const fixture of CLASSIFIER_FIXTURES) {
    it(`${fixture.id} preserves action identity`, () => {
      const surface = buildFixtureSurface(fixture.id);
      const before = snapshotActionSurface(surface);
      const execution = buildExecutionSurface(surface);

      if (surface.primaryAction) {
        expect(execution.primary?.id).toBe(surface.primaryAction.id);
        expect(execution.primary?.label).toBe(surface.primaryAction.title);
        expect(execution.primary?.sourceNodeId).toBe(surface.primaryAction.id);
      }

      for (const [index, node] of surface.secondaryActions.entries()) {
        expect(execution.secondary[index]?.id).toBe(node.id);
        expect(execution.secondary[index]?.label).toBe(node.title);
      }

      expect(snapshotActionSurface(surface)).toEqual(before);
    });

    it(`${fixture.id} is deterministic`, () => {
      const surface = buildFixtureSurface(fixture.id);
      expect(buildExecutionSurface(surface)).toEqual(buildExecutionSurface(surface));
    });
  }

  it('never duplicates ids across execution categories', () => {
    for (const fixture of CLASSIFIER_FIXTURES) {
      const execution = buildExecutionSurface(buildFixtureSurface(fixture.id));
      const ids = collectExecutionIds(execution);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('keeps blocked actions out of executable sets', () => {
    for (const fixture of CLASSIFIER_FIXTURES) {
      const execution = buildExecutionSurface(buildFixtureSurface(fixture.id));
      const executable = [
        ...(execution.primary ? [execution.primary] : []),
        ...execution.secondary,
        ...execution.contextual,
      ];
      assertExecutableNotBlocked(executable, execution.blocked);

      const blockedIds = new Set(execution.blocked.map((action) => action.id));
      for (const action of executable) {
        expect(blockedIds.has(action.id)).toBe(false);
      }
    }
  });

  it('assigns execution states correctly', () => {
    const execution = buildExecutionSurface(buildFixtureSurface('F01'));

    if (execution.primary) {
      expect(execution.primary.executionState).toBe('ready');
      expect(execution.primary.source).toBe('primary');
    }

    for (const action of execution.secondary) {
      expect(action.executionState).toBe('ready');
      expect(action.source).toBe('secondary');
    }

    for (const action of execution.contextual) {
      expect(action.executionState).toBe('ready');
      expect(action.source).toBe('contextual');
    }

    for (const action of execution.blocked) {
      expect(action.executionState).toBe('disabled');
      expect(action.source).toBe('blocked');
    }
  });

  it('drops malformed actions without crashing', () => {
    const surface = buildFixtureSurface('F02');
    const malformed = {
      ...surface,
      secondaryActions: [
        ...surface.secondaryActions,
        { id: '', title: 'Invalid' } as LifeEventPlanNode,
        { id: 'bad-node', title: '' } as LifeEventPlanNode,
      ],
    };

    const execution = buildExecutionSurface(malformed);
    expect(execution.secondary.every((action) => action.id.length > 0)).toBe(true);
    expect(execution.secondary.some((action) => action.id === 'bad-node')).toBe(false);
  });

  it('defensively caps secondary actions at three items', () => {
    const surface = buildFixtureSurface('F02');
    const expanded = {
      ...surface,
      secondaryActions: [
        ...surface.secondaryActions,
        ...surface.secondaryActions,
        ...surface.secondaryActions,
      ],
    };

    const execution = buildExecutionSurface(expanded);
    expect(execution.secondary.length).toBeLessThanOrEqual(3);
  });

  it('does not mutate the input ActionSurfaceV1', () => {
    const surface = buildFixtureSurface('F04');
    const snapshot = snapshotActionSurface(surface);
    buildExecutionSurface(surface);
    expect(surface).toEqual(snapshot);
  });
});
