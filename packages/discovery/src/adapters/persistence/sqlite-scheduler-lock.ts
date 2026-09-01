import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  expiresAtIso,
  type SchedulerLock,
  type SchedulerLockAcquireResult,
  type SchedulerLockRecord,
  type SchedulerLockRecoverResult,
  type SchedulerLockReleaseResult,
} from '../../scheduler/scheduler-lock.js';

export const DISCOVERY_SCHEDULER_LOCK_SCHEMA_VERSION = 1 as const;

export type SqliteSchedulerLockConfig = {
  databasePath: string;
  ensureDirectory?: boolean;
  /** When provided, reuse an open better-sqlite3 Database (caller owns close). */
  database?: Database.Database;
};

export type SqliteSchedulerLock = SchedulerLock & {
  close(): void;
  count(): number;
};

const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS discovery_scheduler_locks (
  lock_key TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_discovery_scheduler_locks_expires
  ON discovery_scheduler_locks (expires_at);
`;

type LockRow = {
  lock_key: string;
  owner_id: string;
  acquired_at: string;
  expires_at: string;
};

function fromRow(row: LockRow): SchedulerLockRecord {
  return {
    lockKey: row.lock_key,
    ownerId: row.owner_id,
    acquiredAt: row.acquired_at,
    expiresAt: row.expires_at,
  };
}

/**
 * SQLite-backed SchedulerLock (E5.3).
 * Atomic acquire via transaction + primary key; expired rows may be replaced.
 *
 * Note: SQLite file locking is process-local to the DB file. True multi-host
 * deployment requires PostgreSQL/Redis (deferred). Same-file multi-connection
 * contention is supported via transactions.
 */
export function createSqliteSchedulerLock(
  config: SqliteSchedulerLockConfig
): SqliteSchedulerLock {
  const ownsDb = config.database === undefined;
  let db: Database.Database;

  if (config.database) {
    db = config.database;
  } else {
    const dbPath = config.databasePath;
    if (
      config.ensureDirectory !== false &&
      dbPath !== ':memory:' &&
      !dbPath.startsWith('file:')
    ) {
      mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }

  db.exec(MIGRATION_V1);

  const selectByKey = db.prepare(
    `SELECT lock_key, owner_id, acquired_at, expires_at
     FROM discovery_scheduler_locks WHERE lock_key = ?`
  );

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

      const expiresAt = expiresAtIso(now, leaseMs);

      const acquire = db.transaction(() => {
        const existing = selectByKey.get(key) as LockRow | undefined;
        if (existing && Date.parse(existing.expires_at) > Date.parse(now)) {
          return {
            acquired: false as const,
            reason: 'already_locked' as const,
            lockKey: key,
            currentOwnerId: existing.owner_id,
            expiresAt: existing.expires_at,
          };
        }

        // Replace missing or expired row atomically under the transaction.
        db.prepare(
          `INSERT INTO discovery_scheduler_locks (
            lock_key, owner_id, acquired_at, expires_at, schema_version
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(lock_key) DO UPDATE SET
            owner_id = excluded.owner_id,
            acquired_at = excluded.acquired_at,
            expires_at = excluded.expires_at,
            schema_version = excluded.schema_version
          WHERE discovery_scheduler_locks.expires_at <= ?`
        ).run(
          key,
          ownerId,
          now,
          expiresAt,
          DISCOVERY_SCHEDULER_LOCK_SCHEMA_VERSION,
          now
        );

        const row = selectByKey.get(key) as LockRow | undefined;
        if (!row || row.owner_id !== ownerId || row.acquired_at !== now) {
          return {
            acquired: false as const,
            reason: 'already_locked' as const,
            lockKey: key,
            currentOwnerId: row?.owner_id,
            expiresAt: row?.expires_at,
          };
        }

        return {
          acquired: true as const,
          lockKey: key,
          ownerId,
          acquiredAt: now,
          expiresAt,
        };
      });

      return acquire();
    },

    async release(key, ownerId): Promise<SchedulerLockReleaseResult> {
      const release = db.transaction(() => {
        const existing = selectByKey.get(key) as LockRow | undefined;
        if (!existing) {
          return { released: false as const, reason: 'not_found' as const, lockKey: key };
        }
        if (existing.owner_id !== ownerId) {
          return { released: false as const, reason: 'not_owner' as const, lockKey: key };
        }
        db.prepare(
          `DELETE FROM discovery_scheduler_locks WHERE lock_key = ? AND owner_id = ?`
        ).run(key, ownerId);
        return { released: true as const, lockKey: key };
      });
      return release();
    },

    async recoverExpired(now): Promise<SchedulerLockRecoverResult> {
      const recover = db.transaction(() => {
        const rows = db
          .prepare(
            `SELECT lock_key FROM discovery_scheduler_locks WHERE expires_at <= ?`
          )
          .all(now) as Array<{ lock_key: string }>;
        const recoveredKeys = rows.map((r) => r.lock_key);
        if (recoveredKeys.length > 0) {
          db.prepare(
            `DELETE FROM discovery_scheduler_locks WHERE expires_at <= ?`
          ).run(now);
        }
        return { recoveredKeys };
      });
      return recover();
    },

    async get(key) {
      const row = selectByKey.get(key) as LockRow | undefined;
      return row ? fromRow(row) : null;
    },

    async countActive(now) {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS c FROM discovery_scheduler_locks WHERE expires_at > ?`
        )
        .get(now) as { c: number };
      return row.c;
    },

    count() {
      const row = db
        .prepare(`SELECT COUNT(*) AS c FROM discovery_scheduler_locks`)
        .get() as { c: number };
      return row.c;
    },

    close() {
      if (ownsDb) {
        db.close();
      }
    },
  };
}
