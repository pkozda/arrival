/**
 * Storage-neutral scheduler lock port (E5.3).
 *
 * Protects schedule → run creation / enqueue across runtime instances.
 * Distinct from E5.2 queue job leases (job → worker execution).
 *
 * Lock lifetime covers only the enqueue critical section — not pipeline execution.
 */

export type SchedulerLockRecord = {
  lockKey: string;
  ownerId: string;
  acquiredAt: string;
  expiresAt: string;
};

export type SchedulerLockAcquireResult =
  | {
      acquired: true;
      lockKey: string;
      ownerId: string;
      acquiredAt: string;
      expiresAt: string;
    }
  | {
      acquired: false;
      reason: 'already_locked' | 'invalid_key' | 'invalid_owner' | 'invalid_lease';
      lockKey: string;
      currentOwnerId?: string;
      expiresAt?: string;
    };

export type SchedulerLockReleaseResult =
  | { released: true; lockKey: string }
  | {
      released: false;
      reason: 'not_held' | 'not_owner' | 'not_found';
      lockKey: string;
    };

export type SchedulerLockRecoverResult = {
  recoveredKeys: readonly string[];
};

/**
 * Durable mutual-exclusion for schedule trigger / enqueue.
 * Implementations must use atomic acquire (constraint + transaction), not
 * check-then-insert without protection.
 */
export interface SchedulerLock {
  tryAcquire(
    key: string,
    ownerId: string,
    now: string,
    leaseMs: number
  ): Promise<SchedulerLockAcquireResult>;

  release(key: string, ownerId: string): Promise<SchedulerLockReleaseResult>;

  /** Delete locks whose expiresAt <= now. Does not enqueue work. */
  recoverExpired(now: string): Promise<SchedulerLockRecoverResult>;

  get(key: string): Promise<SchedulerLockRecord | null>;

  /**
   * Count non-expired locks at `now` (read-only; does not acquire or recover).
   * E5.6 operational health.
   */
  countActive(now: string): Promise<number>;
}

/** Default lease for the enqueue critical section (30s). */
export const DEFAULT_SCHEDULER_LOCK_LEASE_MS = 30_000;

export function scheduleLockKey(scheduleId: string): string {
  return `schedule:${scheduleId}`;
}

export function schedulerOwnerId(runtimeInstanceId: string): string {
  return `scheduler:${runtimeInstanceId}`;
}

export function expiresAtIso(now: string, leaseMs: number): string {
  return new Date(Date.parse(now) + leaseMs).toISOString();
}
