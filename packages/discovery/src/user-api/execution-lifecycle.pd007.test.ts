import { describe, expect, it } from 'vitest';
import type { ScheduledRunRecord } from '../scheduler/types.js';
import {
  countApplicableResultsForRun,
  deriveDiscoveryExecutionLifecycle,
  isActiveDiscoveryRunStatus,
  isTerminalDiscoveryRunStatus,
} from './execution-lifecycle.js';

function run(
  partial: Partial<ScheduledRunRecord> & Pick<ScheduledRunRecord, 'status'>
): ScheduledRunRecord {
  return {
    runId: partial.runId ?? 'run-1',
    scheduleId: partial.scheduleId ?? 'sched:p1',
    profileId: partial.profileId ?? 'p1',
    trigger: partial.trigger ?? 'manual',
    startedAt: partial.startedAt ?? '2026-09-08T12:00:00.000Z',
    finishedAt: partial.finishedAt,
    status: partial.status,
    skipReason: partial.skipReason,
    errorMessage: partial.errorMessage,
  };
}

describe('PD-007 discovery execution lifecycle', () => {
  it('A — no lastRun is IDLE (profile create ≠ execution)', () => {
    expect(
      deriveDiscoveryExecutionLifecycle({ lastRun: null, applicableResultCount: 0 })
    ).toBe('IDLE');
  });

  it('B — PENDING maps to QUEUED', () => {
    expect(
      deriveDiscoveryExecutionLifecycle({
        lastRun: run({ status: 'PENDING' }),
        applicableResultCount: 0,
      })
    ).toBe('QUEUED');
  });

  it('C — RUNNING stays RUNNING (not IDLE/ERROR)', () => {
    expect(
      deriveDiscoveryExecutionLifecycle({
        lastRun: run({ status: 'RUNNING' }),
        applicableResultCount: 0,
      })
    ).toBe('RUNNING');
    expect(isActiveDiscoveryRunStatus('RUNNING')).toBe(true);
    expect(isTerminalDiscoveryRunStatus('RUNNING')).toBe(false);
  });

  it('D — SUCCESS with applicable results', () => {
    expect(
      deriveDiscoveryExecutionLifecycle({
        lastRun: run({ status: 'SUCCESS', finishedAt: '2026-09-08T12:01:00.000Z' }),
        applicableResultCount: 2,
      })
    ).toBe('SUCCESS');
  });

  it('E — SUCCESS with zero applicable results is NO_RESULTS', () => {
    expect(
      deriveDiscoveryExecutionLifecycle({
        lastRun: run({ status: 'SUCCESS', finishedAt: '2026-09-08T12:01:00.000Z' }),
        applicableResultCount: 0,
      })
    ).toBe('NO_RESULTS');
  });

  it('F — FAILED/CANCELLED map to ERROR', () => {
    expect(
      deriveDiscoveryExecutionLifecycle({
        lastRun: run({ status: 'FAILED', errorMessage: 'boom' }),
        applicableResultCount: 0,
      })
    ).toBe('ERROR');
    expect(
      deriveDiscoveryExecutionLifecycle({
        lastRun: run({ status: 'CANCELLED' }),
        applicableResultCount: 0,
      })
    ).toBe('ERROR');
  });

  it('PARTIAL_SUCCESS with results is SUCCESS; without is NO_RESULTS', () => {
    expect(
      deriveDiscoveryExecutionLifecycle({
        lastRun: run({ status: 'PARTIAL_SUCCESS' }),
        applicableResultCount: 1,
      })
    ).toBe('SUCCESS');
    expect(
      deriveDiscoveryExecutionLifecycle({
        lastRun: run({ status: 'PARTIAL_SUCCESS' }),
        applicableResultCount: 0,
      })
    ).toBe('NO_RESULTS');
  });

  it('counts only results promoted from the run', () => {
    expect(
      countApplicableResultsForRun(
        [
          { promotedFromRunId: 'run-1' },
          { promotedFromRunId: 'run-2' },
          { promotedFromRunId: 'run-1' },
          {},
        ],
        'run-1'
      )
    ).toBe(2);
  });
});
