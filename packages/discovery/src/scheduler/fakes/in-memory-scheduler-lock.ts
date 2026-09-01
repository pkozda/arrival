import type {
  SchedulerLock,
  SchedulerLockAcquireResult,
  SchedulerLockRecord,
  SchedulerLockRecoverResult,
  SchedulerLockReleaseResult,
} from '../scheduler-lock.js';
import { expiresAtIso } from '../scheduler-lock.js';

/**
 * Process-local SchedulerLock for unit tests.
 * Not durable — use SQLite for multi-runtime durability tests.
 */
export function createInMemorySchedulerLock(
  seed: SchedulerLockRecord[] = []
): SchedulerLock & {
  snapshot(): SchedulerLockRecord[];
} {
  const locks = new Map<string, SchedulerLockRecord>(
    seed.map((r) => [r.lockKey, structuredClone(r)])
  );

  function clone(r: SchedulerLockRecord): SchedulerLockRecord {
    return structuredClone(r);
  }

  return {
    async tryAcquire(key, ownerId, now, leaseMs): Promise<SchedulerLockAcquireResult> {
      if (!key?.trim()) {
        return { acquired: false, reason: 'invalid_key', lockKey: key ?? '' };
      }
      if (!ownerId?.trim()) {
        return { acquired: false, reason: 'invalid_owner', lockKey: key };
      }
      if (!Number.isFinite(leaseMs) || leaseMs <= 0) {
        return { acquired: false, reason: 'invalid_lease', lockKey: key };
      }

      const existing = locks.get(key);
      if (existing && Date.parse(existing.expiresAt) > Date.parse(now)) {
        return {
          acquired: false,
          reason: 'already_locked',
          lockKey: key,
          currentOwnerId: existing.ownerId,
          expiresAt: existing.expiresAt,
        };
      }

      const record: SchedulerLockRecord = {
        lockKey: key,
        ownerId,
        acquiredAt: now,
        expiresAt: expiresAtIso(now, leaseMs),
      };
      locks.set(key, record);
      return {
        acquired: true,
        lockKey: key,
        ownerId,
        acquiredAt: record.acquiredAt,
        expiresAt: record.expiresAt,
      };
    },

    async release(key, ownerId): Promise<SchedulerLockReleaseResult> {
      const existing = locks.get(key);
      if (!existing) {
        return { released: false, reason: 'not_found', lockKey: key };
      }
      if (existing.ownerId !== ownerId) {
        return { released: false, reason: 'not_owner', lockKey: key };
      }
      locks.delete(key);
      return { released: true, lockKey: key };
    },

    async recoverExpired(now): Promise<SchedulerLockRecoverResult> {
      const recoveredKeys: string[] = [];
      const nowMs = Date.parse(now);
      for (const [key, record] of locks) {
        if (Date.parse(record.expiresAt) <= nowMs) {
          locks.delete(key);
          recoveredKeys.push(key);
        }
      }
      return { recoveredKeys };
    },

    async get(key) {
      const found = locks.get(key);
      return found ? clone(found) : null;
    },

    async countActive(now) {
      const nowMs = Date.parse(now);
      let count = 0;
      for (const record of locks.values()) {
        if (Date.parse(record.expiresAt) > nowMs) count += 1;
      }
      return count;
    },

    snapshot() {
      return [...locks.values()].map(clone);
    },
  };
}
