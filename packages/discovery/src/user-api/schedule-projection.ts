import type { DiscoveryService } from '../service/discovery-service.js';
import type { RegisterScheduleInput } from '../scheduler/types.js';
import type { DiscoveryProfile } from '../types/profile.js';
import { scheduleIdForProfile } from './profile-run.js';

/** Placeholder next run for manual/weekly profiles — not due under normal host ticks. */
export const NON_AUTOMATIC_NEXT_RUN_AT = '2099-01-01T00:00:00.000Z';

const SECONDS_PER_DAY = 86_400;

/**
 * Next UTC daily occurrence at `hourUtc` strictly after `now`.
 * UTC-only — no timezone or DST handling.
 */
export function nextDailyRunAtUtc(now: string, hourUtc: number): string {
  if (!Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23) {
    throw new Error('hourUtc must be an integer from 0 to 23');
  }
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) {
    throw new Error('Invalid now timestamp');
  }
  const nowDate = new Date(nowMs);
  let candidate = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate(),
    hourUtc,
    0,
    0,
    0
  );
  if (candidate <= nowMs) {
    candidate = Date.UTC(
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth(),
      nowDate.getUTCDate() + 1,
      hourUtc,
      0,
      0,
      0
    );
  }
  return new Date(candidate).toISOString();
}

/**
 * Project declarative DiscoveryProfile.schedule to operational RegisterScheduleInput.
 * Weekly cadence is stored on the profile but not auto-scheduled (deferred recurrence).
 */
export function buildOperationalScheduleRegistration(
  profile: DiscoveryProfile,
  now: string
): RegisterScheduleInput {
  const scheduleId = scheduleIdForProfile(profile.id);
  const base = {
    scheduleId,
    profileId: profile.id,
    strategyId: profile.strategyId,
    strategyVersion: profile.strategyVersion,
    timezone: 'UTC' as const,
    enabled: profile.enabled,
  };

  switch (profile.schedule.cadence) {
    case 'daily':
      return {
        ...base,
        intervalSeconds: SECONDS_PER_DAY,
        nextRunAt: nextDailyRunAtUtc(now, profile.schedule.hourUtc),
        metadata: {
          profileCadence: 'daily',
          hourUtc: String(profile.schedule.hourUtc),
        },
      };
    case 'weekly':
      return {
        ...base,
        intervalSeconds: SECONDS_PER_DAY,
        nextRunAt: NON_AUTOMATIC_NEXT_RUN_AT,
        metadata: {
          profileCadence: 'weekly',
          dayOfWeek: String(profile.schedule.dayOfWeek),
          hourUtc: String(profile.schedule.hourUtc),
          weeklyRecurrence: 'deferred',
        },
      };
    case 'manual':
      return {
        ...base,
        intervalSeconds: SECONDS_PER_DAY,
        nextRunAt: NON_AUTOMATIC_NEXT_RUN_AT,
        metadata: {
          profileCadence: 'manual',
        },
      };
  }
}

/** Upsert the operational schedule for a profile (idempotent — one schedule per profile). */
export async function syncProfileOperationalSchedule(input: {
  profile: DiscoveryProfile;
  discoveryService: DiscoveryService;
  now: string;
}): Promise<void> {
  await input.discoveryService.start();
  const registration = buildOperationalScheduleRegistration(input.profile, input.now);
  await input.discoveryService.registerSchedule(registration);
}
