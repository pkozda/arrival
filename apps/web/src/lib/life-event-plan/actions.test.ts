import { describe, expect, it } from 'vitest';
import { buildLifeEventPlan, CLASSIFIER_FIXTURES } from '@arrival-atlas/modules/life-event';
import {
  collectActionSurfaceNodeIds,
  EMPTY_ACTION_SURFACE,
  projectActionSurface,
  projectHomeNextSteps,
  projectLifeEventPage,
} from '@/lib/life-event-plan';

const GENERATED_AT = '2026-06-20T12:00:00.000Z';

function buildFixturePlan(fixtureId: string) {
  const fixture = CLASSIFIER_FIXTURES.find((entry) => entry.id === fixtureId);
  if (!fixture) {
    throw new Error(`Missing fixture ${fixtureId}`);
  }

  return buildLifeEventPlan({
    userContext: fixture.userContext,
    generatedAt: GENERATED_AT,
  });
}

describe('projectActionSurface', () => {
  for (const fixture of CLASSIFIER_FIXTURES) {
    it(`${fixture.id} maps deterministically to ActionSurfaceV1`, () => {
      const plan = buildLifeEventPlan({
        userContext: fixture.userContext,
        generatedAt: GENERATED_AT,
      });
      const first = projectActionSurface(plan);
      const second = projectActionSurface(plan);

      expect(first).toEqual(second);
      expect(first.primaryAction).toEqual(plan.currentFocus);
      expect(first.secondaryActions).toEqual(
        plan.nextBestActions
          .filter(
            (node) =>
              node.id !== plan.currentFocus.id &&
              !plan.activeBlocks.some((blocker) => blocker.id === node.id)
          )
          .filter((node, index, array) => array.findIndex((entry) => entry.id === node.id) === index)
          .slice(0, 3)
      );
      expect(first.blockedActions).toEqual(plan.activeBlocks);
    });
  }

  it('returns empty surface for invalid plan input', () => {
    expect(projectActionSurface({} as never)).toEqual(EMPTY_ACTION_SURFACE);
  });

  it('never duplicates node ids across action categories', () => {
    for (const fixture of CLASSIFIER_FIXTURES) {
      const plan = buildLifeEventPlan({
        userContext: fixture.userContext,
        generatedAt: GENERATED_AT,
      });
      const surface = projectActionSurface(plan);
      const ids = collectActionSurfaceNodeIds(surface);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('keeps blocked actions out of secondary actions', () => {
    for (const fixture of CLASSIFIER_FIXTURES) {
      const plan = buildLifeEventPlan({
        userContext: fixture.userContext,
        generatedAt: GENERATED_AT,
      });
      const surface = projectActionSurface(plan);
      const blockedIds = new Set(surface.blockedActions.map((node) => node.id));

      for (const action of surface.secondaryActions) {
        expect(blockedIds.has(action.id)).toBe(false);
      }
    }
  });

  it('derives contextual actions only from future actionable timeline nodes', () => {
    const plan = buildFixturePlan('F02');
    const surface = projectActionSurface(plan);
    const reserved = new Set([
      surface.primaryAction?.id,
      ...surface.secondaryActions.map((node) => node.id),
      ...surface.blockedActions.map((node) => node.id),
    ]);

    for (const node of surface.contextualActions) {
      expect(reserved.has(node.id)).toBe(false);
      expect(node.actions.length).toBeGreaterThan(0);
      expect(node.satisfied).toBe(false);
      expect(plan.timeline.some((timelineNode) => timelineNode.id === node.id)).toBe(true);
    }
  });
});

describe('LE-3 presentation regression', () => {
  for (const fixture of CLASSIFIER_FIXTURES) {
    it(`${fixture.id} preserves LE-3 home projection`, () => {
      const plan = buildLifeEventPlan({
        userContext: fixture.userContext,
        generatedAt: GENERATED_AT,
      });
      const projection = projectHomeNextSteps(plan);

      expect(projection.focus).toEqual(plan.currentFocus);
      expect(projection.nextActions).toEqual(plan.nextBestActions.slice(0, 4));
      expect(projection.blockers).toEqual(plan.activeBlocks);
    });

    it(`${fixture.id} preserves LE-3 module page projection`, () => {
      const plan = buildLifeEventPlan({
        userContext: fixture.userContext,
        generatedAt: GENERATED_AT,
      });
      const projection = projectLifeEventPage(plan);

      expect(projection.focus).toEqual(plan.currentFocus);
      expect(projection.nextActions).toEqual(plan.nextBestActions.slice(0, 5));
      expect(projection.activeBlocks).toEqual(plan.activeBlocks);
      expect(projection.timeline).toEqual(plan.timeline);
    });
  }
});
