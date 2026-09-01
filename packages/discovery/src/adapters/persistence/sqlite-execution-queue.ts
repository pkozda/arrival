import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Clock } from '../../scheduler/clock.js';
import { clockIso } from '../../scheduler/clock.js';
import { QueueError } from '../../queue/errors.js';
import type {
  DiscoveryExecutionQueue,
  QueueClaimOptions,
  RecoverExpiredClaimsResult,
} from '../../queue/execution-queue.js';
import type { QueueRetryOptions } from '../../queue/execution-queue.js';
import type {
  DiscoveryExecutionJob,
  DiscoveryExecutionJobStatus,
  EnqueueJobInput,
  EnqueueResult,
} from '../../queue/types.js';
import type { ScheduleRunTrigger } from '../../scheduler/types.js';

export const DISCOVERY_EXECUTION_QUEUE_SCHEMA_VERSION = 1 as const;

/** Default claim lease — 5 minutes. */
export const DEFAULT_QUEUE_VISIBILITY_TIMEOUT_MS = 300_000;

export type SqliteExecutionQueueConfig = {
  databasePath: string;
  clock: Clock;
  /** Claim lease duration. Expired RUNNING jobs become recoverable. */
  visibilityTimeoutMs?: number;
  /** When true (default), recover expired claims on open. Does not execute jobs. */
  recoverOnOpen?: boolean;
  ensureDirectory?: boolean;
};

export type SqliteExecutionQueue = DiscoveryExecutionQueue & {
  close(): void;
  count(): number;
  /** Inspect raw persisted row JSON for security tests. */
  dumpPayloadJson(jobId: string): string | null;
};

