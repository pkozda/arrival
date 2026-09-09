import type { DiscoveryProfile } from '../types/profile.js';
import type { ScheduledRunRecord } from '../scheduler/types.js';
import { NON_AUTOMATIC_NEXT_RUN_AT } from './schedule-projection.js';
import {
  buildProfileRunSummaryFields,
  type DiscoveryExecutionLifecycle,
} from './execution-lifecycle.js';

export type DiscoveryAutomationCadence = 'manual' | 'daily' | 'weekly';

export type ProfileAutomationSummary = {
  cadence: DiscoveryAutomationCadence;
  /** True when the profile intends daily automatic execution (cadence + enabled). */
  automaticExecution: boolean;
  /** Authoritative next due instant, or null when unknown / not automatically due. */
  nextRunAt: string | null;
  hourUtc: number | null;
  profileEnabled: boolean;
  delivery: {
    emailEnabled: boolean;
    skipEmptyDigest: boolean;
  };
  lastRunTrigger: 'manual' | 'scheduled' | null;
};

export type ProfileRunSummaryWithAutomation = {
  profileId: string;
  lastRun: ScheduledRunRecord | null;
  lifecycle: DiscoveryExecutionLifecycle;
  applicableResultCount: number;
  automation: ProfileAutomationSummary;
};

function isAutomaticNextRunAt(nextRunAt: string | null | undefined): nextRunAt is string {
  if (!nextRunAt) return false;
  if (nextRunAt === NON_AUTOMATIC_NEXT_RUN_AT) return false;
  const ms = Date.parse(nextRunAt);
  return Number.isFinite(ms);
}

/**
 * Build automation view from profile + optional operational schedule nextRunAt.
 */
export function buildProfileAutomationSummary(input: {
  profile: DiscoveryProfile;
  operationalNextRunAt?: string | null;
  lastRun?: ScheduledRunRecord | null;
}): ProfileAutomationSummary {
  const cadence = input.profile.schedule.cadence;
  const hourUtc =
    cadence === 'daily' || cadence === 'weekly' ? input.profile.schedule.hourUtc : null;
  const automaticExecution = cadence === 'daily' && input.profile.enabled;
  const nextRunAt =
    automaticExecution && isAutomaticNextRunAt(input.operationalNextRunAt)
      ? input.operationalNextRunAt
      : null;

  return {
    cadence,
    automaticExecution,
    nextRunAt,
    hourUtc,
    profileEnabled: input.profile.enabled,
    delivery: {
      emailEnabled: input.profile.notification.emailEnabled,
      skipEmptyDigest: input.profile.notification.skipEmptyDigest,
    },
    lastRunTrigger: input.lastRun?.trigger ?? null,
  };
}

export function buildProfileRunSummaryWithAutomation(input: {
  profile: DiscoveryProfile;
  lastRun: ScheduledRunRecord | null;
  results: ReadonlyArray<{ promotedFromRunId?: string }>;
  operationalNextRunAt?: string | null;
}): ProfileRunSummaryWithAutomation {
  const base = buildProfileRunSummaryFields({
    profileId: input.profile.id,
    lastRun: input.lastRun,
    results: input.results,
  });
  return {
    ...base,
    automation: buildProfileAutomationSummary({
      profile: input.profile,
      operationalNextRunAt: input.operationalNextRunAt,
      lastRun: input.lastRun,
    }),
  };
}
