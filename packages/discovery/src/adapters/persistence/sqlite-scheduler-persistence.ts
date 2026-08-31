import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { RunStoreError, ScheduleStoreError } from '../../scheduler/errors.js';
import type { RunStore } from '../../scheduler/run-store.js';
import type { ScheduleStore } from '../../scheduler/schedule-store.js';
import type {
  DiscoveryScheduleRecord,
  ScheduledRunRecord,
  ScheduleRunTrigger,
} from '../../scheduler/types.js';
import type { DiscoveryRunStatus } from '../../types/run.js';

export const DISCOVERY_SCHEDULER_SCHEMA_VERSION = 1 as const;

export type SqliteSchedulerPersistenceConfig = {
  databasePath: string;
  ensureDirectory?: boolean;
};

export type SqliteSchedulerPersistence = {
  scheduleStore: ScheduleStore;
  runStore: RunStore;
  close(): void;
};

const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS discovery_schedules (
  schedule_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  interval_seconds INTEGER NOT NULL,
  timezone TEXT NOT NULL,
  next_run_at TEXT NOT NULL,
  running_run_id TEXT,
  metadata TEXT,
  schema_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_discovery_schedules_due
  ON discovery_schedules (enabled, next_run_at);

CREATE TABLE IF NOT EXISTS discovery_scheduler_runs (
  run_id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  trigger TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  skip_reason TEXT,
  error_message TEXT,
  schema_version INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_discovery_scheduler_runs_schedule
  ON discovery_scheduler_runs (schedule_id);
`;

export function createSqliteSchedulerPersistence(
  config: SqliteSchedulerPersistenceConfig
): SqliteSchedulerPersistence {
  const dbPath = config.databasePath;
  if (
    config.ensureDirectory !== false &&
    dbPath !== ':memory:' &&
    !dbPath.startsWith('file:')
  ) {
    mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(MIGRATION_V1);

  const scheduleStore: ScheduleStore = {
    async upsert(schedule) {
      try {
        const row = toScheduleRow(schedule);
        db.prepare(
          `INSERT INTO discovery_schedules (
            schedule_id, profile_id, strategy_id, strategy_version, enabled,
            interval_seconds, timezone, next_run_at, running_run_id, metadata,
            schema_version, created_at, updated_at
          ) VALUES (
            @schedule_id, @profile_id, @strategy_id, @strategy_version, @enabled,
            @interval_seconds, @timezone, @next_run_at, @running_run_id, @metadata,
            @schema_version, @created_at, @updated_at
          )
          ON CONFLICT(schedule_id) DO UPDATE SET
            profile_id = excluded.profile_id,
            strategy_id = excluded.strategy_id,
            strategy_version = excluded.strategy_version,
            enabled = excluded.enabled,
            interval_seconds = excluded.interval_seconds,
            timezone = excluded.timezone,
            next_run_at = excluded.next_run_at,
            running_run_id = excluded.running_run_id,
            metadata = excluded.metadata,
            schema_version = excluded.schema_version,
            updated_at = excluded.updated_at`
        ).run(row);
      } catch {
        throw new ScheduleStoreError('Schedule persistence upsert failed');
      }
    },

    async get(scheduleId) {
      try {
        const row = db
          .prepare(`SELECT * FROM discovery_schedules WHERE schedule_id = ?`)
          .get(scheduleId) as ScheduleRow | undefined;
        return row ? fromScheduleRow(row) : null;
      } catch (err) {
        if (err instanceof ScheduleStoreError) throw err;
        throw new ScheduleStoreError('Schedule persistence read failed');
      }
    },

    async listEnabled() {
      try {
        const rows = db
          .prepare(`SELECT * FROM discovery_schedules WHERE enabled = 1`)
          .all() as ScheduleRow[];
        return rows.map(fromScheduleRow);
      } catch (err) {
        if (err instanceof ScheduleStoreError) throw err;
        throw new ScheduleStoreError('Schedule persistence list failed');
      }
    },

    async getDueSchedules(now) {
      try {
        const rows = db
          .prepare(
            `SELECT * FROM discovery_schedules
             WHERE enabled = 1
               AND (running_run_id IS NULL OR running_run_id = '')
               AND next_run_at <= ?`
          )
          .all(now) as ScheduleRow[];
        return rows.map(fromScheduleRow);
      } catch (err) {
        throw new ScheduleStoreError('Schedule persistence due query failed');
      }
    },

    async tryClaim(scheduleId, runId, now, options) {
      const requireDue = options?.requireDue ?? true;
      try {
        const claim = db.transaction(() => {
          const row = db
            .prepare(`SELECT * FROM discovery_schedules WHERE schedule_id = ?`)
            .get(scheduleId) as ScheduleRow | undefined;
          if (!row || row.enabled !== 1) return false;
          if (row.running_run_id) return false;
          if (requireDue && row.next_run_at > now) return false;
          const info = db
            .prepare(
              `UPDATE discovery_schedules
               SET running_run_id = ?, updated_at = ?
               WHERE schedule_id = ?
                 AND enabled = 1
                 AND (running_run_id IS NULL OR running_run_id = '')
                 AND (? = 0 OR next_run_at <= ?)`
            )
            .run(runId, now, scheduleId, requireDue ? 1 : 0, now);
          return info.changes === 1;
        });
        return claim();
      } catch {
        throw new ScheduleStoreError('Schedule claim failed');
      }
    },

    async releaseAfterRun(scheduleId, nextRunAt, now) {
      try {
        const info = db
          .prepare(
            `UPDATE discovery_schedules
             SET running_run_id = NULL, next_run_at = ?, updated_at = ?
             WHERE schedule_id = ?`
          )
          .run(nextRunAt, now, scheduleId);
        if (info.changes !== 1) {
          throw new ScheduleStoreError(`Schedule not found: ${scheduleId}`);
        }
      } catch (err) {
        if (err instanceof ScheduleStoreError) throw err;
        throw new ScheduleStoreError('Schedule release failed');
      }
    },

    async clearRunningLock(scheduleId, now) {
      try {
        const info = db
          .prepare(
            `UPDATE discovery_schedules
             SET running_run_id = NULL, updated_at = ?
             WHERE schedule_id = ?`
          )
          .run(now, scheduleId);
        if (info.changes !== 1) {
          throw new ScheduleStoreError(`Schedule not found: ${scheduleId}`);
        }
      } catch (err) {
        if (err instanceof ScheduleStoreError) throw err;
        throw new ScheduleStoreError('Schedule clear lock failed');
      }
    },

    async advanceNextRunAt(scheduleId, nextRunAt, now) {
      try {
        const info = db
          .prepare(
            `UPDATE discovery_schedules
             SET next_run_at = ?, updated_at = ?
             WHERE schedule_id = ?`
          )
          .run(nextRunAt, now, scheduleId);
        if (info.changes !== 1) {
          throw new ScheduleStoreError(`Schedule not found: ${scheduleId}`);
        }
      } catch (err) {
        if (err instanceof ScheduleStoreError) throw err;
        throw new ScheduleStoreError('Schedule advance failed');
      }
    },
  };

  const runStore: RunStore = {
    async insert(run) {
      try {
        db.prepare(
          `INSERT INTO discovery_scheduler_runs (
            run_id, schedule_id, profile_id, trigger, started_at, finished_at,
            status, skip_reason, error_message, schema_version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          run.runId,
          run.scheduleId,
          run.profileId,
          run.trigger,
          run.startedAt,
          run.finishedAt ?? null,
          run.status,
          run.skipReason ?? null,
          run.errorMessage ?? null,
          DISCOVERY_SCHEDULER_SCHEMA_VERSION
        );
      } catch (err) {
        if (err instanceof Error && /UNIQUE constraint failed/i.test(err.message)) {
          throw new RunStoreError(`Run already exists: ${run.runId}`);
        }
        throw new RunStoreError('Run metadata insert failed');
      }
    },

    async update(run) {
      try {
        const info = db
          .prepare(
            `UPDATE discovery_scheduler_runs
             SET finished_at = ?, status = ?, skip_reason = ?, error_message = ?
             WHERE run_id = ?`
          )
          .run(
            run.finishedAt ?? null,
            run.status,
            run.skipReason ?? null,
            run.errorMessage ?? null,
            run.runId
          );
        if (info.changes !== 1) {
          throw new RunStoreError(`Run not found: ${run.runId}`);
        }
      } catch (err) {
        if (err instanceof RunStoreError) throw err;
        throw new RunStoreError('Run metadata update failed');
      }
    },

    async get(runId) {
      try {
        const row = db
          .prepare(`SELECT * FROM discovery_scheduler_runs WHERE run_id = ?`)
          .get(runId) as RunRow | undefined;
        return row ? fromRunRow(row) : null;
      } catch (err) {
        if (err instanceof RunStoreError) throw err;
        throw new RunStoreError('Run metadata read failed');
      }
    },

    async listBySchedule(scheduleId) {
      try {
        const rows = db
          .prepare(
            `SELECT * FROM discovery_scheduler_runs WHERE schedule_id = ? ORDER BY started_at`
          )
          .all(scheduleId) as RunRow[];
        return rows.map(fromRunRow);
      } catch (err) {
        throw new RunStoreError('Run metadata list failed');
      }
    },
  };

  return {
    scheduleStore,
    runStore,
    close() {
      db.close();
    },
  };
}

