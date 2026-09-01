import type { DiscoveryScheduleRecord } from '../types.js';
import { ScheduleStoreError } from '../errors.js';
import type { ScheduleStore } from '../schedule-store.js';

export function createInMemoryScheduleStore(
  seed: DiscoveryScheduleRecord[] = []
): ScheduleStore & {
  snapshot(): DiscoveryScheduleRecord[];
} {
  const schedules = new Map<string, DiscoveryScheduleRecord>(
    seed.map((s) => [s.scheduleId, structuredClone(s)])
  );

  function clone(s: DiscoveryScheduleRecord): DiscoveryScheduleRecord {
    return structuredClone(s);
  }

  return {
    async upsert(schedule) {
      schedules.set(schedule.scheduleId, clone(schedule));
    },

    async get(scheduleId) {
      const found = schedules.get(scheduleId);
      return found ? clone(found) : null;
    },

    async listEnabled() {
      return [...schedules.values()]
        .filter((s) => s.enabled)
        .map(clone);
    },

    async listAll() {
      return [...schedules.values()].map(clone);
    },

    async getDueSchedules(now) {
      const nowMs = Date.parse(now);
      return [...schedules.values()]
        .filter(
          (s) =>
            s.enabled &&
            !s.runningRunId &&
            Date.parse(s.nextRunAt) <= nowMs
        )
        .map(clone);
    },

    async tryClaim(scheduleId, runId, now, options) {
      const requireDue = options?.requireDue ?? true;
      const current = schedules.get(scheduleId);
      if (!current || !current.enabled) return false;
      if (current.runningRunId) return false;
      const nowMs = Date.parse(now);
      if (requireDue && Date.parse(current.nextRunAt) > nowMs) return false;
      schedules.set(scheduleId, {
        ...current,
        runningRunId: runId,
        updatedAt: now,
      });
      return true;
    },

    async releaseAfterRun(scheduleId, nextRunAt, now) {
      const current = schedules.get(scheduleId);
      if (!current) {
        throw new ScheduleStoreError(`Schedule not found: ${scheduleId}`);
      }
      schedules.set(scheduleId, {
        ...current,
        runningRunId: null,
        nextRunAt,
        updatedAt: now,
      });
    },

    async clearRunningLock(scheduleId, now, expectedRunId) {
      const current = schedules.get(scheduleId);
      if (!current) {
        throw new ScheduleStoreError(`Schedule not found: ${scheduleId}`);
      }
      if (
        expectedRunId !== undefined &&
        current.runningRunId !== null &&
        current.runningRunId !== expectedRunId
      ) {
        return;
      }
      schedules.set(scheduleId, {
        ...current,
        runningRunId: null,
        updatedAt: now,
      });
    },

    async advanceNextRunAt(scheduleId, nextRunAt, now) {
      const current = schedules.get(scheduleId);
      if (!current) {
        throw new ScheduleStoreError(`Schedule not found: ${scheduleId}`);
      }
      schedules.set(scheduleId, {
        ...current,
        nextRunAt,
        updatedAt: now,
      });
    },

    snapshot() {
      return [...schedules.values()].map(clone);
    },
  };
}