const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS discovery_execution_jobs (
  job_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  schedule_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  trigger TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  failure_reason TEXT,
  metadata TEXT,
  available_at TEXT NOT NULL,
  claimed_at TEXT,
  claim_owner TEXT,
  updated_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_discovery_execution_jobs_pending
  ON discovery_execution_jobs (status, available_at, requested_at);

CREATE INDEX IF NOT EXISTS idx_discovery_execution_jobs_run
  ON discovery_execution_jobs (run_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discovery_execution_jobs_active_run
  ON discovery_execution_jobs (run_id)
  WHERE status IN ('QUEUED', 'RUNNING');

CREATE INDEX IF NOT EXISTS idx_discovery_execution_jobs_claim
  ON discovery_execution_jobs (status, claimed_at);
`;

type JobRow = {
  job_id: string;
  run_id: string;
  schedule_id: string;
  profile_id: string;
  strategy_id: string;
  strategy_version: string;
  trigger: string;
  requested_at: string;
  attempt: number;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  failure_reason: string | null;
  metadata: string | null;
  available_at: string;
  claimed_at: string | null;
  claim_owner: string | null;
  updated_at: string;
  schema_version: number;
};

function serializeMetadata(
  metadata: Record<string, string> | undefined
): string | null {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  return JSON.stringify(metadata);
}

function deserializeMetadata(
  raw: string | null
): Record<string, string> | undefined {
  if (!raw) return undefined;
  const parsed = JSON.parse(raw) as Record<string, string>;
  return parsed;
}

function fromRow(row: JobRow): DiscoveryExecutionJob {
  return {
    jobId: row.job_id,
    runId: row.run_id,
    scheduleId: row.schedule_id,
    profileId: row.profile_id,
    strategyId: row.strategy_id,
    strategyVersion: row.strategy_version,
    trigger: row.trigger as ScheduleRunTrigger,
    requestedAt: row.requested_at,
    attempt: row.attempt,
    status: row.status as DiscoveryExecutionJobStatus,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    metadata: deserializeMetadata(row.metadata),
    availableAt: row.available_at,
    claimedAt: row.claimed_at ?? undefined,
    claimOwner: row.claim_owner ?? undefined,
  };
}

function claimCutoffIso(now: string, visibilityTimeoutMs: number): string {
  return new Date(Date.parse(now) - visibilityTimeoutMs).toISOString();
}

function assertClaimOwner(
  row: JobRow,
  options: QueueClaimOptions | undefined,
  op: string
): void {
  if (!options?.claimOwner) return;
  if (row.claim_owner && row.claim_owner !== options.claimOwner) {
    throw new QueueError(
      `Cannot ${op} job ${row.job_id}: claimed by ${row.claim_owner}`
    );
  }
}

/**
 * SQLite-backed durable execution queue (E5.2).
 *
 * Delivery: at-least-once after crash recovery (same runId reused).
 * Payload stores only serializable execution metadata — never secrets.
 */
export function createSqliteExecutionQueue(
  config: SqliteExecutionQueueConfig
): SqliteExecutionQueue {
  const visibilityTimeoutMs =
    config.visibilityTimeoutMs ?? DEFAULT_QUEUE_VISIBILITY_TIMEOUT_MS;
  if (!Number.isFinite(visibilityTimeoutMs) || visibilityTimeoutMs <= 0) {
    throw new QueueError('visibilityTimeoutMs must be a positive number');
  }

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
  db.exec(MIGRATION_V1);

  const selectById = db.prepare(
    `SELECT * FROM discovery_execution_jobs WHERE job_id = ?`
  );
  const selectActiveByRun = db.prepare(
    `SELECT 1 AS ok FROM discovery_execution_jobs
     WHERE run_id = ? AND status IN ('QUEUED', 'RUNNING')
     LIMIT 1`
  );

  function recoverExpiredClaimsSync(now: string): RecoverExpiredClaimsResult {
    const cutoff = claimCutoffIso(now, visibilityTimeoutMs);
    const tx = db.transaction(() => {
      const expired = db
        .prepare(
          `SELECT job_id FROM discovery_execution_jobs
           WHERE status = 'RUNNING'
             AND claimed_at IS NOT NULL
             AND claimed_at <= ?
           ORDER BY claimed_at ASC`
        )
        .all(cutoff) as Array<{ job_id: string }>;

      const recoveredJobIds: string[] = [];
      const update = db.prepare(
        `UPDATE discovery_execution_jobs
         SET status = 'QUEUED',
             attempt = attempt + 1,
             claimed_at = NULL,
             claim_owner = NULL,
             started_at = NULL,
             available_at = ?,
             updated_at = ?
         WHERE job_id = ? AND status = 'RUNNING'`
      );

      for (const row of expired) {
        const info = update.run(now, now, row.job_id);
        if (info.changes === 1) {
          recoveredJobIds.push(row.job_id);
        }
      }
      return recoveredJobIds;
    });

    return { recoveredJobIds: tx() };
  }

  if (config.recoverOnOpen !== false) {
    recoverExpiredClaimsSync(clockIso(config.clock));
  }

  return {
    async enqueue(input: EnqueueJobInput): Promise<EnqueueResult> {
      const now = clockIso(config.clock);
      const existingJob = selectById.get(input.jobId) as JobRow | undefined;
      if (existingJob) {
        return { ok: false, reason: 'duplicate_job_id' };
      }
      if (selectActiveByRun.get(input.runId)) {
        return { ok: false, reason: 'duplicate_run_id' };
      }

      const job: DiscoveryExecutionJob = {
        jobId: input.jobId,
        runId: input.runId,
        scheduleId: input.scheduleId,
        profileId: input.profileId,
        strategyId: input.strategyId,
        strategyVersion: input.strategyVersion,
        trigger: input.trigger,
        requestedAt: input.requestedAt,
        attempt: 1,
        status: 'QUEUED',
        metadata: input.metadata,
        availableAt: input.requestedAt,
      };

      try {
        db.prepare(
          `INSERT INTO discovery_execution_jobs (
            job_id, run_id, schedule_id, profile_id, strategy_id, strategy_version,
            trigger, requested_at, attempt, status, started_at, finished_at,
            failure_reason, metadata, available_at, claimed_at, claim_owner,
            updated_at, schema_version
          ) VALUES (
            @job_id, @run_id, @schedule_id, @profile_id, @strategy_id, @strategy_version,
            @trigger, @requested_at, @attempt, @status, NULL, NULL,
            NULL, @metadata, @available_at, NULL, NULL,
            @updated_at, @schema_version
          )`
        ).run({
          job_id: job.jobId,
          run_id: job.runId,
          schedule_id: job.scheduleId,
          profile_id: job.profileId,
          strategy_id: job.strategyId,
          strategy_version: job.strategyVersion,
          trigger: job.trigger,
          requested_at: job.requestedAt,
          attempt: job.attempt,
          status: job.status,
          metadata: serializeMetadata(job.metadata),
          available_at: job.availableAt!,
          updated_at: now,
          schema_version: DISCOVERY_EXECUTION_QUEUE_SCHEMA_VERSION,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/UNIQUE|unique/i.test(message)) {
          if (/job_id|PRIMARY/i.test(message)) {
            return { ok: false, reason: 'duplicate_job_id' };
          }
          return { ok: false, reason: 'duplicate_run_id' };
        }
        throw new QueueError(`Enqueue failed: ${message}`);
      }

      return { ok: true, job: structuredClone(job) };
    },

    async dequeue(options?: QueueClaimOptions): Promise<DiscoveryExecutionJob | null> {
      const now = clockIso(config.clock);
      const claimOwner = options?.claimOwner ?? 'default-worker';

      const tx = db.transaction(() => {
        const row = db
          .prepare(
            `SELECT * FROM discovery_execution_jobs
             WHERE status = 'QUEUED' AND available_at <= ?
             ORDER BY available_at ASC, requested_at ASC, job_id ASC
             LIMIT 1`
          )
          .get(now) as JobRow | undefined;
        if (!row) return null;

        const info = db
          .prepare(
            `UPDATE discovery_execution_jobs
             SET status = 'RUNNING',
                 started_at = ?,
                 claimed_at = ?,
                 claim_owner = ?,
                 updated_at = ?
             WHERE job_id = ? AND status = 'QUEUED'`
          )
          .run(now, now, claimOwner, now, row.job_id);

        if (info.changes !== 1) return null;

        const updated = selectById.get(row.job_id) as JobRow;
        return fromRow(updated);
      });

      return tx();
    },

    async ack(jobId, finishedAt, options?: QueueClaimOptions) {
      const tx = db.transaction(() => {
        const row = selectById.get(jobId) as JobRow | undefined;
        if (!row) throw new QueueError(`Job not found: ${jobId}`);
        if (row.status === 'COMPLETED') return;
        if (row.status !== 'RUNNING') {
          throw new QueueError(`Cannot ack job ${jobId} in status ${row.status}`);
        }
        assertClaimOwner(row, options, 'ack');
        db.prepare(
          `UPDATE discovery_execution_jobs
           SET status = 'COMPLETED',
               finished_at = ?,
               claimed_at = NULL,
               claim_owner = NULL,
               updated_at = ?
           WHERE job_id = ? AND status = 'RUNNING'`
        ).run(finishedAt, finishedAt, jobId);
      });
      tx();
    },

    async fail(jobId, finishedAt, reason, options?: QueueClaimOptions) {
      const tx = db.transaction(() => {
        const row = selectById.get(jobId) as JobRow | undefined;
        if (!row) throw new QueueError(`Job not found: ${jobId}`);
        if (row.status === 'FAILED') return;
        if (row.status !== 'RUNNING') {
          throw new QueueError(`Cannot fail job ${jobId} in status ${row.status}`);
        }
        assertClaimOwner(row, options, 'fail');
        db.prepare(
          `UPDATE discovery_execution_jobs
           SET status = 'FAILED',
               finished_at = ?,
               failure_reason = ?,
               claimed_at = NULL,
               claim_owner = NULL,
               updated_at = ?
           WHERE job_id = ? AND status = 'RUNNING'`
        ).run(finishedAt, reason, finishedAt, jobId);
      });
      tx();
    },

    async retry(jobId, availableAt, reason, options?: QueueRetryOptions) {
      const now = clockIso(config.clock);
      const tx = db.transaction(() => {
        const row = selectById.get(jobId) as JobRow | undefined;
        if (!row) throw new QueueError(`Job not found: ${jobId}`);
        if (row.status !== 'RUNNING') {
          throw new QueueError(`Cannot retry job ${jobId} in status ${row.status}`);
        }
        assertClaimOwner(row, options, 'retry');
        const meta = {
          ...deserializeMetadata(row.metadata),
          ...options?.metadata,
          lastFailureReason: reason,
          nextRetryAt: availableAt,
        };
        db.prepare(
          `UPDATE discovery_execution_jobs
           SET status = 'QUEUED',
               attempt = attempt + 1,
               available_at = ?,
               failure_reason = ?,
               metadata = ?,
               claimed_at = NULL,
               claim_owner = NULL,
               started_at = NULL,
               finished_at = NULL,
               updated_at = ?
           WHERE job_id = ? AND status = 'RUNNING'`
        ).run(
          availableAt,
          reason,
          serializeMetadata(meta),
          now,
          jobId
        );
      });
      tx();
    },

    async get(jobId) {
      const row = selectById.get(jobId) as JobRow | undefined;
      return row ? fromRow(row) : null;
    },

    async getByRunId(runId) {
      const row = db
        .prepare(
          `SELECT * FROM discovery_execution_jobs
           WHERE run_id = ?
           ORDER BY
             CASE status
               WHEN 'RUNNING' THEN 0
               WHEN 'QUEUED' THEN 1
               ELSE 2
             END,
             updated_at DESC
           LIMIT 1`
        )
        .get(runId) as JobRow | undefined;
      return row ? fromRow(row) : null;
    },

    async getPending() {
      const rows = db
        .prepare(
          `SELECT * FROM discovery_execution_jobs
           WHERE status = 'QUEUED'
           ORDER BY available_at ASC, requested_at ASC, job_id ASC`
        )
        .all() as JobRow[];
      return rows.map(fromRow);
    },

    async hasActiveRun(runId) {
      return Boolean(selectActiveByRun.get(runId));
    },

    async recoverExpiredClaims(now: string): Promise<RecoverExpiredClaimsResult> {
      return recoverExpiredClaimsSync(now);
    },

    async getHealthStats(now, options) {
      const timeout = options?.visibilityTimeoutMs ?? visibilityTimeoutMs;
      const cutoff = claimCutoffIso(now, timeout);

      const counts = db
        .prepare(
          `SELECT
             SUM(CASE WHEN status = 'QUEUED' THEN 1 ELSE 0 END) AS queued,
             SUM(CASE WHEN status = 'RUNNING' THEN 1 ELSE 0 END) AS running,
             SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed
           FROM discovery_execution_jobs`
        )
        .get() as { queued: number | null; running: number | null; failed: number | null };

      const oldestQueued = db
        .prepare(
          `SELECT MIN(available_at) AS oldest FROM discovery_execution_jobs WHERE status = 'QUEUED'`
        )
        .get() as { oldest: string | null };

      const oldestRunning = db
        .prepare(
          `SELECT MIN(COALESCE(claimed_at, started_at, requested_at)) AS oldest
           FROM discovery_execution_jobs WHERE status = 'RUNNING'`
        )
        .get() as { oldest: string | null };

      const recoverable = db
        .prepare(
          `SELECT COUNT(*) AS c FROM discovery_execution_jobs
           WHERE status = 'RUNNING'
             AND claimed_at IS NOT NULL
             AND claimed_at <= ?`
        )
        .get(cutoff) as { c: number };

      return {
        queuedCount: counts.queued ?? 0,
        runningCount: counts.running ?? 0,
        failedCount: counts.failed ?? 0,
        oldestQueuedAt: oldestQueued.oldest ?? undefined,
        oldestRunningAt: oldestRunning.oldest ?? undefined,
        recoverableClaimCount: recoverable.c,
      };
    },

    count() {
      const row = db
        .prepare(`SELECT COUNT(*) AS c FROM discovery_execution_jobs`)
        .get() as { c: number };
      return row.c;
    },

    dumpPayloadJson(jobId: string): string | null {
      const row = selectById.get(jobId) as JobRow | undefined;
      if (!row) return null;
      return JSON.stringify({
        job_id: row.job_id,
        run_id: row.run_id,
        schedule_id: row.schedule_id,
        profile_id: row.profile_id,
        strategy_id: row.strategy_id,
        strategy_version: row.strategy_version,
        trigger: row.trigger,
        requested_at: row.requested_at,
        attempt: row.attempt,
        status: row.status,
        metadata: row.metadata,
        available_at: row.available_at,
        claimed_at: row.claimed_at,
        claim_owner: row.claim_owner,
      });
    },

    close() {
      db.close();
    },
  };
}
