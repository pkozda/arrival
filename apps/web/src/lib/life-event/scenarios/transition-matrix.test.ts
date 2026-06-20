import { describe, expect, it } from 'vitest';
import type { LifeStateId } from '@/lib/product-contract';
import {
  classifyTransitionType,
  compareScenarioCandidates,
  isTransitionAllowed,
  passesStabilityGuard,
  TRANSITION_MATRIX,
} from './state-transitions';

const ALL_STATES = Object.keys(TRANSITION_MATRIX) as LifeStateId[];

describe('transition matrix (LE-7)', () => {
  it('defines transitions for every life state', () => {
    for (const state of ALL_STATES) {
      expect(TRANSITION_MATRIX[state]).toBeDefined();
      expect(TRANSITION_MATRIX[state].length).toBeGreaterThan(0);
    }
  });

  it('only references valid life states', () => {
    for (const fromState of ALL_STATES) {
      for (const toState of TRANSITION_MATRIX[fromState]) {
        expect(ALL_STATES).toContain(toState);
      }
    }
  });

  it('enforces stability exit confidence guard', () => {
    expect(
      passesStabilityGuard({
        fromState: 'situation_stable',
        toState: 'economic_setup_pending',
        confidence: 0.5,
      })
    ).toBe(false);

    expect(
      passesStabilityGuard({
        fromState: 'situation_stable',
        toState: 'economic_setup_pending',
        confidence: 0.8,
      })
    ).toBe(true);
  });

  it('classifies hard vs soft transitions deterministically', () => {
    expect(classifyTransitionType('situation_stable', 'insurance_gap')).toBe('hard');
    expect(classifyTransitionType('arrival_stabilizing', 'economic_setup_pending')).toBe('soft');
    expect(classifyTransitionType('economic_setup_pending', 'economic_setup_pending')).toBe('none');
  });

  it('resolves candidate ordering deterministically', () => {
    const ordered = [
      { priority: 70, scenarioId: 'income_drop' },
      { priority: 90, scenarioId: 'job_loss' },
      { priority: 90, scenarioId: 'insurance_loss' },
    ].sort(compareScenarioCandidates);

    expect(ordered.map((entry) => entry.scenarioId)).toEqual([
      'insurance_loss',
      'job_loss',
      'income_drop',
    ]);
  });

  it('allows self-transitions for explanatory scenarios', () => {
    for (const state of ALL_STATES) {
      expect(isTransitionAllowed(state, state)).toBe(true);
    }
  });
});