type ScheduleRow = {
  schedule_id: string;
  profile_id: string;
  strategy_id: string;
  strategy_version: string;
  enabled: number;
  interval_seconds: number;
  timezone: string;
  next_run_at: string;
  running_run_id: string | null;
  metadata: string | null;
  schema_version: number;
  created_at: string;
  updated_at: string;
};

type RunRow = {
  run_id: string;
  schedule_id: string;
  profile_id: string;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  skip_reason: string | null;
  error_message: string | null;
  schema_version: number;
};

function toScheduleRow(schedule: DiscoveryScheduleRecord): Record<string, unknown> {
  return {
    schedule_id: schedule.scheduleId,
    profile_id: schedule.profileId,
    strategy_id: schedule.strategyId,
    strategy_version: schedule.strategyVersion,
    enabled: schedule.enabled ? 1 : 0,
    interval_seconds: schedule.interval.intervalSeconds,
    timezone: schedule.timezone,
    next_run_at: schedule.nextRunAt,
    running_run_id: schedule.runningRunId,
    metadata: schedule.metadata ? JSON.stringify(schedule.metadata) : null,
    schema_version: DISCOVERY_SCHEDULER_SCHEMA_VERSION,
    created_at: schedule.createdAt,
    updated_at: schedule.updatedAt,
  };
}

