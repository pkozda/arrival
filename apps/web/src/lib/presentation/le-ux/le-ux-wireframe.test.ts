import { describe, expect, it } from 'vitest';
import { buildLifeEventPlan, CLASSIFIER_FIXTURES } from '@arrival-atlas/modules/life-event';
import { projectActionSurface } from '@/lib/life-event-plan';
import {
  assertNoDuplicateWireframeNodes,
  collectWireframeNodeIds,
  normalizeWireframeSurface,
} from '@/lib/presentation/le-ux';

describe('LE-UX wireframe presentation layer', () => {
  for (const fixture of CLASSIFIER_FIXTURES) {
    it(`${fixture.id} preserves unique node IDs across wireframe sections`, () => {
      const plan = buildLifeEventPlan({
        userContext: fixture.userContext,
        generatedAt: '2026-06-20T12:00:00.000Z',
      });
      const surface = projectActionSurface(plan);

      expect(() => assertNoDuplicateWireframeNodes(surface)).not.toThrow();
      expect(collectWireframeNodeIds(surface).length).toBe(new Set(collectWireframeNodeIds(surface)).size);
    });

    it(`${fixture.id} caps secondary actions at three for wireframe breakdown`, () => {
      const plan = buildLifeEventPlan({
        userContext: fixture.userContext,
        generatedAt: '2026-06-20T12:00:00.000Z',
      });
      const surface = projectActionSurface(plan);

      expect(surface.secondaryActions.length).toBeLessThanOrEqual(3);
    });
  }

  it('keeps primary action separate from secondary and blocked buckets', () => {
    const plan = buildLifeEventPlan({
      userContext: CLASSIFIER_FIXTURES[0]!.userContext,
      generatedAt: '2026-06-20T12:00:00.000Z',
    });
    const surface = projectActionSurface(plan);
    const primaryId = surface.primaryAction?.id;

    if (!primaryId) {
      return;
    }

    expect(surface.secondaryActions.every((node) => node.id !== primaryId)).toBe(true);
    expect(surface.blockedActions.every((node) => node.id !== primaryId)).toBe(true);
    expect(surface.contextualActions.every((node) => node.id !== primaryId)).toBe(true);
  });

  it('sorts blocked actions by severity for wireframe breakdown', () => {
    const plan = buildLifeEventPlan({
      userContext: CLASSIFIER_FIXTURES[0]!.userContext,
      generatedAt: '2026-06-20T12:00:00.000Z',
    });
    const surface = normalizeWireframeSurface(projectActionSurface(plan));

    if (surface.blockedActions.length < 2) {
      return;
    }

    const rank = (priority: string) =>
      ({ critical: 0, high: 1, medium: 2, low: 3 })[priority] ?? 99;

    for (let index = 1; index < surface.blockedActions.length; index += 1) {
      const previous = surface.blockedActions[index - 1]!;
      const current = surface.blockedActions[index]!;
      expect(rank(previous.priority)).toBeLessThanOrEqual(rank(current.priority));
    }
  });
});
