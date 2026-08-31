import type { ScheduledRunRecord } from './types.js';

/** Storage-neutral scheduler run metadata port. */
export interface RunStore {
  insert(run: ScheduledRunRecord): Promise<void>;
  update(run: ScheduledRunRecord): Promise<void>;
  get(runId: string): Promise<ScheduledRunRecord | null>;
  listBySchedule(scheduleId: string): Promise<ScheduledRunRecord[]>;
}
