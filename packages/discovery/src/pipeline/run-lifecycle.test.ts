import { describe, expect, it } from 'vitest';
import {
  canTransitionRun,
  transitionRun,
  isTerminalRunStatus,
  RunLifecycleError,
} from './run-lifecycle.js';
import type { DiscoveryRun } from '../types/run.js';

function run(status: DiscoveryRun['status']): DiscoveryRun {
  return {
    id: 'r1',
    profileId: 'p1',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteriaSnapshot: { required: [], preferred: [], excluded: [], flexible: [] },
    startedAt: '2026-08-30T00:00:00.000Z',
    status,
    stats: {
      candidatesFound: 0,
      candidatesRejected: 0,
      candidatesVerified: 0,
      resultsCreated: 0,
      resultsUpdated: 0,
    },
  };
}

describe('run lifecycle', () => {
  it('allows PENDING → RUNNING → SUCCESS', () => {
    expect(canTransitionRun('PENDING', 'RUNNING')).toBe(true);
    expect(canTransitionRun('RUNNING', 'SUCCESS')).toBe(true);
    const next = transitionRun(transitionRun(run('PENDING'), 'RUNNING'), 'SUCCESS', 't');
    expect(next.status).toBe('SUCCESS');
    expect(next.finishedAt).toBe('t');
  });

  it('allows RUNNING → PARTIAL_SUCCESS | FAILED | CANCELLED', () => {
    expect(canTransitionRun('RUNNING', 'PARTIAL_SUCCESS')).toBe(true);
    expect(canTransitionRun('RUNNING', 'FAILED')).toBe(true);
    expect(canTransitionRun('RUNNING', 'CANCELLED')).toBe(true);
  });

  it('forbids terminal transitions', () => {
    expect(isTerminalRunStatus('SUCCESS')).toBe(true);
    expect(canTransitionRun('SUCCESS', 'RUNNING')).toBe(false);
    expect(() => transitionRun(run('FAILED'), 'SUCCESS')).toThrow(RunLifecycleError);
  });

  it('does not mutate original run', () => {
    const original = run('PENDING');
    const next = transitionRun(original, 'RUNNING');
    expect(original.status).toBe('PENDING');
    expect(next.status).toBe('RUNNING');
    expect(next).not.toBe(original);
  });
});
