import { describe, expect, it } from 'vitest';
import { getAllGraphs } from './graph/catalog.js';
import { classifyLifeState } from './classify-life-state.js';
import { detectSecondaryConditions } from './detect-secondary-conditions.js';
import { buildLifeEventPlan } from './build-life-event-plan.js';
import { CLASSIFIER_FIXTURES } from './fixtures.js';

describe('classifyLifeState fixtures F01–F24', () => {
  for (const fixture of CLASSIFIER_FIXTURES) {
    it(`${fixture.id} → ${fixture.expectedPrimary}`, () => {
      const primary = classifyLifeState(fixture.userContext);
      expect(primary).toBe(fixture.expectedPrimary);
    });
  }
});

describe('detectSecondaryConditions fixtures', () => {
  for (const fixture of CLASSIFIER_FIXTURES) {
    if (!fixture.expectedSecondaries) {
      continue;
    }

    it(`${fixture.id} secondary conditions`, () => {
      const secondaries = detectSecondaryConditions(fixture.userContext);
      for (const expected of fixture.expectedSecondaries) {
        expect(secondaries).toContain(expected);
      }
    });
  }
});

describe('buildLifeEventPlan', () => {
  it('is deterministic for fixed input', () => {
    const fixture = CLASSIFIER_FIXTURES[0]!;
    const generatedAt = '2026-06-20T12:00:00.000Z';
    const first = buildLifeEventPlan({
      userContext: fixture.userContext,
      generatedAt,
    });
    const second = buildLifeEventPlan({
      userContext: fixture.userContext,
      generatedAt,
    });
    expect(first).toEqual(second);
  });

  it('produces valid plan shape for every fixture', () => {
    for (const fixture of CLASSIFIER_FIXTURES) {
      const plan = buildLifeEventPlan({
        userContext: fixture.userContext,
        generatedAt: '2026-06-20T12:00:00.000Z',
      });

      expect(plan.moduleId).toBe('life-event');
      expect(plan.currentLifeState).toBe(fixture.expectedPrimary);
      expect(plan.currentFocus).toBeDefined();
      expect(plan.nextBestActions.length).toBeGreaterThan(0);
      expect(plan.nextBestActions.length).toBeLessThanOrEqual(4);
      expect(plan.timeline.length).toBeGreaterThan(0);
      expect(plan.reasoning.whyThisNow.length).toBeGreaterThan(0);
    }
  });

  it('covers all seven life states across fixtures', () => {
    const states = new Set(
      CLASSIFIER_FIXTURES.map((fixture) => classifyLifeState(fixture.userContext))
    );
    expect(states.size).toBe(7);
  });
});

describe('graph catalog', () => {
  it('has one graph per life state', () => {
    const graphs = getAllGraphs();
    expect(graphs).toHaveLength(7);
    expect(new Set(graphs.map((graph) => graph.lifeStateId)).size).toBe(7);
  });
});