function fromScheduleRow(row: ScheduleRow): DiscoveryScheduleRecord {
  if (row.schema_version !== DISCOVERY_SCHEDULER_SCHEMA_VERSION) {
    throw new ScheduleStoreError(
      `Unsupported schedule schema version: ${row.schema_version}`
    );
  }
  let metadata: Record<string, string> | undefined;
  if (row.metadata) {
    try {
      metadata = JSON.parse(row.metadata) as Record<string, string>;
    } catch {
      throw new ScheduleStoreError('Invalid schedule metadata JSON');
    }
  }
  return {
    scheduleId: row.schedule_id,
    profileId: row.profile_id,
    strategyId: row.strategy_id,
    strategyVersion: row.strategy_version,
    enabled: row.enabled === 1,
    interval: { kind: 'fixed_interval', intervalSeconds: row.interval_seconds },
    timezone: row.timezone,
    nextRunAt: row.next_run_at,
    runningRunId: row.running_run_id,
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromRunRow(row: RunRow): ScheduledRunRecord {
  if (row.schema_version !== DISCOVERY_SCHEDULER_SCHEMA_VERSION) {
    throw new RunStoreError(`Unsupported run schema version: ${row.schema_version}`);
  }
  return {
    runId: row.run_id,
    scheduleId: row.schedule_id,
    profileId: row.profile_id,
    trigger: row.trigger as ScheduleRunTrigger,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    status: row.status as DiscoveryRunStatus,
    skipReason: row.skip_reason ?? undefined,
    errorMessage: row.error_message ?? undefined,
  };
}
