import { describe, expect, it } from 'vitest';
import type { EconomicGraphId, EconomicGraphVariant } from '@arrival-atlas/product-contract';
import { evaluate } from './rule-engine/evaluate.js';
import { resolveGraphContext } from './graph/resolve-graph.js';
import { isValidEntryNodeId } from './graph/entry-nodes.js';
import { isForbiddenGraphTransition } from './graph/mappings.js';
import { ECONOMIC_FIXTURES } from './fixtures.js';

type GraphExpectation = {
  graphId: EconomicGraphId;
  variant?: EconomicGraphVariant;
  entryNodeId: string;
};

const EP2_GRAPH_EXPECTATIONS: Record<string, GraphExpectation> = {
  EF01: { graphId: 'G1', variant: 'A', entryNodeId: 'g1-income-assess' },
  EF02: { graphId: 'G4', entryNodeId: 'g4-offer-evaluation' },
  EF03: { graphId: 'G2', entryNodeId: 'g2-registration' },
  EF04: { graphId: 'G2', entryNodeId: 'g2-registration' },
  EF05: { graphId: 'G3', entryNodeId: 'g3-reporting' },
  EF06: { graphId: 'G3', entryNodeId: 'g3-reporting' },
  EF07: { graphId: 'G5', entryNodeId: 'g5-immediate-needs' },
  EF08: { graphId: 'G6', entryNodeId: 'g6-status-confirm' },
  EF09: { graphId: 'G6', entryNodeId: 'g6-status-confirm' },
  EF10: { graphId: 'G2', entryNodeId: 'g2-registration' },
  EF11: { graphId: 'G5', entryNodeId: 'g5-immediate-needs' },
  EF12: { graphId: 'G2', entryNodeId: 'g2-registration' },
  EF13: { graphId: 'G3', entryNodeId: 'g3-reporting' },
  EF14: { graphId: 'G3', entryNodeId: 'g3-reporting' },
  EF15: { graphId: 'G1', variant: 'A', entryNodeId: 'g1-income-assess' },
  EF16: { graphId: 'G1', variant: 'A', entryNodeId: 'g1-income-assess' },
  EF17: { graphId: 'G5', entryNodeId: 'g5-immediate-needs' },
  EF18: { graphId: 'G6', entryNodeId: 'g6-status-confirm' },
  EF19: { graphId: 'G1', variant: 'A', entryNodeId: 'g1-income-assess' },
  EF20: { graphId: 'G5', entryNodeId: 'g5-immediate-needs' },
  EF21: { graphId: 'G3', entryNodeId: 'g3-reporting' },
  EF22: { graphId: 'G3', entryNodeId: 'g3-reporting' },
  EF23: { graphId: 'G2', entryNodeId: 'g2-registration' },
  EF24: { graphId: 'G1', variant: 'B', entryNodeId: 'g1-enter-system' },
};

describe('resolveGraphContext EP-2 graph determinism', () => {
  for (const fixture of ECONOMIC_FIXTURES) {
    const expected = EP2_GRAPH_EXPECTATIONS[fixture.id];
    if (!expected) {
      continue;
    }

    it(`${fixture.id} → ${expected.graphId}${expected.variant ? `-${expected.variant}` : ''}`, () => {
      const evaluation = evaluate(fixture.userContext);
      const context = resolveGraphContext(evaluation);

      expect(context.graphId).toBe(expected.graphId);
      if (expected.variant) {
        expect(context.variant).toBe(expected.variant);
      } else {
        expect(context.variant).toBeUndefined();
      }
      expect(context.entryNodeId).toBe(expected.entryNodeId);
      expect(isValidEntryNodeId(context.entryNodeId)).toBe(true);

      expect(context.reasoning.ruleTrace.length).toBeGreaterThanOrEqual(2);
      expect(context.reasoning.ruleTrace[0]).toMatch(/^STATE_MAP:E\d+→/);
      expect(context.reasoning.ruleTrace).toContain(`ENTRY_NODE:${expected.entryNodeId}`);

      const matchedRules = evaluation.appliedRules.filter((rule) => rule.matched);
      for (const rule of matchedRules) {
        expect(context.reasoning.ruleTrace).toContain(`RULE:${rule.id}`);
      }
    });
  }

  it('is deterministic for identical evaluation', () => {
    const evaluation = evaluate(ECONOMIC_FIXTURES[0]!.userContext);
    const first = resolveGraphContext(evaluation);
    const second = resolveGraphContext(evaluation);
    expect(second).toEqual(first);
  });

  it('acceptance: EF01 → G1-A', () => {
    const evaluation = evaluate(ECONOMIC_FIXTURES.find((f) => f.id === 'EF01')!.userContext);
    const context = resolveGraphContext(evaluation);
    expect(context.graphId).toBe('G1');
    expect(context.variant).toBe('A');
  });

  it('acceptance: EF13 → G3 (E4 primary, G4 overlay deferred)', () => {
    const evaluation = evaluate(ECONOMIC_FIXTURES.find((f) => f.id === 'EF13')!.userContext);
    const context = resolveGraphContext(evaluation);
    expect(context.graphId).toBe('G3');
  });

  it('flags forbidden E5 → G3 transitions', () => {
    expect(isForbiddenGraphTransition('benefits_sozialamt', 'G3')).toBe(true);
    expect(isForbiddenGraphTransition('financial_crisis', 'G3')).toBe(true);
    expect(isForbiddenGraphTransition('self_sustained', 'G5')).toBe(true);
    expect(isForbiddenGraphTransition('benefits_sozialamt', 'G6')).toBe(false);
  });
});
