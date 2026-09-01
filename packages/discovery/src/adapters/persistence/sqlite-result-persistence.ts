import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { CandidateIdentity } from '../../types/candidate.js';
import type { DiscoveryResult } from '../../types/result.js';
import {
  resultIdentityKey,
  ResultStoreError,
  type ResultStore,
} from '../../pipeline/result-store.js';
import { ResultWriterError, type ResultWriter } from '../../pipeline/result-writer.js';
import {
  deserializeDiscoveryResult,
  DISCOVERY_RESULT_RECORD_SCHEMA_VERSION,
  serializeDiscoveryResult,
} from './result-record.js';

export type SqliteResultPersistenceConfig = {
  /**
   * SQLite database file path, or `:memory:` for ephemeral storage.
   * Composition root supplies path — adapter never reads process.env.
   */
  databasePath: string;
  /** When true (default), create parent directories for file paths. */
  ensureDirectory?: boolean;
};

export type SqliteResultPersistence = ResultStore &
  ResultWriter & {
    close(): void;
    /** Test/diagnostic helper — row count. */
    count(): number;
  };

const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS discovery_results (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_discovery_results_profile
  ON discovery_results (profile_id);
`;

/**
 * Durable ResultStore + ResultWriter (E4.1).
 * SQLite-backed, transactional, identity keyed by existing result.id convention.
 */
export function createSqliteResultPersistence(
  config: SqliteResultPersistenceConfig
): SqliteResultPersistence {
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

  const selectById = db.prepare(
    `SELECT payload FROM discovery_results WHERE id = ? AND profile_id = ?`
  );
  const existsById = db.prepare(`SELECT id FROM discovery_results WHERE id = ?`);
  const insertStmt = db.prepare(
    `INSERT INTO discovery_results
      (id, profile_id, payload, schema_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const updateStmt = db.prepare(
    `UPDATE discovery_results
     SET payload = ?, schema_version = ?, updated_at = ?
     WHERE id = ?`
  );
  const countStmt = db.prepare(`SELECT COUNT(*) AS count FROM discovery_results`);
  const listByProfileStmt = db.prepare(
    `SELECT payload FROM discovery_results WHERE profile_id = ? ORDER BY updated_at DESC`
  );

  function resultIdForLookup(
    profileId: string,
    identity: CandidateIdentity,
    identityFingerprintFields: readonly string[]
  ): string {
    return `result:${profileId}:${resultIdentityKey(identity, identityFingerprintFields)}`;
  }

  function mapReadError(err: unknown): never {
    if (err instanceof ResultStoreError) throw err;
    throw new ResultStoreError('Result persistence read failed');
  }

  function mapWriteError(err: unknown, context: 'create' | 'update'): never {
    if (err instanceof ResultWriterError) throw err;
    if (err instanceof Error) {
      if (/UNIQUE constraint failed/i.test(err.message)) {
        throw new ResultWriterError('Result already exists');
      }
    }
    throw new ResultWriterError(`Result persistence ${context} failed`);
  }

  return {
    async findByIdentity(
      profileId: string,
      identity: CandidateIdentity,
      identityFingerprintFields: readonly string[]
    ): Promise<DiscoveryResult | null> {
      try {
        const id = resultIdForLookup(profileId, identity, identityFingerprintFields);
        const row = selectById.get(id, profileId) as { payload: string } | undefined;
        if (!row) return null;
        return deserializeDiscoveryResult(row.payload);
      } catch (err) {
        mapReadError(err);
      }
    },

    async getById(
      profileId: string,
      resultId: string
    ): Promise<DiscoveryResult | null> {
      try {
        const row = selectById.get(resultId, profileId) as
          | { payload: string }
          | undefined;
        if (!row) return null;
        return deserializeDiscoveryResult(row.payload);
      } catch (err) {
        mapReadError(err);
      }
    },

    async listByProfile(profileId: string): Promise<DiscoveryResult[]> {
      try {
        const rows = listByProfileStmt.all(profileId) as { payload: string }[];
        return rows.map((row) => deserializeDiscoveryResult(row.payload));
      } catch (err) {
        mapReadError(err);
      }
    },

    async create(result: DiscoveryResult): Promise<DiscoveryResult> {
      const payload = serializeDiscoveryResult(result);
      const now = result.firstSeenAt || result.lastChangedAt;
      try {
        const write = db.transaction(() => {
          if (existsById.get(result.id)) {
            throw new ResultWriterError(`Result already exists: ${result.id}`);
          }
          insertStmt.run(
            result.id,
            result.profileId,
            payload,
            DISCOVERY_RESULT_RECORD_SCHEMA_VERSION,
            now,
            now
          );
        });
        write();
        return structuredClone(result);
      } catch (err) {
        mapWriteError(err, 'create');
      }
    },

    async update(result: DiscoveryResult): Promise<DiscoveryResult> {
      const payload = serializeDiscoveryResult(result);
      const now = result.lastChangedAt;
      try {
        const write = db.transaction(() => {
          const existing = existsById.get(result.id);
          if (!existing) {
            throw new ResultWriterError(`Result not found: ${result.id}`);
          }
          const info = updateStmt.run(
            payload,
            DISCOVERY_RESULT_RECORD_SCHEMA_VERSION,
            now,
            result.id
          );
          if (info.changes !== 1) {
            throw new ResultWriterError(`Result update affected ${info.changes} rows`);
          }
        });
        write();
        return structuredClone(result);
      } catch (err) {
        mapWriteError(err, 'update');
      }
    },

    close() {
      db.close();
    },

    count() {
      return (countStmt.get() as { count: number }).count;
    },
  };
}
