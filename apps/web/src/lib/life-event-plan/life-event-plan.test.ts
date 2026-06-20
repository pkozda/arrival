import { describe, expect, it } from 'vitest';
import { buildLifeEventPlan, CLASSIFIER_FIXTURES } from '@arrival-atlas/modules/life-event';
import {
  formatLifeStateLabel,
  projectHomeNextSteps,
  projectLifeEventPage,
} from '@/lib/life-event-plan';

describe('life event plan presentation', () => {
  for (const fixture of CLASSIFIER_FIXTURES) {
    it(`${fixture.id} projects home next steps without reordering`, () => {
      const plan = buildLifeEventPlan({
        userContext: fixture.userContext,
        generatedAt: '2026-06-20T12:00:00.000Z',
      });
      const projection = projectHomeNextSteps(plan);

      expect(projection.focus).toEqual(plan.currentFocus);
      expect(projection.nextActions).toEqual(plan.nextBestActions.slice(0, 4));
      expect(projection.blockers).toEqual(plan.activeBlocks);
      expect(projection.showBlockers).toBe(plan.activeBlocks.length > 0);
    });

    it(`${fixture.id} projects module page deterministically`, () => {
      const plan = buildLifeEventPlan({
        userContext: fixture.userContext,
        generatedAt: '2026-06-20T12:00:00.000Z',
      });
      const first = projectLifeEventPage(plan);
      const second = projectLifeEventPage(plan);

      expect(first).toEqual(second);
      expect(first.focus).toEqual(plan.currentFocus);
      expect(first.whyThisNow).toEqual(plan.reasoning.whyThisNow);
      expect(first.nextActions).toEqual(plan.nextBestActions.slice(0, 5));
      expect(first.timeline).toEqual(plan.timeline);
      expect(first.lifeStateLabel).toBe(formatLifeStateLabel(plan.currentLifeState));
    });
  }

  it('hides blocker sections when plan has no blockers', () => {
    const fixture = CLASSIFIER_FIXTURES.find((entry) => entry.id === 'F10')!;
    const plan = buildLifeEventPlan({
      userContext: fixture.userContext,
      generatedAt: '2026-06-20T12:00:00.000Z',
    });
    const home = projectHomeNextSteps(plan);
    const page = projectLifeEventPage(plan);

    expect(home.showBlockers).toBe(false);
    expect(page.showActiveBlocks).toBe(false);
  });

  it('preserves empty nextBestActions without fabrication', () => {
    const plan = buildLifeEventPlan({
      userContext: CLASSIFIER_FIXTURES[0]!.userContext,
      generatedAt: '2026-06-20T12:00:00.000Z',
    });
    const emptyActionsPlan = { ...plan, nextBestActions: [] as typeof plan.nextBestActions };
    const home = projectHomeNextSteps(emptyActionsPlan);

    expect(home.nextActions).toEqual([]);
    expect(home.focus).toEqual(emptyActionsPlan.currentFocus);
  });
});

describe('fetchLifeEventPlan client contract', () => {
  it('targets the LE-2 plan endpoint only', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(join(__dirname, 'client.ts'), 'utf8');

    expect(source).toContain('/api/modules/life-event/plan');
    expect(source).not.toContain('buildLifeEventPlan');
    expect(source).not.toContain('classifyLifeState');
  });
});
