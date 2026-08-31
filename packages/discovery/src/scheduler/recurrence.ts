import { SchedulerError } from './errors.js';

/**
 * Advance from the previous scheduled slot until strictly after `now`.
 * Coalesces missed intervals: one execution advances to the next future slot.
 *
 * nextRunAt = previousScheduledAt + n * interval (n minimal s.t. result > now)
 */
export function calculateNextRunAt(
  previousScheduledAt: string,
  intervalSeconds: number,
  now: string
): string {
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    throw new SchedulerError('intervalSeconds must be positive');
  }
  const intervalMs = intervalSeconds * 1000;
  let next = Date.parse(previousScheduledAt);
  const nowMs = Date.parse(now);
  if (Number.isNaN(next) || Number.isNaN(nowMs)) {
    throw new SchedulerError('Invalid schedule timestamp');
  }
  while (next <= nowMs) {
    next += intervalMs;
  }
  return new Date(next).toISOString();
}

/** First next run after registration or re-enable. */
export function initialNextRunAt(now: string, intervalSeconds: number): string {
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) {
    throw new SchedulerError('Invalid now timestamp');
  }
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    throw new SchedulerError('intervalSeconds must be positive');
  }
  return new Date(nowMs + intervalSeconds * 1000).toISOString();
}
