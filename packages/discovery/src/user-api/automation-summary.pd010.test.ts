import { describe, expect, it } from 'vitest';
import type { DiscoveryProfile } from '../types/profile.js';
import {
  buildProfileAutomationSummary,
  buildProfileRunSummaryWithAutomation,
} from './automation-summary.js';
import { NON_AUTOMATIC_NEXT_RUN_AT } from './schedule-projection.js';

function profile(
  partial: Partial<DiscoveryProfile> &
    Pick<DiscoveryProfile, 'schedule' | 'notification' | 'enabled'>
): DiscoveryProfile {
  return {
    id: 'p1',
    userId: 'u1',
    name: 'Jobs',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteria: { required: [], preferred: [], excluded: [], flexible: [] },
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
    ...partial,
  };
}

describe('PD-010 discovery automation summary', () => {
  it('A/B — daily enabled exposes automaticExecution and nextRunAt', () => {
    const automation = buildProfileAutomationSummary({
      profile: profile({
        enabled: true,
        schedule: { cadence: 'daily', hourUtc: 6 },
        notification: { emailEnabled: true, skipEmptyDigest: true },
      }),
      operationalNextRunAt: '2026-09-09T06:00:00.000Z',
    });
    expect(automation.cadence).toBe('daily');
    expect(automation.automaticExecution).toBe(true);
    expect(automation.nextRunAt).toBe('2026-09-09T06:00:00.000Z');
    expect(automation.delivery.skipEmptyDigest).toBe(true);
  });

  it('B — manual is not automatic', () => {
    const automation = buildProfileAutomationSummary({
      profile: profile({
        enabled: true,
        schedule: { cadence: 'manual' },
        notification: { emailEnabled: false, skipEmptyDigest: true },
      }),
      operationalNextRunAt: NON_AUTOMATIC_NEXT_RUN_AT,
    });
    expect(automation.automaticExecution).toBe(false);
    expect(automation.nextRunAt).toBeNull();
  });

  it('placeholder nextRunAt is not exposed as real', () => {
    const automation = buildProfileAutomationSummary({
      profile: profile({
        enabled: true,
        schedule: { cadence: 'daily', hourUtc: 8 },
        notification: { emailEnabled: true, skipEmptyDigest: true },
      }),
      operationalNextRunAt: NON_AUTOMATIC_NEXT_RUN_AT,
    });
    expect(automation.automaticExecution).toBe(true);
    expect(automation.nextRunAt).toBeNull();
  });

  it('disabled profile is not automatic even with daily cadence', () => {
    const automation = buildProfileAutomationSummary({
      profile: profile({
        enabled: false,
        schedule: { cadence: 'daily', hourUtc: 6 },
        notification: { emailEnabled: true, skipEmptyDigest: true },
      }),
      operationalNextRunAt: '2026-09-09T06:00:00.000Z',
    });
    expect(automation.automaticExecution).toBe(false);
  });

  it('run summary includes lifecycle + automation', () => {
    const summary = buildProfileRunSummaryWithAutomation({
      profile: profile({
        enabled: true,
        schedule: { cadence: 'manual' },
        notification: { emailEnabled: true, skipEmptyDigest: true },
      }),
      lastRun: null,
      results: [],
    });
    expect(summary.lifecycle).toBe('IDLE');
    expect(summary.automation.cadence).toBe('manual');
  });
});
