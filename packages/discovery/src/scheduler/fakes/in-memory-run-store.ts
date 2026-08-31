import type { ScheduledRunRecord } from '../types.js';
import { RunStoreError } from '../errors.js';
import type { RunStore } from '../run-store.js';

export function createInMemoryRunStore(
  seed: ScheduledRunRecord[] = []
): RunStore & {
  snapshot(): ScheduledRunRecord[];
} {
  const runs = new Map<string, ScheduledRunRecord>(
    seed.map((r) => [r.runId, structuredClone(r)])
  );

  return {
    async insert(run) {
      if (runs.has(run.runId)) {
        throw new RunStoreError(`Run already exists: ${run.runId}`);
      }
      runs.set(run.runId, structuredClone(run));
    },

    async update(run) {
      if (!runs.has(run.runId)) {
        throw new RunStoreError(`Run not found: ${run.runId}`);
      }
      runs.set(run.runId, structuredClone(run));
    },

    async get(runId) {
      const found = runs.get(runId);
      return found ? structuredClone(found) : null;
    },

    async listBySchedule(scheduleId) {
      return [...runs.values()]
        .filter((r) => r.scheduleId === scheduleId)
        .map((r) => structuredClone(r));
    },

    snapshot() {
      return [...runs.values()].map((r) => structuredClone(r));
    },
  };
}
