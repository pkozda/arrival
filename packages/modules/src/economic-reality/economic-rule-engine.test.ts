import { describe, expect, it } from 'vitest';
import { parseEconomicEvaluationV1 } from '@arrival-atlas/product-contract';
import { evaluate } from './rule-engine/evaluate.js';
import { ECONOMIC_FIXTURES, pickEconomicFixtureSummary } from './fixtures.js';

describe('evaluate() EP-1 rule engine', () => {
  for (const fixture of ECONOMIC_FIXTURES) {
    it(`${fixture.id} → ${fixture.expected.economicState}`, () => {
      const evaluation = evaluate(fixture.userContext);

      expect(evaluation.economicState).toBe(fixture.expected.economicState);
      expect(evaluation.supportSystem).toBe(fixture.expected.supportSystem);
      expect(evaluation).not.toHaveProperty('graphHint');

      const winningRule = evaluation.appliedRules.find((rule) => rule.matched);
      expect(winningRule?.id).toBe(fixture.expected.winningRule);

      const priorRules = evaluation.appliedRules.slice(
        0,
        evaluation.appliedRules.findIndex((rule) => rule.matched)
      );
      for (const rule of priorRules) {
        expect(rule.matched).toBe(false);
      }
    });
  }

  it('is deterministic for identical input', () => {
    const fixture = ECONOMIC_FIXTURES[0]!;
    const first = evaluate(fixture.userContext);
    const second = evaluate(fixture.userContext);
    expect(second).toEqual(first);
  });

  it('parses through product contract schema', () => {
    const fixture = ECONOMIC_FIXTURES[4]!;
    const evaluation = evaluate(fixture.userContext);
    expect(() => parseEconomicEvaluationV1(evaluation)).not.toThrow();
  });

  it('always includes axes', () => {
    for (const fixture of ECONOMIC_FIXTURES) {
      const evaluation = evaluate(fixture.userContext);
      expect(evaluation.axes.incomeAxis).toMatch(/^(none|low|stable)$/);
      expect(evaluation.axes.employmentAxis).toMatch(/^(unemployed|transition|employed)$/);
      expect(evaluation.axes.institutionAxis).toMatch(/^(none|jobcenter|sozialamt)$/);
    }
  });

  it('FIRST MATCH WINS — only one matched rule in trace', () => {
    for (const fixture of ECONOMIC_FIXTURES) {
      const evaluation = evaluate(fixture.userContext);
      const matched = evaluation.appliedRules.filter((rule) => rule.matched);
      expect(matched).toHaveLength(1);
    }
  });

  it('EF_R7_FALLBACK exercises explicit R7 catch-all', () => {
    const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === 'EF_R7_FALLBACK')!;
    const evaluation = evaluate(fixture.userContext);
    expect(evaluation.appliedRules.find((rule) => rule.matched)?.id).toBe('R7');
    expect(evaluation.economicState).toBe('unemployment_transition');
  });
});

describe('fixture summary helper', () => {
  it('matches evaluate output for EF08', () => {
    const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === 'EF08')!;
    const evaluation = evaluate(fixture.userContext);
    expect(pickEconomicFixtureSummary(evaluation)).toMatchObject(fixture.expected);
  });
});
