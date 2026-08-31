import { describe, expect, it } from 'vitest';
import {
  requiredSatisfied,
  optionalBlocks,
  isTriState,
  type TriState,
} from './types/tri-state.js';

describe('TriState', () => {
  it('recognizes TRUE / FALSE / UNKNOWN', () => {
    expect(isTriState('TRUE')).toBe(true);
    expect(isTriState('FALSE')).toBe(true);
    expect(isTriState('UNKNOWN')).toBe(true);
    expect(isTriState(true)).toBe(false);
    expect(isTriState('yes')).toBe(false);
  });

  it('requiredSatisfied only for TRUE', () => {
    const values: TriState[] = ['TRUE', 'FALSE', 'UNKNOWN'];
    expect(values.map(requiredSatisfied)).toEqual([true, false, false]);
  });

  it('UNKNOWN never satisfies a required criterion', () => {
    expect(requiredSatisfied('UNKNOWN')).toBe(false);
  });

  it('optionalBlocks only for FALSE', () => {
    expect(optionalBlocks('FALSE')).toBe(true);
    expect(optionalBlocks('UNKNOWN')).toBe(false);
    expect(optionalBlocks('TRUE')).toBe(false);
  });
});
