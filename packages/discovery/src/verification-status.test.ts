import { describe, expect, it } from 'vitest';
import { deriveVerificationStatus } from './invariants/verification-status.js';
import type { VerificationCheck } from './types/verification.js';

function check(
  id: string,
  outcome: VerificationCheck['outcome'],
  required: boolean
): VerificationCheck {
  return { id, outcome, required };
}

describe('deriveVerificationStatus', () => {
  it('all required TRUE → PASS', () => {
    expect(
      deriveVerificationStatus([
        check('a', 'TRUE', true),
        check('b', 'TRUE', true),
        check('c', 'UNKNOWN', false),
      ])
    ).toBe('PASS');
  });

  it('required FALSE → FAIL', () => {
    expect(
      deriveVerificationStatus([
        check('a', 'TRUE', true),
        check('b', 'FALSE', true),
      ])
    ).toBe('FAIL');
  });

  it('required UNKNOWN → UNKNOWN (not PASS)', () => {
    expect(
      deriveVerificationStatus([
        check('a', 'TRUE', true),
        check('b', 'UNKNOWN', true),
      ])
    ).toBe('UNKNOWN');
  });

  it('optional UNKNOWN does not prevent PASS', () => {
    expect(
      deriveVerificationStatus([
        check('a', 'TRUE', true),
        check('optional', 'UNKNOWN', false),
      ])
    ).toBe('PASS');
  });

  it('UNKNOWN !== PASS', () => {
    const status = deriveVerificationStatus([check('official_source', 'UNKNOWN', true)]);
    expect(status).toBe('UNKNOWN');
    expect(status).not.toBe('PASS');
  });
});
